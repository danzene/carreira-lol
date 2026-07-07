import { criarRng, type Rng } from "@/engine/rng";
import type { PartidaGrind } from "@/engine/grind";
import type { Role } from "@/engine/types";
import {
  coreografarCorpo,
  coreografarDesfecho,
  seedCoreografia,
  type CorpoCoreografia,
  type DesfechoCoreografia,
  type TipoInimigo,
} from "./coreografia";
import type { AtlasReal } from "./atlasReal";
import { CORD, criarAtlas, prerenderCenario, TAM_INIMIGO, textoPixel, type AtlasDiorama, type CamadasCenario } from "./pixels";

// 🎭 Runtime da cena do Diorama — consome a coreografia (pura) e ENCENA no canvas.
// Nenhuma regra de jogo aqui: só posição, frame e juice. Orçamento rígido:
// pools pré-alocados (zero alocação por frame), atlas via drawImage, parallax
// pré-renderizado. O rAF/cap de FPS mora na casca React (DioramaGrind).

export const CENA_W = 480;
export const CENA_H = 96;
const CHAO_Y = CENA_H - 14; // linha do chão (pé dos sprites)
const PX = 74; // x fixo do jogador

export type EventoCena = "hit" | "kill" | "killGrande" | "moeda" | "drop" | "vitoria" | "derrota" | "fimDesfecho" | "penta";
export type ModoCena = "normal" | "dormindo" | "pausado";

interface Inimigo {
  vivo: boolean;
  tipo: TipoInimigo;
  x: number;
  alvoX: number;
  frameT: number;
  hitT: number; // flash de dano
  morteT: number; // >0 = animação de morte (encolhe e some)
  squash: number; // squash&stretch ao tomar hit
  atkT: number; // >0 = animação de ataque (arte real: atk_1→atk_2 no contra-golpe)
}

interface Dano {
  vivo: boolean;
  x: number;
  y: number;
  vida: number;
  max: number;
  txt: string;
  cor: string;
  tam: number;
}

interface Moeda {
  vivo: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homing: boolean; // depois do arco, gruda no contador
}

interface Part {
  vivo: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  cor: string;
}

interface Faixa {
  vida: number;
  max: number;
  txt: string;
  cor: string;
}

const MOEDA_ALVO = { x: CENA_W - 34, y: 9 }; // contador de $ no topo-direito do canvas

export interface CenaDiorama {
  atualizar(dt: number): void;
  desenhar(): void;
  definirPartida(idx: number, boss: boolean): void;
  tocarDesfecho(p: PartidaGrind): void;
  definirCtx(novo: CanvasRenderingContext2D): void; // troca o alvo de render (PiP)
  definirAtlasReal(a: AtlasReal | null): void; // arte real (progressive enhancement)
  definirModo(m: ModoCena): void;
  definirRetrato(img: HTMLImageElement | null): void;
  definirReduzido(r: boolean): void;
  emDesfecho(): boolean;
  cenarioNome(): string;
}

