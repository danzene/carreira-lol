import { PATCH } from "@/data/patch";
import { criarRng, entre, type Rng } from "./rng";
import type { ChampionDef, Role } from "./types";

const ROTAS: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

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

  const delta = new Map<string, number>();
  const alteracoes: AlteracaoPatch[] = [];

  // 2) POR ROTA: nerfa os mais fortes da rota e buffa os mais fracos — garante que toda
  //    rota muda a cada patch (não só o "top global"). Campeões multi-rota são deduplicados.
  for (const rota of ROTAS) {
    const daRota = ancorado
      .filter((c) => c.rolesValidas.includes(rota))
      .sort((a, b) => b.forcaMetaBase - a.forcaMetaBase);
    if (daRota.length === 0) continue;
    const terco = Math.max(1, Math.floor(daRota.length / 3));
    const buffar = embaralhar(daRota.slice(daRota.length - terco), rng).slice(0, PATCH.porRotaBuff);
    const nerfar = embaralhar(daRota.slice(0, terco), rng).slice(0, PATCH.porRotaNerf);
    for (const c of buffar) {
      if (delta.has(c.id)) continue;
      const d = Math.round(entre(rng, PATCH.buffMin, PATCH.buffMax));
      delta.set(c.id, d);
      alteracoes.push({ championId: c.id, nome: c.nome, delta: d, tipo: "buff" });
    }
    for (const c of nerfar) {
      if (delta.has(c.id)) continue;
      const d = -Math.round(entre(rng, PATCH.nerfMin, PATCH.nerfMax));
      delta.set(c.id, d);
      alteracoes.push({ championId: c.id, nome: c.nome, delta: d, tipo: "nerf" });
    }
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
