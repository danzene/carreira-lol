"use client";

import { VOCE } from "@/data/liga";
import { timeDe } from "@/data/times";
import { ordenarClassificacao } from "@/engine/liga";
import type { LigaState } from "@/engine/types";

export default function TabelaLiga({ liga }: { liga: LigaState }) {
  const ordenada = ordenarClassificacao(liga);
  return (
    <div className="border-2 border-borda bg-painel">
      <div className="grid grid-cols-[28px_1fr_32px_32px] gap-1 border-b-2 border-borda px-3 py-2 font-pixel text-[10px] text-suave">
        <span>#</span>
        <span>TIME</span>
        <span className="text-center">V</span>
        <span className="text-center">D</span>
      </div>
      {ordenada.map((c, i) => {
        const sou = c.timeId === VOCE;
        const nome = sou ? "VOCÊ" : timeDe(c.timeId)?.nome ?? c.timeId;
        return (
          <div
            key={c.timeId}
            className={`grid grid-cols-[28px_1fr_32px_32px] items-center gap-1 px-3 py-2 text-xs ${sou ? "bg-rosa/10" : ""}`}
          >
            <span className={`font-pixel text-[11px] ${i < 4 ? "text-ciano" : "text-suave"}`}>{i + 1}</span>
            <span className={sou ? "text-rosa" : "text-texto"}>{nome}</span>
            <span className="text-center text-texto">{c.vitorias}</span>
            <span className="text-center text-suave">{c.derrotas}</span>
          </div>
        );
      })}
      <p className="border-t-2 border-borda px-3 py-1.5 text-[11px] text-suave">Top 4 (ciano) vão aos playoffs.</p>
    </div>
  );
}
