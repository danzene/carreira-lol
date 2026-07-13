// 🏠 Cena da Gaming House — reusa os BLOCOS do motor do diorama (Regra 5: atlas de
// sprites do jogador, textoPixel, paleta CORD, pré-render offscreen, pools sem alocação
// por frame, rAF capado na casca). Não é um segundo motor: é a mesma linguagem visual
// com outra coreografia — aqui o herói ANDA até a estação e executa a atividade.
//
// A cena é TEATRO: o engine já aplicou a sessão quando ela começa a rodar; os "+X"
// flutuantes no fim mostram os ganhos reais (mesma disciplina do resto do jogo).

import type { EstacaoId } from "@/data/gamingHouse";
import type { Role } from "@/engine/types";
import { CORD, criarAtlas, textoPixel, type AtlasDiorama } from "../grind/diorama/pixels";

export const CASA_W = 480;
export const CASA_H = 120;
const CHAO_Y = CASA_H - 18;

// posição x de cada estação na casa (ordem de leitura: estudo → treino → descanso)
export const POSICOES: Record<EstacaoId, number> = {
  ANALISE_ADVERSARIO: 34,
  REPLAY_ROOM: 86,
  SCRIM_SIM: 140,
  AIM_TRAINER: 194,
  CUSTOM_1V1: 246,
  CHAMPION_PRACTICE: 298,
  SALA_DE_STREAM: 356,
  ACADEMIA_SONO_TERAPIA: 424,
};
const SOFA_X = CASA_W / 2 - 6; // burnout: o herói desaba no sofá

type Pose = "sit" | "attack" | "idle";
const POSE_ESTACAO: Record<EstacaoId, Pose> = {
  ANALISE_ADVERSARIO: "idle",
  REPLAY_ROOM: "sit",
  SCRIM_SIM: "sit",
  AIM_TRAINER: "attack",
  CUSTOM_1V1: "attack",
  CHAMPION_PRACTICE: "attack",
  SALA_DE_STREAM: "sit",
  ACADEMIA_SONO_TERAPIA: "idle",
};
const COR_ESTACAO: Record<EstacaoId, string> = {
  ANALISE_ADVERSARIO: "#f5e6d0",
  REPLAY_ROOM: "#19e6e0",
  SCRIM_SIM: "#9a6bff",
  AIM_TRAINER: "#ff2d7e",
  CUSTOM_1V1: "#ffd34d",
  CHAMPION_PRACTICE: "#2ee6a0",
  SALA_DE_STREAM: "#ff4d4d",
  ACADEMIA_SONO_TERAPIA: "#7ec8ff",
};

interface Flutuante {
  vivo: boolean;
  x: number;
  y: number;
  vida: number;
  max: number;
  txt: string;
  cor: string;
}
interface Fagulha {
  vivo: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  cor: string;
}

export interface EstadoVisualCasa {
  fadiga01: number; // 0..1 (postura cansada + véu)
  burnout: boolean; // casa escura + herói no sofá
  moralAlta: boolean; // casa iluminada + pôster brilhando
  aoVivo: boolean; // luz ON AIR (sessão de stream rodando)
}

export interface CenaCasa {
  atualizar(dt: number): void;
  desenhar(): void;
  irPara(estacao: EstacaoId, duracaoSeg: number, aoTerminar: () => void): void;
  soltarGanhos(itens: { txt: string; cor: string }[]): void;
  definirEstado(e: EstadoVisualCasa): void;
  emSessao(): boolean;
  estacaoEm(x01: number): EstacaoId | null; // hit-test por fração X do clique
}

