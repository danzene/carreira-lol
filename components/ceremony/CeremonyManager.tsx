"use client";

import { useEffect, useState } from "react";
import { DURACOES, duracaoAntecipacao, tierDeItem, tierDeLenda, TIERS_JUICE, type TierJuice } from "@/data/juice";
import { raridadeItemDef, slotDef } from "@/data/itens";
import { melhorRaridade, type Cerimonia } from "@/engine/cerimonias";
import { alternarMute, somMutado, tocarSom, tocarSomTier, type SomId } from "@/lib/som";
import { useCerimonias } from "@/store/cerimoniaStore";
import PixelBurst from "@/components/juice/PixelBurst";
import CerimoniaDrop from "./CerimoniaDrop";
import CerimoniaElo from "./CerimoniaElo";
import CerimoniaPasse from "./CerimoniaPasse";

// 🎭 Apresenta as cerimônias da fila: UMA fullscreen por vez (fases: antecipação →
// revelação → celebração), toasts em paralelo no canto. Sempre dispensável com 1 clique;
// o jogo NUNCA trava esperando animação. Nenhuma regra de jogo aqui — só apresentação.

type Fase = "antecipacao" | "revelacao" | "celebracao";

interface Apresentacao {
  emoji: string;
  titulo: string;
  sub: string;
  detalhe?: string;
  tier: TierJuice;
  som: SomId | null;
  somTier?: TierJuice; // se setado, toca o som do tier em vez do `som`
  sobrio?: boolean; // versão rápida e neutra (ex.: queda de elo)
}

function apresentar(c: Cerimonia): Apresentacao {
  switch (c.tipo) {
    case "RANK_PROMOTED":
      return { emoji: "🏆", titulo: "PROMOÇÃO!", sub: c.para, detalhe: `${c.de} → ${c.para}`, tier: 4, som: "promocao" };
    case "RANK_DEMOTED":
      return { emoji: "📉", titulo: "Queda de elo", sub: c.para, detalhe: `${c.de} → ${c.para}`, tier: 1, som: "rebaixamento", sobrio: true };
    case "PASS_LEVEL_UP":
      return {
        emoji: "🎟️",
        titulo: `NÍVEL ${c.para} DO PASSE`,
        sub: c.para - c.de > 1 ? `+${c.para - c.de} níveis!` : "Nível novo!",
        detalhe: c.recompensas.length > 0 ? `${c.recompensas.length} recompensa(s) no caminho` : undefined,
        tier: 3,
        som: "levelup",
      };
    case "ACHIEVEMENT_UNLOCKED":
      return { emoji: c.emoji, titulo: "CONQUISTA!", sub: c.nome, detalhe: c.desc, tier: 3, som: "conquista" };
    case "FEATURE_UNLOCKED":
      return { emoji: "🔓", titulo: "NOVO RECURSO!", sub: c.nome, detalhe: c.desc, tier: 4, som: "unlock" };
    case "STREAK_MILESTONE":
      return { emoji: "🔥", titulo: `${c.dias} DIAS SEGUIDOS`, sub: c.recompensa, tier: 3, som: "conquista" };
    case "ITEM_DROPPED": {
      const tier = tierDeItem(c.item.raridade);
      return {
        emoji: slotDef(c.item.slot).emoji,
        titulo: "ITEM DROPADO!",
        sub: `${raridadeItemDef(c.item.raridade).nome} · iLvl ${c.item.iLvl}`,
        tier,
        som: null,
        somTier: tier,
      };
    }
    case "GACHA_PULLED": {
      const tier = tierDeLenda(melhorRaridade(c.resultados));
      return {
        emoji: "🎰",
        titulo: c.resultados.length > 1 ? `${c.resultados.length}× PUXADAS` : "PUXADA!",
        sub: TIERS_JUICE[tier].nome,
        tier,
        som: null,
        somTier: tier,
      };
    }
    case "MISSION_COMPLETED":
      return { emoji: "✓", titulo: c.texto, sub: `+${c.pp} PP`, tier: 2, som: "missao" };
    case "RIVAL_DECLARED":
      return { emoji: "😤", titulo: "RIVALIDADE!", sub: c.nome, detalhe: "Duas derrotas seguidas pra eles. Hora do troco.", tier: 4, som: "rebaixamento" };
    case "RIVAL_DEFEATED":
      return { emoji: "🏴", titulo: "RIVAL SUPERADO!", sub: c.nome, detalhe: "Você virou o jogo — a rixa acabou.", tier: 4, som: "conquista" };
  }
}

