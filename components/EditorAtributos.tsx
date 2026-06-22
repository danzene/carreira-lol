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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-borda bg-painel px-4 py-3">
        <span className="text-sm text-zinc-400">Pontos para distribuir</span>
        <span className={`text-xl font-bold ${restantes === 0 ? "text-emerald-400" : "text-destaque2"}`}>
          {restantes}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {ATRIBUTOS.map((a) => {
          const valor = atributos[a.chave];
          return (
            <div key={a.chave} className="rounded-xl border border-borda bg-painel p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">{a.nome}</p>
                  <p className="truncate text-xs text-zinc-500">{a.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ajustar(a.chave, -CRIACAO.passo)}
                    disabled={valor <= CRIACAO.atributoBase}
                    className="h-8 w-8 rounded-lg bg-borda text-lg font-bold text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-bold text-zinc-100">{valor}</span>
                  <button
                    type="button"
                    onClick={() => ajustar(a.chave, CRIACAO.passo)}
                    disabled={valor >= CRIACAO.tetoNaCriacao || restantes <= 0}
                    className="h-8 w-8 rounded-lg bg-destaque/80 text-lg font-bold text-white transition hover:bg-destaque disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-borda">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-destaque to-destaque2 transition-all"
                  style={{ width: `${valor}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
