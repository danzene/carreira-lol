import { GRIND, NICKS_GRIND } from "@/data/grind";
import { GRIND_PROP } from "@/data/grindProposito";
import { SLOTS_GEAR, type Item, type SlotGear } from "@/data/itens";
import { SIMULACAO } from "@/data/simulacao";
import {
  cargaBarra,
  comprarTalento,
  cosmeticoValido,
  modsGrind,
  MODS_NEUTROS,
  respec,
  rolarBau,
  sucataDaPartida,
  type BauRolado,
  type ModsGrind,
  type RecompensaBau,
  type Talentos,
} from "./grindProposito";
import { gerarItem } from "./itens";
import { criarRng, entre } from "./rng";
import { simularPartida } from "./simularPartida";
import { featureLiberada } from "./unlocks";
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
  sucata: number; // Sucata ganha na semana (recap)
  bausComum: number;
  bausRaro: number;
  bausLendario: number;
  talentosComprados: number;
  lendarioNome?: string; // cosmético do último Lendário da semana (gatilho de feed)
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

  // 🎯 Grind com Propósito (economia FECHADA: Sucata só entra aqui e só sai na árvore)
  sucata: number;
  talentos: Talentos; // id do nó → nível
  barraBau: number; // gold acumulado na barra corrente (float exato)
  goldFracao: number; // carry do $ fracionário (career.dinheiro continua INTEIRO)
  bauPendente: BauRolado | null; // máx. 1 aguardando abertura (anti-stockpiling)
  pityLendario: number; // baús desde o último Lendário — OCULTO na UI (proteção)
  totalBaus: number; // recorde de carreira
  primeiroLendarioEm?: string; // data do 1º Lendário (Hall)
  cosmeticos: string[]; // ids possuídos da Coleção do Grind
  equipado: { skin?: string; trilha?: string; pet?: string };
}

export function grindSemanaVazia(): GrindSemana {
  return {
    partidas: 0,
    vitorias: 0,
    dinheiro: 0,
    maestria: 0,
    maiorStreakV: 0,
    maiorStreakD: 0,
    drops: 0,
    sucata: 0,
    bausComum: 0,
    bausRaro: 0,
    bausLendario: 0,
    talentosComprados: 0,
  };
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
    sucata: 0,
    talentos: {},
    barraBau: 0,
    goldFracao: 0,
    bauPendente: null,
    pityLendario: 0,
    totalBaus: 0,
    cosmeticos: [],
    equipado: {},
  };
}

// Mods da árvore deste save (usados por resolverGrind, aplicarGrind e pela cena).
export function modsDoGrind(g: EstadoGrind | undefined): ModsGrind {
  return g ? modsGrind(g.talentos) : MODS_NEUTROS;
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
      sucata: num(s?.sucata),
      bausComum: num(s?.bausComum),
      bausRaro: num(s?.bausRaro),
      bausLendario: num(s?.bausLendario),
      talentosComprados: num(s?.talentosComprados),
      lendarioNome: typeof s?.lendarioNome === "string" ? s.lendarioNome : undefined,
    },
    tetoAvisadoEm: typeof g.tetoAvisadoEm === "string" ? g.tetoAvisadoEm : undefined,

    // 🎯 campos novos (save antigo → defaults seguros; nada crasha)
    sucata: Math.max(0, num(g.sucata)),
    talentos: normalizarTalentos(g.talentos),
    barraBau: Math.max(0, Math.min(GRIND_PROP.barraCheia, num(g.barraBau))),
    goldFracao: Math.max(0, Math.min(1, num(g.goldFracao))),
    bauPendente: normalizarBau(g.bauPendente),
    pityLendario: Math.max(0, Math.floor(num(g.pityLendario))),
    totalBaus: Math.max(0, Math.floor(num(g.totalBaus))),
    primeiroLendarioEm: typeof g.primeiroLendarioEm === "string" ? g.primeiroLendarioEm : undefined,
    cosmeticos: Array.isArray(g.cosmeticos) ? g.cosmeticos.filter((c): c is string => typeof c === "string") : [],
    equipado: normalizarEquipado(g.equipado),
  };
}