export function criarCenaCasa(c: CanvasRenderingContext2D, opts: { rota: Role; familia: string }): CenaCasa {
  const atlas: AtlasDiorama = criarAtlas(opts.rota);
  const fundo = prerenderCasa();

  // pools (zero alocação no loop — mesma disciplina do diorama)
  const flutuantes: Flutuante[] = Array.from({ length: 12 }, () => ({ vivo: false, x: 0, y: 0, vida: 0, max: 1, txt: "", cor: "" }));
  const fagulhas: Fagulha[] = Array.from({ length: 24 }, () => ({ vivo: false, x: 0, y: 0, vx: 0, vy: 0, vida: 0, cor: "" }));

  let heroX = POSICOES.REPLAY_ROOM;
  let alvoX = heroX;
  let virado = false; // olhando pra esquerda
  let frameT = 0;
  let estado: EstadoVisualCasa = { fadiga01: 0, burnout: false, moralAlta: false, aoVivo: false };

  // sessão em andamento (teatro): andar → atividade com barra → callback
  let sessao: { estacao: EstacaoId; pose: Pose; resta: number; dur: number; aoTerminar: () => void } | null = null;
  let fagulhaT = 0;
  let zzzT = 0;

  function alocar<T extends { vivo: boolean }>(pool: T[]): T | null {
    for (const p of pool) if (!p.vivo) return p;
    return null;
  }

  function soltarFagulhas(x: number, cor: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const f = alocar(fagulhas);
      if (!f) return;
      f.vivo = true;
      f.x = x + (Math.random() - 0.5) * 10;
      f.y = CHAO_Y - 22 + (Math.random() - 0.5) * 8;
      f.vx = (Math.random() - 0.5) * 30;
      f.vy = -20 - Math.random() * 25;
      f.vida = 0.5 + Math.random() * 0.3;
      f.cor = cor;
    }
  }

  function atualizar(dt: number): void {
    frameT += dt;

    // burnout: o herói larga tudo e vai pro sofá (leitura de estado sem menu)
    const destino = estado.burnout && !sessao ? SOFA_X : alvoX;
    const vel = 55 * (1 - estado.fadiga01 * 0.45); // cansado anda mais devagar
    if (Math.abs(heroX - destino) > 2) {
      virado = destino < heroX;
      heroX += Math.sign(destino - heroX) * vel * dt;
    } else if (sessao) {
      // chegou: a atividade roda (barra + fagulhas na cor da estação)
      sessao.resta -= dt;
      fagulhaT -= dt;
      if (fagulhaT <= 0) {
        fagulhaT = 0.3;
        soltarFagulhas(heroX + 10, COR_ESTACAO[sessao.estacao], 2);
      }
      if (sessao.resta <= 0) {
        const fim = sessao.aoTerminar;
        sessao = null;
        fim();
      }
    }

    // zzz do cansaço alto (idle) — o corpo avisa
    if ((estado.fadiga01 >= 0.7 || estado.burnout) && !sessao) {
      zzzT += dt;
      if (zzzT > 1.8) {
        zzzT = 0;
        const f = alocar(flutuantes);
        if (f) {
          f.vivo = true;
          f.x = heroX + 8;
          f.y = CHAO_Y - 34;
          f.vida = f.max = 1.1;
          f.txt = "z";
          f.cor = CORD.suave;
        }
      }
    }

    for (const f of flutuantes) {
      if (!f.vivo) continue;
      f.vida -= dt;
      f.y -= dt * 14;
      if (f.vida <= 0) f.vivo = false;
    }
    for (const f of fagulhas) {
      if (!f.vivo) continue;
      f.vida -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 60 * dt;
      if (f.vida <= 0) f.vivo = false;
    }
  }

  function desenhar(): void {
    c.clearRect(0, 0, CASA_W, CASA_H);
    c.drawImage(fundo, 0, 0);

    // luz ON AIR da sala de stream (pisca quando ao vivo)
    if (estado.aoVivo && Math.sin(frameT * 5) > -0.3) {
      c.fillStyle = "#ff4d4d";
      c.fillRect(POSICOES.SALA_DE_STREAM - 12, 22, 24, 8);
      c.fillStyle = CORD.fundo;
      c.font = `6px ${opts.familia}`;
      c.textAlign = "center";
      c.fillText("ON AIR", POSICOES.SALA_DE_STREAM, 24);
    }

    // herói (sprites do MESMO atlas do diorama)
    const andando = Math.abs(heroX - (estado.burnout && !sessao ? SOFA_X : alvoX)) > 2;
    const pose: Pose | "run" = andando ? "run" : sessao ? sessao.pose : estado.burnout ? "sit" : "idle";
    const frames = atlas.jogador[pose === "run" ? "run" : pose];
    const frame = frames[Math.floor(frameT * (andando ? 8 : 3)) % frames.length];
    c.save();
    if (virado) {
      c.translate(Math.round(heroX) * 2, 0);
      c.scale(-1, 1);
    }
    c.drawImage(frame, Math.round(heroX) - Math.floor(atlas.jw / 2), CHAO_Y - atlas.jh);
    c.restore();

    // barra de progresso da sessão (em cima da estação)
    if (sessao && !andando) {
      const pct = 1 - sessao.resta / sessao.dur;
      const x = Math.round(heroX) - 14;
      c.fillStyle = CORD.fundo;
      c.fillRect(x, CHAO_Y - atlas.jh - 10, 28, 5);
      c.fillStyle = COR_ESTACAO[sessao.estacao];
      c.fillRect(x + 1, CHAO_Y - atlas.jh - 9, Math.round(26 * pct), 3);
    }

    for (const f of fagulhas) {
      if (!f.vivo) continue;
      c.globalAlpha = Math.max(0, f.vida / 0.6);
      c.fillStyle = f.cor;
      c.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
      c.globalAlpha = 1;
    }
    for (const f of flutuantes) {
      if (!f.vivo) continue;
      c.globalAlpha = Math.min(1, f.vida / (f.max * 0.6));
      textoPixel(c, opts.familia, f.txt, f.x, f.y, f.cor, 7);
      c.globalAlpha = 1;
    }

    // 🌡️ a casa REFLETE o estado (leitura sem abrir menu):
    if (estado.moralAlta && !estado.burnout) {
      c.fillStyle = "rgba(255, 211, 77, 0.07)"; // luz quente
      c.fillRect(0, 0, CASA_W, CASA_H);
    }
    if (estado.fadiga01 > 0.6 && !estado.burnout) {
      c.fillStyle = `rgba(20, 20, 60, ${(estado.fadiga01 - 0.6) * 0.35})`; // véu do cansaço
      c.fillRect(0, 0, CASA_W, CASA_H);
    }
    if (estado.burnout) {
      c.fillStyle = "rgba(5, 3, 18, 0.55)"; // casa apagada
      c.fillRect(0, 0, CASA_W, CASA_H);
      textoPixel(c, opts.familia, "BURNOUT — descanse", CASA_W / 2, 8, "#ff9a9a", 8);
    }
  }

  return {
    atualizar,
    desenhar,
    irPara: (estacao, duracaoSeg, aoTerminar) => {
      alvoX = POSICOES[estacao];
      sessao = { estacao, pose: POSE_ESTACAO[estacao], resta: duracaoSeg, dur: duracaoSeg, aoTerminar };
    },
    soltarGanhos: (itens) => {
      itens.slice(0, 6).forEach((item, i) => {
        const f = alocar(flutuantes);
        if (!f) return;
        f.vivo = true;
        f.x = heroX + (i % 2 === 0 ? -10 : 12);
        f.y = CHAO_Y - atlas.jh - 6 - i * 9;
        f.vida = f.max = 1.6;
        f.txt = item.txt;
        f.cor = item.cor;
      });
    },
    definirEstado: (e) => {
      estado = e;
    },
    emSessao: () => sessao !== null,
    estacaoEm: (x01) => {
      const x = x01 * CASA_W;
      let melhor: EstacaoId | null = null;
      let dist = 30; // raio de clique de cada estação
      for (const [id, px] of Object.entries(POSICOES) as [EstacaoId, number][]) {
        const d = Math.abs(px - x);
        if (d < dist) {
          dist = d;
          melhor = id;
        }
      }
      return melhor;
    },
  };
}

