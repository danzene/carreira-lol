"use client";

import { useEffect, useState } from "react";
import type { MatchResult } from "@/engine/types";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";

export default function HistoricoPartidas({ partidas }: { partidas: MatchResult[] }) {
  const [map, setMap] = useState<Record<string, Campeao>>({});

  useEffect(() => {
    let vivo = true;
    buscarCampeoes()
      .then((cs) => {
        if (!vivo) return;
        const m: Record<string, Campeao> = {};
        for (const c of cs) m[c.id] = c;
        setMap(m);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const ult = partidas.slice(0, 5);
  if (ult.length === 0) return null;

  return (
    <div className="border-2 border-borda bg-painel p-4">
      <h2 className="mb-3 font-pixel text-[11px] text-suave">ÚLTIMAS PARTIDAS</h2>
      <div className="flex flex-col gap-1.5">
        {ult.map((m, i) => {
          const c = map[m.championId];
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`w-4 text-center font-pixel text-[10px] ${m.vitoria ? "text-ciano" : "text-rosa"}`}>
                {m.vitoria ? "V" : "D"}
              </span>
              {c ? (
                <img src={c.icone} alt="" width={24} height={24} className="h-6 w-6 border border-borda" />
              ) : (
                <div className="h-6 w-6 border border-borda bg-borda" />
              )}
              <span className="flex-1 truncate text-suave">{c?.nome ?? m.championId}</span>
              <span className="text-texto">
                {m.kda.k}/{m.kda.d}/{m.kda.a}
              </span>
              <span
                className={`w-8 text-right font-pixel text-[10px] ${
                  m.notaPerformance >= 7 ? "text-ciano" : m.notaPerformance >= 5 ? "text-texto" : "text-rosa"
                }`}
              >
                {m.notaPerformance.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
