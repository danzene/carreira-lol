"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BATALHA, LANES, type Lane, type Ponto, pontoNaRota, posicaoCasa } from "@/data/batalha";
import { criarRng } from "@/engine/rng";
import type { Combatente, RoteiroBatalha } from "@/engine/batalha";
import type { Role } from "@/engine/types";

const COR = {
  fundo: "#0b0617",
  painel: "#15102a",
  borda: "#2a2150",
  azul: "#19e6e0",
  azulEsc: "#0e6f7a",
  vermelho: "#ff2d7e",
  vermelhoEsc: "#9c1b4e",
  pele: "#e8c39e",
  ouro: "#ffd34d",
  texto: "#ece8ff",
  suave: "#9a90c0",
  dragao: "#e8762b",
  barao: "#9a6bff",
  branco: "#fff7ff",
  // cenário (Rift à noite: verdes escuros + água neon, mantendo a identidade)
  terreno: "#11241a",
  terreno2: "#152b1f",
  jungle: "#0a180f",
  jungle2: "#0d1e13",
  arvore: "#0f3320",
  arvoreClara: "#1a4a2f",
  tronco: "#3d2b1a",
  lane: "#5c4d2e",
  laneEsc: "#43351f",
  laneLinha: "#7a6a45",
  agua: "#123a52",
  agua2: "#16465f",
  aguaClara: "#7fd4ff",
  baseAzul: "#0d2b31",
  baseVermelha: "#2b0d1e",
  pedra: "#3a3050",
  pedraEsc: "#241c40",
  critter: "#8a8a5a",
};

type EquipeCor = { corpo: string; escuro: string };
const corDe = (time: "azul" | "vermelho"): EquipeCor =>
  time === "azul" ? { corpo: COR.azul, escuro: COR.azulEsc } : { corpo: COR.vermelho, escuro: COR.vermelhoEsc };

type Arquetipo = "atirador" | "mago" | "lutador" | "suporte";
function arquetipoDe(rota: Role): Arquetipo {
  if (rota === "ADC") return "atirador";
  if (rota === "MID") return "mago";
  if (rota === "SUPPORT") return "suporte";
  return "lutador";
}

interface ChampRT {
  comb: Combatente;
  idx: number;
  x: number;
  y: number;
  casa: Ponto;
  estado: "idle" | "move" | "ataca" | "morto";
  hp: number;
  morreuEm: number;
  facing: 1 | -1;
  fase: number;
  flash: number;
  atacaAte: number;
  proxAtaque: number;
}

interface TorreRT {
  x: number;
  y: number;
  time: "azul" | "vermelho";
  lane: Lane;
  prog: number;
  viva: boolean;
}

interface MinionRT {
  lane: Lane;
  time: "azul" | "vermelho";
  prog: number;
}

type Efeito =
  | { tipo: "part"; x: number; y: number; vx: number; vy: number; cor: string; vida: number; max: number }
  | { tipo: "moeda"; x: number; y: number; vy: number; vida: number; max: number }
  | { tipo: "texto"; x: number; y: number; txt: string; cor: string; vida: number; max: number; tam: number }
  | { tipo: "projetil"; x: number; y: number; tx: number; ty: number; cor: string; vida: number; max: number }
  | { tipo: "explosao"; x: number; y: number; cor: string; vida: number; max: number; raio: number };

type FeedLinha = { txt: string; lado: "azul" | "vermelho" | "neutro"; minuto: number };

interface Estado {
  champs: ChampRT[];
  torres: TorreRT[];
  nexus: { azul: boolean; vermelho: boolean };
  minions: MinionRT[];
  efeitos: Efeito[];
  placar: { azul: number; vermelho: number };
  ouro: { azul: number; vermelho: number }; // ouro simulado (passivo + eventos)
  minuto: number;
  clock: number;
  idx: number;
  shake: number;
  proxWave: number;
  proxCs: number;
  proxSync: number;
  foco: { ativo: boolean; local: Ponto; ate: number; ids: Set<string> };
  pit: { dragao: number; barao: number }; // clock em que a criatura RENASCE (0 = viva)
  fim: boolean;
}

function familiaPixel(): string {
  if (typeof document === "undefined") return "monospace";
  const probe = document.createElement("span");
  probe.className = "font-pixel";
  probe.style.cssText = "position:absolute;visibility:hidden";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "monospace";
  document.body.removeChild(probe);
  return fam;
}

