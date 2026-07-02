"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PASSE, RECOMPENSAS_FREE, RECOMPENSAS_PREMIUM, type Recompensa } from "@/data/passe";
import { nivelDoPasse, podeResgatar, ppNoNivel, ppParaProximo, type MissaoAtiva, type PasseState } from "@/engine/passe";
import { usePasse } from "@/store/passeStore";
import AnimatedBar from "@/components/juice/AnimatedBar";

const ICONE_REC: Record<Recompensa["tipo"], string> = { coinpoints: "🪙", item: "🎒", ingresso: "🎟️", moldura: "🖼️" };

function Missao({ m }: { m: MissaoAtiva }) {
  const pct = Math.min(100, (m.progresso / m.alvo) * 100);
  return (
    <div className={`border-2 bg-painel p-2.5 ${m.concluida ? "border-emerald-500/60" : "border-borda"}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
        <span className={m.concluida ? "text-emerald-400" : "text-texto"}>
          {m.concluida ? "✓ " : ""}
          {m.texto}
        </span>
        <span className="shrink-0 font-pixel text-[10px] text-ciano">+{m.pp} PP</span>
      </div>
      <div className="h-2 overflow-hidden border-2 border-borda bg-fundo">
        <div className={`h-full ${m.concluida ? "bg-emerald-500" : "bg-gradient-to-r from-rosa to-ciano"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-right text-[10px] text-suave">
        {m.progresso}/{m.alvo}
      </p>
    </div>
  );
}

function CartaRecompensa({ r, passe, onResgatar }: { r: Recompensa; passe: PasseState; onResgatar: () => void }) {
  const resgatada = (r.trilha === "free" ? passe.resgatadasFree : passe.resgatadasPremium).includes(r.nivel);
  const pode = podeResgatar(passe, r);
  const bloqueadoPorPremium = r.trilha === "premium" && !passe.premium;
  const ppAlvo = (r.nivel - 1) * PASSE.ppPorNivel; // PP para atingir este nível
  const falta = Math.max(0, ppAlvo - passe.pp);
  const alcancado = falta === 0;
  const pct = ppAlvo <= 0 ? 100 : Math.min(100, (passe.pp / ppAlvo) * 100);
  return (
    <div
      className={`flex w-24 shrink-0 flex-col items-center gap-1 border-2 p-2 text-center ${
        resgatada
          ? "border-borda opacity-60"
          : pode
            ? "border-amber-300 bg-amber-300/10"
            : bloqueadoPorPremium
              ? "border-amber-300/40 bg-amber-300/5"
              : "border-borda"
      }`}
    >
      <span className="font-pixel text-[10px] text-suave">NÍVEL {r.nivel}</span>
      <span className="text-2xl">{ICONE_REC[r.tipo]}</span>
      <span className="text-[10px] leading-tight text-texto">{r.rotulo}</span>
      <div className="h-1.5 w-full overflow-hidden border border-borda bg-fundo">
        <div
          className={`h-full ${alcancado ? "bg-emerald-500" : bloqueadoPorPremium ? "bg-amber-300/70" : "bg-gradient-to-r from-rosa to-ciano"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {resgatada ? (
        <span className="font-pixel text-[9px] text-emerald-400">✓ RESGATADO</span>
      ) : !alcancado ? (
        <span className="text-[9px] text-suave">faltam {falta} PP</span>
      ) : pode ? (
        <button
          type="button"
          onClick={onResgatar}
          className="w-full border-2 border-amber-300 bg-amber-300/10 py-1 font-pixel text-[9px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
        >
          RESGATAR
        </button>
      ) : bloqueadoPorPremium ? (
        <span className="font-pixel text-[9px] text-amber-300/80">🔒 PREMIUM</span>
      ) : (
        <span className="font-pixel text-[9px] text-borda">🔒</span>
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
  const resgataveis = [...RECOMPENSAS_FREE, ...RECOMPENSAS_PREMIUM].filter((r) => podeResgatar(passe, r));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">PASSE DE BATALHA</h1>
          <p className="mt-1 text-[11px] text-suave">Missões → Pontos de Passe → recompensas</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* nível + barra */}
      <div className="border-2 border-ciano/40 bg-ciano/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-pixel text-sm text-ciano">NÍVEL {nivel}/{PASSE.niveis}</span>
          <span className="flex items-center gap-2 text-[11px] text-amber-300">
            {passe.premium && <span className="border border-amber-300 px-1 font-pixel text-[9px]">✨ PREMIUM</span>}
            🎟️ {passe.ingressos}
          </span>
        </div>
        <AnimatedBar pct={pctNivel} alturaClass="h-3" />
        <p className="mt-1 text-right text-[10px] text-suave">{falta > 0 ? `${falta} PP pro próximo nível` : "Nível máximo 👑"}</p>
      </div>

      {resgataveis.length > 1 && (
        <button
          type="button"
          onClick={() => resgataveis.forEach((r) => resgatar(r))}
          className="border-2 border-amber-300 bg-amber-300/10 py-2 font-pixel text-[11px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
        >
          🎁 RESGATAR TUDO ({resgataveis.length})
        </button>
      )}

      {/* missões */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">MISSÕES DIÁRIAS</h2>
        {passe.diarias.map((m) => (
          <Missao key={m.id} m={m} />
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">MISSÕES SEMANAIS</h2>
        {passe.semanais.map((m) => (
          <Missao key={m.id} m={m} />
        ))}
      </section>

      {/* recompensas grátis */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">RECOMPENSAS · TRILHA GRÁTIS</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RECOMPENSAS_FREE.map((r) => (
            <CartaRecompensa key={`f${r.nivel}`} r={r} passe={passe} onResgatar={() => resgatar(r)} />
          ))}
        </div>
      </section>

      {/* recompensas premium */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[11px] text-amber-300">RECOMPENSAS · TRILHA PREMIUM</h2>
          <span className="font-pixel text-[10px] text-suave">{passe.premium ? "✨ ATIVO" : "🔒 bloqueado"}</span>
        </div>
        {!passe.premium && (
          <p className="text-[10px] text-suave">
            Ative o Premium pra resgatar esta trilha e ganhar +{Math.round(PASSE.premiumBonusPP * 100)}% de PP. (compra em breve)
          </p>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RECOMPENSAS_PREMIUM.map((r) => (
            <CartaRecompensa key={`p${r.nivel}`} r={r} passe={passe} onResgatar={() => resgatar(r)} />
          ))}
        </div>
      </section>
    </main>
  );
}