// Pré-render do fundo (uma vez): parede, janela, chão e os props das estações —
// mesma técnica do prerenderCenario do diorama.
function prerenderCasa(): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = CASA_W;
  cv.height = CASA_H;
  const c = cv.getContext("2d")!;
  c.imageSmoothingEnabled = false;

  // parede + rodapé + chão
  c.fillStyle = "#141026";
  c.fillRect(0, 0, CASA_W, CHAO_Y);
  c.fillStyle = "#0e0a1e";
  c.fillRect(0, CHAO_Y - 4, CASA_W, 4);
  c.fillStyle = "#1c1533";
  c.fillRect(0, CHAO_Y, CASA_W, CASA_H - CHAO_Y);
  // tábuas do chão
  c.fillStyle = "#241b40";
  for (let x = 0; x < CASA_W; x += 32) c.fillRect(x, CHAO_Y, 1, CASA_H - CHAO_Y);

  // janela com noite estrelada
  c.fillStyle = "#0b0617";
  c.fillRect(CASA_W / 2 - 26, 14, 52, 30);
  c.strokeStyle = "#3a2e63";
  c.strokeRect(CASA_W / 2 - 26.5, 13.5, 53, 31);
  c.fillStyle = "#f5e6d0";
  c.fillRect(CASA_W / 2 - 14, 20, 2, 2);
  c.fillRect(CASA_W / 2 + 8, 28, 2, 2);
  c.fillRect(CASA_W / 2 - 2, 36, 1, 1);

  // pôster (brilha com moral alta via overlay)
  c.fillStyle = "#2a1f4d";
  c.fillRect(SOFA_X - 40, 18, 22, 28);
  c.fillStyle = "#ffd34d";
  c.fillRect(SOFA_X - 33, 26, 8, 8);

  // sofá central (o refúgio do burnout)
  c.fillStyle = "#4d2a5e";
  c.fillRect(SOFA_X - 16, CHAO_Y - 14, 32, 14);
  c.fillRect(SOFA_X - 20, CHAO_Y - 20, 6, 20);
  c.fillRect(SOFA_X + 14, CHAO_Y - 20, 6, 20);

  const prop = (x: number, desenhar: (px: number) => void) => desenhar(x);

  // 📋 quadro tático
  prop(POSICOES.ANALISE_ADVERSARIO, (x) => {
    c.fillStyle = "#e8e3f5";
    c.fillRect(x - 14, 20, 28, 20);
    c.strokeStyle = "#3a2e63";
    c.strokeRect(x - 14.5, 19.5, 29, 21);
    c.fillStyle = "#ff2d7e";
    c.fillRect(x - 9, 25, 3, 3);
    c.fillRect(x + 2, 32, 3, 3);
    c.fillStyle = "#19e6e0";
    c.fillRect(x + 5, 24, 3, 3);
    c.fillRect(x - 4, 30, 3, 3);
  });
  // 📼 replay room: mesa + monitor
  prop(POSICOES.REPLAY_ROOM, (x) => mesaComMonitor(c, x, "#19e6e0"));
  // 🖥️ scrim: fileira de 3 monitores
  prop(POSICOES.SCRIM_SIM, (x) => {
    mesaComMonitor(c, x - 12, "#9a6bff");
    mesaComMonitor(c, x, "#9a6bff");
    mesaComMonitor(c, x + 12, "#9a6bff");
  });
  // 🎯 aim trainer: alvo na parede + mesa
  prop(POSICOES.AIM_TRAINER, (x) => {
    c.fillStyle = "#f5e6d0";
    c.beginPath();
    c.arc(x, 28, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ff2d7e";
    c.beginPath();
    c.arc(x, 28, 5.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f5e6d0";
    c.beginPath();
    c.arc(x, 28, 2.5, 0, Math.PI * 2);
    c.fill();
    mesa(c, x);
  });
  // ⚔️ custom 1v1: dois PCs frente a frente
  prop(POSICOES.CUSTOM_1V1, (x) => {
    mesaComMonitor(c, x - 8, "#ffd34d");
    mesaComMonitor(c, x + 8, "#ffd34d");
  });
  // 🧙 treino de campeão: banner com estrela
  prop(POSICOES.CHAMPION_PRACTICE, (x) => {
    c.fillStyle = "#173a33";
    c.fillRect(x - 10, 16, 20, 26);
    c.fillStyle = "#2ee6a0";
    c.fillRect(x - 3, 25, 6, 6);
    c.fillRect(x - 1, 23, 2, 10);
    c.fillRect(x - 5, 27, 10, 2);
    mesa(c, x);
  });
  // 🔴 sala de stream: mesa + painel ON AIR (apagado; acende ao vivo)
  prop(POSICOES.SALA_DE_STREAM, (x) => {
    c.fillStyle = "#331520";
    c.fillRect(x - 12, 22, 24, 8);
    mesaComMonitor(c, x, "#ff9a9a");
  });
  // 🛏️ bem-estar: peso da academia + cama
  prop(POSICOES.ACADEMIA_SONO_TERAPIA, (x) => {
    c.fillStyle = "#9a90c0";
    c.fillRect(x - 16, CHAO_Y - 6, 14, 2); // barra
    c.fillStyle = "#5a5480";
    c.fillRect(x - 18, CHAO_Y - 9, 3, 8);
    c.fillRect(x - 4, CHAO_Y - 9, 3, 8);
    c.fillStyle = "#2a4d6e";
    c.fillRect(x + 2, CHAO_Y - 10, 26, 10); // cama
    c.fillStyle = "#7ec8ff";
    c.fillRect(x + 4, CHAO_Y - 12, 8, 4); // travesseiro
  });

  return cv;
}

function mesa(c: CanvasRenderingContext2D, x: number): void {
  c.fillStyle = "#3a2e63";
  c.fillRect(x - 12, CHAO_Y - 16, 24, 3);
  c.fillRect(x - 10, CHAO_Y - 13, 2, 13);
  c.fillRect(x + 8, CHAO_Y - 13, 2, 13);
}

function mesaComMonitor(c: CanvasRenderingContext2D, x: number, corTela: string): void {
  mesa(c, x);
  c.fillStyle = "#0b0617";
  c.fillRect(x - 6, CHAO_Y - 26, 12, 10);
  c.fillStyle = corTela;
  c.fillRect(x - 5, CHAO_Y - 25, 10, 8);
  c.fillStyle = "#0b0617";
  c.fillRect(x - 1, CHAO_Y - 16, 2, 2);
}
