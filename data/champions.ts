import type { Classe } from "@/engine/types";

// 🎚️ Mapas do banco de campeões (editáveis). Tags do Data Dragon → classe;
// perfil base de cc/mobilidade/sustain por classe (dano/resistência vêm do `info`).

export const TAG_CLASSE: Record<string, Classe> = {
  Fighter: "LUTADOR",
  Tank: "TANK",
  Mage: "MAGO",
  Assassin: "ASSASSINO",
  Marksman: "ATIRADOR",
  Support: "SUPORTE",
};

export const CLASSE_PERFIL: Record<Classe, { cc: number; mobilidade: number; sustain: number }> = {
  TANK: { cc: 70, mobilidade: 25, sustain: 50 },
  LUTADOR: { cc: 45, mobilidade: 50, sustain: 55 },
  MAGO: { cc: 55, mobilidade: 35, sustain: 35 },
  ATIRADOR: { cc: 20, mobilidade: 40, sustain: 30 },
  ASSASSINO: { cc: 30, mobilidade: 75, sustain: 30 },
  SUPORTE: { cc: 65, mobilidade: 35, sustain: 50 },
};
