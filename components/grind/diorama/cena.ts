import type { TierBau } from "@/data/grindProposito";
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

export type EventoCena =
  | "hit"
  | "kill"
  | "killGrande"
  | "moeda"
  | "sucata"
  | "drop"
  | "vitoria"
  | "derrota"
  | "fimDesfecho"
  | "penta"
  | "bauCaiu" // o baú tocou o chão
  | "bauPronto" // respiro: a borda deve chamar abrirBau() e devolver revelarBau()
  | "bauComum"
  | "bauRaro"
  | "bauLendario"
  | "bauFim";
export type ModoCena = "normal" | "dormindo" | "pausado";

// Cosméticos EQUIPADOS (cores) — puro visual, zero efeito em número (Regra 3).
export interface CosmeticosCena {
  skin?: string; // hue de tint no sprite do herói (preserva a luz)
  trilha?: string; // cor do rastro do golpe
  pet?: string; // cor do bichinho que segue o herói
}

// Modificadores VISUAIS vindos da árvore (a economia mora no engine).
export interface ModsCena {
  encenacaoMult: number; // acelera a coreografia (velocidade de ataque/dano/foco)
  golpeDuplo: number; // 0..1 chance de um segundo golpe visual
}

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

// 🔩 Parafusos de Sucata: mesma linguagem das moedas, forma/cor distintas (ler a diferença)
interface Sucata {
  vivo: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homing: boolean;
  giro: number;
}

// 🎁 Baú: cai NEUTRO com física (2 quiques + poeira); a cor do tier só acende na ABERTURA
interface Bau {
  ativo: boolean;
  x: number;
  y: number;
  vy: number;
  quiques: number;
  pousado: boolean;
  pediuAbertura: boolean;
  tier: TierBau | null; // null = ainda não revelado
  cerimoniaT: number; // >0 = tocando a cerimônia do tier
  cerimoniaMax: number;
  nomeTrofeu?: string; // cosmético do Lendário (troféu com nome)
}

interface Faixa {
  vida: number;
  max: number;
  txt: string;
  cor: string;
}

