"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import PainelSemana from "@/components/PainelSemana";
import HistoricoPartidas from "@/components/HistoricoPartidas";
import ResumoSemanaModal from "@/components/ResumoSemanaModal";
import { timeDe } from "@/data/times";
import { proximoConfrontoJogador } from "@/engine/liga";
import { versaoPatch } from "@/engine/patch";
import type { CareerState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import { useProfile } from "@/store/profileStore";
import { useInventory } from "@/store/inventoryStore";

export default function DashboardPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const sincronizarLiga = useCareer((s) => s.sincronizarLiga);
  const ultimoResumo = useCareer((s) => s.ultimoResumo);
  const limparResumo = useCareer((s) => s.limparResumo);
  const sair = useCareer((s) => s.sair);
  const coinpoints = useProfile((s) => s.perfil?.coinpoints ?? 0);
  const novosItens = useInventory((s) => s.novos);

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

      <HistoricoPartidas partidas={career.historicoPartidas} />

      <LigaBanner career={career} />

      {career.torneioAtual && (
        <Link
          href="/torneio"
          className="border-2 border-amber-300 bg-amber-300/10 px-4 py-3 text-center font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
        >
          🌍 {career.torneioAtual.nome.toUpperCase()} ·{" "}
          {career.torneioAtual.bracket.fase === "ENCERRADA" ? "RESULTADO" : "JOGAR"}
        </Link>
      )}

      {career.eventoAtual && (
        <Link
          href="/draft?evento=1"
          className="border-2 border-amber-300 bg-amber-300/10 px-4 py-3 text-center font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
        >
          ⭐ EVENTO: {career.eventoAtual.nome}
        </Link>
      )}

      <Link
        href="/patch"
        className="border-2 border-borda bg-painel px-4 py-3 text-center font-pixel text-[10px] text-ciano transition hover:border-ciano"
      >
        🧪 PATCH {versaoPatch(career.patchVigente)} · VER MUDANÇAS
      </Link>

      <Link
        href="/gacha"
        className="border-2 border-rosa bg-rosa/10 px-4 py-3 text-center font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
      >
        🎰 CARREIRA BOOSTER · 🪙 {coinpoints}
      </Link>

      <div className="grid grid-cols-2 gap-2">
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
        <Link
          href="/conquistas"
          className="border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[10px] text-ciano transition hover:border-ciano"
        >
          🏅 CONQUISTAS
        </Link>
        <Link
          href="/inventario"
          className="relative border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[10px] text-ciano transition hover:border-ciano"
        >
          🎒 INVENTÁRIO
          {novosItens > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center border-2 border-fundo bg-rosa px-1 font-pixel text-[8px] text-fundo">
              {novosItens}
            </span>
          )}
        </Link>
      </div>

      <p className="text-center font-pixel text-[8px] text-borda">CARREIRA LoL · v1.0 🏁</p>
      <p className="text-center text-xs">
        <Link href="/" className="text-ciano hover:underline">
          Início
        </Link>
      </p>

      {ultimoResumo && <ResumoSemanaModal resumo={ultimoResumo} onFechar={limparResumo} />}
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
