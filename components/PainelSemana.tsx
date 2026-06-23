"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ATRIBUTOS } from "@/data/config";
import { LOOP } from "@/data/loop";
import { tempoAteProxima } from "@/engine/energia";
import type { AtributoKey, CareerState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

export default function PainelSemana({ career }: { career: CareerState }) {
  const treinar = useCareer((s) => s.treinar);
  const avancarSemana = useCareer((s) => s.avancarSemana);
  const sincronizarEnergia = useCareer((s) => s.sincronizarEnergia);
  const [abrirTreino, setAbrirTreino] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // tick de 1s: regenera a energia em tempo real e atualiza a contagem
  useEffect(() => {
    const id = setInterval(() => {
      sincronizarEnergia();
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [sincronizarEnergia]);

  const energia = career.player.energia;
  const podeSoloq = energia >= LOOP.custoSoloq;
  const podeTreinar = energia >= LOOP.custoTreino;

  const restanteMs = tempoAteProxima(career);
  const mm = Math.floor(restanteMs / 60000);
  const ss = Math.floor((restanteMs % 60000) / 1000);

  function fazerTreino(k: AtributoKey) {
    if (!treinar(k)) {
      setAviso("Sem energia para treinar. Avance a semana para recuperar.");
      return;
    }
    setAviso(null);
  }

  return (
    <div className="rounded-2xl border border-borda bg-painel p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Temporada {career.temporada} · Semana {career.semanaAtual}
      </h2>

      {/* energia */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-zinc-400">Energia</span>
          <span className="text-zinc-300">
            {Math.round(energia)}/100
            {energia < LOOP.energiaMax && (
              <span className="ml-2 text-zinc-500">
                +1 em {mm}:{String(ss).padStart(2, "0")}
              </span>
            )}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-borda">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
            style={{ width: `${energia}%` }}
          />
        </div>
      </div>

      {/* ações da semana */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={podeSoloq ? "/soloq" : "#"}
          aria-disabled={!podeSoloq}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-3 text-sm font-semibold transition ${
            podeSoloq ? "bg-destaque text-white hover:bg-violet-600" : "pointer-events-none bg-borda text-zinc-600"
          }`}
        >
          🎮 Jogar Soloq
          <span className="text-[10px] font-normal opacity-80">−{LOOP.custoSoloq} energia</span>
        </Link>

        <button
          type="button"
          onClick={() => setAbrirTreino((v) => !v)}
          disabled={!podeTreinar}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-3 text-sm font-semibold transition ${
            podeTreinar ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700" : "bg-borda text-zinc-600"
          }`}
        >
          🏋️ Treinar
          <span className="text-[10px] font-normal opacity-80">−{LOOP.custoTreino} energia</span>
        </button>
      </div>

      {abrirTreino && (
        <div className="mt-3 rounded-xl border border-borda bg-fundo/40 p-3">
          <p className="mb-2 text-xs text-zinc-500">Treinar um atributo (+{LOOP.ganhoTreino} cada):</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ATRIBUTOS.map((a) => (
              <button
                key={a.chave}
                type="button"
                onClick={() => fazerTreino(a.chave)}
                disabled={energia < LOOP.custoTreino}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-borda bg-painel p-2 text-center transition hover:border-destaque disabled:opacity-40"
              >
                <span className="text-xs text-zinc-200">{a.nome}</span>
                <span className="text-[11px] font-bold text-destaque2">{Math.round(career.player.atributos[a.chave])}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {aviso && <p className="mt-2 text-xs text-amber-400">{aviso}</p>}

      {/* avanço de tempo */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-borda pt-4">
        <button
          type="button"
          onClick={() => {
            avancarSemana("normal");
            setAviso(null);
          }}
          className="rounded-xl bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
        >
          ⏭️ Avançar semana
        </button>
        <button
          type="button"
          onClick={() => {
            avancarSemana("descanso");
            setAviso(null);
          }}
          className="rounded-xl bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
        >
          😴 Descansar a semana
        </button>
      </div>

      <Link
        href="/loja"
        className="mt-2 block rounded-xl border border-borda bg-fundo/40 px-3 py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:border-destaque"
      >
        💰 Loja de investimentos
      </Link>
    </div>
  );
}
