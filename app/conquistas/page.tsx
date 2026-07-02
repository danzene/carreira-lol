"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CONQUISTAS } from "@/engine/conquistas";
import { useCareer } from "@/store/careerStore";

export default function ConquistasPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const desbloq = new Set(career.conquistas ?? []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">CONQUISTAS</h1>
          <p className="mt-1 text-[11px] text-suave">
            {desbloq.size} / {CONQUISTAS.length} desbloqueadas
          </p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CONQUISTAS.map((q) => {
          const ok = desbloq.has(q.id);
          return (
            <div
              key={q.id}
              className={`flex items-center gap-3 border-2 p-3 ${ok ? "border-ciano/50 bg-ciano/5" : "border-borda bg-painel opacity-60"}`}
            >
              <span className="text-2xl">{ok ? q.emoji : "🔒"}</span>
              <div className="min-w-0">
                <p className={`text-sm ${ok ? "text-texto" : "text-suave"}`}>{q.nome}</p>
                <p className="text-[11px] text-suave">{q.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
