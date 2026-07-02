"use client";

import { TRACOS } from "@/data/config";
import type { TraitId } from "@/engine/types";

export default function SeletorTraco({
  selecionado,
  onChange,
}: {
  selecionado: TraitId | null;
  onChange: (t: TraitId) => void;
}) {
  const opcoes = TRACOS.filter((t) => t.inicial);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-suave">Escolha 1 traço inicial — ele define seu estilo de jogo:</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {opcoes.map((t) => {
          const sel = selecionado === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`border-2 p-3 text-left transition ${
                sel ? "border-rosa bg-rosa/10" : "border-borda bg-painel hover:border-suave"
              }`}
            >
              <p className="font-pixel text-[11px] text-ciano">{t.nome}</p>
              <p className="mt-1.5 text-xs text-suave">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
