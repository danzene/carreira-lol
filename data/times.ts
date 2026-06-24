import type { Tier } from "@/engine/types";
import { TIMES_REGIONAIS } from "./regioes";

// Times por tier. AMADOR/ACADEMY são genéricos (a escada até o profissional);
// o TIER1 são as ligas PRO reais por região (CBLOL/LCK/LEC/LCS/LPL — ver data/regioes.ts).

export interface Time {
  id: string;
  nome: string;
  tier: Tier;
  prestigio: number; // 0–100
  instalacoes: number; // 0–100
  regiao?: string; // só nos times de Tier 1 (liga profissional)
}

const GENERICOS: Time[] = [
  // AMADOR
  { id: "meteoro", nome: "Meteoro Gaming", tier: "AMADOR", prestigio: 12, instalacoes: 12 },
  { id: "patos", nome: "Patos Gaming", tier: "AMADOR", prestigio: 15, instalacoes: 15 },
  { id: "vortex", nome: "Vortex Esports", tier: "AMADOR", prestigio: 22, instalacoes: 20 },
  { id: "lobos", nome: "Lobos do Sul", tier: "AMADOR", prestigio: 26, instalacoes: 24 },
  { id: "alvorada", nome: "Alvorada e-Sports", tier: "AMADOR", prestigio: 30, instalacoes: 28 },
  { id: "corvos", nome: "Corvos Negros", tier: "AMADOR", prestigio: 34, instalacoes: 30 },
  // ACADEMY
  { id: "nimbus", nome: "Nimbus Academy", tier: "ACADEMY", prestigio: 40, instalacoes: 42 },
  { id: "sentinela", nome: "Sentinela Academy", tier: "ACADEMY", prestigio: 44, instalacoes: 45 },
  { id: "eclipse", nome: "Eclipse Next", tier: "ACADEMY", prestigio: 47, instalacoes: 46 },
  { id: "fenix", nome: "Fênix Academy", tier: "ACADEMY", prestigio: 50, instalacoes: 48 },
  { id: "vanguarda", nome: "Vanguarda GG", tier: "ACADEMY", prestigio: 54, instalacoes: 52 },
  { id: "titans", nome: "Titans Next", tier: "ACADEMY", prestigio: 58, instalacoes: 55 },
];

export const TIMES: Time[] = [...GENERICOS, ...TIMES_REGIONAIS];

export function timeDe(id: string): Time | undefined {
  return TIMES.find((t) => t.id === id);
}

export function timesDoTier(tier: Tier): Time[] {
  return TIMES.filter((t) => t.tier === tier);
}
