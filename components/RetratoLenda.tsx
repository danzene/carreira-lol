import type { Paleta, Tema } from "@/data/gacha";

// Arte pixel (SVG) de cada lenda: busto sombreado + penteado + acessório, com paleta própria.
type Spec = [number, number, number, number, string];

function ajustar(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}

type EstCab = "espeto" | "liso" | "curto" | "jovem" | "real";
function estiloCabelo(tema: Tema): EstCab {
  if (tema === "imortal") return "real";
  if (tema === "prodigio") return "jovem";
  if (["rei", "goat", "fantasma", "predador"].includes(tema)) return "espeto";
  if (["mente", "maestro", "capitao", "calculista"].includes(tema)) return "liso";
  return "curto";
}

function cabeloRects(est: EstCab, c: string, cs: string, cl: string): Spec[] {
  switch (est) {
    case "espeto":
      return [[9, 5, 14, 5, c], [10, 3, 3, 2, c], [15, 2, 2, 3, c], [19, 3, 3, 2, c], [9, 7, 2, 7, c], [21, 7, 2, 7, c], [9, 5, 14, 1, cl], [11, 8, 4, 1, cs]];
    case "liso":
      return [[9, 5, 14, 4, c], [9, 5, 2, 11, c], [21, 5, 2, 11, c], [11, 8, 9, 1, cs], [15, 5, 1, 3, cs], [10, 6, 3, 1, cl]];
    case "jovem":
      return [[9, 5, 14, 6, c], [10, 10, 12, 2, c], [15, 10, 2, 1, "#0000"], [9, 6, 2, 8, c], [21, 6, 2, 8, c], [11, 6, 4, 1, cl]];
    case "real":
      return [[8, 3, 16, 7, c], [7, 6, 3, 14, c], [22, 6, 3, 14, c], [10, 9, 1, 8, cs], [21, 9, 1, 8, cs], [9, 3, 14, 1, cl]];
    default: // curto
      return [[9, 5, 14, 5, c], [9, 7, 1, 5, c], [22, 7, 1, 5, c], [9, 5, 14, 1, cl]];
  }
}

function acessorio(tema: Tema, pele: string): Spec[] {
  switch (tema) {
    case "rei":
      return [[9, 3, 14, 3, "#ffd34d"], [9, 2, 2, 2, "#ffd34d"], [15, 1, 2, 3, "#ffd34d"], [21, 2, 2, 2, "#ffd34d"], [15, 4, 2, 1, "#ff2d7e"]];
    case "mente":
      return [[9, 15, 14, 3, "#19e6e0"], [9, 15, 14, 1, "#9ff7f2"]];
    case "veterano":
      return [[11, 21, 10, 4, "#dadae8"], [14, 22, 4, 1, pele]];
    case "goat":
      return [[10, 1, 12, 2, "#ffd34d"], [10, 1, 2, 3, "#ffd34d"], [20, 1, 2, 3, "#ffd34d"]];
    case "gelo":
      return [[10, 18, 2, 2, "#19e6e0"], [20, 18, 2, 2, "#19e6e0"], [25, 6, 1, 1, "#fff"]];
    case "mecanico":
      return [[6, 14, 3, 7, "#2a2150"], [23, 14, 3, 7, "#2a2150"], [9, 5, 14, 2, "#2a2150"], [8, 21, 5, 1, "#19e6e0"]];
    case "predador":
      return [[9, 14, 14, 4, "#160b1e"], [12, 15, 2, 2, "#ff2d7e"], [18, 15, 2, 2, "#ff2d7e"]];
    case "maestro":
      return [[24, 8, 2, 8, "#19e6e0"], [22, 15, 4, 2, "#19e6e0"]];
    case "prodigio":
      return [[23, 3, 2, 3, "#ffd34d"], [21, 4, 6, 1, "#ffd34d"], [22, 4, 2, 2, "#ffd34d"]];
    case "muralha":
      return [[8, 4, 16, 6, "#7a7a92"], [15, 9, 2, 7, "#7a7a92"], [9, 9, 14, 1, "#9a9ab0"]];
    case "calculista":
      return [[11, 15, 4, 3, "#19e6e0"], [17, 15, 4, 3, "#19e6e0"], [15, 16, 2, 1, "#19e6e0"]];
    case "mercenario":
      return [[9, 5, 14, 3, "#2a2150"], [24, 11, 2, 5, "#ffd34d"], [23, 12, 4, 1, "#ffd34d"], [23, 14, 4, 1, "#ffd34d"]];
    case "capitao":
      return [[9, 7, 14, 2, "#ff2d7e"], [15, 7, 2, 2, "#ffd34d"]];
    case "atirador":
      return [[16, 14, 6, 5, "#2a2150"], [18, 16, 2, 1, "#19e6e0"], [19, 15, 1, 3, "#19e6e0"]];
    case "imortal":
      return [[10, 2, 12, 2, "#ffe14d"], [10, 1, 2, 3, "#ffe14d"], [20, 1, 2, 3, "#ffe14d"], [5, 8, 1, 1, "#fff"], [26, 10, 1, 1, "#fff"], [24, 5, 1, 1, "#ffe14d"], [6, 16, 1, 1, "#ffe14d"]];
    default:
      return [];
  }
}

