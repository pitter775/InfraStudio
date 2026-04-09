"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { getCurrentProjectUser, registerWithProjectAuth, signInWithProjectAuth, signOutProjectAuth } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";
import { isAdminUser } from "@/lib/access";
import {
  clearDemoProjectSnapshot,
  clearPendingDemoConversion,
  readDemoProjectSnapshot,
  readPendingDemoConversion,
  writePendingDemoConversion,
} from "@/lib/demo-conversion";
import { isDemoUser } from "@/lib/demo-user";
import { DEFAULT_CHAT_AGENT, DEFAULT_CHAT_PROJECT } from "@/app/_components/home/data";
import {
  ChatWidget,
  ExternalChatEmbed,
  FloatingChatButton,
  Navbar,
} from "@/app/_components/home/interactive";
import { LoginModal } from "@/app/_components/home/login-modal";
import {
  BenefitsSection,
  ContactSection,
  DemoSection,
  FooterSection,
  HeroSection,
  ServicesSection,
  UseCasesSection,
} from "@/app/_components/home/sections";
import { NichesSection } from "@/app/_components/home/plans-section";

type HomePageClientProps = {
  projeto?: string;
  agente?: string;
  returnTo?: string;
  handoffError?: string;
  embed?: string;
  authNotice?: string;
  authMode?: string;
};

