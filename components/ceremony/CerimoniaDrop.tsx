"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/data/itens";
import { raridadeItemDef } from "@/data/itens";
import { duracaoAntecipacao, tierDeItem, TIERS_JUICE } from "@/data/juice";
import { tocarSomTier } from "@/lib/som";
import { useInventory } from "@/store/inventoryStore";
import ItemVisual from "@/components/ItemVisual";
import PixelBurst from "@/components/juice/PixelBurst";

// 🎁 Cerimônia de drop: o item CAI girando do topo com a raridade escondida; a raridade
// "acende" por último (borda/glow + flash + partículas + som). Tiers altos seguram meio
// segundo a mais de suspense e tremem a tela. EQUIPAR AGORA / GUARDAR.

type Fase = "caindo" | "suspense" | "aceso";

export default function CerimoniaDrop({ item, onFechar }: { item: Item; onFechar: () => void }) {
  const [fase, setFase] = useState<Fase>("caindo");
  const tier = tierDeItem(item.raridade);
  const info = TIERS_JUICE[tier];
  const rd = raridadeItemDef(item.raridade);
  const equipar = useInventory((s) => s.equipar);

  useEffect(() => {
    setFase("caindo");
    const tQueda = 950;
    const tSuspense = duracaoAntecipacao(tier) - 400; // tiers altos = mais suspense
    const t1 = setTimeout(() => setFase("suspense"), tQueda);
    const t2 = setTimeout(() => {
      setFase("aceso");
      tocarSomTier(tier);
    }, tQueda + Math.max(200, tSuspense));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const aceso = fase === "aceso";

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-center justify-center bg-black/85 px-4 ${aceso && tier >= 4 ? "shake-tela" : ""}`}
      onClick={onFechar}
      role="dialog"
      aria-label="Item dropado"
    >
      <div className="relative flex w-full max-w-xs flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {aceso && (
          <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2">
            <PixelBurst cores={[info.cor, info.brilho, "#ffffff"]} qtd={tier >= 4 ? 42 : 26} seed={item.id.length + tier} />
          </div>
        )}

        <p className="font-pixel text-[12px] text-suave">ITEM DROPADO!</p>

        {/* carta do item: cai girando; raridade escondida até acender */}
        <div
          className={`item-queda w-full border-2 bg-painel p-3 transition-all duration-300 ${aceso ? "item-glow-forte" : ""}`}
          style={
            aceso
              ? ({ borderColor: info.cor, "--cor": info.cor, backgroundImage: `linear-gradient(150deg, ${info.cor}22, transparent 62%)` } as React.CSSProperties)
              : { borderColor: "#2a2150", filter: "saturate(0.25) brightness(0.8)" }
          }
        >
          {aceso ? (
            <>
              <p className="mb-2 text-center font-pixel text-[11px] pop-estouro" style={{ color: info.cor }}>
                {rd.nome.toUpperCase()} · iLvl {item.iLvl}
              </p>
              <ItemVisual item={item} />
            </>
          ) : (
            <div className="flex h-32 items-center justify-center">
              <span className={`text-4xl ${fase === "suspense" ? "animate-pulse" : ""}`}>❓</span>
            </div>
          )}
        </div>

        {aceso && (
          <div className="desliza-cima grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                equipar(item.id);
                onFechar();
              }}
              className="border-2 py-2 font-pixel text-[10px] transition hover:brightness-125"
              style={{ borderColor: info.cor, color: info.cor, background: `${info.cor}1a` }}
            >
              EQUIPAR AGORA
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="border-2 border-borda bg-painel py-2 font-pixel text-[10px] text-suave transition hover:text-texto"
            >
              GUARDAR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
