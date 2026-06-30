"use client";

import Link from "next/link";
import { type CSSProperties, useEffect } from "react";
import {
  ITENS_ECON,
  SLOTS_GEAR,
  defAfixo,
  nomeItem,
  raridadeItemDef,
  setDef,
  slotDef,
  type Item,
} from "@/data/itens";
import { efeitoItens } from "@/engine/itens";
import { itensEquipadosDe, useInventory } from "@/store/inventoryStore";
import { useProfile } from "@/store/profileStore";

const cor = (r: Item["raridade"]) => raridadeItemDef(r).cor;

function estiloItem(c: string, tint = true): CSSProperties {
  const s: Record<string, string> = { borderColor: c, "--cor": c };
  if (tint) s.backgroundImage = `linear-gradient(150deg, ${c}1f, transparent 62%)`;
  return s as CSSProperties;
}
const classeBrilho = (r: Item["raridade"]) => (r >= 4 ? "item-glow-forte" : "item-glow");

function LinhaAfixo({ rotulo, valor, base = false }: { rotulo: string; valor: number; base?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-[10px] ${base ? "text-suave" : "text-texto"}`}>
        {rotulo}
        {base && <span className="text-[8px] text-borda"> · base</span>}
      </span>
      <span className="font-pixel text-[9px]" style={{ color: base ? "#9a90c0" : "#19e6e0" }}>
        +{valor}
      </span>
    </div>
  );
}

function ItemVisual({ item }: { item: Item }) {
  const c = cor(item.raridade);
  const sl = slotDef(item.slot);
  const rd = raridadeItemDef(item.raridade);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center border-2 text-lg" style={{ borderColor: c, background: `${c}1a` }}>
            {sl.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate font-pixel text-[10px] leading-tight" style={{ color: c, textShadow: `0 0 6px ${c}55` }}>
              {nomeItem(item)}
            </p>
            <p className="mt-0.5 text-[8px] text-suave">
              {rd.nome} · {sl.nome}
            </p>
          </div>
        </div>
        <span className="shrink-0 border border-borda bg-fundo/60 px-1.5 py-0.5 font-pixel text-[7px] text-suave">iLvl {item.iLvl}</span>
      </div>

      <div className="flex flex-col gap-0.5 border-t-2 border-borda/60 pt-1.5">
        <LinhaAfixo rotulo={defAfixo(item.implicito.chave)?.rotulo ?? item.implicito.chave} valor={item.implicito.valor} base />
        {item.afixos.map((a, i) => (
          <LinhaAfixo key={i} rotulo={defAfixo(a.chave)?.rotulo ?? a.chave} valor={a.valor} />
        ))}
      </div>

      {item.setId && (
        <span className="self-start border border-amber-300/50 bg-amber-300/10 px-1.5 py-0.5 text-[8px] text-amber-300">
          ⚙ Set {setDef(item.setId)?.nome}
        </span>
      )}
    </div>
  );
}

export default function InventarioPage() {
  const itens = useInventory((s) => s.itens);
  const equipado = useInventory((s) => s.equipado);
  const carregando = useInventory((s) => s.carregando);
  const carregar = useInventory((s) => s.carregar);
  const equipar = useInventory((s) => s.equipar);
  const desequipar = useInventory((s) => s.desequipar);
  const reroll = useInventory((s) => s.reroll);
  const desmontar = useInventory((s) => s.desmontar);
  const coinpoints = useProfile((s) => s.perfil?.coinpoints ?? 0);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const equipadosIds = new Set(Object.values(equipado));
  const naMochila = itens.filter((i) => !equipadosIds.has(i.id));
  const ef = efeitoItens(itensEquipadosDe(itens, equipado));

  // resumo do "poder do gear" (totais dos equipados)
  const poder: string[] = [];
  (Object.entries(ef.atributos) as [string, number][]).forEach(([k, v]) => {
    if (v) poder.push(`${defAfixo(k)?.rotulo ?? k} +${v}`);
  });
  if (ef.xpMult > 1) poder.push(`XP +${Math.round((ef.xpMult - 1) * 100)}%`);
  if (ef.dinheiroMult > 1) poder.push(`Salário +${Math.round((ef.dinheiroMult - 1) * 100)}%`);
  if (ef.energiaMult > 1) poder.push(`Energia +${Math.round((ef.energiaMult - 1) * 100)}%`);
  if (ef.maestriaMult > 1) poder.push(`Maestria +${Math.round((ef.maestriaMult - 1) * 100)}%`);
  if (ef.bonusComp > 0) poder.push(`Draft +${ef.bonusComp}`);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">INVENTÁRIO</h1>
          <p className="mt-1 text-[10px] text-suave">🪙 {coinpoints} CoinPoints · monte seu set</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* poder do gear */}
      <div className="border-2 border-ciano/40 bg-ciano/5 p-3">
        <h2 className="mb-2 font-pixel text-[9px] text-ciano">⚡ PODER DO GEAR</h2>
        {poder.length === 0 && ef.sets.length === 0 ? (
          <p className="text-[10px] text-suave">Equipe itens pra somar bônus na partida.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {poder.map((t) => (
              <span key={t} className="border px-2 py-0.5 text-[10px]" style={{ color: "#9a6bff", borderColor: "rgba(154,107,255,0.4)", background: "rgba(154,107,255,0.1)" }}>
                {t}
              </span>
            ))}
            {ef.sets.map((s) => (
              <span key={s.id} className="border border-amber-300/50 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-300">
                ⚙ {s.nome} ({s.pecas})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* slots equipados */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">EQUIPADO</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SLOTS_GEAR.map((sl) => {
            const id = equipado[sl.slot];
            const it = id ? itens.find((i) => i.id === id) : undefined;
            return it ? (
              <div key={sl.slot} className={`item-card border-2 bg-painel p-2.5 ${classeBrilho(it.raridade)}`} style={estiloItem(cor(it.raridade))}>
                <ItemVisual item={it} />
                <button
                  type="button"
                  onClick={() => desequipar(sl.slot)}
                  className="mt-2 w-full border border-borda py-1 font-pixel text-[7px] text-suave transition hover:border-rosa hover:text-rosa"
                >
                  DESEQUIPAR
                </button>
              </div>
            ) : (
              <div key={sl.slot} className="slot-vazio flex min-h-[96px] flex-col items-center justify-center gap-1 border-2 border-borda bg-painel/40 p-2 text-center">
                <span className="text-2xl opacity-25">{sl.emoji}</span>
                <span className="font-pixel text-[8px] text-borda">{sl.nome}</span>
                <span className="text-[8px] text-suave">vazio</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* mochila */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">MOCHILA ({naMochila.length})</h2>
        {carregando ? (
          <p className="text-[11px] text-suave">Carregando…</p>
        ) : naMochila.length === 0 ? (
          <div className="border-2 border-borda bg-painel/40 p-6 text-center">
            <p className="text-2xl opacity-30">🎁</p>
            <p className="mt-1 text-[11px] text-suave">Mochila vazia. Vença partidas pra dropar itens (liga/torneio dropam melhores).</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {naMochila.map((it) => (
              <div key={it.id} className={`item-card border-2 bg-painel p-2.5 ${classeBrilho(it.raridade)}`} style={estiloItem(cor(it.raridade))}>
                <ItemVisual item={it} />
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => equipar(it.id)}
                    className="border-2 border-ciano bg-ciano/10 py-1.5 font-pixel text-[7px] text-ciano transition hover:bg-ciano hover:text-fundo"
                  >
                    EQUIPAR
                  </button>
                  <button
                    type="button"
                    disabled={coinpoints < ITENS_ECON.custoReroll}
                    onClick={() => reroll(it.id)}
                    className="border-2 border-borda py-1.5 font-pixel text-[7px] text-suave transition hover:border-suave disabled:opacity-40"
                    title="Re-sortear afixos"
                  >
                    🎲 {ITENS_ECON.custoReroll}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Desmontar ${nomeItem(it)}? Você ganha 🪙${ITENS_ECON.coinsDesmonte}.`)) desmontar(it.id);
                    }}
                    className="border-2 border-borda py-1.5 font-pixel text-[7px] text-rosa transition hover:border-rosa"
                    title="Desmontar por CoinPoints"
                  >
                    ♻️ +{ITENS_ECON.coinsDesmonte}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
