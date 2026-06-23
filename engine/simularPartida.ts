import { NIVEL, PESOS_ROTA, RANK, SIMULACAO } from "@/data/simulacao";
import { aplicarResultadoRank, eloDeMmr } from "./elo";
import { criarRng, entre, type Rng } from "./rng";
import type { Attributes, AtributoKey, CareerState, MatchResult, Player, Role } from "./types";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function somar(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// Força ponderada dos atributos relevantes da rota (0-100).
export function forcaRota(player: Player): number {
  let total = 0;
  for (const [chave, peso] of Object.entries(PESOS_ROTA[player.rota])) {
    total += player.atributos[chave as AtributoKey] * (peso ?? 0);
  }
  return total;
}

export function maestriaDoCampeao(player: Player, championId: string): number {
  const m = player.pool.find((p) => p.championId === championId);
  return m ? m.pontos : 0;
}

// Nível médio (0-100) dos jogadores do lobby, conforme o MMR.
export function nivelMedio(mmr: number): number {
  const n = (mmr - NIVEL.mmrBase) / NIVEL.mmrPorNivel + NIVEL.nivelMin;
  return clamp(n, NIVEL.nivelMin, NIVEL.nivelMax);
}

function gerarForcas(rng: Rng, nivel: number, n: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < n; i++) {
    arr.push(clamp(nivel + entre(rng, -SIMULACAO.espalhamentoLobby, SIMULACAO.espalhamentoLobby), 0, 100));
  }
  return arr;
}

function gerarKda(rng: Rng, rota: Role, nota: number, vitoria: boolean) {
  const fator = nota / 5; // ~0..2
  const baseKills = rota === "ADC" || rota === "MID" ? 6 : rota === "JUNGLE" || rota === "TOP" ? 4 : 2;
  const baseAssist = rota === "SUPPORT" ? 14 : rota === "JUNGLE" ? 9 : 6;
  const k = Math.max(0, Math.round(baseKills * fator + entre(rng, -1.5, 2)));
  const a = Math.max(0, Math.round(baseAssist * (0.6 + 0.4 * fator) + entre(rng, -2, 3)));
  const d = Math.max(0, Math.round(6 - nota * 0.4 + (vitoria ? -1 : 1) + entre(rng, -1, 2)));
  return { k, d, a };
}

function gerarCs(rng: Rng, rota: Role, nota: number): number {
  const baseCs =
    rota === "SUPPORT" ? 1.5 : rota === "JUNGLE" ? 5.5 : rota === "ADC" || rota === "MID" ? 8 : 7;
  return clamp(baseCs * (0.8 + 0.05 * nota) + entre(rng, -0.5, 0.5), 0, 12);
}

function gerarXp(player: Player, nota: number, nivel: number): Partial<Attributes> {
  const fatorNota = 0.5 + nota / 10; // 0.5..1.5
  const fatorLobby = 1 + clamp((nivel - forcaRota(player)) / 100, 0, 1) * SIMULACAO.xpBonusLobbyForte;
  const total = SIMULACAO.xpPorPartida * fatorNota * fatorLobby;

  const xp: Partial<Attributes> = {};
  for (const [chave, peso] of Object.entries(PESOS_ROTA[player.rota])) {
    const ganho = total * (peso ?? 0);
    if (ganho > 0) xp[chave as AtributoKey] = Math.round(ganho * 100) / 100;
  }
  return xp;
}

// Simula uma partida de soloq. Pura: (jogador, campeão, semente, modificador) -> resultado.
// `modificador` vem das decisões da partida interativa (engine/partida.ts); 0 = neutro.
export function simularPartida(player: Player, championId: string, seed: number, modificador = 0): MatchResult {
  const rng = criarRng(seed);

  // força individual -> dirige a NOTA
  const baseIndividual =
    SIMULACAO.pesoRota * forcaRota(player) + SIMULACAO.pesoCampeao * maestriaDoCampeao(player, championId);

  const estabilidade = (player.atributos.consistencia + player.atributos.mental) / 2; // 0-100
  const ampRuido = SIMULACAO.ruidoMax - (SIMULACAO.ruidoMax - SIMULACAO.ruidoMin) * (estabilidade / 100);
  const moralMod = (player.moral - 70) * SIMULACAO.pesoMoral; // moral alta ajuda, baixa atrapalha
  const forcaFinal = clamp(baseIndividual + entre(rng, -ampRuido, ampRuido) + moralMod + modificador, 0, 100);

  const nivel = nivelMedio(player.rankSoloq.mmr);

  // times: você + 4 aliados vs 5 inimigos
  const aliados = gerarForcas(rng, nivel, 4);
  const inimigos = gerarForcas(rng, nivel, 5);
  const mmrInimigo = player.rankSoloq.mmr + Math.round(entre(rng, -60, 60));

  const forcaTime = (forcaFinal + somar(aliados)) / 5;
  const forcaInimigo = somar(inimigos) / 5;
  const pVitoria = 1 / (1 + Math.exp(-SIMULACAO.sensibilidadeVitoria * (forcaTime - forcaInimigo)));
  const vitoria = rng() < pVitoria;

  // nota: força individual vs expectativa do lobby (alta mesmo em derrota)
  const nota = clamp(
    SIMULACAO.notaBase +
      (forcaFinal - nivel) * SIMULACAO.notaPorPontoAcima +
      entre(rng, -SIMULACAO.notaRuido, SIMULACAO.notaRuido),
    0,
    10,
  );

  const kda = gerarKda(rng, player.rota, nota, vitoria);
  const csPorMin = gerarCs(rng, player.rota, nota);
  const { lpDelta } = aplicarResultadoRank(player.rankSoloq, vitoria, mmrInimigo);
  const xpGanho = gerarXp(player, nota, nivel);

  return {
    vitoria,
    kda,
    notaPerformance: Math.round(nota * 10) / 10,
    csPorMin: Math.round(csPorMin * 10) / 10,
    championId,
    lpDelta,
    xpGanho,
  };
}

function aplicarXp(attrs: Attributes, xp: Partial<Attributes>): Attributes {
  const novo: Attributes = { ...attrs };
  (Object.keys(xp) as AtributoKey[]).forEach((k) => {
    novo[k] = clamp(Math.round((novo[k] + (xp[k] ?? 0)) * 100) / 100, 0, 100);
  });
  return novo;
}

// Aplica o resultado ao estado da carreira (rank, XP, histórico). Pura.
export function aplicarResultado(career: CareerState, resultado: MatchResult): CareerState {
  const { player } = career;
  const novoMmr = Math.max(RANK.mmrBase, player.rankSoloq.mmr + (resultado.lpDelta ?? 0));
  const { elo, lp } = eloDeMmr(novoMmr);

  return {
    ...career,
    player: {
      ...player,
      rankSoloq: { elo, lp, mmr: novoMmr },
      atributos: aplicarXp(player.atributos, resultado.xpGanho),
    },
    historicoPartidas: [resultado, ...career.historicoPartidas].slice(0, 50),
  };
}