const MOEDA_ALVO = { x: CENA_W - 34, y: 9 }; // contador de $ no topo-direito do canvas
const SUCATA_ALVO = { x: CENA_W - 76, y: 9 }; // contador de Sucata (à esquerda do $)
const BAU_X = PX + 52; // onde o baú cai (à frente do herói)
const DUR_CERIMONIA: Record<TierBau, number> = { comum: 0.7, raro: 1.5, lendario: 3.0 };

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
  // 🎯 Grind com Propósito
  soltarBau(): void; // baú pendente ⇒ cai NEUTRO na cena
  revelarBau(tier: TierBau, nomeTrofeu?: string): void; // a borda abriu: acende a cor e toca a cerimônia
  pularCerimonia(): void; // clique dispensa a cerimônia (inclusive a do Lendário)
  temBau(): boolean;
  emCerimonia(): boolean; // cerimônia tocando (só aí o clique é "dispensar")
  definirCosmeticos(c: CosmeticosCena): void;
  definirMods(m: ModsCena): void;
  // 🗺️ Expedição (reuso do motor): esconder o HUD do passivo e a tensão crescente
  definirHud(mostrar: boolean): void;
  definirIntensidade(pct: number): void; // 0..1
  // 🗺️ combate DIRIGIDO da Expedição (a view manda as batidas no ritmo dela)
  expIniciar(ligado: boolean): void; // true = suspende a timeline normal (campo limpo)
  expLeva(tipos: TipoInimigo[], rotulo: string, boss: boolean): void; // spawna a leva da fase
  expBatida(b: { t: "inimigoAtaca" | "heroiMata" | "cura"; inimigo: number; dano: number }): void;
  expMorteHeroi(): void;
  expFaseLimpa(rotulo: string): void;
  expJuice(): void; // clique do jogador: golpe cosmético (tátil, zero efeito em número)
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
    sucataDia: () => number;
    barraPct: () => number; // 0..100 da barra de baú
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
  const sucatas: Sucata[] = Array.from({ length: 20 }, () => ({ vivo: false, x: 0, y: 0, vx: 0, vy: 0, homing: false, giro: 0 }));
  const bau: Bau = { ativo: false, x: BAU_X, y: 0, vy: 0, quiques: 0, pousado: false, pediuAbertura: false, tier: null, cerimoniaT: 0, cerimoniaMax: 0 };

  // ---- estado da cena ----
  let modo: ModoCena = "normal";
  let reduzido = false;
  let retrato: HTMLImageElement | null = null;
  let atlasReal: AtlasReal | null = null; // arte real (progressive enhancement; null = programático)
  let cosmeticos: CosmeticosCena = {};
  let modsCena: ModsCena = { encenacaoMult: 1, golpeDuplo: 0 };
  let petX = PX - 16; // pet segue o herói com atraso (trailing suave)
  let petY = CHAO_Y;
  let petFase = 0;
  let rastroT = 0; // trilha do golpe (cosmético)
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
  let mostrarHud = true; // false na Expedição (o HUD de HP/fase é React por cima)
  let intensidade = 0; // 0..1 tensão crescente da Expedição (escurece + vinheta ameaçadora)
  // 🗺️ combate DIRIGIDO da Expedição: a timeline normal é suspensa e a view manda as
  // batidas (expBatida) no ritmo dela — o motor só encena (anims/partículas/juice).
  let expModo = false;
  let expHitT = 0; // herói apanhando (anim de hit)
  let expMorto = false;
  let expVitoriaT = 0; // pose de vitória entre fases

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

  // 🔩 parafusos de Sucata saltam do inimigo morto e voam pro contador (arco + homing)
  function soltarSucata(x: number, y: number, n: number): void {
    if (reduzido) return; // modo economia: o contador anda igual, sem partícula
    for (let i = 0; i < n; i++) {
      const s = alocar(sucatas);
      if (!s) return;
      s.vivo = true;
      s.x = x;
      s.y = y;
      s.vx = -10 - rngCena() * 30; // sai pra esquerda (o contador de Sucata fica antes do $)
      s.vy = -60 - rngCena() * 40;
      s.homing = false;
      s.giro = rngCena() * Math.PI;
    }
  }

  // 🎨 Tint de SKIN: o blend "color" pega hue+saturação da cor e mantém a LUMINOSIDADE
  // do sprite — hue-shift que preserva luz e sombra da arte. Memoizado por (frame,cor):
  // custo é 1 canvas offscreen por frame no momento de equipar, zero por frame de render.
  const tintCache = new Map<string, HTMLCanvasElement>();
  function frameTintado(nome: string, cor: string): HTMLCanvasElement | null {
    const a = atlasReal;
    if (!a) return null;
    const f = a.frames[nome];
    if (!f) return null;
    const chave = `${nome}|${cor}`;
    const pronto = tintCache.get(chave);
    if (pronto) return pronto;
    if (tintCache.size > 64) tintCache.clear(); // troca de skin não vaza memória
    const cv = document.createElement("canvas");
    cv.width = f.w;
    cv.height = f.h;
    const c2 = cv.getContext("2d");
    if (!c2) return null;
    c2.imageSmoothingEnabled = false;
    c2.drawImage(a.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    c2.globalCompositeOperation = "color";
    c2.fillStyle = cor;
    c2.fillRect(0, 0, f.w, f.h);
    c2.globalCompositeOperation = "destination-in"; // recorta pelo alpha original
    c2.drawImage(a.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    tintCache.set(chave, cv);
    return cv;
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
    soltarSucata(al.x, CHAO_Y - 9, grande ? 3 : 2); // 🔩 o minion morto solta Sucata
    opts.aoEvento("sucata");
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
      rastroT = 0.18; // trilha do golpe (cor do cosmético equipado)
      al.hitT = 0.12;
      al.squash = 0.14;
      soltarDano(al.x, CHAO_Y - TAM_INIMIGO[al.tipo].h - 6, String(g.dano), g.crit ? CORD.ouro : CORD.texto, g.crit ? 8 : 6);
      soltarParts(al.x - 4, CHAO_Y - 10, g.crit ? 5 : 2, CORD.branco, 40);
      if (g.crit) hitStop = Math.max(hitStop, 0.06);
      opts.aoEvento("hit");
      // ⚔️ Golpe Duplo (talento): 2º impacto puramente VISUAL — o dano do engine não muda
      if (rngCena() < modsCena.golpeDuplo) {
        soltarDano(al.x + 6, CHAO_Y - TAM_INIMIGO[al.tipo].h - 12, String(Math.round(g.dano * 0.5)), CORD.ciano, 6);
        soltarParts(al.x - 2, CHAO_Y - 12, 3, CORD.ciano, 45);
        hitStop = Math.max(hitStop, 0.04);
      }
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

  // ---- 🎁 baú: física (2 quiques + poeira), gate de respiro e cerimônia por tier ----
  function atualizarBau(dt0: number): void {
    if (!bau.ativo) return;

    if (!bau.pousado) {
      bau.vy += 420 * dt0; // gravidade fake
      bau.y += bau.vy * dt0;
      const chao = CHAO_Y - 6;
      if (bau.y >= chao) {
        bau.y = chao;
        if (bau.quiques >= 2) {
          bau.pousado = true;
          bau.vy = 0;
          soltarParts(bau.x, CHAO_Y - 1, 5, CORD.suave, 30); // poeira
          shake = Math.max(shake, 1.4);
          opts.aoEvento("bauCaiu");
        } else {
          bau.quiques += 1;
          bau.vy = -bau.vy * 0.45; // quica
          soltarParts(bau.x, CHAO_Y - 1, 3, CORD.suave, 22);
        }
      }
      return;
    }

    // o herói só abre num BEAT DE RESPIRO — nunca no meio de um clash
    if (!bau.pediuAbertura && bau.tier === null) {
      const respiro = jogadorEstado === "sit" || modo !== "normal" || !inimigos.some((i) => i.vivo && i.morteT <= 0);
      if (respiro) {
        bau.pediuAbertura = true;
        opts.aoEvento("bauPronto"); // a borda chama abrirBau() e devolve revelarBau()
      }
      return;
    }

    if (bau.cerimoniaT > 0) {
      bau.cerimoniaT -= dt0;
      if (bau.cerimoniaT <= 0) {
        bau.ativo = false;
        bau.tier = null;
        bau.nomeTrofeu = undefined;
        opts.aoEvento("bauFim");
      }
    }
  }

  function atualizar(dt0: number): void {
    // hit-stop: congela a ação (mas deixa efeitos suaves respirarem a 20%)
    let dt = dt0;
    if (hitStop > 0) {
      hitStop -= dt0;
      dt = dt0 * 0.2;
    }
    // ⚔️ velocidade de ataque/dano/foco ACELERAM a encenação (visual; o rendimento
    // já foi decidido pelo engine na duração da partida)
    dt *= modsCena.encenacaoMult;
    shake = Math.max(0, shake - dt0 * 14);
    if (crossfade > 0) {
      crossfade -= dt0;
      if (crossfade <= 0) cenarioAnterior = null;
    }
    jogadorFrameT += dt;
    ataqueT = Math.max(0, ataqueT - dt0);
    rastroT = Math.max(0, rastroT - dt0);
    jogadorSquash += (0 - jogadorSquash) * Math.min(1, dt0 * 10);
    if (dropGlow > 0) dropGlow -= dt0;
    atualizarBau(dt0);

    // 🐾 pet segue o herói com atraso fofo (trailing suave) — puro cosmético
    if (cosmeticos.pet) {
      const alvoX = PX - 18;
      petX += (alvoX - petX) * Math.min(1, dt0 * 3.4);
      petFase += dt0 * 6;
      petY = CHAO_Y - 1 + Math.sin(petFase) * 1.4;
    }
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
    } else if (expModo) {
      // combate dirigido: sem timeline própria — o estado do herói deriva dos timers
      expHitT = Math.max(0, expHitT - dt0);
      expVitoriaT = Math.max(0, expVitoriaT - dt0);
      jogadorEstado = expMorto ? "death" : expVitoriaT > 0 ? "victory" : ataqueT > 0 ? "attack" : expHitT > 0 ? "hit" : "idle";
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
    for (const s of sucatas) {
      if (!s.vivo) continue;
      s.giro += dt0 * 9;
      if (!s.homing) {
        s.x += s.vx * dt0;
        s.y += s.vy * dt0;
        s.vy += 300 * dt0; // mesmo arco das moedas (gravidade fake)
        if (s.vy > 20) s.homing = true;
      } else {
        const dx = SUCATA_ALVO.x - s.x;
        const dy = SUCATA_ALVO.y - s.y;
        const d2 = Math.hypot(dx, dy);
        if (d2 < 8) {
          s.vivo = false;
          continue;
        }
        s.x += (dx / d2) * 240 * dt0;
        s.y += (dy / d2) * 240 * dt0;
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
  function drawReal(nome: string, x: number, pe: number, flip: boolean, squash: number, alpha = 1, tint?: string): boolean {
    const a = atlasReal;
    if (!a) return false;
    const f = a.frames[nome];
    if (!f) return false;
    const tintado = tint ? frameTintado(nome, tint) : null; // skin equipada (memoizada)
    const sx = 1 + squash;
    const sy = 1 - squash;
    c.save();
    c.globalAlpha = alpha;
    c.translate(Math.round(x), Math.round(pe));
    c.scale(flip ? -sx : sx, sy);
    if (tintado) c.drawImage(tintado, -f.anchorX, -f.baselineY);
    else c.drawImage(a.img, f.x, f.y, f.w, f.h, -f.anchorX, -f.baselineY, f.w, f.h);
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
    if (nomeReal && drawReal(nomeReal, PX, CHAO_Y, false, jogadorSquash, 1, cosmeticos.skin)) {
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

  // ➰ trilha do golpe: arco na cor do cosmético (default = branco do jogo)
  function desenharRastro(): void {
    if (rastroT <= 0 || reduzido) return;
    const t = rastroT / 0.18;
    c.save();
    c.globalAlpha = t * 0.9;
    c.strokeStyle = cosmeticos.trilha ?? CORD.branco;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(PX + 6, CHAO_Y - 14, 13, -1.1 - (1 - t) * 0.9, 0.5 - (1 - t) * 0.9);
    c.stroke();
    c.restore();
    c.globalAlpha = 1;
  }

  // 🐾 pet: bichinho pixel desenhado por código, na cor do cosmético
  function desenharPet(): void {
    const cor = cosmeticos.pet;
    if (!cor || modo === "dormindo") return;
    const x = Math.round(petX);
    const y = Math.round(petY);
    c.fillStyle = "rgba(0,0,0,0.3)";
    c.beginPath();
    c.ellipse(x, CHAO_Y + 1, 4, 1.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = cor;
    c.fillRect(x - 3, y - 6, 7, 6); // corpo
    c.fillRect(x - 4, y - 4, 1, 2); // patinha
    c.fillRect(x + 4, y - 4, 1, 2);
    c.fillStyle = CORD.fundo;
    c.fillRect(x - 1, y - 5, 1, 1); // olhinhos
    c.fillRect(x + 2, y - 5, 1, 1);
  }

  // 🔩 parafusos de Sucata (quadradinho com "furo" — distingue da moeda redonda/dourada)
  function desenharSucatas(): void {
    for (const s of sucatas) {
      if (!s.vivo) continue;
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      c.fillStyle = "#b9c2d0";
      c.fillRect(x, y, 3, 3);
      c.fillStyle = "#6d7688";
      c.fillRect(x + (Math.sin(s.giro) > 0 ? 1 : 0), y + 1, 1, 1);
    }
  }

  // 🎁 baú: cai NEUTRO; a cor do tier só acende na cerimônia (antecipação máxima)
  function desenharBau(): void {
    if (!bau.ativo) return;
    const x = Math.round(bau.x);
    const y = Math.round(bau.y);
    const rev = bau.tier !== null;
    const t = rev ? 1 - bau.cerimoniaT / Math.max(0.001, bau.cerimoniaMax) : 0; // 0→1 na cerimônia
    const corTier = bau.tier === "lendario" ? CORD.ouro : bau.tier === "raro" ? CORD.ciano : CORD.suave;

    // 🌑 Lendário: a cena ESCURECE e um feixe sobe do baú
    if (bau.tier === "lendario") {
      c.fillStyle = `rgba(7,4,18,${Math.min(0.72, t * 2.2)})`;
      c.fillRect(0, 0, CENA_W, CENA_H);
      const g = c.createLinearGradient(x, y, x, 0);
      g.addColorStop(0, "rgba(255,211,77,0.55)");
      g.addColorStop(1, "rgba(255,45,126,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - 3, y);
      c.lineTo(x + 3, y);
      c.lineTo(x + 16, 0);
      c.lineTo(x - 16, 0);
      c.closePath();
      c.fill();
    } else if (bau.tier === "raro") {
      c.globalAlpha = Math.min(0.5, t * 1.4); // brilho azul crescente
      c.fillStyle = CORD.ciano;
      c.fillRect(x - 12, y - 12, 24, 18);
      c.globalAlpha = 1;
    }

    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.ellipse(x, CHAO_Y + 1, 7, 2, 0, 0, Math.PI * 2);
    c.fill();

    // corpo do baú + tampa que abre na cerimônia
    const abre = rev ? Math.min(7, t * 14) : 0;
    c.fillStyle = rev ? corTier : "#6b5636";
    c.fillRect(x - 6, y - 4, 12, 8);
    c.fillStyle = rev ? CORD.branco : "#9a7d4c";
    c.fillRect(x - 6, y - 5 - abre, 12, 3); // tampa
    c.fillStyle = rev ? CORD.branco : "#3c3020";
    c.fillRect(x - 1, y - 2, 2, 3); // fechadura

    // troféu do Lendário sobe do baú com o nome do cosmético
    if (bau.tier === "lendario" && bau.nomeTrofeu) {
      const sobe = Math.min(1, t * 1.8);
      const ty = y - 8 - sobe * 26;
      c.globalAlpha = sobe;
      c.fillStyle = CORD.ouro;
      c.fillRect(x - 5, ty - 5, 10, 10);
      c.fillStyle = CORD.branco;
      c.fillRect(x - 3, ty - 3, 6, 6);
      textoPixel(c, opts.familia, bau.nomeTrofeu.toUpperCase(), CENA_W / 2, CENA_H - 22, CORD.ouro, 7);
      c.globalAlpha = 1;
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
    // 🔩 Sucata (alvo dos parafusos) e $ do dia (alvo das moedas), lado a lado
    textoPixel(c, opts.familia, `${opts.sucataDia()}`, CENA_W - 72, 4, "#b9c2d0", 7, false);
    c.fillStyle = "#b9c2d0";
    c.fillRect(CENA_W - 80, 5, 4, 4); // ícone do parafuso
    c.fillStyle = "#6d7688";
    c.fillRect(CENA_W - 79, 6, 2, 2);
    textoPixel(c, opts.familia, `$${opts.dinheiroDia()}`, CENA_W - 30, 4, CORD.ouro, 7, false);
    // mini-barra do teto (embaixo do $)
    const pct = opts.tetoPct();
    c.fillStyle = CORD.pedraEsc;
    c.fillRect(CENA_W - 30, 13, 24, 2);
    c.fillStyle = pct >= 100 ? CORD.ouro : CORD.ciano;
    c.fillRect(CENA_W - 30, 13, Math.round((Math.min(100, pct) / 100) * 24), 2);

    // 🎁 barra de baú: faixa fina na BASE (não briga com nada) + baú na ponta.
    // Últimos 10% brilham (antecipação); cheia + pendente = baú pulsando.
    const bp = Math.min(100, opts.barraPct());
    const larg = CENA_W - 16;
    c.fillStyle = "rgba(36,28,64,0.9)";
    c.fillRect(0, CENA_H - 3, CENA_W, 3);
    const quase = bp >= 90;
    c.fillStyle = quase ? CORD.ouro : CORD.barao;
    if (quase && !reduzido) c.globalAlpha = 0.75 + 0.25 * Math.sin(jogadorFrameT * 8);
    c.fillRect(0, CENA_H - 3, Math.round((bp / 100) * larg), 3);
    c.globalAlpha = 1;
    // ícone de baú na ponta direita
    const bx = CENA_W - 9;
    const by = CENA_H - 8;
    c.fillStyle = bau.ativo || bp >= 100 ? CORD.ouro : "#6b5636";
    c.fillRect(bx - 4, by + 2, 8, 5);
    c.fillStyle = bau.ativo || bp >= 100 ? CORD.branco : "#9a7d4c";
    c.fillRect(bx - 4, by, 8, 2);
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
    desenharPet();
    desenharJogador();
    desenharRastro();
    desenharBau();
    desenharEfeitos();
    desenharSucatas();

    // escurece a cena dormindo (a fogueira vira o ponto de luz)
    if (modo === "dormindo") {
      c.fillStyle = "rgba(7,4,18,0.55)";
      c.fillRect(0, 0, CENA_W, CENA_H);
    }

    // 🗺️ Expedição: tensão crescente — escurece e pinta uma vinheta avermelhada de perigo
    // conforme a profundidade aumenta (definirIntensidade). Draw-time puro, zero alocação.
    if (intensidade > 0.01) {
      c.fillStyle = `rgba(10,2,6,${0.5 * intensidade})`;
      c.fillRect(0, 0, CENA_W, CENA_H);
      const vg = c.createRadialGradient(CENA_W / 2, CENA_H / 2, CENA_H * 0.3, CENA_W / 2, CENA_H / 2, CENA_W * 0.6);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(150,10,25,${0.5 * intensidade})`);
      c.fillStyle = vg;
      c.fillRect(0, 0, CENA_W, CENA_H);
    }

    if (mostrarHud) desenharHud();

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

    // ---- 🎯 Grind com Propósito ----
    soltarBau: () => {
      if (bau.ativo) return;
      bau.ativo = true;
      bau.x = BAU_X;
      bau.y = -10;
      bau.vy = 0;
      bau.quiques = 0;
      bau.pousado = false;
      bau.pediuAbertura = false;
      bau.tier = null; // cai NEUTRO: o tier é segredo até a abertura
      bau.cerimoniaT = 0;
      bau.nomeTrofeu = undefined;
    },
    revelarBau: (tier, nomeTrofeu) => {
      if (!bau.ativo) return;
      bau.tier = tier;
      bau.nomeTrofeu = nomeTrofeu;
      bau.cerimoniaMax = DUR_CERIMONIA[tier];
      bau.cerimoniaT = bau.cerimoniaMax;
      if (tier === "comum") {
        soltarMoedas(bau.x, bau.y - 6, 2);
        soltarSucata(bau.x, bau.y - 6, 2);
        opts.aoEvento("bauComum");
      } else if (tier === "raro") {
        soltarParts(bau.x, bau.y - 6, 12, CORD.ciano, 70);
        soltarSucata(bau.x, bau.y - 6, 4);
        shake = Math.max(shake, 2);
        hitStop = Math.max(hitStop, 0.08);
        opts.aoEvento("bauRaro");
      } else {
        soltarParts(bau.x, bau.y - 6, 18, CORD.ouro, 90);
        soltarSucata(bau.x, bau.y - 6, 6);
        shake = Math.max(shake, 3);
        opts.aoEvento("bauLendario");
      }
    },
    pularCerimonia: () => {
      if (bau.ativo && bau.tier !== null && bau.cerimoniaT > 0.15) bau.cerimoniaT = 0.15;
    },
    temBau: () => bau.ativo,
    emCerimonia: () => bau.ativo && bau.tier !== null && bau.cerimoniaT > 0,
    definirCosmeticos: (novos) => {
      cosmeticos = novos;
    },
    definirMods: (m) => {
      modsCena = m;
    },
    definirHud: (mostrar) => {
      mostrarHud = mostrar;
    },
    definirIntensidade: (pct) => {
      intensidade = Math.max(0, Math.min(1, pct));
    },

    // ---- 🗺️ combate dirigido da Expedição ----
    expIniciar: (ligado) => {
      expModo = ligado;
      expMorto = false;
      expHitT = 0;
      expVitoriaT = 0;
      desfecho = null;
      limparCampo();
      faixa = null;
      jogadorEstado = ligado ? "idle" : "run";
    },
    expLeva: (tipos, rotulo, boss) => {
      limparCampo();
      expMorto = false;
      for (let i = 0; i < tipos.length && i < inimigos.length; i++) {
        const slot = inimigos[i];
        slot.vivo = true;
        slot.tipo = tipos[i];
        slot.x = CENA_W + 16 + i * 22; // entram marchando da direita
        slot.alvoX = PX + 36 + i * 19;
        slot.frameT = rngCena();
        slot.hitT = 0;
        slot.morteT = 0;
        slot.squash = 0;
        slot.atkT = 0;
      }
      faixa = { vida: 1.2, max: 1.2, txt: rotulo, cor: boss ? CORD.ouro : CORD.ciano };
      if (boss) shake = Math.max(shake, 2);
    },
    expBatida: (b) => {
      if (b.t === "inimigoAtaca") {
        const al = inimigos[b.inimigo];
        if (al?.vivo) {
          al.atkT = 0.3; // arte real: atk_1 → atk_2
          al.squash = 0.1;
        }
        expHitT = 0.35;
        jogadorSquash = -0.15;
        soltarDano(PX, CHAO_Y - 36, `-${b.dano}`, CORD.rosa, b.dano >= 20 ? 8 : 6);
        soltarParts(PX + 4, CHAO_Y - 14, 3, CORD.rosa, 40);
        if (b.dano >= 20) {
          shake = Math.max(shake, 2.2);
          hitStop = Math.max(hitStop, 0.06);
        }
        opts.aoEvento("hit");
      } else if (b.t === "heroiMata") {
        const al = inimigos[b.inimigo];
        ataqueT = durAtaque();
        jogadorSquash = 0.12;
        rastroT = 0.18;
        if (al?.vivo && al.morteT <= 0) {
          al.hitT = 0.12;
          al.squash = 0.14;
          soltarDano(al.x, CHAO_Y - TAM_INIMIGO[al.tipo].h - 6, String(b.dano), al.tipo !== "minion" ? CORD.ouro : CORD.texto, al.tipo !== "minion" ? 8 : 6);
          matarInimigo(b.inimigo, al.tipo !== "minion");
        }
      } else {
        // cura leve entre fases (recompensa de limpar)
        soltarDano(PX, CHAO_Y - 40, `+${b.dano}`, "#2ee6a0", 7);
        soltarParts(PX, CHAO_Y - 20, 6, "#2ee6a0", 42);
      }
    },
    expMorteHeroi: () => {
      expMorto = true;
      faixa = { vida: 1.6, max: 1.6, txt: "VOCÊ CAIU", cor: CORD.rosa };
      shake = Math.max(shake, 3);
      hitStop = Math.max(hitStop, 0.12);
      soltarParts(PX, CHAO_Y - 14, 14, CORD.rosa, 70);
      opts.aoEvento("derrota");
    },
    expFaseLimpa: (rotulo) => {
      expVitoriaT = 1.1;
      faixa = { vida: 1.2, max: 1.2, txt: rotulo, cor: CORD.ciano };
      opts.aoEvento("vitoria");
    },
    expJuice: () => {
      if (expMorto) return;
      ataqueT = durAtaque();
      jogadorSquash = 0.12;
      rastroT = 0.18;
      const alvo = inimigos.find((i) => i.vivo && i.morteT <= 0);
      if (alvo) {
        alvo.hitT = 0.1;
        alvo.squash = 0.1;
        soltarParts(alvo.x - 3, CHAO_Y - 10, 2, CORD.branco, 35);
      }
    },
  };
}
