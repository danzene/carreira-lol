"use client";

import { useMemo, useState } from "react";
import { gerarRoteiro } from "@/engine/batalha";
import { simularPartida, type ContextoPartida } from "@/engine/simularPartida";
import type { MatchResult, Player } from "@/engine/types";
import BatalhaCanvas from "./BatalhaCanvas";
import type { LutadorInfo } from "./DraftBoard";

export default function Partida({
  player,
  ctx,
  times,
  onFim,
}: {
  player: Player;
  ctx: ContextoPartida;
  times: { azul: LutadorInfo[]; vermelho: LutadorInfo[] };
  onFim: (r: MatchResult) => void;
}) {
  const [seed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  const [resultado] = useState<MatchResult>(() => simularPartida(player, ctx, seed));
  const [pronto, setPronto] = useState(false);

  const roteiro = useMemo(
    () =>
      gerarRoteiro({
        vitoria: resultado.vitoria,
        kda: resultado.kda,
        nota: resultado.notaPerformance,
        rotaVoce: player.rota,
        timeAzul: times.azul.map((l) => ({ championId: l.championId, rota: l.rota })),
        timeVermelho: times.vermelho.map((l) => ({ championId: l.championId, rota: l.rota })),
        vantagem: ctx.comp - ctx.compInimigo,
        seed,
      }),
    [resultado, player.rota, times, ctx.comp, ctx.compInimigo, seed],
  );

  const iconePorId = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const l of times.azul) m[`azul-${l.rota}`] = l.icone;
    for (const l of times.vermelho) m[`vermelho-${l.rota}`] = l.icone;
    return m;
  }, [times]);

  return (
    <div className="flex flex-col gap-3">
      <BatalhaCanvas roteiro={roteiro} iconePorId={iconePorId} aoTerminar={() => setPronto(true)} />
      {pronto ? (
        <button
          type="button"
          onClick={() => onFim(resultado)}
          className="border-2 border-ciano bg-ciano/10 px-6 py-3 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          VER RESULTADO
        </button>
      ) : (
        <p className="text-center text-[11px] text-suave">A partida está rolando — acompanhe o auto-battle.</p>
      )}
    </div>
  );
}
