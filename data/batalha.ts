import type { Role } from "@/engine/types";

// 🗺️ Layout da Summoner's Rift estilizada + timings do auto-battle (Fase 10).
// Coordenadas normalizadas (0..1). Azul = canto inferior esquerdo; Vermelho = superior direito.

export interface Ponto {
  x: number;
  y: number;
}
type P = [number, number];

export type Lane = "top" | "mid" | "bot";

// Caminhos das três lanes (polilinhas do nexus azul ao vermelho).
export const LANES: Record<Lane, P[]> = {
  top: [
    [0.13, 0.85],
    [0.07, 0.5],
    [0.13, 0.13],
    [0.5, 0.07],
    [0.85, 0.13],
  ],
  mid: [
    [0.15, 0.85],
    [0.5, 0.5],
    [0.85, 0.15],
  ],
  bot: [
    [0.15, 0.87],
    [0.5, 0.93],
    [0.87, 0.87],
    [0.93, 0.5],
    [0.87, 0.15],
  ],
};

export const BATALHA = {
  largura: 320, // resolução interna do canvas (upscale pixelado)
  altura: 224,
  hud: 30, // faixa de HUD no topo
  duracaoBase: 33, // segundos de animação em 1x

  nexusAzul: { x: 0.12, y: 0.88 } as Ponto,
  nexusVermelho: { x: 0.88, y: 0.12 } as Ponto,
  dragao: { x: 0.71, y: 0.74 } as Ponto, // rio inferior
  barao: { x: 0.29, y: 0.26 } as Ponto, // rio superior

  // progresso das torres ao longo da lane (0=base azul, 1=base vermelha)
  torresAzul: [0.27, 0.45],
  torresVermelho: [0.55, 0.73],

  respawn: 3.2, // segundos "mortos" antes de voltar
} as const;

export function laneDeRota(rota: Role): Lane {
  if (rota === "TOP") return "top";
  if (rota === "ADC" || rota === "SUPPORT") return "bot";
  return "mid"; // MID e JUNGLE usam o mid como referência
}

// Ponto interpolado ao longo de uma polilinha pelo comprimento acumulado.
export function pontoNaRota(pontos: P[], prog: number): Ponto {
  const t = Math.max(0, Math.min(1, prog));
  let total = 0;
  const segs: number[] = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const d = Math.hypot(pontos[i + 1][0] - pontos[i][0], pontos[i + 1][1] - pontos[i][1]);
    segs.push(d);
    total += d;
  }
  let alvo = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (alvo <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : alvo / segs[i];
      return {
        x: pontos[i][0] + (pontos[i + 1][0] - pontos[i][0]) * f,
        y: pontos[i][1] + (pontos[i + 1][1] - pontos[i][1]) * f,
      };
    }
    alvo -= segs[i];
  }
  const u = pontos[pontos.length - 1];
  return { x: u[0], y: u[1] };
}

// Posição "de casa" do combatente (onde fica na fase de rotas).
export function posicaoCasa(time: "azul" | "vermelho", rota: Role): Ponto {
  if (rota === "JUNGLE") {
    // junglers ficam nos acampamentos da própria selva (não em cima da lane)
    return time === "azul" ? { x: 0.3, y: 0.52 } : { x: 0.7, y: 0.48 };
  }
  const lane = laneDeRota(rota);
  // SUPPORT fica um pouco atrás do ADC na bot.
  const base = time === "azul" ? 0.33 : 0.67;
  const prog = rota === "SUPPORT" ? (time === "azul" ? base - 0.06 : base + 0.06) : base;
  return pontoNaRota(LANES[lane], prog);
}

export function posicaoObjetivo(qual: "dragao" | "barao"): Ponto {
  return qual === "dragao" ? BATALHA.dragao : BATALHA.barao;
}
