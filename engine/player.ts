import { CRIACAO, INICIO } from "@/data/config";
import { OPCOES_PADRAO } from "@/data/opcoes";
import type { Attributes, CareerState, ChampionMastery, OpcoesCarreira, Player, Role, TraitId } from "./types";

// Criação de jogador (lógica PURA). Recebe dados → devolve estado.

export interface CriarPlayerInput {
  nome: string;
  nacionalidade: string;
  rota: Role;
  atributos: Attributes;
  traco: TraitId;
  campeoes: string[];
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

export interface FormularioCriacao {
  nome: string;
  atributos: Attributes;
  traco: TraitId | null;
  campeoes: string[];
}

export function validarCriacao(form: FormularioCriacao): string[] {
  const erros: string[] = [];

  if (!form.nome.trim()) erros.push("Escolha um nome.");
  else if (form.nome.trim().length > 16) erros.push("Nome muito longo (máx. 16).");

  const restantes = pontosRestantes(form.atributos);
  if (restantes !== 0) {
    erros.push(restantes > 0 ? `Ainda faltam ${restantes} pontos para distribuir.` : "Você distribuiu pontos demais.");
  }

  for (const v of Object.values(form.atributos) as number[]) {
    if (v < CRIACAO.atributoBase || v > CRIACAO.tetoNaCriacao) {
      erros.push(`Cada atributo deve ficar entre ${CRIACAO.atributoBase} e ${CRIACAO.tetoNaCriacao}.`);
      break;
    }
  }

  if (!form.traco) erros.push("Escolha um traço inicial.");
  if (form.campeoes.length !== CRIACAO.tamanhoPool) erros.push(`Escolha exatamente ${CRIACAO.tamanhoPool} campeões.`);

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
    tracos: [input.traco],
    reputacao: INICIO.reputacao,
    rankSoloq: { ...INICIO.rank },
    energia: INICIO.energia,
    moral: INICIO.moral,
  };
}

export function criarCareerState(player: Player, opcoes: OpcoesCarreira = OPCOES_PADRAO): CareerState {
  return {
    player,
    dinheiro: INICIO.dinheiro,
    equipamentos: [],
    contratoAtual: null,
    semanaAtual: 1,
    temporada: 1,
    tierAtual: "SOLOQ",
    historicoPartidas: [],
    inbox: [],
    patchVigente: 1,
    opcoes,
    scoutPontos: 0, // começa sem CoinPoints — ganha jogando/avançando a semana
  };
}

// Reembolso dos periféricos antigos (sistema removido): devolve em $ TUDO que foi
// investido. Custos históricos: nível N custava 200 + (N-1)*250 → total = 200N + 125N(N-1).
function reembolsoPerifericos(bruto: CareerState): number {
  if (!Array.isArray(bruto.equipamentos) || bruto.equipamentos.length === 0) return 0;
  return bruto.equipamentos.reduce((soma, e) => {
    const n = typeof e?.nivel === "number" ? Math.max(0, e.nivel) : 0;
    return soma + 200 * n + 125 * n * (n - 1);
  }, 0);
}

// 🩹 Migração de save (PURO): saves antigos/parciais (localStorage de versões velhas ou
// nuvem incompleta) ganham TODOS os campos obrigatórios com defaults sãos — o jogo
// nunca crasha por campo faltando. Também converte sistemas removidos (periféricos → $).
// Roda em todo carregamento de slot.
export function normalizarCareer(bruto: CareerState): CareerState {
  const p = (bruto.player ?? {}) as Partial<Player>;
  const reembolso = reembolsoPerifericos(bruto);
  return {
    ...bruto,
    dinheiro: (typeof bruto.dinheiro === "number" ? bruto.dinheiro : INICIO.dinheiro) + reembolso,
    equipamentos: [], // periféricos antigos saíram do jogo (reembolsados acima)
    contratoAtual: bruto.contratoAtual ?? null,
    semanaAtual: typeof bruto.semanaAtual === "number" ? bruto.semanaAtual : 1,
    temporada: typeof bruto.temporada === "number" ? bruto.temporada : 1,
    tierAtual: bruto.tierAtual ?? "SOLOQ",
    historicoPartidas: Array.isArray(bruto.historicoPartidas) ? bruto.historicoPartidas : [],
    inbox: Array.isArray(bruto.inbox) ? bruto.inbox : [],
    patchVigente: typeof bruto.patchVigente === "number" ? bruto.patchVigente : 1,
    feed: Array.isArray(bruto.feed) ? bruto.feed : [],
    feedNovos: typeof bruto.feedNovos === "number" ? bruto.feedNovos : 0,
    player: {
      nome: p.nome ?? "Jogador",
      nacionalidade: p.nacionalidade ?? "Brasil",
      idade: typeof p.idade === "number" ? p.idade : 17,
      rota: p.rota ?? "MID",
      atributos: { ...atributosIniciais(), ...(p.atributos ?? {}) },
      pool: Array.isArray(p.pool) ? p.pool : [],
      tracos: Array.isArray(p.tracos) ? p.tracos : [],
      reputacao: typeof p.reputacao === "number" ? p.reputacao : 0,
      rankSoloq: p.rankSoloq ?? { ...INICIO.rank },
      energia: typeof p.energia === "number" ? p.energia : INICIO.energia,
      moral: typeof p.moral === "number" ? p.moral : INICIO.moral,
    },
  };
}
