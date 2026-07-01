import { MISSOES_DIARIAS, MISSOES_SEMANAIS, PASSE, type DefMissao, type Recompensa, type TipoMissao } from "@/data/passe";
import { criarRng, type Rng } from "./rng";

// 🎟️ Motor do Passe de Batalha (PURO): nível por PP, missões (diárias/semanais) com
// renovação por tempo, progresso e resgate.

export const DIA_MS = 24 * 60 * 60 * 1000;
export const SEMANA_MS = 7 * DIA_MS;

export interface MissaoAtiva extends DefMissao {
  id: string;
  progresso: number;
  concluida: boolean;
}

export interface PasseState {
  temporadaId: string;
  pp: number;
  premium: boolean;
  resgatadasFree: number[];
  resgatadasPremium: number[];
  diarias: MissaoAtiva[];
  diariasEm: number;
  semanais: MissaoAtiva[];
  semanaisEm: number;
  ingressos: number; // ingressos de campeonato acumulados (até o sistema de campeonato existir)
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
function ativar(defs: DefMissao[], pre: string, seed: number): MissaoAtiva[] {
  return defs.map((d, i) => ({ ...d, id: `${pre}_${i}_${(seed >>> 0).toString(36)}`, progresso: 0, concluida: false }));
}

export function gerarDiarias(seed: number): MissaoAtiva[] {
  return ativar(escolher(MISSOES_DIARIAS, PASSE.qtdDiarias, criarRng(seed >>> 0)), "d", seed);
}
export function gerarSemanais(seed: number): MissaoAtiva[] {
  return ativar(escolher(MISSOES_SEMANAIS, PASSE.qtdSemanais, criarRng((seed ^ 0x9e3779b9) >>> 0)), "s", seed);
}

export function criarPasse(seed: number, agora: number, temporadaId = "s1"): PasseState {
  return {
    temporadaId,
    pp: 0,
    premium: false,
    resgatadasFree: [],
    resgatadasPremium: [],
    diarias: gerarDiarias(seed),
    diariasEm: agora,
    semanais: gerarSemanais(seed),
    semanaisEm: agora,
    ingressos: 0,
  };
}

// Renova diárias (24h) e semanais (7d) vencidas. Devolve o mesmo passe se nada venceu.
export function renovarMissoes(passe: PasseState, seed: number, agora: number): PasseState {
  let p = passe;
  if (agora - passe.diariasEm >= DIA_MS) p = { ...p, diarias: gerarDiarias(seed), diariasEm: agora };
  if (agora - passe.semanaisEm >= SEMANA_MS) p = { ...p, semanais: gerarSemanais((seed ^ 0x1234) >>> 0), semanaisEm: agora };
  return p;
}

function progredirLista(lista: MissaoAtiva[], tipo: TipoMissao, qtd: number): { lista: MissaoAtiva[]; ppGanho: number } {
  let ppGanho = 0;
  let mudou = false;
  const nova = lista.map((m) => {
    if (m.tipo !== tipo || m.concluida) return m;
    mudou = true;
    const progresso = Math.min(m.alvo, m.progresso + qtd);
    const concluida = progresso >= m.alvo;
    if (concluida) ppGanho += m.pp;
    return { ...m, progresso, concluida };
  });
  return { lista: mudou ? nova : lista, ppGanho };
}

// Avança as missões (diárias+semanais) de um tipo e soma o PP das concluídas. Mesmo objeto se nada mudou.
export function progredirPasse(passe: PasseState, tipo: TipoMissao, qtd = 1): PasseState {
  const d = progredirLista(passe.diarias, tipo, qtd);
  const s = progredirLista(passe.semanais, tipo, qtd);
  if (d.lista === passe.diarias && s.lista === passe.semanais) return passe;
  const ganho = d.ppGanho + s.ppGanho;
  const bonus = passe.premium ? Math.round(ganho * PASSE.premiumBonusPP) : 0;
  return { ...passe, diarias: d.lista, semanais: s.lista, pp: passe.pp + ganho + bonus };
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
