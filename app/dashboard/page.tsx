"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import PainelSemana from "@/components/PainelSemana";
import { timeDe } from "@/data/times";
import { proximoConfrontoJogador } from "@/engine/liga";
import type { CareerState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

export default function DashboardPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const sincronizarLiga = useCareer((s) => s.sincronizarLiga);
  const sair = useCareer((s) => s.sair);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  useEffect(() => {
    sincronizarLiga();
  }, [sincronizarLiga]);

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

      <PainelSemana career={career} />

      <PlayerCard career={career} />

      <LigaBanner career={career} />

      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/loja"
          className="border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[10px] text-ciano transition hover:border-ciano"
        >
          💰 LOJA
        </Link>
        <Link
          href="/propostas"
          className={`border-2 px-2 py-3 text-center font-pixel text-[10px] transition ${
            career.inbox.length > 0
              ? "border-ciano bg-ciano/10 text-ciano"
              : "border-borda bg-painel text-ciano hover:border-ciano"
          }`}
        >
          📨 {career.inbox.length > 0 ? `(${career.inbox.length})` : "INBOX"}
        </Link>
        <Link
          href="/campeoes"
          className="border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[10px] text-ciano transition hover:border-ciano"
        >
          📋 TIER
        </Link>
      </div>

      <p className="text-center font-pixel text-[8px] text-borda">PRÓXIMA FASE · AUTO PATCH + WIN RATES</p>
      <p className="text-center text-xs">
        <Link href="/" className="text-ciano hover:underline">
          Início
        </Link>
      </p>
    </main>
  );
}

function LigaBanner({ career }: { career: CareerState }) {
  const liga = career.liga;
  const adv = proximoConfrontoJogador(liga);
  let texto: string;
  if (!career.contratoAtual) texto = "sem time";
  else if (!liga) texto = "—";
  else if (liga.fase === "ENCERRADA") texto = "temporada encerrada";
  else if (adv) texto = `próx: vs ${timeDe(adv)?.nome ?? adv}`;
  else texto = liga.fase === "PLAYOFFS" ? "playoffs" : "em andamento";
  const destaque = !!adv || liga?.fase === "ENCERRADA";
  return (
    <Link
      href="/liga"
      className={`border-2 px-4 py-3 text-center font-pixel text-[10px] transition ${
        destaque ? "border-rosa bg-rosa/10 text-rosa" : "border-borda bg-painel text-ciano hover:border-ciano"
      }`}
    >
      🏆 LIGA · {texto}
    </Link>
  );
}
