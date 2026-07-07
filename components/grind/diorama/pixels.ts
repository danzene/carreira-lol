import { criarRng } from "@/engine/rng";
import type { Role } from "@/engine/types";
import type { TipoInimigo } from "./coreografia";

// 🎨 Arte do Diorama — paleta do jogo (dark + neon pink/cyan, irmã do auto-battle),
// sprites pré-renderizados em mini-canvases no INIT (atlas → drawImage por frame,
// zero alocação no loop) e camadas de parallax pré-renderizadas offscreen (1 vez).
// Vista LATERAL (side-scroller de lane), pensada pra ler bem em 72px de altura.

export const CORD = {
  fundo: "#0b0617",
  ciano: "#19e6e0",
  cianoEsc: "#0e6f7a",
  rosa: "#ff2d7e",
  rosaEsc: "#9c1b4e",
  ouro: "#ffd34d",
  branco: "#fff7ff",
  texto: "#ece8ff",
  suave: "#9a90c0",
  pele: "#e8c39e",
  perna: "#1a1530",
  cinza: "#cfcfe6",
  barao: "#9a6bff",
  baraoClaro: "#c9adff",
  dragao: "#e8762b",
  dragaoClaro: "#f2a35c",
  verde: "#46d36a",
  // cenário
  ceuDia: "#14264a",
  ceuNoite: "#070b1f",
  ceuRio: "#0e2038",
  morro: "#101d38",
  morroNoite: "#0b1128",
  arvore: "#0f3320",
  arvoreClara: "#1a4a2f",
  tronco: "#3d2b1a",
  chao: "#5c4d2e",
  chaoEsc: "#43351f",
  chaoLinha: "#7a6a45",
  agua: "#123a52",
  aguaClara: "#7fd4ff",
  pedra: "#3a3050",
  pedraEsc: "#241c40",
} as const;

type Ctx = CanvasRenderingContext2D;

