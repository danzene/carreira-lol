import { BATALHA, type Lane, type Ponto, laneDeRota, LANES, pontoNaRota, posicaoObjetivo } from "@/data/batalha";
import { criarRng, type Rng } from "./rng";
import type { KDA, Role } from "./types";

// Roteiro de batalha (PURO): transforma o resultado da partida numa sequência determinística
// de eventos com tempo (em segundos de animação) e posições. A UI (canvas) coreografa.

export type EventoTipo = "spawn" | "poke" | "abate" | "objetivo" | "torre" | "teamfight" | "nexus";

export interface Combatente {
  id: string; // "azul-MID"
  time: "azul" | "vermelho";
  rota: Role;
  ehVoce: boolean;
  championId?: string;
}

export interface EventoBatalha {
  t: number; // segundos no tempo de animação
  minuto: number; // minuto de jogo exibido
  tipo: EventoTipo;
  texto?: string;
  local?: Ponto;
  abate?: { matadorId: string; vitimaId: string };
  objetivo?: "dragao" | "barao";
  torre?: { time: "azul" | "vermelho"; lane: Lane };
  vencedor?: "azul" | "vermelho";
}

export interface RoteiroBatalha {
  combatentes: Combatente[];
  eventos: EventoBatalha[];
  duracao: number;
  vitoria: boolean;
  placar: { azul: number; vermelho: number };
}

const ROTAS: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
const ROTULO: Record<Role, string> = { TOP: "TOP", JUNGLE: "JG", MID: "MID", ADC: "ADC", SUPPORT: "SUP" };

export interface TimeEntrada {
  championId: string;
  rota: Role;
}

export interface EntradaRoteiro {
  vitoria: boolean;
  kda: KDA;
  nota: number;
  rotaVoce: Role;
  timeAzul: TimeEntrada[];
  timeVermelho: TimeEntrada[];
  vantagem: number; // comp - compInimigo (>0 favorece o azul)
  seed: number;
}

function nomeComb(c: Combatente): string {
  if (c.ehVoce) return "VOCÊ";
  return `${c.time === "azul" ? "Aliado" : "Inimigo"} ${ROTULO[c.rota]}`;
}

function laneMid(lane: Lane): Ponto {
  return pontoNaRota(LANES[lane], 0.5);
}

