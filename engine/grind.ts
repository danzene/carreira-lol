import { GRIND, NICKS_GRIND } from "@/data/grind";
import { SLOTS_GEAR, type Item, type SlotGear } from "@/data/itens";
import { SIMULACAO } from "@/data/simulacao";
import { gerarItem } from "./itens";
import { criarRng, entre } from "./rng";
import { simularPartida } from "./simularPartida";
import type { CareerState, ChampionMastery, KDA, Player } from "./types";

// 🛋️ Grind de Normais (PURO, determinístico): enquanto a aba está visível, o jogador
// entra em fila de normais sozinho. O engine decide TUDO em lote a partir de
// (snapshot, segundos acumulados, seed do dia) — a UI só ENCENA o resultado no ritmo.
//
// Regras invioláveis (testadas em grind.test.ts):
// - NUNCA concede PDL/MMR, CoinPoints, passe, energia, cargas, itens Raros+, Lendas, pity.
// - Ganho SÓ com aba visível (heartbeat na borda) e SÓ até o teto diário.
// - Tempo de progresso NUNCA vem do relógio do cliente — só segundos de heartbeat.
//
// TODO(monetização): o estado {seedDia, segundosHoje, checkpoint} foi desenhado pra
// permitir REVALIDAÇÃO server-side (recomputar resolverGrind e comparar) quando o grind
// tocar em qualquer valor real. Lembrete histórico: o Task Bar Hero tomou uma onda de
// dezenas de milhares de cheaters por ligar progressão automática a valor real — aqui
// só recompensas locais de baixo valor até RNG/validação irem pro servidor.

// ---- Estado persistido no save ----
export interface GrindSemana {
  partidas: number;
  vitorias: number;
  dinheiro: number;
  maestria: number; // pontos de maestria somados na semana
  maiorStreakV: number; // maior sequência de vitórias na semana (alimenta o feed)
  maiorStreakD: number;
  drops: number;
}

export interface EstadoGrind {
  ligado: boolean; // toggle do jogador (LIGAR/PAUSAR)
  dia: string; // "YYYY-MM-DD" (chaveDia) do acumulado corrente
  seedDia: number; // sorteada na BORDA a cada virada de dia
  segundosHoje: number; // segundos de aba visível acumulados hoje (capado no teto)
  partidasAplicadas: number; // checkpoint de idempotência: quantas completas JÁ entraram no save
  streakDia: number; // sequência corrente do dia (>0 vitórias, <0 derrotas)
  totalPartidas: number; // recorde de carreira: normais jogadas
  maiorStreakV: number; // recorde de carreira: maior sequência de vitórias em normais
  semana: GrindSemana;
  tetoAvisadoEm?: string; // dia em que o badge de teto foi emitido (1x/dia)
}

export function grindSemanaVazia(): GrindSemana {
  return { partidas: 0, vitorias: 0, dinheiro: 0, maestria: 0, maiorStreakV: 0, maiorStreakD: 0, drops: 0 };
}

export function estadoGrindInicial(dia: string, seedDia: number): EstadoGrind {
  return {
    ligado: true,
    dia,
    seedDia,
    segundosHoje: 0,
    partidasAplicadas: 0,
    streakDia: 0,
    totalPartidas: 0,
    maiorStreakV: 0,
    semana: grindSemanaVazia(),
  };
}

