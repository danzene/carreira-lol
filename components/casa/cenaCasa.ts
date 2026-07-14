// 🏠 Cena da Gaming House — agora com a ARTE REAL (build-casa.mjs):
//
//  • CENA AMPLA: o fundo pintado da casa (960×480) com 8 HOTSPOTS pulsantes na cor de
//    cada estação; o herói (sprites do MESMO atlas do diorama, ×2) anda até o hotspot.
//  • CLOSE-UP CINEMATOGRÁFICO: ao treinar, crossfade pro quadro da estação alternando
//    APAGADA→ATIVA (2 frames pintados), com a FACECAM do herói em ação no canto
//    (as poses do Grupo C), fagulhas tingidas na cor da estação, barra de progresso e
//    celebração no final. A cena é TEATRO: o engine já aplicou tudo no clique.
//  • ESTADOS na casa: burnout = herói desaba no sofá do fundo + vinheta pintada + Zzz
//    reais; moral alta = luz dourada + brilhos no troféu; fadiga = véu + lentidão.
//
// Fallback: sem a arte (falha de rede/arquivo), a cena desenha um palco programático
// simples com os mesmos hotspots — a decisão continua 100% jogável.

import type { EstacaoId } from "@/data/gamingHouse";
import { ESTACOES } from "@/data/gamingHouse";
import type { Role } from "@/engine/types";
import { CORD, criarAtlas, textoPixel, type AtlasDiorama } from "../grind/diorama/pixels";
import { tintar, type ArteCasa, type PoseCasa } from "./arteCasa";

export const CASA_W = 480;
export const CASA_H = 240;
const CHAO_Y = 214; // linha do chão do fundo pintado
const SOFA_X = 240; // o sofá do fundo (burnout) — centro da sala

// hotspots das estações (o centro fica livre pro sofá)
export const POSICOES: Record<EstacaoId, number> = {
  ANALISE_ADVERSARIO: 34,
  REPLAY_ROOM: 90,
  SCRIM_SIM: 144,
  AIM_TRAINER: 196,
  CUSTOM_1V1: 286,
  CHAMPION_PRACTICE: 340,
  SALA_DE_STREAM: 394,
  ACADEMIA_SONO_TERAPIA: 448,
};

export const COR_ESTACAO: Record<EstacaoId, string> = {
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
  max: number;
  idx: number; // sprite tingido (ou -1 = quadradinho programático)
  escala: number;
}
interface Zzz {
  vivo: boolean;
  x: number;
  y: number;
  vida: number;
  max: number;
  idx: number;
}

export interface EstadoVisualCasa {
  fadiga01: number;
  burnout: boolean;
  moralAlta: boolean;
  aoVivo: boolean;
}

interface Sessao {
  estacao: EstacaoId;
  pose: PoseCasa | null;
  varianteFrames: [HTMLImageElement, HTMLImageElement] | null; // Bem-estar usa a variante
  resta: number;
  dur: number;
  fase: "andando" | "zoomIn" | "rodando" | "celebrando" | "zoomOut";
  faseT: number;
  aoTerminar: () => void;
  fagulhasTintadas: HTMLCanvasElement[];
  cor: string;
}

export interface CenaCasa {
  atualizar(dt: number): void;
  desenhar(): void;
  irPara(estacao: EstacaoId, duracaoSeg: number, aoTerminar: () => void, pose?: PoseCasa, variante?: "academia" | "sono" | "terapia"): void;
  soltarGanhos(itens: { txt: string; cor: string }[]): void;
  definirEstado(e: EstadoVisualCasa): void;
  definirArte(a: ArteCasa | null): void;
  emSessao(): boolean;
  estacaoEm(x01: number, y01: number): EstacaoId | null;
}

const ZOOM_SEG = 0.35;
const CELEBRA_SEG = 0.85;
const FRAME_ESTACAO_SEG = 0.55; // apagada↔ativa
const FRAME_POSE_SEG = 0.5; // facecam

