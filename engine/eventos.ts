import { CHANCE_EVENTO, EVENTOS } from "@/data/eventos";
import { criarRng } from "./rng";
import type { CareerState, EventoAtivo } from "./types";

// Partidas-evento (PURO). Surge um evento por semana com baixa chance, conforme a reputação.

export function gerarEvento(career: CareerState, seed: number): EventoAtivo | null {
  if (career.eventoAtual) return career.eventoAtual; // já existe um pendente
  const rng = criarRng(seed >>> 0);
  if (rng() > CHANCE_EVENTO) return null;
  const elegiveis = EVENTOS.filter((e) => career.player.reputacao >= e.repMin);
  if (elegiveis.length === 0) return null;
  const m = elegiveis[Math.floor(rng() * elegiveis.length)];
  return {
    tipo: m.id,
    nome: m.nome,
    desc: m.desc,
    bonusInimigo: m.bonusInimigo,
    premioDinheiro: m.premioDinheiro,
    premioReputacao: m.premioReputacao,
  };
}

// Recompensa do evento conforme o resultado (vitória = cheia; derrota = parcial).
export function premioEvento(ev: EventoAtivo, vitoria: boolean): { dinheiro: number; reputacao: number } {
  const fator = vitoria ? 1 : 0.4;
  return {
    dinheiro: Math.round(ev.premioDinheiro * fator),
    reputacao: Math.round(ev.premioReputacao * fator * 10) / 10,
  };
}
