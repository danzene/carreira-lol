import { RECOMPENSAS_FREE, RECOMPENSAS_PREMIUM } from "@/data/passe";
import { podeColetarDiaria, puxadaGratisDisponivel } from "./diario";
import { podeResgatar, type PasseState } from "./passe";
import type { CareerState } from "./types";

// 🔴 Badges "tem coisa pra pegar" (PURO, derivado do estado — some ao resgatar/ver).
// Desafio de duelo recebido fica de fora por ora (depende de dado do servidor).

export interface Badges {
  booster: boolean; // puxada grátis diária disponível
  diaria: boolean; // recompensa de streak pra coletar
  passe: number; // recompensas do passe liberadas e não resgatadas
  inventario: number; // itens novos não vistos
}

export function getBadges(career: CareerState | null, passe: PasseState | null, itensNovos: number, hoje: string): Badges {
  const recompensasPasse = passe
    ? [...RECOMPENSAS_FREE, ...RECOMPENSAS_PREMIUM].filter((r) => podeResgatar(passe, r)).length
    : 0;
  return {
    booster: !!career && puxadaGratisDisponivel(career, hoje),
    diaria: !!career && podeColetarDiaria(career, hoje),
    passe: recompensasPasse,
    inventario: Math.max(0, itensNovos),
  };
}
