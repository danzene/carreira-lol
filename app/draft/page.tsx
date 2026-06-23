"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DraftBoard from "@/components/DraftBoard";
import { useCareer } from "@/store/careerStore";

export default function DraftPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">DRAFT</h1>
          <p className="mt-1 text-[10px] text-suave">Treino de pick &amp; ban · sua voz cresce com a reputação</p>
        </div>
        <Link
          href="/dashboard"
          className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto"
        >
          Voltar
        </Link>
      </header>

      <DraftBoard comfort={career.player.pool.map((p) => p.championId)} reputacao={career.player.reputacao} />
    </main>
  );
}