function CerimoniaFullscreen({ c, onFechar }: { c: Cerimonia; onFechar: () => void }) {
  const ap = apresentar(c);
  const [fase, setFase] = useState<Fase>("antecipacao");
  const info = TIERS_JUICE[ap.tier];
  const tAntecipacao = ap.sobrio ? 250 : duracaoAntecipacao(ap.tier);

  useEffect(() => {
    setFase("antecipacao");
    const t1 = setTimeout(() => {
      setFase("revelacao");
      if (ap.somTier) tocarSomTier(ap.somTier);
      else if (ap.som) tocarSom(ap.som);
    }, tAntecipacao);
    const t2 = setTimeout(() => setFase("celebracao"), tAntecipacao + DURACOES.revelacao);
    const t3 = setTimeout(onFechar, ap.sobrio ? 1500 : tAntecipacao + DURACOES.autoDismissFullscreen);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  const revelado = fase !== "antecipacao";

  return (
    <div
      className="fixed inset-0 z-[90] flex cursor-pointer items-center justify-center bg-black/80 px-4"
      onClick={onFechar}
      role="dialog"
      aria-label={ap.titulo}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          alternarMute();
        }}
        className="absolute right-3 top-3 border-2 border-borda bg-painel px-2 py-1 text-[11px] text-suave"
        aria-label="Alternar som"
      >
        {somMutado() ? "🔇" : "🔊"}
      </button>

      <div className="relative flex flex-col items-center gap-3 text-center" onClick={(e) => e.stopPropagation()}>
        {fase === "celebracao" && !ap.sobrio && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <PixelBurst cores={[info.cor, info.brilho, "#ffffff"]} seed={13} />
          </div>
        )}

        <span
          className="text-6xl transition-all"
          style={{
            transform: revelado ? "scale(1)" : "scale(0.4)",
            opacity: revelado ? 1 : 0.4,
            filter: revelado ? `drop-shadow(0 0 18px ${info.cor})` : "none",
            transitionDuration: `${DURACOES.revelacao}ms`,
            transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {ap.emoji}
        </span>

        <h2
          className="font-pixel text-lg transition-opacity"
          style={{ color: revelado ? info.cor : "#9a90c0", opacity: revelado ? 1 : 0.5 }}
        >
          {ap.titulo}
        </h2>

        {revelado && (
          <>
            <p className="font-pixel text-[12px] text-texto">{ap.sub}</p>
            {ap.detalhe && <p className="max-w-xs text-[11px] text-suave">{ap.detalhe}</p>}
            <p className="mt-2 text-[10px] text-suave/70">clique pra continuar</p>
          </>
        )}
      </div>
    </div>
  );
}

function Toast({ c, onFechar }: { c: Cerimonia; onFechar: () => void }) {
  const ap = apresentar(c);
  useEffect(() => {
    if (ap.som) tocarSom(ap.som);
    const t = setTimeout(onFechar, DURACOES.autoDismissToast);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);
  return (
    <button
      type="button"
      onClick={onFechar}
      className="pointer-events-auto flex items-center gap-2 border-2 border-emerald-500/70 bg-painel px-3 py-2 text-left shadow-lg"
    >
      <span className="text-emerald-400">{ap.emoji}</span>
      <span className="text-[11px] text-texto">{ap.titulo}</span>
      <span className="font-pixel text-[10px] text-ciano">{ap.sub}</span>
    </button>
  );
}

export default function CeremonyManager() {
  const fila = useCerimonias((s) => s.fila);
  const toasts = useCerimonias((s) => s.toasts);
  const dispensar = useCerimonias((s) => s.dispensar);
  const removerToast = useCerimonias((s) => s.removerToast);

  const atual = fila[0];
  const chave = `${atual?.tipo}-${fila.length}`;

  // cerimônias especializadas (Fase 1); o resto cai no frame genérico
  let fullscreen: React.ReactNode = null;
  if (atual?.tipo === "ITEM_DROPPED") fullscreen = <CerimoniaDrop key={chave} item={atual.item} onFechar={dispensar} />;
  else if (atual?.tipo === "RANK_PROMOTED") fullscreen = <CerimoniaElo key={chave} de={atual.de} para={atual.para} promocao onFechar={dispensar} />;
  else if (atual?.tipo === "RANK_DEMOTED") fullscreen = <CerimoniaElo key={chave} de={atual.de} para={atual.para} promocao={false} onFechar={dispensar} />;
  else if (atual?.tipo === "PASS_LEVEL_UP")
    fullscreen = <CerimoniaPasse key={chave} de={atual.de} para={atual.para} recompensas={atual.recompensas} onFechar={dispensar} />;
  else if (atual) fullscreen = <CerimoniaFullscreen key={chave} c={atual} onFechar={dispensar} />;

  return (
    <>
      {fullscreen}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col gap-2">
          {toasts.slice(0, 3).map((t, i) => (
            <Toast key={`${t.tipo}-${i}`} c={t} onFechar={() => removerToast(i)} />
          ))}
        </div>
      )}
    </>
  );
}
