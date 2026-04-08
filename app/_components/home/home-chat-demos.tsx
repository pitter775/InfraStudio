"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatDemo() {
  const [messages, setMessages] = useState<{ text: string; isAi: boolean }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const script = useMemo(
    () => [
      { text: "Olá! Como posso ajudar sua empresa hoje?", isAi: true },
      { text: "Quero automatizar meu atendimento no WhatsApp.", isAi: false },
      { text: "Excelente escolha! Posso agendar uma demo para você agora mesmo?", isAi: true },
    ],
    [],
  );

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const runScript = (index: number) => {
      if (!isMounted) {
        return;
      }

      if (index >= script.length) {
        timeoutId = setTimeout(() => {
          if (!isMounted) {
            return;
          }

          setMessages([]);
          runScript(0);
        }, 5000);
        return;
      }

      const message = script[index];
      if (message.isAi) {
        setIsTyping(true);
      }

      timeoutId = setTimeout(() => {
        if (!isMounted) {
          return;
        }

        setIsTyping(false);
        setMessages((prev) => [...prev, message]);
        runScript(index + 1);
      }, message.isAi ? 1500 : 1000);
    };

    runScript(0);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [script]);

  return (
    <div className="glass-effect mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/20 shadow-2xl lg:mx-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/30" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/30" />
          <div className="h-3 w-3 rounded-full bg-green-500/30" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Smart AI Interface</div>
      </div>
      <div className="flex h-[380px] flex-col gap-4 overflow-y-auto bg-slate-900/40 p-6">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={`${index}-${message.text}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "max-w-[85%] rounded-2xl border p-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                message.isAi
                  ? "self-start rounded-bl-none border-white/5 bg-slate-800/90 text-slate-200"
                  : "self-end rounded-br-none border-blue-400/20 bg-blue-500/18 text-blue-50",
              )}
            >
              {message.text}
            </motion.div>
          ))}
          {isTyping ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="self-start rounded-2xl rounded-bl-none bg-slate-800 p-3"
            >
              <div className="flex gap-1">
                <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400" />
                <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex gap-2 border-t border-white/5 p-4">
        <div className="flex-grow rounded-full bg-white/5 px-4 py-2 text-xs italic text-slate-500">
          {isTyping ? "IA está digitando..." : "Online"}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/20 text-blue-50">
          <Send size={14} />
        </div>
      </div>
    </div>
  );
}

export function HomeChatDemo() {
  const [messages, setMessages] = useState<{ text: string; isAi: boolean }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [view, setView] = useState<"chat" | "whatsapp">("chat");
  const [whatsStep, setWhatsStep] = useState<"ready" | "handoff">("ready");
  const [showWhatsappButton, setShowWhatsappButton] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [demoCycle, setDemoCycle] = useState(0);

  const script = useMemo(
    () => [
      { text: "Vocês trocam disco de freio?", isAi: false },
      { text: "Trocamos sim 👍\n\nQual o seu carro e ano para eu te passar os valores?", isAi: true },
      { text: "Ford Focus 2006", isAi: false },
      {
        text: "Para o seu Focus 2006, temos:\n\n🔧 Disco de freio: R$ 280\n🛠 Mão de obra: R$ 120\n\nTotal estimado: R$ 400\n\nPosso agendar isso pra você agora pelo WhatsApp 👍",
        isAi: true,
      },
    ],
    [],
  );

  const handleWhatsappButtonClick = () => {
    setShowWhatsappButton(false);
    setIsFlipping(true);

    window.setTimeout(() => {
      setView("whatsapp");
      setWhatsStep("ready");
      setIsFlipping(false);
    }, 500);

    window.setTimeout(() => {
      setWhatsStep("handoff");
    }, 2600);

    window.setTimeout(() => {
      setIsFlipping(true);
    }, 4800);

    window.setTimeout(() => {
      setMessages([]);
      setIsTyping(false);
      setView("chat");
      setWhatsStep("ready");
      setShowWhatsappButton(false);
      setIsFlipping(false);
      setDemoCycle((current) => current + 1);
    }, 5600);
  };

  const handleContinueWhatsapp = () => {
    if (whatsStep === "handoff") {
      return;
    }

    setWhatsStep("handoff");

    window.setTimeout(() => {
      setIsFlipping(true);
    }, 2200);

    window.setTimeout(() => {
      setMessages([]);
      setIsTyping(false);
      setView("chat");
      setWhatsStep("ready");
      setShowWhatsappButton(false);
      setIsFlipping(false);
      setDemoCycle((current) => current + 1);
    }, 3000);
  };

  const handleEditWhatsapp = () => {
    setMessages([]);
    setIsTyping(false);
    setView("chat");
    setWhatsStep("ready");
    setShowWhatsappButton(false);
    setIsFlipping(false);
    setDemoCycle((current) => current + 1);
  };

  useEffect(() => {
    let isMounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const schedule = (callback: () => void, delay: number) => {
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          callback();
        }
      }, delay);

      timeouts.push(timeoutId);
    };

    const resetDemo = () => {
      if (!isMounted) {
        return;
      }

      setMessages([]);
      setIsTyping(false);
      setView("chat");
      setWhatsStep("ready");
      setShowWhatsappButton(false);
      setIsFlipping(false);
      runScript(0);
    };

    const finishDemo = () => {
      schedule(() => {
        setIsFlipping(true);
      }, 2200);

      schedule(() => {
        setView("chat");
        setIsFlipping(false);
        resetDemo();
      }, 3000);
    };

    const continueWhatsappFlow = () => {
      if (!isMounted) {
        return;
      }

      setWhatsStep((current) => {
        if (current === "handoff") {
          return current;
        }

        schedule(() => {
          finishDemo();
        }, 2200);

        return "handoff";
      });
    };

    const openWhatsappStep = () => {
      if (!isMounted) {
        return;
      }

      setShowWhatsappButton(false);
      setIsFlipping(true);

      schedule(() => {
        setView("whatsapp");
        setWhatsStep("ready");
        setIsFlipping(false);
      }, 500);

      schedule(() => {
        continueWhatsappFlow();
      }, 2600);
    };

    const runScript = (index: number) => {
      if (!isMounted) {
        return;
      }

      if (index >= script.length) {
        setShowWhatsappButton(true);
        schedule(() => {
          openWhatsappStep();
        }, 1800);
        return;
      }

      const message = script[index];
      if (message.isAi) {
        setIsTyping(true);
      }

      schedule(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, message]);
        runScript(index + 1);
      }, message.isAi ? 1500 : 1000);
    };

    runScript(0);

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, [script, demoCycle]);

  return (
    <div className="glass-effect mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/20 shadow-2xl lg:mx-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/30" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/30" />
          <div className="h-3 w-3 rounded-full bg-green-500/30" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Smart AI Interface</div>
      </div>
      <div className="h-[380px] overflow-hidden bg-slate-900/40">
        <motion.div
          animate={{
            opacity: isFlipping ? 0.72 : 1,
            rotateY: isFlipping ? 90 : 0,
            scale: isFlipping ? 0.985 : 1,
          }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="flex h-full flex-col"
        >
          {view === "chat" ? (
            <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <motion.div
                    key={`${index}-${message.text}`}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "max-w-[85%] whitespace-pre-line rounded-2xl border p-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                      message.isAi
                        ? "self-start rounded-bl-none border-white/5 bg-slate-800/90 text-slate-200"
                        : "self-end rounded-br-none border-blue-400/20 bg-blue-500/18 text-blue-50",
                    )}
                  >
                    {message.text}
                  </motion.div>
                ))}
                {showWhatsappButton ? (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleWhatsappButtonClick}
                    className="self-start rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100"
                  >
                    👉 Continuar no WhatsApp
                  </motion.button>
                ) : null}
                {isTyping ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="self-start rounded-2xl rounded-bl-none bg-slate-800 p-3"
                  >
                    <div className="flex gap-1">
                      <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400" />
                      <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                      <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between bg-[#0f1f16] p-4 text-white">
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#182b20] px-4 py-3 text-sm text-emerald-50 shadow-sm">
                  Olá, tenho um Ford Focus 2006 e quero trocar o disco de freio.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-50/90">
                  <div className="font-medium text-white">✔ Veículo: Focus 2006</div>
                  <div className="mt-1 font-medium text-white">✔ Serviço: Disco de freio</div>
                  <div className="mt-1 font-medium text-white">✔ Valor estimado: R$ 400</div>
                </div>
                <div className="whitespace-pre-line rounded-2xl rounded-tl-none bg-[#1f6f4a] px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  {whatsStep === "handoff"
                    ? "Perfeito! Já estou chamando um responsável para te atender agora 👨‍🔧"
                    : "Já deixei tudo pronto para você 👍\n\nDeseja que eu continue com o atendimento?"}
                </div>
              </div>
              <div className="space-y-3">
                {whatsStep === "ready" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleContinueWhatsapp}
                      className="rounded-full bg-[#25d366] px-3 py-2 text-sm font-semibold text-[#062714]"
                    >
                      Pode continuar
                    </button>
                    <button
                      type="button"
                      onClick={handleEditWhatsapp}
                      className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/20 hover:text-white"
                    >
                      Editar informações
                    </button>
                  </div>
                ) : (
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-xs italic text-emerald-50/70">
                    Encaminhando atendimento...
                  </div>
                )}
                <div className="rounded-2xl border border-white/10 bg-[#13241a] px-4 py-3 text-sm text-white/65">
                  Mensagem pronta para envio no WhatsApp
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      <div className="flex gap-2 border-t border-white/5 p-4">
        <div className="flex-grow rounded-full bg-white/5 px-4 py-2 text-xs italic text-slate-500">
          {view === "whatsapp"
            ? "WhatsApp conectado"
            : isTyping
              ? "IA esta digitando..."
              : showWhatsappButton
                ? "Pronto para continuar"
                : "Online"}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/20 text-blue-50">
          <Send size={14} />
        </div>
      </div>
    </div>
  );
}
