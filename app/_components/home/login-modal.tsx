"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Facebook, Github, Instagram, Lock, X } from "lucide-react";
import { resendVerificationEmail, signInWithSocialProvider } from "@/lib/auth";

type AuthMode = "login" | "cadastro";
type SocialProvider = "google" | "github" | "facebook" | "instagram";
type SupportedSocialProvider = "google" | "github" | "facebook";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<string | null>;
  initialMode?: AuthMode;
  onRegister: (input: {
    nome: string;
    email: string;
    senha: string;
    confirmarSenha: string;
  }) => Promise<{ ok: boolean; error: string | null; message: string | null }>;
};

type LoginFormProps = {
  email: string;
  senha: string;
  error: string;
  notice: string;
  loading: boolean;
  socialLoadingProvider: SocialProvider | null;
  resendingVerification: boolean;
  emailRef: React.RefObject<HTMLInputElement | null>;
  onEmailChange: (value: string) => void;
  onSenhaChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onGoToCadastro: () => void;
  onResendVerification: () => void | Promise<void>;
  onSocialLogin: (provider: SocialProvider) => void | Promise<void>;
};

type CadastroFormProps = {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  error: string;
  loading: boolean;
  nameRef: React.RefObject<HTMLInputElement | null>;
  socialLoadingProvider: SocialProvider | null;
  onNomeChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSenhaChange: (value: string) => void;
  onConfirmarSenhaChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onBackToLogin: () => void;
  onSocialLogin: (provider: SocialProvider) => void | Promise<void>;
};

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500";

const primaryButtonClassName =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-70";

const socialButtonClassName =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

