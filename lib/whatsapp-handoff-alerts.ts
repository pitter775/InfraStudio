import "server-only";

import { appendSystemLog } from "@/lib/chat-logs";
import { normalizeBrazilWhatsAppPhone } from "@/lib/whatsapp-phone";
import { sendWhatsAppServiceMessage } from "@/lib/whatsapp-service";
import { listWhatsAppHandoffContacts } from "@/lib/whatsapp-handoff-contatos";

function getAppBaseUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://infrastudio.vercel.app"
  ).replace(/\/$/, "");
}

function buildHandoffAlertLink(input: {
  projetoId: string;
  chatId: string;
}) {
  const url = new URL("/admin/atendimento", getAppBaseUrl());
  url.searchParams.set("projeto", input.projetoId);
  url.searchParams.set("chat", input.chatId);
  url.searchParams.set("handoff", "1");
  return url.toString();
}

function buildHandoffAlertMessage(input: {
  projetoNome?: string | null;
  chatTitle?: string | null;
  latestUserMessage?: string | null;
  motivo?: string | null;
  link: string;
}) {
  const lines = [
    "InfraStudio",
    input.projetoNome ? `Projeto: ${input.projetoNome}` : null,
    input.chatTitle ? `Contato: ${input.chatTitle}` : null,
    input.latestUserMessage ? `Mensagem: ${input.latestUserMessage}` : null,
    input.motivo ? `Motivo: ${input.motivo}` : null,
    "Abra a conversa direto no painel:",
    input.link,
  ].filter(Boolean);

  return lines.join("\n\n");
}

function buildHandoffTestAlertMessage(input: {
  projetoNome?: string | null;
  channelNumber?: string | null;
}) {
  const lines = [
    "InfraStudio",
    "Teste de alerta do atendimento humano.",
    input.projetoNome ? `Projeto: ${input.projetoNome}` : null,
    input.channelNumber ? `Canal monitorado: ${input.channelNumber}` : null,
    "Se esta mensagem chegou, o aviso por WhatsApp para handoff humano esta funcionando.",
  ].filter(Boolean);

  return lines.join("\n\n");
}

export async function notifyWhatsAppHandoffContacts(input: {
  projetoId: string;
  projetoNome?: string | null;
  canalWhatsappId: string;
  chatId: string;
  chatTitle?: string | null;
  latestUserMessage?: string | null;
  motivo?: string | null;
}) {
  const contacts = await listWhatsAppHandoffContacts({
    projetoId: input.projetoId,
    canalWhatsappId: input.canalWhatsappId,
    onlyActive: true,
  });

  if (!contacts.length) {
    return {
      ok: false,
      sent: 0,
      link: buildHandoffAlertLink({
        projetoId: input.projetoId,
        chatId: input.chatId,
      }),
      error: "Nenhum contato ativo cadastrado para handoff neste canal.",
    };
  }

  const link = buildHandoffAlertLink({
    projetoId: input.projetoId,
    chatId: input.chatId,
  });

  const message = buildHandoffAlertMessage({
    projetoNome: input.projetoNome,
    chatTitle: input.chatTitle,
    latestUserMessage: input.latestUserMessage,
    motivo: input.motivo,
    link,
  });

  let sent = 0;
  const failures: Array<{ numero: string; error: string }> = [];

  for (const contact of contacts) {
    const phone = normalizeBrazilWhatsAppPhone(contact.numero);
    if (!phone) {
      continue;
    }

    const result = await sendWhatsAppServiceMessage({
      channelId: input.canalWhatsappId,
      to: phone,
      message,
    });

    if (result.ok) {
      sent += 1;
      continue;
    }

    failures.push({
      numero: phone,
      error: result.error ?? "Falha ao enviar alerta.",
    });
  }

  await appendSystemLog({
    projetoId: input.projetoId,
    tipo: failures.length ? "handoff_alert_partial" : "handoff_alert_sent",
    origem: "whatsapp_handoff_alerts",
    descricao: failures.length
      ? "Alerta de handoff enviado com falhas parciais."
      : "Alerta de handoff enviado para os contatos cadastrados.",
    payload: {
      chatId: input.chatId,
      canalWhatsappId: input.canalWhatsappId,
      sent,
      totalContacts: contacts.length,
      failures,
      link,
    },
  });

  return {
    ok: sent > 0,
    sent,
    link,
    message,
    failures,
  };
}

export async function sendWhatsAppHandoffTestAlert(input: {
  projetoId: string;
  projetoNome?: string | null;
  canalWhatsappId: string;
  channelNumber?: string | null;
}) {
  const contacts = await listWhatsAppHandoffContacts({
    projetoId: input.projetoId,
    canalWhatsappId: input.canalWhatsappId,
    onlyActive: true,
  });

  if (!contacts.length) {
    return {
      ok: false,
      sent: 0,
      failures: [] as Array<{ numero: string; error: string }>,
      error: "Nenhum contato ativo cadastrado para testar o alerta deste canal.",
    };
  }

  const message = buildHandoffTestAlertMessage({
    projetoNome: input.projetoNome,
    channelNumber: input.channelNumber,
  });

  let sent = 0;
  const failures: Array<{ numero: string; error: string }> = [];

  for (const contact of contacts) {
    const phone = normalizeBrazilWhatsAppPhone(contact.numero);
    if (!phone) {
      continue;
    }

    const result = await sendWhatsAppServiceMessage({
      channelId: input.canalWhatsappId,
      to: phone,
      message,
    });

    if (result.ok) {
      sent += 1;
      continue;
    }

    failures.push({
      numero: phone,
      error: result.error ?? "Falha ao enviar teste de alerta.",
    });
  }

  await appendSystemLog({
    projetoId: input.projetoId,
    tipo: failures.length ? "handoff_alert_test_partial" : "handoff_alert_test_sent",
    origem: "whatsapp_handoff_alerts",
    descricao: failures.length
      ? "Teste de alerta do handoff enviado com falhas parciais."
      : "Teste de alerta do handoff enviado para os contatos cadastrados.",
    payload: {
      canalWhatsappId: input.canalWhatsappId,
      sent,
      totalContacts: contacts.length,
      failures,
    },
  });

  return {
    ok: sent > 0,
    sent,
    message,
    failures,
  };
}
