import { GACHA } from "@/data/gacha";
import { mod } from "@/data/opcoes";
import { PESOS_ROTA, RANK, SIMULACAO } from "@/data/simulacao";
import { aplicarResultadoRank, eloDeMmr } from "./elo";
import { efeitoLendas } from "./gacha";
import { criarRng, entre, type Rng } from "./rng";
import type { Attributes, AtributoKey, CareerState, ChampionMastery, MatchResult, Player, Role, TraitId } from "./types";

// Motor de partida (auto-battle). PURO: (jogador, contexto do draft, semente) -> resultado.

export interface ContextoPartida {
  championId: string;
  forcaMetaCampeao: number; // forcaMetaBase do ChampionDef escolhido
  comp: number; // forcaComp do seu time (resultado do draft)
  compInimigo: number; // forcaComp do inimigo
  bonusAtributos?: Partial<Attributes>; // bônus de periféricos (Fase 6)
  forcaTimeAliado?: number; // força do seu time (partida oficial; senão usa a base)
  forcaTimeInimigo?: number; // força do time adversário (partida oficial)
  bonusInimigo?: number; // dificuldade (Fase 11): força extra do inimigo
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function forcaRota(player: Player, bonus: Partial<Attributes> = {}): number {
  let total = 0;
  for (const [chave, peso] of Object.entries(PESOS_ROTA[player.rota])) {
    const k = chave as AtributoKey;
    total += (player.atributos[k] + (bonus[k] ?? 0)) * (peso ?? 0);
  }
  return total;
}

function maestria(player: Player, championId: string): number {
  return player.pool.find((p) => p.championId === championId)?.pontos ?? 0;
}

// Modificadores dos traços: bônus de força + multiplicador de variância.
function modTracos(tracos: TraitId[], desvantagem: boolean): { forca: number; ruidoMult: number } {
  let forca = 0;
  let ruidoMult = 1;
  for (const t of tracos) {
    if (t === "LANE_BULLY" || t === "SHOTCALLER") forca += 2;
    else if (t === "ROAMER" || t === "FLEX" || t === "CARRY_TARDIO") forca += 1;
    else if (t === "FRIO") ruidoMult *= 0.8;
    else if (t === "AGRESSIVO") {
      ruidoMult *= 1.25;
      forca += 1;
    } else if (t === "TILTAVEL") {
      ruidoMult *= 1.3;
      forca -= 1;
    } else if (t === "CLUTCH" && desvantagem) forca += 4;
  }
  return { forca, ruidoMult };
}

function gerarKda(rng: Rng, rota: Role, nota: number, vitoria: boolean) {
  const fator = nota / 5;
  const baseKills = rota === "ADC" || rota === "MID" ? 6 : rota === "JUNGLE" || rota === "TOP" ? 4 : 2;
  const baseAssist = rota === "SUPPORT" ? 14 : rota === "JUNGLE" ? 9 : 6;
  const k = Math.max(0, Math.round(baseKills * fator + entre(rng, -1.5, 2)));
  const a = Math.max(0, Math.round(baseAssist * (0.6 + 0.4 * fator) + entre(rng, -2, 3)));
  const d = Math.max(0, Math.round(6 - nota * 0.4 + (vitoria ? -1 : 1) + entre(rng, -1, 2)));
  return { k, d, a };
}

function gerarCs(rng: Rng, rota: Role, nota: number): number {
  const base = rota === "SUPPORT" ? 1.5 : rota === "JUNGLE" ? 5.5 : rota === "ADC" || rota === "MID" ? 8 : 7;
  return clamp(base * (0.8 + 0.05 * nota) + entre(rng, -0.5, 0.5), 0, 12);
}

function gerarXp(player: Player, nota: number): Partial<Attributes> {
  const total = SIMULACAO.xpPorPartida * (0.5 + nota / 10);
  const xp: Partial<Attributes> = {};
  for (const [chave, peso] of Object.entries(PESOS_ROTA[player.rota])) {
    const g = total * (peso ?? 0);
    if (g > 0) xp[chave as AtributoKey] = Math.round(g * 100) / 100;
  }
  return xp;
}

function narrar(rng: Rng, player: Player, ctx: ContextoPartida, vitoria: boolean, nota: number, kda: { k: number; d: number; a: number }): string[] {
  const log: string[] = [];
  log.push(`${player.nome} (${player.rota}) entra em quadra · ${player.rankSoloq.elo}.`);
  log.push(ctx.comp >= ctx.compInimigo ? "Draft a favor: comp com vantagem." : "Draft difícil: comp atrás.");
  log.push(nota >= 6 ? "Min 3: você ganha a rota e abre espaço." : "Min 3: rota equilibrada, foco no farm.");
  log.push("Min 8: o primeiro Dragão é disputado.");
  log.push(rng() < 0.5 ? "Min 12: escaramuça no rio, trocas parelhas." : "Min 12: seu time força um pick.");
  log.push(nota >= 7 ? `Min 16: teamfight no meio — você brilha! (${kda.k}/${kda.d}/${kda.a})` : "Min 16: teamfight confuso no meio.");
  log.push("Min 22: Barão no mapa — decisão de alto risco.");
  log.push(vitoria ? "Min 28: vocês fecham o Nexus. VITÓRIA! 🏆" : "Min 28: o inimigo encerra a partida. Derrota.");
  return log;
}

export function simularPartida(player: Player, ctx: ContextoPartida, seed: number): MatchResult {
  const rng = criarRng(seed);

  const fRota = forcaRota(player, ctx.bonusAtributos);
  const fCampeao = (maestria(player, ctx.championId) + ctx.forcaMetaCampeao) / 2;
  const fTimeAliado = ctx.forcaTimeAliado ?? SIMULACAO.forcaTimeBase;
  const fTimeInimigo = ctx.forcaTimeInimigo ?? SIMULACAO.forcaTimeBase;
  const base =
    SIMULACAO.pesoRota * fRota +
    SIMULACAO.pesoCampeao * fCampeao +
    SIMULACAO.pesoTime * fTimeAliado +
    SIMULACAO.pesoComp * ctx.comp;

  const estab = (player.atributos.consistencia + player.atributos.mental) / 2;
  const { forca: tForca, ruidoMult } = modTracos(player.tracos, ctx.comp < ctx.compInimigo);
  const amp = (SIMULACAO.ruidoMax - (SIMULACAO.ruidoMax - SIMULACAO.ruidoMin) * (estab / 100)) * ruidoMult;
  const forcaFinal = clamp(base + tForca + entre(rng, -amp, amp), 0, 100);

  // vitória: vantagem do draft + sua aresta individual + força relativa dos times − dificuldade
  const vantagem =
    ctx.comp -
    ctx.compInimigo +
    (forcaFinal - 50) * 0.5 +
    (fTimeAliado - fTimeInimigo) * SIMULACAO.pesoForcaTimeVitoria -
    (ctx.bonusInimigo ?? 0);
  const vitoria = rng() < 1 / (1 + Math.exp(-SIMULACAO.sensibilidadeVitoria * vantagem));

  const nota = clamp(
    SIMULACAO.notaBase +
      (forcaFinal - 50) * SIMULACAO.notaPorPonto +
      entre(rng, -SIMULACAO.notaRuido, SIMULACAO.notaRuido) +
      (vitoria ? 0.4 : -0.2),
    0,
    10,
  );

  const kda = gerarKda(rng, player.rota, nota, vitoria);
  const csPorMin = gerarCs(rng, player.rota, nota);
  const { lpDelta } = aplicarResultadoRank(player.rankSoloq, vitoria, player.rankSoloq.mmr);
  const xpGanho = gerarXp(player, nota);
  const log = narrar(rng, player, ctx, vitoria, nota, kda);

  return {
    vitoria,
    kda,
    notaPerformance: Math.round(nota * 10) / 10,
    csPorMin: Math.round(csPorMin * 10) / 10,
    championId: ctx.championId,
    lpDelta,
    xpGanho,
    log,
  };
}

function aplicarXp(attrs: Attributes, xp: Partial<Attributes>): Attributes {
  const novo: Attributes = { ...attrs };
  (Object.keys(xp) as AtributoKey[]).forEach((k) => {
    novo[k] = clamp(Math.round((novo[k] + (xp[k] ?? 0)) * 100) / 100, 0, 100);
  });
  return novo;
}

// Jogar (e vencer) com um campeão aumenta a maestria; campeão novo entra na pool.
function atualizarPool(pool: ChampionMastery[], championId: string, vitoria: boolean): ChampionMastery[] {
  const ganho = vitoria ? SIMULACAO.maestriaVitoria : SIMULACAO.maestriaDerrota;
  let achou = false;
  const novo = pool.map((p) => {
    if (p.championId !== championId) return p;
    achou = true;
    return { ...p, pontos: clamp(Math.round((p.pontos + ganho) * 10) / 10, 0, SIMULACAO.maestriaMax) };
  });
  if (!achou) novo.push({ championId, pontos: Math.min(SIMULACAO.maestriaMax, ganho) });
  return novo;
}

// Escala o XP pela dificuldade (Fase 11).
function escalarXp(xp: Partial<Attributes>, fator: number): Partial<Attributes> {
  if (fator === 1) return xp;
  const out: Partial<Attributes> = {};
  (Object.keys(xp) as AtributoKey[]).forEach((k) => {
    out[k] = (xp[k] ?? 0) * fator;
  });
  return out;
}

export function aplicarResultado(career: CareerState, resultado: MatchResult): CareerState {
  const { player } = career;
  const novoMmr = Math.max(RANK.mmrBase, player.rankSoloq.mmr + (resultado.lpDelta ?? 0));
  const { elo, lp } = eloDeMmr(novoMmr);
  const ef = efeitoLendas(career);
  return {
    ...career,
    scoutPontos: (career.scoutPontos ?? 0) + (resultado.vitoria ? GACHA.porVitoria : 0),
    player: {
      ...player,
      rankSoloq: { elo, lp, mmr: novoMmr },
      atributos: aplicarXp(player.atributos, escalarXp(resultado.xpGanho, mod(career.opcoes).xp * ef.xpMult)),
      pool: atualizarPool(player.pool, resultado.championId, resultado.vitoria),
      reputacao: clamp(
        Math.round((player.reputacao + (resultado.notaPerformance - 5) * SIMULACAO.repPorNota) * 10) / 10,
        0,
        100,
      ),
    },
    historicoPartidas: [resultado, ...career.historicoPartidas].slice(0, 50),
  };
}
