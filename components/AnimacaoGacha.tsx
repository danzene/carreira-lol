"use client";

import { useEffect, useRef, useState } from "react";
import { tierDeLenda } from "@/data/juice";
import { tocarSom, tocarSomTier } from "@/lib/som";
import AnimatedBar from "@/components/juice/AnimatedBar";

export interface CartaRevelada {
  raridade: number;
  cor: string;
  cartaImg?: string; // arte 2:3 completa (lendas — moldura já embutida)
  icone?: string; // ícone quadrado (campeões)
  nome: string;
  subtitulo?: string;
  badge?: string;
  substats?: { rotulo: string; valor: number }[];
  holo?: boolean;
  mitica?: boolean;
}

const W = 280;
const H = 150;
const TAU = Math.PI * 2;
const T_CONV = 0.45;
const T_PULSE = 0.78;
const T_QUEBRA = 0.52; // fake-out: momento em que a raridade "quebra" pra real (5★+)
const T_BURST = 0.78;

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
  trail?: boolean;
  px?: number;
  py?: number;
}

function paletaRaridade(r: number) {
  if (r >= 6) return { base: "#ffe14d", sec: "#ff2d7e", ter: "#19e6e0", swirl: true, squares: true, stars: true };
  if (r >= 5) return { base: "#ff2d7e", sec: "#19e6e0", ter: "#ffd34d", swirl: true, squares: false, stars: true };
  if (r >= 4) return { base: "#ffd34d", sec: "#ffe7a0", ter: "#fff7ff", swirl: false, squares: false, stars: true };
  return { base: "#cfd2e6", sec: "#9a90c0", ter: "#fff7ff", swirl: false, squares: false, stars: false };
}