export function HomePageClient({
  projeto,
  agente,
  returnTo,
  handoffError,
  embed,
  authNotice,
  authMode,
}: HomePageClientProps) {
  const DEMO_USER_STORAGE_KEY = "demoUser";
  const DEMO_PROJECT_STORAGE_KEY = "demoProjectId";
  const DEMO_SESSION_SYNC_KEY = "demoSessionSyncedAt";
  const DEMO_CONVERSION_LOCK_KEY = "demoConversionInProgress";
  const DEMO_CONVERSION_RESULT_KEY = "demoConversionProjectId";
  const router = useRouter();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDocked, setChatDocked] = useState(false);
  const [demoLoginLoading, setDemoLoginLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const embeddedProjeto = projeto?.trim() || DEFAULT_CHAT_PROJECT;
  const embeddedAgente = agente?.trim() || DEFAULT_CHAT_AGENT;
  const resolvedReturnTo = returnTo?.trim() || null;
  const resolvedHandoffError = handoffError?.trim() || null;
  const externalWidgetTestMode = embed === "1" && Boolean(embeddedProjeto && embeddedAgente);
  const resolvedAuthMode = authMode === "cadastro" ? "cadastro" : "login";
  const handoffErrorMessage =
    resolvedHandoffError === "invalid_link"
      ? "Este link de atendimento expirou ou nao e mais valido. Peca um novo aviso no WhatsApp."
      : null;
  const authNoticeMessage =
    authNotice === "email_verified"
      ? "Email confirmado com sucesso. Agora voce ja pode entrar."
      : authNotice === "email_expired"
        ? "Seu link de confirmacao expirou."
        : authNotice === "email_already_verified"
          ? "Este email ja foi confirmado."
          : authNotice === "email_invalid"
            ? "Link de confirmacao invalido."
            : authNotice === "social_oauth_error"
              ? "Nao foi possivel concluir o login social."
            : null;

  const isConversionLocked = () => {
    if (typeof window === "undefined") {
      return false;
    }

    const raw = window.sessionStorage.getItem(DEMO_CONVERSION_LOCK_KEY);
    if (!raw) {
      return false;
    }

    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt)) {
      window.sessionStorage.removeItem(DEMO_CONVERSION_LOCK_KEY);
      return false;
    }

    if (Date.now() - startedAt > 60_000) {
      window.sessionStorage.removeItem(DEMO_CONVERSION_LOCK_KEY);
      return false;
    }

    return true;
  };

  const setConversionLock = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(DEMO_CONVERSION_LOCK_KEY, String(Date.now()));
  };

  const clearConversionLock = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(DEMO_CONVERSION_LOCK_KEY);
  };

  const convertDemoIfNeeded = async (user: AppUser) => {
    if (isDemoUser(user.email)) {
      return false;
    }

    const snapshot = readDemoProjectSnapshot();
    const pendingDemoConversion = readPendingDemoConversion();
    const demoEmail = typeof window !== "undefined" ? window.localStorage.getItem(DEMO_USER_STORAGE_KEY)?.trim() || "" : "";

    if (typeof window !== "undefined") {
      const convertedProjectId = window.sessionStorage.getItem(DEMO_CONVERSION_RESULT_KEY)?.trim() || "";
      if (convertedProjectId) {
        clearDemoProjectSnapshot();
        clearPendingDemoConversion();
        window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        window.localStorage.removeItem(DEMO_PROJECT_STORAGE_KEY);
        window.location.href = `/admin/projetos/${convertedProjectId}?demo_converted=1`;
        return true;
      }
    }

    if (!snapshot || !snapshot.projeto || !pendingDemoConversion?.demoUserId || !demoEmail) {
      return false;
    }

    if (isConversionLocked()) {
      return false;
    }

    setConversionLock();

    const conversionResponse = await fetch("/api/auth/demo-convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        demoUserId: pendingDemoConversion.demoUserId,
        demoEmail,
        snapshot,
      }),
    });

    if (!conversionResponse.ok) {
      clearConversionLock();
      return false;
    }

    const conversionPayload = (await conversionResponse.json()) as { projetoId?: string };
    if (typeof window !== "undefined" && conversionPayload.projetoId) {
      window.sessionStorage.setItem(DEMO_CONVERSION_RESULT_KEY, conversionPayload.projetoId);
    }
    clearDemoProjectSnapshot();
    clearPendingDemoConversion();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      window.localStorage.removeItem(DEMO_PROJECT_STORAGE_KEY);
    }
    clearConversionLock();
    window.location.href = conversionPayload.projetoId
      ? `/admin/projetos/${conversionPayload.projetoId}?demo_converted=1`
      : "/admin/projetos";
    return true;
  };

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);
      setAuthResolved(true);
    };

    void loadUser();
  }, []);

  useEffect(() => {
    if (!resolvedReturnTo || !authResolved) {
      return;
    }

    if (currentUser) {
      window.location.href = resolvedReturnTo;
      return;
    }

    setLoginModalOpen(true);
  }, [authResolved, currentUser, resolvedReturnTo]);

  useEffect(() => {
    if (!authMode || currentUser) {
      return;
    }

    setLoginModalOpen(true);
  }, [authMode, currentUser]);

  useEffect(() => {
    if (!authResolved || !currentUser || isDemoUser(currentUser.email)) {
      return;
    }

    void convertDemoIfNeeded(currentUser);
  }, [authResolved, currentUser]);

  useEffect(() => {
    if (!authResolved || !currentUser || !isDemoUser(currentUser.email) || typeof window === "undefined") {
      return;
    }

    const lastSyncedAt = Number(window.sessionStorage.getItem(DEMO_SESSION_SYNC_KEY) || "0");
    if (Number.isFinite(lastSyncedAt) && Date.now() - lastSyncedAt < 30_000) {
      return;
    }

    let cancelled = false;

    const syncDemoSession = async () => {
      const response = await fetch("/api/auth/demo-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentUser.email,
          senha: "123",
        }),
      }).catch(() => null);

      if (!response?.ok || cancelled) {
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as { projectId?: string };
      window.sessionStorage.setItem(DEMO_SESSION_SYNC_KEY, String(Date.now()));
      window.localStorage.setItem(DEMO_USER_STORAGE_KEY, currentUser.email);

      if (payload.projectId) {
        window.localStorage.setItem(DEMO_PROJECT_STORAGE_KEY, payload.projectId);
      }
    };

    void syncDemoSession();

    return () => {
      cancelled = true;
    };
  }, [authResolved, currentUser]);

  const handleLogin = async (email: string, password: string) => {
    if (currentUser && isDemoUser(currentUser.email)) {
      const snapshot = readDemoProjectSnapshot();
      if (snapshot) {
        writePendingDemoConversion({
          demoUserId: currentUser.id,
          demoEmail: currentUser.email,
          snapshot,
        });
      }
    }

    const result = await signInWithProjectAuth(email, password);

    if (result.user) {
      setCurrentUser(result.user);

      if (await convertDemoIfNeeded(result.user)) {
        return result.error;
      }

      window.location.href = resolvedReturnTo || (isAdminUser(result.user) ? "/admin/dashboard" : "/admin/projetos");
    }

    return result.error;
  };

  const handleLogout = async () => {
    await signOutProjectAuth();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_PROJECT_STORAGE_KEY);
      window.sessionStorage.removeItem(DEMO_SESSION_SYNC_KEY);
    }
    setCurrentUser(null);
  };

  const handleRegister = async (input: {
    nome: string;
    email: string;
    senha: string;
    confirmarSenha: string;
  }) => {
    if (currentUser && isDemoUser(currentUser.email)) {
      const snapshot = readDemoProjectSnapshot();
      if (snapshot) {
        writePendingDemoConversion({
          demoUserId: currentUser.id,
          demoEmail: currentUser.email,
          snapshot,
        });
      }
    }

    return await registerWithProjectAuth(input);
  };

  const handleDemoLogin = async () => {
    if (demoLoginLoading) {
      return;
    }

    setDemoLoginLoading(true);

    if (currentUser && isDemoUser(currentUser.email)) {
      const response = await fetch("/api/auth/demo-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentUser.email,
          senha: "123",
        }),
      }).catch(() => null);
      const payload = response?.ok ? (((await response.json().catch(() => ({}))) as { projectId?: string })) : {};
      if (typeof window !== "undefined" && payload.projectId) {
        window.localStorage.setItem(DEMO_PROJECT_STORAGE_KEY, payload.projectId);
      }
      setDemoLoginLoading(false);
      router.push(payload.projectId ? `/admin/projetos/${payload.projectId}` : "/admin/projetos");
      return;
    }

    let email = "";
    const senha = "123";

    if (typeof window !== "undefined") {
      const existingDemoUser = window.localStorage.getItem(DEMO_USER_STORAGE_KEY)?.trim() || "";
      if (existingDemoUser) {
        email = existingDemoUser;
      } else {
        email = `demonstracao_${Date.now()}@demo.com`;
        window.localStorage.setItem(DEMO_USER_STORAGE_KEY, email);
      }
    }

    if (!email) {
      email = `demonstracao_${Date.now()}@demo.com`;
    }

    let result = await signInWithProjectAuth(email, senha);

    if (!result.user) {
      const response = await fetch("/api/auth/demo-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          senha,
        }),
      });

      if (!response.ok) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        }
        setDemoLoginLoading(false);
        return;
      }

      result = await signInWithProjectAuth(email, senha);
    }

    if (!result.user) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      }
      setDemoLoginLoading(false);
      return;
    }

    const demoCreateResponse = await fetch("/api/auth/demo-create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        senha,
      }),
    }).catch(() => null);

    const createdProjectId = demoCreateResponse?.ok
      ? (((await demoCreateResponse.json().catch(() => ({}))) as { projectId?: string }).projectId ?? null)
      : null;

    if (typeof window !== "undefined" && createdProjectId) {
      window.localStorage.setItem(DEMO_PROJECT_STORAGE_KEY, createdProjectId);
    }

    setCurrentUser(result.user);
    setDemoLoginLoading(false);
    router.push(createdProjectId ? `/admin/projetos/${createdProjectId}` : "/admin/projetos");
  };

  const openPreferredChat = () => {
    if (externalWidgetTestMode) {
      window.dispatchEvent(
        new CustomEvent("infrastudio-chat:open", {
          detail: { projeto: embeddedProjeto, agente: embeddedAgente },
        }),
      );
      return;
    }

    setChatOpen(true);
  };

  return (
    <div className="home-shell min-h-screen bg-grid">
      <Navbar
        currentUser={currentUser}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenChat={openPreferredChat}
      />

      {externalWidgetTestMode ? (
        <ExternalChatEmbed projeto={embeddedProjeto} agente={embeddedAgente} open={chatOpen} />
      ) : null}

      {handoffErrorMessage ? (
        <div className="mx-auto mt-6 w-full max-w-5xl px-6">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {handoffErrorMessage}
          </div>
        </div>
      ) : null}

      {authNoticeMessage ? (
        <div className="mx-auto mt-6 w-full max-w-5xl px-6">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {authNoticeMessage}
          </div>
        </div>
      ) : null}

      <HeroSection
        onOpenChat={openPreferredChat}
        onDemoLogin={() => void handleDemoLogin()}
        demoLoginLoading={demoLoginLoading}
      />
      <DemoSection />
      <UseCasesSection />
      <BenefitsSection />
      <ServicesSection />
      <NichesSection />
      <ContactSection />
      <FooterSection />

      <AnimatePresence>
        <LoginModal
          open={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          onLogin={handleLogin}
          onRegister={handleRegister}
          initialMode={resolvedAuthMode}
        />
      </AnimatePresence>

      {!externalWidgetTestMode ? (
        <>
          <AnimatePresence>
            <ChatWidget
              open={chatOpen}
              docked={chatDocked}
              onDockedChange={setChatDocked}
              onClose={() => {
                setChatDocked(false);
                setChatOpen(false);
              }}
            />
          </AnimatePresence>
          <FloatingChatButton
            open={chatOpen}
            hidden={chatOpen && chatDocked}
            onToggle={() => {
              if (chatOpen) {
                setChatDocked(false);
              }
              setChatOpen((value) => !value);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
