"use client";

import { useState } from "react";
import { timeDe } from "@/data/times";
import type { CareerState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

export default function Inbox({ career }: { career: CareerState }) {
  const assinar = useCareer((s) => s.assinarContrato);
  const recusar = useCareer((s) => s.recusarOferta);
  const contra = useCareer((s) => s.contraproposta);
  const [aviso, setAviso] = useState<string | null>(null);

  function fazContra(timeId: string) {
    const aceita = contra(timeId);
    setAviso(aceita ? "Eles toparam o aumento! 🎉" : "Recusaram e retiraram a proposta.");
  }

  if (career.inbox.length === 0) {
    return (
      <p className="border-2 border-borda bg-painel p-5 text-center text-sm text-suave">
        Nenhuma proposta agora. Jogue bem (notas altas) pra subir a reputação e atrair times.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {aviso && <p className="border-2 border-ciano/40 bg-ciano/10 p-2 text-sm text-ciano">{aviso}</p>}
      {career.inbox.map((o) => {
        const t = timeDe(o.timeId);
        return (
          <div key={o.timeId} className="border-2 border-borda bg-painel p-4">
            <div className="flex items-center justify-between">
              <p className="font-pixel text-[10px] text-ciano">{t?.nome ?? o.timeId}</p>
              <span className="border border-rosa/50 bg-rosa/10 px-2 py-0.5 text-[10px] text-rosa">{o.tier}</span>
            </div>
            <p className="mt-2 text-xs text-suave">
              Salário ${o.salarioSemanal}/sem · bônus por vitória ${o.bonusPorVitoria} · {o.duracaoSemanas} semanas
              {o.condicao === "negociada" ? " · (negociada)" : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => assinar(o.timeId)}
                className="border-2 border-ciano bg-ciano/10 px-3 py-1.5 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo"
              >
                Assinar
              </button>
              {o.condicao !== "negociada" && (
                <button
                  type="button"
                  onClick={() => fazContra(o.timeId)}
                  className="border-2 border-borda px-3 py-1.5 font-pixel text-[10px] text-suave transition hover:text-texto"
                >
                  Contrapropor
                </button>
              )}
              <button
                type="button"
                onClick={() => recusar(o.timeId)}
                className="border-2 border-borda px-3 py-1.5 font-pixel text-[10px] text-suave transition hover:text-rosa"
              >
                Recusar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
