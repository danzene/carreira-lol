"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nivelDoPasse } from "@/engine/passe";
import { energiaAgora } from "@/engine/tempo";
import { featureLiberada } from "@/engine/unlocks";
import { alternarMute, definirVolumeSom, somMutado, tocarSom, volumeSom } from "@/lib/som";
import { useCareer } from "@/store/careerStore";
import { usePasse } from "@/store/passeStore";
import { useProfile } from "@/store/profileStore";
import AnimatedNumber from "./juice/AnimatedNumber";

// 📌 HUD persistente no topo: CoinPoints + energia (mini-barra) + nível do passe + som.
// Aparece em toda tela quando há carreira ativa — o jogador nunca perde os recursos de vista.

export default function HeaderHud() {
  const career = useCareer((s) => s.career);
  const coinpoints = useProfile((s) => s.perfil?.coinpoints ?? 0);
  const passe = usePasse((s) => s.passe);

  const [agora, setAgora] = useState(() => Date.now());
  const [mudo, setMudo] = useState(false);
  const [volume, setVolume] = useState(50);
  const [painelSom, setPainelSom] = useState(false);
  useEffect(() => {
    setMudo(somMutado());
    setVolume(Math.round(volumeSom() * 100));
    const id = setInterval(() => setAgora(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (!career) return null;
  const energia = Math.round(energiaAgora(career, agora));

  return (
    <div className="sticky top-0 z-40 border-b-2 border-borda bg-fundo/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-1.5">
        <div className="flex items-center gap-3">
          <Link href="/gacha" className="flex items-center gap-1 text-[11px] text-rosa" title="CoinPoints">
            🪙 <AnimatedNumber valor={coinpoints} className="font-pixel text-[10px]" />
          </Link>
          <div className="flex items-center gap-1.5" title={`Energia ${energia}/100`}>
            <span className="text-[11px]">⚡</span>
            <div className="h-2 w-14 overflow-hidden border border-borda bg-painel sm:w-20">
              <div className="h-full bg-gradient-to-r from-rosa to-ciano transition-all" style={{ width: `${energia}%` }} />
            </div>
            <span className="font-pixel text-[9px] text-suave">{energia}</span>
          </div>
          {passe && featureLiberada(career, "passe") && (
            <Link href="/passe" className="hidden items-center gap-1 text-[11px] text-amber-300 sm:flex" title="Passe de Batalha">
              🎟️ <span className="font-pixel text-[9px]">Nv {nivelDoPasse(passe.pp)}</span>
            </Link>
          )}
        </div>
        {/* som: clique abre o painel com barra de volume */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPainelSom((p) => !p)}
            className="border border-borda px-1.5 py-0.5 text-[11px] text-suave transition hover:text-texto"
            aria-label="Ajustes de som"
            title="Som e volume"
          >
            {mudo || volume === 0 ? "🔇" : volume < 50 ? "🔉" : "🔊"}
          </button>
          {painelSom && (
            <div className="absolute right-0 top-8 z-50 w-44 border-2 border-borda bg-painel p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-pixel text-[9px] text-suave">VOLUME</span>
                <span className="font-pixel text-[9px] text-ciano">{mudo ? "MUDO" : `${volume}%`}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  definirVolumeSom(v / 100);
                }}
                onMouseUp={() => tocarSom("tick")}
                onTouchEnd={() => tocarSom("tick")}
                className="w-full accent-[#19e6e0]"
                aria-label="Volume dos efeitos"
              />
              <button
                type="button"
                onClick={() => {
                  const m = alternarMute();
                  setMudo(m);
                  if (!m) tocarSom("tick");
                }}
                className={`mt-2 w-full border-2 py-1 font-pixel text-[9px] transition ${
                  mudo ? "border-rosa text-rosa hover:bg-rosa hover:text-fundo" : "border-borda text-suave hover:text-texto"
                }`}
              >
                {mudo ? "🔇 ATIVAR SOM" : "🔇 SILENCIAR"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
