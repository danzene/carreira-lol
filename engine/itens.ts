import {
  AFIXOS,
  RARIDADES_ITEM,
  SETS,
  defAfixo,
  faixaAfixo,
  raridadeItemDef,
  setDef,
  slotDef,
  type Afixo,
  type Item,
  type RaridadeItem,
  type SetId,
  type SlotGear,
} from "@/data/itens";
import { criarRng, entre, type Rng } from "./rng";
import type { Attributes, AtributoKey } from "./types";

// 🎒 Motor do sistema RPG de itens (PURO): geração com afixos RNG, reroll e efeito ao equipar.

// Sorteia a raridade. `sorte` (0..1) puxa pra raridades melhores (drops de tier alto).
function sortearRaridade(rng: Rng, sorte = 0): RaridadeItem {
  const x = Math.max(0, rng() - sorte);
  let acc = 0;
  for (const r of RARIDADES_ITEM) {
    acc += r.chance;
    if (x < acc) return r.n;
  }
  return 1;
}

function rolarAfixos(raridade: RaridadeItem, iLvl: number, rng: Rng): Afixo[] {
  const qtd = raridadeItemDef(raridade).afixos;
  const pool = [...AFIXOS];
  const out: Afixo[] = [];
  for (let i = 0; i < qtd && pool.length > 0; i++) {
    const def = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const [min, max] = faixaAfixo(def.tipo, iLvl);
    out.push({ chave: def.chave, valor: Math.round(entre(rng, min, max)) });
  }
  return out;
}

export interface OpcoesGerar {
  raridade?: RaridadeItem; // força a raridade (recompensa fixa)
  sorte?: number; // 0..1, puxa pra raridades melhores
  setChance?: number; // sobrescreve a chance de virar item de set
}

export function gerarItem(slot: SlotGear, iLvl: number, seed: number, opc: OpcoesGerar = {}): Item {
  const rng = criarRng(seed >>> 0);
  const raridade = opc.raridade ?? sortearRaridade(rng, opc.sorte ?? 0);
  const sl = slotDef(slot);
  const [imin, imax] = faixaAfixo("atributo", iLvl);
  const implicito: Afixo = { chave: sl.implicito, valor: Math.round(entre(rng, imin, imax)) };
  const afixos = rolarAfixos(raridade, iLvl, rng);
  const setChance = opc.setChance ?? (raridade >= 4 ? 0.5 : raridade === 3 ? 0.25 : 0.1);
  const setId: SetId | undefined = rng() < setChance ? SETS[Math.floor(rng() * SETS.length)].id : undefined;
  const id = `it_${(seed >>> 0).toString(36)}_${Math.floor(rng() * 1e9).toString(36)}`;
  return { id, slot, raridade, iLvl, implicito, afixos, setId };
}

// Re-sorteia os afixos aleatórios do item (caça ao roll perfeito). Mantém id/slot/raridade/iLvl.
export function rerollAfixos(item: Item, seed: number): Item {
  return { ...item, afixos: rolarAfixos(item.raridade, item.iLvl, criarRng(seed >>> 0)) };
}

// ---- Efeito dos itens equipados (atributos + especiais + sets) ----
export interface EfeitoItens {
  atributos: Partial<Attributes>;
  xpMult: number;
  dinheiroMult: number;
  energiaMult: number;
  maestriaMult: number;
  bonusComp: number;
  sets: { id: SetId; nome: string; pecas: number }[];
}

function aplicar(ef: EfeitoItens, chave: string, valor: number): void {
  const tipo = defAfixo(chave)?.tipo ?? "atributo";
  if (tipo === "atributo") ef.atributos[chave as AtributoKey] = (ef.atributos[chave as AtributoKey] ?? 0) + valor;
  else if (tipo === "xp") ef.xpMult += valor / 100;
  else if (tipo === "dinheiro") ef.dinheiroMult += valor / 100;
  else if (tipo === "energia") ef.energiaMult += valor / 100;
  else if (tipo === "maestria") ef.maestriaMult += valor / 100;
  else if (tipo === "comp") ef.bonusComp += valor;
}

export function efeitoItens(equipados: Item[]): EfeitoItens {
  const ef: EfeitoItens = { atributos: {}, xpMult: 1, dinheiroMult: 1, energiaMult: 1, maestriaMult: 1, bonusComp: 0, sets: [] };
  const contagem: Partial<Record<SetId, number>> = {};

  for (const it of equipados) {
    aplicar(ef, it.implicito.chave, it.implicito.valor);
    for (const a of it.afixos) aplicar(ef, a.chave, a.valor);
    if (it.setId) contagem[it.setId] = (contagem[it.setId] ?? 0) + 1;
  }

  for (const s of SETS) {
    const pecas = contagem[s.id] ?? 0;
    if (pecas < 2) continue;
    aplicar(ef, s.b2.chave, s.b2.valor);
    if (pecas >= 4) aplicar(ef, s.b4.chave, s.b4.valor);
    ef.sets.push({ id: s.id, nome: setDef(s.id)?.nome ?? s.id, pecas });
  }

  (Object.keys(ef.atributos) as AtributoKey[]).forEach((k) => {
    ef.atributos[k] = Math.round((ef.atributos[k] ?? 0) * 10) / 10;
  });
  ef.bonusComp = Math.round(ef.bonusComp);
  return ef;
}
