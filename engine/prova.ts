import type { ContextoPartida } from "./simularPartida";
import { criarRng } from "./rng";
import type { CareerState, ChampionDef, Classe, KDA, MatchResult } from "./types";

// 🏁 Prova Semanal (PURO): desafio com regras mutantes, MESMA seed pra todos os
// jogadores — a prova é derivada do número da semana ISO real, então qualquer cliente
// chega na mesma prova sem o servidor decidir nada.
// Reset: segunda-feira 00:00 no FUSO DO CLIENTE (aceitável nesta versão; a validação
// server-side futura usará UTC — documentado em docs/telemetria.md e no CHANGELOG).

// Semana ISO-8601 como número (ano*100 + semana). Fuso local do cliente.
export function semanaISO(agora: number): number {
  const d = new Date(agora);
  const data = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = (data.getDay() + 6) % 7; // seg=0
  data.setDate(data.getDate() - dia + 3); // quinta-feira da semana ISO
  const ano = data.getFullYear();
  const jan4 = new Date(ano, 0, 4);
  const dia4 = (jan4.getDay() + 6) % 7;
  const semana1 = new Date(ano, 0, 4 - dia4 + 3);
  const w = 1 + Math.round((data.getTime() - semana1.getTime()) / (7 * 86400000));
  return ano * 100 + w;
}

// ms até a próxima segunda 00:00 local (countdown da próxima prova).
export function msAteProximaProva(agora: number): number {
  const d = new Date(agora);
  const prox = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = (prox.getDay() + 6) % 7; // seg=0
  prox.setDate(prox.getDate() + (7 - dia));
  return Math.max(0, prox.getTime() - agora);
}

// ---- Modificadores (flags que os sistemas existentes honram) ----
export type ModificadorId =
  | "maestria20" // só campeões com maestria 20+ no banco
  | "so_classe" // só campeões da classe da semana
  | "sem_itens" // bônus de itens equipados desligado
  | "sem_lendas" // bônus de cartas de Lenda desligado
  | "counters_dobro" // matchups valem o dobro
  | "draft_espelhado" // comps se anulam (mesma força, counters zerados)
  | "kda_rei" // KDA pesa mais que vitória no score
  | "inimigos_buffados" // inimigo com força extra
  | "comp_cega" // o draft não importa (comps fixas 50/50) — só skill
  | "nota_de_ouro"; // bônus de score por performance nota 8+

export interface DefModificador {
  id: ModificadorId;
  nome: string;
  emoji: string;
  desc: string;
}

export const MODIFICADORES: DefModificador[] = [
  { id: "maestria20", nome: "Especialistas", emoji: "🎯", desc: "Só campeões com maestria 20+ entram no draft." },
  { id: "so_classe", nome: "Monoclasse", emoji: "🧬", desc: "Só campeões da classe da semana." },
  { id: "sem_itens", nome: "Setup Cru", emoji: "🚫", desc: "Bônus dos itens equipados desligado." },
  { id: "sem_lendas", nome: "Sem Cartas", emoji: "🃏", desc: "Bônus das cartas de Lenda desligado." },
  { id: "counters_dobro", nome: "Xadrez", emoji: "♟️", desc: "Counters valem O DOBRO — draft é tudo." },
  { id: "draft_espelhado", nome: "Espelho", emoji: "🪞", desc: "As comps se anulam. Vence o jogador, não o draft." },
  { id: "kda_rei", nome: "Rei do KDA", emoji: "👑", desc: "KDA pesa mais que a vitória no score." },
  { id: "inimigos_buffados", nome: "Chefões", emoji: "💀", desc: "Inimigos com força extra." },
  { id: "comp_cega", nome: "Comp Cega", emoji: "🙈", desc: "Força de comp travada — só skill individual." },
  { id: "nota_de_ouro", nome: "Nota de Ouro", emoji: "🌟", desc: "Bônus de score por partida com nota 8+." },
];

const CLASSES: Classe[] = ["TANK", "LUTADOR", "MAGO", "ATIRADOR", "ASSASSINO", "SUPORTE"];

export interface ProvaSemanal {
  semana: number; // semanaISO
  seed: number; // seed pública da semana (mesma pra todos)
  modificadores: ModificadorId[]; // 1-2
  classeDaSemana?: Classe; // quando "so_classe" está ativo
}

