"use client";

import { defSub } from "@/data/gacha";
import { efeitoLendas, sinergiasAtivas } from "@/engine/gacha";
import type { CareerState } from "@/engine/types";

// Painel dos efeitos das lendas equipadas (Carreira Booster) + sinergias ativas.
// Mostrado ao começar a partida pra deixar claro que as cartas estão sendo aplicadas.
export default function EfeitosLendas({ career, titulo = "LENDAS EM CAMPO" }: { career: CareerState; titulo?: string }) {
  const ef = efeitoLendas(career);
  const linhas: string[] = [];
  (Object.entries(ef.atributos) as [string, number][]).forEach(([k, v]) => {
    if (v) linhas.push(`${defSub(k)?.rotulo ?? k} +${v}`);
  });
  if (ef.xpMult > 1) linhas.push(`XP +${Math.round((ef.xpMult - 1) * 100)}%`);
  if (ef.dinheiroMult > 1) linhas.push(`Salário +${Math.round((ef.dinheiroMult - 1) * 100)}%`);
  if (ef.reducaoDecaimento > 0) linhas.push(`Anti-decaimento ${Math.round(ef.reducaoDecaimento * 100)}%`);
  if (ef.bonusComp > 0) linhas.push(`Draft +${ef.bonusComp}`);
  const sinergias = sinergiasAtivas(career);
  const n = (career.lendasEquipadas ?? []).length;

  if (linhas.length === 0 && sinergias.length === 0) return null; // nada equipado

  return (
    <div className="border-2 border-ciano/40 bg-ciano/5 p-3">
      <h2 className="mb-2 font-pixel text-[9px] text-ciano">✨ {titulo} ({n}/3)</h2>
      <div className="flex flex-wrap gap-1">
        {linhas.map((t) => (
          <span key={t} className="border border-ciano/40 bg-ciano/10 px-2 py-0.5 text-[10px] text-ciano">
            {t}
          </span>
        ))}
      </div>
      {sinergias.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t-2 border-borda pt-2">
          {sinergias.map((t) => (
            <span key={t} className="border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-300">
              ✦ {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
