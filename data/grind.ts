import type { RaridadeItem } from "./itens";

// 🛋️ Grind de Normais (camada idle) — balanceamento. Renda passiva COM TETO que
// alimenta as BORDAS da progressão ($ pequeno, maestria, drop Comum), nunca o núcleo.
//
// REGRA 1 (inviolável): o grind NUNCA concede PDL/MMR, CoinPoints, progresso de passe,
// energia, cargas, itens Raros+ nem Lendas/pity. Teste automatizado varre isso.
//
// RAZÃO vs jogo ativo (documentada; validada por SIMULAÇÃO de 4 semanas em
// engine/grind.test.ts — critério: grind no teto ≤ ~20% da progressão ativa):
//   soloq ativa paga $25/vitória → normal paga $2/vitória (8%); derrota NÃO paga $
//   (derrota só dá maestria — mantém a razão econômica CONSTANTE, imune ao winrate:
//    $ = 13.3% e maestria = 16.7% do ativo, qualquer que seja o WR do jogador)
//   soloq dá maestria +4 V / +1.5 D → normal dá +0.4 (10%) / +0.15 (10%)
//   soloq dropa 25%/vitória (qualquer raridade) → normal 7%/vitória, SEMPRE Comum
//   (o jogo não tem tier "Incomum": a Regra 1 proíbe "Rara ou acima" e a raridade 2
//    do jogo se chama "Raro" → cap na Comum. Buffar depois é fácil; nerfar revolta.)
// É mais fácil BUFFAR depois do que nerfar — começamos conservador de propósito.

export const GRIND = {
  // 🔌 kill switch global: false desliga o widget/heartbeat em 1 deploy, sem quebrar saves.
  habilitado: true,

  // ⏱️ tempo (SEGUNDOS DE ABA VISÍVEL — nunca relógio do cliente; ver Regra 5)
  tetoSegundosDia: 3 * 3600, // rende no máx. 3h de ganho por dia real
  duracaoMinSeg: 480, // uma normal dura 8..10 min de tempo ativo…
  duracaoMaxSeg: 600, // …sorteado por seed (determinístico)

  // 💰 recompensas por partida (Regra 2: SÓ isto)
  dinheiroVitoria: 2,
  dinheiroDerrota: 0, // derrota não paga $ (razão econômica constante — ver acima)
  maestriaVitoria: 0.4,
  maestriaDerrota: 0.15,
  dropChance: 0.07, // só em vitória
  dropRaridade: 1 as RaridadeItem, // SEMPRE Comum (cap inviolável — Regra 1)

  // 🥊 adversário procedural (normal é casual: sem dificuldade de elo, times ~neutros)
  forcaInimigaMin: 47,
  forcaInimigaMax: 53,
} as const;

// Nicks procedurais dos adversários de fila normal (só sabor pro widget).
export const NICKS_GRIND = [
  "xXShadowBladeXx", "MidOuAfk", "TioDoLanche", "FarmSimulator", "JinxDaDepressao",
  "PatoNoMid", "SmurfDoVizinho", "GankaNatural", "WardEhMeuPai", "FlashNoChao",
  "CegoDeWard", "BaronPowerplay", "TiltadoFeliz", "InvadeEChora", "SuporteDeFerro",
  "LordDosMinions", "PingaMaisJoga", "DivedeCego", "MacacoLoko", "RunaErrada",
  "TpNaBase", "CanhaoDeMana", "JuninhoDoTop", "AramLover",
] as const;
