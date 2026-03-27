"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { FooterSection } from "@/app/_components/home/sections";
import {
  BeyondWhatsappSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  ValueSection,
  VisualProofSection,
} from "@/app/_components/whatsapp/sections-clean";
import { WhatsappTestModal } from "@/app/_components/whatsapp/modal";

const navItems = [
  { href: "#valor", label: "Valor" },
  { href: "#prova", label: "Prova" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#alem-do-whatsapp", label: "Site + WhatsApp" },
] as const;

type NavHref = (typeof navItems)[number]["href"];

export function WhatsappLandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<NavHref>("#valor");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);

      const offsets = navItems
        .map((item) => {
          const element = document.querySelector(item.href);
          if (!(element instanceof HTMLElement)) {
            return null;
          }

          return {
            href: item.href,
            top: element.offsetTop,
          };
        })
        .filter((entry): entry is { href: NavHref; top: number } => entry !== null);

      const current = [...offsets]
        .reverse()
        .find((entry) => window.scrollY + 160 >= entry.top);

      setActiveSection(current?.href ?? "#valor");
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_22%),radial-gradient(circle_at_85%_18%,rgba(34,211,238,0.12),transparent_18%),linear-gradient(180deg,#020617_0%,#050b14_48%,#030712_100%)] text-slate-200">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.14)_1px,transparent_0)] bg-[size:26px_26px] opacity-[0.18]" />

      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <div
          className={`absolute inset-x-0 top-0 -z-10 h-full transition-all duration-300 ease-in-out ${
            scrolled
              ? "border-b border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.94),rgba(3,7,18,0.92))] shadow-[0_14px_36px_rgba(2,6,23,0.24)] backdrop-blur-md"
              : "border-b border-transparent bg-transparent shadow-none"
          }`}
        />

        <div className="mx-auto max-w-6xl rounded-xl px-1 py-1 sm:px-3 sm:py-2">
          <div className="flex items-center justify-between gap-3">
            <a href="#hero" className="min-w-0 flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(6,182,212,0.18))] text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                IA
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[-0.02em] text-white">WhatsApp IA</p>
                <p className="truncate text-[10px] font-medium text-slate-400">Infrastudio automação</p>
              </div>
            </a>

            <nav className="hidden items-center gap-1.5 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-in-out hover:scale-[1.02] hover:bg-white/5 hover:text-white ${
                    activeSection === item.href
                      ? "bg-white/8 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "text-slate-300"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-950/20 transition-all duration-200 ease-in-out hover:scale-[1.03] hover:shadow-emerald-500/20 sm:px-4"
            >
              <span className="sm:hidden">Testar</span>
              <span className="hidden sm:inline">Testar grátis</span>
              <ChevronRight size={16} />
            </button>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 ease-in-out ${
                  activeSection === item.href
                    ? "bg-white/8 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    : "bg-white/[0.03] text-slate-300"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <HeroSection onPrimaryClick={() => setModalOpen(true)} />
      <ValueSection />
      <VisualProofSection />
      <HowItWorksSection />
      <BeyondWhatsappSection />
      <FinalCtaSection onPrimaryClick={() => setModalOpen(true)} />
      <FooterSection />

      <WhatsappTestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  );
}