function px(c: Ctx, x: number, y: number, w: number, h: number, cor: string): void {
  c.fillStyle = cor;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function novoCanvas(w: number, h: number): { cv: HTMLCanvasElement; c: Ctx } {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  return { cv, c };
}

// ---------- SPRITES DO JOGADOR (corpo; a cabeça é o retrato do campeão em runtime) ----------
// Frames 20×22, âncora no pé (embaixo, centro). O rim light neon (ciano) dá o contraste
// sobre o fundo escuro — assinatura visual do jogo.
export type EstadoSprite = "idle" | "run" | "attack" | "hit" | "death" | "victory" | "sit";

type Arq = "atirador" | "mago" | "lutador" | "suporte";
function arqDe(rota: Role): Arq {
  if (rota === "ADC") return "atirador";
  if (rota === "MID") return "mago";
  if (rota === "SUPPORT") return "suporte";
  return "lutador";
}

const JW = 20;
const JH = 22;

function pintarJogador(c: Ctx, arq: Arq, estado: EstadoSprite, frame: number): void {
  const cx = JW / 2;
  const chao = JH;
  const bob = estado === "run" ? (frame % 2 === 0 ? 0 : -1) : estado === "idle" ? (frame % 2 === 0 ? 0 : -0.5) : 0;
  const deitado = estado === "death";
  const sentado = estado === "sit";
  const lunge = estado === "attack" && frame === 1 ? 2 : 0;

  if (deitado) {
    // caído no chão (derrota) — rápido e digno: de lado, sem drama
    px(c, cx - 6, chao - 4, 10, 3, CORD.cianoEsc);
    px(c, cx - 7, chao - 5, 3, 3, CORD.pele);
    px(c, cx + 2, chao - 3, 4, 2, CORD.perna);
    return;
  }

  const y0 = chao - 14 + bob - (sentado ? -3 : 0);
  // pernas
  if (sentado) {
    px(c, cx - 3, chao - 4, 6, 2, CORD.perna); // sentado: pernas dobradas
  } else if (estado === "run") {
    const passo = frame % 2 === 0;
    px(c, cx - 3, y0 + 9, 2, 5, CORD.perna);
    px(c, cx + 1, y0 + 9 + (passo ? -1 : 1), 2, 5 - (passo ? -1 : 1), CORD.perna);
  } else {
    px(c, cx - 3, y0 + 9, 2, 5, CORD.perna);
    px(c, cx + 1, y0 + 9, 2, 5, CORD.perna);
  }
  // torso (uniforme ciano do time, com sombra e RIM LIGHT)
  const flashHit = estado === "hit";
  px(c, cx - 4 + lunge, y0, 8, 10, flashHit ? CORD.branco : CORD.ciano);
  px(c, cx - 4 + lunge, y0, 2, 10, CORD.cianoEsc); // sombra
  px(c, cx + 3 + lunge, y0, 1, 10, CORD.branco); // rim light neon
  // braço/arma por arquétipo (aponta pra frente = +x)
  const ax = cx + 4 + lunge;
  const atacando = estado === "attack";
  if (arq === "lutador") {
    px(c, ax, y0 + (atacando ? 0 : 2), 2, atacando ? 9 : 7, atacando ? CORD.branco : CORD.cinza); // espadão
    px(c, ax - 1, y0 + (atacando ? 0 : 2), 4, 1, CORD.cinza);
  } else if (arq === "atirador") {
    px(c, ax, y0 + 2, 1, 6, "#caa15a"); // arco
    px(c, ax + 1, y0 + 4, atacando ? 3 : 1, 1, atacando ? CORD.branco : "#caa15a");
  } else if (arq === "mago") {
    px(c, ax, y0 - 1, 1, 9, "#7a5a2a"); // cajado
    px(c, ax - 1, y0 - 3, 3, 3, atacando ? CORD.branco : CORD.barao); // orbe
  } else {
    px(c, ax, y0 + 1, 3, 6, "#bfe6ff"); // escudo
    px(c, ax, y0 + 1, 1, 6, CORD.branco);
  }
  if (estado === "victory") {
    px(c, cx - 6, y0 - 2, 2, 5, CORD.pele); // braço erguido
    px(c, cx - 6, y0 - 4, 2, 2, CORD.ouro); // punho pro alto
  }
}

// ---------- SPRITES DOS INIMIGOS (vista lateral; olham pra -x) ----------
function pintarInimigo(c: Ctx, tipo: TipoInimigo, frame: number, hit: boolean): void {
  const f = frame % 2;
  if (tipo === "minion") {
    // minion roxo inimigo (bolinha com capuz)
    px(c, 2, 6 + f, 8, 6 - f, hit ? CORD.branco : CORD.rosaEsc);
    px(c, 3, 3 + f, 6, 4, hit ? CORD.branco : CORD.rosa);
    px(c, 3, 5 + f, 2, 2, CORD.fundo); // olho
    px(c, 9, 8, 2, 4 - f, CORD.rosaEsc); // bracinho
  } else if (tipo === "lobo") {
    px(c, 2, 8 + f, 13, 5, hit ? CORD.branco : "#6a5a8a"); // corpo
    px(c, 0, 6 + f, 5, 4, hit ? CORD.branco : "#7a6a9a"); // cabeça
    px(c, 1, 7 + f, 1, 1, CORD.rosa); // olho
    px(c, 13, 6 + f, 3, 2, "#5a4a7a"); // cauda
    px(c, 3, 13, 2, 2 - f, "#4a3a6a");
    px(c, 11, 13, 2, 2 - f, "#4a3a6a"); // patas
  } else if (tipo === "golem") {
    px(c, 2, 4 + f, 12, 12 - f, hit ? CORD.branco : CORD.pedra); // corpaço
    px(c, 4, 6 + f, 8, 2, CORD.pedraEsc);
    px(c, 4, 2 + f, 3, 3, hit ? CORD.branco : CORD.pedra); // cabeça
    px(c, 5, 3 + f, 1, 1, CORD.ouro); // olho
    px(c, 0, 8 + f, 3, 6, CORD.pedraEsc);
    px(c, 13, 8 + f, 3, 6, CORD.pedraEsc); // braços
  } else if (tipo === "dragao") {
    px(c, 4, 8 + f, 14, 8, hit ? CORD.branco : CORD.dragao); // corpo
    px(c, 6, 14, 10, 2, CORD.dragaoClaro); // barriga
    px(c, 0, 6 + f, 6, 5, hit ? CORD.branco : CORD.dragao); // cabeça
    px(c, 1, 8 + f, 1, 1, CORD.ouro); // olho
    px(c, 8, 4 - f, 6, 4, "#b3541e"); // asa batendo
    px(c, 17, 5 + f, 4, 3, "#b3541e"); // cauda
    px(c, 6, 16, 3, 2 - f, "#b3541e");
    px(c, 13, 16, 3, 2 - f, "#b3541e"); // patas
  } else {
    // barão: torso erguido com espinhos (boss raro)
    px(c, 8, 12 + f, 10, 6, hit ? CORD.branco : "#6b48b8"); // cauda
    px(c, 4, 2 + f, 8, 18 - f, hit ? CORD.branco : CORD.barao); // torso
    px(c, 4, 2 + f, 2, 18, "#6b48b8"); // sombra
    px(c, 2, 0 + f, 6, 5, CORD.barao); // cabeça
    px(c, 3, 2 + f, 1, 1, CORD.branco);
    px(c, 5, 3 + f, 1, 1, CORD.rosa); // olhos
    px(c, 10, 0 - f, 2, 3, CORD.baraoClaro);
    px(c, 13, 2 - f, 2, 3, CORD.baraoClaro);
    px(c, 16, 5 - f, 2, 3, CORD.baraoClaro); // espinhos
  }
}

export const TAM_INIMIGO: Record<TipoInimigo, { w: number; h: number }> = {
  minion: { w: 12, h: 12 },
  lobo: { w: 16, h: 15 },
  golem: { w: 16, h: 16 },
  dragao: { w: 21, h: 18 },
  barao: { w: 18, h: 26 },
};

// ---------- ATLAS: pré-renderiza todos os frames uma vez (drawImage no loop) ----------
export interface AtlasDiorama {
  jogador: Record<EstadoSprite, HTMLCanvasElement[]>;
  inimigos: Record<TipoInimigo, { normal: HTMLCanvasElement[]; hit: HTMLCanvasElement }>;
  jw: number;
  jh: number;
}

export function criarAtlas(rota: Role): AtlasDiorama {
  const arq = arqDe(rota);
  const estados: EstadoSprite[] = ["idle", "run", "attack", "hit", "death", "victory", "sit"];
  const jogador = {} as AtlasDiorama["jogador"];
  for (const e of estados) {
    const frames: HTMLCanvasElement[] = [];
    const n = e === "death" || e === "hit" ? 1 : 2;
    for (let f = 0; f < n; f++) {
      const { cv, c } = novoCanvas(JW + 4, JH);
      pintarJogador(c, arq, e, f);
      frames.push(cv);
    }
    jogador[e] = frames;
  }
  const inimigos = {} as AtlasDiorama["inimigos"];
  for (const tipo of Object.keys(TAM_INIMIGO) as TipoInimigo[]) {
    const { w, h } = TAM_INIMIGO[tipo];
    const normal: HTMLCanvasElement[] = [];
    for (let f = 0; f < 2; f++) {
      const { cv, c } = novoCanvas(w + 5, h + 2);
      pintarInimigo(c, tipo, f, false);
      normal.push(cv);
    }
    const { cv, c } = novoCanvas(w + 5, h + 2);
    pintarInimigo(c, tipo, 0, true);
    inimigos[tipo] = { normal, hit: cv };
  }
  return { jogador, inimigos, jw: JW + 4, jh: JH };
}

// ---------- PARALLAX: 3 camadas pré-renderizadas por cenário (tileáveis em X) ----------
export interface CamadasCenario {
  ceu: HTMLCanvasElement; // estática (não rola)
  fundo: HTMLCanvasElement; // morros/torre — rola devagar
  meio: HTMLCanvasElement; // árvores/pedras — rola médio
  chao: HTMLCanvasElement; // trilha da lane — rola rápido
  nome: string;
}

export function prerenderCenario(variante: 0 | 1 | 2, W: number, H: number): CamadasCenario {
  const rng = criarRng(0xd10 + variante);
  const W2 = W * 2; // 2× de largura pra scroll com wrap
  const chaoY = H - 12;

  // céu (gradiente pixel em faixas + estrelas/lua conforme a variante)
  const ceu = novoCanvas(W, H);
  {
    const c = ceu.c;
    const base = variante === 1 ? CORD.ceuNoite : variante === 2 ? CORD.ceuRio : CORD.ceuDia;
    px(c, 0, 0, W, H, base);
    // faixas de degradê (mais claras em cima nos cenários dia/rio)
    c.globalAlpha = 0.16;
    for (let i = 0; i < 4; i++) px(c, 0, i * 6, W, 6, variante === 1 ? "#101a3a" : "#27467e");
    c.globalAlpha = 1;
    if (variante === 1) {
      for (let i = 0; i < 26; i++) px(c, rng() * W, rng() * (H * 0.55), 1, 1, rng() > 0.75 ? CORD.branco : "#5a6a9a"); // estrelas
      px(c, W - 34, 8, 7, 7, "#e8e0c0"); // lua
      px(c, W - 32, 10, 3, 3, "#c9c0a0");
    } else {
      for (let i = 0; i < 8; i++) px(c, rng() * W, 4 + rng() * 18, 8 + rng() * 10, 2, variante === 2 ? "#1c3a5e" : "#20365e"); // nuvens finas
    }
  }

  // fundo: silhueta de morros + a TORRE da lane ao longe (marco visual)
  const fundo = novoCanvas(W2, H);
  {
    const c = fundo.c;
    const corMorro = variante === 1 ? CORD.morroNoite : CORD.morro;
    for (let x = 0; x < W2; x += 4) {
      const h = 14 + Math.sin(x * 0.02 + variante * 2) * 6 + Math.sin(x * 0.005) * 8;
      px(c, x, chaoY - h, 4, h + 2, corMorro);
    }
    // torres distantes (1 por metade, pra sempre ter uma no horizonte)
    for (const tx of [W * 0.55, W * 1.45]) {
      px(c, tx - 3, chaoY - 26, 6, 24, CORD.pedraEsc);
      px(c, tx - 3, chaoY - 26, 2, 24, CORD.pedra);
      px(c, tx - 2, chaoY - 30, 4, 5, variante === 1 ? CORD.rosaEsc : CORD.cianoEsc);
      px(c, tx - 1, chaoY - 29, 2, 2, variante === 1 ? CORD.rosa : CORD.ciano); // cristal
    }
  }

  // meio: árvores/moitas (ou juncos na margem do rio)
  const meio = novoCanvas(W2, H);
  {
    const c = meio.c;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * W2 + rng() * 22;
      if (variante === 2 && rng() > 0.5) {
        px(c, x, chaoY - 7, 1, 7, CORD.arvoreClara); // junco
        px(c, x - 1, chaoY - 9, 3, 3, CORD.arvore);
      } else {
        const alto = 10 + rng() * 8;
        px(c, x, chaoY - 2, 2, 2, CORD.tronco);
        px(c, x - 3, chaoY - alto, 8, alto - 3, CORD.arvore); // copa
        px(c, x - 1, chaoY - alto - 2, 4, 3, CORD.arvoreClara);
      }
    }
  }

  // chão: trilha da lane com pedrinhas (e água na variante rio)
  const chao = novoCanvas(W2, H);
  {
    const c = chao.c;
    px(c, 0, chaoY, W2, 12, CORD.chao);
    px(c, 0, chaoY, W2, 2, CORD.chaoLinha);
    for (let x = 0; x < W2; x += 3) if (rng() > 0.72) px(c, x, chaoY + 3 + rng() * 7, 2, 1, CORD.chaoEsc);
    if (variante === 2) {
      px(c, 0, H - 4, W2, 4, CORD.agua); // margem d'água (brilho animado fica no runtime)
    }
  }

  const nome = variante === 0 ? "lane · dia" : variante === 1 ? "lane · noite" : "margem do rio";
  return { ceu: ceu.cv, fundo: fundo.cv, meio: meio.cv, chao: chao.cv, nome };
}

// ---------- helpers de desenho de HUD do canvas ----------
export function textoPixel(c: Ctx, familia: string, txt: string, x: number, y: number, cor: string, tam = 6, centro = true): void {
  c.fillStyle = cor;
  c.font = `${tam}px ${familia}`;
  c.textAlign = centro ? "center" : "left";
  c.textBaseline = "top";
  c.fillText(txt, Math.round(x), Math.round(y));
}

export function familiaPixel(): string {
  if (typeof document === "undefined") return "monospace";
  const probe = document.createElement("span");
  probe.className = "font-pixel";
  probe.style.cssText = "position:absolute;visibility:hidden";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "monospace";
  document.body.removeChild(probe);
  return fam;
}
