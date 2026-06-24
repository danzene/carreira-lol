"use client";

import { useEffect, useRef, useState } from "react";
import { BATALHA, LANES, type Lane, type Ponto, pontoNaRota, posicaoCasa } from "@/data/batalha";
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
  rio: "#1d5f7e",
  lane: "#5c4d2e",
  grama: "#122c1c",
  ouro: "#ffd34d",
  texto: "#ece8ff",
  suave: "#9a90c0",
  dragao: "#e8762b",
  barao: "#9a6bff",
  branco: "#fff7ff",
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
  minuto: number;
  clock: number;
  idx: number;
  shake: number;
  proxWave: number;
  proxCs: number;
  foco: { ativo: boolean; local: Ponto; ate: number; ids: Set<string> };
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
    const hud = BATALHA.hud;
    const m = 8;
    const pfW = W - 2 * m;
    const pfH = H - hud - 2 * m;
    const S = (n: Ponto): [number, number] => [m + n.x * pfW, hud + m + n.y * pfH];

    // ---- preload de ícones (retratos) ----
    const imgs = new Map<string, HTMLImageElement>();
    for (const [id, url] of Object.entries(iconePorId)) {
      if (!url) continue;
      const im = new Image();
      im.src = url;
      imgs.set(id, im);
    }

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
      minuto: 0,
      clock: 0,
      idx: 0,
      shake: 0,
      proxWave: 0,
      proxCs: 0,
      foco: { ativo: false, local: { x: 0.5, y: 0.5 }, ate: 0, ids: new Set() },
      fim: false,
    };

    const champPorId = new Map(est.champs.map((c) => [c.comb.id, c]));
    const vivos = (time?: "azul" | "vermelho") =>
      est.champs.filter((c) => c.estado !== "morto" && (!time || c.comb.time === time));

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
          const cor = ev.objetivo === "barao" ? COR.barao : COR.dragao;
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

      // eventos
      while (est.idx < roteiro.eventos.length && roteiro.eventos[est.idx].t <= est.clock) {
        processar(roteiro.eventos[est.idx]);
        est.idx++;
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

    function desenharMapa() {
      // gramado base
      r(0, hud, W, H - hud, COR.fundo);
      // bases (triângulos de canto)
      ctx!.fillStyle = "rgba(25,230,224,0.10)";
      ctx!.beginPath();
      ctx!.moveTo(...S({ x: 0, y: 0.55 }));
      ctx!.lineTo(...S({ x: 0.45, y: 1 }));
      ctx!.lineTo(...S({ x: 0, y: 1 }));
      ctx!.closePath();
      ctx!.fill();
      ctx!.fillStyle = "rgba(255,45,126,0.10)";
      ctx!.beginPath();
      ctx!.moveTo(...S({ x: 1, y: 0.45 }));
      ctx!.lineTo(...S({ x: 0.55, y: 0 }));
      ctx!.lineTo(...S({ x: 1, y: 0 }));
      ctx!.closePath();
      ctx!.fill();
      // rio (faixa diagonal)
      const w = 0.1;
      ctx!.fillStyle = "rgba(29,95,126,0.55)";
      ctx!.beginPath();
      ctx!.moveTo(...S({ x: 0, y: 1 - w }));
      ctx!.lineTo(...S({ x: 1 - w, y: 0 }));
      ctx!.lineTo(...S({ x: 1, y: w }));
      ctx!.lineTo(...S({ x: w, y: 1 }));
      ctx!.closePath();
      ctx!.fill();
      // lanes
      ctx!.strokeStyle = "rgba(92,77,46,0.7)";
      ctx!.lineWidth = 5;
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";
      (["top", "mid", "bot"] as Lane[]).forEach((lane) => {
        ctx!.beginPath();
        LANES[lane].forEach((p, i) => {
          const s = S({ x: p[0], y: p[1] });
          if (i === 0) ctx!.moveTo(...s);
          else ctx!.lineTo(...s);
        });
        ctx!.stroke();
      });
      // pits
      const dr = S(BATALHA.dragao);
      r(dr[0] - 5, dr[1] - 5, 10, 10, "rgba(232,118,43,0.25)");
      const ba = S(BATALHA.barao);
      r(ba[0] - 5, ba[1] - 5, 10, 10, "rgba(154,107,255,0.25)");
      // torres
      for (const t of est.torres) {
        const [x, y] = S(t);
        const cc = corDe(t.time);
        if (t.viva) {
          r(x - 2, y - 2, 4, 6, cc.escuro);
          r(x - 2, y - 4, 4, 3, cc.corpo);
          r(x - 1, y - 5, 2, 1, COR.branco);
        } else {
          r(x - 2, y, 4, 2, "#3a3550");
          r(x - 1, y - 1, 2, 1, "#2a2540");
        }
      }
      // nexus
      desenharNexus(BATALHA.nexusAzul, "azul", est.nexus.azul);
      desenharNexus(BATALHA.nexusVermelho, "vermelho", est.nexus.vermelho);
    }

    function desenharNexus(p: Ponto, time: "azul" | "vermelho", vivo: boolean) {
      const [x, y] = S(p);
      if (!vivo) {
        r(x - 4, y - 1, 8, 3, "#2a2540");
        return;
      }
      const cc = corDe(time);
      const pulso = 1 + Math.sin(est.clock * 4) * 0.15;
      const s = 4 * pulso;
      ctx!.fillStyle = cc.escuro;
      ctx!.beginPath();
      ctx!.moveTo(x, y - s);
      ctx!.lineTo(x + s, y);
      ctx!.lineTo(x, y + s);
      ctx!.lineTo(x - s, y);
      ctx!.closePath();
      ctx!.fill();
      r(x - 1, y - 1, 2, 2, COR.branco);
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
      // cabeça
      r(x0 - 2, y - 9, 4, 3, COR.pele);
      r(x0 + (c.facing > 0 ? 0 : -1), y - 8, 1, 1, "#221"); // olho
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
      // barra de vida
      if (c.hp < 1) {
        r(x - 3, y - 12, 6, 1, "#3a1320");
        r(x - 3, y - 12, 6 * c.hp, 1, c.hp > 0.4 ? "#46d36a" : COR.vermelho);
      }
      // estrela (você)
      if (c.comb.ehVoce) {
        r(x - 1, y - 13, 2, 2, COR.ouro);
        r(x - 2, y - 12, 4, 1, COR.ouro);
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

    function desenharHUD() {
      r(0, 0, W, hud, COR.painel);
      r(0, hud - 1, W, 1, COR.borda);
      const azuis = est.champs.filter((c) => c.comb.time === "azul");
      const verms = est.champs.filter((c) => c.comb.time === "vermelho");
      azuis.forEach((c, i) => retrato(c, 4 + i * 17, 3));
      verms.forEach((c, i) => retrato(c, W - 19 - i * 17, 3));
      // placar + tempo
      texto(`${est.placar.azul}`, W / 2 - 14, 6, COR.azul, 9, true);
      texto("-", W / 2, 6, COR.suave, 9, true);
      texto(`${est.placar.vermelho}`, W / 2 + 14, 6, COR.vermelho, 9, true);
      texto(`${est.minuto}:00`, W / 2, 18, COR.texto, 6, true);
    }

    function retrato(c: ChampRT, x: number, y: number) {
      const im = imgs.get(c.comb.id);
      const cc = corDe(c.comb.time);
      if (im && im.complete && im.naturalWidth > 0) ctx!.drawImage(im, x, y, 15, 15);
      else r(x, y, 15, 15, cc.escuro);
      // borda
      ctx!.strokeStyle = c.comb.ehVoce ? COR.ouro : cc.corpo;
      ctx!.lineWidth = 1;
      ctx!.strokeRect(x + 0.5, y + 0.5, 14, 14);
      if (c.estado === "morto") {
        r(x, y, 15, 15, "rgba(0,0,0,0.55)");
        texto("✕", x + 7.5, y + 4, COR.vermelho, 8, true);
      }
      // vida
      r(x, y + 16, 15, 2, "#2a1320");
      r(x, y + 16, 15 * c.hp, 2, c.hp > 0.4 ? "#46d36a" : COR.vermelho);
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
      desenharHUD();
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
              <span className="text-borda">{l.minuto}:00</span> · {l.txt}
            </p>
          ))
        )}
      </div>

      {!terminou && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={alternarVel}
            className="border-2 border-borda px-3 py-1 font-pixel text-[9px] text-suave transition hover:text-texto"
          >
            {vel}x
          </button>
          <button
            type="button"
            onClick={pular}
            className="border-2 border-borda px-3 py-1 font-pixel text-[9px] text-suave transition hover:text-texto"
          >
            PULAR ⏭
          </button>
        </div>
      )}
    </div>
  );
}
