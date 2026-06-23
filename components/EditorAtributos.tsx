"use client";

import { ATRIBUTOS, CRIACAO } from "@/data/config";
import { pontosRestantes } from "@/engine/player";
import type { Attributes, AtributoKey } from "@/engine/types";

export default function EditorAtributos({
  atributos,
  onChange,
}: {
  atributos: Attributes;
  onChange: (a: Attributes) => void;
}) {
  const restantes = pontosRestantes(atributos);

  function ajustar(chave: AtributoKey, delta: number) {
    const novo = atributos[chave] + delta;
    if (novo < CRIACAO.atributoBase || novo > CRIACAO.tetoNaCriacao) return;
    if (delta > 0 && restantes <= 0) return;
    onChange({ ...atributos, [chave]: novo });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between border-2 border-borda bg-painel px-3 py-2">
        <span className="text-sm text-suave">Pontos para distribuir</span>
        <span className={`font-pixel text-sm ${restantes === 0 ? "text-ciano" : "text-rosa"}`}>{restantes}</span>
      </div>

      {ATRIBUTOS.map((a) => {
        const valor = atributos[a.chave];
        return (
          <div key={a.chave} className="border-2 border-borda bg-painel p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-texto">{a.nome}</p>
                <p className="truncate text-xs text-suave">{a.desc}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => ajustar(a.chave, -CRIACAO.passo)}
                  disabled={valor <= CRIACAO.atributoBase}
                  className="h-8 w-8 border-2 border-borda font-pixel text-xs text-suave transition hover:border-suave disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-8 text-center font-pixel text-xs text-texto">{valor}</span>
                <button
                  type="button"
                  onClick={() => ajustar(a.chave, CRIACAO.passo)}
                  disabled={valor >= CRIACAO.tetoNaCriacao || restantes <= 0}
                  className="h-8 w-8 border-2 border-rosa font-pixel text-xs text-rosa transition hover:bg-rosa hover:text-fundo disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-2 h-2 border border-borda bg-fundo">
              <div className="h-full bg-gradient-to-r from-rosa to-ciano" style={{ width: `${valor}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
