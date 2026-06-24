import type { Tier } from "@/engine/types";

// Times fictícios por tier (arte/identidade originais). prestigio = nível exigido de
// reputação; instalacoes = bônus de velocidade de treino.

export interface Time {
  id: string;
  nome: string;
  tier: Tier;
  prestigio: number; // 0–100
  instalacoes: number; // 0–100
}

export const TIMES: Time[] = [
  // AMADOR
  { id: "patos", nome: "Patos Gaming", tier: "AMADOR", prestigio: 15, instalacoes: 15 },
  { id: "vortex", nome: "Vortex Esports", tier: "AMADOR", prestigio: 22, instalacoes: 20 },
  { id: "alvorada", nome: "Alvorada e-Sports", tier: "AMADOR", prestigio: 30, instalacoes: 28 },
  // ACADEMY
  { id: "nimbus", nome: "Nimbus Academy", tier: "ACADEMY", prestigio: 40, instalacoes: 42 },
  { id: "fenix", nome: "Fênix Academy", tier: "ACADEMY", prestigio: 50, instalacoes: 48 },
  { id: "titans", nome: "Titans Next", tier: "ACADEMY", prestigio: 58, instalacoes: 55 },
  // TIER1
  { id: "imperio", nome: "Império", tier: "TIER1", prestigio: 68, instalacoes: 72 },
  { id: "leviata", nome: "Leviatã", tier: "TIER1", prestigio: 78, instalacoes: 82 },
  { id: "aurora", nome: "Aurora Boreal", tier: "TIER1", prestigio: 86, instalacoes: 88 },
  // INTERNACIONAL
  { id: "dragoes", nome: "Dragões do Oriente", tier: "INTERNACIONAL", prestigio: 93, instalacoes: 95 },
  { id: "olimpo", nome: "Olimpo", tier: "INTERNACIONAL", prestigio: 98, instalacoes: 99 },
];

export function timeDe(id: string): Time | undefined {
  return TIMES.find((t) => t.id === id);
}
