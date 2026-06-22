import { CRIACAO, INICIO } from "@/data/config";
import type { Attributes, CareerState, ChampionMastery, Player, Role } from "./types";

// Lógica PURA de criação de jogador. Recebe dados → devolve estado. Zero React/browser.

export interface CriarPlayerInput {
  nome: string;
  nacionalidade: string;
  rota: Role;
  atributos: Attributes;
  campeoes: string[]; // championIds escolhidos
}

export function atributosIniciais(): Attributes {
  const b = CRIACAO.atributoBase;
  return {
    mecanica: b,
    macro: b,
    laning: b,
    teamfight: b,
    consistencia: b,
    mental: b,
    comunicacao: b,
    championPool: b,
  };
}

export function somaPontosDistribuidos(attrs: Attributes): number {
  const base = CRIACAO.atributoBase;
  return (Object.values(attrs) as number[]).reduce((acc, v) => acc + (v - base), 0);
}

export function pontosRestantes(attrs: Attributes): number {
  return CRIACAO.pontosParaDistribuir - somaPontosDistribuidos(attrs);
}

export function validarCriacao(input: CriarPlayerInput): string[] {
  const erros: string[] = [];

  if (!input.nome.trim()) erros.push("Escolha um nome.");
  else if (input.nome.trim().length > 16) erros.push("Nome muito longo (máx. 16).");

  const restantes = pontosRestantes(input.atributos);
  if (restantes !== 0) {
    erros.push(restantes > 0 ? `Ainda faltam ${restantes} pontos para distribuir.` : "Você distribuiu pontos demais.");
  }

  for (const v of Object.values(input.atributos) as number[]) {
    if (v < CRIACAO.atributoBase || v > CRIACAO.tetoNaCriacao) {
      erros.push(`Cada atributo deve ficar entre ${CRIACAO.atributoBase} e ${CRIACAO.tetoNaCriacao}.`);
      break;
    }
  }

  if (input.campeoes.length !== CRIACAO.tamanhoPool) {
    erros.push(`Escolha exatamente ${CRIACAO.tamanhoPool} campeões.`);
  }

  return erros;
}

export function criarPlayer(input: CriarPlayerInput): Player {
  const pool: ChampionMastery[] = input.campeoes.map((championId) => ({
    championId,
    pontos: CRIACAO.maestriaInicial,
  }));

  return {
    nome: input.nome.trim(),
    nacionalidade: input.nacionalidade,
    idade: CRIACAO.idadeInicial,
    rota: input.rota,
    atributos: { ...input.atributos },
    pool,
    reputacao: INICIO.reputacao,
    rankSoloq: { ...INICIO.rank },
    energia: INICIO.energia,
    moral: INICIO.moral,
  };
}

export function criarCareerState(player: Player): CareerState {
  return {
    player,
    dinheiro: INICIO.dinheiro,
    contratoAtual: null,
    semanaAtual: 1,
    temporada: 1,
    historicoPartidas: [],
    inbox: [],
  };
}
