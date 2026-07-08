// 🗺️ Dois Modos de Treino — o Passivo (idle seguro) e a EXPEDIÇÃO (ativa, arriscada).
//
// PRINCÍPIO INVIOLÁVEL DA RODADA: o modo PASSIVO nunca tem risco de morte nem exige
// vigilância — roda em segundo plano/PiP e o jogador SABE que progride. TODO risco/
// morte/dificuldade vive na EXPEDIÇÃO, um modo ATIVO e OPCIONAL no qual o jogador entra
// de propósito. Morrer na Expedição NUNCA afeta a carreira real (elo/atributos/itens/
// Sucata já guardada/talentos/cosméticos) — perde só o "loot em progresso" da corrida.
//
// Este módulo é PURO e SEEDADO (nada de relógio/DOM/Math.random). A UI encena; o engine
// é a verdade. Fase 0: só os tipos, normalizadores e o guard de "qual modo está ativo".
// A resolução de fases/HP/push-your-luck entra na Fase 1 (mesmo arquivo).

import { EXPEDICAO, RITMO_VARIANTES, ehBoss } from "@/data/expedicao";
import { GRIND_PROP } from "@/data/grindProposito";
import { criarRng, entre } from "./rng";
import { forcaRota } from "./simularPartida";
import type { Player } from "./types";

export type ModoGrind = "PASSIVO" | "EXPEDICAO";

// ---- Ritmo de Treino — buff TEMPORÁRIO/CAPADO/CONSUMÍVEL da próxima partida ----
// Ganho no grind (pouco) e na Expedição (mais + variantes superiores por profundidade).
// FORA do snapshot de duelo ranqueado (Regra 4): nunca entra em `snapshotDePlayer`, então
// não infla o poder que outros enfrentam. Consumido ao jogar (como o `preparacao` da loja).
export interface RitmoTreino {
  variante: string; // id da variante (RITMO_VARIANTES) — quanto mais funda a corrida, melhor
  cargas: number; // próximas partidas que ainda recebem o buff (consumível)
  bonusComp: number; // + na composição da próxima partida (CAPADO)
  bonusCounter: number; // + no matchup da lane (CAPADO)
}

// ---- Estado de UMA corrida de Expedição ATIVA ----
// null quando o jogador está no passivo ou não há corrida. Só existe enquanto ativa.
export type StatusExpedicao =
  | "combate" // resolvendo a fase atual
  | "escolha" // fase limpa: aguardando Continuar/Recuar (o dilema push-your-luck)
  | "morto" // HP zerou — corrida encerrada; loot preservado só até a última fase COMPLETADA
  | "recuou"; // saiu com o loot no banco (fim honroso)

export interface EstadoExpedicao {
  seed: number; // seed da corrida (todo o RNG deriva daqui — determinístico)
  faseAtual: number; // fase sendo/prestes a ser enfrentada (1-based)
  faseLimpa: number; // maior fase COMPLETADA nesta corrida (o que se preserva ao sair no meio)
  hpMax: number;
  hpAtual: number; // 0 = morte
  // loot GARANTIDO acumulado nas fases já completadas (só isto sobrevive a morte/saída):
  lootSucata: number;
  lootBaus: number; // nº de baús ganhos (rolados/aplicados ao encerrar)
  ritmoNivel: number; // 0..N — melhor variante de Ritmo desbloqueada nesta corrida
  status: StatusExpedicao;
}

// Guard central de qual modo está ativo. O heartbeat do PASSIVO só acumula quando isto
// é verdadeiro — assim a Expedição, por ser ativa, JAMAIS progride "nas costas" do jogador
// e o passivo, por sua vez, não roda enquanto uma corrida está em andamento (só um por vez).
export function passivoAtivo(modo: ModoGrind, expedicao: EstadoExpedicao | null): boolean {
  return modo === "PASSIVO" && !expedicao;
}

export function expedicaoEmAndamento(exp: EstadoExpedicao | null): boolean {
  return !!exp && (exp.status === "combate" || exp.status === "escolha");
}