export function gerarRoteiro(e: EntradaRoteiro): RoteiroBatalha {
  const rng = criarRng(e.seed >>> 0);
  const escolha = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const montar = (time: "azul" | "vermelho", lista: TimeEntrada[]): Combatente[] =>
    ROTAS.map((rota) => {
      const ent = lista.find((x) => x.rota === rota);
      return {
        id: `${time}-${rota}`,
        time,
        rota,
        ehVoce: time === "azul" && rota === e.rotaVoce,
        championId: ent?.championId,
      };
    });

  const combatentes = [...montar("azul", e.timeAzul), ...montar("vermelho", e.timeVermelho)];
  const azuis = combatentes.filter((c) => c.time === "azul");
  const vermelhos = combatentes.filter((c) => c.time === "vermelho");
  const voce = azuis.find((c) => c.ehVoce)!;

  // viés de quem ganha confrontos
  const favorAzul = Math.max(0.25, Math.min(0.75, (e.vitoria ? 0.6 : 0.4) + e.vantagem * 0.006));
  const azulGanha = () => rng() < favorAzul;

  const eventos: EventoBatalha[] = [];
  const placar = { azul: 0, vermelho: 0 };
  const add = (ev: EventoBatalha) => eventos.push(ev);

  const abate = (t: number, minuto: number, matador: Combatente, vitima: Combatente, local: Ponto, tipo: EventoTipo = "abate") => {
    if (matador.time === "azul") placar.azul++;
    else placar.vermelho++;
    add({
      t,
      minuto,
      tipo,
      local,
      abate: { matadorId: matador.id, vitimaId: vitima.id },
      texto: `${nomeComb(matador)} abateu ${nomeComb(vitima)}`,
    });
  };

  // cota de abates do jogador (limitada pra não poluir o feed)
  let killsVoce = Math.min(e.kda.k, 4);
  let mortesVoce = Math.min(e.kda.d, 3);

  // confronto genérico: gera um abate respeitando a cota do jogador quando der.
  const confronto = (t: number, minuto: number, local: Ponto, tipo: EventoTipo = "abate") => {
    const azulVence = azulGanha();
    if (azulVence && killsVoce > 0 && rng() < 0.6) {
      abate(t, minuto, voce, escolha(vermelhos), local, tipo);
      killsVoce--;
    } else if (!azulVence && mortesVoce > 0 && rng() < 0.6) {
      abate(t, minuto, escolha(vermelhos), voce, local, tipo);
      mortesVoce--;
    } else if (azulVence) {
      abate(t, minuto, escolha(azuis), escolha(vermelhos), local, tipo);
    } else {
      abate(t, minuto, escolha(vermelhos), escolha(azuis), local, tipo);
    }
  };

  // 0) spawn
  add({ t: 0.4, minuto: 0, tipo: "spawn", texto: "Início de jogo" });

  // 1) fase de rotas — pokes
  const lanes: Lane[] = ["top", "mid", "bot"];
  add({ t: 3, minuto: 2, tipo: "poke", local: laneMid(escolha(lanes)) });
  add({ t: 5, minuto: 3, tipo: "poke", local: laneMid(escolha(lanes)) });

  // 2) first blood
  confronto(6.8, 4, laneMid(laneDeRota(e.rotaVoce)), "abate");

  // 3) dragão
  add({ t: 10, minuto: 8, tipo: "objetivo", objetivo: "dragao", local: posicaoObjetivo("dragao"), vencedor: azulGanha() ? "azul" : "vermelho", texto: "Dragão no rio" });
  confronto(11.2, 9, posicaoObjetivo("dragao"));

  // 4) teamfight no meio
  add({ t: 15, minuto: 14, tipo: "teamfight", local: laneMid("mid"), texto: "Teamfight no meio!" });
  confronto(15.6, 14, laneMid("mid"), "teamfight");
  confronto(16.4, 15, laneMid("mid"), "teamfight");

  // 5) torres (quem venceu a luta pressiona)
  const ladoForte: "azul" | "vermelho" = e.vitoria ? "azul" : "vermelho";
  const ladoFraco: "azul" | "vermelho" = e.vitoria ? "vermelho" : "azul";
  add({ t: 18, minuto: 16, tipo: "torre", torre: { time: ladoFraco, lane: escolha(lanes) }, texto: "Torre destruída" });

  // 6) barão
  add({ t: 22, minuto: 21, tipo: "objetivo", objetivo: "barao", local: posicaoObjetivo("barao"), vencedor: ladoForte, texto: "BARÃO!" });
  confronto(23, 22, posicaoObjetivo("barao"));

  // 7) teamfight final
  add({ t: 26, minuto: 26, tipo: "teamfight", local: laneMid("mid"), texto: "Luta decisiva!" });
  confronto(26.6, 26, laneMid("mid"), "teamfight");
  confronto(27.3, 27, laneMid("mid"), "teamfight");

  // 8) push final + nexus (o vencedor pressiona)
  add({ t: 29, minuto: 28, tipo: "torre", torre: { time: ladoFraco, lane: "mid" }, texto: "Inibidor caindo" });
  add({
    t: 31,
    minuto: 28,
    tipo: "nexus",
    vencedor: ladoForte,
    local: e.vitoria ? BATALHA.nexusVermelho : BATALHA.nexusAzul,
    texto: e.vitoria ? "Nexus inimigo destruído!" : "Seu Nexus caiu...",
  });

  eventos.sort((a, b) => a.t - b.t);

  return { combatentes, eventos, duracao: BATALHA.duracaoBase, vitoria: e.vitoria, placar };
}
