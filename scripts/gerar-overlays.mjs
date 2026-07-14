// Gera os overlays D5 (vinheta de burnout) e D6 (luz quente de moral alta) da
// Gaming House — 1920×480, PNG com alpha real e dither ordenado (Bayer 4×4) pra
// textura pixelada. IAs de imagem não produzem gradiente semi-transparente; isto sim.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const W = 1920;
const H = 480;
const DESTINO = "C:/Users/User/Desktop/Personagem carreira lol/casa";
mkdirSync(DESTINO, { recursive: true });

// Bayer 4×4 (0..15) — dither clássico de pixel art
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// quantiza o alpha em degraus com offset de Bayer POR CÉLULA de 4px (pixelões visíveis)
function ditherAlpha(a01, x, y) {
  const celula = BAYER[Math.floor(y / 4) % 4][Math.floor(x / 4) % 4] / 16; // 0..~0.94
  const passos = 14; // degraus visíveis no gradiente
  const v = Math.max(0, Math.min(1, a01));
  return Math.round((Math.floor(v * passos + celula) / passos) * 255);
}

const suave = (t) => t * t * (3 - 2 * t); // smoothstep

// ---- D5: vinheta de burnout (#050312, transparente no centro → pesada nas bordas) ----
{
  const buf = Buffer.alloc(W * H * 4);
  const cx = W / 2;
  const cy = H / 2;
  const maxD = Math.hypot(cx, cy);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.6) / maxD; // elipse (mais aperto vertical)
      const t = suave(Math.max(0, (d - 0.35) / 0.65)); // começa a escurecer a 35% do raio
      const a = ditherAlpha(t * 0.85, x, y); // até 85% de opacidade nos cantos
      const i = (y * W + x) * 4;
      buf[i] = 5; buf[i + 1] = 3; buf[i + 2] = 18; buf[i + 3] = a;
    }
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(join(DESTINO, "overlay_burnout.png"));
  console.log("✔ overlay_burnout.png (D5)");
}

// ---- D6: luz quente de moral alta (#ffd34d, forte no topo-centro → some embaixo) ----
{
  const buf = Buffer.alloc(W * H * 4);
  const cx = W / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const vert = suave(Math.max(0, 1 - y / (H * 0.85))); // forte em cima, morre a ~85%
      const horiz = 1 - 0.45 * suave(Math.abs(x - cx) / cx); // mais forte no centro
      // “feixes” diagonais sutis dos LEDs do teto
      const feixe = 0.85 + 0.15 * Math.max(0, Math.sin((x - y * 1.4) / 90));
      const a = ditherAlpha(vert * horiz * feixe * 0.2, x, y); // opacidade máx. ~20%
      const i = (y * W + x) * 4;
      buf[i] = 255; buf[i + 1] = 211; buf[i + 2] = 77; buf[i + 3] = a;
    }
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(join(DESTINO, "overlay_moral.png"));
  console.log("✔ overlay_moral.png (D6)");
}
