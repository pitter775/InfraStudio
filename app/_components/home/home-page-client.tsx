"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { getCurrentProjectUser, registerWithProjectAuth, signInWithProjectAuth, signOutProjectAuth } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";
import { isAdminUser } from "@/lib/access";
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
  ProcessSection,
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
};

export function HomePageClient({
  projeto,
  agente,
  returnTo,
  handoffError,
  embed,
  authNotice,
}: HomePageClientProps) {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDocked, setChatDocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const embeddedProjeto = projeto?.trim() || DEFAULT_CHAT_PROJECT;
  const embeddedAgente = agente?.trim() || DEFAULT_CHAT_AGENT;
  const resolvedReturnTo = returnTo?.trim() || null;
  const resolvedHandoffError = handoffError?.trim() || null;
  const externalWidgetTestMode = embed === "1" && Boolean(embeddedProjeto && embeddedAgente);
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

  const handleLogin = async (email: string, password: string) => {
    const result = await signInWithProjectAuth(email, password);

    if (result.user) {
      setCurrentUser(result.user);
      window.location.href = resolvedReturnTo || (isAdminUser(result.user) ? "/admin/dashboard" : "/admin/projetos");
    }

    return result.error;
  };

  const handleLogout = async () => {
    await signOutProjectAuth();
    setCurrentUser(null);
  };

  const handleRegister = async (input: {
    nome: string;
    email: string;
    senha: string;
    confirmarSenha: string;
  }) => {
    return await registerWithProjectAuth(input);
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

      <HeroSection onOpenChat={openPreferredChat} />
      <DemoSection />
      <ProcessSection />
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