// Deriva a prova da semana — determinístico: mesma semana ⇒ mesma prova em qualquer cliente.
export function gerarProvaSemanal(semana: number): ProvaSemanal {
  const rng = criarRng((semana * 2654435761) >>> 0);
  const qtd = rng() < 0.45 ? 1 : 2;
  const pool = [...MODIFICADORES];
  const mods: ModificadorId[] = [];
  for (let i = 0; i < qtd; i++) mods.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  const classeDaSemana = mods.includes("so_classe") ? CLASSES[Math.floor(rng() * CLASSES.length)] : undefined;
  return { semana, seed: (semana * 7919) >>> 0, modificadores: mods, classeDaSemana };
}

export function defModificador(id: ModificadorId): DefModificador {
  return MODIFICADORES.find((m) => m.id === id)!;
}

// Campeões PROIBIDOS no draft da prova (a prova muda o meta de todos, IA inclusa).
export function proibidosProva(prova: ProvaSemanal, pool: { championId: string; pontos: number }[], banco: ChampionDef[]): string[] {
  const out = new Set<string>();
  if (prova.modificadores.includes("maestria20")) {
    const ok = new Set(pool.filter((p) => p.pontos >= 20).map((p) => p.championId));
    for (const c of banco) if (!ok.has(c.id)) out.add(c.id);
  }
  if (prova.modificadores.includes("so_classe") && prova.classeDaSemana) {
    for (const c of banco) if (!c.classes.includes(prova.classeDaSemana)) out.add(c.id);
  }
  return [...out];
}

// Ajusta o contexto de partida conforme os modificadores (regra de jogo NO ENGINE).
export function ajustarCtxProva(ctx: ContextoPartida, prova: ProvaSemanal): ContextoPartida {
  let novo = { ...ctx };
  if (prova.modificadores.includes("counters_dobro")) {
    novo = { ...novo, counterLane: (novo.counterLane ?? 0) * 2, counterComp: (novo.counterComp ?? 0) * 2 };
  }
  if (prova.modificadores.includes("draft_espelhado")) {
    novo = { ...novo, compInimigo: novo.comp, counterLane: 0, counterComp: 0 };
  }
  if (prova.modificadores.includes("comp_cega")) {
    novo = { ...novo, comp: 50, compInimigo: 50, counterComp: 0 };
  }
  if (prova.modificadores.includes("inimigos_buffados")) {
    novo = { ...novo, bonusInimigo: (novo.bonusInimigo ?? 0) + 6 };
  }
  return novo;
}

// ---- Estado da prova no save + score ----
export interface ResultadoProva {
  vitoria: boolean;
  nota: number;
  kda: KDA;
}

export interface EstadoProva {
  semana: number;
  resultados: ResultadoProva[]; // até 3
  finalizada: boolean;
  scoreFinal?: number;
}

export const PROVA = { partidas: 3 } as const;

// Score agregado (PURO): função dos 3 resultados + modificadores de score.
export function scoreProva(resultados: ResultadoProva[], prova: ProvaSemanal): number {
  const kdaRei = prova.modificadores.includes("kda_rei");
  const notaOuro = prova.modificadores.includes("nota_de_ouro");
  let total = 0;
  for (const r of resultados) {
    const kdaScore = (r.kda.k + r.kda.a) / Math.max(1, r.kda.d);
    total += r.vitoria ? (kdaRei ? 60 : 100) : 25;
    total += r.nota * 10;
    if (kdaRei) total += kdaScore * 15;
    if (notaOuro && r.nota >= 8) total += 40;
  }
  return Math.round(total);
}

// Garante o estado da prova da semana (nova semana = prova zerada).
export function garantirProva(c: CareerState, semana: number): CareerState {
  if (c.prova?.semana === semana) return c;
  return { ...c, prova: { semana, resultados: [], finalizada: false } };
}

export function podeJogarProva(c: CareerState, semana: number): boolean {
  const p = c.prova;
  if (!p || p.semana !== semana) return true; // nova semana → pode (será zerada)
  return !p.finalizada && p.resultados.length < PROVA.partidas;
}

// Registra uma partida da prova; na 3ª calcula o score final.
export function registrarPartidaProva(c: CareerState, resultado: MatchResult, prova: ProvaSemanal): CareerState {
  const atual = c.prova?.semana === prova.semana ? c.prova : { semana: prova.semana, resultados: [], finalizada: false };
  if (atual.finalizada || atual.resultados.length >= PROVA.partidas) return c;
  const resultados = [...atual.resultados, { vitoria: resultado.vitoria, nota: resultado.notaPerformance, kda: resultado.kda }];
  const finalizada = resultados.length >= PROVA.partidas;
  return {
    ...c,
    prova: { semana: prova.semana, resultados, finalizada, scoreFinal: finalizada ? scoreProva(resultados, prova) : undefined },
  };
}
