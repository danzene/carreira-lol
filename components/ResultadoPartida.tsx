"use client";

import type { ReactNode } from "react";
import { ATRIBUTOS } from "@/data/config";
import type { AtributoKey, MatchResult } from "@/engine/types";
import type { Campeao } from "@/lib/ddragon";

function corNota(n: number): string {
  if (n >= 8) return "text-emerald-400";
  if (n >= 6) return "text-lime-400";
  if (n >= 4) return "text-amber-400";
  return "text-red-400";
}

export default function ResultadoPartida({
  resultado,
  campeao,
  elo,
}: {
  resultado: MatchResult;
  campeao?: Campeao;
  elo: string;
}) {
  const { kda } = resultado;
  const xpEntries = Object.entries(resultado.xpGanho) as [AtributoKey, number][];
  const nomeAtributo = (k: AtributoKey) => ATRIBUTOS.find((a) => a.chave === k)?.nome ?? k;
  const lp = resultado.lpDelta ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-2xl border p-6 text-center ${
          resultado.vitoria ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
        }`}
      >
        <p className={`text-3xl font-black ${resultado.vitoria ? "text-emerald-400" : "text-red-400"}`}>
          {resultado.vitoria ? "VITÓRIA" : "DERROTA"}
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          {campeao && (
            <img
              src={campeao.icone}
              alt={campeao.nome}
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg border border-borda"
            />
          )}
          <span className="text-zinc-300">{campeao?.nome ?? resultado.championId}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Caixa rotulo="Nota">
          <span className={`text-3xl font-black ${corNota(resultado.notaPerformance)}`}>
            {resultado.notaPerformance.toFixed(1)}
          </span>
        </Caixa>
        <Caixa rotulo="KDA">
          <span className="text-lg font-bold text-zinc-100">
            {kda.k}/{kda.d}/{kda.a}
          </span>
        </Caixa>
        <Caixa rotulo="CS/min">
          <span className="text-lg font-bold text-zinc-100">{resultado.csPorMin.toFixed(1)}</span>
        </Caixa>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Caixa rotulo="LP">
          <span className={`text-lg font-bold ${lp >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {lp >= 0 ? "+" : ""}
            {lp}
          </span>
        </Caixa>
        <Caixa rotulo="Elo atual">
          <span className="text-lg font-bold text-zinc-100">{elo}</span>
        </Caixa>
      </div>

      {xpEntries.length > 0 && (
        <div className="rounded-2xl border border-borda bg-painel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">XP ganho</h3>
          <div className="flex flex-wrap gap-2">
            {xpEntries.map(([k, v]) => (
              <span key={k} className="rounded-lg bg-destaque/15 px-2 py-1 text-xs text-destaque2">
                {nomeAtributo(k)} +{v.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Caixa({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-borda bg-painel p-3">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{rotulo}</span>
      {children}
    </div>
  );
}
