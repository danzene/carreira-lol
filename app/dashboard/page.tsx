"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import { useCareer } from "@/store/careerStore";

export default function DashboardPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const sair = useCareer((s) => s.sair);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-pixel text-sm text-ciano">DASHBOARD</h1>
        <button
          type="button"
          onClick={() => {
            sair();
            router.push("/");
          }}
          className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto"
        >
          Trocar carreira
        </button>
      </header>

      <PlayerCard career={career} />

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/draft"
          className="border-2 border-rosa bg-rosa/10 px-4 py-3 text-center font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
        >
          ⚔️ JOGAR PARTIDA
        </Link>
        <Link
          href="/campeoes"
          className="border-2 border-borda bg-painel px-4 py-3 text-center font-pixel text-[10px] text-ciano transition hover:border-ciano"
        >
          📋 TIER LIST
        </Link>
      </div>

      <p className="text-center font-pixel text-[8px] text-borda">PRÓXIMA FASE · LOOP SEMANAL</p>
      <p className="text-center text-xs">
        <Link href="/" className="text-ciano hover:underline">
          Início
        </Link>
      </p>
    </main>
  );
}
