// 🎚️ Balanceamento da economia (Fase 6). Apertado pra cada escolha doer.
// (Os periféricos antigos foram removidos — o setup agora são os itens ARPG.
//  Custos históricos deles vivem na migração de save: engine/player.normalizarCareer.)

export const ECONOMIA = {
  rendaBaseSemanal: 80, // salário base sem time (stub) — por semana
  bonusBaseVitoria: 25, // bônus por vitória (stub)
  sessaoMental: { custo: 150, moral: 25, energia: 20 },
  bootcamp: { custo: 1500, semanas: 3, xpTotal: 14 }, // caro, consome semanas, +XP geral
  coach: { upkeepSemanal: 200, xpPorAtributo: 0.3 }, // assinatura: paga/semana, XP/semana
} as const;