export default function AnimacaoGacha({
  cartas,
  onFechar,
  pity,
}: {
  cartas: CartaRevelada[];
  onFechar: () => void;
  pity?: { antes: number; depois: number; max: number }; // barra de pity animada pós-reveal
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [revelado, setRevelado] = useState(false);
  const melhorCarta = cartas.reduce((a, b) => (b.raridade > a.raridade ? b : a), cartas[0]);
  const melhor = melhorCarta?.raridade ?? 3;
  const cor = melhorCarta?.cor ?? "#9a90c0";
  const unica = cartas.length === 1;
  // 10x: revela em ordem de raridade crescente — a melhor carta SEMPRE por último
  const ordenadas = unica ? cartas : [...cartas].sort((a, b) => a.raridade - b.raridade);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    // FAKE-OUT (estilo meteoro dourado): 5★+ começa com cara de comum e "quebra" no meio
    const fake = melhor >= 5;
    let pal = paletaRaridade(fake ? 3 : melhor);
    let quebrou = !fake;
    let tQuebra = -1;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = 150;
    const parts: Part[] = [];
    let estourou = false;
    let raf = 0;
    const inicio = performance.now();
    let ultimo = inicio;

    const r = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const anel = (x: number, y: number, raio: number, c: string, lw = 1) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(x, y, raio, raio * 0.72, 0, 0, TAU);
      ctx.stroke();
    };
    const estrela = (x: number, y: number, t: number, c: string) => {
      r(x - t, y, t * 2 + 1, 1, c);
      r(x, y - t, 1, t * 2 + 1, c);
      const d = Math.max(1, Math.floor(t / 2));
      r(x - d, y - d, d, d, c);
      r(x + 1, y - d, d, d, c);
      r(x - d, y + 1, d, d, c);
      r(x + 1, y + 1, d, d, c);
      r(x, y, 1, 1, "#fff7ff");
    };

    function frame(now: number) {
      const dt = Math.min(0.05, (now - ultimo) / 1000);
      ultimo = now;
      const clock = (now - inicio) / 1000;

      ctx!.clearRect(0, 0, W, H);
      r(0, 0, W, H, "#0b0617");

      // ===== FAKE-OUT: a animação "quebra" e revela a raridade real =====
      if (!quebrou && clock >= T_QUEBRA) {
        quebrou = true;
        tQuebra = clock;
        pal = paletaRaridade(melhor);
        tocarSom("tick");
      }
      if (tQuebra >= 0 && clock - tQuebra < 0.22) {
        ctx!.globalAlpha = Math.max(0, 1 - (clock - tQuebra) / 0.22) * 0.9;
        r(0, 0, W, H, "#fff7ff");
        ctx!.globalAlpha = 1;
      }

      // ===== FASE 1 — CONVERGÊNCIA =====
      const convP = Math.min(clock / T_CONV, 1);
      if (clock < T_PULSE) {
        ctx!.globalAlpha = 0.5 + convP * 0.5;
        for (let i = 0; i < 20; i++) {
          const a = i * (TAU / 20) + clock * 2.4;
          const rad = maxR * (1 - convP) + 8;
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad * 0.72;
          // rastro fino apontando pro centro
          ctx!.strokeStyle = i % 2 ? pal.base : pal.sec;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(x, y);
          ctx!.lineTo(cx + Math.cos(a) * (rad + 14), cy + Math.sin(a) * (rad + 14) * 0.72);
          ctx!.stroke();
          r(x, y, 2, 2, i % 2 ? pal.base : pal.sec);
        }
        ctx!.globalAlpha = 1;
      }

      // orbe central crescente
      const grow = Math.min(clock / T_PULSE, 1);
      const orb = 3 + grow * 11 + Math.sin(clock * 20) * 1.5;
      ctx!.fillStyle = pal.base;
      ctx!.beginPath();
      ctx!.arc(cx, cy, orb, 0, TAU);
      ctx!.fill();
      r(cx - 1, cy - 1, 2, 2, "#fff7ff");

      // ===== FASE 2 — PULSAÇÃO (anéis) =====
      if (clock > T_CONV) {
        const pp = clock - T_CONV;
        for (let k = 0; k < 4; k++) {
          const rr = (pp * 130 + k * 24) % 96;
          ctx!.globalAlpha = Math.max(0, 1 - rr / 96);
          anel(cx, cy, rr + 6, k % 2 ? pal.base : pal.sec, melhor >= 5 ? 2 : 1);
        }
        ctx!.globalAlpha = 1;

        // vórtice (5★/6★)
        if (pal.swirl && clock < 1.1) {
          for (let arm = 0; arm < 3; arm++) {
            for (let s = 2; s < 26; s++) {
              const a = arm * (TAU / 3) + s * 0.3 + clock * 6;
              const rad = s * 1.7;
              r(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.72, 2, 2, arm % 2 ? pal.base : pal.ter);
            }
          }
        }

        // quadrados holográficos (6★)
        if (pal.squares) {
          const cores = ["#ff2d7e", "#19e6e0", "#ffe14d"];
          for (let q = 0; q < 3; q++) {
            const sz = 14 + q * 12 + Math.sin(clock * 5 + q) * 2;
            ctx!.globalAlpha = 0.75 - q * 0.18;
            ctx!.strokeStyle = cores[q];
            ctx!.lineWidth = 1;
            ctx!.strokeRect(cx - sz, cy - sz, sz * 2, sz * 2);
          }
          ctx!.globalAlpha = 1;
        }
      }

      // ===== FASE 3 — EXPLOSÃO =====
      if (clock >= T_BURST && !estourou) {
        estourou = true;
        setRevelado(true);
        tocarSomTier(tierDeLenda(melhor));
        const n = melhor >= 6 ? 90 : melhor >= 5 ? 70 : melhor >= 4 ? 50 : 36;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const v = 40 + Math.random() * 130;
          const cores = [pal.base, pal.sec, pal.ter];
          parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.72, vida: 1.2, max: 1.2, cor: cores[i % 3], tam: Math.random() < 0.35 ? 3 : 2, grav: 30 });
        }
        // estrelas cadentes (5★/6★)
        if (pal.stars && melhor >= 5) {
          for (let i = 0; i < 5; i++) {
            const a = -0.3 - Math.random() * 1.4;
            const v = 150 + Math.random() * 90;
            parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1.1, max: 1.1, cor: pal.base, tam: 2, grav: 120, trail: true, px: cx, py: cy });
          }
        }
      }
      // flash branco do estouro
      if (clock >= T_BURST) {
        const bp = Math.min((clock - T_BURST) / 0.45, 1);
        ctx!.globalAlpha = Math.max(0, (1 - bp) * 0.85);
        r(0, 0, W, H, "#fff7ff");
        ctx!.globalAlpha = 1;
      }

      // ===== FASES 4–5 — DISPERSÃO + RESÍDUOS =====
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.px = p.x;
        p.py = p.y;
        p.vida -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.grav * dt;
        if (p.vida <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx!.globalAlpha = Math.max(0, p.vida / p.max);
        if (p.trail) {
          ctx!.strokeStyle = p.cor;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.moveTo(p.px ?? p.x, p.py ?? p.y);
          ctx!.lineTo(p.x, p.y);
          ctx!.stroke();
          r(p.x, p.y, 2, 2, "#fff7ff");
        } else {
          r(p.x, p.y, p.tam, p.tam, p.cor);
        }
        ctx!.globalAlpha = 1;
      }

      // brilhos residuais (twinkle) após o estouro
      if (pal.stars && estourou && Math.random() < 0.5) {
        estrela(20 + Math.random() * (W - 40), 14 + Math.random() * (H - 28), Math.random() < 0.4 ? 3 : 2, Math.random() < 0.5 ? pal.base : "#fff7ff");
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cartas, melhor]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/90 p-4" onClick={onFechar}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-3 overflow-y-auto border-2 bg-painel p-4"
        style={{ borderColor: cor }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center font-pixel text-[11px]" style={{ color: cor }}>
          CARREIRA BOOSTER · {cartas.length}×
        </p>
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="w-full border-2 border-borda bg-fundo"
          style={{ imageRendering: "pixelated", aspectRatio: `${W}/${H}` }}
        />

        {revelado && (
          <div className={unica ? "flex justify-center" : "grid grid-cols-3 gap-2 sm:grid-cols-5"}>
            {ordenadas.map((c, i) => (
              <CartaRevel key={i} c={c} delay={i * 0.15} grande={unica} tick={!unica} />
            ))}
          </div>
        )}

        {revelado && pity && <BarraPity antes={pity.antes} depois={pity.depois} max={pity.max} />}

        <button
          type="button"
          onClick={onFechar}
          className="mt-1 w-full border-2 py-2 font-pixel text-[11px] transition"
          style={{ borderColor: cor, color: cor }}
        >
          {revelado ? "CONTINUAR" : "..."}
        </button>
      </div>
    </div>
  );
}

