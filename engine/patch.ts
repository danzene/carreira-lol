import { PATCH } from "@/data/patch";
import { criarRng, entre, type Rng } from "./rng";
import type { ChampionDef } from "./types";

// Auto Patch (PURO): a meta evolui como a Riot balanceia — a cada patch os campeões mais
// FORTES tendem a ser nerfados e os mais FRACOS buffados, com uma reversão leve à força
// real (Oracle's Elixir) pra manter a identidade. Cumulativo e determinístico por patch.
// As rotas (rolesValidas) NUNCA mudam.

export interface AlteracaoPatch {
  championId: string;
  nome: string;
  delta: number; // + buff, - nerf
  tipo: "buff" | "nerf";
}

const SEMENTE = 2654435761;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function embaralhar<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function forcaReal(banco: ChampionDef[]): Map<string, number> {
  return new Map(banco.map((c) => [c.id, c.forcaMetaBase]));
}

// Versão fictícia estilo LoL: "25.N".
export function versaoPatch(patch: number): string {
  return `25.${patch}`;
}

// Um patch: ancora à força real, nerfa os fortes e buffa os fracos. Devolve o banco
// ajustado e as alterações daquele patch (para as patch notes).
function passoDePatch(
  atual: ChampionDef[],
  base: Map<string, number>,
  patch: number,
): { banco: ChampionDef[]; alteracoes: AlteracaoPatch[] } {
  const rng = criarRng((patch * SEMENTE) >>> 0);

  // 1) reversão leve à força real (mantém spread e identidade)
  const ancorado = atual.map((c) => {
    const real = base.get(c.id) ?? c.forcaMetaBase;
    return { ...c, forcaMetaBase: c.forcaMetaBase + (real - c.forcaMetaBase) * PATCH.ancora };
  });

  // 2) terço mais forte vira pool de nerf; terço mais fraco, pool de buff (sem sobreposição)
  const porForca = [...ancorado].sort((a, b) => b.forcaMetaBase - a.forcaMetaBase);
  const terco = Math.max(1, Math.floor(porForca.length / 3));
  const poolNerf = porForca.slice(0, terco);
  const poolBuff = porForca.slice(porForca.length - terco);
  const nerfados = embaralhar(poolNerf, rng).slice(0, Math.min(PATCH.qtdNerfs, poolNerf.length));
  const buffados = embaralhar(poolBuff, rng).slice(0, Math.min(PATCH.qtdBuffs, poolBuff.length));

  const delta = new Map<string, number>();
  const alteracoes: AlteracaoPatch[] = [];
  for (const c of buffados) {
    const d = Math.round(entre(rng, PATCH.buffMin, PATCH.buffMax));
    delta.set(c.id, d);
    alteracoes.push({ championId: c.id, nome: c.nome, delta: d, tipo: "buff" });
  }
  for (const c of nerfados) {
    if (delta.has(c.id)) continue;
    const d = -Math.round(entre(rng, PATCH.nerfMin, PATCH.nerfMax));
    delta.set(c.id, d);
    alteracoes.push({ championId: c.id, nome: c.nome, delta: d, tipo: "nerf" });
  }

  const banco = ancorado.map((c) => {
    const d = delta.get(c.id) ?? 0;
    return { ...c, forcaMetaBase: clamp(Math.round(c.forcaMetaBase + d), PATCH.metaMin, PATCH.metaMax) };
  });
  return { banco, alteracoes };
}

// Banco com a meta do patch N (acumula do patch 2 até N). Patch 1 = meta base/real.
export function aplicarPatch(banco: ChampionDef[], patch: number): ChampionDef[] {
  if (patch <= 1 || banco.length === 0) return banco;
  const base = forcaReal(banco);
  let atual = banco;
  for (let p = 2; p <= patch; p++) atual = passoDePatch(atual, base, p).banco;
  return atual;
}

// O que mudou NESTE patch (buffs/nerfs) — para as patch notes.
export function alteracoesDoPatch(banco: ChampionDef[], patch: number): AlteracaoPatch[] {
  if (patch <= 1 || banco.length === 0) return [];
  const base = forcaReal(banco);
  let atual = banco;
  for (let p = 2; p < patch; p++) atual = passoDePatch(atual, base, p).banco;
  return passoDePatch(atual, base, patch).alteracoes;
}
