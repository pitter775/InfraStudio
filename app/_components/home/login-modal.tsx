"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Github, Lock, X } from "lucide-react";
import { resendVerificationEmail, signInWithSocialProvider } from "@/lib/auth";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<string | null>;
  onRegister: (input: {
    nome: string;
    email: string;
    senha: string;
    confirmarSenha: string;
  }) => Promise<{ ok: boolean; error: string | null; message: string | null }>;
};

type AuthMode = "login" | "cadastro";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500";

const socialButtonClassName =
  "flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

export function LoginModal({ open, onClose, onLogin, onRegister }: LoginModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [notice, setNotice] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<"google" | "github" | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  const loginEmailRef = useRef<HTMLInputElement | null>(null);
  const registerNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setLoginError("");
      setRegisterError("");
      setNotice("");
      setLoginLoading(false);
      setRegisterLoading(false);
      setSocialLoadingProvider(null);
      setResendingVerification(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (mode === "login") {
        loginEmailRef.current?.focus();
        return;
      }

      registerNameRef.current?.focus();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [mode, open]);

  if (!open) {
    return null;
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLoginError("");
    setRegisterError("");
    setNotice("");
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    setNotice("");

    const loginError = await onLogin(loginEmail, loginPassword);

    if (loginError) {
      setLoginError(loginError);
      setLoginLoading(false);
      return;
    }

    setLoginLoading(false);
    onClose();
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterLoading(true);
    setRegisterError("");
    setNotice("");

    if (!registerName.trim() || !registerEmail.trim() || !registerPassword || !registerPasswordConfirm) {
      setRegisterError("Preencha nome, email, senha e confirmacao.");
      setRegisterLoading(false);
      return;
    }

    if (registerPassword !== registerPasswordConfirm) {
      setRegisterError("A confirmacao de senha nao confere.");
      setRegisterLoading(false);
      return;
    }

    if (registerPassword.trim().length < 6) {
      setRegisterError("A senha precisa ter pelo menos 6 caracteres.");
      setRegisterLoading(false);
      return;
    }

    const result = await onRegister({
      nome: registerName,
      email: registerEmail,
      senha: registerPassword,
      confirmarSenha: registerPasswordConfirm,
    });

    if (!result.ok) {
      setRegisterError(result.error ?? "Nao foi possivel concluir seu cadastro agora.");
      setRegisterLoading(false);
      return;
    }

    setRegisterLoading(false);
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterPasswordConfirm("");
    setNotice(result.message ?? "Enviamos um email para voce confirmar sua conta.");
    setMode("login");
  };

  const handleSocialLogin = async (provider: "google" | "github") => {
    setLoginError("");
    setNotice("");
    setSocialLoadingProvider(provider);
    const result = await signInWithSocialProvider(provider);

    if (!result.ok) {
      setLoginError(result.error ?? "Nao foi possivel iniciar o login social.");
      setSocialLoadingProvider(null);
    }
  };

  const handleResendVerification = async () => {
    if (!loginEmail.trim()) {
      setLoginError("Informe seu email para reenviar a confirmacao.");
      return;
    }

    setResendingVerification(true);
    setLoginError("");
    const result = await resendVerificationEmail(loginEmail);

    if (!result.ok) {
      setLoginError(result.error ?? "Nao foi possivel reenviar o email agora.");
      setResendingVerification(false);
      return;
    }

    setNotice(result.message ?? "Enviamos um novo email de confirmacao.");
    setResendingVerification(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-effect relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/95 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fechar login"
        >
          <X size={16} />
        </button>

        <div className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
            <Lock size={14} />
            {mode === "login" ? "Acesso rapido" : "Criar conta"}
          </div>
          <h2 className="pr-10 text-2xl text-white">{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {mode === "login"
              ? "Entre para gerenciar seus projetos, agentes e operacoes em um so lugar."
              : "Crie seu acesso e confirme o email para iniciar com um projeto pronto para uso."}
          </p>
        </div>

        <div className="overflow-hidden">
          <div
            className="flex w-[200%]"
            style={{
              transform: mode === "login" ? "translateX(0%)" : "translateX(-50%)",
              transition: "transform 0.4s ease",
            }}
          >
            <form onSubmit={handleLoginSubmit} className="w-1/2 space-y-4 px-6 py-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </label>
                  <input
                    ref={loginEmailRef}
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className={inputClassName}
                    placeholder="voce@empresa.com"
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Senha
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className={inputClassName}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {loginError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {loginError}
                </div>
              ) : null}

              {notice ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {notice}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loginLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loginLoading ? "Entrando..." : "Entrar agora"}
                <ArrowRight size={16} />
              </button>

              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => switchMode("cadastro")}
                  className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
                >
                  Criar conta
                </button>

                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={resendingVerification}
                  className="text-left text-sm font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-60"
                >
                  {resendingVerification ? "Reenviando confirmacao..." : "Reenviar email de confirmacao"}
                </button>
              </div>

              <div className="space-y-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => void handleSocialLogin("google")}
                  disabled={socialLoadingProvider !== null}
                  className={socialButtonClassName}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4] via-[#34A853] to-[#FBBC05]"
                  />
                  {socialLoadingProvider === "google" ? "Abrindo Google..." : "Continuar com Google"}
                </button>

                <button
                  type="button"
                  onClick={() => void handleSocialLogin("github")}
                  disabled={socialLoadingProvider !== null}
                  className={socialButtonClassName}
                >
                  <Github size={16} />
                  {socialLoadingProvider === "github" ? "Abrindo GitHub..." : "Continuar com GitHub"}
                </button>
              </div>
            </form>

            <form onSubmit={handleRegisterSubmit} className="w-1/2 space-y-4 px-6 py-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="register-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Nome
                  </label>
                  <input
                    ref={registerNameRef}
                    id="register-name"
                    type="text"
                    value={registerName}
                    onChange={(event) => setRegisterName(event.target.value)}
                    className={inputClassName}
                    placeholder="Seu nome"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    className={inputClassName}
                    placeholder="voce@empresa.com"
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Senha
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    className={inputClassName}
                    placeholder="Minimo 6 caracteres"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="register-password-confirm"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
                  >
                    Confirmar senha
                  </label>
                  <input
                    id="register-password-confirm"
                    type="password"
                    value={registerPasswordConfirm}
                    onChange={(event) => setRegisterPasswordConfirm(event.target.value)}
                    className={inputClassName}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {registerError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {registerError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={registerLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {registerLoading ? "Criando..." : "Criar conta"}
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
              >
                Voltar para login
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
