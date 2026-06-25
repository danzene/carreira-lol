"use client";

import { useEffect, useState } from "react";
import { ATRIBUTOS, NACIONALIDADES, ROTAS, TRACOS } from "@/data/config";
import { timeDe } from "@/data/times";
import { energiaAgora } from "@/engine/tempo";
import IconeRota from "./IconeRota";
import ProgressaoElo from "./ProgressaoElo";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import type { CareerState, TraitId } from "@/engine/types";
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
  const nomeTraco = (id: TraitId) => TRACOS.find((t) => t.id === id)?.nome ?? id;

  return (
    <div className="flex flex-col gap-4">
      {/* cabeçalho */}
      <div className="border-2 border-borda bg-painel p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="font-pixel text-base text-texto">{player.nome}</span>
            <span className="mt-1 text-xs text-suave">
              {nac?.bandeira} {player.nacionalidade} · {player.idade} anos
            </span>
            <span className="mt-0.5 text-[11px] text-ciano">
              {career.contratoAtual ? (timeDe(career.contratoAtual.timeId)?.nome ?? career.contratoAtual.timeId) : "Sem time (agente livre)"}
            </span>
            {(career.opcoes?.esconderAtributos || career.opcoes?.fearless) && (
              <span className="mt-0.5 text-[10px] text-suave">
                {career.opcoes?.esconderAtributos ? "🙈 Imersão" : ""}
                {career.opcoes?.esconderAtributos && career.opcoes?.fearless ? " · " : ""}
                {career.opcoes?.fearless ? "⚔️ Fearless" : ""}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <IconeRota rota={player.rota} className="h-8 w-8 text-ciano" />
            <span className="font-pixel text-[8px] text-suave">{rota?.nome}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat rotulo="Reputação" valor={`${player.reputacao}`} />
          <Stat rotulo="Dinheiro" valor={`$${career.dinheiro}`} />
          <Stat rotulo="Tier" valor={career.tierAtual} sub={`Temp. ${career.temporada} · Sem. ${career.semanaAtual}`} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Medidor rotulo="Energia" valor={energiaAgora(career, Date.now())} />
          <Medidor rotulo="Moral" valor={player.moral} />
        </div>
      </div>

      {/* progressão de elo */}
      <ProgressaoElo rank={player.rankSoloq} />

      {/* traços */}
      <div className="border-2 border-borda bg-painel p-5">
        <h2 className="mb-3 font-pixel text-[10px] text-suave">TRAÇOS</h2>
        <div className="flex flex-wrap gap-2">
          {player.tracos.map((t) => (
            <span key={t} className="border-2 border-ciano/50 bg-ciano/10 px-2 py-1 text-xs text-ciano">
              {nomeTraco(t)}
            </span>
          ))}
        </div>
      </div>

      {/* atributos */}
      <div className="border-2 border-borda bg-painel p-5">
        <h2 className="mb-3 font-pixel text-[10px] text-suave">ATRIBUTOS</h2>
        <div className="flex flex-col gap-2.5">
          {ATRIBUTOS.map((a) => (
            <BarraAtributo
              key={a.chave}
              nome={a.nome}
              valor={player.atributos[a.chave]}
              esconder={career.opcoes?.esconderAtributos}
            />
          ))}
        </div>
      </div>

      {/* pool */}
      <div className="border-2 border-borda bg-painel p-5">
        <h2 className="mb-3 font-pixel text-[10px] text-suave">CHAMPION POOL</h2>
        <div className="flex flex-wrap gap-3">
          {[...player.pool]
            .sort((a, b) => b.pontos - a.pontos)
            .slice(0, 12)
            .map((m) => {
            const c = campMap[m.championId];
            return (
              <div key={m.championId} className="flex w-16 flex-col items-center gap-1">
                {c ? (
                  <img src={c.icone} alt={c.nome} width={56} height={56} className="h-14 w-14 border-2 border-borda" />
                ) : (
                  <div className="h-14 w-14 animate-pulse border-2 border-borda bg-borda" />
                )}
                <span className="w-full truncate text-center text-[11px] text-suave">{c?.nome ?? m.championId}</span>
                <span className="font-pixel text-[8px] text-borda">M{Math.round(m.pontos)}</span>
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
    <div className="border-2 border-borda bg-fundo/40 px-3 py-2">
      <p className="font-pixel text-[8px] text-suave">{rotulo}</p>
      <p className="mt-1 text-sm font-bold text-texto">{valor}</p>
      {sub && <p className="text-[10px] text-suave">{sub}</p>}
    </div>
  );
}

function Medidor({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-suave">{rotulo}</span>
        <span className="text-texto">{Math.round(valor)}</span>
      </div>
      <div className="h-2.5 border-2 border-borda bg-fundo">
        <div className="h-full bg-gradient-to-r from-rosa to-ciano" style={{ width: `${valor}%` }} />
      </div>
    </div>
  );
}
