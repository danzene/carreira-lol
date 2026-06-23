// 🎚️ Balanceamento da economia (Fase 4). Mantido apertado pra cada escolha doer.

export const ECONOMIA = {
  rendaBaseSemanal: 50, // entra toda semana (grind/apoio), mesmo sem time
  stream: { energia: 15, dinheiro: 45, moral: 3 }, // live: troca energia por grana
  setup: { custo: 400, mecanica: 2 }, // +2 mecânica permanente (1x)
  sessaoMental: { custo: 150, moral: 30, energia: 20 }, // recupera moral/energia
  bootcamp: { custo: 1200, semanas: 3, xpTotal: 12 }, // caro, consome semanas, +XP geral
  coach: { upkeepSemanal: 120, xpPorAtributo: 0.25 }, // assinatura: paga/semana, XP/semana
} as const;
