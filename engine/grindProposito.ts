import {
  COLECAO_GRIND,
  GRIND_PROP,
  TALENTOS,
  defCosmetico,
  defTalento,
  type DefTalento,
  type TierBau,
} from "@/data/grindProposito";
import type { SlotGear } from "@/data/itens";
import { SLOTS_GEAR } from "@/data/itens";
import { criarRng, entre, type Rng } from "./rng";

// 🎯 Grind com Propósito (PURO, seedado) — Sucata, Árvore de Talentos, Baús.
// Nada aqui lê relógio, DOM ou Math.random. A UI encena; o engine é a verdade.
//
// ECONOMIA FECHADA (Regra 1): Sucata entra SÓ por `sucataDaPartida`/baús e sai SÓ por
// `comprarTalento`. Nenhuma função converte Sucata em $/CoinPoints (nem o contrário).
// LISTA PROIBIDA (Regra 2): as recompensas de baú são um union fechado — não existe
// variante que carregue PDL, CoinPoints, passe, energia, cargas, item Raro+ ou Lenda.

export type Talentos = Record<string, number>; // id do nó → nível comprado (0/ausente = nada)

// ---- Modificadores derivados da árvore (aplicados dentro de resolverGrind/cena) ----
export interface ModsGrind {
  duracaoMult: number; // multiplica a duração da partida (accumulation) — <1 = mais partidas no teto
  encenacaoMult: number; // multiplica a velocidade da ENCENAÇÃO (visual puro)
  golpeDuplo: number; // 0..1 chance de golpe duplo (visual)
  goldMult: number; // multiplica o $ por partida
  sucataMult: number; // multiplica a Sucata por partida
  barraMult: number; // multiplica a carga da barra de baú
  raroBonus: number; // + chance absoluta de tier Raro
  pityN: number; // baús até o Lendário garantido (nunca < piso)
  escolhaRaro: boolean; // baú Raro abre 2 opções e o jogador escolhe 1
}

export const MODS_NEUTROS: ModsGrind = {
  duracaoMult: 1,
  encenacaoMult: 1,
  golpeDuplo: 0,
  goldMult: 1,
  sucataMult: 1,
  barraMult: 1,
  raroBonus: 0,
  pityN: GRIND_PROP.pityLendarioN,
  escolhaRaro: false,
};

export function modsGrind(talentos: Talentos | undefined): ModsGrind {
  if (!talentos) return MODS_NEUTROS;
  const m: ModsGrind = { ...MODS_NEUTROS };
  let pityReducao = 0;
  for (const t of TALENTOS) {
    const nivel = Math.max(0, Math.min(t.nivelMax, Math.floor(talentos[t.id] ?? 0)));
    if (nivel === 0) continue;
    const e = t.efeito;
    if (e.duracao) m.duracaoMult -= e.duracao * nivel;
    if (e.encenacao) m.encenacaoMult += e.encenacao * nivel;
    if (e.golpeDuplo) m.golpeDuplo += e.golpeDuplo * nivel;
    if (e.gold) m.goldMult += e.gold * nivel;
    if (e.sucata) m.sucataMult += e.sucata * nivel;
    if (e.barra) m.barraMult += e.barra * nivel;
    if (e.raro) m.raroBonus += e.raro * nivel;
    if (e.pity) pityReducao += e.pity * nivel;
    if (e.escolha) m.escolhaRaro = true;
  }
  // guardas duras: a duração nunca some, o pity nunca fura o piso
  m.duracaoMult = Math.max(0.5, m.duracaoMult);
  m.golpeDuplo = Math.min(0.6, m.golpeDuplo);
  m.pityN = Math.max(GRIND_PROP.pityLendarioPiso, GRIND_PROP.pityLendarioN - pityReducao);
  return m;
}

// Árvore MAXIMIZADA (usada pela simulação econômica da Regra 4 e por testes).
export function talentosMaximos(): Talentos {
  return Object.fromEntries(TALENTOS.map((t) => [t.id, t.nivelMax]));
}

