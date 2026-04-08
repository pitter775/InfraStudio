import "server-only";

import { createSession } from "@/lib/session";
import { deleteProjeto, createProjetoForUsuario } from "@/lib/projetos";
import { applyProjectBillingSelection } from "@/lib/billing-project-snapshot";
import { getBillingPlanCatalogById } from "@/lib/billing-plan-catalog";
import { appendSystemLog } from "@/lib/chat-logs";
import { createEmailVerificationToken, sendEmailVerification } from "@/lib/email-verifications";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createUsuario,
  deleteUsuario,
  findUsuarioByProvider,
  findUsuarioWithPasswordByEmail,
  getUsuarioById,
  updateUsuarioProviderAndVerification,
} from "@/lib/usuarios";

async function findDefaultFreePlanId() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("planos")
    .select("id")
    .eq("is_free", true)
    .eq("ativo", true)
    .order("preco_mensal", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Nao foi possivel localizar o plano free padrao.");
  }

  const row = data as { id: string | null } | null;
  return row?.id ?? null;
}

async function applyDefaultFreePlanToProjeto(projetoId: string) {
  const freePlanId = await findDefaultFreePlanId();
  if (!freePlanId) {
    return;
  }

  const freePlan = await getBillingPlanCatalogById(freePlanId);
  if (!freePlan) {
    return;
  }

  const billingResult = await applyProjectBillingSelection({
    projetoId,
    modoCobranca: "plano",
    planoId: freePlan.id,
  });

  if (!billingResult.ok) {
    throw new Error(`Falha ao aplicar plano free inicial: ${billingResult.reason}`);
  }
}

async function provisionUsuarioInicial(input: {
  nome: string;
  email: string;
  senha?: string;
  provider?: string | null;
  providerId?: string | null;
  emailVerificado: boolean;
}) {
  const usuario = await createUsuario({
    nome: input.nome,
    email: input.email,
    senha: input.senha,
    ativo: true,
    emailVerificado: input.emailVerificado,
    papel: "viewer",
    provider: input.provider,
    providerId: input.providerId,
  });

  if (!usuario) {
    return { ok: false as const, reason: "user_create_failed" };
  }

  const projeto = await createProjetoForUsuario({
    usuarioId: usuario.id,
    nome: `Projeto ${input.nome.trim()}`,
    modoCobranca: "plano",
    status: "ativo",
  });

  if (!projeto) {
    await deleteUsuario(usuario.id);
    return { ok: false as const, reason: "project_create_failed" };
  }

  try {
    await applyDefaultFreePlanToProjeto(projeto.id);
    return { ok: true as const, usuarioId: usuario.id, projetoId: projeto.id };
  } catch (error) {
    await appendSystemLog({
      projetoId: projeto.id,
      tipo: "auth_register_error",
      origem: "auth_service_register",
      descricao: "Falha ao provisionar usuario e projeto inicial.",
      payload: {
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    await deleteProjeto(projeto.id);
    await deleteUsuario(usuario.id);
    return { ok: false as const, reason: "registration_finalize_failed" };
  }
}

export async function registerUsuarioWithProjeto(input: {
  nome: string;
  email: string;
  senha: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await findUsuarioWithPasswordByEmail(normalizedEmail);
  if (existing) {
    return { ok: false as const, reason: "email_already_exists" };
  }

  const provision = await provisionUsuarioInicial({
    nome: input.nome,
    email: normalizedEmail,
    senha: input.senha,
    emailVerificado: false,
    provider: "email",
  });

  if (!provision.ok) {
    return provision;
  }

  try {
    const { token } = await createEmailVerificationToken({
      usuarioId: provision.usuarioId,
      email: normalizedEmail,
    });

    await sendEmailVerification({
      nome: input.nome,
      email: normalizedEmail,
      token,
    });

    return {
      ok: true as const,
      usuarioId: provision.usuarioId,
      projetoId: provision.projetoId,
      email: normalizedEmail,
    };
  } catch (error) {
    await appendSystemLog({
      projetoId: provision.projetoId,
      tipo: "auth_register_error",
      origem: "auth_service_register",
      descricao: "Falha ao concluir o cadastro com verificacao de email.",
      payload: {
        email: normalizedEmail,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    await deleteProjeto(provision.projetoId);
    await deleteUsuario(provision.usuarioId);
    return { ok: false as const, reason: "registration_finalize_failed" };
  }
}

export async function resendUsuarioVerificationEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const usuario = await findUsuarioWithPasswordByEmail(normalizedEmail);

  if (!usuario) {
    return { ok: false as const, reason: "user_not_found" };
  }

  if (usuario.email_verificado === true) {
    return { ok: false as const, reason: "already_verified" };
  }

  try {
    const { token } = await createEmailVerificationToken({
      usuarioId: usuario.id,
      email: normalizedEmail,
    });

    await sendEmailVerification({
      nome: usuario.nome?.trim() || "Usuario",
      email: normalizedEmail,
      token,
    });

    return { ok: true as const };
  } catch (error) {
    await appendSystemLog({
      tipo: "auth_resend_verification_error",
      origem: "auth_service_resend_verification",
      descricao: "Falha ao reenviar verificacao de email.",
      payload: {
        email: normalizedEmail,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return { ok: false as const, reason: "resend_failed" };
  }
}

export async function loginOrCreateSocialUsuario(input: {
  provider: "google" | "github" | "facebook";
  providerUserId: string;
  email: string;
  nome: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingByProvider = await findUsuarioByProvider(input.provider, input.providerUserId);
  if (existingByProvider) {
    await createSession(existingByProvider);
    return { ok: true as const, user: existingByProvider, created: false };
  }

  const existingByEmail = await findUsuarioWithPasswordByEmail(normalizedEmail);
  if (existingByEmail) {
    const providerUpdated = await updateUsuarioProviderAndVerification({
      usuarioId: existingByEmail.id,
      provider: input.provider,
      providerId: input.providerUserId,
      emailVerificado: true,
    });

    if (!providerUpdated) {
      return { ok: false as const, reason: "provider_link_failed" };
    }

    const appUser = await getUsuarioById(existingByEmail.id);
    if (!appUser) {
      return { ok: false as const, reason: "user_reload_failed" };
    }

    await createSession(appUser);
    return { ok: true as const, user: appUser, created: false };
  }

  const provision = await provisionUsuarioInicial({
    nome: input.nome,
    email: normalizedEmail,
    provider: input.provider,
    providerId: input.providerUserId,
    emailVerificado: true,
  });

  if (!provision.ok) {
    return provision;
  }

  const appUser = await getUsuarioById(provision.usuarioId);
  if (!appUser) {
    return { ok: false as const, reason: "user_reload_failed" };
  }

  await createSession(appUser);
  return { ok: true as const, user: appUser, created: true };
}
