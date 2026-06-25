import {
  GACHA,
  LENDAS,
  RARIDADES,
  SINERGIA,
  SUBSTATS,
  defSub,
  infoRaridade,
  modeloLenda,
  type Estilo,
  type ModeloLenda,
  type Raridade,
} from "@/data/gacha";
import { criarRng, entre, type Rng } from "./rng";
import type { Attributes, AtributoKey, CareerState, LendaPossuida, SubstatValor } from "./types";

// Scout Gacha (PURO): puxadas, rolagem de substats, duplicata → nível e efeitos das lendas.

export interface ResultadoPuxada {
  id: string;
  raridade: Raridade;
  novo: boolean;
  nivel: number;
  substats: SubstatValor[];
}

function rolarSubstats(r: Raridade, rng: Rng): SubstatValor[] {
  const info = infoRaridade(r);
  const qtd = Math.round(entre(rng, info.subMin, info.subMax));
  const pool = [...SUBSTATS];
  const subs: SubstatValor[] = [];
  for (let i = 0; i < qtd && pool.length > 0; i++) {
    const def = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const [min, max] = def.faixa[r];
    subs.push({ chave: def.chave, valor: Math.round(entre(rng, min, max)) });
  }
  return subs;
}

function sortearRaridade(rng: Rng, pity: number): Raridade {
  const x = rng();
  let acc = 0;
  let r: Raridade = 3;
  for (const info of RARIDADES) {
    acc += info.chance;
    if (x < acc) {
      r = info.n;
      break;
    }
  }
  if (r < 5 && pity + 1 >= GACHA.pity5) return 5; // pity garante 5★
  return r;
}

function lendaAleatoria(r: Raridade, rng: Rng): string {
  const cand = LENDAS.filter((l) => l.raridade === r);
  return cand[Math.floor(rng() * cand.length)].id;
}

function soma(subs: SubstatValor[]): number {
  return subs.reduce((s, x) => s + x.valor, 0);
}

function puxarUma(lendas: LendaPossuida[], rng: Rng, pity: number): { resultado: ResultadoPuxada; lendas: LendaPossuida[]; pity: number } {
  const r = sortearRaridade(rng, pity);
  const id = lendaAleatoria(r, rng);
  const substats = rolarSubstats(r, rng);
  const existente = lendas.find((l) => l.id === id);

  let novo = false;
  let nivel = 1;
  let novas: LendaPossuida[];
  if (existente) {
    nivel = Math.min(GACHA.nivelMax, existente.nivel + 1);
    // duplicata: sobe nível e fica com o melhor roll de substats
    const melhores = soma(substats) > soma(existente.substats) ? substats : existente.substats;
    novas = lendas.map((l) => (l.id === id ? { ...l, nivel, substats: melhores } : l));
  } else {
    novo = true;
    novas = [...lendas, { id, nivel: 1, substats }];
  }
  return { resultado: { id, raridade: r, novo, nivel, substats }, lendas: novas, pity: r >= 5 ? 0 : pity + 1 };
}

// A moeda (CoinPoints) é POR CONTA, gerida no servidor (profileStore). Aqui é só a RNG.
export function puxar(career: CareerState, qtd: number, seed: number): { career: CareerState; resultados: ResultadoPuxada[] } {
  const rng = criarRng(seed >>> 0);
  let pity = career.pity ?? 0;
  let lendas = career.lendas ?? [];
  const resultados: ResultadoPuxada[] = [];
  for (let i = 0; i < qtd; i++) {
    const passo = puxarUma(lendas, rng, pity);
    lendas = passo.lendas;
    pity = passo.pity;
    resultados.push(passo.resultado);
  }
  return { career: { ...career, lendas, pity }, resultados };
}

export interface ResultadoCampeao {
  championId: string;
  novo: boolean;
  pontos: number;
}

// Carta de Campeão: entra no pool (ou sobe a maestria). O custo (CoinPoints) é cobrado no
// servidor (profileStore) pela UI; aqui só aplicamos o ganho.
export function ganharCampeao(career: CareerState, championId: string): { career: CareerState; resultado: ResultadoCampeao } {
  const pool = career.player.pool;
  const existe = pool.find((p) => p.championId === championId);
  let novo = false;
  let pontos: number;
  let novoPool;
  if (existe) {
    pontos = Math.min(100, Math.round((existe.pontos + GACHA.maestriaDupCampeao) * 10) / 10);
    novoPool = pool.map((p) => (p.championId === championId ? { ...p, pontos } : p));
  } else {
    novo = true;
    pontos = GACHA.maestriaNovoCampeao;
    novoPool = [...pool, { championId, pontos }];
  }
  return {
    career: { ...career, player: { ...career.player, pool: novoPool } },
    resultado: { championId, novo, pontos },
  };
}

