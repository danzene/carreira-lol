"use client";

import { type ReactNode } from "react";
import { ATRIBUTOS } from "@/data/config";
import type { AtributoKey, MatchResult } from "@/engine/types";

function corNota(n: number): string {
  if (n >= 8) return "text-ciano";
  if (n >= 6) return "text-emerald-400";
  if (n >= 4) return "text-amber-400";
  return "text-rosa";
}

export default function ResultadoPartida({
  resultado,
  icone,
  elo,
}: {
  resultado: MatchResult;
  icone?: string;
  elo: string;
}) {
  const xpEntries = Object.entries(resultado.xpGanho) as [AtributoKey, number][];
  const nomeAtr = (k: AtributoKey) => ATRIBUTOS.find((a) => a.chave === k)?.nome ?? k;
  const lp = resultado.lpDelta ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className={`border-2 p-5 text-center ${resultado.vitoria ? "border-ciano bg-ciano/10" : "border-rosa bg-rosa/10"}`}>
        <p className={`font-pixel text-xl ${resultado.vitoria ? "text-ciano" : "text-rosa"}`}>
          {resultado.vitoria ? "VITÓRIA" : "DERROTA"}
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {icone && <img src={icone} alt="" width={40} height={40} className="h-10 w-10 border-2 border-borda" />}
          <span className="text-suave">{resultado.championId}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Caixa rotulo="NOTA">
          <span className={`font-pixel text-xl ${corNota(resultado.notaPerformance)}`}>
            {resultado.notaPerformance.toFixed(1)}
          </span>
        </Caixa>
        <Caixa rotulo="KDA">
          <span className="font-pixel text-sm text-texto">
            {resultado.kda.k}/{resultado.kda.d}/{resultado.kda.a}
          </span>
        </Caixa>
        <Caixa rotulo="CS/MIN">
          <span className="font-pixel text-sm text-texto">{resultado.csPorMin.toFixed(1)}</span>
        </Caixa>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Caixa rotulo="LP">
          <span className={`font-pixel text-sm ${lp >= 0 ? "text-ciano" : "text-rosa"}`}>
            {lp >= 0 ? "+" : ""}
            {lp}
          </span>
        </Caixa>
        <Caixa rotulo="ELO">
          <span className="font-pixel text-sm text-texto">{elo}</span>
        </Caixa>
      </div>

      {xpEntries.length > 0 && (
        <div className="border-2 border-borda bg-painel p-3">
          <h3 className="mb-2 font-pixel text-[10px] text-suave">XP GANHO</h3>
          <div className="flex flex-wrap gap-2">
            {xpEntries.map(([k, v]) => (
              <span key={k} className="border border-ciano/40 bg-ciano/10 px-2 py-0.5 text-[11px] text-ciano">
                {nomeAtr(k)} +{v.toFixed(2)}
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
    <div className="flex flex-col items-center gap-1 border-2 border-borda bg-painel p-3">
      <span className="font-pixel text-[8px] text-suave">{rotulo}</span>
      {children}
    </div>
  );
}
