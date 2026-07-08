// 🗺️ Expedição — balanceamento (dados puros). O modo ATIVO e ARRISCADO do treino:
// "scrim hardcore" contra times acima do seu nível, em fases de dificuldade crescente.
// O jogador aposta profundidade (Continuar) contra a garantia do loot (Recuar).
//
// LISTA PROIBIDA (Regra 3): a Expedição só concede Sucata, cosméticos (via baú) e Ritmo
// de Treino (buff TEMPORÁRIO da próxima partida). NUNCA PDL/MMR, poder permanente de
// carreira, CoinPoints, passe, energia, cargas, item Raro+ ou Lenda. Morrer só custa o
// LOOT EM PROGRESSO — jamais o patrimônio da carreira.
//
// Números conservadores de propósito (buffar depois é fácil; nerfar revolta). Calibração
// final e simulação dupla no CHANGELOG-dois-modos.md (Fase 3).

export const EXPEDICAO = {
  // 🔌 sub-kill-switch (além do GRIND.habilitado global): false esconde a Expedição sem
  // tocar no passivo nem quebrar saves — o Treino continua rodando normal.
  habilitado: true,

  // 🎟️ limitador de entrada: a Expedição é o EVENTO do dia, não um moedor 24h. 3 corridas
  // por dia real (documentado). Some pra impedir a Expedição de substituir o passivo lento.
  maxPorDia: 3,

  // ❤️ vida do herói (só existe na Expedição). Deriva da forcaRota (~0..100).
  hpBase: 60,
  hpPorForca: 0.9, // hpMax = round(hpBase + forcaRota*hpPorForca) → força 50 ≈ 105 HP
  curaPorFase: 0.04, // +4% do hpMax ao LIMPAR (recuperação leve; não anula a morte)

  // 👹 força das fases (o "time acima do seu nível"). Boss a cada `faseBoss` fases.
  forcaFaseBase: 34,
  forcaFasePasso: 5.5, // +força por fase
  faseBoss: 5,
  bossMult: 1.35, // o boss da fase-marco bate mais forte

  // 🗡️ dano por fase: fração do hpMax escalada por (força da fase / poder do herói).
  // Quando a fase iguala o herói (razão 1), custa ~danoFracaoBase do HP. Fundo demais ⇒
  // razão > 1 ⇒ dano cresce ⇒ a morte se aproxima. O jitter seedado dá a TENSÃO (o
  // jogador vê um risco estimado, nunca o número exato).
  danoFracaoBase: 0.11,
  danoJitter: 0.18, // ±18% no dano (a incerteza que torna a aposta uma aposta)

  // 🔩 Sucata por fase — a fonte RÁPIDA (esforço/risco), contraste do passivo lento.
  // sucataFase = round(base * fase * (1 + (fase-1)*accel)) → superlinear (fase 10 >> fase 1).
  sucataFaseBase: 5,
  sucataFaseAccel: 0.16,

  // 🎁 baús — mais prováveis e de tier melhor no fundo. Boss garante 1 baú.
  chanceBauBase: 0.1,
  chanceBauPorFase: 0.015,
  raroBonusPorFase: 0.02, // fase funda melhora o tier (passado como raroBonus pro rolarBau)
  raroBonusMax: 0.35,

  // 👥 inimigos por fase (só encenação — o engine resolve por dano total)
  inimigosBase: 3,
  inimigosPorFase: 0.5,
} as const;

// 🔥 Ritmo de Treino — variantes desbloqueadas por PROFUNDIDADE. A corrida concede a
// MELHOR variante cujo `faseMin` foi alcançado (faseLimpa). Buff da PRÓXIMA partida,
// temporário/consumível/CAPADO e FORA do snapshot ranqueado (o "auge de preparo").
// Os bônus batem no teto RITMO_CAP (engine/expedicao.ts) — testado.
export const RITMO_VARIANTES = [
  { id: "aquecimento", nome: "Aquecimento", faseMin: 1, cargas: 1, bonusComp: 1, bonusCounter: 0 },
  { id: "scrim", nome: "Scrim", faseMin: 4, cargas: 1, bonusComp: 2, bonusCounter: 1 },
  { id: "scrim_elite", nome: "Scrim de Elite", faseMin: 8, cargas: 2, bonusComp: 4, bonusCounter: 2 },
] as const;

export type VarianteRitmo = (typeof RITMO_VARIANTES)[number];

// Nome de sabor da fase (o boss ganha destaque).
export function nomeFase(fase: number): string {
  if (fase % EXPEDICAO.faseBoss === 0) return `Fase ${fase} · BOSS`;
  return `Fase ${fase}`;
}

export function ehBoss(fase: number): boolean {
  return fase % EXPEDICAO.faseBoss === 0;
}

export function inimigosDaFase(fase: number): number {
  return Math.max(1, Math.round(EXPEDICAO.inimigosBase + fase * EXPEDICAO.inimigosPorFase) + (ehBoss(fase) ? 1 : 0));
}