// Liga/desliga uma lenda (toggle). Respeita o limite de slots e só equipa o que possui.
export function equipar(career: CareerState, id: string): CareerState {
  const eq = career.lendasEquipadas ?? [];
  if (eq.includes(id)) return { ...career, lendasEquipadas: eq.filter((x) => x !== id) };
  if (eq.length >= GACHA.slots) return career;
  if (!(career.lendas ?? []).some((l) => l.id === id)) return career;
  return { ...career, lendasEquipadas: [...eq, id] };
}

// ---- Efeitos das lendas equipadas (somados) ----
export interface EfeitoLendas {
  atributos: Partial<Attributes>;
  xpMult: number;
  dinheiroMult: number;
  reducaoDecaimento: number; // 0..0.8
  bonusComp: number;
}

function aplicarChave(ef: EfeitoLendas, chave: string, valor: number): void {
  const tipo = defSub(chave)?.tipo ?? "atributo";
  if (tipo === "atributo") ef.atributos[chave as AtributoKey] = (ef.atributos[chave as AtributoKey] ?? 0) + valor;
  else if (tipo === "xp") ef.xpMult += valor / 100;
  else if (tipo === "dinheiro") ef.dinheiroMult += valor / 100;
  else if (tipo === "decaimento") ef.reducaoDecaimento += valor / 100;
  else if (tipo === "comp") ef.bonusComp += valor;
}

export function efeitoLendas(career: CareerState): EfeitoLendas {
  const ef: EfeitoLendas = { atributos: {}, xpMult: 1, dinheiroMult: 1, reducaoDecaimento: 0, bonusComp: 0 };
  for (const id of career.lendasEquipadas ?? []) {
    const possuida = (career.lendas ?? []).find((l) => l.id === id);
    const modelo = modeloLenda(id);
    if (!possuida || !modelo) continue;
    const escala = 1 + (possuida.nivel - 1) * 0.15; // passivo escala com o nível
    aplicarChave(ef, modelo.passivo.chave, modelo.passivo.valor * escala);
    for (const s of possuida.substats) aplicarChave(ef, s.chave, s.valor);
  }

  // ---- sinergias (combos de cartas equipadas) ----
  const equip = (career.lendasEquipadas ?? []).map((id) => modeloLenda(id)).filter((m): m is ModeloLenda => Boolean(m));
  const contagem: Record<string, number> = {};
  for (const m of equip) contagem[m.estilo] = (contagem[m.estilo] ?? 0) + 1;
  for (const [estilo, n] of Object.entries(contagem)) {
    if (n >= 2) aplicarChave(ef, SINERGIA[estilo as Estilo].chave, SINERGIA[estilo as Estilo].valor * (n - 1));
  }
  if (equip.length >= GACHA.slots) {
    for (const def of SUBSTATS) if (def.tipo === "atributo") aplicarChave(ef, def.chave, 2); // entrosamento
  }
  if (Object.keys(contagem).length >= GACHA.slots) aplicarChave(ef, "xp", 8); // versátil

  (Object.keys(ef.atributos) as AtributoKey[]).forEach((k) => {
    ef.atributos[k] = Math.round((ef.atributos[k] ?? 0) * 10) / 10;
  });
  ef.reducaoDecaimento = Math.min(0.8, ef.reducaoDecaimento);
  ef.bonusComp = Math.round(ef.bonusComp);
  return ef;
}

// Rótulos das sinergias ativas (pra exibir na UI).
export function sinergiasAtivas(career: CareerState): string[] {
  const equip = (career.lendasEquipadas ?? []).map((id) => modeloLenda(id)).filter((m): m is ModeloLenda => Boolean(m));
  const contagem: Record<string, number> = {};
  for (const m of equip) contagem[m.estilo] = (contagem[m.estilo] ?? 0) + 1;
  const out: string[] = [];
  for (const [estilo, n] of Object.entries(contagem)) {
    if (n >= 2) {
      const s = SINERGIA[estilo as Estilo];
      out.push(`${estilo} ×${n}: +${s.valor * (n - 1)} ${defSub(s.chave)?.rotulo ?? s.chave}`);
    }
  }
  if (equip.length >= GACHA.slots) out.push("Trio completo: +2 em tudo");
  if (Object.keys(contagem).length >= GACHA.slots) out.push("Versátil: +8% XP");
  return out;
}
