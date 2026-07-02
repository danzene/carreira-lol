"use client";

import { type CSSProperties } from "react";
import { defAfixo, nomeItem, raridadeItemDef, setDef, slotDef, type Item } from "@/data/itens";

// Visual reutilizável de uma carta de item (inventário, drop pós-partida, recompensas...).

export const corRaridade = (r: Item["raridade"]) => raridadeItemDef(r).cor;
export const classeBrilho = (r: Item["raridade"]) => (r >= 4 ? "item-glow-forte" : "item-glow");

export function estiloCartaItem(r: Item["raridade"], tint = true): CSSProperties {
  const c = corRaridade(r);
  const s: Record<string, string> = { borderColor: c, "--cor": c };
  if (tint) s.backgroundImage = `linear-gradient(150deg, ${c}1f, transparent 62%)`;
  return s as CSSProperties;
}

function LinhaAfixo({ rotulo, valor, base = false }: { rotulo: string; valor: number; base?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-[11px] ${base ? "text-suave" : "text-texto"}`}>
        {rotulo}
        {base && <span className="text-[10px] text-suave/80"> · base</span>}
      </span>
      <span className="font-pixel text-[10px]" style={{ color: base ? "#9a90c0" : "#19e6e0" }}>
        +{valor}
      </span>
    </div>
  );
}

export default function ItemVisual({ item }: { item: Item }) {
  const c = corRaridade(item.raridade);
  const sl = slotDef(item.slot);
  const rd = raridadeItemDef(item.raridade);
  const r = item.raridade;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* ícone com ornamentos que EVOLUEM com a raridade */}
          <span
            className="relative grid h-10 w-10 shrink-0 place-items-center border-2 text-lg"
            style={{
              borderColor: c,
              background:
                r >= 4
                  ? `linear-gradient(135deg, ${c}33, ${c}0d 55%, ${c}26)`
                  : r >= 3
                    ? `linear-gradient(135deg, ${c}26, transparent)`
                    : `${c}1a`,
              boxShadow: r === 5 ? `0 0 10px ${c}88, inset 0 0 6px ${c}44` : r === 4 ? `0 0 6px ${c}55` : undefined,
            }}
          >
            {sl.emoji}
            {/* épico+: gema de raridade */}
            {r >= 3 && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rotate-45 border" style={{ background: c, borderColor: "#0b0617" }} />
            )}
            {/* lendário+: cantos decorados */}
            {r >= 4 && (
              <>
                <span className="absolute bottom-0 left-0 h-1.5 w-1.5 border-b-2 border-l-2" style={{ borderColor: c }} />
                <span className="absolute left-0 top-0 h-1.5 w-1.5 border-l-2 border-t-2" style={{ borderColor: c }} />
              </>
            )}
            {/* mítico: faísca viva */}
            {r === 5 && <span className="absolute -left-1.5 -top-1.5 animate-pulse text-[10px]" style={{ color: c }}>✦</span>}
          </span>
          <div className="min-w-0">
            <p className="truncate font-pixel text-[11px] leading-tight" style={{ color: c, textShadow: `0 0 6px ${c}55` }}>
              {nomeItem(item)}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-suave">
              <span style={{ color: c }}>{"★".repeat(r)}</span>
              {rd.nome} · {sl.nome}
            </p>
          </div>
        </div>
        <span className="shrink-0 border border-borda bg-fundo/60 px-1.5 py-0.5 font-pixel text-[9px] text-suave">iLvl {item.iLvl}</span>
      </div>

      <div className="flex flex-col gap-0.5 border-t-2 border-borda/60 pt-1.5">
        <LinhaAfixo rotulo={defAfixo(item.implicito.chave)?.rotulo ?? item.implicito.chave} valor={item.implicito.valor} base />
        {item.afixos.map((a, i) => (
          <LinhaAfixo key={i} rotulo={defAfixo(a.chave)?.rotulo ?? a.chave} valor={a.valor} />
        ))}
      </div>

      {item.setId && (
        <span className="self-start border border-amber-300/50 bg-amber-300/10 px-1.5 py-0.5 text-[10px] text-amber-300">
          ⚙ Set {setDef(item.setId)?.nome}
        </span>
      )}
    </div>
  );
}
