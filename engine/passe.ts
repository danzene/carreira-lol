import { MISSOES_DIARIAS, MISSOES_SEMANAIS, PASSE, type DefMissao, type Recompensa, type TipoMissao } from "@/data/passe";
import { criarRng, type Rng } from "./rng";

// 🎟️ Motor do Passe de Batalha (PURO): nível por PP, geração de missões, progresso e resgate.

export interface MissaoAtiva extends DefMissao {
  id: string;
  progresso: number;
  concluida: boolean;
}

export interface PasseState {
  temporadaId: string;
  pp: number; // Pontos de Passe acumulados na temporada
  premium: boolean;
  resgatadasFree: number[]; // níveis já resgatados (trilha grátis)
  resgatadasPremium: number[];
  missoes: MissaoAtiva[];
  missoesEm: number; // epoch ms da geração (renovação por tempo)
}

export function nivelDoPasse(pp: number): number {
  return Math.min(PASSE.niveis, Math.floor(Math.max(0, pp) / PASSE.ppPorNivel) + 1);
}

export function ppNoNivel(pp: number): number {
  return Math.max(0, pp) % PASSE.ppPorNivel;
}

export function ppParaProximo(pp: number): number {
  return nivelDoPasse(pp) >= PASSE.niveis ? 0 : PASSE.ppPorNivel - ppNoNivel(pp);
}

function escolher<T>(pool: T[], qtd: number, rng: Rng): T[] {
  const p = [...pool];
  const out: T[] = [];
  for (let i = 0; i < qtd && p.length > 0; i++) out.push(p.splice(Math.floor(rng() * p.length), 1)[0]);
  return out;
}

export function gerarMissoes(seed: number): MissaoAtiva[] {
  const rng = criarRng(seed >>> 0);
  const ativar = (defs: DefMissao[], pre: string): MissaoAtiva[] =>
    defs.map((d, i) => ({ ...d, id: `${pre}_${i}_${(seed >>> 0).toString(36)}`, progresso: 0, concluida: false }));
  return [
    ...ativar(escolher(MISSOES_DIARIAS, PASSE.qtdDiarias, rng), "d"),
    ...ativar(escolher(MISSOES_SEMANAIS, PASSE.qtdSemanais, rng), "s"),
  ];
}

export function criarPasse(seed: number, agora: number, temporadaId = "s1"): PasseState {
  return {
    temporadaId,
    pp: 0,
    premium: false,
    resgatadasFree: [],
    resgatadasPremium: [],
    missoes: gerarMissoes(seed),
    missoesEm: agora,
  };
}

// Avança o progresso das missões de um tipo; devolve as missões novas + PP ganho (das concluídas agora).
export function progredirMissoes(missoes: MissaoAtiva[], tipo: TipoMissao, qtd = 1): { missoes: MissaoAtiva[]; ppGanho: number } {
  let ppGanho = 0;
  const novas = missoes.map((m) => {
    if (m.tipo !== tipo || m.concluida) return m;
    const progresso = Math.min(m.alvo, m.progresso + qtd);
    const concluida = progresso >= m.alvo;
    if (concluida) ppGanho += m.pp;
    return { ...m, progresso, concluida };
  });
  return { missoes: novas, ppGanho };
}

export function podeResgatar(passe: PasseState, r: Recompensa): boolean {
  if (nivelDoPasse(passe.pp) < r.nivel) return false;
  if (r.trilha === "premium" && !passe.premium) return false;
  const ja = r.trilha === "free" ? passe.resgatadasFree : passe.resgatadasPremium;
  return !ja.includes(r.nivel);
}

export function marcarResgatada(passe: PasseState, r: Recompensa): PasseState {
  return r.trilha === "free"
    ? { ...passe, resgatadasFree: [...passe.resgatadasFree, r.nivel] }
    : { ...passe, resgatadasPremium: [...passe.resgatadasPremium, r.nivel] };
}
