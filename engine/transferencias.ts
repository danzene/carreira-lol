import { ELO_LADDER } from "@/data/simulacao";
import { TIMES, timeDe, type Time } from "@/data/times";
import { criarRng, entre, type Rng } from "./rng";
import type { CareerState, Offer, Tier } from "./types";

// Reputação, geração de propostas, negociação e contratos. PURO.

// Nível do elo de soloq em escala 0–100.
function nivelElo(elo: string): number {
  const i = ELO_LADDER.indexOf(elo as (typeof ELO_LADDER)[number]);
  return i < 0 ? 0 : (i / (ELO_LADDER.length - 1)) * 100;
}

// Quão "visto" o jogador é pelos times: reputação OU o elo de soloq (o que for maior).
// Subir de elo no soloq atrai times mesmo com pouca reputação.
export function visibilidade(career: CareerState): number {
  return Math.max(career.player.reputacao, nivelElo(career.player.rankSoloq.elo) * 0.9);
}

const SALARIO_TIER: Record<Tier, number> = {
  SOLOQ: 80,
  AMADOR: 150,
  ACADEMY: 400,
  TIER1: 1200,
  INTERNACIONAL: 3000,
};

function ofertaDoTime(t: Time, rng: Rng): Offer {
  const base = SALARIO_TIER[t.tier];
  const fator = 0.8 + (t.prestigio / 100) * 0.6 + entre(rng, -0.1, 0.1);
  const salarioSemanal = Math.max(50, Math.round((base * fator) / 10) * 10);
  return {
    timeId: t.id,
    tier: t.tier,
    salarioSemanal,
    bonusPorVitoria: Math.round((salarioSemanal * 0.25) / 5) * 5,
    duracaoSemanas: 26 + Math.round(entre(rng, 0, 26)),
  };
}

// Times se interessam quando seu prestígio está perto da sua reputação.
export function gerarOfertas(career: CareerState, seed: number): Offer[] {
  const rng = criarRng(seed);
  const rep = visibilidade(career);
  const ofertas: Offer[] = [];
  for (const t of TIMES) {
    if (t.id === career.contratoAtual?.timeId) continue;
    if (t.prestigio > rep + 12 || t.prestigio < rep - 25) continue;
    if (rng() < 0.2) ofertas.push(ofertaDoTime(t, rng));
  }
  return ofertas.slice(0, 3);
}

export function adicionarOfertas(career: CareerState, novas: Offer[]): CareerState {
  const naInbox = new Set(career.inbox.map((o) => o.timeId));
  const filtradas = novas.filter((o) => !naInbox.has(o.timeId));
  return { ...career, inbox: [...career.inbox, ...filtradas].slice(0, 6) };
}

export function assinarContrato(career: CareerState, timeId: string): CareerState {
  const oferta = career.inbox.find((o) => o.timeId === timeId);
  if (!oferta) return career;
  return {
    ...career,
    contratoAtual: {
      timeId: oferta.timeId,
      salarioSemanal: oferta.salarioSemanal,
      bonusPorVitoria: oferta.bonusPorVitoria,
      semanasRestantes: oferta.duracaoSemanas,
      tier: oferta.tier,
    },
    tierAtual: oferta.tier,
    inbox: [],
  };
}

export function recusarOferta(career: CareerState, timeId: string): CareerState {
  return { ...career, inbox: career.inbox.filter((o) => o.timeId !== timeId) };
}

// Contraproposta: pede +25%. Aceita se reputação >= prestígio; senão o time retira.
export function contraproposta(career: CareerState, timeId: string): { career: CareerState; aceita: boolean } {
  const oferta = career.inbox.find((o) => o.timeId === timeId);
  const time = timeDe(timeId);
  if (!oferta || !time) return { career, aceita: false };

  if (visibilidade(career) >= time.prestigio) {
    const melhor: Offer = {
      ...oferta,
      salarioSemanal: Math.round((oferta.salarioSemanal * 1.25) / 10) * 10,
      condicao: "negociada",
    };
    return { career: { ...career, inbox: career.inbox.map((o) => (o.timeId === timeId ? melhor : o)) }, aceita: true };
  }
  return { career: { ...career, inbox: career.inbox.filter((o) => o.timeId !== timeId) }, aceita: false };
}

// Bônus de treino das instalações do time atual (0 = sem time).
export function bonusInstalacoes(career: CareerState): number {
  const t = career.contratoAtual ? timeDe(career.contratoAtual.timeId) : undefined;
  return t ? t.instalacoes / 100 : 0;
}
