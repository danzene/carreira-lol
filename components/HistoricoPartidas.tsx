"use client";

import { useEffect, useState } from "react";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import type { MatchResult } from "@/engine/types";

export default function HistoricoPartidas({ partidas }: { partidas: MatchResult[] }) {
  const [campMap, setCampMap] = useState<Record<string, Campeao>>({});

  useEffect(() => {
    let vivo = true;
    buscarCampeoes()
      .then((cs) => {
        if (!vivo) return;
        const m: Record<string, Campeao> = {};
        for (const c of cs) m[c.id] = c;
        setCampMap(m);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (partidas.length === 0) {
    return (
      <p className="rounded-2xl border border-borda bg-painel p-5 text-center text-sm text-zinc-500">
        Nenhuma partida ainda. Jogue sua primeira soloq! 🎮
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-borda bg-painel p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Últimas partidas</h2>
      <ul className="flex flex-col gap-2">
        {partidas.slice(0, 8).map((p, i) => {
          const c = campMap[p.championId];
          return (
            <li
              key={`${i}-${p.championId}`}
              className="flex items-center gap-3 rounded-lg border border-borda/60 bg-fundo/30 p-2"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${p.vitoria ? "bg-emerald-400" : "bg-red-400"}`} />
              {c ? (
                <img src={c.icone} alt={c.nome} width={32} height={32} className="h-8 w-8 rounded-md" />
              ) : (
                <div className="h-8 w-8 rounded-md bg-borda" />
              )}
              <span className="flex-1 truncate text-sm text-zinc-300">{c?.nome ?? p.championId}</span>
              <span className="text-xs text-zinc-500">
                {p.kda.k}/{p.kda.d}/{p.kda.a}
              </span>
              <span
                className={`w-10 text-right text-sm font-bold ${
                  p.notaPerformance >= 6 ? "text-emerald-400" : p.notaPerformance >= 4 ? "text-amber-400" : "text-red-400"
                }`}
              >
                {p.notaPerformance.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