// ---- Normalizadores de save (defaults SEGUROS; save antigo sem estes campos vira passivo) ----
export function normalizarModo(bruto: unknown): ModoGrind {
  return bruto === "EXPEDICAO" ? "EXPEDICAO" : "PASSIVO";
}

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function normalizarRitmo(bruto: unknown): RitmoTreino | null {
  if (!bruto || typeof bruto !== "object") return null;
  const r = bruto as Partial<RitmoTreino>;
  const cargas = Math.max(0, Math.floor(n(r.cargas)));
  if (typeof r.variante !== "string" || cargas <= 0) return null;
  return {
    variante: r.variante,
    cargas,
    bonusComp: Math.max(0, Math.min(RITMO_CAP.comp, n(r.bonusComp))),
    bonusCounter: Math.max(0, Math.min(RITMO_CAP.counter, n(r.bonusCounter))),
  };
}

export function normalizarExpedicao(bruto: unknown): EstadoExpedicao | null {
  if (!bruto || typeof bruto !== "object") return null;
  const e = bruto as Partial<EstadoExpedicao>;
  const status: StatusExpedicao =
    e.status === "combate" || e.status === "escolha" || e.status === "morto" || e.status === "recuou" ? e.status : "combate";
  // corridas já encerradas no save (morto/recuou) não devem "ressuscitar" — viram null
  if (status === "morto" || status === "recuou") return null;
  const hpMax = Math.max(1, Math.floor(n(e.hpMax)) || 1);
  return {
    seed: (Math.floor(n(e.seed)) >>> 0) || 1,
    faseAtual: Math.max(1, Math.floor(n(e.faseAtual)) || 1),
    faseLimpa: Math.max(0, Math.floor(n(e.faseLimpa))),
    hpMax,
    hpAtual: Math.max(0, Math.min(hpMax, Math.floor(n(e.hpAtual)))),
    lootSucata: Math.max(0, Math.floor(n(e.lootSucata))),
    lootBaus: Math.max(0, Math.floor(n(e.lootBaus))),
    ritmoNivel: Math.max(0, Math.floor(n(e.ritmoNivel))),
    status,
  };
}

// Teto duro do buff da próxima partida (o Ritmo NUNCA fura isto — Regra 4 / curva de elo).
// Referência: o item de loja `preparacao` dá +3 comp / +1 counter. A melhor variante da
// Expedição chega perto disto, mas continua TEMPORÁRIA e fora do ranqueado.
export const RITMO_CAP = { comp: 4, counter: 2 } as const;

// Guardas de sanidade compartilhadas com a Fase 1 (barra de baú etc.).
export const BARRA_CHEIA = GRIND_PROP.barraCheia;

// ============================================================================
// 🗺️ MOTOR DA EXPEDIÇÃO (PURO/SEEDADO) — fases, HP, dano, push-your-luck.
// Nada aqui toca a carreira real: só o EstadoExpedicao. Aplicar o loot ao save é
// trabalho dos wrappers em grind.ts (finalizarExpedicaoGrind) — mesma disciplina do baú.
// ============================================================================

// Modificadores da árvore que ajudam a Expedição (preenchidos na Fase 3; neutros aqui).
export interface ModsExpedicao {
  bonusHp: number; // + HP máximo do herói (talento)
  faseInicial: number; // começa em fase avançada (talento) — 1 = do início
  lootMult: number; // multiplica a Sucata por fase (talento)
}

export const MODS_EXP_NEUTROS: ModsExpedicao = { bonusHp: 0, faseInicial: 1, lootMult: 1 };

// O que aconteceu ao resolver UMA fase (pra UI encenar e pra telemetria).
export interface EventoFase {
  fase: number;
  boss: boolean;
  limpou: boolean; // true = fase completada; false = o herói morreu nela
  morreu: boolean;
  danoRecebido: number;
  cura: number; // recuperação leve ao limpar
  sucata: number; // Sucata garantida desta fase (0 se morreu)
  ganhouBau: boolean;
  hpApos: number;
}

// Poder de combate do herói = a mesma forcaRota do jogo (nada de segundo sistema).
export function poderHeroi(player: Player): number {
  return Math.max(1, forcaRota(player));
}

