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

import { GRIND_PROP } from "@/data/grindProposito";

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