function normalizarTalentos(bruto: unknown): Talentos {
  if (!bruto || typeof bruto !== "object") return {};
  const out: Talentos = {};
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    const n = Math.floor(num(v));
    if (n > 0) out[k] = n; // níveis acima do máx são clampados por modsGrind
  }
  return out;
}

function normalizarBau(bruto: unknown): BauRolado | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Partial<BauRolado>;
  if (b.tier !== "comum" && b.tier !== "raro" && b.tier !== "lendario") return null;
  if (!Array.isArray(b.recompensas)) return null;
  return {
    tier: b.tier,
    numero: Math.max(1, Math.floor(num(b.numero))),
    foiPity: b.foiPity === true,
    recompensas: b.recompensas as RecompensaBau[],
    opcoes: Array.isArray(b.opcoes) ? (b.opcoes as RecompensaBau[][]) : undefined,
  };
}

function normalizarEquipado(bruto: unknown): EstadoGrind["equipado"] {
  if (!bruto || typeof bruto !== "object") return {};
  const e = bruto as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  return { skin: s(e.skin), trilha: s(e.trilha), pet: s(e.pet) };
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

// 🔌 Kill switch + gate de unlock num ÚNICO ponto (widget e heartbeat passam por aqui).
// `habilitado` é injetável pra teste; em produção vem de GRIND.habilitado — desligar a
// flag tira a feature do ar em 1 deploy sem quebrar nenhum save.
export function grindDisponivel(career: CareerState, habilitado: boolean = GRIND.habilitado): boolean {
  return habilitado && featureLiberada(career, "grind");
}

// ---- Resolução em lote (função de (snapshot, segundos, seed) → partidas) ----
export interface PartidaGrind {
  idx: number; // índice no dia (0-based)
  championId: string;
  adversario: string; // nick procedural do oponente
  vitoria: boolean;
  kda: KDA;
  nota: number;
  dinheiro: number; // float exato (o carry de fração vive no save; career.dinheiro é inteiro)
  maestria: number; // pontos pro campeão jogado (NÃO é multiplicado por talento — Regra 4)
  sucata: number; // Sucata dos minions mortos na cena (economia fechada)
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

// `mods` vêm da árvore de talentos (modsDoGrind). Default neutro mantém os callers
// antigos válidos. IMPORTANTE (idempotência): a RECOMPENSA de cada partida depende do
// ÍNDICE (seed), não da duração — mudar os mods reposiciona as partidas no tempo, mas
// nunca faz o checkpoint pagar duas vezes o mesmo índice.
export function resolverGrind(
  player: Player,
  segundosAcumulados: number,
  seedDia: number,
  mods: ModsGrind = MODS_NEUTROS,
): ResultadoGrind {
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
    // velocidade de ataque encurta a partida ⇒ mais partidas dentro do MESMO teto
    const duracao = Math.max(60, Math.round(entre(meta, GRIND.duracaoMinSeg, GRIND.duracaoMaxSeg) * mods.duracaoMult));
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

    // $ escala com o talento de Ouro; maestria NÃO escala (Regra 4 — segura o teto)
    const dinheiroBase = res.vitoria ? GRIND.dinheiroVitoria : GRIND.dinheiroDerrota;
    completas.push({
      idx,
      championId,
      adversario,
      vitoria: res.vitoria,
      kda: res.kda,
      nota: res.notaPerformance,
      dinheiro: Math.round(dinheiroBase * mods.goldMult * 100) / 100,
      maestria: res.vitoria ? GRIND.maestriaVitoria : GRIND.maestriaDerrota,
      sucata: sucataDaPartida(sp, mods),
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

  const mods = modsDoGrind(g);
  let pool = career.player.pool;
  let streak = g.streakDia;
  let maiorStreakV = g.maiorStreakV;
  const semana = { ...g.semana };

  // $ fracionário: acumula o carry e só entrega INTEIROS ao career.dinheiro
  let acumuladoGold = g.goldFracao;
  let sucata = g.sucata;
  let barraBau = g.barraBau;
  let bauPendente = g.bauPendente;
  let pityLendario = g.pityLendario;
  let totalBaus = g.totalBaus;

  for (const p of novas) {
    acumuladoGold += p.dinheiro;
    pool = somarMaestria(pool, p.championId, p.maestria);
    sucata += p.sucata;
    semana.sucata += p.sucata;

    // a barra de baú carrega com o GOLD da cena (exato, sem o arredondamento do $)
    if (bauPendente) {
      barraBau = GRIND_PROP.barraCheia; // pendente: barra para em cheia (anti-stockpiling)
    } else {
      barraBau += cargaBarra(p.dinheiro, mods);
      if (barraBau >= GRIND_PROP.barraCheia) {
        totalBaus += 1;
        const seedBau = (g.seedDia ^ (totalBaus * 0x9e3779b9)) >>> 0;
        bauPendente = rolarBau(seedBau, totalBaus, pityLendario, mods, g.cosmeticos);
        pityLendario = bauPendente.tier === "lendario" ? 0 : pityLendario + 1;
        barraBau -= GRIND_PROP.barraCheia; // excedente TRANSBORDA pra próxima
        if (barraBau >= GRIND_PROP.barraCheia) barraBau = GRIND_PROP.barraCheia; // 2º baú só depois de abrir
      }
    }

    streak = p.vitoria ? Math.max(1, streak + 1) : Math.min(-1, streak - 1);
    if (streak > maiorStreakV) maiorStreakV = streak;
    semana.partidas += 1;
    if (p.vitoria) semana.vitorias += 1;
    if (streak > semana.maiorStreakV) semana.maiorStreakV = streak;
    if (-streak > semana.maiorStreakD) semana.maiorStreakD = -streak;
    if (p.drop) semana.drops += 1;
  }

  const inteiros = Math.floor(acumuladoGold);
  const goldFracao = Math.round((acumuladoGold - inteiros) * 1000) / 1000;
  semana.dinheiro += inteiros;
  semana.maestria = Math.round((semana.maestria + novas.reduce((s, p) => s + p.maestria, 0)) * 100) / 100;

  const grind: EstadoGrind = {
    ...g,
    partidasAplicadas: resultado.completas.length,
    streakDia: streak,
    totalPartidas: g.totalPartidas + novas.length,
    maiorStreakV,
    semana,
    sucata,
    barraBau,
    goldFracao,
    bauPendente,
    pityLendario,
    totalBaus,
  };

  return {
    career: { ...career, dinheiro: career.dinheiro + inteiros, grind, player: { ...career.player, pool } },
    novas,
  };
}

// ---- Abertura do baú (ação do jogador; o tier só é REVELADO aqui) ----
export interface AberturaBau {
  career: CareerState;
  bau: BauRolado;
  recompensas: RecompensaBau[]; // as efetivamente aplicadas (após a escolha, se houver)
  item?: { slot: SlotGear; seedItem: number }; // a borda gera com gerarItemGrind(iLvl) e põe no inventário
  cosmetico?: string;
}

// `escolha` só vale pro Raro com "Segunda Chance" (0|1). `hoje` marca o 1º Lendário (Hall).
export function abrirBau(career: CareerState, hoje: string, escolha = 0): AberturaBau | null {
  const g = career.grind;
  if (!g?.bauPendente) return null;
  const bau = g.bauPendente;
  const recompensas = bau.opcoes ? bau.opcoes[Math.min(bau.opcoes.length - 1, Math.max(0, escolha))] : bau.recompensas;

  let sucata = g.sucata;
  let dinheiro = career.dinheiro;
  let pool = career.player.pool;
  let item: AberturaBau["item"];
  let cosmetico: string | undefined;
  const cosmeticos = [...g.cosmeticos];
  const semana = { ...g.semana };

  for (const r of recompensas) {
    if (r.tipo === "sucata") {
      sucata += r.valor;
      semana.sucata += r.valor;
    } else if (r.tipo === "dinheiro") {
      dinheiro += r.valor;
      semana.dinheiro += r.valor;
    } else if (r.tipo === "maestria") {
      pool = somarMaestriaNoMaisFraco(pool, r.valor); // pacote ajuda o campeão mais atrasado
      semana.maestria = Math.round((semana.maestria + r.valor) * 100) / 100;
    } else if (r.tipo === "item") {
      item = { slot: r.slot, seedItem: r.seedItem }; // raridade capada na borda (gerarItemGrind)
    } else if (r.tipo === "cosmetico") {
      if (!cosmeticos.includes(r.id)) cosmeticos.push(r.id);
      cosmetico = r.id;
    }
  }

  if (bau.tier === "comum") semana.bausComum += 1;
  else if (bau.tier === "raro") semana.bausRaro += 1;
  else {
    semana.bausLendario += 1;
    if (cosmetico) semana.lendarioNome = cosmetico;
  }

  const grind: EstadoGrind = {
    ...g,
    bauPendente: null,
    sucata,
    cosmeticos,
    semana,
    primeiroLendarioEm: g.primeiroLendarioEm ?? (bau.tier === "lendario" ? hoje : undefined),
  };

  return {
    career: { ...career, dinheiro, grind, player: { ...career.player, pool } },
    bau,
    recompensas,
    item,
    cosmetico,
  };
}

function somarMaestriaNoMaisFraco(pool: ChampionMastery[], ganho: number): ChampionMastery[] {
  if (pool.length === 0) return pool;
  let alvo = 0;
  for (let i = 1; i < pool.length; i++) if (pool[i].pontos < pool[alvo].pontos) alvo = i;
  return pool.map((p, i) =>
    i === alvo ? { ...p, pontos: Math.min(SIMULACAO.maestriaMax, Math.round((p.pontos + ganho) * 100) / 100) } : p,
  );
}

function somarMaestria(pool: ChampionMastery[], championId: string, ganho: number): ChampionMastery[] {
  return pool.map((p) =>
    p.championId === championId
      ? { ...p, pontos: Math.min(SIMULACAO.maestriaMax, Math.round((p.pontos + ganho) * 100) / 100) }
      : p,
  );
}

// ---- Ações da árvore/coleção sobre o CareerState (a Sucata NUNCA sai daqui) ----

// Compra 1 nível de um nó. null = bloqueado (máx/prereq/sucata insuficiente).
export function comprarTalentoGrind(career: CareerState, id: string): { career: CareerState; nivel: number } | null {
  const g = career.grind;
  if (!g) return null;
  const r = comprarTalento(g.talentos, g.sucata, id);
  if (!r) return null;
  const semana = { ...g.semana, talentosComprados: g.semana.talentosComprados + 1 };
  return { career: { ...career, grind: { ...g, talentos: r.talentos, sucata: r.sucata, semana } }, nivel: r.nivel };
}

// Respec GRÁTIS: devolve toda a Sucata investida (a Sucata continua dentro do grind).
export function respecGrind(career: CareerState): CareerState {
  const g = career.grind;
  if (!g) return career;
  const r = respec(g.talentos, g.sucata);
  return { ...career, grind: { ...g, talentos: r.talentos, sucata: r.sucata } };
}

// Equipa 1 cosmético por tipo (só se possuído). `id` undefined = desequipa o tipo.
export function equiparCosmeticoGrind(career: CareerState, tipo: "skin" | "trilha" | "pet", id?: string): CareerState {
  const g = career.grind;
  if (!g) return career;
  if (id !== undefined && !cosmeticoValido(id, g.cosmeticos)) return career;
  return { ...career, grind: { ...g, equipado: { ...g.equipado, [tipo]: id } } };
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