export function hpMaximo(player: Player, mods: ModsExpedicao = MODS_EXP_NEUTROS): number {
  return Math.max(1, Math.round(EXPEDICAO.hpBase + poderHeroi(player) * EXPEDICAO.hpPorForca + mods.bonusHp));
}

export function forcaDaFase(fase: number): number {
  const base = EXPEDICAO.forcaFaseBase + (fase - 1) * EXPEDICAO.forcaFasePasso;
  return ehBoss(fase) ? base * EXPEDICAO.bossMult : base;
}

// Dano MÉDIO (sem RNG) — base do preview de risco. Cresce com a razão força-da-fase/herói.
function danoMedio(player: Player, fase: number, mods: ModsExpedicao): number {
  const razao = forcaDaFase(fase) / poderHeroi(player);
  return hpMaximo(player, mods) * EXPEDICAO.danoFracaoBase * razao;
}

function rngFase(seed: number, fase: number, sal: number) {
  return criarRng((((seed ^ (fase * 0x9e3779b9)) >>> 0) ^ sal) >>> 0);
}

// Dano REAL da fase (seedado, com jitter) — a incerteza que torna a aposta uma aposta.
function danoRealFase(seed: number, player: Player, fase: number, mods: ModsExpedicao): number {
  const r = rngFase(seed, fase, 0xda11);
  const j = EXPEDICAO.danoJitter;
  return Math.max(1, Math.round(danoMedio(player, fase, mods) * (1 + entre(r, -j, j))));
}

export function sucataDaFase(fase: number, mods: ModsExpedicao = MODS_EXP_NEUTROS): number {
  const base = EXPEDICAO.sucataFaseBase * fase * (1 + (fase - 1) * EXPEDICAO.sucataFaseAccel);
  return Math.max(1, Math.round(base * mods.lootMult));
}

// Baú por fase: boss garante; senão chance crescente com a profundidade.
function ganhaBauNaFase(seed: number, fase: number): boolean {
  if (ehBoss(fase)) return true;
  const r = rngFase(seed, fase, 0xba00);
  return r() < Math.min(0.5, EXPEDICAO.chanceBauBase + fase * EXPEDICAO.chanceBauPorFase);
}

// Quantas variantes de Ritmo a profundidade já desbloqueou (0 = nenhuma).
function nivelRitmo(faseLimpa: number): number {
  let n = 0;
  for (const v of RITMO_VARIANTES) if (faseLimpa >= v.faseMin) n++;
  return n;
}

// Melhor Ritmo concedido pela profundidade alcançada (null se nem a 1ª variante caiu).
export function ritmoDaProfundidade(faseLimpa: number): RitmoTreino | null {
  let melhor: (typeof RITMO_VARIANTES)[number] | null = null;
  for (const v of RITMO_VARIANTES) if (faseLimpa >= v.faseMin) melhor = v;
  if (!melhor) return null;
  return {
    variante: melhor.id,
    cargas: Math.max(1, melhor.cargas),
    bonusComp: Math.min(RITMO_CAP.comp, melhor.bonusComp),
    bonusCounter: Math.min(RITMO_CAP.counter, melhor.bonusCounter),
  };
}

