"use client";

import { useEffect, useState } from "react";
import type { Recompensa } from "@/data/passe";
import { TIERS_JUICE } from "@/data/juice";
import { podeResgatar } from "@/engine/passe";
import { tocarSom } from "@/lib/som";
import { usePasse } from "@/store/passeStore";
import PixelBurst from "@/components/juice/PixelBurst";
import AnimatedBar from "@/components/juice/AnimatedBar";

// 🎟️ Cerimônia de level up do passe: a barra enche com "estouro", o número do nível dá
// pop, e o preview da(s) recompensa(s) desliza. Se tem recompensa liberada, RESGATAR aqui.

const ICONE: Record<Recompensa["tipo"], string> = { coinpoints: "🪙", item: "🎒", ingresso: "🎟️", moldura: "🖼️" };

export default function CerimoniaPasse({
  de,
  para,
  recompensas,
  onFechar,
}: {
  de: number;
  para: number;
  recompensas: Recompensa[];
  onFechar: () => void;
}) {
  const [pct, setPct] = useState(30);
  const [estourou, setEstourou] = useState(false);
  const passe = usePasse((s) => s.passe);
  const resgatar = usePasse((s) => s.resgatar);
  const info = TIERS_JUICE[3];

  useEffect(() => {
    const t0 = setTimeout(() => setPct(100), 80); // barra enche
    const t1 = setTimeout(() => {
      setEstourou(true);
      tocarSom("levelup");
    }, 850);
    const t2 = setTimeout(onFechar, 6500);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, para]);

  const resgataveis = passe ? recompensas.filter((r) => podeResgatar(passe, r)) : [];

  return (
    <div
      className="fixed inset-0 z-[90] flex cursor-pointer items-center justify-center bg-black/85 px-4"
      onClick={onFechar}
      role="dialog"
      aria-label="Nível do passe"
    >
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 text-center" onClick={(e) => e.stopPropagation()}>
        {estourou && (
          <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2">
            <PixelBurst cores={[info.cor, info.brilho, "#ffe14d"]} qtd={34} seed={para} />
          </div>
        )}

        <p className="font-pixel text-[12px] text-suave">PASSE DE BATALHA</p>

        <div className="w-full">
          <AnimatedBar pct={pct} alturaClass="h-3" />
        </div>

        {estourou && (
          <h2 className="pop-estouro font-pixel text-3xl" style={{ color: info.cor, textShadow: `0 0 22px ${info.cor}` }}>
            NÍVEL {para}
          </h2>
        )}
        {estourou && para - de > 1 && <p className="text-[11px] text-ciano">+{para - de} níveis de uma vez!</p>}

        {estourou && recompensas.length > 0 && (
          <div className="desliza-cima flex w-full flex-col gap-2">
            <p className="font-pixel text-[10px] text-suave">RECOMPENSAS NO CAMINHO</p>
            <div className="flex flex-wrap justify-center gap-2">
              {recompensas.map((r) => (
                <span
                  key={`${r.trilha}${r.nivel}`}
                  className={`border-2 px-2 py-1 text-[11px] ${r.trilha === "premium" ? "border-amber-300/60 text-amber-300" : "border-borda text-texto"}`}
                >
                  {ICONE[r.tipo]} {r.rotulo}
                </span>
              ))}
            </div>
            {resgataveis.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  resgataveis.forEach((r) => resgatar(r));
                  tocarSom("moeda");
                  onFechar();
                }}
                className="mx-auto border-2 border-amber-300 bg-amber-300/10 px-6 py-2 font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
              >
                🎁 RESGATAR ({resgataveis.length})
              </button>
            )}
          </div>
        )}

        {estourou && <p className="text-[10px] text-suave/70">clique pra continuar</p>}
      </div>
    </div>
  );
}
