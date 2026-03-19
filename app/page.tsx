"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { getAuthProviderLabel, getCurrentProjectUser, signInWithProjectAuth, signOutProjectAuth } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";
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

export default function HomePage() {
  const searchParams = useSearchParams();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const authProvider = getAuthProviderLabel();
  const embeddedWidgetSlug = searchParams.get("widget")?.trim() ?? "";
  const embeddedWidgetTheme = searchParams.get("theme") === "light" ? "light" : "dark";
  const embeddedWidgetAccent = searchParams.get("accent")?.trim() || "#2563eb";
  const embeddedWidgetTransparent = searchParams.get("transparent") !== "false";
  const embeddedWidgetTitle = searchParams.get("title")?.trim() || "Chat";
  const externalWidgetTestMode = searchParams.get("embed") === "1" && Boolean(embeddedWidgetSlug);

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
          detail: { widgetSlug: embeddedWidgetSlug },
        }),
      );
      return;
    }

    setChatOpen(true);
  };

  return (
    <div className="min-h-screen bg-grid">
      <Navbar
        currentUser={currentUser}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenChat={openPreferredChat}
      />

      {externalWidgetTestMode ? (
        <ExternalChatEmbed
          widgetSlug={embeddedWidgetSlug}
          title={embeddedWidgetTitle}
          theme={embeddedWidgetTheme}
          accent={embeddedWidgetAccent}
          transparent={embeddedWidgetTransparent}
        />
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