// Resolve a fase CORRENTE (status "combate") → nova corrida + evento. Atômico: quem
// decide entrar/continuar já recebe a fase RESOLVIDA (anti save-scum — ver Fase 2).
function resolverFase(exp: EstadoExpedicao, player: Player, mods: ModsExpedicao): { exp: EstadoExpedicao; evento: EventoFase } {
  const fase = exp.faseAtual;
  const boss = ehBoss(fase);
  const dano = danoRealFase(exp.seed, player, fase, mods);

  if (dano >= exp.hpAtual) {
    // 💀 morte: a fase NÃO foi completada; o loot preservado é só o já garantido (faseLimpa).
    const morto: EstadoExpedicao = { ...exp, hpAtual: 0, status: "morto" };
    return { exp: morto, evento: { fase, boss, limpou: false, morreu: true, danoRecebido: exp.hpAtual, cura: 0, sucata: 0, ganhouBau: false, hpApos: 0 } };
  }

  // ✅ limpou: bebe o dano, recupera um pouco, embolsa o loot e oferece o dilema.
  const cura = Math.round(exp.hpMax * EXPEDICAO.curaPorFase);
  const hp = Math.min(exp.hpMax, exp.hpAtual - dano + cura);
  const sucata = sucataDaFase(fase, mods);
  const ganhouBau = ganhaBauNaFase(exp.seed, fase);
  const novo: EstadoExpedicao = {
    ...exp,
    hpAtual: hp,
    faseLimpa: fase,
    lootSucata: exp.lootSucata + sucata,
    lootBaus: exp.lootBaus + (ganhouBau ? 1 : 0),
    ritmoNivel: Math.max(exp.ritmoNivel, nivelRitmo(fase)),
    status: "escolha",
  };
  return { exp: novo, evento: { fase, boss, limpou: true, morreu: false, danoRecebido: dano, cura, sucata, ganhouBau, hpApos: hp } };
}

// Inicia a corrida e resolve a PRIMEIRA fase (entrar já compromete a fase inicial).
export function iniciarExpedicao(player: Player, seed: number, mods: ModsExpedicao = MODS_EXP_NEUTROS): { exp: EstadoExpedicao; evento: EventoFase } {
  const hpMax = hpMaximo(player, mods);
  const faseInicial = Math.max(1, Math.floor(mods.faseInicial));
  const exp0: EstadoExpedicao = {
    seed: (seed >>> 0) || 1,
    faseAtual: faseInicial,
    faseLimpa: 0,
    hpMax,
    hpAtual: hpMax,
    lootSucata: 0,
    lootBaus: 0,
    ritmoNivel: 0,
    status: "combate",
  };
  return resolverFase(exp0, player, mods);
}

// 🎲 CONTINUAR: avança pra próxima fase e resolve (mais fundo, mais loot, mais risco).
export function continuarExpedicao(exp: EstadoExpedicao, player: Player, mods: ModsExpedicao = MODS_EXP_NEUTROS): { exp: EstadoExpedicao; evento: EventoFase | null } {
  if (exp.status !== "escolha") return { exp, evento: null }; // só a partir do dilema
  const proximo: EstadoExpedicao = { ...exp, faseAtual: exp.faseAtual + 1, status: "combate" };
  return resolverFase(proximo, player, mods);
}

// 🛟 RECUAR: sai com o loot GARANTIDO no banco (fim honroso — nada em risco).
export function recuarExpedicao(exp: EstadoExpedicao): EstadoExpedicao {
  if (exp.status !== "escolha") return exp;
  return { ...exp, status: "recuou" };
}

// Preview do risco da PRÓXIMA fase (mostrado no dilema). Honesto: usa a distribuição
// uniforme do jitter, sem revelar o número exato que a seed já fixou.
export interface PrevisaoFase {
  fase: number;
  boss: boolean;
  danoMin: number;
  danoMax: number;
  chanceMorte: number; // 0..1 (aprox. uniforme)
  sucataFase: number;
  hpAtual: number;
}

export function estimarProximaFase(exp: EstadoExpedicao, player: Player, mods: ModsExpedicao = MODS_EXP_NEUTROS): PrevisaoFase {
  const fase = exp.faseAtual + 1;
  const med = danoMedio(player, fase, mods);
  const j = EXPEDICAO.danoJitter;
  const danoMin = Math.max(1, Math.round(med * (1 - j)));
  const danoMax = Math.max(1, Math.round(med * (1 + j)));
  const hp = exp.hpAtual;
  let chanceMorte: number;
  if (danoMin >= hp) chanceMorte = 1;
  else if (danoMax < hp) chanceMorte = 0;
  else chanceMorte = (danoMax - hp) / (danoMax - danoMin);
  return { fase, boss: ehBoss(fase), danoMin, danoMax, chanceMorte: Math.round(chanceMorte * 100) / 100, sucataFase: sucataDaFase(fase, mods), hpAtual: hp };
}
