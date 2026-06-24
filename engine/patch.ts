import { PATCH } from "@/data/patch";
import { criarRng, entre, type Rng } from "./rng";
import type { ChampionDef } from "./types";

// Auto Patch (PURO): dado o número do patch, aplica buffs/nerfs determinísticos na
// forcaMetaBase dos campeões. As rotas (rolesValidas) NUNCA mudam.

export interface AlteracaoPatch {
  championId: string;
  nome: string;
  delta: number; // + buff, - nerf
  tipo: "buff" | "nerf";
}

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

// Versão fictícia estilo LoL: "25.N".
export function versaoPatch(patch: number): string {
  return `25.${patch}`;
}

// Lista de buffs/nerfs do patch (vazia no patch 1 = meta base/real).
export function alteracoesDoPatch(banco: ChampionDef[], patch: number): AlteracaoPatch[] {
  if (patch <= 1 || banco.length === 0) return [];
  const rng = criarRng((patch * 2654435761) >>> 0);
  const ordem = embaralhar(banco, rng);
  const alts: AlteracaoPatch[] = [];

  const nBuffs = Math.min(PATCH.qtdBuffs, ordem.length);
  for (let i = 0; i < nBuffs; i++) {
    const c = ordem[i];
    alts.push({ championId: c.id, nome: c.nome, delta: Math.round(entre(rng, PATCH.buffMin, PATCH.buffMax)), tipo: "buff" });
  }
  const nNerfs = Math.min(PATCH.qtdNerfs, ordem.length - nBuffs);
  for (let j = nBuffs; j < nBuffs + nNerfs; j++) {
    const c = ordem[j];
    alts.push({ championId: c.id, nome: c.nome, delta: -Math.round(entre(rng, PATCH.nerfMin, PATCH.nerfMax)), tipo: "nerf" });
  }
  return alts;
}

// Aplica o patch ao banco: novo banco com forcaMetaBase ajustada (rotas intactas).
export function aplicarPatch(banco: ChampionDef[], patch: number): ChampionDef[] {
  const alts = alteracoesDoPatch(banco, patch);
  if (alts.length === 0) return banco;
  const deltas = new Map(alts.map((a) => [a.championId, a.delta]));
  return banco.map((c) => {
    const d = deltas.get(c.id);
    return d === undefined ? c : { ...c, forcaMetaBase: clamp(c.forcaMetaBase + d, PATCH.metaMin, PATCH.metaMax) };
  });
}
