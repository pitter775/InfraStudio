"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCheck, Paperclip, Phone, Send, Smile, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type DemoMessage = {
  id: string;
  text: string;
  isAi: boolean;
};

type WhatsAppMessage = {
  id: string;
  text: string;
  own: boolean;
  time: string;
};

const CHAT_SCRIPT: DemoMessage[] = [
  { id: "user-1", text: "Voce troca disco de freio?", isAi: false },
  {
    id: "ai-1",
    text: "Trocamos sim.\n\nQual o seu carro e ano para eu te passar os valores?",
    isAi: true,
  },
  { id: "user-2", text: "Ford Focus 2006", isAi: false },
  {
    id: "ai-2",
    text: "Para o seu Focus 2006, temos:\n\nPar de discos dianteiros: R$ 280\nMao de obra: R$ 120\n\nTotal estimado: R$ 400\n\nPosso agendar isso pra voce agora pelo WhatsApp.",
    isAi: true,
  },
];

const WHATSAPP_MESSAGES: WhatsAppMessage[] = [
  {
    id: "wa-1",
    text: "Ola, tenho um Ford Focus 2006 e quero trocar o par de discos dianteiros.",
    own: true,
    time: "12:36",
  },
  {
    id: "wa-2",
    text: "Perfeito. Ja recebi o contexto do atendimento e o orcamento estimado.",
    own: false,
    time: "12:37",
  },
  {
    id: "wa-3",
    text: "Veiculo: Focus 2006\nServico: Par de discos dianteiros\nValor estimado: R$ 400",
    own: false,
    time: "12:37",
  },
  {
    id: "wa-4",
    text: "Ja deixei tudo pronto para voce.\n\nDeseja que eu continue com o atendimento?",
    own: false,
    time: "12:38",
  },
  {
    id: "wa-5",
    text: "Perfeito. Ja estou chamando um responsavel para te atender agora.",
    own: false,
    time: "12:39",
  },
];

const FLIP_DURATION_MS = 1050;
const FACE_SETTLE_MS = 260;

