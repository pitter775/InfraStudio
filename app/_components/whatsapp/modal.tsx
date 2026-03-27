"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

type WhatsappTestModalProps = {
  open: boolean;
  onClose: () => void;
};

export function WhatsappTestModal({ open, onClose }: WhatsappTestModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <motion.button
            type="button"
            aria-label="Fechar modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/78 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_30px_120px_rgba(2,6,23,0.65)]"
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>

            <div className="mb-5 inline-flex items-center rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
              Teste rápido
            </div>

            <h2 className="max-w-sm text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Teste o atendimento agora
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
              Veja seu WhatsApp respondendo automaticamente
            </p>

            <div className="mt-8 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
              <div className="rounded-[20px] border border-dashed border-white/10 bg-slate-950/50 px-4 py-10 text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400/25 to-cyan-400/20" />
                <p className="text-sm font-medium text-white">Espaço reservado para a experiência de teste</p>
                <p className="mt-2 text-sm text-slate-400">Por enquanto, a modal está pronta apenas na camada visual.</p>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
