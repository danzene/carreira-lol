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

  // 🎟️ limitador de entrada: a Expedição é o EVENTO do dia, não um moedor 24h. 2 corridas
  // por dia real (documentado). Segura a Expedição pra não substituir o passivo lento nem
  // furar o horizonte da árvore (~1,5-2,5 meses combinado — ver simulação no CHANGELOG).
  maxPorDia: 2,

  // ❤️ vida do herói (só existe na Expedição). Deriva da forcaRota (~0..100).
  hpBase: 60,
  hpPorForca: 0.9, // hpMax = round(hpBase + forcaRota*hpPorForca) → força 50 ≈ 105 HP
  curaPorFase: 0.04, // +4% do hpMax ao LIMPAR (recuperação leve; não anula a morte)

  // 👹 força das fases (o "time acima do seu nível"). Boss a cada `faseBoss` fases.
  forcaFaseBase: 34,
  forcaFasePasso: 5.5, // +força por fase
  faseBoss: 5,
  bossMult: 1.35, // o boss da fase-marco bate mais forte

  // 🗡️ dano por onda: fração do hpMax escalada por (força da onda / poder do herói).
  // RECALIBRADO na rodada Jornada (0.11→0.14): o gauntlet agora é só o DESAFIO DE
  // REGIÃO — o boss precisa ter dente (região 1 vencível sem skills ~metade das vezes;
  // regiões fundas exigem investir em skills defensivas). Números no CHANGELOG-jornada.
  danoFracaoBase: 0.15,
  danoJitter: 0.28, // ±28% no dano — a incerteza que torna a aposta uma aposta (suaviza o
  // precipício da soma de 5 ondas: sem jitter alto, 0.14→83% e 0.16→2% de vitória)

  // 🔩 Sucata por fase — bônus MODESTO (o passivo continua a espinha da Sucata; a Expedição
  // NÃO é um farm de Sucata — seu valor real é Ritmo + cosméticos + o recorde de profundidade).
  // Deliberadamente pequena: o passivo sozinho já enche o horizonte da árvore (~57 dias), então
  // deixar a Expedição render muito FURARIA o teto de ~1,5-2,5 meses (ver simulação no CHANGELOG).
  // sucataFase = round(base * fase * (1 + (fase-1)*accel)) → superlinear (fase 10 > fase 1).
  // Base pequena de propósito: a SOMA sobre muitas fases é o que conta (uma corrida funda
  // passa por ~10 fases). Calibrado pra Expedição render ~o dobro de um dia passivo, não mais.
  sucataFaseBase: 0.13,
  sucataFaseAccel: 0.14,

  // 🎁 baús — mais prováveis e de tier melhor no fundo. Boss (a cada 5 fases) garante 1 baú;
  // fora dele a chance é modesta (o baú é bônus de cosmético, não uma torneira de Sucata).
  chanceBauBase: 0.05,
  chanceBauPorFase: 0.008,
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
// faseMin na escala do DESAFIO DE REGIÃO (gauntlet de 5 ondas terminando no boss):
// região 1 = ondas 6..10 ⇒ qualquer avanço dá Aquecimento, chegar perto do boss dá
// Scrim e MATAR o boss dá o Scrim de Elite. Regiões fundas dão elite direto (capado).
export const RITMO_VARIANTES = [
  { id: "aquecimento", nome: "Aquecimento", faseMin: 6, cargas: 1, bonusComp: 1, bonusCounter: 0 },
  { id: "scrim", nome: "Scrim", faseMin: 8, cargas: 1, bonusComp: 2, bonusCounter: 1 },
  { id: "scrim_elite", nome: "Scrim de Elite", faseMin: 10, cargas: 2, bonusComp: 4, bonusCounter: 2 },
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
