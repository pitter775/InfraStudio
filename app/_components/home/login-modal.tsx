"use client";

import { type FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Lock, X } from "lucide-react";
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

export function LoginModal({ open, onClose, onLogin, onRegister }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<"google" | "github" | "facebook" | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setError("");
      setSuccess("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setError("Informe email e senha para entrar.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const loginError = await onLogin(loginEmail, loginPassword);

    if (loginError) {
      setError(loginError);
      setLoading(false);
      return;
    }

    setLoading(false);
    onClose();
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword || !registerPasswordConfirm) {
      setError("Preencha nome, email, senha e confirmacao.");
      return;
    }

    if (registerPassword !== registerPasswordConfirm) {
      setError("A confirmacao de senha nao confere.");
      return;
    }

    if (registerPassword.trim().length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const result = await onRegister({
      nome: registerName,
      email: registerEmail,
      senha: registerPassword,
      confirmarSenha: registerPasswordConfirm,
    });

    if (!result.ok) {
      setError(result.error ?? "Nao foi possivel concluir seu cadastro agora.");
      setLoading(false);
      return;
    }

    setSuccess(result.message ?? "Enviamos um email para voce confirmar sua conta.");
    setMode("login");
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterPasswordConfirm("");
    setLoading(false);
  };

  const handleSocialLogin = async (provider: "google" | "github" | "facebook") => {
    setError("");
    setSuccess("");
    setSocialLoadingProvider(provider);
    const result = await signInWithSocialProvider(provider);

    if (!result.ok) {
      setError(result.error ?? "Nao foi possivel iniciar o login social.");
      setSocialLoadingProvider(null);
    }
  };

  const handleResendVerification = async () => {
    if (!loginEmail.trim()) {
      setError("Informe seu email para reenviar a confirmacao.");
      return;
    }

    setResendingVerification(true);
    const result = await resendVerificationEmail(loginEmail);

    if (!result.ok) {
      setError(result.error ?? "Nao foi possivel reenviar o email agora.");
      setResendingVerification(false);
      return;
    }

    setError("");
    setSuccess(result.message ?? "Enviamos um novo email de confirmacao.");
    setResendingVerification(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-effect relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/15 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fechar login"
        >
          <X size={16} />
        </button>

        <div className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
            <Lock size={14} />
            {mode === "login" ? "Acesso rapido" : "Criar conta"}
          </div>
          <h2 className="text-2xl text-white">{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {mode === "login"
              ? "Gerencie seus projetos, agentes e integracoes em um so lugar."
              : "Seu usuario nasce com um projeto inicial e confirmacao por email."}
          </p>
        </div>

        <div className="overflow-hidden">
          <motion.div
            animate={{ x: mode === "login" ? "0%" : "-50%" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-[200%]"
          >
            <form onSubmit={handleLoginSubmit} className="w-1/2 space-y-5 px-6 py-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
                  placeholder="voce@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
                  placeholder="Digite sua senha"
                />
              </div>

              {error && mode === "login" ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-white shadow-md shadow-blue-900/20 transition duration-200 ease-out transform-gpu hover:from-blue-500 hover:to-cyan-400 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition duration-300 hover:opacity-100"></span>
                {loading ? "Entrando..." : "Entrar agora"}
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setMode("register");
                }}
                className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
              >
                Cadastrar
              </button>

              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={resendingVerification}
                className="text-left text-sm font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-60"
              >
                {resendingVerification ? "Reenviando confirmacao..." : "Reenviar email de confirmacao"}
              </button>

              <div className="space-y-2 border-t border-white/8 pt-4">
                <button
                  type="button"
                  onClick={() => void handleSocialLogin("google")}
                  disabled={socialLoadingProvider !== null}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {socialLoadingProvider === "google" ? "Abrindo Google..." : "Continuar com Google"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSocialLogin("github")}
                  disabled={socialLoadingProvider !== null}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {socialLoadingProvider === "github" ? "Abrindo GitHub..." : "Continuar com GitHub"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSocialLogin("facebook")}
                  disabled={socialLoadingProvider !== null}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {socialLoadingProvider === "facebook" ? "Abrindo Facebook..." : "Continuar com Facebook"}
                </button>
              </div>
            </form>

            <form onSubmit={handleRegisterSubmit} className="w-1/2 space-y-5 px-6 py-6">
              <div className="space-y-2">
                <label htmlFor="register-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Nome
                </label>
                <input
                  id="register-name"
                  type="text"
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
                  placeholder="Seu nome"
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
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
                  placeholder="voce@empresa.com"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="register-password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Senha
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
                    placeholder="Minimo 6 caracteres"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-password-confirm" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Confirmar senha
                  </label>
                  <input
                    id="register-password-confirm"
                    type="password"
                    value={registerPasswordConfirm}
                    onChange={(event) => setRegisterPasswordConfirm(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
                    placeholder="Repita a senha"
                  />
                </div>
              </div>

              {error && mode === "register" ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-white shadow-md shadow-blue-900/20 transition duration-200 ease-out transform-gpu hover:from-blue-500 hover:to-cyan-400 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition duration-300 hover:opacity-100"></span>
                {loading ? "Criando..." : "Criar conta"}
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setMode("login");
                }}
                className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
              >
                Voltar para login
              </button>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
