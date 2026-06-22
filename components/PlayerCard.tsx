"use client";

import { useEffect, useState } from "react";
import { ATRIBUTOS, NACIONALIDADES, ROTAS } from "@/data/config";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import type { CareerState } from "@/engine/types";
import BarraAtributo from "./BarraAtributo";

export default function PlayerCard({ career }: { career: CareerState }) {
  const { player } = career;
  const [campMap, setCampMap] = useState<Record<string, Campeao>>({});

  useEffect(() => {
    let vivo = true;
    buscarCampeoes()
      .then((cs) => {
        if (!vivo) return;
        const m: Record<string, Campeao> = {};
        for (const c of cs) m[c.id] = c;
        setCampMap(m);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const nac = NACIONALIDADES.find((n) => n.nome === player.nacionalidade);
  const rota = ROTAS.find((r) => r.chave === player.rota);

  return (
    <div className="flex flex-col gap-5">
      {/* cabeçalho do jogador */}
      <div className="relative overflow-hidden rounded-2xl border border-borda bg-painel p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-destaque/10 blur-2xl"
        />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-2xl font-black text-zinc-100">{player.nome}</span>
            <span className="text-sm text-zinc-400">
              {nac?.bandeira} {player.nacionalidade} · {player.idade} anos
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-3xl">{rota?.emoji}</span>
            <span className="text-xs uppercase tracking-wider text-zinc-500">{rota?.nome}</span>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat rotulo="Rank" valor={player.rankSoloq.elo} sub={`${player.rankSoloq.lp} PDL`} />
          <Stat rotulo="Reputação" valor={`${player.reputacao}`} />
          <Stat rotulo="Dinheiro" valor={`$${career.dinheiro}`} />
          <Stat rotulo="Temporada" valor={`${career.temporada}`} sub={`Semana ${career.semanaAtual}`} />
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-3">
          <Medidor rotulo="Energia" valor={player.energia} cor="from-emerald-500 to-emerald-300" />
          <Medidor rotulo="Moral" valor={player.moral} cor="from-amber-500 to-amber-300" />
        </div>
      </div>

      {/* atributos */}
      <div className="rounded-2xl border border-borda bg-painel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Atributos</h2>
        <div className="flex flex-col gap-2.5">
          {ATRIBUTOS.map((a) => (
            <BarraAtributo key={a.chave} nome={a.nome} valor={player.atributos[a.chave]} />
          ))}
        </div>
      </div>

      {/* champion pool */}
      <div className="rounded-2xl border border-borda bg-painel p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Champion Pool</h2>
        <div className="flex flex-wrap gap-3">
          {player.pool.map((m) => {
            const c = campMap[m.championId];
            return (
              <div key={m.championId} className="flex w-16 flex-col items-center gap-1">
                {c ? (
                  <img
                    src={c.icone}
                    alt={c.nome}
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-lg border border-borda"
                  />
                ) : (
                  <div className="h-14 w-14 animate-pulse rounded-lg border border-borda bg-borda" />
                )}
                <span className="w-full truncate text-center text-[11px] text-zinc-300">
                  {c?.nome ?? m.championId}
                </span>
                <span className="text-[10px] text-zinc-600">Maestria {m.pontos}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-fundo/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{rotulo}</p>
      <p className="text-sm font-bold text-zinc-100">{valor}</p>
      {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}

function Medidor({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-zinc-400">{rotulo}</span>
        <span className="text-zinc-300">{Math.round(valor)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-borda">
        <div className={`h-full rounded-full bg-gradient-to-r ${cor}`} style={{ width: `${valor}%` }} />
      </div>
    </div>
  );
}
