"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LOOP } from "@/data/loop";
import { cargasPartida, tempoProximaCarga } from "@/engine/tempo";
import type { CareerState } from "@/engine/types";

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return `${m}:${seg.toString().padStart(2, "0")}`;
}

// Bloco de "jogar partida de campeonato": barras de carga (regen por tempo) + botão gated.
export default function PartidaCampeonato({
  career,
  href,
  tema,
}: {
  career: CareerState;
  href: string;
  tema: "liga" | "torneio";
}) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cargas = cargasPartida(career, agora);
  const disp = Math.floor(cargas);
  const frac = cargas - disp;
  const podeJogar = disp >= 1;
  const proxima = tempoProximaCarga(career, agora);
  const hex = tema === "liga" ? "#ff2d7e" : "#ffd34d";
  const btn =
    tema === "liga"
      ? "border-rosa bg-rosa/10 text-rosa hover:bg-rosa hover:text-fundo"
      : "border-amber-300 bg-amber-300/10 text-amber-300 hover:bg-amber-300 hover:text-fundo";

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[10px] text-suave">PARTIDAS</span>
        <div className="flex flex-1 gap-1">
          {Array.from({ length: LOOP.maxCargasPartida }).map((_, i) => {
            const fill = i < disp ? 1 : i === disp ? frac : 0;
            return (
              <div key={i} className="h-2.5 flex-1 border-2 border-borda bg-fundo">
                <div className="h-full transition-all" style={{ width: `${fill * 100}%`, backgroundColor: hex }} />
              </div>
            );
          })}
        </div>
        <span className="text-[10px] text-suave">
          {disp}/{LOOP.maxCargasPartida}
        </span>
      </div>
      {proxima > 0 && <p className="mt-1 text-right text-[10px] text-suave">🕒 +1 partida em {fmt(proxima)}</p>}

      {podeJogar ? (
        <Link href={href} className={`mt-2 block border-2 px-4 py-2.5 text-center font-pixel text-[11px] transition ${btn}`}>
          ⚔️ JOGAR PARTIDA
        </Link>
      ) : (
        <p className="mt-2 border-2 border-borda px-3 py-2 text-center text-[12px] text-suave">
          🔒 Sem cargas de partida — próxima em {fmt(proxima)}
        </p>
      )}
    </div>
  );
}
