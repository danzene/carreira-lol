import type { AtributoKey, Equip } from "@/engine/types";

// 🎚️ Balanceamento da economia (Fase 6). Apertado pra cada escolha doer.

export const ECONOMIA = {
  rendaBaseSemanal: 80, // salário base sem time (stub) — por semana
  bonusBaseVitoria: 25, // bônus por vitória (stub)
  sessaoMental: { custo: 150, moral: 25, energia: 20 },
  bootcamp: { custo: 1500, semanas: 3, xpTotal: 14 }, // caro, consome semanas, +XP geral
  coach: { upkeepSemanal: 200, xpPorAtributo: 0.3 }, // assinatura: paga/semana, XP/semana
  custoEquipBase: 200,
  custoEquipPorNivel: 250,
} as const;

export const EQUIP_MAX_NIVEL = 5;

// Cada periférico melhora 1 atributo; bônus acumula por nível.
export const EQUIP_INFO: Record<Equip["tipo"], { nome: string; icone: string; atributo: AtributoKey; bonusPorNivel: number }> = {
  HEADSET: { nome: "Headset", icone: "🎧", atributo: "comunicacao", bonusPorNivel: 2 },
  MOUSE: { nome: "Mouse", icone: "🖱️", atributo: "mecanica", bonusPorNivel: 2 },
  CADEIRA: { nome: "Cadeira", icone: "🪑", atributo: "consistencia", bonusPorNivel: 2 },
  MONITOR: { nome: "Monitor", icone: "🖥️", atributo: "laning", bonusPorNivel: 2 },
};
