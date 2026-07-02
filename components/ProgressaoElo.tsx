"use client";

import { TOTAL_ELOS, infoElo, proximoElo, trilhaElos } from "@/data/elo";
import type { RankSoloq } from "@/engine/types";

function Emblema({ cor, rotulo, tamanho = 64 }: { cor: string; rotulo: string; tamanho?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: tamanho,
        height: tamanho,
        borderColor: cor,
        borderStyle: "solid",
        borderWidth: tamanho >= 40 ? 4 : 2,
        background: `radial-gradient(circle at 32% 26%, ${cor}66, #0b0617 78%)`,
      }}
    >
      <span className="font-pixel" style={{ color: cor, textShadow: `0 0 6px ${cor}`, fontSize: tamanho * 0.28 }}>
        {rotulo}
      </span>
    </div>
  );
}

export default function ProgressaoElo({ rank }: { rank: RankSoloq }) {
  const { divisao, cor, idx } = infoElo(rank.elo);
  const prox = proximoElo(rank.elo);
  const topo = !prox;
  const lp = Math.max(0, Math.min(100, Math.round(rank.lp)));
  const faltam = Math.max(0, 100 - lp);
  const trilha = trilhaElos(rank.elo, 5);
  const progressoGeral = Math.round((idx / (TOTAL_ELOS - 1)) * 100);
  const rotuloEmblema = topo ? "👑" : divisao || "★";
  const streak = rank.streak ?? 0;

  return (
    <div className="border-2 border-borda bg-painel p-5">
      <h2 className="mb-3 font-pixel text-[11px] text-suave">RANKED · SOLO/DUO</h2>

      {/* emblema + elo + barra de PDL */}
      <div className="flex items-center gap-4">
        <Emblema cor={cor} rotulo={rotuloEmblema} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-pixel text-sm" style={{ color: cor }}>
              {rank.elo}
            </span>
            <span className="shrink-0 text-[11px] text-suave">MMR {rank.mmr}</span>
          </div>

          {streak >= 2 && (
            <p className="mt-1 text-[11px] text-amber-300">🔥 {streak} vitórias seguidas <span className="text-suave">· +PDL</span></p>
          )}
          {streak <= -2 && (
            <p className="mt-1 text-[11px] text-rosa">❄️ {-streak} derrotas seguidas <span className="text-suave">· −PDL</span></p>
          )}

          <div className="mt-2 h-3 overflow-hidden border-2 border-borda bg-fundo">
            <div className="h-full transition-all" style={{ width: `${lp}%`, backgroundColor: cor }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px]">
            <span className="text-suave">{lp}/100 PDL</span>
            {topo ? (
              <span style={{ color: cor }}>Elo máximo 👑</span>
            ) : (
              <span className="text-suave">
                faltam <span className="font-pixel text-[10px] text-texto">{faltam}</span> PDL → {prox}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* trilha dos próximos elos */}
      <p className="mb-1.5 mt-4 font-pixel text-[10px] text-suave">PRÓXIMOS ELOS</p>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {trilha.map((e) => {
          const info = infoElo(e);
          const atual = e === rank.elo;
          return (
            <div
              key={e}
              className={`flex min-w-[58px] flex-1 flex-col items-center gap-1 border-2 px-1 py-1.5 ${atual ? "" : "opacity-50"}`}
              style={{ borderColor: atual ? info.cor : "#2a2150" }}
            >
              <Emblema cor={info.cor} rotulo={info.divisao || "★"} tamanho={22} />
              <span
                className="text-center text-[10px] leading-tight"
                style={{ color: atual ? info.cor : "#9a90c0" }}
              >
                {e}
              </span>
            </div>
          );
        })}
      </div>

      {/* progresso geral Ferro → Desafiante */}
      <div className="mt-3">
        <div className="h-1.5 border border-borda bg-fundo">
          <div className="h-full" style={{ width: `${progressoGeral}%`, backgroundColor: cor }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-borda">
          <span>Ferro IV</span>
          <span>{progressoGeral}% da escalada</span>
          <span>Desafiante</span>
        </div>
      </div>
    </div>
  );
}
