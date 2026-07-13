"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LOOP } from "@/data/loop";
import { energiaAgora, proximoUsoEm, usosRestantes } from "@/engine/tempo";
import type { CareerState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import AnimatedNumber from "./juice/AnimatedNumber";

// Painel da semana: energia, JOGAR, a GAMING HOUSE (o treino profundo — substituiu os
// 4 botões vagos de TREINO/ESPECIAL/STREAM/MENTAL) e o avanço de tempo.

export default function PainelSemana({ career }: { career: CareerState }) {
  const avancarSemana = useCareer((s) => s.avancarSemana);

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const energia = energiaAgora(career, agora);
  const tempoCheia = energia >= 100 ? 0 : Math.ceil((100 - energia) * (LOOP.energiaCheiaMs / 100));
  const usosAvancar = usosRestantes(career.avancosEm, agora);
  const usosDescansar = usosRestantes(career.descansosEm, agora);
  const liberaAvancar = proximoUsoEm(career.avancosEm, agora);
  const liberaDescansar = proximoUsoEm(career.descansosEm, agora);
  const podeSoloq = energia >= LOOP.custoSoloq;

  return (
    <div className="border-2 border-borda bg-painel p-5">
      <h2 className="mb-3 font-pixel text-[11px] text-suave">
        TEMPORADA {career.temporada} · SEMANA {career.semanaAtual}
      </h2>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-suave">Energia</span>
          <span className="text-texto">
            <AnimatedNumber valor={Math.round(energia)} />/100
          </span>
        </div>
        <div className="h-3 border-2 border-borda bg-fundo">
          <div className="h-full bg-gradient-to-r from-rosa to-ciano transition-all" style={{ width: `${energia}%` }} />
        </div>
        <p className="mt-1 text-right text-[10px] text-suave">
          {tempoCheia > 0 ? `🕒 cheia em ${fmt(tempoCheia)}` : "⚡ energia cheia"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={podeSoloq ? "/draft" : "#"}
          aria-disabled={!podeSoloq}
          className={`flex flex-col items-center gap-0.5 border-2 px-2 py-3 text-center font-pixel text-[11px] transition ${
            podeSoloq
              ? "border-rosa bg-rosa/10 text-rosa hover:bg-rosa hover:text-fundo"
              : "pointer-events-none border-borda text-borda"
          }`}
        >
          <span className="flex flex-col items-center gap-1">
            <img src="/carreira/icones/jogar.png" alt="" className="h-9 w-9" style={{ imageRendering: "pixelated" }} />
            <span>JOGAR</span>
          </span>
          <span className="text-[9px] font-normal opacity-80">−{LOOP.custoSoloq}</span>
        </Link>
        {/* 🏠 os 4 botões vagos viram a GAMING HOUSE (treino profundo: estação ×
            intensidade × foco). Ocupa o espaço deles no grid. */}
        <Link
          href="/casa"
          className="col-span-2 flex flex-col items-center gap-0.5 border-2 border-ciano bg-ciano/10 px-2 py-3 text-center font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          <span className="flex flex-col items-center gap-1">
            <span className="text-2xl leading-none">🏠</span>
            <span>GAMING HOUSE</span>
          </span>
          <span className="text-[9px] font-normal opacity-80">
            treino · stream · bem-estar{energia >= 100 ? " · ⚡ cheia!" : ""}
          </span>
        </Link>
      </div>

      <p className="mt-3 text-center text-[11px] text-suave">
        A energia regenera sozinha (2h pra encher). Avançar/descansar a semana têm limite por tempo.
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={usosAvancar <= 0}
          onClick={() => avancarSemana("normal")}
          className="flex flex-col items-center gap-0.5 border-2 border-ciano bg-ciano/10 py-3 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ciano/10 disabled:hover:text-ciano"
        >
          ⏭️ AVANÇAR SEMANA
          <span className="text-[9px] font-normal opacity-80">
            {usosAvancar > 0 ? `${usosAvancar}/${LOOP.maxPassesJanela} · +${LOOP.ganhoAvancoEnergia}⚡` : `🔒 ${fmt(liberaAvancar)}`}
          </span>
        </button>
        <button
          type="button"
          disabled={usosDescansar <= 0}
          onClick={() => avancarSemana("descanso")}
          className="flex flex-col items-center gap-0.5 border-2 border-borda bg-fundo/40 py-3 font-pixel text-[11px] text-suave transition hover:border-suave disabled:cursor-not-allowed disabled:opacity-40"
        >
          😴 DESCANSAR
          <span className="text-[9px] font-normal opacity-80">
            {usosDescansar > 0 ? `${usosDescansar}/${LOOP.maxPassesJanela} · energia cheia · zera fadiga` : `🔒 ${fmt(liberaDescansar)}`}
          </span>
        </button>
      </div>
    </div>
  );
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  if (m > 0) return `${m}m${seg.toString().padStart(2, "0")}s`;
  return `${seg}s`;
}
