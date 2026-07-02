import { BATALHA, type Lane, type Ponto, laneDeRota, LANES, pontoNaRota, posicaoObjetivo } from "@/data/batalha";
import { criarRng } from "./rng";
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

  // ---- ritmo do jogo pela DOMINÂNCIA: stomp = curto e sangrento; parelho = longo com viradas ----
  const dominancia = Math.abs(favorAzul - 0.5) * 2; // 0 (parelho) .. 0.5 (stomp)
  const parelho = dominancia < 0.16;
  const fimMin = 24 + Math.round((1 - dominancia * 2) * 10) + Math.floor(rng() * 5); // ~24-29 stomp, ~34-39 parelho
  const duracao = Math.max(26, Math.min(44, 30 + (fimMin - 26) * 0.8)); // segundos de animação
  let killsRestantes = 10 + Math.floor(rng() * 7) + Math.round(dominancia * 16); // 10..27 abates no total

  // cota do jogador (agora respeita mais o KDA real da partida)
  let killsVoce = Math.min(e.kda.k, 7);
  let mortesVoce = Math.min(e.kda.d, 4);

  // tempo de animação proporcional ao minuto de jogo (+ jitter pra não ficar mecânico)
  const tDe = (minuto: number) => 1.5 + (minuto / fimMin) * (duracao - 5) + rng() * 0.5;

  // confronto genérico: gera um abate respeitando a cota do jogador quando der.
  const confronto = (t: number, minuto: number, local: Ponto, tipo: EventoTipo = "abate", vencedorForcado?: "azul" | "vermelho") => {
    if (killsRestantes <= 0) return;
    killsRestantes--;
    const azulVence = vencedorForcado ? vencedorForcado === "azul" : azulGanha();
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

  const ladoForte: "azul" | "vermelho" = e.vitoria ? "azul" : "vermelho";
  const ladoFraco: "azul" | "vermelho" = e.vitoria ? "vermelho" : "azul";
  const lanes: Lane[] = ["top", "mid", "bot"];

  // 0) spawn + pokes de early
  add({ t: 0.4, minuto: 0, tipo: "spawn", texto: "Início de jogo" });
  add({ t: tDe(2), minuto: 2, tipo: "poke", local: laneMid(escolha(lanes)) });
  add({ t: tDe(3), minuto: 3, tipo: "poke", local: laneMid(escolha(lanes)) });

  // 1) first blood na SUA lane
  const fbMin = 3 + Math.floor(rng() * 3);
  confronto(tDe(fbMin), fbMin, laneMid(laneDeRota(e.rotaVoce)));

  // 2) early game: ganks nas lanes (a cada ~3 min até o min 12)
  for (let mn = 6; mn <= 12; mn += 2 + Math.floor(rng() * 2)) {
    const lane = escolha(lanes);
    confronto(tDe(mn), mn, pontoNaRota(LANES[lane], 0.35 + rng() * 0.3));
  }

  // 3) dragões: o primeiro no min 8, depois a cada ~6 min (parelho = disputa com roubos)
  let dragoes = 0;
  for (let mn = 8; mn <= fimMin - 6 && dragoes < 4; mn += 5 + Math.floor(rng() * 3)) {
    dragoes++;
    const roubo = parelho && rng() < 0.3;
    const vencedor = roubo ? ladoFraco : azulGanha() ? "azul" : "vermelho";
    add({
      t: tDe(mn),
      minuto: mn,
      tipo: "objetivo",
      objetivo: "dragao",
      local: posicaoObjetivo("dragao"),
      vencedor,
      texto: roubo ? "DRAGÃO ROUBADO!" : `Dragão ${dragoes} garantido`,
    });
    if (rng() < 0.7) confronto(tDe(mn) + 0.8, mn, posicaoObjetivo("dragao"), "abate", roubo ? ladoFraco : undefined);
  }

  // 4) mid game: teamfights + torres caindo (mais torres pro lado forte)
  const torresDoForte = 2 + Math.round(dominancia * 4); // 2..4 torres do fraco caem
  let torresCaidas = 0;
  for (let mn = 13; mn <= fimMin - 5; mn += 3 + Math.floor(rng() * 3)) {
    if (rng() < 0.55) {
      add({ t: tDe(mn), minuto: mn, tipo: "teamfight", local: laneMid(escolha(lanes)), texto: "Teamfight!" });
      confronto(tDe(mn) + 0.5, mn, laneMid("mid"), "teamfight");
      if (rng() < 0.6) confronto(tDe(mn) + 1.1, mn, laneMid("mid"), "teamfight");
    } else if (torresCaidas < torresDoForte) {
      torresCaidas++;
      add({ t: tDe(mn), minuto: mn, tipo: "torre", torre: { time: ladoFraco, lane: escolha(lanes) }, texto: "Torre destruída" });
    }
  }
  // jogo parelho: o lado "fraco" também derruba estrutura (não é atropelo)
  if (parelho) {
    const mn = 15 + Math.floor(rng() * 6);
    add({ t: tDe(mn), minuto: mn, tipo: "torre", torre: { time: ladoForte, lane: escolha(lanes) }, texto: "Eles respondem: torre destruída" });
  }

  // 5) VIRADA (só em jogo parelho): o lado que vai perder ganha uma luta e sonha
  if (parelho && rng() < 0.6) {
    const mn = fimMin - 10;
    add({ t: tDe(mn), minuto: mn, tipo: "teamfight", local: posicaoObjetivo("barao"), texto: "VIRADA no mapa!" });
    confronto(tDe(mn) + 0.5, mn, posicaoObjetivo("barao"), "teamfight", ladoFraco);
    confronto(tDe(mn) + 1.1, mn, posicaoObjetivo("barao"), "teamfight", ladoFraco);
  }

  // 6) barão decide (pequena chance de roubo desesperado em jogo parelho)
  const mnBarao = fimMin - 7;
  const rouboBarao = parelho && rng() < 0.2;
  add({
    t: tDe(mnBarao),
    minuto: mnBarao,
    tipo: "objetivo",
    objetivo: "barao",
    local: posicaoObjetivo("barao"),
    vencedor: rouboBarao ? ladoFraco : ladoForte,
    texto: rouboBarao ? "BARÃO ROUBADO!" : "BARÃO!",
  });
  confronto(tDe(mnBarao) + 0.9, mnBarao, posicaoObjetivo("barao"));

  // 7) teamfight final — consome o resto do placar
  const mnFinal = fimMin - 3;
  add({ t: tDe(mnFinal), minuto: mnFinal, tipo: "teamfight", local: laneMid("mid"), texto: "Luta decisiva!" });
  let guarda = 0;
  while (killsRestantes > 0 && guarda < 5) {
    confronto(tDe(mnFinal) + 0.5 + guarda * 0.55, mnFinal, laneMid("mid"), "teamfight", guarda < 3 ? ladoForte : undefined);
    guarda++;
  }

  // 8) push final + nexus
  add({ t: tDe(fimMin - 1), minuto: fimMin - 1, tipo: "torre", torre: { time: ladoFraco, lane: "mid" }, texto: "Inibidor caindo" });
  add({
    t: tDe(fimMin) + 1.2,
    minuto: fimMin,
    tipo: "nexus",
    vencedor: ladoForte,
    local: e.vitoria ? BATALHA.nexusVermelho : BATALHA.nexusAzul,
    texto: e.vitoria ? "Nexus inimigo destruído!" : "Seu Nexus caiu...",
  });

  eventos.sort((a, b) => a.t - b.t);

  return { combatentes, eventos, duracao: Math.max(duracao, (eventos.at(-1)?.t ?? duracao) + 2), vitoria: e.vitoria, placar };
}
