"use client";

import { useEffect, useRef } from "react";
import { criarRng } from "@/engine/rng";

// 💥 Explosão de partículas pixel num canvas pequeno (cosmético). Usa o PRNG seedado do
// engine (regra: nada de Math.random fora do sistema de seed) — seed default fixa; a
// variação visual vem do timestamp passado por quem monta, se quiser.

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  cor: string;
  tam: number;
  vida: number;
}

export default function PixelBurst({
  cores = ["#ff2d7e", "#19e6e0", "#ffe14d"],
  qtd = 26,
  seed = 7,
  tamanho = 160,
  className,
}: {
  cores?: string[];
  qtd?: number;
  seed?: number;
  tamanho?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rng = criarRng(seed >>> 0);
    const meio = tamanho / 2;
    const parts: Particula[] = Array.from({ length: qtd }, () => {
      const ang = rng() * Math.PI * 2;
      const forca = 1.2 + rng() * 2.6;
      return {
        x: meio,
        y: meio,
        vx: Math.cos(ang) * forca,
        vy: Math.sin(ang) * forca - 1.2,
        cor: cores[Math.floor(rng() * cores.length)],
        tam: 2 + Math.floor(rng() * 3),
        vida: 1,
      };
    });

    let raf = 0;
    let vivo = true;
    const passo = () => {
      if (!vivo) return;
      ctx.clearRect(0, 0, tamanho, tamanho);
      let restam = 0;
      for (const p of parts) {
        if (p.vida <= 0) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravidade
        p.vida -= 0.02;
        if (p.vida > 0) {
          restam++;
          ctx.globalAlpha = Math.max(0, p.vida);
          ctx.fillStyle = p.cor;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
        }
      }
      ctx.globalAlpha = 1;
      if (restam > 0) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
    };
  }, [cores, qtd, seed, tamanho]);

  return (
    <canvas
      ref={ref}
      width={tamanho}
      height={tamanho}
      className={`pointer-events-none ${className ?? ""}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
