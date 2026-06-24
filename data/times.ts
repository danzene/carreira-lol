import type { Tier } from "@/engine/types";

// Times fictícios por tier (arte/identidade originais). prestigio = nível exigido de
// reputação; instalacoes = bônus de velocidade de treino. 6 times por tier para formar
// ligas de verdade (todos-contra-todos + playoffs). SOLOQ não tem liga.

export interface Time {
  id: string;
  nome: string;
  tier: Tier;
  prestigio: number; // 0–100
  instalacoes: number; // 0–100
}

export const TIMES: Time[] = [
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
  // TIER1
  { id: "fulgor", nome: "Fulgor", tier: "TIER1", prestigio: 64, instalacoes: 66 },
  { id: "imperio", nome: "Império", tier: "TIER1", prestigio: 68, instalacoes: 72 },
  { id: "dinastia", nome: "Dinastia", tier: "TIER1", prestigio: 74, instalacoes: 78 },
  { id: "leviata", nome: "Leviatã", tier: "TIER1", prestigio: 78, instalacoes: 82 },
  { id: "colosso", nome: "Colosso", tier: "TIER1", prestigio: 82, instalacoes: 85 },
  { id: "aurora", nome: "Aurora Boreal", tier: "TIER1", prestigio: 86, instalacoes: 88 },
  // INTERNACIONAL (Mundial)
  { id: "dragoes", nome: "Dragões do Oriente", tier: "INTERNACIONAL", prestigio: 90, instalacoes: 92 },
  { id: "genesis", nome: "Gênesis", tier: "INTERNACIONAL", prestigio: 92, instalacoes: 93 },
  { id: "kry", nome: "KRY", tier: "INTERNACIONAL", prestigio: 94, instalacoes: 95 },
  { id: "hanwa", nome: "Hanwa", tier: "INTERNACIONAL", prestigio: 96, instalacoes: 96 },
  { id: "olimpo", nome: "Olimpo", tier: "INTERNACIONAL", prestigio: 98, instalacoes: 99 },
  { id: "mirai", nome: "Mirai", tier: "INTERNACIONAL", prestigio: 99, instalacoes: 99 },
];

export function timeDe(id: string): Time | undefined {
  return TIMES.find((t) => t.id === id);
}

export function timesDoTier(tier: Tier): Time[] {
  return TIMES.filter((t) => t.tier === tier);
}
