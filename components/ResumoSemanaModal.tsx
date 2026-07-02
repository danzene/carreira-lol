"use client";

import type { ResumoSemana } from "@/store/careerStore";

export default function ResumoSemanaModal({ resumo, onFechar }: { resumo: ResumoSemana; onFechar: () => void }) {
  const nada =
    resumo.novasPropostas === 0 && !resumo.eventoNovo && !resumo.patchNovo && !resumo.acontecimento && resumo.conquistas.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/80 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm border-2 border-ciano bg-painel p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-pixel text-sm text-ciano">{resumo.viradaTemporada ? "NOVA TEMPORADA! 🎉" : "RESUMO DA SEMANA"}</h2>
        <p className="mt-1 text-[11px] text-suave">
          Temporada {resumo.temporada} · Semana {resumo.semana}
        </p>

        <div className="mt-3 flex flex-col gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-suave">💵 Caixa</span>
            <span className={resumo.dinheiroDelta >= 0 ? "text-ciano" : "text-rosa"}>
              {resumo.dinheiroDelta >= 0 ? "+" : ""}${resumo.dinheiroDelta}
            </span>
          </div>
          {resumo.novasPropostas > 0 && (
            <div className="flex justify-between">
              <span className="text-suave">📨 Novas propostas</span>
              <span className="text-ciano">+{resumo.novasPropostas}</span>
            </div>
          )}
          {resumo.patchNovo && (
            <div className="flex justify-between">
              <span className="text-suave">🧪 Novo patch</span>
              <span className="text-texto">25.{resumo.patchNovo}</span>
            </div>
          )}
          {resumo.eventoNovo && (
            <div className="flex justify-between">
              <span className="text-suave">⭐ Evento</span>
              <span className="text-amber-300">{resumo.eventoNovo}</span>
            </div>
          )}
          {resumo.acontecimento && <p className="text-suave">{resumo.acontecimento}</p>}
          {resumo.conquistas.map((c) => (
            <p key={c} className="text-amber-300">🏅 Conquista: {c}</p>
          ))}
          {nada && <p className="text-suave">Semana tranquila. Hora de treinar.</p>}
        </div>

        <button
          type="button"
          onClick={onFechar}
          className="mt-4 w-full border-2 border-ciano bg-ciano/10 py-2 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          CONTINUAR
        </button>
      </div>
    </div>
  );
}
