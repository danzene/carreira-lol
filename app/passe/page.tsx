"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PASSE, RECOMPENSAS_FREE, type Recompensa } from "@/data/passe";
import { nivelDoPasse, podeResgatar, ppNoNivel, ppParaProximo, type MissaoAtiva, type PasseState } from "@/engine/passe";
import { usePasse } from "@/store/passeStore";

const ICONE_REC: Record<Recompensa["tipo"], string> = { coinpoints: "🪙", item: "🎒", ingresso: "🎟️", moldura: "🖼️" };

function Missao({ m }: { m: MissaoAtiva }) {
  const pct = Math.min(100, (m.progresso / m.alvo) * 100);
  return (
    <div className={`border-2 bg-painel p-2.5 ${m.concluida ? "border-emerald-500/60" : "border-borda"}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className={m.concluida ? "text-emerald-400" : "text-texto"}>
          {m.concluida ? "✓ " : ""}
          {m.texto}
        </span>
        <span className="shrink-0 font-pixel text-[8px] text-ciano">+{m.pp} PP</span>
      </div>
      <div className="h-2 overflow-hidden border-2 border-borda bg-fundo">
        <div className={`h-full ${m.concluida ? "bg-emerald-500" : "bg-gradient-to-r from-rosa to-ciano"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-right text-[8px] text-suave">
        {m.progresso}/{m.alvo}
      </p>
    </div>
  );
}

function CartaRecompensa({ r, passe, onResgatar }: { r: Recompensa; passe: PasseState; onResgatar: () => void }) {
  const resgatada = passe.resgatadasFree.includes(r.nivel);
  const pode = podeResgatar(passe, r);
  const alcancado = nivelDoPasse(passe.pp) >= r.nivel;
  return (
    <div
      className={`flex w-24 shrink-0 flex-col items-center gap-1 border-2 p-2 text-center ${
        resgatada ? "border-borda opacity-60" : pode ? "border-amber-300 bg-amber-300/10" : "border-borda"
      }`}
    >
      <span className="font-pixel text-[8px] text-suave">NÍVEL {r.nivel}</span>
      <span className="text-2xl">{ICONE_REC[r.tipo]}</span>
      <span className="text-[9px] leading-tight text-texto">{r.rotulo}</span>
      {resgatada ? (
        <span className="font-pixel text-[7px] text-emerald-400">✓ RESGATADO</span>
      ) : pode ? (
        <button
          type="button"
          onClick={onResgatar}
          className="w-full border-2 border-amber-300 bg-amber-300/10 py-1 font-pixel text-[7px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
        >
          RESGATAR
        </button>
      ) : (
        <span className="font-pixel text-[7px] text-borda">{alcancado ? "—" : "🔒"}</span>
      )}
    </div>
  );
}

export default function PassePage() {
  const passe = usePasse((s) => s.passe);
  const carregando = usePasse((s) => s.carregando);
  const carregar = usePasse((s) => s.carregar);
  const resgatar = usePasse((s) => s.resgatar);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando || !passe) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const nivel = nivelDoPasse(passe.pp);
  const pctNivel = nivel >= PASSE.niveis ? 100 : (ppNoNivel(passe.pp) / PASSE.ppPorNivel) * 100;
  const falta = ppParaProximo(passe.pp);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">PASSE DE BATALHA</h1>
          <p className="mt-1 text-[10px] text-suave">Missões → Pontos de Passe → recompensas</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* nível + barra */}
      <div className="border-2 border-ciano/40 bg-ciano/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-pixel text-sm text-ciano">NÍVEL {nivel}/{PASSE.niveis}</span>
          <span className="text-[10px] text-amber-300">🎟️ {passe.ingressos} ingressos</span>
        </div>
        <div className="h-3 overflow-hidden border-2 border-borda bg-fundo">
          <div className="h-full bg-gradient-to-r from-rosa to-ciano transition-all" style={{ width: `${pctNivel}%` }} />
        </div>
        <p className="mt-1 text-right text-[9px] text-suave">{falta > 0 ? `${falta} PP pro próximo nível` : "Nível máximo 👑"}</p>
      </div>

      {/* missões */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">MISSÕES DIÁRIAS</h2>
        {passe.diarias.map((m) => (
          <Missao key={m.id} m={m} />
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">MISSÕES SEMANAIS</h2>
        {passe.semanais.map((m) => (
          <Missao key={m.id} m={m} />
        ))}
      </section>

      {/* recompensas grátis */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">RECOMPENSAS · TRILHA GRÁTIS</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RECOMPENSAS_FREE.map((r) => (
            <CartaRecompensa key={r.nivel} r={r} passe={passe} onResgatar={() => resgatar(r)} />
          ))}
        </div>
      </section>

      <div className="border-2 border-borda bg-painel/40 p-3 text-center text-[10px] text-suave">
        🔒 Passe <span className="text-amber-300">Premium</span> (recompensas em todo nível + molduras) em breve.
      </div>
    </main>
  );
}
