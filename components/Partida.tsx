"use client";

import { useEffect, useState } from "react";
import { simularPartida, type ContextoPartida } from "@/engine/simularPartida";
import type { MatchResult, Player } from "@/engine/types";

export default function Partida({
  player,
  ctx,
  icone,
  onFim,
}: {
  player: Player;
  ctx: ContextoPartida;
  icone?: string;
  onFim: (r: MatchResult) => void;
}) {
  const [resultado] = useState<MatchResult>(() =>
    simularPartida(player, ctx, (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0),
  );
  const [linha, setLinha] = useState(0);
  const total = resultado.log.length;

  useEffect(() => {
    if (linha >= total) return;
    const t = setTimeout(() => setLinha((l) => l + 1), 700);
    return () => clearTimeout(t);
  }, [linha, total]);

  const fim = linha >= total;
  const progresso = Math.min(100, (linha / total) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 border-2 border-borda bg-painel p-3">
        {icone && <img src={icone} alt="" width={48} height={48} className="h-12 w-12 border-2 border-rosa" />}
        <div className="flex-1">
          <p className="font-pixel text-[10px] text-ciano">AUTO-BATTLE</p>
          <div className="mt-2 h-2 border-2 border-borda bg-fundo">
            <div className="h-full bg-gradient-to-r from-rosa to-ciano transition-all" style={{ width: `${progresso}%` }} />
          </div>
        </div>
      </div>

      <div className="h-48 overflow-y-auto border-2 border-borda bg-fundo/40 p-3 text-sm">
        {resultado.log.slice(0, linha).map((l, i) => (
          <p key={i} className="mb-1 text-suave">
            {l}
          </p>
        ))}
        {!fim && <p className="text-borda">▌</p>}
      </div>

      {fim && (
        <button
          type="button"
          onClick={() => onFim(resultado)}
          className="border-2 border-ciano bg-ciano/10 px-6 py-3 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          VER RESULTADO
        </button>
      )}
    </div>
  );
}
