"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { signInWithProjectAuth } from "@/lib/auth";
import { isDemoUser } from "@/lib/demo-user";

const DEMO_USER_STORAGE_KEY = "demoUser";

export function NovaHomeClient() {
  const router = useRouter();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleDemoLogin = async () => {
    if (loadingDemo) {
      return;
    }

    setLoadingDemo(true);

    let email = "";
    const senha = "123";

    if (typeof window !== "undefined") {
      const existingDemoUser = window.localStorage.getItem(DEMO_USER_STORAGE_KEY)?.trim() || "";
      if (existingDemoUser && isDemoUser(existingDemoUser)) {
        email = existingDemoUser;
      } else {
        email = `demonstracao_${Date.now()}@demo.com`;
        window.localStorage.setItem(DEMO_USER_STORAGE_KEY, email);
      }
    }

    if (!email) {
      email = `demonstracao_${Date.now()}@demo.com`;
    }

    let result = await signInWithProjectAuth(email, senha);

    if (!result.user) {
      const response = await fetch("/api/auth/demo-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          senha,
        }),
      });

      if (!response.ok) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        }
        setLoadingDemo(false);
        return;
      }

      result = await signInWithProjectAuth(email, senha);
    }

    if (!result.user) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      }
      setLoadingDemo(false);
      return;
    }

    const demoCreateResponse = await fetch("/api/auth/demo-create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        senha,
      }),
    }).catch(() => null);

    const createdProjectId = demoCreateResponse?.ok
      ? (((await demoCreateResponse.json().catch(() => ({}))) as { projectId?: string }).projectId ?? null)
      : null;

    setLoadingDemo(false);
    router.push(createdProjectId ? `/admin/projetos/${createdProjectId}` : "/admin/projetos");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040816] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-12%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-sky-500/14 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-8%] h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="absolute left-[-8%] top-[32%] h-[18rem] w-[18rem] rounded-full bg-blue-700/10 blur-[110px]" />
      </div>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl text-center">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-12 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur-xl sm:px-12 sm:py-16">
            <div className="mx-auto mb-6 inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">
              Demonstre em segundos
            </div>

            <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">
              Crie um atendente com IA em segundos
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-xl">
              Teste funcionando agora, sem cadastro
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleDemoLogin()}
                disabled={loadingDemo}
                className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-8 py-4 text-base font-semibold text-cyan-50 transition-all hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-400/14 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingDemo ? <LoaderCircle size={18} className="animate-spin" /> : null}
                Testar agora
              </button>

              <button
                type="button"
                onClick={() => router.push("/?auth=cadastro")}
                className="inline-flex min-w-[220px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-slate-100 transition-all hover:bg-white/10"
              >
                Criar conta
              </button>
            </div>

            <p className="mt-4 text-sm font-medium text-slate-400">
              Sem cadastro • Teste em segundos
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
