"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { getAuthProviderLabel, getCurrentProjectUser, signInWithProjectAuth, signOutProjectAuth } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";
import { DEFAULT_CHAT_AGENT, DEFAULT_CHAT_PROJECT } from "@/app/_components/home/data";
import {
  ChatWidget,
  ExternalChatEmbed,
  FloatingChatButton,
  LoginModal,
  Navbar,
} from "@/app/_components/home/interactive";
import {
  BenefitsSection,
  ContactSection,
  DemoSection,
  FooterSection,
  HeroSection,
  NichesSection,
  ProcessSection,
  ServicesSection,
} from "@/app/_components/home/sections";

function HomePageContent() {
  const searchParams = useSearchParams();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const authProvider = getAuthProviderLabel();
  const embeddedProjeto = searchParams.get("projeto")?.trim() || DEFAULT_CHAT_PROJECT;
  const embeddedAgente = searchParams.get("agente")?.trim() || DEFAULT_CHAT_AGENT;
  const externalWidgetTestMode = searchParams.get("embed") === "1" && Boolean(embeddedProjeto && embeddedAgente);

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);
    };

    void loadUser();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const result = await signInWithProjectAuth(email, password);

    if (result.user) {
      setCurrentUser(result.user);
      window.location.href = "/admin/dashboard";
    }

    return result.error;
  };

  const handleLogout = async () => {
    await signOutProjectAuth();
    setCurrentUser(null);
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
        <ExternalChatEmbed projeto={embeddedProjeto} agente={embeddedAgente} />
      ) : null}

      <HeroSection onOpenChat={openPreferredChat} />
      <ServicesSection />
      <DemoSection />
      <BenefitsSection />
      <ProcessSection />
      <NichesSection />
      <ContactSection />
      <FooterSection />

      <AnimatePresence>
        <LoginModal
          open={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          onLogin={handleLogin}
          authProvider={authProvider}
        />
      </AnimatePresence>

      {!externalWidgetTestMode ? (
        <>
          <AnimatePresence>
            <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
          </AnimatePresence>
          <FloatingChatButton onOpen={() => setChatOpen(true)} />
        </>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="home-shell min-h-screen bg-grid" />}>
      <HomePageContent />
    </Suspense>
  );
}
