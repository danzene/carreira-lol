"use client";

import { useEffect, useRef, useState } from "react";

export type TipoAcao = "treino" | "especial" | "stream" | "mental";

const COR = {
  fundo: "#0b0617",
  chao: "#0e0a1f",
  painel: "#15102a",
  borda: "#2a2150",
  rosa: "#ff2d7e",
  ciano: "#19e6e0",
  cianoEsc: "#0e6f7a",
  pele: "#e8c39e",
  cabelo: "#3a2a4a",
  ouro: "#ffd34d",
  fogo: "#e8762b",
  fogoClaro: "#ffd34d",
  roxo: "#9a6bff",
  branco: "#fff7ff",
  movel: "#1a1530",
  suave: "#9a90c0",
};

const ACENTO: Record<TipoAcao, string> = {
  treino: COR.ciano,
  especial: COR.fogo,
  stream: COR.rosa,
  mental: COR.roxo,
};

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  cor: string;
  tam: number;
  grav: number;
}

const W = 224;
const H = 140;
const DUR = 2.6;

export default function AnimacaoAcao({
  tipo,
  titulo,
  legenda,
  onFechar,
}: {
  tipo: TipoAcao;
  titulo: string;
  legenda: string;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  const acento = ACENTO[tipo];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const parts: Part[] = [];
    let estourou = false;

    const r = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const anel = (x: number, y: number, raio: number, c: string, lw = 1) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(x, y, raio, 0, Math.PI * 2);
      ctx.stroke();
    };
    const faisca = (x: number, y: number, cor: string, n: number, forca: number, grav = 60) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * forca;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, vida: 0.6, max: 0.6, cor, tam: Math.random() < 0.4 ? 2 : 1, grav });
      }
    };

    // cabeça + tronco de um boneco pixel
    const boneco = (cx: number, topo: number, corCorpo: string, frente: boolean, olhosFechados = false) => {
      r(cx - 5, topo - 2, 10, 3, COR.cabelo); // cabelo
      r(cx - 5, topo, 10, 8, COR.pele); // cabeça
      if (olhosFechados) {
        r(cx - 3, topo + 4, 2, 1, "#221");
        r(cx + 1, topo + 4, 2, 1, "#221");
      } else if (frente) {
        r(cx - 3, topo + 4, 2, 2, "#221");
        r(cx + 1, topo + 4, 2, 2, "#221");
      } else {
        r(cx + 1, topo + 4, 2, 2, "#221");
      }
      r(cx - 6, topo + 8, 12, 11, corCorpo); // tronco
      r(cx - 6, topo + 8, 12, 2, "#00000033"); // gola
    };

    function cenaTreino(clock: number, prog: number, intenso: boolean) {
      const corA = intenso ? COR.fogo : COR.ciano;
      r(0, H - 20, W, 20, COR.chao);

      const deskY = H - 40;
      const cx = W / 2 + 6;
      const headY = deskY - 28 + Math.sin(clock * 4) * 0.8;

      // monitor
      const mx = cx - 54;
      const my = deskY - 40;
      r(mx - 2, my - 2, 46, 34, "#000");
      r(mx, my, 42, 30, intenso ? "#2a1206" : "#05121b");
      // gameplay piscando na tela
      for (let i = 0; i < 7; i++) {
        const gx = mx + 3 + Math.floor((Math.sin(clock * 7 + i * 1.3) * 0.5 + 0.5) * 36);
        const gy = my + 3 + ((i * 5 + Math.floor(clock * 34)) % 24);
        r(gx, gy, 2, 2, i % 3 === 0 ? corA : i % 3 === 1 ? COR.rosa : COR.ciano);
      }
      r(mx + 17, my + 32, 8, 4, COR.movel); // pé do monitor

      // mesa
      r(cx - 64, deskY, 88, 6, COR.borda);
      r(cx - 60, deskY + 6, 5, 26, COR.movel);
      r(cx + 16, deskY + 6, 5, 26, COR.movel);

      // jogador atrás da mesa
      boneco(cx, headY, corA, false);
      // braço/teclado
      r(cx - 16, deskY - 4, 22, 3, COR.movel); // teclado
      const digit = Math.sin(clock * 18) > 0 ? 1 : 0;
      r(cx - 8, deskY - 6 - digit, 3, 3, COR.pele); // mão batendo
      // mouse + cliques
      r(cx + 10, deskY - 3, 4, 3, COR.movel);
      if (Math.random() < (intenso ? 0.5 : 0.3)) faisca(cx + 12, deskY - 3, corA, 2, 50);

      // suor ocasional
      if (Math.sin(clock * 2) > 0.96) parts.push({ x: cx + 5, y: headY + 2, vx: 6, vy: 10, vida: 0.5, max: 0.5, cor: COR.ciano, tam: 1, grav: 120 });

      // fogo no especial
      if (intenso && Math.random() < 0.6) {
        parts.push({ x: cx + (Math.random() - 0.5) * 16, y: deskY - 6, vx: (Math.random() - 0.5) * 6, vy: -28 - Math.random() * 14, vida: 0.7, max: 0.7, cor: Math.random() < 0.5 ? COR.fogo : COR.fogoClaro, tam: Math.random() < 0.5 ? 2 : 1, grav: -10 });
      }

      // barra de skill enchendo
      const bx = W - 16;
      const bh = 84;
      const by = (H - bh) / 2 - 4;
      r(bx, by, 8, bh, COR.movel);
      r(bx, by + bh - bh * prog, 8, bh * prog, corA);
      r(bx - 1, by - 1, 10, 1, COR.borda);
      anel(bx + 4, by + bh - bh * prog, 5 + Math.sin(clock * 8) * 1.5, corA, 1);

      if (prog >= 1 && !estourou) {
        estourou = true;
        faisca(bx + 4, by, corA, 16, 90);
        faisca(cx, headY, corA, 10, 70);
      }
    }

    function cenaStream(clock: number, prog: number) {
      r(0, H - 20, W, 20, COR.chao);
      const cx = W / 2 - 24;
      const headY = 46 + Math.sin(clock * 3) * 1;

      // monitor de fundo
      r(cx - 26, headY - 10, 52, 44, "#000");
      r(cx - 24, headY - 8, 48, 40, "#06121b");

      // jogador de frente
      boneco(cx, headY, COR.rosa, true);
      // webcam (anel piscando) + 🔴 LIVE
      anel(cx, headY + 3, 14 + Math.sin(clock * 6) * 1, COR.rosa, 1);
      const liveOn = Math.floor(clock * 2) % 2 === 0;
      if (liveOn) r(cx - 13, headY - 14, 4, 4, COR.rosa);
      r(cx - 7, headY - 14, 14, 4, COR.movel); // "LIVE" placa

      // chat subindo (lado direito)
      for (let i = 0; i < 6; i++) {
        const yy = H - 24 - (((clock * 26 + i * 22) % (H + 10)) - 10);
        if (yy < 4 || yy > H - 14) continue;
        const w = 26 + ((i * 7) % 18);
        const cor = i % 3 === 0 ? COR.ciano : i % 3 === 1 ? COR.suave : COR.rosa;
        r(W - 8 - w, yy, w, 6, COR.movel);
        r(W - 8 - w, yy, 3, 6, cor);
      }

      // cofrinho (+$) embaixo à esquerda
      const jx = 26;
      const jy = H - 30;
      r(jx, jy, 26, 18, COR.movel);
      r(jx + 8, jy - 3, 10, 3, COR.movel);
      const ench = 14 * prog;
      r(jx + 2, jy + 16 - ench, 22, ench, COR.ouro);

      // moedas/corações voando da direita pro cofrinho
      if (Math.random() < 0.35) {
        const coracao = Math.random() < 0.4;
        parts.push({ x: W - 10, y: 20 + Math.random() * 60, vx: -70 - Math.random() * 30, vy: 10, vida: 1.1, max: 1.1, cor: coracao ? COR.rosa : COR.ouro, tam: 2, grav: 40 });
      }

      if (prog >= 1 && !estourou) {
        estourou = true;
        for (let i = 0; i < 14; i++) parts.push({ x: jx + 13, y: jy, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 40, vida: 0.9, max: 0.9, cor: COR.ouro, tam: 2, grav: 120 });
      }
    }

    function cenaMental(clock: number, prog: number) {
      r(0, H - 20, W, 20, COR.chao);
      const cx = W / 2;
      const baseY = H - 34;
      const flut = Math.sin(clock * 2) * 2;

      // aura pulsante
      for (let i = 0; i < 3; i++) {
        const fase = (clock * 0.6 + i / 3) % 1;
        anel(cx, baseY - 4, 8 + fase * 46, COR.roxo, 1);
      }

      // meditando (pernas cruzadas) — base larga
      r(cx - 12, baseY, 24, 4, COR.roxo); // perna/base
      boneco(cx, baseY - 22 + flut, COR.roxo, true, true); // olhos fechados

      // partículas de pensamento orbitando a cabeça
      for (let i = 0; i < 5; i++) {
        const a = clock * 1.6 + (i / 5) * Math.PI * 2;
        const rOrb = 18;
        r(cx + Math.cos(a) * rOrb, baseY - 30 + flut + Math.sin(a) * 8, 2, 2, i % 2 ? COR.rosa : COR.branco);
      }

      // lâmpada/ideia acendendo acima
      const ly = 30 + flut;
      const aceso = prog > 0.6;
      r(cx - 4, ly, 8, 8, aceso ? COR.ouro : COR.movel); // bulbo
      r(cx - 2, ly + 8, 4, 3, COR.movel); // base
      if (aceso) {
        anel(cx, ly + 4, 9 + Math.sin(clock * 10) * 2, COR.ouro, 1);
        if (Math.random() < 0.4) faisca(cx, ly + 4, COR.ouro, 2, 40, 0);
      }

      if (prog >= 1 && !estourou) {
        estourou = true;
        faisca(cx, ly + 4, COR.ouro, 18, 100, 30);
        for (let i = 0; i < 3; i++) anel(cx, baseY - 10, 10 + i * 8, COR.roxo, 2);
      }
    }

    let raf = 0;
    const inicio = performance.now();
    let ultimo = inicio;

    function frame(now: number) {
      const dt = Math.min(0.05, (now - ultimo) / 1000);
      ultimo = now;
      const clock = (now - inicio) / 1000;
      const prog = Math.min(clock / DUR, 1);
      if (clock >= DUR && !pronto) setPronto(true);

      ctx!.clearRect(0, 0, W, H);
      r(0, 0, W, H, COR.fundo);
      // vinheta de teto
      r(0, 0, W, 6, COR.painel);

      const shake = tipo === "especial" && prog < 1 ? (Math.random() - 0.5) * 2 : 0;
      ctx!.save();
      ctx!.translate(shake, shake);

      if (tipo === "treino") cenaTreino(clock, prog, false);
      else if (tipo === "especial") cenaTreino(clock, prog, true);
      else if (tipo === "stream") cenaStream(clock, prog);
      else cenaMental(clock, prog);

      // partículas
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vida -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.grav * dt;
        if (p.vida <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx!.globalAlpha = Math.max(0, p.vida / p.max);
        r(p.x, p.y, p.tam, p.tam, p.cor);
        ctx!.globalAlpha = 1;
      }

      ctx!.restore();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/85 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-md border-2 bg-painel p-4"
        style={{ borderColor: acento }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-center font-pixel text-[11px]" style={{ color: acento }}>
          {titulo}
        </p>
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="w-full border-2 border-borda bg-fundo"
          style={{ imageRendering: "pixelated", aspectRatio: `${W}/${H}` }}
        />
        <p className="mt-2 text-center text-sm text-texto">{legenda}</p>
        <button
          type="button"
          onClick={onFechar}
          className="mt-3 w-full border-2 py-2 font-pixel text-[10px] transition"
          style={{ borderColor: acento, color: acento }}
        >
          {pronto ? "CONTINUAR" : "PULAR"}
        </button>
      </div>
    </div>
  );
}
