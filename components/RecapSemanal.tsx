"use client";

import { useState } from "react";
import { RARIDADES_ITEM } from "@/data/itens";
import { tocarSom } from "@/lib/som";
import type { RecapSemanal as Recap } from "@/store/careerStore";
import AnimatedNumber from "./juice/AnimatedNumber";

// 📊 Recap "wrapped" da semana: sequência de cards animados ANTES do resumo da semana.
// Dados vêm do statsSemana acumulado no engine (puro). CONTINUAR avança; nunca trava.

function Seta({ atual, anterior }: { atual: number; anterior: number }) {
  if (atual === anterior) return <span className="text-suave">•</span>;
  return atual > anterior ? <span className="text-emerald-400">↑</span> : <span className="text-rosa">↓</span>;
}

export default function RecapSemanal({ recap, onFechar }: { recap: Recap; onFechar: () => void }) {
  const [idx, setIdx] = useState(0);
  const { atual, anterior } = recap;
  const derrotas = atual.partidas - atual.vitorias;
  const totalDrops = Object.values(atual.dropsPorRaridade).reduce((a, b) => a + b, 0);

  // monta os cards (pula os vazios pra não mostrar tela morta)
  const cards: { titulo: string; corpo: React.ReactNode }[] = [];

  cards.push({
    titulo: "SUA SEMANA EM NÚMEROS",
    corpo: (
      <div className="flex flex-col items-center gap-2">
        <p className="font-pixel text-4xl text-ciano">
          <AnimatedNumber valor={atual.partidas} deZero />
        </p>
        <p className="text-[12px] text-suave">partidas jogadas</p>
        <p className="text-[13px] text-texto">
          <span className="text-emerald-400">{atual.vitorias}V</span> · <span className="text-rosa">{derrotas}D</span>{" "}
          <Seta atual={atual.vitorias} anterior={anterior.vitorias} />
        </p>
        {anterior.partidas > 0 && (
          <p className="text-[10px] text-suave">semana passada: {anterior.partidas} partidas · {anterior.vitorias}V</p>
        )}
      </div>
    ),
  });

  if (atual.melhorKda) {
    cards.push({
      titulo: "SEU MELHOR MOMENTO",
      corpo: (
        <div className="flex flex-col items-center gap-2">
          <p className="font-pixel text-3xl text-texto">
            {atual.melhorKda.k}/{atual.melhorKda.d}/{atual.melhorKda.a}
          </p>
          <p className="text-[12px] text-suave">melhor KDA da semana</p>
          <p className="font-pixel text-sm text-amber-300">nota {atual.melhorNota.toFixed(1)}</p>
        </div>
      ),
    });
  }

  cards.push({
    titulo: "PDL LÍQUIDO",
    corpo: (
      <div className="flex flex-col items-center gap-2">
        <p className={`font-pixel text-4xl ${atual.lpLiquido >= 0 ? "text-ciano" : "text-rosa"}`}>
          {atual.lpLiquido >= 0 ? "+" : ""}
          <AnimatedNumber valor={atual.lpLiquido} deZero />
        </p>
        <p className="text-[12px] text-suave">
          na soloq <Seta atual={atual.lpLiquido} anterior={anterior.lpLiquido} />
        </p>
        {anterior.partidas > 0 && (
          <p className="text-[10px] text-suave">
            semana passada: {anterior.lpLiquido >= 0 ? "+" : ""}
            {anterior.lpLiquido}
          </p>
        )}
      </div>
    ),
  });

  if (totalDrops > 0) {
    cards.push({
      titulo: "LOOT DA SEMANA",
      corpo: (
        <div className="flex flex-col items-center gap-2">
          <p className="font-pixel text-4xl text-texto">🎒 {totalDrops}</p>
          <p className="text-[12px] text-suave">itens dropados</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {RARIDADES_ITEM.filter((r) => (atual.dropsPorRaridade[r.n] ?? 0) > 0).map((r) => (
              <span key={r.n} className="border-2 px-2 py-0.5 text-[10px]" style={{ borderColor: r.cor, color: r.cor }}>
                {r.nome} ×{atual.dropsPorRaridade[r.n]}
              </span>
            ))}
          </div>
        </div>
      ),
    });
  }

  const ultimo = idx >= cards.length - 1;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 px-4" onClick={onFechar} role="dialog" aria-label="Recap da semana">
      <div
        className="flex w-full max-w-sm flex-col gap-4 border-2 border-rosa bg-fundo p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center font-pixel text-[10px] text-suave">
          RECAP · TEMP {recap.temporada} · SEMANA {recap.semana}
        </p>

        <div key={idx} className="desliza-cima flex min-h-[170px] flex-col items-center justify-center gap-2 border-2 border-borda bg-painel p-5">
          <p className="font-pixel text-[11px] text-rosa">{cards[idx].titulo}</p>
          {cards[idx].corpo}
        </div>

        {/* pontinhos de progresso */}
        <div className="flex justify-center gap-1.5">
          {cards.map((_, i) => (
            <span key={i} className={`h-2 w-2 ${i === idx ? "bg-ciano" : "bg-borda"}`} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (ultimo) onFechar();
            else {
              tocarSom("tick");
              setIdx(idx + 1);
            }
          }}
          className="w-full border-2 border-ciano py-2 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          {ultimo ? "CONTINUAR ▸" : "PRÓXIMO ▸"}
        </button>
      </div>
    </div>
  );
}
