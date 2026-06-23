import { criarRng } from "./rng";
import type { AtributoKey, Player } from "./types";

// Roteiro da partida interativa: momentos de decisão + eventos de ambiente.
// Puro e determinístico (seed). As decisões do jogador viram um "modificador"
// que entra na resolução final (ver simularPartida com o 4º parâmetro).

export type LocalMapa = "TOP" | "MID" | "BOT" | "DRAGAO" | "BARAO" | "RIO";

export interface OpcaoDecisao {
  texto: string;
  atributo: AtributoKey; // atributo que mais pesa nessa jogada
  efeito: number; // já resolvido (+/-) — escondido do jogador até escolher
  consequencia: string; // o que aconteceu
  arriscada: boolean;
}

export interface Momento {
  minuto: number;
  local: LocalMapa;
  contexto: string;
  opcoes: OpcaoDecisao[];
}

export interface EventoFlavor {
  minuto: number;
  local: LocalMapa;
  texto: string;
}

export interface RoteiroPartida {
  duracaoMin: number;
  momentos: Momento[];
  flavor: EventoFlavor[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function gerarRoteiro(player: Player, seed: number): RoteiroPartida {
  // sub-seed pra não casar com a sequência da simulação final
  const rng = criarRng((seed ^ 0x9e3779b9) >>> 0);

  const safe = (texto: string, atributo: AtributoKey, efeito: number, consequencia: string): OpcaoDecisao => ({
    texto,
    atributo,
    efeito,
    consequencia,
    arriscada: false,
  });

  const risky = (
    texto: string,
    atributo: AtributoKey,
    ganho: number,
    perda: number,
    ok: string,
    fail: string,
  ): OpcaoDecisao => {
    const chance = clamp(0.4 + (player.atributos[atributo] - 45) / 110, 0.25, 0.9);
    const sucesso = rng() < chance;
    return { texto, atributo, arriscada: true, efeito: sucesso ? ganho : -perda, consequencia: sucesso ? ok : fail };
  };

  const momentos: Momento[] = [
    {
      minuto: 3,
      local: "MID",
      contexto: "Seu oponente está farmando sob a torre, com pouca vida.",
      opcoes: [
        risky("Pular pra all-in", "mecanica", 5, 3, "All-in limpo — First Blood! 🩸", "Ele flashou e te puniu de volta."),
        safe("Zonear e negar o CS", "laning", 2, "Você nega o farm e fica com prioridade."),
        safe("Farmar tranquilo", "consistencia", 1, "Farm estável, sem riscos."),
      ],
    },
    {
      minuto: 8,
      local: "DRAGAO",
      contexto: "O primeiro Dragão vai nascer e o time se movimenta.",
      opcoes: [
        risky("Rotacionar e contestar", "macro", 5, 3, "Vocês garantem o Dragão! 🐉", "Pego fora de posição — morte boba."),
        safe("Pressionar a torre enquanto isso", "laning", 2, "Você racha a torre e ganha gold."),
        safe("Dar o objetivo e farmar", "consistencia", 1, "Sem briga: você farma a wave."),
      ],
    },
    {
      minuto: 14,
      local: "MID",
      contexto: "Os times se encaram no meio — luta 5v5 se formando.",
      opcoes: [
        risky("Iniciar a luta você mesmo", "teamfight", 6, 4, "Engage perfeito — triple kill! 🔥", "Engage solo: você cai primeiro."),
        safe("Esperar o engage do time", "mental", 2, "Você entra na hora certa e limpa."),
        safe("Split push na lateral", "macro", 2, "Pressão lateral abre o mapa."),
      ],
    },
    {
      minuto: 20,
      local: "BARAO",
      contexto: "O time inimigo começa o Barão. Decisão de alto risco.",
      opcoes: [
        risky("Contestar o Barão agora", "teamfight", 7, 4, "STEAL de Barão!! Vira o jogo. 🟣", "Vocês são aceados na pit."),
        safe("Trocar por torres do outro lado", "macro", 2, "Vocês trocam Barão por duas torres."),
        safe("Recuar e defender", "mental", 1, "Defesa segura, sem perdas."),
      ],
    },
    {
      minuto: 27,
      local: "MID",
      contexto: "Reta final: dá pra fechar o jogo numa luta.",
      opcoes: [
        risky("Forçar a luta final", "teamfight", 5, 3, "Vocês limpam o time e fecham! 🏆", "Overextend — base aberta."),
        safe("Jogar pelo late com calma", "mental", 2, "Você joga seguro e escala."),
        safe("Pressão de mapa", "macro", 2, "Pressão de waves força erros."),
      ],
    },
  ];

  const flavor: EventoFlavor[] = [
    { minuto: 1, local: "RIO", texto: "Início de jogo — wards colocadas no rio." },
    { minuto: 5, local: "BOT", texto: "Escaramuça na bot, ninguém morre." },
    { minuto: 11, local: "TOP", texto: "Top empurra a wave e teleporta." },
    { minuto: 17, local: "DRAGAO", texto: "Alma do Dragão em disputa." },
    { minuto: 23, local: "TOP", texto: "Inibidor pressionado na lateral." },
  ];

  return { duracaoMin: 30, momentos, flavor };
}