// ---- Custos e compra (Sucata é o ÚNICO recurso gasto) ----
export function custoTalento(t: DefTalento, nivelAtual: number): number {
  return Math.round(t.custoBase * Math.pow(t.custoMult, nivelAtual));
}

// Prereq: o nó anterior do MESMO ramo precisa de nível ≥ 1 (nó 1 é livre).
export function prereqOk(talentos: Talentos, t: DefTalento): boolean {
  if (t.ordem <= 1) return true;
  const anterior = TALENTOS.find((x) => x.ramo === t.ramo && x.ordem === t.ordem - 1);
  return !!anterior && (talentos[anterior.id] ?? 0) >= 1;
}

export type MotivoBloqueio = "max" | "prereq" | "sucata" | null;

export function bloqueioTalento(talentos: Talentos, sucata: number, id: string): MotivoBloqueio {
  const t = defTalento(id);
  if (!t) return "max";
  const nivel = talentos[id] ?? 0;
  if (nivel >= t.nivelMax) return "max";
  if (!prereqOk(talentos, t)) return "prereq";
  if (sucata < custoTalento(t, nivel)) return "sucata";
  return null;
}

// Compra PURA: devolve o novo par {talentos, sucata} ou null se não pode.
export function comprarTalento(talentos: Talentos, sucata: number, id: string): { talentos: Talentos; sucata: number; nivel: number } | null {
  if (bloqueioTalento(talentos, sucata, id) !== null) return null;
  const t = defTalento(id)!;
  const nivel = (talentos[id] ?? 0) + 1;
  return { talentos: { ...talentos, [id]: nivel }, sucata: sucata - custoTalento(t, nivel - 1), nivel };
}

// Respec: devolve TODA a Sucata investida (grátis — decisão documentada no CHANGELOG).
export function sucataInvestida(talentos: Talentos): number {
  let total = 0;
  for (const t of TALENTOS) {
    const nivel = Math.min(t.nivelMax, Math.max(0, Math.floor(talentos[t.id] ?? 0)));
    for (let n = 0; n < nivel; n++) total += custoTalento(t, n);
  }
  return total;
}

export function respec(talentos: Talentos, sucata: number): { talentos: Talentos; sucata: number } {
  return { talentos: {}, sucata: sucata + sucataInvestida(talentos) - GRIND_PROP.respecCusto };
}

// ---- Sucata por partida (representa os minions mortos na cena) ----
export function sucataDaPartida(seedPartida: number, mods: ModsGrind): number {
  const r = criarRng((seedPartida ^ 0x5ec4) >>> 0);
  const base = entre(r, GRIND_PROP.sucataPartidaMin, GRIND_PROP.sucataPartidaMax);
  return Math.max(1, Math.round(base * mods.sucataMult));
}

// ---- Barra de baú + rolagem de tier (pity OCULTO: proteção, não promessa) ----
export function cargaBarra(gold: number, mods: ModsGrind): number {
  return gold * mods.barraMult;
}

export interface RolagemBau {
  tier: TierBau;
  foiPity: boolean;
}

// `pityAtual` = baús abertos desde o último Lendário. Seed única por baú.
export function rolarTierBau(seedBau: number, pityAtual: number, mods: ModsGrind): RolagemBau {
  if (pityAtual + 1 >= mods.pityN) return { tier: "lendario", foiPity: true }; // garantia em ≤ N
  const r = criarRng((seedBau ^ 0xba05) >>> 0);
  const x = r();
  if (x < GRIND_PROP.chanceLendarioBase) return { tier: "lendario", foiPity: false };
  if (x < GRIND_PROP.chanceLendarioBase + GRIND_PROP.chanceRaroBase + mods.raroBonus) return { tier: "raro", foiPity: false };
  return { tier: "comum", foiPity: false };
}