export default function RetratoLenda({ tema, cor, paleta, className }: { tema: Tema; cor: string; paleta: Paleta; className?: string }) {
  const { pele, cabelo, roupa, olho } = paleta;
  const peleS = ajustar(pele, 0.8);
  const cabS = ajustar(cabelo, 0.68);
  const cabL = ajustar(cabelo, 1.3);
  const roupaS = ajustar(roupa, 0.72);
  const olhoS = ajustar(olho, 0.7);
  const mitica = tema === "imortal";

  const bust: Spec[] = [
    // roupa (gola alta) + sombras
    [4, 30, 24, 6, roupa],
    [6, 28, 20, 2, roupa],
    [8, 27, 16, 1, roupa],
    [20, 30, 8, 6, roupaS],
    [12, 25, 8, 3, roupa],
    [17, 25, 3, 3, roupaS],
    // pescoço
    [13, 23, 6, 2, peleS],
    // cabeça
    [9, 9, 14, 14, pele],
    [20, 9, 3, 14, peleS],
    [9, 9, 2, 14, ajustar(pele, 1.06)],
    // sobrancelhas
    [11, 13, 4, 1, cabS],
    [17, 13, 4, 1, cabS],
    // olhos
    [11, 15, 4, 3, "#f4f4ff"],
    [17, 15, 4, 3, "#f4f4ff"],
    [12, 15, 2, 3, olho],
    [18, 15, 2, 3, olho],
    [12, 17, 2, 1, olhoS],
    [18, 17, 2, 1, olhoS],
    [12, 15, 1, 1, "#fff"],
    [18, 15, 1, 1, "#fff"],
    // nariz, bochecha, boca
    [15, 18, 2, 1, peleS],
    [10, 19, 2, 2, "#e89aab"],
    [20, 19, 2, 2, "#e89aab"],
    [14, 21, 4, 1, peleS],
  ];
  const todos = [...bust, ...cabeloRects(estiloCabelo(tema), cabelo, cabS, cabL), ...acessorio(tema, pele)];

  return (
    <svg viewBox="0 0 32 36" className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={32} height={36} fill={mitica ? "#1a1206" : "#0f0a1a"} />
      <rect x={0} y={0} width={32} height={18} fill={cor} fillOpacity={mitica ? 0.22 : 0.16} />
      <rect x={0} y={24} width={32} height={12} fill="#000" fillOpacity={0.22} />
      {todos
        .filter(([, , , , f]) => f !== "#0000")
        .map(([x, y, w, h, f], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill={f} />
        ))}
    </svg>
  );
}