export function criarCena(
  ctx: CanvasRenderingContext2D,
  opts: {
    rota: Role;
    elo: string;
    seedDia: number;
    familia: string;
    placar: () => { v: number; d: number };
    dinheiroDia: () => number;
    tetoPct: () => number;
    aoEvento: (ev: EventoCena) => void;
  },
): CenaDiorama {
  const atlas: AtlasDiorama = criarAtlas(opts.rota);
  let cenarios: CamadasCenario = prerenderCenario(0, CENA_W, CENA_H);

  // ---- pools (pré-alocados; zero alocação no loop) ----
  const inimigos: Inimigo[] = Array.from({ length: 6 }, () => ({ vivo: false, tipo: "minion", x: 0, alvoX: 0, frameT: 0, hitT: 0, morteT: 0, squash: 0, atkT: 0 }));
  const danos: Dano[] = Array.from({ length: 16 }, () => ({ vivo: false, x: 0, y: 0, vida: 0, max: 1, txt: "", cor: "", tam: 6 }));
  const moedas: Moeda[] = Array.from({ length: 24 }, () => ({ vivo: false, x: 0, y: 0, vx: 0, vy: 0, homing: false }));
  const parts: Part[] = Array.from({ length: 48 }, () => ({ vivo: false, x: 0, y: 0, vx: 0, vy: 0, vida: 0, max: 1, cor: "" }));

  // ---- estado da cena ----
  let modo: ModoCena = "normal";
  let reduzido = false;
  let retrato: HTMLImageElement | null = null;
  let atlasReal: AtlasReal | null = null; // arte real (progressive enhancement; null = programático)
  let estadoT = 0; // tempo no estado atual do jogador (dirige os frames da arte real)
  let estadoPrev: "idle" | "run" | "attack" | "hit" | "death" | "victory" | "sit" = "run";
  let corpo: CorpoCoreografia | null = null;
  let rngCena: Rng = criarRng(1);
  let clock = 0; // clock do corpo (loop)
  let idxWave = 0;
  let idxGolpe = 0;
  let idxContra = 0;
  let desfecho: DesfechoCoreografia | null = null;
  let clockD = 0;
  let idxBeatD = 0;
  let campeaoInimigo: { nome: string; x: number; vivo: boolean; morrendo: number; hitT: number } | null = null;
  let jogadorEstado: "idle" | "run" | "attack" | "hit" | "death" | "victory" | "sit" = "run";
  let jogadorFrameT = 0;
  let jogadorSquash = 0; // >0 estica no ataque; <0 achata no hit
  let ataqueT = 0;
  let hitStop = 0; // congelamento curto no impacto (o segredo do soco gostoso)
  let shake = 0;
  let scroll = 0; // deslocamento do parallax
  let faixa: Faixa | null = null;
  let emoteAtual = 0;
  let zzzT = 0;
  let gankT = -1; // >=0: silhueta atravessando (micro-evento)
  let ambienteT = 0; // pétalas/vagalumes
  let dropGlow = 0; // brilho do drop caindo

  function alocar<T extends { vivo: boolean }>(pool: T[]): T | null {
    for (const p of pool) if (!p.vivo) return p;
    return null;
  }

  function soltarDano(x: number, y: number, txt: string, cor: string, tam = 6): void {
    const d = alocar(danos);
    if (!d) return;
    d.vivo = true;
    d.x = x;
    d.y = y;
    d.vida = 0.9;
    d.max = 0.9;
    d.txt = txt;
    d.cor = cor;
    d.tam = tam;
  }

  function soltarMoedas(x: number, y: number, n: number): void {
    if (reduzido) return; // modo economia: sem partícula (o contador anda do mesmo jeito)
    for (let i = 0; i < n; i++) {
      const mo = alocar(moedas);
      if (!mo) return;
      mo.vivo = true;
      mo.x = x;
      mo.y = y;
      mo.vx = 20 + rngCena() * 40;
      mo.vy = -70 - rngCena() * 40;
      mo.homing = false;
    }
  }

  function soltarParts(x: number, y: number, n: number, cor: string, forca = 55): void {
    if (reduzido) return;
    for (let i = 0; i < n; i++) {
      const p = alocar(parts);
      if (!p) return;
      const a = rngCena() * Math.PI * 2;
      const v = rngCena() * forca;
      p.vivo = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - 25;
      p.vida = 0.5;
      p.max = 0.5;
      p.cor = cor;
    }
  }

  function limparCampo(): void {
    for (const i of inimigos) i.vivo = false;
    campeaoInimigo = null;
  }

  let cenarioAnterior: CamadasCenario | null = null;
  let crossfade = 0; // >0: transição suave entre cenários (easing, nada de corte seco)

  // ---- API ----
  function definirPartida(idx: number, boss: boolean): void {
    const antes = corpo?.cenario;
    corpo = coreografarCorpo(opts.seedDia, idx, opts.elo, boss);
    rngCena = criarRng(seedCoreografia(opts.seedDia, idx) ^ 0xce7a);
    if (antes !== undefined && antes !== corpo.cenario) {
      cenarioAnterior = cenarios;
      crossfade = 0.8;
    }
    cenarios = prerenderCenario(corpo.cenario, CENA_W, CENA_H);
    clock = 0;
    idxWave = 0;
    idxGolpe = 0;
    idxContra = 0;
    desfecho = null;
    limparCampo();
    jogadorEstado = "run";
    gankT = -1;
    ambienteT = corpo.microEvento?.tipo === "petalas" || corpo.microEvento?.tipo === "vagalumes" ? 0 : -1;
  }

  function tocarDesfecho(p: PartidaGrind): void {
    desfecho = coreografarDesfecho(p, opts.seedDia);
    clockD = 0;
    idxBeatD = 0;
    limparCampo();
    campeaoInimigo = { nome: p.adversario, x: CENA_W + 24, vivo: true, morrendo: 0, hitT: 0 };
    jogadorEstado = "idle";
  }

  // ---- atualização ----
  function spawnWave(w: CorpoCoreografia["waves"][number]): void {
    for (let i = 0; i < w.inimigos.length && i < inimigos.length; i++) {
      const slot = inimigos[i];
      slot.vivo = true;
      slot.tipo = w.inimigos[i].tipo;
      slot.x = CENA_W + 16 + i * 18;
      slot.alvoX = PX + 34 + i * 16;
      slot.frameT = rngCena();
      slot.hitT = 0;
      slot.morteT = 0;
      slot.squash = 0;
      slot.atkT = 0;
    }
  }

  // duração da animação de ataque do jogador (arte real tem windup→strike→recovery)
  const durAtaque = () => (atlasReal ? 0.36 : 0.18);

  function matarInimigo(idx: number, grande: boolean): void {
    const al = inimigos[idx];
    if (!al?.vivo) return;
    al.morteT = 0.3;
    soltarParts(al.x, CHAO_Y - 8, grande ? 10 : 6, grande ? CORD.ouro : CORD.rosa, grande ? 70 : 50);
    soltarMoedas(al.x, CHAO_Y - 10, grande ? 3 : 2);
    hitStop = Math.max(hitStop, grande ? 0.1 : 0.07);
    if (grande) shake = Math.max(shake, 2.6);
    opts.aoEvento(grande ? "killGrande" : "kill");
  }

  function atualizarCorpo(dt: number): void {
    if (!corpo) return;
    const antes = clock;
    clock += dt;
    if (clock >= corpo.duracao) {
      // volta do loop: recomeça as waves (a partida real ainda está acumulando)
      clock = 0;
      idxWave = 0;
      idxGolpe = 0;
      idxContra = 0;
      limparCampo();
      jogadorEstado = "run";
    }

    // micro-evento gank: silhueta rosa atravessa e o jogador desvia
    if (corpo.microEvento?.tipo === "gank" && antes < corpo.microEvento.t && clock >= corpo.microEvento.t) {
      gankT = 0;
      soltarDano(PX, CHAO_Y - 34, "!", CORD.rosa, 9);
    }
    if (gankT >= 0) gankT += dt;
    if (gankT > 2.2) gankT = -1;

    const w = corpo.waves[idxWave];
    if (!w) return;

    if (clock < w.t) {
      jogadorEstado = "run"; // correndo pra próxima wave (parallax anda)
      return;
    }

    // spawn da wave (uma vez)
    if (clock >= w.t && !inimigos.some((i) => i.vivo) && idxGolpe === 0 && clock < w.t + 0.1) spawnWave(w);
    if (!inimigos.some((i) => i.vivo) && idxGolpe >= w.golpes.length) {
      // wave limpa: avança
      idxWave++;
      idxGolpe = 0;
      idxContra = 0;
      jogadorEstado = "run";
      return;
    }

    const tw = clock - w.t;
    jogadorEstado = ataqueT > 0 ? "attack" : "idle";

    // golpes do jogador
    while (idxGolpe < w.golpes.length && w.golpes[idxGolpe].t <= tw) {
      const g = w.golpes[idxGolpe];
      idxGolpe++;
      const al = inimigos[g.alvo];
      if (!al?.vivo || al.morteT > 0) continue;
      ataqueT = durAtaque();
      jogadorSquash = 0.12;
      al.hitT = 0.12;
      al.squash = 0.14;
      soltarDano(al.x, CHAO_Y - TAM_INIMIGO[al.tipo].h - 6, String(g.dano), g.crit ? CORD.ouro : CORD.texto, g.crit ? 8 : 6);
      soltarParts(al.x - 4, CHAO_Y - 10, g.crit ? 5 : 2, CORD.branco, 40);
      if (g.crit) hitStop = Math.max(hitStop, 0.06);
      opts.aoEvento("hit");
      if (g.mata) matarInimigo(g.alvo, al.tipo !== "minion");
    }

    // contra-golpes (o jogador toma dano cosmético; o minion mais próximo "ataca")
    while (idxContra < w.contraGolpes.length && w.contraGolpes[idxContra].t <= tw) {
      const cg = w.contraGolpes[idxContra];
      idxContra++;
      jogadorEstado = "hit";
      jogadorSquash = -0.15;
      soltarDano(PX, CHAO_Y - 36, String(cg.dano), CORD.rosa, 6);
      const atacante = inimigos.find((i) => i.vivo && i.morteT <= 0);
      if (atacante) atacante.atkT = 0.3; // arte real: atk_1 → atk_2
    }
  }

  function atualizarDesfecho(dt: number): void {
    if (!desfecho) return;
    clockD += dt;
    // campeão entra andando
    if (campeaoInimigo?.vivo && campeaoInimigo.morrendo === 0 && campeaoInimigo.x > PX + 40) campeaoInimigo.x -= dt * 60;

    while (idxBeatD < desfecho.beats.length && desfecho.beats[idxBeatD].t <= clockD) {
      const b = desfecho.beats[idxBeatD];
      idxBeatD++;
      if (b.tipo === "duelo_golpe") {
        if (b.deQuem === "voce") {
          ataqueT = durAtaque();
          jogadorSquash = 0.12;
          if (campeaoInimigo) {
            campeaoInimigo.hitT = 0.12;
            soltarDano(campeaoInimigo.x, CHAO_Y - 40, String(b.dano), b.crit ? CORD.ouro : CORD.texto, b.crit ? 8 : 6);
          }
          if (b.crit) hitStop = Math.max(hitStop, 0.07);
          opts.aoEvento("hit");
        } else {
          jogadorEstado = "hit";
          jogadorSquash = -0.15;
          soltarDano(PX, CHAO_Y - 36, String(b.dano), CORD.rosa, b.crit ? 8 : 6);
        }
      } else if (b.tipo === "resultado") {
        if (b.vitoria) {
          if (campeaoInimigo) {
            campeaoInimigo.morrendo = 0.4;
            soltarParts(campeaoInimigo.x, CHAO_Y - 14, 12, CORD.rosa, 70);
          }
          jogadorEstado = "victory";
          faixa = { vida: 1.5, max: 1.5, txt: b.penta ? "PENTAKILL!" : "VITÓRIA", cor: b.penta ? CORD.ouro : CORD.ciano };
          shake = Math.max(shake, b.penta ? 3 : 2.2);
          hitStop = Math.max(hitStop, 0.1);
          opts.aoEvento(b.penta ? "penta" : "vitoria");
        } else {
          jogadorEstado = "death";
          faixa = { vida: 1.0, max: 1.0, txt: "DERROTA", cor: CORD.rosa };
          opts.aoEvento("derrota");
        }
      } else if (b.tipo === "gold") {
        soltarMoedas(campeaoInimigo?.x ?? PX + 60, CHAO_Y - 16, Math.min(6, 2 + b.valor));
        opts.aoEvento("moeda");
      } else if (b.tipo === "drop") {
        dropGlow = 1.4;
        opts.aoEvento("drop");
      } else if (b.tipo === "respiro") {
        jogadorEstado = "sit";
        emoteAtual = b.emote;
        campeaoInimigo = null;
      }
    }

    if (clockD >= desfecho.duracao) {
      desfecho = null;
      opts.aoEvento("fimDesfecho"); // a casca decide a próxima partida
    }
  }

  function atualizar(dt0: number): void {
    // hit-stop: congela a ação (mas deixa efeitos suaves respirarem a 20%)
    let dt = dt0;
    if (hitStop > 0) {
      hitStop -= dt0;
      dt = dt0 * 0.2;
    }
    shake = Math.max(0, shake - dt0 * 14);
    if (crossfade > 0) {
      crossfade -= dt0;
      if (crossfade <= 0) cenarioAnterior = null;
    }
    jogadorFrameT += dt;
    ataqueT = Math.max(0, ataqueT - dt0);
    jogadorSquash += (0 - jogadorSquash) * Math.min(1, dt0 * 10);
    if (dropGlow > 0) dropGlow -= dt0;
    if (faixa) {
      faixa.vida -= dt0;
      if (faixa.vida <= 0) faixa = null;
    }

    if (modo === "dormindo" || modo === "pausado") {
      jogadorEstado = "sit";
      zzzT += dt0;
      if (modo === "dormindo" && zzzT > 1.6) {
        zzzT = 0;
        soltarDano(PX + 8, CHAO_Y - 34, "z", CORD.suave, 6);
      }
    } else if (desfecho) {
      atualizarDesfecho(dt);
    } else {
      atualizarCorpo(dt);
    }

    // parallax: anda quando o jogador corre
    if (jogadorEstado === "run") scroll += dt * 26;

    // inimigos: aproximação + timers
    for (const i of inimigos) {
      if (!i.vivo) continue;
      if (i.morteT > 0) {
        i.morteT -= dt0;
        if (i.morteT <= 0) i.vivo = false;
        continue;
      }
      if (i.x > i.alvoX) i.x -= dt * 55;
      i.frameT += dt;
      i.hitT = Math.max(0, i.hitT - dt0);
      i.atkT = Math.max(0, i.atkT - dt0);
      i.squash += (0 - i.squash) * Math.min(1, dt0 * 10);
    }
    if (campeaoInimigo) {
      campeaoInimigo.hitT = Math.max(0, campeaoInimigo.hitT - dt0);
      if (campeaoInimigo.morrendo > 0) {
        campeaoInimigo.morrendo -= dt0;
        if (campeaoInimigo.morrendo <= 0) campeaoInimigo.vivo = false;
      }
    }

    // pools
    for (const d of danos) {
      if (!d.vivo) continue;
      d.vida -= dt0;
      d.y -= dt0 * 14 * (1 - Math.pow(1 - d.vida / d.max, 2)); // pop-in com ease-out
      if (d.vida <= 0) d.vivo = false;
    }
    for (const mo of moedas) {
      if (!mo.vivo) continue;
      if (!mo.homing) {
        mo.x += mo.vx * dt0;
        mo.y += mo.vy * dt0;
        mo.vy += 300 * dt0; // gravidade fake do arco
        if (mo.vy > 20) mo.homing = true; // depois do pico, voa pro contador
      } else {
        const dx = MOEDA_ALVO.x - mo.x;
        const dy = MOEDA_ALVO.y - mo.y;
        const d2 = Math.hypot(dx, dy);
        if (d2 < 8) {
          mo.vivo = false;
          opts.aoEvento("moeda");
          continue;
        }
        mo.x += (dx / d2) * 260 * dt0;
        mo.y += (dy / d2) * 260 * dt0;
      }
    }
    for (const p of parts) {
      if (!p.vivo) continue;
      p.vida -= dt0;
      p.x += p.vx * dt0;
      p.y += p.vy * dt0;
      p.vy += 140 * dt0;
      if (p.vida <= 0) p.vivo = false;
    }

    // relógio do estado do jogador (dirige os frames da arte real)
    if (jogadorEstado !== estadoPrev) {
      estadoT = 0;
      estadoPrev = jogadorEstado;
    } else {
      estadoT += dt0;
    }

    // ambiente (pétalas/vagalumes) — bem raro e barato
    if (ambienteT >= 0 && !reduzido) {
      ambienteT += dt0;
      if (ambienteT > 0.7) {
        ambienteT = 0;
        const p = alocar(parts);
        if (p && corpo) {
          p.vivo = true;
          p.x = rngCena() * CENA_W;
          p.y = corpo.cenario === 1 ? CHAO_Y - 10 - rngCena() * 30 : -2;
          p.vx = corpo.cenario === 1 ? (rngCena() - 0.5) * 10 : 8 + rngCena() * 10;
          p.vy = corpo.cenario === 1 ? -4 - rngCena() * 6 : 10 + rngCena() * 8;
          p.vida = 2.2;
          p.max = 2.2;
          p.cor = corpo.cenario === 1 ? CORD.ouro : CORD.rosa;
        }
      }
    }
  }

  // ---- desenho ----
  // Alvo de render TROCÁVEL (PiP): a cena desenha no ctx que receber — nunca se move
  // um <canvas> entre documentos (isso quebra/trava); cria-se um novo lá e troca aqui.
  let c = ctx;

  function drawTile(img: HTMLCanvasElement, fator: number): void {
    const off = Math.floor(scroll * fator) % CENA_W;
    c.drawImage(img, -off, 0);
    c.drawImage(img, -off + CENA_W, 0);
  }

  function drawSprite(img: HTMLCanvasElement, x: number, pe: number, flip: boolean, squash: number): void {
    const w = img.width;
    const h = img.height;
    const sx = 1 + squash;
    const sy = 1 - squash;
    c.save();
    c.translate(Math.round(x), Math.round(pe));
    if (flip) c.scale(-sx, sy);
    else c.scale(sx, sy);
    c.drawImage(img, -w / 2, -h);
    c.restore();
  }

  // Frame da ARTE REAL ancorado no baseline do JSON (pés no chão), com o MESMO
  // squash&stretch/flip dos programáticos (transform no draw — a arte não muda o feel).
  function drawReal(nome: string, x: number, pe: number, flip: boolean, squash: number, alpha = 1): boolean {
    const a = atlasReal;
    if (!a) return false;
    const f = a.frames[nome];
    if (!f) return false;
    const sx = 1 + squash;
    const sy = 1 - squash;
    c.save();
    c.globalAlpha = alpha;
    c.translate(Math.round(x), Math.round(pe));
    c.scale(flip ? -sx : sx, sy);
    c.drawImage(a.img, f.x, f.y, f.w, f.h, -f.anchorX, -f.baselineY, f.w, f.h);
    c.restore();
    c.globalAlpha = 1;
    return true;
  }

  // Estado → frame real do herói (timings da coreografia preservados). null = sem arte.
  function frameHeroiNome(): string | null {
    const a = atlasReal;
    if (!a) return null;
    const tem = (n: string) => (a.frames[n] ? n : null);
    switch (jogadorEstado) {
      case "idle":
        return tem(`heroi_idle_${1 + (Math.floor(estadoT / 0.6) % 2)}`);
      case "run":
        return tem(`heroi_run_${1 + (Math.floor(estadoT / 0.11) % 4)}`);
      case "attack": {
        // windup (130ms) → strike (o hit-stop existente cai AQUI) → recovery
        const e = durAtaque() - ataqueT;
        return tem(e < 0.13 ? "heroi_atk_1" : e < 0.24 ? "heroi_atk_2" : "heroi_atk_3");
      }
      case "hit":
        return tem("heroi_hit_1");
      case "death":
        return tem(estadoT < 0.3 ? "heroi_derrota_1" : "heroi_derrota_2");
      case "victory":
        return tem(estadoT < 0.2 ? "heroi_vitoria_1" : `heroi_vitoria_${2 + (Math.floor((estadoT - 0.2) / 0.35) % 2)}`);
      case "sit":
        // slots PRONTOS pra arte futura; enquanto não chega: derrota_2 (sentado) com
        // zzz/café/teclado desenhados por código POR CIMA (bloco compartilhado abaixo)
        return tem(modo === "dormindo" ? "heroi_dormindo" : "heroi_sentado") ?? tem("heroi_derrota_2");
    }
  }

  function desenharJogador(): void {
    // sombra (ancorada no baseline — igual nas duas artes)
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.ellipse(PX, CHAO_Y + 1, 8, 2.4, 0, 0, Math.PI * 2);
    c.fill();

    const nomeReal = frameHeroiNome();
    let alturaCorpo = atlas.jh;
    if (nomeReal && drawReal(nomeReal, PX, CHAO_Y, false, jogadorSquash)) {
      // ARTE REAL (herói já olha pra direita — sem flip)
      const fr = atlasReal!.frames[nomeReal];
      alturaCorpo = fr.baselineY;
      // flash branco 60ms por cima no hit (frame pré-tingido no load do atlas)
      if (jogadorEstado === "hit" && estadoT < 0.06) {
        const b = atlasReal!.branco["heroi_hit_1"];
        if (b) {
          c.globalAlpha = 0.8;
          c.drawImage(b, PX - fr.anchorX, CHAO_Y - fr.baselineY);
          c.globalAlpha = 1;
        }
      }
      // retrato do campeão da vez vira um selo pequeno acima (identidade preservada)
      if (jogadorEstado !== "death" && jogadorEstado !== "sit" && retrato && retrato.complete && retrato.naturalWidth > 0) {
        const py = CHAO_Y - alturaCorpo - 12;
        c.fillStyle = CORD.ouro;
        c.fillRect(PX - 6, py, 11, 11);
        c.drawImage(retrato, PX - 5, py + 1, 9, 9);
      }
    } else {
      // FALLBACK programático (Regra 4: arte é progressive enhancement)
      const frames = atlas.jogador[jogadorEstado];
      const f = frames[Math.floor(jogadorFrameT * (jogadorEstado === "run" ? 8 : 3)) % frames.length];
      drawSprite(f, PX, CHAO_Y, false, jogadorSquash);
      if (jogadorEstado !== "death" && retrato && retrato.complete && retrato.naturalWidth > 0) {
        const py = CHAO_Y - atlas.jh - 11 + (jogadorEstado === "sit" ? 6 : 0);
        c.fillStyle = CORD.ouro;
        c.fillRect(PX - 7, py, 14, 14);
        c.drawImage(retrato, PX - 6, py + 1, 12, 12);
      }
    }
    // emote do respiro/pausa
    if (jogadorEstado === "sit") {
      const t = Math.floor(jogadorFrameT * 2) % 2;
      if (modo === "pausado") {
        c.fillStyle = CORD.pedra; // banco de reservas
        c.fillRect(PX - 12, CHAO_Y - 6, 24, 3);
        c.fillRect(PX - 10, CHAO_Y - 3, 2, 3);
        c.fillRect(PX + 8, CHAO_Y - 3, 2, 3);
      } else if (modo === "dormindo") {
        // fogueira ao lado
        c.fillStyle = CORD.tronco;
        c.fillRect(PX + 16, CHAO_Y - 3, 8, 2);
        c.fillStyle = t ? CORD.ouro : CORD.dragao;
        c.fillRect(PX + 18, CHAO_Y - 7 - t, 4, 4 + t);
        c.fillStyle = CORD.branco;
        c.fillRect(PX + 19, CHAO_Y - 5, 2, 1);
      } else if (emoteAtual === 0) {
        // café ☕
        c.fillStyle = CORD.cinza;
        c.fillRect(PX + 8, CHAO_Y - 16 - t, 4, 4);
        c.fillStyle = CORD.suave;
        c.fillRect(PX + 9, CHAO_Y - 18 - t, 1, 1);
      } else if (emoteAtual === 1) {
        // alongando (bracinhos pra cima em 2 frames)
        c.fillStyle = CORD.pele;
        c.fillRect(PX - 9, CHAO_Y - 18 - t * 2, 2, 4);
        c.fillRect(PX + 7, CHAO_Y - 18 - (1 - t) * 2, 2, 4);
      } else {
        // mexendo no teclado
        c.fillStyle = CORD.pedraEsc;
        c.fillRect(PX + 6, CHAO_Y - 8, 8, 2);
        c.fillStyle = t ? CORD.ciano : CORD.suave;
        c.fillRect(PX + 7 + t * 3, CHAO_Y - 9, 2, 1);
      }
    }
  }

  function desenharInimigos(): void {
    for (const i of inimigos) {
      if (!i.vivo) continue;
      const escala = i.morteT > 0 ? Math.max(0.05, i.morteT / 0.3) : 1;
      c.save();
      c.globalAlpha = escala;
      c.fillStyle = "rgba(0,0,0,0.3)";
      c.beginPath();
      c.ellipse(i.x, CHAO_Y + 1, 7 * escala, 2, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // ARTE REAL só pro minion melee por enquanto (caster/canhão/boss = slots futuros;
      // camps/dragão/Barão seguem programáticos até a arte chegar — decisão documentada)
      const nomeMin =
        i.tipo === "minion" && atlasReal
          ? i.morteT > 0 || i.hitT > 0
            ? "minion_azul_hit"
            : i.atkT > 0
              ? i.atkT > 0.15
                ? "minion_azul_atk_1"
                : "minion_azul_atk_2"
              : `minion_azul_walking_${1 + (Math.floor(i.frameT / 0.11) % 3)}`
          : null;
      // minion já olha pra ESQUERDA na arte (avança em direção ao herói) — sem flip
      if (nomeMin && drawReal(nomeMin, i.x, CHAO_Y, false, i.squash + (1 - escala) * 0.4, escala)) continue;

      const spr = i.hitT > 0 ? atlas.inimigos[i.tipo].hit : atlas.inimigos[i.tipo].normal[Math.floor(i.frameT * 5) % 2];
      c.save();
      c.globalAlpha = escala;
      drawSprite(spr, i.x, CHAO_Y, true, i.squash + (1 - escala) * 0.4);
      c.restore();
    }
    if (campeaoInimigo?.vivo) {
      const ci = campeaoInimigo;
      const alpha = ci.morrendo > 0 ? Math.max(0.05, ci.morrendo / 0.4) : 1;
      c.save();
      c.globalAlpha = alpha;
      // campeão adversário = corpo rosa espelhado (usa o frame idle/attack do jogador tingido)
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.beginPath();
      c.ellipse(ci.x, CHAO_Y + 1, 8, 2.4, 0, 0, Math.PI * 2);
      c.fill();
      // tinge de rosa via sombra colorida (barata): identifica o adversário
      c.globalAlpha = alpha * 0.65;
      c.fillStyle = CORD.rosa;
      c.fillRect(ci.x - 6, CHAO_Y - atlas.jh + 6, 12, atlas.jh - 8);
      c.globalAlpha = alpha;
      // arte real: o herói espelhado (scale(-1,1)) vira o campeão inimigo; senão, programático
      const nomeCi = atlasReal ? (ci.hitT > 0 ? "heroi_hit_1" : `heroi_idle_${1 + (Math.floor(jogadorFrameT * 1.6) % 2)}`) : null;
      if (!nomeCi || !drawReal(nomeCi, ci.x, CHAO_Y, true, 0, alpha)) {
        const spr = ci.hitT > 0 ? atlas.jogador.hit[0] : atlas.jogador.idle[Math.floor(jogadorFrameT * 3) % 2];
        drawSprite(spr, ci.x, CHAO_Y, true, 0);
      }
      textoPixel(c, opts.familia, ci.nome, ci.x, CHAO_Y - atlas.jh - 20, CORD.rosa, 6);
      c.restore();
    }
  }

  function desenharEfeitos(): void {
    for (const p of parts) {
      if (!p.vivo) continue;
      c.globalAlpha = Math.max(0, p.vida / p.max);
      c.fillStyle = p.cor;
      c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    for (const mo of moedas) {
      if (!mo.vivo) continue;
      c.fillStyle = CORD.ouro;
      c.fillRect(Math.round(mo.x), Math.round(mo.y), 3, 3);
      c.fillStyle = CORD.branco;
      c.fillRect(Math.round(mo.x) + 1, Math.round(mo.y), 1, 1);
    }
    c.globalAlpha = 1;
    for (const d of danos) {
      if (!d.vivo) continue;
      const a = d.vida / d.max;
      c.globalAlpha = Math.min(1, a * 2);
      const pop = 1 + Math.max(0, a - 0.75) * 2; // pop-in no início
      textoPixel(c, opts.familia, d.txt, d.x, d.y, d.cor, d.tam * pop);
    }
    c.globalAlpha = 1;
    // drop caindo com glow da raridade (grind = Comum)
    if (dropGlow > 0) {
      const t = 1.4 - dropGlow;
      const y = CHAO_Y - 40 + t * 26;
      const x = PX + 44;
      c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 6); // pulso calmo (brilho excessivo irrita no aquário)
      c.fillStyle = CORD.suave;
      c.fillRect(x - 5, y - 5, 12, 12); // glow
      c.globalAlpha = 1;
      c.fillStyle = "#c9c0e8";
      c.fillRect(x - 2, y - 2, 6, 6); // saquinho
      c.fillStyle = CORD.suave;
      c.fillRect(x - 1, y - 4, 4, 2);
    }
  }

  function desenharHud(): void {
    const { v, d } = opts.placar();
    // placar (topo-esquerda)
    textoPixel(c, opts.familia, `${v}V`, 10, 4, CORD.verde, 7, false);
    textoPixel(c, opts.familia, `${d}D`, 30, 4, CORD.rosa, 7, false);
    // $ do dia (topo-direita — alvo das moedas)
    textoPixel(c, opts.familia, `$${opts.dinheiroDia()}`, CENA_W - 30, 4, CORD.ouro, 7, false);
    // mini-barra do teto (embaixo do $)
    const pct = opts.tetoPct();
    c.fillStyle = CORD.pedraEsc;
    c.fillRect(CENA_W - 30, 13, 24, 2);
    c.fillStyle = pct >= 100 ? CORD.ouro : CORD.ciano;
    c.fillRect(CENA_W - 30, 13, Math.round((Math.min(100, pct) / 100) * 24), 2);
  }

  function desenhar(): void {
    c.clearRect(0, 0, CENA_W, CENA_H);
    c.save();
    if (shake > 0.2) c.translate((rngCena() - 0.5) * shake * 2, (rngCena() - 0.5) * shake);

    c.drawImage(cenarios.ceu, 0, 0);
    drawTile(cenarios.fundo, 0.25);
    drawTile(cenarios.meio, 0.55);
    drawTile(cenarios.chao, 1);

    // crossfade entre cenários (ease-out — a transição some suave, sem corte seco)
    if (crossfade > 0 && cenarioAnterior) {
      const a = crossfade / 0.8;
      c.globalAlpha = a * a;
      c.drawImage(cenarioAnterior.ceu, 0, 0);
      drawTile(cenarioAnterior.fundo, 0.25);
      drawTile(cenarioAnterior.meio, 0.55);
      drawTile(cenarioAnterior.chao, 1);
      c.globalAlpha = 1;
    }

    // brilho da água (variante rio) — barato, 4 pixels senoidais
    if (corpo?.cenario === 2 && !reduzido) {
      for (let i = 0; i < 4; i++) {
        const a = Math.sin(jogadorFrameT * 2 + i * 1.7);
        if (a > 0.3) {
          c.globalAlpha = a * 0.7;
          c.fillStyle = CORD.aguaClara;
          c.fillRect(40 + i * 110 - (Math.floor(scroll) % 110), CENA_H - 3, 3, 1);
          c.globalAlpha = 1;
        }
      }
    }

    // gank: silhueta rosa atravessa o fundo
    if (gankT >= 0) {
      const gx = CENA_W - gankT * 220;
      c.globalAlpha = 0.5;
      drawSprite(atlas.jogador.run[Math.floor(gankT * 8) % 2], gx, CHAO_Y - 2, true, 0);
      c.fillStyle = CORD.rosa;
      c.globalAlpha = 0.3;
      c.fillRect(gx - 8, CHAO_Y - atlas.jh, 16, atlas.jh - 4);
      c.globalAlpha = 1;
    }

    desenharInimigos();
    desenharJogador();
    desenharEfeitos();

    // escurece a cena dormindo (a fogueira vira o ponto de luz)
    if (modo === "dormindo") {
      c.fillStyle = "rgba(7,4,18,0.55)";
      c.fillRect(0, 0, CENA_W, CENA_H);
    }

    desenharHud();

    // faixa VITÓRIA/DERROTA/PENTAKILL
    if (faixa) {
      const a = Math.min(1, faixa.vida / 0.3, (faixa.max - faixa.vida) / 0.15);
      c.globalAlpha = Math.max(0, a) * 0.85;
      c.fillStyle = CORD.fundo;
      c.fillRect(0, CENA_H / 2 - 11, CENA_W, 22);
      c.fillStyle = faixa.cor;
      c.fillRect(0, CENA_H / 2 - 11, CENA_W, 1);
      c.fillRect(0, CENA_H / 2 + 10, CENA_W, 1);
      c.globalAlpha = Math.max(0, Math.min(1, a));
      textoPixel(c, opts.familia, faixa.txt, CENA_W / 2, CENA_H / 2 - 6, faixa.cor, 11);
      c.globalAlpha = 1;
    }

    c.restore();
  }

  return {
    atualizar,
    desenhar,
    definirPartida,
    tocarDesfecho,
    definirCtx: (novo) => {
      c = novo;
      c.imageSmoothingEnabled = false;
    },
    definirAtlasReal: (a) => {
      atlasReal = a;
    },
    definirModo: (m) => {
      modo = m;
      if (m !== "normal") limparCampo();
    },
    definirRetrato: (img) => {
      retrato = img;
    },
    definirReduzido: (r) => {
      reduzido = r;
    },
    emDesfecho: () => desfecho !== null,
    cenarioNome: () => cenarios.nome,
  };
}
