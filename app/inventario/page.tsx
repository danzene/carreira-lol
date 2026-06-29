"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ITENS_ECON, SLOTS_GEAR, defAfixo, nomeItem, raridadeItemDef, setDef, slotDef, type Item } from "@/data/itens";
import { efeitoItens } from "@/engine/itens";
import { itensEquipadosDe, useInventory } from "@/store/inventoryStore";
import { useProfile } from "@/store/profileStore";

function Afixos({ item }: { item: Item }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <span className="border border-borda px-1 text-[8px] text-texto">
        {defAfixo(item.implicito.chave)?.rotulo ?? item.implicito.chave} +{item.implicito.valor}
      </span>
      {item.afixos.map((a, i) => (
        <span key={i} className="border border-ciano/40 px-1 text-[8px] text-ciano">
          {defAfixo(a.chave)?.rotulo ?? a.chave} +{a.valor}
        </span>
      ))}
      {item.setId && (
        <span className="border border-amber-300/40 px-1 text-[8px] text-amber-300">⚙ {setDef(item.setId)?.nome}</span>
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

      {/* slots equipados */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">EQUIPADO</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SLOTS_GEAR.map((sl) => {
            const id = equipado[sl.slot];
            const it = id ? itens.find((i) => i.id === id) : undefined;
            const cor = it ? raridadeItemDef(it.raridade).cor : "#2a2150";
            return (
              <div key={sl.slot} className="border-2 bg-painel p-2" style={{ borderColor: cor }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-suave">{sl.emoji} {sl.nome}</span>
                  {it && (
                    <button type="button" onClick={() => desequipar(sl.slot)} className="text-[9px] text-rosa hover:underline">
                      tirar
                    </button>
                  )}
                </div>
                {it ? (
                  <>
                    <p className="mt-1 text-[11px]" style={{ color: cor }}>
                      {nomeItem(it)} · iLvl {it.iLvl}
                    </p>
                    <Afixos item={it} />
                  </>
                ) : (
                  <p className="mt-1 text-[10px] text-borda">vazio</p>
                )}
              </div>
            );
          })}
        </div>
        {ef.sets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ef.sets.map((s) => (
              <span key={s.id} className="border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-300">
                ⚙ Set {s.nome} ({s.pecas} peças)
              </span>
            ))}
          </div>
        )}
      </section>

      {/* mochila */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">MOCHILA ({naMochila.length})</h2>
        {carregando ? (
          <p className="text-[11px] text-suave">Carregando…</p>
        ) : naMochila.length === 0 ? (
          <p className="text-[11px] text-suave">Vazio. Vença partidas pra dropar itens (e abra ingressos de campeonato).</p>
        ) : (
          <div className="flex flex-col gap-2">
            {naMochila.map((it) => {
              const cor = raridadeItemDef(it.raridade).cor;
              return (
                <div key={it.id} className="border-2 bg-painel p-2" style={{ borderColor: cor }}>
                  <p className="text-[11px]" style={{ color: cor }}>
                    {slotDef(it.slot).emoji} {nomeItem(it)} · iLvl {it.iLvl}
                  </p>
                  <Afixos item={it} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => equipar(it.id)}
                      className="border-2 border-ciano bg-ciano/10 px-2 py-1 font-pixel text-[8px] text-ciano transition hover:bg-ciano hover:text-fundo"
                    >
                      EQUIPAR
                    </button>
                    <button
                      type="button"
                      disabled={coinpoints < ITENS_ECON.custoReroll}
                      onClick={() => reroll(it.id)}
                      className="border-2 border-borda px-2 py-1 font-pixel text-[8px] text-suave transition hover:border-suave disabled:opacity-40"
                    >
                      REROLL 🪙{ITENS_ECON.custoReroll}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Desmontar ${nomeItem(it)}? Você ganha 🪙${ITENS_ECON.coinsDesmonte}.`)) desmontar(it.id);
                      }}
                      className="border-2 border-borda px-2 py-1 font-pixel text-[8px] text-rosa transition hover:border-rosa"
                    >
                      DESMONTAR +🪙{ITENS_ECON.coinsDesmonte}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