// Barra de pity enchendo animada após a puxada (reset ao tirar 5★ ganha destaque).
function BarraPity({ antes, depois, max }: { antes: number; depois: number; max: number }) {
  const [pct, setPct] = useState((antes / max) * 100);
  const resetou = depois < antes;
  useEffect(() => {
    const t = setTimeout(() => setPct((depois / max) * 100), 350);
    return () => clearTimeout(t);
  }, [depois, max]);
  return (
    <div className="mt-1">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-pixel text-suave">PITY 5★</span>
        <span className={resetou ? "font-pixel text-rosa" : "text-suave"}>
          {resetou ? "5★! RESETOU ✨" : `${depois}/${max}`}
        </span>
      </div>
      <AnimatedBar pct={pct} alturaClass="h-2" cor="linear-gradient(to right, #9a6bff, #ff2d7e)" />
    </div>
  );
}

function CartaRevel({ c, delay, grande, tick = false }: { c: CartaRevelada; delay: number; grande: boolean; tick?: boolean }) {
  const estilo = { animationDelay: `${delay}s` };
  useEffect(() => {
    if (!tick) return;
    const t = setTimeout(() => tocarSom("tick"), delay * 1000);
    return () => clearTimeout(t);
  }, [tick, delay]);
  if (c.cartaImg) {
    return (
      <div className={`carta-entra ${grande ? "w-44 max-w-full" : ""}`} style={estilo}>
        <div
          className="relative overflow-hidden"
          style={c.mitica ? { boxShadow: "0 0 10px #ffe14d, 0 0 22px rgba(255,45,126,0.5)" } : undefined}
        >
          <img src={c.cartaImg} alt={c.nome} className="img-hd block aspect-[2/3] w-full" />
          {c.holo && <div className={`holo-sheen ${c.mitica ? "holo-forte" : ""}`} />}
        </div>
        <p className="mt-1 truncate text-center text-[12px] text-texto">{c.nome}</p>
        {c.subtitulo && <p className="truncate text-center text-[10px] text-suave">{c.subtitulo}</p>}
        {c.badge && (
          <p className="text-center font-pixel text-[10px]" style={{ color: c.cor }}>
            {c.badge}
          </p>
        )}
        {grande && c.substats && c.substats.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-0.5">
            {c.substats.map((s, j) => (
              <span key={j} className="border border-borda px-1 text-[10px] text-ciano">
                {s.rotulo}+{s.valor}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
  // campeão (ícone quadrado)
  return (
    <div className={`carta-entra ${grande ? "w-40 max-w-full" : ""}`} style={estilo}>
      <div className="relative overflow-hidden border-2" style={{ borderColor: c.cor }}>
        {c.icone ? <img src={c.icone} alt="" className="block aspect-square w-full" /> : <div className="aspect-square w-full bg-fundo" />}
        <span className="absolute left-1 top-1 font-pixel text-[10px]" style={{ color: c.cor }}>
          {"★".repeat(c.raridade)}
        </span>
        {c.badge && <span className="absolute right-1 top-1 bg-painel px-1 text-[9px] text-amber-300">{c.badge}</span>}
      </div>
      <p className="mt-1 truncate text-center text-[12px] text-texto">{c.nome}</p>
      {c.subtitulo && <p className="truncate text-center text-[10px] text-suave">{c.subtitulo}</p>}
    </div>
  );
}