// ---- Recompensas por tier (union FECHADO — Regra 2 por construção) ----
// Nenhuma variante carrega PDL, CoinPoints, passe, energia, cargas, item Raro+ ou Lenda.
export type RecompensaBau =
  | { tipo: "sucata"; valor: number }
  | { tipo: "dinheiro"; valor: number }
  | { tipo: "item"; slot: SlotGear; seedItem: number } // raridade capada na Comum por gerarItemGrind
  | { tipo: "maestria"; valor: number }
  | { tipo: "cosmetico"; id: string };

export interface BauRolado {
  tier: TierBau;
  numero: number; // n-ésimo baú da carreira (telemetria)
  foiPity: boolean;
  recompensas: RecompensaBau[]; // o que entra ao abrir
  opcoes?: RecompensaBau[][]; // Raro com "Segunda Chance": 2 pacotes, o jogador escolhe 1
}

function sorteioComum(r: Rng): RecompensaBau[] {
  const s = Math.round(entre(r, GRIND_PROP.comum.sucataMin, GRIND_PROP.comum.sucataMax));
  return [
    { tipo: "sucata", valor: s },
    { tipo: "dinheiro", valor: GRIND_PROP.comum.dinheiro },
  ];
}

// Raro: Sucata boa + $ + (item Comum OU pacote de maestria) — rolado por seed.
function sorteioRaro(r: Rng): RecompensaBau[] {
  const s = Math.round(entre(r, GRIND_PROP.raro.sucataMin, GRIND_PROP.raro.sucataMax));
  const extra: RecompensaBau =
    r() < 0.5
      ? { tipo: "item", slot: SLOTS_GEAR[Math.floor(r() * SLOTS_GEAR.length)].slot, seedItem: Math.floor(r() * 0x7fffffff) }
      : { tipo: "maestria", valor: GRIND_PROP.raro.maestriaPack };
  return [{ tipo: "sucata", valor: s }, { tipo: "dinheiro", valor: GRIND_PROP.raro.dinheiro }, extra];
}

// Lendário: 1 cosmético AINDA NÃO possuído + jackpot de Sucata.
// Coleção completa ⇒ vira jackpot TRIPLO (sem cosmético) — documentado.
function sorteioLendario(r: Rng, possuidos: string[]): RecompensaBau[] {
  const faltam = COLECAO_GRIND.filter((c) => !possuidos.includes(c.id));
  const jackpot = Math.round(entre(r, GRIND_PROP.lendario.sucataMin, GRIND_PROP.lendario.sucataMax));
  if (faltam.length === 0) return [{ tipo: "sucata", valor: jackpot * GRIND_PROP.lendario.jackpotColecaoCheia }];
  const escolhido = faltam[Math.floor(r() * faltam.length)];
  return [
    { tipo: "cosmetico", id: escolhido.id },
    { tipo: "sucata", valor: jackpot },
  ];
}

export function rolarBau(seedBau: number, numero: number, pityAtual: number, mods: ModsGrind, possuidos: string[]): BauRolado {
  const { tier, foiPity } = rolarTierBau(seedBau, pityAtual, mods);
  const r = criarRng((seedBau ^ 0xd0a4) >>> 0);
  if (tier === "comum") return { tier, numero, foiPity, recompensas: sorteioComum(r) };
  if (tier === "lendario") return { tier, numero, foiPity, recompensas: sorteioLendario(r, possuidos) };
  // Raro: com "Segunda Chance" abrimos 2 pacotes e o jogador escolhe 1
  if (mods.escolhaRaro) {
    const a = sorteioRaro(r);
    const b = sorteioRaro(r);
    return { tier, numero, foiPity, recompensas: a, opcoes: [a, b] };
  }
  return { tier, numero, foiPity, recompensas: sorteioRaro(r) };
}

// ---- Coleção ----
export function colecaoCompleta(possuidos: string[]): boolean {
  return COLECAO_GRIND.every((c) => possuidos.includes(c.id));
}

export function cosmeticoValido(id: string | undefined, possuidos: string[]): boolean {
  return !!id && possuidos.includes(id) && !!defCosmetico(id);
}