export function PremiumHomeChatDemo() {
  const [cycle, setCycle] = useState(0);
  const [face, setFace] = useState<"front" | "back">("front");
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showWhatsappButton, setShowWhatsappButton] = useState(false);
  const [chatCtaPressed, setChatCtaPressed] = useState(false);
  const [whatsVisibleCount, setWhatsVisibleCount] = useState(0);
  const [whatsTyping, setWhatsTyping] = useState(false);
  const [showWhatsActions, setShowWhatsActions] = useState(false);
  const [whatsPhase, setWhatsPhase] = useState<"messages" | "handoff">("messages");
  const [pressedAction, setPressedAction] = useState<"continue" | "edit" | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const whatsappScrollRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  const startNextCycle = () => {
    clearTimers();
    setFace("front");
    setMessages([]);
    setIsTyping(false);
    setShowWhatsappButton(false);
    setChatCtaPressed(false);
    setWhatsVisibleCount(0);
    setWhatsTyping(false);
    setShowWhatsActions(false);
    setWhatsPhase("messages");
    setPressedAction(null);
    setCycle((current) => current + 1);
  };

  const clearFrontFace = () => {
    setMessages([]);
    setIsTyping(false);
    setShowWhatsappButton(false);
    setChatCtaPressed(false);
  };

  const startWhatsappSequence = () => {
    clearTimers();
    setShowWhatsappButton(false);
    setIsTyping(false);
    setChatCtaPressed(true);
    setFace("back");
    setWhatsVisibleCount(0);
    setWhatsTyping(false);
    setShowWhatsActions(false);
    setWhatsPhase("messages");
    setPressedAction(null);

    schedule(() => {
      setWhatsVisibleCount(1);
    }, FLIP_DURATION_MS + FACE_SETTLE_MS);

    schedule(() => {
      setWhatsTyping(true);
    }, FLIP_DURATION_MS + 1050);

    schedule(() => {
      setWhatsTyping(false);
      setWhatsVisibleCount(2);
    }, FLIP_DURATION_MS + 2100);

    schedule(() => {
      setWhatsVisibleCount(3);
    }, FLIP_DURATION_MS + 2900);

    schedule(() => {
      setWhatsVisibleCount(4);
    }, FLIP_DURATION_MS + 3800);

    schedule(() => {
      setShowWhatsActions(true);
    }, FLIP_DURATION_MS + 4600);

    schedule(() => {
      confirmWhatsappSequence();
    }, FLIP_DURATION_MS + 6500);
  };

  const confirmWhatsappSequence = () => {
    clearTimers();
    setShowWhatsActions(false);
    setWhatsPhase("handoff");
    setPressedAction("continue");

    schedule(() => {
      setWhatsVisibleCount(5);
    }, 520);

    schedule(() => {
      clearFrontFace();
    }, 3200);

    schedule(() => {
      setFace("front");
    }, 3600);

    schedule(() => {
      startNextCycle();
    }, 3600 + FLIP_DURATION_MS + 280);
  };

  useEffect(() => {
    clearTimers();
    setFace("front");
    setMessages([]);
    setIsTyping(false);
    setShowWhatsappButton(false);
    setChatCtaPressed(false);
    setWhatsVisibleCount(0);
    setWhatsTyping(false);
    setShowWhatsActions(false);
    setWhatsPhase("messages");
    setPressedAction(null);

    let elapsed = 450;

    CHAT_SCRIPT.forEach((message, index) => {
      if (message.isAi) {
        schedule(() => {
          setIsTyping(true);
        }, elapsed);
      }

      elapsed += message.isAi ? 1500 : index === 0 ? 900 : 1050;

      schedule(() => {
        setIsTyping(false);
        setMessages((current) => [...current, message]);
      }, elapsed);
    });

    elapsed += 700;

    schedule(() => {
      setShowWhatsappButton(true);
    }, elapsed);

    elapsed += 2400;

    schedule(() => {
      startWhatsappSequence();
    }, elapsed);

    return () => {
      clearTimers();
    };
  }, [cycle]);

  useEffect(() => {
    if (!chatScrollRef.current || face !== "front") {
      return;
    }

    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [face, messages, isTyping, showWhatsappButton]);

  useEffect(() => {
    if (!whatsappScrollRef.current || face !== "back") {
      return;
    }

    whatsappScrollRef.current.scrollTo({
      top: whatsappScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [face, whatsVisibleCount, whatsTyping, showWhatsActions]);

  return (
    <>
      <div className="relative mx-auto w-full max-w-[420px] [perspective:2400px] lg:mx-0">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.12),transparent_32%)] blur-2xl" />

        <motion.div
          animate={{ rotateY: face === "back" ? 180 : 0 }}
          transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-[590px] w-full"
        >
          <div
            style={{ backfaceVisibility: "hidden", transformStyle: "preserve-3d" }}
            className="absolute inset-0 flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1428]/92 shadow-[0_22px_80px_-34px_rgba(15,23,42,0.9)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.045] px-5 py-4">
              <div>
                <div className="text-[24px] font-bold leading-none text-white">InfraStudio Chat</div>
                <div className="mt-2 inline-flex rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
                  Novo atendimento
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-white/10 bg-white/5 p-3 text-slate-400">
                  <div className="h-3.5 w-3.5 rounded-[4px] border border-current" />
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 p-3 text-slate-400">
                  <div className="relative h-3.5 w-3.5">
                    <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                    <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                  </div>
                </div>
              </div>
            </div>

            <div
              ref={chatScrollRef}
              className="chat-demo-scroll min-h-0 flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(10,18,36,0.96),rgba(8,14,31,0.98))] px-6 py-5"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "max-w-[88%] whitespace-pre-line rounded-[24px] px-4 py-3 text-[15px] leading-relaxed shadow-[0_12px_30px_-20px_rgba(15,23,42,0.9)]",
                      message.isAi
                        ? "mr-auto text-slate-100"
                        : "ml-auto rounded-br-lg border border-blue-400/25 bg-blue-500/18 text-blue-50",
                    )}
                  >
                    {message.text}
                  </motion.div>
                ))}

                {showWhatsappButton ? (
                  <motion.button
                    key="cta"
                    type="button"
                    onClick={startWhatsappSequence}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97, filter: "blur(6px)" }}
                    className={cn(
                      "inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/14 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-[0_14px_28px_-20px_rgba(16,185,129,0.85)] backdrop-blur-md transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]",
                      chatCtaPressed ? "scale-[0.985] shadow-[0_8px_18px_-18px_rgba(16,185,129,0.85)]" : "",
                    )}
                  >
                    Continuar no WhatsApp
                  </motion.button>
                ) : null}

                {isTyping ? (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mr-auto inline-flex rounded-[20px] bg-white/[0.045] px-4 py-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.14s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.28s]" />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="flex items-end gap-3 border-t border-white/8 bg-[#0d1428] px-5 py-4">
              <div className="flex-1 rounded-[20px] border border-white/8 bg-white/[0.045] px-4 py-3 text-base text-slate-500">
                {isTyping ? "Atendente esta digitando..." : "Digite sua mensagem..."}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2f6fff] text-white shadow-[0_18px_40px_-22px_rgba(47,111,255,0.95)]">
                <Send size={18} />
              </div>
            </div>
          </div>

          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", transformStyle: "preserve-3d" }}
            className="absolute inset-0"
          >
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-black/10 bg-[#151515] p-[10px] shadow-[0_24px_90px_-34px_rgba(0,0,0,0.95)]">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-[#ece5dd]">
                <div className="flex items-center justify-between bg-[#0d8b73] px-4 pb-3 pt-4 text-white">
                  <div className="flex items-center gap-3">
                    <ArrowLeft size={18} />
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">IS</div>
                    <div>
                      <div className="text-sm font-semibold">InfraStudio</div>
                      <div className="text-[11px] text-white/80">online agora</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Video size={17} />
                    <Phone size={17} />
                  </div>
                </div>

                <div
                  ref={whatsappScrollRef}
                  className="chat-demo-scroll min-h-0 flex-1 overflow-y-auto bg-[#ece5dd] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),linear-gradient(180deg,rgba(236,229,221,0.98),rgba(232,225,215,0.98))] px-3 py-4"
                >
                  <AnimatePresence initial={false}>
                    {WHATSAPP_MESSAGES.slice(0, whatsVisibleCount).map((line) => (
                      <motion.div
                        key={line.id}
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={cn("mb-3 flex", line.own ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[86%] rounded-[14px] px-3 py-2 text-[12px] leading-relaxed shadow-[0_10px_18px_-16px_rgba(0,0,0,0.55)]",
                            line.own ? "rounded-tr-[4px] bg-[#dcf8c6] text-[#202c33]" : "rounded-tl-[4px] bg-white text-[#202c33]",
                          )}
                        >
                          <div className="whitespace-pre-line">{line.text}</div>
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                            <span>{line.time}</span>
                            {line.own ? <CheckCheck size={12} className="text-[#53bdeb]" /> : null}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {whatsTyping ? (
                    <div className="mb-3 flex justify-start">
                      <div className="inline-flex rounded-[16px] rounded-tl-[4px] bg-white px-3 py-2.5 shadow-[0_10px_18px_-16px_rgba(0,0,0,0.55)]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:0.14s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:0.28s]" />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <AnimatePresence initial={false} mode="wait">
                    {showWhatsActions ? (
                      <motion.div
                        key="whatsapp-actions"
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.96, filter: "blur(6px)" }}
                        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-2"
                      >
                      <button
                        type="button"
                        onClick={confirmWhatsappSequence}
                        className={cn(
                          "w-full rounded-full bg-[#25d366] px-3 py-2.5 text-[12px] font-semibold text-[#123524] shadow-[0_12px_24px_-18px_rgba(37,211,102,0.9)] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]",
                          pressedAction === "continue" ? "scale-[0.985] shadow-[0_8px_18px_-18px_rgba(37,211,102,0.9)]" : "",
                        )}
                      >
                        Pode continuar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPressedAction("edit");
                          window.setTimeout(() => {
                            startNextCycle();
                          }, 140);
                        }}
                        className={cn(
                          "w-full rounded-full border border-black/10 bg-white/85 px-3 py-2.5 text-[12px] font-medium text-[#202c33] transition-all duration-200 hover:bg-white active:scale-[0.985]",
                          pressedAction === "edit" ? "scale-[0.985] bg-white" : "",
                        )}
                      >
                        Editar informacoes
                      </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-2 bg-[#f0efec] px-3 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[#667781]">
                    <Smile size={20} />
                  </div>
                  <div className="flex-1 rounded-full bg-white px-4 py-2.5 text-[12px] text-[#94a3b8] shadow-[0_8px_18px_-16px_rgba(0,0,0,0.3)]">
                    Digite sua mensagem...
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[#667781]">
                    <Paperclip size={18} />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0d8b73] text-white shadow-[0_12px_24px_-16px_rgba(13,139,115,0.85)]">
                    <Send size={16} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        .chat-demo-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .chat-demo-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
    </>
  );
}