// Migração de save (chamada por normalizarCareer): shape inválido → descarta (default seguro).
export function normalizarGrind(bruto: unknown): EstadoGrind | undefined {
  if (!bruto || typeof bruto !== "object") return undefined;
  const g = bruto as Partial<EstadoGrind>;
  if (typeof g.dia !== "string" || typeof g.seedDia !== "number") return undefined;
  const s = g.semana;
  return {
    ligado: g.ligado !== false,
    dia: g.dia,
    seedDia: g.seedDia >>> 0,
    segundosHoje: clampSeg(typeof g.segundosHoje === "number" ? g.segundosHoje : 0),
    partidasAplicadas: Math.max(0, Math.floor(typeof g.partidasAplicadas === "number" ? g.partidasAplicadas : 0)),
    streakDia: typeof g.streakDia === "number" ? Math.trunc(g.streakDia) : 0,
    totalPartidas: Math.max(0, Math.floor(typeof g.totalPartidas === "number" ? g.totalPartidas : 0)),
    maiorStreakV: Math.max(0, Math.floor(typeof g.maiorStreakV === "number" ? g.maiorStreakV : 0)),
    semana: {
      partidas: num(s?.partidas),
      vitorias: num(s?.vitorias),
      dinheiro: num(s?.dinheiro),
      maestria: num(s?.maestria),
      maiorStreakV: num(s?.maiorStreakV),
      maiorStreakD: num(s?.maiorStreakD),
      drops: num(s?.drops),
    },
    tetoAvisadoEm: typeof g.tetoAvisadoEm === "string" ? g.tetoAvisadoEm : undefined,
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function clampSeg(s: number): number {
  return Math.max(0, Math.min(GRIND.tetoSegundosDia, Math.floor(s)));
}

// ---- Acúmulo de segundos (borda → engine): virada de dia + teto ----
// `hoje` e `novaSeed` nascem na borda (chaveDia/criptografia fraca ok — é jogo local).
export function acumularSegundosGrind(g: EstadoGrind, deltaSegundos: number, hoje: string, novaSeed: number): EstadoGrind {
  const base: EstadoGrind =
    g.dia === hoje
      ? g
      : {
          // virada de dia: zera o acumulado/checkpoint/streak do dia, preserva recordes e semana
          ...g,
          dia: hoje,
          seedDia: novaSeed >>> 0,
          segundosHoje: 0,
          partidasAplicadas: 0,
          streakDia: 0,
          tetoAvisadoEm: g.tetoAvisadoEm === hoje ? g.tetoAvisadoEm : undefined,
        };
  const segundos = clampSeg(base.segundosHoje + Math.max(0, Math.floor(deltaSegundos)));
  return segundos === base.segundosHoje && base === g ? g : { ...base, segundosHoje: segundos };
}

export function tetoAtingido(g: EstadoGrind): boolean {
  return g.segundosHoje >= GRIND.tetoSegundosDia;
}

// ---- Resolução em lote (função de (snapshot, segundos, seed) → partidas) ----
export interface PartidaGrind {
  idx: number; // índice no dia (0-based)
  championId: string;
  adversario: string; // nick procedural do oponente
  vitoria: boolean;
  kda: KDA;
  nota: number;
  dinheiro: number;
  maestria: number; // pontos pro campeão jogado
  drop?: { slot: SlotGear; seedItem: number }; // raridade SEMPRE GRIND.dropRaridade
  inicioSeg: number;
  duracaoSeg: number;
}

export interface PartidaEmAndamento {
  idx: number;
  championId: string;
  adversario: string;
  inicioSeg: number;
  duracaoSeg: number;
}

export interface ResultadoGrind {
  completas: PartidaGrind[]; // TODAS as partidas fechadas do dia (0..N) — checkpoint corta as já aplicadas
  atual: PartidaEmAndamento | null; // a partida "em andamento" pro widget encenar (null = teto/pool vazia)
  tetoAtingido: boolean;
}

// Seed derivada por partida (mistura determinística — mesma do splitmix).
function seedPartida(seedDia: number, idx: number): number {
  return (seedDia + (idx + 1) * 0x9e3779b9) >>> 0;
}

// Campeão da vez: sorteio ponderado por maestria (10 + pontos), evitando repetir o anterior.
function escolherCampeao(pool: ChampionMastery[], anterior: string | null, r: () => number): string {
  const pesos = pool.map((p) => 10 + Math.max(0, p.pontos));
  const total = pesos.reduce((a, b) => a + b, 0);
  const sorteia = (): string => {
    let alvo = r() * total;
    for (let i = 0; i < pool.length; i++) {
      alvo -= pesos[i];
      if (alvo <= 0) return pool[i].championId;
    }
    return pool[pool.length - 1].championId;
  };
  let id = sorteia();
  if (pool.length > 1 && id === anterior) id = sorteia(); // variedade: 1 re-sorteio
  return id;
}

export function resolverGrind(player: Player, segundosAcumulados: number, seedDia: number): ResultadoGrind {
  const segundos = clampSeg(segundosAcumulados);
  const noTeto = segundos >= GRIND.tetoSegundosDia;
  const completas: PartidaGrind[] = [];
  if (player.pool.length === 0) return { completas, atual: null, tetoAtingido: noTeto };

  // normais não sofrem o anti-tilt da soloq (pity de derrota é do ranqueado)
  const jogador: Player = { ...player, rankSoloq: { ...player.rankSoloq, streak: 0 } };

  let inicio = 0;
  let anterior: string | null = null;
  for (let idx = 0; ; idx++) {
    const sp = seedPartida(seedDia, idx);
    const meta = criarRng(sp); // rng do "lobby": duração, campeão, adversário, drop
    const duracao = Math.round(entre(meta, GRIND.duracaoMinSeg, GRIND.duracaoMaxSeg));
    const championId = escolherCampeao(player.pool, anterior, meta);
    const adversario = NICKS_GRIND[Math.floor(meta() * NICKS_GRIND.length)];

    if (inicio + duracao > segundos) {
      // esta partida ainda não fechou: é a "em andamento" (a menos que o teto tenha batido)
      const atual: PartidaEmAndamento | null = noTeto ? null : { idx, championId, adversario, inicioSeg: inicio, duracaoSeg: duracao };
      return { completas, atual, tetoAtingido: noTeto };
    }

    // resultado pela MESMA matemática de combate do jogo (nada de segundo sistema):
    // contexto neutro de normal — sem draft, sem dificuldade de elo, times ~50.
    const res = simularPartida(
      jogador,
      {
        championId,
        forcaMetaCampeao: 50,
        comp: 50,
        compInimigo: 50,
        forcaTimeAliado: 50,
        forcaTimeInimigo: Math.round(entre(meta, GRIND.forcaInimigaMin, GRIND.forcaInimigaMax)),
      },
      (sp ^ 0xbeef) >>> 0,
    );

    const drop = res.vitoria && meta() < GRIND.dropChance
      ? { slot: SLOTS_GEAR[Math.floor(meta() * SLOTS_GEAR.length)].slot, seedItem: Math.floor(meta() * 0x7fffffff) }
      : undefined;

    completas.push({
      idx,
      championId,
      adversario,
      vitoria: res.vitoria,
      kda: res.kda,
      nota: res.notaPerformance,
      dinheiro: res.vitoria ? GRIND.dinheiroVitoria : GRIND.dinheiroDerrota,
      maestria: res.vitoria ? GRIND.maestriaVitoria : GRIND.maestriaDerrota,
      drop,
      inicioSeg: inicio,
      duracaoSeg: duracao,
    });
    inicio += duracao;
    anterior = championId;
  }
}

// Item do drop do grind — raridade SEMPRE capada (Regra 1). Único caminho de geração.
export function gerarItemGrind(drop: { slot: SlotGear; seedItem: number }, iLvl: number): Item {
  return gerarItem(drop.slot, iLvl, drop.seedItem, { raridade: GRIND.dropRaridade });
}

// ---- Aplicação idempotente no save ----
// Aplica SÓ as partidas além do checkpoint. Devolve o novo estado + as novas (pra UI/badge/
// telemetria) — reprocessar o mesmo lote não duplica nada (teste explícito).
// IMPORTANTE (Regra 1): só toca em dinheiro, pool (maestria) e no próprio estado do grind.
export interface AplicacaoGrind {
  career: CareerState;
  novas: PartidaGrind[];
}

export function aplicarGrind(career: CareerState, resultado: ResultadoGrind): AplicacaoGrind {
  const g = career.grind;
  if (!g) return { career, novas: [] };
  const novas = resultado.completas.slice(g.partidasAplicadas);
  if (novas.length === 0) return { career, novas };

  let dinheiro = career.dinheiro;
  let pool = career.player.pool;
  let streak = g.streakDia;
  let maiorStreakV = g.maiorStreakV;
  const semana = { ...g.semana };

  for (const p of novas) {
    dinheiro += p.dinheiro;
    pool = somarMaestria(pool, p.championId, p.maestria);
    streak = p.vitoria ? Math.max(1, streak + 1) : Math.min(-1, streak - 1);
    if (streak > maiorStreakV) maiorStreakV = streak;
    semana.partidas += 1;
    if (p.vitoria) semana.vitorias += 1;
    semana.dinheiro += p.dinheiro;
    semana.maestria = Math.round((semana.maestria + p.maestria) * 100) / 100;
    if (streak > semana.maiorStreakV) semana.maiorStreakV = streak;
    if (-streak > semana.maiorStreakD) semana.maiorStreakD = -streak;
    if (p.drop) semana.drops += 1;
  }

  const grind: EstadoGrind = {
    ...g,
    partidasAplicadas: resultado.completas.length,
    streakDia: streak,
    totalPartidas: g.totalPartidas + novas.length,
    maiorStreakV,
    semana,
  };

  return {
    career: { ...career, dinheiro, grind, player: { ...career.player, pool } },
    novas,
  };
}

function somarMaestria(pool: ChampionMastery[], championId: string, ganho: number): ChampionMastery[] {
  return pool.map((p) =>
    p.championId === championId
      ? { ...p, pontos: Math.min(SIMULACAO.maestriaMax, Math.round((p.pontos + ganho) * 100) / 100) }
      : p,
  );
}

// Vira a semana (chamado junto do fecharSemanaStats): zera os totais semanais do grind.
export function fecharSemanaGrind(career: CareerState): CareerState {
  if (!career.grind) return career;
  return { ...career, grind: { ...career.grind, semana: grindSemanaVazia() } };
}

// Placar do dia (derivado das completas — pra widget/título da aba).
export function placarDoDia(resultado: ResultadoGrind): { v: number; d: number } {
  let v = 0;
  for (const p of resultado.completas) if (p.vitoria) v++;
  return { v, d: resultado.completas.length - v };
}
