"use client";

import { useEffect, useRef, useState } from "react";
import RetratoLenda from "@/components/RetratoLenda";
import { defSub, infoRaridade, modeloLenda } from "@/data/gacha";
import type { ResultadoPuxada } from "@/engine/gacha";

const W = 260;
const H = 130;

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  max: number;
  cor: string;
  tam: number;
}

export default function AnimacaoGacha({ resultados, onFechar }: { resultados: ResultadoPuxada[]; onFechar: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [revelado, setRevelado] = useState(false);
  const melhor = Math.max(...resultados.map((r) => r.raridade));
  const cor = infoRaridade(melhor).cor;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const cx = W / 2;
    const cy = H / 2;
    const parts: Part[] = [];
    let explodiu = false;
    let raf = 0;
    const inicio = performance.now();
    let ultimo = inicio;
    const r = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const corDe = (i: number) => (melhor >= 5 ? ["#ff2d7e", "#ffd34d", "#19e6e0"][i % 3] : cor);

    function frame(now: number) {
      const dt = Math.min(0.05, (now - ultimo) / 1000);
      ultimo = now;
      const clock = (now - inicio) / 1000;
      const carga = Math.min(clock / 1.1, 1);
      const burst = Math.max(0, Math.min((clock - 1.1) / 0.6, 1));

      ctx!.clearRect(0, 0, W, H);
      r(0, 0, W, H, "#0b0617");

      // raios convergindo
      ctx!.globalAlpha = 0.5 + carga * 0.5;
      ctx!.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const a = i * (Math.PI * 2 / 14) + clock * 1.5;
        const rOut = 100 - carga * 40;
        const rIn = 14 + (1 - carga) * 30;
        ctx!.strokeStyle = corDe(i);
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut * 0.7);
        ctx!.lineTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn * 0.7);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      // orbe pulsante
      const orb = 4 + carga * 9 + Math.sin(clock * 18) * 1.5;
      ctx!.fillStyle = cor;
      ctx!.beginPath();
      ctx!.arc(cx, cy, orb, 0, Math.PI * 2);
      ctx!.fill();
      r(cx - 1, cy - 1, 2, 2, "#fff7ff");

      // estouro
      if (clock > 1.1) {
        if (!explodiu) {
          explodiu = true;
          setRevelado(true);
          for (let i = 0; i < 60; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = 30 + Math.random() * 90;
            parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vida: 1.1, max: 1.1, cor: corDe(i), tam: Math.random() < 0.4 ? 3 : 2 });
          }
        }
        const n = melhor >= 5 ? 5 : 3;
        for (let k = 0; k < n; k++) {
          ctx!.globalAlpha = Math.max(0, 1 - burst);
          ctx!.strokeStyle = corDe(k);
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(cx, cy, burst * (k * 26 + 24), 0, Math.PI * 2);
          ctx!.stroke();
        }
        // flash
        ctx!.globalAlpha = Math.max(0, (1 - burst) * 0.7);
        r(0, 0, W, H, "#fff7ff");
        ctx!.globalAlpha = 1;
      }

      // partículas
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vida -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
        if (p.vida <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx!.globalAlpha = Math.max(0, p.vida / p.max);
        r(p.x, p.y, p.tam, p.tam, p.cor);
        ctx!.globalAlpha = 1;
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [resultados, melhor, cor]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/90 p-4" onClick={onFechar}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto border-2 bg-painel p-4"
        style={{ borderColor: cor }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center font-pixel text-[10px]" style={{ color: cor }}>
          SCOUT · {resultados.length}× PUXADA
        </p>
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="w-full border-2 border-borda bg-fundo"
          style={{ imageRendering: "pixelated", aspectRatio: `${W}/${H}` }}
        />

        {revelado && (
          <div className={`grid gap-2 ${resultados.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
            {resultados.map((res, i) => {
              const m = modeloLenda(res.id);
              const info = infoRaridade(res.raridade);
              return (
                <div
                  key={i}
                  className={`overflow-hidden border-2 bg-fundo/40 ${res.raridade === 6 ? "carta-mitica" : ""}`}
                  style={{ borderColor: info.cor }}
                >
                  <div className="relative">
                    {m ? (
                      <RetratoLenda tema={m.tema} cor={info.cor} paleta={m.paleta} className="block aspect-[8/9] w-full" />
                    ) : (
                      <div className="aspect-[8/9] w-full bg-fundo" />
                    )}
                    <span className="absolute left-1 top-1 font-pixel text-[8px]" style={{ color: info.cor }}>
                      {"★".repeat(res.raridade)}
                    </span>
                    {res.novo ? (
                      <span className="absolute right-1 top-1 bg-amber-300 px-1 text-[7px] font-bold text-fundo">NOVO</span>
                    ) : (
                      <span className="absolute right-1 top-1 bg-painel px-1 text-[7px] text-suave">Nv.{res.nivel}</span>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="truncate text-[11px] text-texto">{m?.nome ?? res.id}</p>
                    <p className="truncate text-[8px] text-suave">{m?.titulo}</p>
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {res.substats.map((s, j) => (
                        <span key={j} className="border border-borda px-0.5 text-[7px] text-ciano">
                          {defSub(s.chave)?.rotulo ?? s.chave}+{s.valor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onFechar}
          className="mt-1 w-full border-2 py-2 font-pixel text-[10px] transition"
          style={{ borderColor: cor, color: cor }}
        >
          {revelado ? "CONTINUAR" : "..."}
        </button>
      </div>
    </div>
  );
}
