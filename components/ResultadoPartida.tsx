"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ATRIBUTOS } from "@/data/config";
import { GACHA } from "@/data/gacha";
import type { Attributes, AtributoKey, MatchResult } from "@/engine/types";
import AnimatedNumber from "./juice/AnimatedNumber";

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
  atributos,
}: {
  resultado: MatchResult;
  icone?: string;
  elo: string;
  atributos?: Attributes;
}) {
  const xpEntries = Object.entries(resultado.xpGanho) as [AtributoKey, number][];
  const nomeAtr = (k: AtributoKey) => ATRIBUTOS.find((a) => a.chave === k)?.nome ?? k;
  const lp = resultado.lpDelta ?? 0;
  const scoutGanho = resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota;

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
            <AnimatedNumber valor={lp} deZero />
          </span>
        </Caixa>
        <Caixa rotulo="ELO">
          <span className="font-pixel text-sm text-texto">{elo}</span>
        </Caixa>
      </div>

      <div className="flex items-center justify-center gap-2 border-2 border-rosa/40 bg-rosa/5 py-2 text-sm text-rosa">
        🪙 CoinPoints <span className="font-pixel">+{scoutGanho}</span>
      </div>

      {xpEntries.length > 0 && (
        <div className="border-2 border-borda bg-painel p-3">
          <h3 className="mb-3 font-pixel text-[11px] text-suave">PROGRESSO DOS ATRIBUTOS</h3>
          <div className="flex flex-col gap-2.5">
            {xpEntries.map(([k, v]) => (
              <BarraXp key={k} nome={nomeAtr(k)} valor={atributos?.[k] ?? v} ganho={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Barra do atributo que "sobe" do valor anterior pro novo (sensação de progressão).
function BarraXp({ nome, valor, ganho }: { nome: string; valor: number; ganho: number }) {
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCheio(true), 90);
    return () => clearTimeout(t);
  }, []);
  const de = Math.max(0, valor - ganho);
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between text-[11px]">
        <span className="text-suave">{nome}</span>
        <span className="text-texto">
          {Math.round(valor * 10) / 10} <span className="font-pixel text-[10px] text-emerald-400">+{ganho.toFixed(2)}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden border-2 border-borda bg-fundo">
        <div
          className="h-full bg-gradient-to-r from-rosa to-ciano transition-[width] duration-700 ease-out"
          style={{ width: `${cheio ? valor : de}%` }}
        />
      </div>
    </div>
  );
}

function Caixa({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 border-2 border-borda bg-painel p-3">
      <span className="font-pixel text-[10px] text-suave">{rotulo}</span>
      {children}
    </div>
  );
}
