import type { AtributoKey } from "@/engine/types";

// 🎒 Sistema RPG de itens (loot com afixos aleatórios). PURO — só dados e faixas, sem RNG.
// A geração/efeito ficam em engine/itens.ts. Números aqui são tunáveis no balanceamento.

// ---- Slots de equipamento (o setup do pro player) ----
export type SlotGear = "MOUSE" | "TECLADO" | "HEADSET" | "MONITOR" | "CADEIRA" | "MOUSEPAD";

export interface SlotDef {
  slot: SlotGear;
  nome: string;
  emoji: string;
  implicito: AtributoKey; // atributo base fixo do slot
}

export const SLOTS_GEAR: SlotDef[] = [
  { slot: "MOUSE", nome: "Mouse", emoji: "🖱️", implicito: "mecanica" },
  { slot: "TECLADO", nome: "Teclado", emoji: "⌨️", implicito: "laning" },
  { slot: "HEADSET", nome: "Headset", emoji: "🎧", implicito: "comunicacao" },
  { slot: "MONITOR", nome: "Monitor", emoji: "🖥️", implicito: "teamfight" },
  { slot: "CADEIRA", nome: "Cadeira", emoji: "🪑", implicito: "consistencia" },
  { slot: "MOUSEPAD", nome: "Mousepad", emoji: "🟦", implicito: "mecanica" },
];

export function slotDef(slot: SlotGear): SlotDef {
  return SLOTS_GEAR.find((s) => s.slot === slot) ?? SLOTS_GEAR[0];
}

// ---- Raridades (rarest first; chances somam 1) ----
export type RaridadeItem = 1 | 2 | 3 | 4 | 5;

export interface RaridadeItemDef {
  n: RaridadeItem;
  nome: string;
  cor: string;
  afixos: number; // nº de afixos aleatórios
  chance: number;
}

export const RARIDADES_ITEM: RaridadeItemDef[] = [
  { n: 5, nome: "Mítico", cor: "#ffe14d", afixos: 5, chance: 0.02 },
  { n: 4, nome: "Lendário", cor: "#ff2d7e", afixos: 4, chance: 0.08 },
  { n: 3, nome: "Épico", cor: "#9a6bff", afixos: 3, chance: 0.2 },
  { n: 2, nome: "Raro", cor: "#19e6e0", afixos: 2, chance: 0.35 },
  { n: 1, nome: "Comum", cor: "#9a90c0", afixos: 1, chance: 0.35 },
];

export function raridadeItemDef(n: RaridadeItem): RaridadeItemDef {
  return RARIDADES_ITEM.find((r) => r.n === n) ?? RARIDADES_ITEM[RARIDADES_ITEM.length - 1];
}

// ---- Afixos sorteáveis (atributo soma direto; especiais têm % próprio) ----
export type TipoAfixo = "atributo" | "xp" | "dinheiro" | "energia" | "maestria" | "comp";

export interface DefAfixo {
  chave: string;
  rotulo: string;
  tipo: TipoAfixo;
}

export const AFIXOS: DefAfixo[] = [
  { chave: "mecanica", rotulo: "Mecânica", tipo: "atributo" },
  { chave: "macro", rotulo: "Macro", tipo: "atributo" },
  { chave: "laning", rotulo: "Laning", tipo: "atributo" },
  { chave: "teamfight", rotulo: "Teamfight", tipo: "atributo" },
  { chave: "consistencia", rotulo: "Consistência", tipo: "atributo" },
  { chave: "mental", rotulo: "Mental", tipo: "atributo" },
  { chave: "comunicacao", rotulo: "Comunicação", tipo: "atributo" },
  { chave: "championPool", rotulo: "Champ Pool", tipo: "atributo" },
  { chave: "xp", rotulo: "XP", tipo: "xp" },
  { chave: "dinheiro", rotulo: "Salário", tipo: "dinheiro" },
  { chave: "energia", rotulo: "Regen energia", tipo: "energia" },
  { chave: "maestria", rotulo: "Maestria/partida", tipo: "maestria" },
  { chave: "comp", rotulo: "Draft", tipo: "comp" },
];

export function defAfixo(chave: string): DefAfixo | undefined {
  return AFIXOS.find((a) => a.chave === chave);
}

// Faixa [min,max] de um afixo conforme o tipo e o iLvl (escala com iLvl). PURO.
export function faixaAfixo(tipo: TipoAfixo, iLvl: number): [number, number] {
  const e = iLvl / 10; // iLvl 10 = 1x
  if (tipo === "atributo") return [Math.max(1, Math.round(e)), Math.max(2, Math.round(4 * e))];
  if (tipo === "comp") return [1, Math.max(1, Math.round(1.5 * e))];
  return [Math.max(2, Math.round(2 * e)), Math.max(4, Math.round(8 * e))]; // xp/dinheiro/energia/maestria (%)
}

// ---- Sets (espelham os estilos das lendas) ----
export type SetId = "agressivo" | "estrategista" | "mecanico" | "resiliente";

export interface SetDef {
  id: SetId;
  nome: string;
  b2: { chave: string; valor: number }; // bônus com 2 peças
  b4: { chave: string; valor: number }; // bônus extra com 4 peças
}

export const SETS: SetDef[] = [
  { id: "agressivo", nome: "Agressor", b2: { chave: "teamfight", valor: 4 }, b4: { chave: "teamfight", valor: 8 } },
  { id: "estrategista", nome: "Estrategista", b2: { chave: "macro", valor: 4 }, b4: { chave: "comp", valor: 3 } },
  { id: "mecanico", nome: "Mecânico", b2: { chave: "mecanica", valor: 4 }, b4: { chave: "maestria", valor: 10 } },
  { id: "resiliente", nome: "Resiliente", b2: { chave: "consistencia", valor: 4 }, b4: { chave: "consistencia", valor: 8 } },
];

export function setDef(id: SetId): SetDef | undefined {
  return SETS.find((s) => s.id === id);
}

// ---- Item ----
export interface Afixo {
  chave: string;
  valor: number;
}

export interface Item {
  id: string; // instância única
  slot: SlotGear;
  raridade: RaridadeItem;
  iLvl: number;
  implicito: Afixo; // fixo do slot
  afixos: Afixo[]; // aleatórios (RNG)
  setId?: SetId;
}