export default function BatalhaCanvas({
  roteiro,
  iconePorId,
  aoTerminar,
}: {
  roteiro: RoteiroBatalha;
  iconePorId: Record<string, string | undefined>;
  aoTerminar: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const velRef = useRef(1);
  const fimRef = useRef(aoTerminar);
  fimRef.current = aoTerminar;
  const [terminou, setTerminou] = useState(false);
  const [vel, setVel] = useState(1);
  const [linhas, setLinhas] = useState<FeedLinha[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [linhas]);

  // HUD nítido (DOM): retratos estáticos + placar/tempo/mortos dinâmicos via estado React.
  const roster = useMemo(() => {
    const mk = (time: "azul" | "vermelho") =>
      roteiro.combatentes.filter((c) => c.time === time).map((c) => ({ id: c.id, ehVoce: c.ehVoce, icone: iconePorId[c.id] }));
    return { azul: mk("azul"), vermelho: mk("vermelho") };
  }, [roteiro, iconePorId]);
  const [marcador, setMarcador] = useState<{
    placar: { azul: number; vermelho: number };
    ouro: { azul: number; vermelho: number };
    minuto: number;
    mortos: string[];
  }>({
    placar: { azul: 0, vermelho: 0 },
    ouro: { azul: 2500, vermelho: 2500 },
    minuto: 0,
    mortos: [],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const familia = familiaPixel();
    setLinhas([]);

    const W = BATALHA.largura;
    const H = BATALHA.altura;
    const hud = 0; // HUD agora é DOM; o canvas usa a altura toda pro mapa
    const m = 8;
    const pfW = W - 2 * m;
    const pfH = H - hud - 2 * m;
    const S = (n: Ponto): [number, number] => [m + n.x * pfW, hud + m + n.y * pfH];

    // ---- estado inicial ----
    const champs: ChampRT[] = roteiro.combatentes.map((comb, idx) => {
      const casa = posicaoCasa(comb.time, comb.rota);
      return {
        comb,
        idx,
        x: comb.time === "azul" ? BATALHA.nexusAzul.x : BATALHA.nexusVermelho.x,
        y: comb.time === "azul" ? BATALHA.nexusAzul.y : BATALHA.nexusVermelho.y,
        casa,
        estado: "move",
        hp: 1,
        morreuEm: -99,
        facing: comb.time === "azul" ? 1 : -1,
        fase: idx * 1.7,
        flash: 0,
        atacaAte: 0,
        proxAtaque: 0,
      };
    });

    const torres: TorreRT[] = [];
    (["top", "mid", "bot"] as Lane[]).forEach((lane) => {
      BATALHA.torresAzul.forEach((p) => torres.push({ ...pontoNaRota(LANES[lane], p), time: "azul", lane, prog: p, viva: true }));
      BATALHA.torresVermelho.forEach((p) => torres.push({ ...pontoNaRota(LANES[lane], p), time: "vermelho", lane, prog: p, viva: true }));
    });

    const est: Estado = {
      champs,
      torres,
      nexus: { azul: true, vermelho: true },
      minions: [],
      efeitos: [],
      placar: { azul: 0, vermelho: 0 },
      ouro: { azul: 2500, vermelho: 2500 },
      minuto: 0,
      clock: 0,
      idx: 0,
      shake: 0,
      proxWave: 0,
      proxCs: 0,
      proxSync: 0,
      foco: { ativo: false, local: { x: 0.5, y: 0.5 }, ate: 0, ids: new Set() },
      pit: { dragao: 0, barao: 0 },
      fim: false,
    };

    const champPorId = new Map(est.champs.map((c) => [c.comb.id, c]));

    // retratos dos campeões (identifica cada rota no mapa; fallback = sprite genérico)
    const retratos = new Map<string, HTMLImageElement>();
    for (const c of roteiro.combatentes) {
      const url = iconePorId[c.id];
      if (!url) continue;
      const img = new Image();
      img.src = url;
      retratos.set(c.id, img);
    }
    const vivos = (time?: "azul" | "vermelho") =>
      est.champs.filter((c) => c.estado !== "morto" && (!time || c.comb.time === time));

    // Espelha o estado pro HUD em DOM (chamado só em eventos/mortes — barato).
    function sincronizar() {
      setMarcador({
        placar: { azul: est.placar.azul, vermelho: est.placar.vermelho },
        ouro: { azul: Math.round(est.ouro.azul), vermelho: Math.round(est.ouro.vermelho) },
        minuto: est.minuto,
        mortos: est.champs.filter((c) => c.estado === "morto").map((c) => c.comb.id),
      });
    }
    sincronizar();

    function narrar(txt: string, lado: "azul" | "vermelho" | "neutro") {
      setLinhas((prev) => [...prev, { txt, lado, minuto: est.minuto }].slice(-40));
    }
    function particulas(p: Ponto, cor: string, n: number, forca = 0.06) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * forca;
        est.efeitos.push({ tipo: "part", x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.02, cor, vida: 0.5, max: 0.5 });
      }
    }
    function flutuante(p: Ponto, txt: string, cor: string, tam = 7) {
      est.efeitos.push({ tipo: "texto", x: p.x, y: p.y, txt, cor, vida: 1.1, max: 1.1, tam });
    }

    // ---- processa um evento do roteiro ----
    // Separa "juntar o time" (por tipo) de "resolver a kill" (qualquer evento com abate).
    function processar(ev: RoteiroBatalha["eventos"][number]) {
      est.minuto = ev.minuto;
      const local = ev.local ?? { x: 0.5, y: 0.5 };

      switch (ev.tipo) {
        case "spawn":
          for (const c of est.champs) c.estado = "move";
          narrar("A partida começou. Saindo da base!", "neutro");
          break;
        case "poke": {
          const perto = [...est.champs]
            .filter((c) => c.estado !== "morto")
            .sort((a, b) => dist(a, local) - dist(b, local))
            .slice(0, 2);
          est.foco = { ativo: true, local, ate: est.clock + 1.3, ids: new Set(perto.map((c) => c.comb.id)) };
          narrar("Trocas de dano nas rotas.", "neutro");
          break;
        }
        case "teamfight":
          est.foco = { ativo: true, local, ate: est.clock + 3, ids: new Set(vivos().map((c) => c.comb.id)) };
          if (ev.texto && !ev.abate) {
            flutuante(local, ev.texto, COR.branco, 7);
            narrar(ev.texto, "neutro");
          }
          est.shake = Math.max(est.shake, 1.6);
          break;
        case "objetivo": {
          est.foco = { ativo: true, local, ate: est.clock + 2.6, ids: new Set(vivos().map((c) => c.comb.id)) };
          if (ev.objetivo) est.pit[ev.objetivo] = est.clock + 40; // criatura some e renasce depois
          const cor = ev.objetivo === "barao" ? COR.barao : COR.dragao;
          if (ev.vencedor) est.ouro[ev.vencedor] += ev.objetivo === "barao" ? 1500 : 600;
          flutuante(local, ev.objetivo === "barao" ? "BARÃO" : "DRAGÃO", cor, 8);
          est.efeitos.push({ tipo: "explosao", x: local.x, y: local.y, cor, vida: 1.2, max: 1.2, raio: 0.16 });
          narrar(
            `${ev.vencedor === "azul" ? "Seu time" : "Time inimigo"} garantiu o ${ev.objetivo === "barao" ? "Barão" : "Dragão"}.`,
            ev.vencedor ?? "neutro",
          );
          est.shake = Math.max(est.shake, 1.4);
          break;
        }
        case "torre": {
          if (ev.torre) {
            const t0 = ev.torre;
            const alvo = est.torres
              .filter((t) => t.viva && t.time === t0.time && t.lane === t0.lane)
              .sort((a, b) => (t0.time === "azul" ? b.prog - a.prog : a.prog - b.prog))[0];
            if (alvo) {
              alvo.viva = false;
              est.ouro[t0.time === "azul" ? "vermelho" : "azul"] += 800; // quem derrubou fatura
              const p = { x: alvo.x, y: alvo.y };
              particulas(p, COR.suave, 14, 0.1);
              est.efeitos.push({ tipo: "explosao", x: p.x, y: p.y, cor: COR.ouro, vida: 0.9, max: 0.9, raio: 0.1 });
              flutuante(p, "TORRE!", COR.ouro, 6);
            }
          }
          if (ev.texto) narrar(ev.texto, "neutro");
          est.shake = Math.max(est.shake, 1.6);
          break;
        }
        case "nexus": {
          const perdedor = ev.vencedor === "azul" ? "vermelho" : "azul";
          est.nexus[perdedor] = false;
          const p = perdedor === "azul" ? BATALHA.nexusAzul : BATALHA.nexusVermelho;
          for (let i = 0; i < 3; i++)
            est.efeitos.push({ tipo: "explosao", x: p.x, y: p.y, cor: i % 2 ? COR.ouro : COR.branco, vida: 1.6 + i * 0.3, max: 1.6 + i * 0.3, raio: 0.05 });
          particulas(p, COR.ouro, 40, 0.16);
          est.foco = { ativo: true, local: p, ate: 999, ids: new Set(vivos(ev.vencedor).map((c) => c.comb.id)) };
          est.shake = Math.max(est.shake, 4);
          if (ev.texto) narrar(ev.texto, ev.vencedor ?? "neutro");
          break;
        }
      }

      if (ev.abate) resolverAbate(ev.abate, local, ev.texto);
    }

    function resolverAbate(abate: { matadorId: string; vitimaId: string }, local: Ponto, texto?: string) {
      const mat = champPorId.get(abate.matadorId);
      const vit = champPorId.get(abate.vitimaId);
      if (!est.foco.ativo) {
        est.foco = { ativo: true, local, ate: est.clock + 1.1, ids: new Set([abate.matadorId, abate.vitimaId]) };
      } else {
        est.foco.ids.add(abate.matadorId);
        est.foco.ids.add(abate.vitimaId);
      }
      if (mat) {
        mat.atacaAte = est.clock + 0.5;
        mat.estado = "ataca";
      }
      if (vit) {
        vit.estado = "morto";
        vit.morreuEm = est.clock;
        vit.hp = 0;
        particulas({ x: vit.x, y: vit.y }, vit.comb.time === "azul" ? COR.azul : COR.vermelho, 10, 0.09);
        est.efeitos.push({ tipo: "texto", x: vit.x, y: vit.y - 0.02, txt: "✕", cor: COR.branco, vida: 0.9, max: 0.9, tam: 9 });
      }
      if (abate.matadorId.startsWith("azul")) est.placar.azul++;
      else est.placar.vermelho++;
      est.ouro[abate.matadorId.startsWith("azul") ? "azul" : "vermelho"] += 300;
      flutuante(local, "ABATE!", COR.ouro, 7);
      narrar(texto ?? "Abate", abate.matadorId.startsWith("azul") ? "azul" : "vermelho");
      est.shake = Math.max(est.shake, 2.2);
    }

    function dist(c: { x: number; y: number }, p: Ponto): number {
      return Math.hypot(c.x - p.x, c.y - p.y);
    }
    function offset(idx: number, time: "azul" | "vermelho"): Ponto {
      const a = idx * 2.39996;
      const lado = time === "azul" ? -0.025 : 0.025;
      return { x: Math.cos(a) * 0.05 + lado, y: Math.sin(a) * 0.05 };
    }

    function atualizar(dt: number) {
      if (!est.fim) est.clock += dt;
      let mudou = false;

      // ouro passivo (farm/minions) + sync periódico do HUD
      if (!est.fim) {
        est.ouro.azul += dt * 1400;
        est.ouro.vermelho += dt * 1400;
        est.proxSync -= dt;
        if (est.proxSync <= 0) {
          est.proxSync = 0.5;
          mudou = true;
        }
      }

      // eventos
      while (est.idx < roteiro.eventos.length && roteiro.eventos[est.idx].t <= est.clock) {
        processar(roteiro.eventos[est.idx]);
        est.idx++;
        mudou = true;
      }
      if (est.foco.ativo && est.clock > est.foco.ate) est.foco.ativo = false;
      est.shake = Math.max(0, est.shake - dt * 6);

      // champs
      for (const c of est.champs) {
        if (c.estado === "morto") {
          if (est.clock - c.morreuEm > BATALHA.respawn) {
            c.estado = "idle";
            c.hp = 1;
            c.x = c.casa.x;
            c.y = c.casa.y;
            mudou = true;
          } else {
            continue;
          }
        }
        const participa = est.foco.ativo && est.foco.ids.has(c.comb.id);
        const off = participa ? offset(c.idx, c.comb.time) : { x: 0, y: 0 };
        const tx = participa ? est.foco.local.x + off.x : c.casa.x;
        const ty = participa ? est.foco.local.y + off.y : c.casa.y;
        const d = Math.hypot(tx - c.x, ty - c.y);
        c.x += (tx - c.x) * Math.min(1, dt * 3.2);
        c.y += (ty - c.y) * Math.min(1, dt * 3.2);
        if (Math.abs(tx - c.x) > 0.002) c.facing = tx > c.x ? 1 : -1;

        if (d > 0.012) c.estado = "move";
        else if (participa) {
          c.estado = est.clock < c.atacaAte ? "ataca" : "idle";
          // ataca inimigo próximo
          if (est.clock >= c.proxAtaque) {
            const alvo = vivos(c.comb.time === "azul" ? "vermelho" : "azul")
              .filter((o) => est.foco.ids.has(o.comb.id))
              .sort((a, b) => dist(a, c) - dist(b, c))[0];
            if (alvo) {
              c.proxAtaque = est.clock + 0.45 + Math.random() * 0.25;
              c.atacaAte = est.clock + 0.22;
              c.facing = alvo.x > c.x ? 1 : -1;
              const arq = arquetipoDe(c.comb.rota);
              const cor = c.comb.time === "azul" ? COR.azul : COR.vermelho;
              if (arq === "atirador" || arq === "mago") {
                est.efeitos.push({ tipo: "projetil", x: c.x, y: c.y - 0.012, tx: alvo.x, ty: alvo.y - 0.012, cor: arq === "mago" ? COR.barao : cor, vida: 0.3, max: 0.3 });
              } else {
                particulas({ x: (c.x + alvo.x) / 2, y: (c.y + alvo.y) / 2 - 0.01 }, COR.branco, 3, 0.05);
              }
              alvo.flash = 0.12;
            }
          }
        } else c.estado = "idle";
        c.flash = Math.max(0, c.flash - dt);
      }

      // minions
      est.proxWave -= dt;
      if (est.proxWave <= 0 && est.clock < roteiro.duracao - 4) {
        est.proxWave = 4;
        (["top", "mid", "bot"] as Lane[]).forEach((lane) => {
          for (let i = 0; i < 3; i++) {
            est.minions.push({ lane, time: "azul", prog: 0.12 + i * 0.02 });
            est.minions.push({ lane, time: "vermelho", prog: 0.88 - i * 0.02 });
          }
        });
      }
      est.minions = est.minions.filter((mi) => {
        mi.prog += (mi.time === "azul" ? 1 : -1) * dt * 0.05;
        return mi.prog > 0.42 && mi.prog < 0.58;
      });

      // CS (moedinhas perto de quem está na lane)
      est.proxCs -= dt;
      if (est.proxCs <= 0) {
        est.proxCs = 0.6;
        const c = vivos().filter((x) => !est.foco.ids.has(x.comb.id))[Math.floor(Math.random() * Math.max(1, vivos().length))];
        if (c) est.efeitos.push({ tipo: "moeda", x: c.x + (Math.random() - 0.5) * 0.04, y: c.y - 0.02, vy: -0.05, vida: 0.6, max: 0.6 });
      }

      // efeitos
      est.efeitos = est.efeitos.filter((f) => {
        f.vida -= dt;
        if (f.tipo === "part") {
          f.x += f.vx * dt * 6;
          f.y += f.vy * dt * 6;
          f.vy += dt * 0.25;
        } else if (f.tipo === "moeda") {
          f.y += f.vy * dt * 6;
          f.vy += dt * 0.3;
        } else if (f.tipo === "texto") {
          f.y -= dt * 0.03;
        }
        return f.vida > 0;
      });

      if (mudou) sincronizar();

      if (!est.fim && est.clock >= roteiro.duracao) {
        est.fim = true;
        setTerminou(true);
        fimRef.current();
      }
    }

    // ---------- desenho ----------
    function r(x: number, y: number, w: number, h: number, cor: string) {
      ctx!.fillStyle = cor;
      ctx!.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
    function texto(txt: string, x: number, y: number, cor: string, tam = 6, centro = false) {
      ctx!.fillStyle = cor;
      ctx!.font = `${tam}px ${familia}`;
      ctx!.textAlign = centro ? "center" : "left";
      ctx!.textBaseline = "top";
      ctx!.fillText(txt, Math.round(x), Math.round(y));
    }

    // ===== CENÁRIO ESTÁTICO — pré-renderizado UMA vez (jungle, rio, lanes, bases) =====
    // O rio corre na diagonal principal (y = x), separando o lado azul do vermelho e
    // passando pelos pits do Barão (alto) e Dragão (baixo) — como na Rift de verdade.
    const cena = document.createElement("canvas");
    cena.width = W;
    cena.height = H;
    {
      const c2 = cena.getContext("2d")!;
      c2.imageSmoothingEnabled = false;
      const rngC = criarRng(0x51f7);
      const rc = (x: number, y: number, w2: number, h2: number, cor: string) => {
        c2.fillStyle = cor;
        c2.fillRect(Math.round(x), Math.round(y), Math.round(w2), Math.round(h2));
      };
      const N = (x: number, y: number): [number, number] => [m + x * pfW, hud + m + y * pfH];

      const dSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
      };
      const dLane = (x: number, y: number) => {
        let d = 9;
        (["top", "mid", "bot"] as Lane[]).forEach((lane) => {
          const pts = LANES[lane];
          for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, dSeg(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
        });
        return d;
      };
      const wRio = (x: number, y: number) => {
        const s = (x + y) / 2; // posição ao longo da diagonal
        return 0.04 + Math.sin(s * Math.PI) * 0.02 + Math.sin(s * 21) * 0.007;
      };
      const noRio = (x: number, y: number) => {
        const s = (x + y) / 2;
        return Math.abs(y - x) / Math.SQRT2 < wRio(x, y) && s > 0.08 && s < 0.92;
      };
      const dBaseAzul = (x: number, y: number) => Math.hypot(x - 0.08, y - 0.92);
      const dBaseVerm = (x: number, y: number) => Math.hypot(x - 0.92, y - 0.08);

      // terreno célula a célula (2px) com dithering — mata fechada longe das rotas
      const passo = 2;
      for (let py = 0; py < H; py += passo) {
        for (let px2 = 0; px2 < W; px2 += passo) {
          const x = (px2 + 1 - m) / pfW;
          const y = (py + 1 - hud - m) / pfH;
          const par = ((px2 + py) / passo) % 4 === 0;
          let cor: string;
          if (x < -0.005 || x > 1.005 || y < -0.005 || y > 1.005) {
            cor = par ? COR.pedraEsc : COR.fundo; // muralha externa
          } else if (noRio(x, y)) {
            cor = par ? COR.agua2 : COR.agua;
          } else if (dBaseAzul(x, y) < 0.14) {
            cor = COR.baseAzul;
          } else if (dBaseVerm(x, y) < 0.14) {
            cor = COR.baseVermelha;
          } else {
            const dl = dLane(x, y);
            if (dl < 0.028) cor = COR.lane;
            else if (dl < 0.04) cor = COR.laneEsc;
            else if (dl > 0.085) cor = par ? COR.jungle2 : COR.jungle; // jungle
            else cor = par ? COR.terreno2 : COR.terreno;
          }
          rc(px2, py, passo, passo, cor);
        }
      }

      // linha central das lanes (trilha batida)
      c2.strokeStyle = COR.laneLinha;
      c2.lineWidth = 1;
      c2.setLineDash([3, 3]);
      (["top", "mid", "bot"] as Lane[]).forEach((lane) => {
        c2.beginPath();
        LANES[lane].forEach((p, i) => {
          const s = N(p[0], p[1]);
          if (i === 0) c2.moveTo(...s);
          else c2.lineTo(...s);
        });
        c2.stroke();
      });
      c2.setLineDash([]);

      // margem do rio (espuma clara)
      for (let i = 0; i < 60; i++) {
        const s = 0.1 + rngC() * 0.8;
        const lado = rngC() > 0.5 ? 1 : -1;
        const off = wRio(s, s) * Math.SQRT2 * lado;
        const [x, y] = N(s + off * 0.7, s - off * 0.7);
        rc(x, y, 1, 1, rngC() > 0.6 ? COR.aguaClara : COR.agua2);
      }

      // árvores e moitas na jungle (rejeição com PRNG seedado)
      let plantadas = 0;
      for (let tent = 0; tent < 700 && plantadas < 65; tent++) {
        const x = rngC();
        const y = rngC();
        if (noRio(x, y) || dLane(x, y) < 0.085 || dBaseAzul(x, y) < 0.17 || dBaseVerm(x, y) < 0.17) continue;
        const [px2, py] = N(x, y);
        if (rngC() > 0.35) {
          // pinheiro pixel
          rc(px2, py + 2, 1, 2, COR.tronco);
          rc(px2 - 2, py, 5, 2, COR.arvore);
          rc(px2 - 1, py - 2, 3, 2, COR.arvore);
          rc(px2, py - 3, 1, 1, COR.arvoreClara);
        } else {
          // moita
          rc(px2 - 2, py, 4, 2, COR.arvore);
          rc(px2 - 1, py - 1, 2, 1, COR.arvoreClara);
        }
        plantadas++;
      }

      // acampamentos de jungle (clareira + tocas) — espelhados nos dois lados do rio
      const camps: [number, number][] = [
        [0.3, 0.52],
        [0.18, 0.4],
        [0.48, 0.7],
        [0.7, 0.48],
        [0.82, 0.6],
        [0.52, 0.3],
      ];
      for (const [cx, cy] of camps) {
        const [x, y] = N(cx, cy);
        c2.fillStyle = "rgba(0,0,0,0.30)";
        c2.beginPath();
        c2.ellipse(x, y + 1, 6, 3, 0, 0, Math.PI * 2);
        c2.fill();
        rc(x - 4, y - 1, 2, 2, COR.pedra);
        rc(x + 3, y, 2, 2, COR.pedra);
      }

      // pits escavados (Barão em cima, Dragão embaixo)
      for (const [p, cor] of [
        [BATALHA.barao, COR.barao],
        [BATALHA.dragao, COR.dragao],
      ] as [Ponto, string][]) {
        const [x, y] = N(p.x, p.y);
        c2.fillStyle = "rgba(0,0,0,0.45)";
        c2.beginPath();
        c2.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
        c2.fill();
        c2.strokeStyle = COR.pedra;
        c2.lineWidth = 1;
        c2.beginPath();
        c2.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
        c2.stroke();
        rc(x - 9, y - 2, 2, 2, cor); // runa na borda do pit
        rc(x + 8, y + 1, 2, 2, cor);
      }

      // fontes das bases (poço com brilho do time)
      for (const [p, cor] of [
        [{ x: 0.05, y: 0.95 }, COR.azul],
        [{ x: 0.95, y: 0.05 }, COR.vermelho],
      ] as [Ponto, string][]) {
        const [x, y] = N(p.x, p.y);
        c2.fillStyle = "rgba(0,0,0,0.4)";
        c2.beginPath();
        c2.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2);
        c2.fill();
        rc(x - 2, y - 1, 4, 2, cor);
        rc(x - 1, y - 2, 2, 1, COR.branco);
      }

      // vinheta (escurece as bordas — foco no centro)
      const g = c2.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
      g.addColorStop(0, "rgba(11,6,23,0)");
      g.addColorStop(1, "rgba(11,6,23,0.5)");
      c2.fillStyle = g;
      c2.fillRect(0, 0, W, H);
    }

    function desenharMapa() {
      ctx!.drawImage(cena, 0, 0);

      // brilho animado do rio (cintilância determinística pelo relógio)
      for (let i = 0; i < 12; i++) {
        const s = 0.12 + i * 0.066;
        const off = Math.sin(i * 3.7) * 0.018;
        const a = 0.25 + 0.55 * Math.sin(est.clock * 1.8 + i * 1.9);
        if (a > 0.45) {
          const [x, y] = S({ x: s + off, y: s - off });
          ctx!.globalAlpha = Math.min(0.8, a);
          r(x, y, i % 3 === 0 ? 2 : 1, 1, COR.aguaClara);
          ctx!.globalAlpha = 1;
        }
      }

      // criaturas dos pits (somem quando o objetivo é tomado; renascem depois)
      if (est.clock >= est.pit.dragao) desenharDragao();
      if (est.clock >= est.pit.barao) desenharBarao();

      // torres
      for (const t of est.torres) {
        const [x, y] = S(t);
        const cc = corDe(t.time);
        if (t.viva) {
          ctx!.fillStyle = "rgba(0,0,0,0.35)";
          ctx!.beginPath();
          ctx!.ellipse(x, y + 2, 4.5, 1.6, 0, 0, Math.PI * 2);
          ctx!.fill();
          r(x - 3, y, 6, 2, COR.pedra); // base de pedra
          r(x - 2, y - 4, 4, 4, cc.escuro); // corpo
          r(x - 2, y - 4, 1, 4, COR.pedraEsc); // sombra lateral
          r(x - 1, y - 6, 2, 2, cc.corpo); // cristal
          if (Math.sin(est.clock * 3 + x * 0.7) > 0.55) r(x - 1, y - 7, 1, 1, COR.branco); // pulso
        } else {
          r(x - 3, y, 6, 2, COR.pedraEsc); // escombros
          r(x - 2, y - 1, 2, 1, COR.pedra);
          r(x + 1, y - 2, 1, 2, COR.pedra);
        }
      }

      // nexus
      desenharNexus(BATALHA.nexusAzul, "azul", est.nexus.azul);
      desenharNexus(BATALHA.nexusVermelho, "vermelho", est.nexus.vermelho);
    }

    function desenharDragao() {
      const [x, y0] = S(BATALHA.dragao);
      const y = y0 + Math.sin(est.clock * 2.2) * 0.8;
      const asa = Math.sin(est.clock * 5) > 0 ? 1 : 0;
      // brasas flutuando no pit
      if (Math.sin(est.clock * 3.1) > 0.3) r(x - 7, y + 1, 1, 1, COR.dragao);
      if (Math.sin(est.clock * 2.3 + 2) > 0.4) r(x + 7, y - 1, 1, 1, "#f2a35c");
      // cauda com espinho
      r(x - 7, y - 2, 3, 1, "#b3541e");
      r(x - 8, y - 3, 2, 1, "#f2a35c");
      // corpo
      r(x - 4, y - 4, 7, 4, COR.dragao);
      r(x - 4, y - 4, 7, 1, "#b3541e"); // dorso escuro
      r(x - 3, y - 1, 5, 1, "#f2a35c"); // barriga clara
      // asas batendo (2 frames)
      r(x - 3, y - 7 - asa, 4, 3, "#b3541e");
      r(x - 2, y - 8 - asa, 2, 1, "#f2a35c");
      // pescoço + cabeça com chifre
      r(x + 3, y - 6, 2, 3, COR.dragao);
      r(x + 4, y - 7, 3, 3, COR.dragao);
      r(x + 5, y - 8, 1, 1, "#b3541e"); // chifre
      r(x + 6, y - 6, 1, 1, COR.ouro); // olho brilhando
      // patas
      r(x - 3, y, 2, 1, "#b3541e");
      r(x + 1, y, 2, 1, "#b3541e");
      // baforada de fogo
      if (Math.sin(est.clock * 1.4) > 0.6) {
        r(x + 7, y - 6, 2, 1, COR.ouro);
        r(x + 9, y - 7, 1, 1, COR.branco);
      }
    }

    function desenharBarao() {
      const [x, y0] = S(BATALHA.barao);
      const y = y0 + Math.sin(est.clock * 1.6) * 0.7;
      const boca = Math.sin(est.clock * 3) > 0 ? 1 : 0;
      // aura arcana
      if (Math.sin(est.clock * 2.4) > 0.2) {
        r(x - 8, y - 3, 1, 1, "#c9adff");
        r(x + 7, y - 6, 1, 1, "#c9adff");
      }
      if (Math.sin(est.clock * 1.9 + 1) > 0.4) r(x - 6, y - 9, 1, 1, "#c9adff");
      // segmentos da cauda
      r(x - 7, y - 1, 3, 3, "#6b48b8");
      r(x - 5, y - 3, 4, 4, COR.barao);
      // torso erguido
      r(x - 1, y - 9, 4, 9, COR.barao);
      r(x - 1, y - 9, 1, 9, "#6b48b8"); // sombra lateral
      // espinhos das costas
      r(x - 2, y - 10, 1, 2, "#c9adff");
      r(x, y - 12, 1, 2, "#c9adff");
      r(x + 2, y - 11, 1, 2, "#c9adff");
      // cabeça + mandíbulas abrindo
      r(x + 1, y - 12, 3, 3, COR.barao);
      r(x + 3, y - 13, 2, 1 + boca, "#c9adff"); // mandíbula de cima
      r(x + 3, y - 9 + boca, 2, 1, "#c9adff"); // de baixo
      r(x + 2, y - 12, 1, 1, COR.branco); // olho
      r(x + 1, y - 10, 1, 1, COR.vermelho); // olho menor
    }

    function desenharNexus(p: Ponto, time: "azul" | "vermelho", vivo: boolean) {
      const [x, y] = S(p);
      if (!vivo) {
        r(x - 4, y - 1, 8, 3, COR.pedraEsc);
        r(x - 2, y - 2, 2, 1, COR.pedra);
        return;
      }
      const cc = corDe(time);
      ctx!.fillStyle = "rgba(0,0,0,0.4)";
      ctx!.beginPath();
      ctx!.ellipse(x, y + 2, 6, 2, 0, 0, Math.PI * 2);
      ctx!.fill();
      r(x - 4, y + 1, 8, 2, COR.pedraEsc); // plataforma
      const pulso = 1 + Math.sin(est.clock * 4) * 0.15;
      const s = 5 * pulso;
      ctx!.fillStyle = cc.escuro;
      ctx!.beginPath();
      ctx!.moveTo(x, y - s);
      ctx!.lineTo(x + s * 0.7, y);
      ctx!.lineTo(x, y + s * 0.6);
      ctx!.lineTo(x - s * 0.7, y);
      ctx!.closePath();
      ctx!.fill();
      const si = s - 2;
      ctx!.fillStyle = cc.corpo;
      ctx!.beginPath();
      ctx!.moveTo(x, y - si);
      ctx!.lineTo(x + si * 0.7, y);
      ctx!.lineTo(x, y + si * 0.6);
      ctx!.lineTo(x - si * 0.7, y);
      ctx!.closePath();
      ctx!.fill();
      r(x - 1, y - 1, 2, 2, COR.branco); // núcleo
      // energia orbitando
      const ang = est.clock * 2 + (time === "azul" ? 0 : Math.PI);
      r(x + Math.cos(ang) * 7, y + Math.sin(ang) * 3, 1, 1, cc.corpo);
    }

    function desenharMinions() {
      for (const mi of est.minions) {
        const [x, y] = S(pontoNaRota(LANES[mi.lane], mi.prog));
        const cor = mi.time === "azul" ? COR.azulEsc : COR.vermelhoEsc;
        r(x - 1, y - 2, 2, 2, cor);
        r(x - 1, y, 2, 1, "#000");
      }
    }

    function desenharChamp(c: ChampRT) {
      if (c.estado === "morto") return;
      const [x, yBase] = S(c);
      const cc = corDe(c.comb.time);
      const bob = c.estado === "idle" || c.estado === "ataca" ? Math.sin(est.clock * 6 + c.fase) * 0.6 : Math.sin(est.clock * 14 + c.fase) * 0.8;
      const lunge = c.estado === "ataca" ? c.facing * 1.5 : 0;
      const x0 = x + lunge;
      const y = yBase + bob;
      // sombra
      ctx!.fillStyle = "rgba(0,0,0,0.3)";
      ctx!.beginPath();
      ctx!.ellipse(x, yBase + 1, 4, 1.5, 0, 0, Math.PI * 2);
      ctx!.fill();
      // pernas
      r(x0 - 2, y - 2, 1, 2, "#1a1530");
      r(x0 + 1, y - 2, 1, 2, "#1a1530");
      // corpo
      const corCorpo = c.flash > 0 ? COR.branco : cc.corpo;
      r(x0 - 2, y - 6, 4, 4, corCorpo);
      r(x0 - 2, y - 6, 4, 1, cc.escuro);
      // arma por arquétipo
      const arq = arquetipoDe(c.comb.rota);
      const ax = x0 + c.facing * 3;
      if (arq === "lutador") {
        r(ax, y - 7, 1, 5, c.estado === "ataca" ? COR.branco : "#cfcfe6"); // espada
      } else if (arq === "atirador") {
        r(ax, y - 6, 1, 3, "#caa15a"); // arco
      } else if (arq === "mago") {
        r(ax, y - 8, 1, 6, "#7a5a2a");
        r(ax - 0.5, y - 9, 2, 2, c.estado === "ataca" ? COR.branco : COR.barao); // orbe
      } else {
        r(ax, y - 7, 2, 3, "#bfe6ff"); // escudo (suporte)
      }
      // RETRATO do campeão no lugar da cabeça (identifica cada rota no mapa)
      const img = retratos.get(c.comb.id);
      if (img && img.complete && img.naturalWidth > 0) {
        const corMoldura = c.flash > 0 ? COR.branco : c.comb.ehVoce ? COR.ouro : cc.corpo;
        r(x0 - 5, y - 16, 10, 10, corMoldura); // moldura (ouro = você)
        ctx!.drawImage(img, Math.round(x0 - 4), Math.round(y - 15), 8, 8);
        // barra de vida acima do retrato
        if (c.hp < 1) {
          r(x - 4, y - 18, 8, 1, "#3a1320");
          r(x - 4, y - 18, 8 * c.hp, 1, c.hp > 0.4 ? "#46d36a" : COR.vermelho);
        }
        if (c.comb.ehVoce) r(x - 1, y - 19, 2, 2, COR.ouro); // pip "você"
      } else {
        // fallback: cabeça genérica
        r(x0 - 2, y - 9, 4, 3, COR.pele);
        r(x0 + (c.facing > 0 ? 0 : -1), y - 8, 1, 1, "#221"); // olho
        if (c.hp < 1) {
          r(x - 3, y - 12, 6, 1, "#3a1320");
          r(x - 3, y - 12, 6 * c.hp, 1, c.hp > 0.4 ? "#46d36a" : COR.vermelho);
        }
        if (c.comb.ehVoce) {
          r(x - 1, y - 13, 2, 2, COR.ouro);
          r(x - 2, y - 12, 4, 1, COR.ouro);
        }
      }
    }

    function desenharEfeitos() {
      for (const f of est.efeitos) {
        const a = Math.max(0, f.vida / f.max);
        ctx!.globalAlpha = a;
        if (f.tipo === "part") {
          const [x, y] = S(f);
          r(x, y, 1.5, 1.5, f.cor);
        } else if (f.tipo === "moeda") {
          const [x, y] = S(f);
          r(x, y, 2, 2, COR.ouro);
        } else if (f.tipo === "texto") {
          const [x, y] = S(f);
          texto(f.txt, x, y, f.cor, f.tam, true);
        } else if (f.tipo === "projetil") {
          const p = 1 - f.vida / f.max;
          const [x, y] = S({ x: f.x + (f.tx - f.x) * p, y: f.y + (f.ty - f.y) * p });
          r(x - 1, y - 1, 2, 2, f.cor);
          r(x - 2 + p, y - 1, 1, 1, f.cor); // rastro
        } else if (f.tipo === "explosao") {
          const p = 1 - f.vida / f.max;
          const [x, y] = S(f);
          ctx!.strokeStyle = f.cor;
          ctx!.lineWidth = 1.5;
          ctx!.beginPath();
          ctx!.arc(x, y, f.raio * pfW * p, 0, Math.PI * 2);
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
      }
    }

    function desenharFim() {
      const venceu = roteiro.vitoria;
      r(0, hud, W, H - hud, "rgba(11,6,23,0.62)");
      texto(venceu ? "VITÓRIA" : "DERROTA", W / 2, H / 2 - 14, venceu ? COR.azul : COR.vermelho, 16, true);
      texto(`${est.placar.azul} - ${est.placar.vermelho}`, W / 2, H / 2 + 6, COR.texto, 8, true);
    }

    function desenhar() {
      ctx!.clearRect(0, 0, W, H);
      r(0, 0, W, H, COR.fundo);
      ctx!.save();
      if (est.shake > 0.05) ctx!.translate((Math.random() - 0.5) * est.shake, (Math.random() - 0.5) * est.shake);
      desenharMapa();
      desenharMinions();
      [...est.champs].sort((a, b) => a.y - b.y).forEach(desenharChamp);
      desenharEfeitos();
      ctx!.restore();
      if (est.fim) desenharFim();
    }

    // ---- loop ----
    let raf = 0;
    let ultimo = performance.now();
    function frame(now: number) {
      const dt = Math.min(0.05, (now - ultimo) / 1000) * velRef.current;
      ultimo = now;
      atualizar(dt);
      desenhar();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // pular: avança o relógio até o fim processando tudo
    (canvas as HTMLCanvasElement & { __pular?: () => void }).__pular = () => {
      est.clock = roteiro.duracao;
    };

    return () => cancelAnimationFrame(raf);
  }, [roteiro, iconePorId]);

  function pular() {
    const c = canvasRef.current as (HTMLCanvasElement & { __pular?: () => void }) | null;
    c?.__pular?.();
  }
  function alternarVel() {
    const nova = vel === 1 ? 2 : 1;
    setVel(nova);
    velRef.current = nova;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* HUD nítido em DOM (retratos reais + placar + tempo) */}
      <div className="flex items-center justify-between gap-1 border-2 border-borda bg-painel px-2 py-1.5">
        <div className="flex gap-1">
          {roster.azul.map((c) => (
            <Retrato key={c.id} icone={c.icone} ehVoce={c.ehVoce} morto={marcador.mortos.includes(c.id)} lado="azul" />
          ))}
        </div>
        <div className="flex shrink-0 flex-col items-center px-1">
          <div className="font-pixel text-base leading-none">
            <span className="text-ciano">{marcador.placar.azul}</span>
            <span className="px-1.5 text-suave">-</span>
            <span className="text-rosa">{marcador.placar.vermelho}</span>
          </div>
          <div className="mt-1 font-pixel text-[11px] text-suave">{`${marcador.minuto}:00`}</div>
          <div className="mt-0.5 font-pixel text-[9px] leading-none">
            <span className="text-amber-300">💰</span>{" "}
            <span className={marcador.ouro.azul >= marcador.ouro.vermelho ? "text-ciano" : "text-suave"}>
              {(marcador.ouro.azul / 1000).toFixed(1)}k
            </span>
            <span className="text-suave"> · </span>
            <span className={marcador.ouro.vermelho > marcador.ouro.azul ? "text-rosa" : "text-suave"}>
              {(marcador.ouro.vermelho / 1000).toFixed(1)}k
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {roster.vermelho.map((c) => (
            <Retrato key={c.id} icone={c.icone} ehVoce={c.ehVoce} morto={marcador.mortos.includes(c.id)} lado="vermelho" />
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={BATALHA.largura}
        height={BATALHA.altura}
        className="w-full border-2 border-borda bg-fundo"
        style={{ imageRendering: "pixelated", aspectRatio: `${BATALHA.largura}/${BATALHA.altura}` }}
      />

      <div ref={logRef} className="h-28 overflow-y-auto border-2 border-borda bg-painel p-2 text-xs leading-relaxed">
        {linhas.length === 0 ? (
          <p className="text-suave">A partida vai começar…</p>
        ) : (
          linhas.map((l, i) => (
            <p key={i} className={l.lado === "azul" ? "text-ciano" : l.lado === "vermelho" ? "text-rosa" : "text-suave"}>
              <span className="text-suave">{l.minuto}:00</span> · {l.txt}
            </p>
          ))
        )}
      </div>

      {!terminou && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={alternarVel}
            className="border-2 border-borda px-3 py-1 font-pixel text-[10px] text-suave transition hover:text-texto"
          >
            {vel}x
          </button>
          <button
            type="button"
            onClick={pular}
            className="border-2 border-borda px-3 py-1 font-pixel text-[10px] text-suave transition hover:text-texto"
          >
            PULAR ⏭
          </button>
        </div>
      )}
    </div>
  );
}

function Retrato({
  icone,
  ehVoce,
  morto,
  lado,
}: {
  icone?: string;
  ehVoce: boolean;
  morto: boolean;
  lado: "azul" | "vermelho";
}) {
  const borda = ehVoce ? "border-amber-300" : lado === "azul" ? "border-ciano" : "border-rosa";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`relative h-7 w-7 border-2 sm:h-9 sm:w-9 ${borda}`}>
        {icone ? (
          <img src={icone} alt="" className={`h-full w-full object-cover ${morto ? "opacity-40 grayscale" : ""}`} />
        ) : (
          <div className={`h-full w-full ${lado === "azul" ? "bg-ciano/30" : "bg-rosa/30"}`} />
        )}
        {ehVoce && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] leading-none text-amber-300">★</span>}
        {morto && <span className="absolute inset-0 flex items-center justify-center font-pixel text-[11px] text-rosa">✕</span>}
      </div>
      <div className="h-1 w-7 bg-rosa/30 sm:w-9">{!morto && <div className="h-full w-full bg-emerald-400" />}</div>
    </div>
  );
}