function SocialButtons({
  socialLoadingProvider,
  onSocialLogin,
  dividerText,
}: {
  socialLoadingProvider: SocialProvider | null;
  onSocialLogin: (provider: SocialProvider) => void | Promise<void>;
  dividerText?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-300">Continuar com</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void onSocialLogin("google")}
          disabled={socialLoadingProvider !== null}
          className={socialButtonClassName}
          aria-label={socialLoadingProvider === "google" ? "Abrindo Google" : "Continuar com Google"}
          title={socialLoadingProvider === "google" ? "Abrindo Google..." : "Continuar com Google"}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.6l6.91-6.91C35.64 2.2 30.23 0 24 0 14.82 0 6.86 5.48 2.69 13.44l8.06 6.26C12.54 13.12 17.83 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.55c0-1.63-.15-3.2-.43-4.71H24v9h12.5c-.54 2.9-2.2 5.36-4.7 7.02l7.2 5.6C43.94 37.36 46.1 31.45 46.1 24.55z"/>
            <path fill="#FBBC05" d="M10.75 28.7a14.5 14.5 0 010-9.4l-8.06-6.26A23.93 23.93 0 000 24c0 3.8.91 7.38 2.69 10.44l8.06-6.26z"/>
            <path fill="#34A853" d="M24 48c6.23 0 11.46-2.06 15.28-5.6l-7.2-5.6c-2 1.35-4.55 2.14-8.08 2.14-6.17 0-11.46-3.62-13.25-8.7l-8.06 6.26C6.86 42.52 14.82 48 24 48z"/>
          </svg>
          <span className="truncate">Google</span>
        </button>

        <button
          type="button"
          onClick={() => void onSocialLogin("github")}
          disabled={socialLoadingProvider !== null}
          className={socialButtonClassName}
          aria-label={socialLoadingProvider === "github" ? "Abrindo GitHub" : "Continuar com GitHub"}
          title={socialLoadingProvider === "github" ? "Abrindo GitHub..." : "Continuar com GitHub"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.52-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.19 1.18a11.1 11.1 0 0 1 5.8 0c2.22-1.49 3.19-1.18 3.19-1.18.62 1.59.23 2.77.11 3.06.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.25 5.67.41.35.78 1.04.78 2.09v3.1c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
    />
  </svg>
          <span className="truncate">GitHub</span>
        </button>

        <button
          type="button"
          onClick={() => void onSocialLogin("facebook")}
          disabled={socialLoadingProvider !== null}
          className={socialButtonClassName}
          aria-label={socialLoadingProvider === "facebook" ? "Abrindo Facebook" : "Continuar com Facebook"}
          title={socialLoadingProvider === "facebook" ? "Abrindo Facebook..." : "Continuar com Facebook"}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.03 10.13 11.93v-8.44H7.08v-3.5h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.5h-2.79V24C19.61 23.1 24 18.1 24 12.07Z"
    />
  </svg>
          <span className="truncate">Facebook</span>
        </button>

        <button
          type="button"
          onClick={() => void onSocialLogin("instagram")}
          disabled={socialLoadingProvider !== null}
          className={socialButtonClassName}
          aria-label="Continuar com Instagram"
          title="Continuar com Instagram"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F58529" />
        <stop offset="30%" stopColor="#FEDA77" />
        <stop offset="60%" stopColor="#DD2A7B" />
        <stop offset="85%" stopColor="#8134AF" />
        <stop offset="100%" stopColor="#515BD4" />
      </linearGradient>
    </defs>
    <path
      fill="url(#instagram-gradient)"
      d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z"
    />
  </svg>
          <span className="truncate">Instagram</span>
        </button>
      </div>

      {dividerText ? (
        <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          <span>{dividerText}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputRef,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function LoginForm({
  email,
  senha,
  error,
  notice,
  loading,
  socialLoadingProvider,
  resendingVerification,
  emailRef,
  onEmailChange,
  onSenhaChange,
  onSubmit,
  onGoToCadastro,
  onResendVerification,
  onSocialLogin,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label="Email"
        id="auth-login-email"
        type="email"
        value={email}
        onChange={onEmailChange}
        placeholder="voce@empresa.com"
        autoComplete="email"
        inputRef={emailRef}
      />

      <Field
        label="Senha"
        id="auth-login-password"
        type="password"
        value={senha}
        onChange={onSenhaChange}
        placeholder="Digite sua senha"
        autoComplete="current-password"
      />

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      <button type="submit" disabled={loading} className={primaryButtonClassName}>
        {loading ? "Entrando..." : "Entrar"}
        <ArrowRight size={16} />
      </button>

      <div className="flex items-center justify-between gap-3 text-sm">
        <button type="button" onClick={onGoToCadastro} className="font-medium text-cyan-200 transition hover:text-cyan-100">
          Criar conta
        </button>
        <button
          type="button"
          onClick={() => void onResendVerification()}
          disabled={resendingVerification}
          className="font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-60"
        >
          {resendingVerification ? "Reenviando..." : "Reenviar confirmacao"}
        </button>
      </div>

      <div className="border-t border-white/10 pt-4">
        <SocialButtons socialLoadingProvider={socialLoadingProvider} onSocialLogin={onSocialLogin} />
      </div>
    </form>
  );
}

function CadastroForm({
  nome,
  email,
  senha,
  confirmarSenha,
  error,
  loading,
  nameRef,
  socialLoadingProvider,
  onNomeChange,
  onEmailChange,
  onSenhaChange,
  onConfirmarSenhaChange,
  onSubmit,
  onBackToLogin,
  onSocialLogin,
}: CadastroFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <SocialButtons
        socialLoadingProvider={socialLoadingProvider}
        onSocialLogin={onSocialLogin}
        dividerText="ou cadastre com email"
      />

      <Field
        label="Nome"
        id="auth-register-name"
        type="text"
        value={nome}
        onChange={onNomeChange}
        placeholder="Seu nome"
        autoComplete="name"
        inputRef={nameRef}
      />

      <Field
        label="Email"
        id="auth-register-email"
        type="email"
        value={email}
        onChange={onEmailChange}
        placeholder="voce@empresa.com"
        autoComplete="email"
      />

      <Field
        label="Senha"
        id="auth-register-password"
        type="password"
        value={senha}
        onChange={onSenhaChange}
        placeholder="Minimo 6 caracteres"
        autoComplete="new-password"
      />

      <Field
        label="Confirmar senha"
        id="auth-register-password-confirm"
        type="password"
        value={confirmarSenha}
        onChange={onConfirmarSenhaChange}
        placeholder="Repita a senha"
        autoComplete="new-password"
      />

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <button type="submit" disabled={loading} className={primaryButtonClassName}>
        {loading ? "Criando..." : "Criar conta"}
        <ArrowRight size={16} />
      </button>

      <button type="button" onClick={onBackToLogin} className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100">
        Voltar para login
      </button>
    </form>
  );
}

export function AuthModal({ open, onClose, onLogin, onRegister, initialMode = "login" }: AuthModalProps) {
  const [modo, setModo] = useState<AuthMode>("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [cadastroNome, setCadastroNome] = useState("");
  const [cadastroEmail, setCadastroEmail] = useState("");
  const [cadastroSenha, setCadastroSenha] = useState("");
  const [cadastroConfirmarSenha, setCadastroConfirmarSenha] = useState("");
  const [cadastroError, setCadastroError] = useState("");
  const [cadastroLoading, setCadastroLoading] = useState(false);

  const [socialLoadingProvider, setSocialLoadingProvider] = useState<SocialProvider | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  const loginEmailRef = useRef<HTMLInputElement>(null);
  const cadastroNomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setModo(initialMode);
      setLoginError("");
      setLoginNotice("");
      setLoginLoading(false);
      setCadastroError("");
      setCadastroLoading(false);
      setSocialLoadingProvider(null);
      setResendingVerification(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setModo(initialMode);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      if (modo === "login") {
        loginEmailRef.current?.focus();
      } else {
        cadastroNomeRef.current?.focus();
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [modo, open]);

  if (!open) {
    return null;
  }

  const goToLogin = () => {
    setModo("login");
    setCadastroError("");
  };

  const goToCadastro = () => {
    setModo("cadastro");
    setLoginError("");
    setLoginNotice("");
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginNotice("");
    setLoginLoading(true);

    const error = await onLogin(loginEmail, loginSenha);

    if (error) {
      setLoginError(error);
      setLoginLoading(false);
      return;
    }

    setLoginLoading(false);
    onClose();
  };

  const handleCadastroSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCadastroError("");
    setCadastroLoading(true);

    if (!cadastroNome.trim() || !cadastroEmail.trim() || !cadastroSenha || !cadastroConfirmarSenha) {
      setCadastroError("Preencha nome, email, senha e confirmacao.");
      setCadastroLoading(false);
      return;
    }

    if (cadastroSenha.length < 6) {
      setCadastroError("A senha precisa ter pelo menos 6 caracteres.");
      setCadastroLoading(false);
      return;
    }

    if (cadastroSenha !== cadastroConfirmarSenha) {
      setCadastroError("A confirmacao de senha nao confere.");
      setCadastroLoading(false);
      return;
    }

    const result = await onRegister({
      nome: cadastroNome,
      email: cadastroEmail,
      senha: cadastroSenha,
      confirmarSenha: cadastroConfirmarSenha,
    });

    if (!result.ok) {
      setCadastroError(result.error ?? "Nao foi possivel concluir seu cadastro agora.");
      setCadastroLoading(false);
      return;
    }

    setCadastroLoading(false);
    setCadastroNome("");
    setCadastroEmail("");
    setCadastroSenha("");
    setCadastroConfirmarSenha("");
    setLoginNotice(result.message ?? "Enviamos um email para voce confirmar sua conta.");
    setModo("login");
  };

  const clearSocialFeedback = (sourceMode: AuthMode) => {
    if (sourceMode === "login") {
      setLoginError("");
      setLoginNotice("");
      return;
    }

    setCadastroError("");
  };

  const setSocialError = (sourceMode: AuthMode, message: string) => {
    if (sourceMode === "login") {
      setLoginError(message);
      return;
    }

    setCadastroError(message);
  };

  const handleSocialLogin = async (provider: SocialProvider, sourceMode: AuthMode) => {
    clearSocialFeedback(sourceMode);

    if (provider === "instagram") {
      setSocialError(sourceMode, "Instagram ainda nao esta disponivel no login social.");
      return;
    }

    setSocialLoadingProvider(provider);

    const result = await signInWithSocialProvider(provider as SupportedSocialProvider);

    if (!result.ok) {
      setSocialError(sourceMode, result.error ?? "Nao foi possivel iniciar o login social.");
      setSocialLoadingProvider(null);
    }
  };

  const handleResendVerification = async () => {
    if (!loginEmail.trim()) {
      setLoginError("Informe seu email para reenviar a confirmacao.");
      return;
    }

    setLoginError("");
    setResendingVerification(true);

    const result = await resendVerificationEmail(loginEmail);

    if (!result.ok) {
      setLoginError(result.error ?? "Nao foi possivel reenviar o email agora.");
      setResendingVerification(false);
      return;
    }

    setLoginNotice(result.message ?? "Enviamos um novo email de confirmacao.");
    setResendingVerification(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/15 bg-[#0f172a]/95 shadow-2xl shadow-black/40">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar autenticacao"
          className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
            <Lock size={14} />
            {modo === "login" ? "Acesso rapido" : "Criar conta"}
          </div>
          <h2 className="pr-10 text-2xl font-semibold text-white">
            {modo === "login" ? "Acesse sua conta" : "Crie sua conta"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {modo === "login"
              ? "Entre para gerenciar seus projetos, agentes e operacoes em um so lugar."
              : "Crie seu acesso e confirme o email para liberar o ambiente inicial."}
          </p>
        </div>

        <div className="px-6 py-6">
          <div className="overflow-hidden">
            <div
              className="flex w-[200%] transition-transform duration-300 ease-out"
              style={{ transform: modo === "login" ? "translateX(0%)" : "translateX(-50%)" }}
            >
              <div className="w-full shrink-0 pr-6">
                {modo === "login" ? (
                  <LoginForm
                    email={loginEmail}
                    senha={loginSenha}
                    error={loginError}
                    notice={loginNotice}
                    loading={loginLoading}
                    socialLoadingProvider={socialLoadingProvider}
                    resendingVerification={resendingVerification}
                    emailRef={loginEmailRef}
                    onEmailChange={setLoginEmail}
                    onSenhaChange={setLoginSenha}
                    onSubmit={handleLoginSubmit}
                    onGoToCadastro={goToCadastro}
                    onResendVerification={handleResendVerification}
                    onSocialLogin={(provider) => handleSocialLogin(provider, "login")}
                  />
                ) : (
                  <div aria-hidden="true" />
                )}
              </div>

              <div className="w-full shrink-0 pl-6">
                {modo === "cadastro" ? (
                  <CadastroForm
                    nome={cadastroNome}
                    email={cadastroEmail}
                    senha={cadastroSenha}
                    confirmarSenha={cadastroConfirmarSenha}
                    error={cadastroError}
                    loading={cadastroLoading}
                    nameRef={cadastroNomeRef}
                    socialLoadingProvider={socialLoadingProvider}
                    onNomeChange={setCadastroNome}
                    onEmailChange={setCadastroEmail}
                    onSenhaChange={setCadastroSenha}
                    onConfirmarSenhaChange={setCadastroConfirmarSenha}
                    onSubmit={handleCadastroSubmit}
                    onBackToLogin={goToLogin}
                    onSocialLogin={(provider) => handleSocialLogin(provider, "cadastro")}
                  />
                ) : (
                  <div aria-hidden="true" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const LoginModal = AuthModal;