export function criarCenaCasa(c: CanvasRenderingContext2D, opts: { rota: Role; familia: string }): CenaCasa {
  const atlas: AtlasDiorama = criarAtlas(opts.rota);
  let arte: ArteCasa | null = null;

  // pools (zero alocação no loop)
  const flutuantes: Flutuante[] = Array.from({ length: 12 }, () => ({ vivo: false, x: 0, y: 0, vida: 0, max: 1, txt: "", cor: "" }));
  const fagulhas: Fagulha[] = Array.from({ length: 28 }, () => ({ vivo: false, x: 0, y: 0, vx: 0, vy: 0, vida: 0, max: 1, idx: -1, escala: 1 }));
  const zzzs: Zzz[] = Array.from({ length: 5 }, () => ({ vivo: false, x: 0, y: 0, vida: 0, max: 1, idx: 0 }));

  let heroX = POSICOES.REPLAY_ROOM;
  let alvoX = heroX;
  let virado = false;
  let frameT = 0;
  let estado: EstadoVisualCasa = { fadiga01: 0, burnout: false, moralAlta: false, aoVivo: false };
  let sessao: Sessao | null = null;
  let fagulhaT = 0;
  let zzzT = 0;
  let brilhoT = 0;

  function alocar<T extends { vivo: boolean }>(pool: T[]): T | null {
    for (const p of pool) if (!p.vivo) return p;
    return null;
  }

  function soltarFagulhaSessao(): void {
    const f = alocar(fagulhas);
    if (!f || !sessao) return;
    f.vivo = true;
    f.x = CASA_W * (0.3 + Math.random() * 0.5);
    f.y = CASA_H * (0.35 + Math.random() * 0.4);
    f.vx = (Math.random() - 0.5) * 22;
    f.vy = -26 - Math.random() * 30;
    f.vida = f.max = 0.7 + Math.random() * 0.5;
    f.idx = sessao.fagulhasTintadas.length > 0 ? Math.floor(Math.random() * sessao.fagulhasTintadas.length) : -1;
    f.escala = 0.35 + Math.random() * 0.4;
  }

  function rajadaCelebracao(): void {
    for (let i = 0; i < 14; i++) soltarFagulhaSessao();
  }

  // ---------------------------------------------------------------- update
  function atualizar(dt: number): void {
    frameT += dt;

    if (sessao) {
      sessao.faseT += dt;
      if (sessao.fase === "andando") {
        const vel = 70 * (1 - estado.fadiga01 * 0.4);
        if (Math.abs(heroX - alvoX) > 3) {
          virado = alvoX < heroX;
          heroX += Math.sign(alvoX - heroX) * vel * dt;
        } else {
          sessao.fase = "zoomIn";
          sessao.faseT = 0;
        }
      } else if (sessao.fase === "zoomIn") {
        if (sessao.faseT >= ZOOM_SEG) {
          sessao.fase = "rodando";
          sessao.faseT = 0;
        }
      } else if (sessao.fase === "rodando") {
        sessao.resta -= dt;
        fagulhaT -= dt;
        if (fagulhaT <= 0) {
          fagulhaT = 0.22;
          soltarFagulhaSessao();
        }
        if (sessao.resta <= 0) {
          sessao.fase = "celebrando";
          sessao.faseT = 0;
          rajadaCelebracao();
        }
      } else if (sessao.fase === "celebrando") {
        if (sessao.faseT >= CELEBRA_SEG) {
          sessao.fase = "zoomOut";
          sessao.faseT = 0;
        }
      } else if (sessao.fase === "zoomOut" && sessao.faseT >= ZOOM_SEG) {
        const fim = sessao.aoTerminar;
        sessao = null;
        fim(); // os "+X" da view caem na cena ampla
      }
    } else {
      // ampla: burnout arrasta o herói pro sofá; senão ele fica onde parou
      const destino = estado.burnout ? SOFA_X : alvoX;
      const vel = 62 * (1 - estado.fadiga01 * 0.4);
      if (Math.abs(heroX - destino) > 3) {
        virado = destino < heroX;
        heroX += Math.sign(destino - heroX) * vel * dt;
      }
      // Zzz do cansaço/burnout (sprites reais quando houver)
      if (estado.burnout || estado.fadiga01 >= 0.7) {
        zzzT += dt;
        if (zzzT > 1.4) {
          zzzT = 0;
          const z = alocar(zzzs);
          if (z) {
            z.vivo = true;
            z.x = heroX + 12;
            z.y = CHAO_Y - 78;
            z.vida = z.max = 1.6;
            z.idx = Math.floor(Math.random() * Math.max(1, arte?.zzz.length ?? 1));
          }
        }
      }
      if (estado.moralAlta) brilhoT += dt;
    }

    for (const f of flutuantes) {
      if (!f.vivo) continue;
      f.vida -= dt;
      f.y -= dt * 16;
      if (f.vida <= 0) f.vivo = false;
    }
    for (const f of fagulhas) {
      if (!f.vivo) continue;
      f.vida -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 34 * dt;
      if (f.vida <= 0) f.vivo = false;
    }
    for (const z of zzzs) {
      if (!z.vivo) continue;
      z.vida -= dt;
      z.y -= dt * 12;
      z.x += Math.sin(frameT * 3 + z.y) * 0.3;
      if (z.vida <= 0) z.vivo = false;
    }
  }

  // ---------------------------------------------------------------- draw
  function desenharAmpla(): void {
    // palco
    if (arte) {
      c.drawImage(arte.fundo, 0, 0, CASA_W, CASA_H);
    } else {
      c.fillStyle = "#141026";
      c.fillRect(0, 0, CASA_W, CASA_H - 26);
      c.fillStyle = "#1c1533";
      c.fillRect(0, CASA_H - 26, CASA_W, 26);
      c.fillStyle = "#241b40";
      for (let x = 0; x < CASA_W; x += 40) c.fillRect(x, CHAO_Y, 1, CASA_H - CHAO_Y);
    }

    // hotspots pulsantes (a cor é a identidade da estação)
    (Object.keys(POSICOES) as EstacaoId[]).forEach((id, i) => {
      const x = POSICOES[id];
      const puls = 0.55 + 0.45 * Math.sin(frameT * 2.2 + i * 1.3);
      const cor = COR_ESTACAO[id];
      // glow no chão
      c.globalAlpha = 0.16 + puls * 0.12;
      c.fillStyle = cor;
      c.beginPath();
      c.ellipse(x, CHAO_Y + 6, 17, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      // plaquinha com emoji
      c.fillStyle = "rgba(11,6,23,0.82)";
      c.fillRect(x - 11, CHAO_Y - 26, 22, 20);
      c.strokeStyle = cor;
      c.globalAlpha = 0.55 + puls * 0.45;
      c.strokeRect(x - 11.5, CHAO_Y - 26.5, 23, 21);
      c.globalAlpha = 1;
      c.font = `10px ${opts.familia}`;
      c.textAlign = "center";
      c.fillText(ESTACOES[id].emoji, x, CHAO_Y - 11);
    });

    // brilhos de moral alta flutuando perto do troféu do pôster
    if (estado.moralAlta && !estado.burnout) {
      const bx = CASA_W * 0.475;
      const by = 66 + Math.sin(brilhoT * 1.8) * 4;
      if (arte?.brilho) {
        c.globalAlpha = 0.75 + 0.25 * Math.sin(brilhoT * 3);
        c.drawImage(arte.brilho, bx - 20, by, 40, 12);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = CORD.ouro;
        c.globalAlpha = 0.6 + 0.4 * Math.sin(brilhoT * 3);
        c.fillRect(bx, by, 3, 3);
        c.fillRect(bx + 10, by + 5, 2, 2);
        c.globalAlpha = 1;
      }
    }

    // herói (atlas do diorama ×2 — mesma linguagem do resto do jogo)
    const andando = Math.abs(heroX - (estado.burnout ? SOFA_X : alvoX)) > 3;
    const pose = andando ? "run" : estado.burnout ? "sit" : "idle";
    const frames = atlas.jogador[pose];
    const frame = frames[Math.floor(frameT * (andando ? 8 : 3)) % frames.length];
    const fw = atlas.jw * 2;
    const fh = atlas.jh * 2;
    // burnout no sofá: senta um pouco acima do chão (assento)
    const heroY = estado.burnout && !andando ? CHAO_Y - fh - 8 : CHAO_Y - fh;
    c.save();
    if (virado) {
      c.translate(Math.round(heroX) * 2, 0);
      c.scale(-1, 1);
    }
    c.imageSmoothingEnabled = false;
    c.drawImage(frame, Math.round(heroX) - Math.floor(fw / 2), heroY, fw, fh);
    c.restore();

    // Zzz (sprites reais recortados; fallback = "z" pixel)
    for (const z of zzzs) {
      if (!z.vivo) continue;
      c.globalAlpha = Math.min(1, z.vida / (z.max * 0.5));
      const img = arte?.zzz[z.idx % Math.max(1, arte.zzz.length)];
      if (img) c.drawImage(img, z.x, z.y, 14, 14);
      else textoPixel(c, opts.familia, "z", z.x, z.y, CORD.suave, 8);
      c.globalAlpha = 1;
    }

    // "+X" dos ganhos
    for (const f of flutuantes) {
      if (!f.vivo) continue;
      c.globalAlpha = Math.min(1, f.vida / (f.max * 0.6));
      textoPixel(c, opts.familia, f.txt, f.x, f.y, f.cor, 9);
      c.globalAlpha = 1;
    }

    // 🌡️ estados por cima (a casa REFLETE o jogador)
    if (estado.moralAlta && !estado.burnout) {
      if (arte?.overlayMoral) {
        c.globalAlpha = 0.9;
        c.drawImage(arte.overlayMoral, 0, 0, CASA_W, CASA_H);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = "rgba(255,211,77,0.06)";
        c.fillRect(0, 0, CASA_W, CASA_H);
      }
    }
    if (estado.fadiga01 > 0.6 && !estado.burnout) {
      c.fillStyle = `rgba(20,20,60,${(estado.fadiga01 - 0.6) * 0.4})`;
      c.fillRect(0, 0, CASA_W, CASA_H);
    }
    if (estado.burnout) {
      if (arte?.overlayBurnout) c.drawImage(arte.overlayBurnout, 0, 0, CASA_W, CASA_H);
      else {
        c.fillStyle = "rgba(5,3,18,0.55)";
        c.fillRect(0, 0, CASA_W, CASA_H);
      }
      textoPixel(c, opts.familia, "BURNOUT — descanse", CASA_W / 2, 10, "#ff9a9a", 9);
    }
  }

  // desenha uma imagem cobrindo o retângulo (crop central) — "object-fit: cover"
  function drawCover(img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
    const ri = img.width / img.height;
    const rd = w / h;
    let sw = img.width;
    let sh = img.height;
    let sx = 0;
    let sy = 0;
    if (ri > rd) {
      sw = img.height * rd;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / rd;
      sy = (img.height - sh) / 2;
    }
    c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function desenharSessao(s: Sessao): void {
    const frames = s.varianteFrames ?? arte?.estacoes[s.estacao] ?? null;
    const idxFrame = s.fase === "rodando" || s.fase === "celebrando" ? (Math.floor(frameT / FRAME_ESTACAO_SEG) % 2) : 0;

    if (frames) {
      drawCover(frames[idxFrame], 0, 0, CASA_W, CASA_H);
      // vinheta leve pra integrar o quadro
      const vg = c.createRadialGradient(CASA_W / 2, CASA_H / 2, CASA_H * 0.45, CASA_W / 2, CASA_H / 2, CASA_W * 0.62);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(5,3,18,0.55)");
      c.fillStyle = vg;
      c.fillRect(0, 0, CASA_W, CASA_H);
    } else {
      // fallback: cartão na cor da estação
      c.fillStyle = "#0b0617";
      c.fillRect(0, 0, CASA_W, CASA_H);
      c.font = `44px ${opts.familia}`;
      c.textAlign = "center";
      c.fillText(ESTACOES[s.estacao].emoji, CASA_W / 2, CASA_H / 2 + 14);
    }

    // fagulhas tingidas
    for (const f of fagulhas) {
      if (!f.vivo) continue;
      c.globalAlpha = Math.min(1, f.vida / (f.max * 0.5));
      const sprite = f.idx >= 0 ? s.fagulhasTintadas[f.idx] : null;
      if (sprite) {
        const w = sprite.width * f.escala * 0.5;
        const h = sprite.height * f.escala * 0.5;
        c.drawImage(sprite, f.x - w / 2, f.y - h / 2, w, h);
      } else {
        c.fillStyle = s.cor;
        c.fillRect(Math.round(f.x), Math.round(f.y), 3, 3);
      }
      c.globalAlpha = 1;
    }

    // 🎥 FACECAM: o herói em ação (pose real do Grupo C) numa moldura de streamer
    const poseAtual: PoseCasa | null = s.fase === "celebrando" && arte?.poses.comemorando ? "comemorando" : s.pose;
    const par = poseAtual ? arte?.poses[poseAtual] : null;
    if (par) {
      const fw = 86;
      const fh = 112;
      const fx = 10;
      const fy = CASA_H - fh - 12;
      const idxPose = Math.floor(frameT / FRAME_POSE_SEG) % 2;
      c.fillStyle = "#0b0617";
      c.fillRect(fx - 3, fy - 3, fw + 6, fh + 6);
      drawCover(par[idxPose], fx, fy, fw, fh);
      c.strokeStyle = s.fase === "celebrando" ? CORD.ouro : s.cor;
      c.lineWidth = 2;
      c.strokeRect(fx - 2, fy - 2, fw + 4, fh + 4);
      c.lineWidth = 1;
      // 🔴 REC piscando (charme de facecam)
      if (Math.sin(frameT * 4) > 0) {
        c.fillStyle = "#ff4d4d";
        c.beginPath();
        c.arc(fx + 8, fy + 9, 3, 0, Math.PI * 2);
        c.fill();
      }
    }

    // rótulo + barra de progresso
    const nome = ESTACOES[s.estacao].nome.toUpperCase();
    c.fillStyle = "rgba(11,6,23,0.75)";
    const tw = nome.length * 7 + 18;
    c.fillRect(CASA_W / 2 - tw / 2, 8, tw, 15);
    textoPixel(c, opts.familia, nome, CASA_W / 2, 11, s.cor, 8);

    const pct = s.fase === "celebrando" || s.fase === "zoomOut" ? 1 : Math.max(0, Math.min(1, 1 - s.resta / s.dur));
    c.fillStyle = "rgba(11,6,23,0.8)";
    c.fillRect(0, CASA_H - 5, CASA_W, 5);
    c.fillStyle = s.fase === "celebrando" ? CORD.ouro : s.cor;
    c.fillRect(0, CASA_H - 4, Math.round(CASA_W * pct), 3);

    if (s.fase === "celebrando") {
      c.globalAlpha = Math.min(0.9, s.faseT * 3);
      textoPixel(c, opts.familia, "SESSÃO COMPLETA!", CASA_W / 2, CASA_H / 2 - 30, CORD.ouro, 12);
      c.globalAlpha = 1;
    }
  }

  function desenhar(): void {
    c.clearRect(0, 0, CASA_W, CASA_H);
    c.imageSmoothingEnabled = false;

    if (!sessao || sessao.fase === "andando") {
      desenharAmpla();
      return;
    }

    // crossfade entre a casa e o close-up
    const s = sessao;
    if (s.fase === "zoomIn" || s.fase === "zoomOut") {
      const t = Math.min(1, s.faseT / ZOOM_SEG);
      const alphaClose = s.fase === "zoomIn" ? t : 1 - t;
      desenharAmpla();
      c.globalAlpha = alphaClose;
      desenharSessao(s);
      c.globalAlpha = 1;
      return;
    }
    desenharSessao(s);
  }

  // ---------------------------------------------------------------- API
  return {
    atualizar,
    desenhar,
    irPara: (estacao, duracaoSeg, aoTerminar, pose, variante) => {
      alvoX = POSICOES[estacao];
      const cor = COR_ESTACAO[estacao];
      sessao = {
        estacao,
        pose: pose ?? null,
        varianteFrames: variante ? (arte?.variantes[variante] ?? null) : null,
        resta: duracaoSeg,
        dur: duracaoSeg,
        fase: "andando",
        faseT: 0,
        aoTerminar,
        fagulhasTintadas: (arte?.fagulhas ?? []).map((f) => tintar(f, cor)),
        cor,
      };
    },
    soltarGanhos: (itens) => {
      itens.slice(0, 6).forEach((item, i) => {
        const f = alocar(flutuantes);
        if (!f) return;
        f.vivo = true;
        f.x = heroX + (i % 2 === 0 ? -16 : 18);
        f.y = CHAO_Y - 80 - i * 11;
        f.vida = f.max = 1.7;
        f.txt = item.txt;
        f.cor = item.cor;
      });
    },
    definirEstado: (e) => {
      estado = e;
    },
    definirArte: (a) => {
      arte = a;
    },
    emSessao: () => sessao !== null,
    estacaoEm: (x01, y01) => {
      if (sessao) return null; // durante o close-up a cena não é clicável
      const x = x01 * CASA_W;
      const y = y01 * CASA_H;
      if (y < CHAO_Y - 70) return null; // só a faixa do chão/hotspots
      let melhor: EstacaoId | null = null;
      let dist = 26;
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
