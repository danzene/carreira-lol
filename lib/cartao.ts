import { corElo } from "@/data/juice";
import { criarRng } from "@/engine/rng";
import { rastrear } from "./telemetria";
import { useLiveOps } from "@/store/liveopsStore";
import { featureLigada } from "./liveops";

// 🖼️ Cartão compartilhável: desenha um PNG 1200×630 (link-preview friendly) em canvas
// offscreen na identidade do jogo — pixel art, moldura do elo, marco em destaque e a
// URL no rodapé. Compartilha via Web Share API (mobile) com fallback download+clipboard.

export interface DadosCartao {
  titulo: string; // "PROMOÇÃO!" / "ITEM MÍTICO!" / "CAMPEÃO!" / "RECAP DA SEMANA" / "PROVA SEMANAL"
  destaque: string; // "Ouro IV" / nome do item / "1.234 pts"
  sub?: string; // linha de apoio
  nick: string;
  elo: string;
  emoji?: string;
  cor?: string; // cor do destaque (default: cor do elo)
}

const W = 1200;
const H = 630;
const URL_JOGO = "carreira-lol.vercel.app";

function fontePixel(): string {
  if (typeof document === "undefined") return "monospace";
  const probe = document.createElement("span");
  probe.className = "font-pixel";
  probe.style.cssText = "position:absolute;visibility:hidden";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily || "monospace";
  document.body.removeChild(probe);
  return fam;
}

export async function gerarCartaoPng(d: DadosCartao): Promise<Blob | null> {
  try {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    const cor = d.cor ?? corElo(d.elo);
    const fam = fontePixel();

    // fundo: gradiente + estrelinhas pixel (seed fixa = cartão sempre igual)
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#15102a");
    g.addColorStop(1, "#0b0617");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rng = criarRng(0xca47a0);
    for (let i = 0; i < 70; i++) {
      const x = rng() * W;
      const y = rng() * H;
      ctx.fillStyle = rng() > 0.7 ? "#4a3f7a" : "#2a2150";
      ctx.fillRect(x, y, rng() > 0.8 ? 6 : 3, rng() > 0.8 ? 6 : 3);
    }

    // moldura dupla na cor do elo
    ctx.strokeStyle = cor;
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.strokeStyle = `${cor}55`;
    ctx.lineWidth = 4;
    ctx.strokeRect(38, 38, W - 76, H - 76);
    // cantos pixel
    ctx.fillStyle = cor;
    for (const [cx, cy] of [[20, 20], [W - 44, 20], [20, H - 44], [W - 44, H - 44]] as const) {
      ctx.fillRect(cx, cy, 24, 24);
    }

    // marca do jogo
    ctx.textAlign = "center";
    ctx.fillStyle = "#19e6e0";
    ctx.font = `22px ${fam}`;
    ctx.fillText("CARREIRA LoL", W / 2, 92);

    // emoji do marco
    if (d.emoji) {
      ctx.font = "110px serif";
      ctx.fillText(d.emoji, W / 2, 220);
    }

    // título
    ctx.fillStyle = "#ece8ff";
    ctx.font = `34px ${fam}`;
    ctx.fillText(d.titulo, W / 2, d.emoji ? 292 : 220);

    // destaque com glow
    ctx.shadowColor = cor;
    ctx.shadowBlur = 32;
    ctx.fillStyle = cor;
    ctx.font = `64px ${fam}`;
    ctx.fillText(d.destaque, W / 2, d.emoji ? 386 : 330, W - 160);
    ctx.shadowBlur = 0;

    // sub
    if (d.sub) {
      ctx.fillStyle = "#9a90c0";
      ctx.font = `24px ${fam}`;
      ctx.fillText(d.sub, W / 2, d.emoji ? 440 : 390, W - 200);
    }

    // rodapé: nick + elo à esquerda, URL à direita
    ctx.textAlign = "left";
    ctx.fillStyle = "#ece8ff";
    ctx.font = `26px ${fam}`;
    ctx.fillText(d.nick, 70, H - 84, 500);
    ctx.fillStyle = cor;
    ctx.font = `20px ${fam}`;
    ctx.fillText(d.elo, 70, H - 52);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9a90c0";
    ctx.font = `20px ${fam}`;
    ctx.fillText(`▶ ${URL_JOGO}`, W - 70, H - 60);

    return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
  } catch {
    return null;
  }
}

// Compartilha: Web Share API com arquivo (mobile) → fallback download + texto no clipboard.
export async function compartilharCartao(d: DadosCartao, textoPronto: string): Promise<"share" | "download" | "off" | null> {
  // Kill switch de live-ops (fail-open: só bloqueia com flag explicitamente false).
  if (!featureLigada(useLiveOps.getState().config, "compartilhamento")) return "off";
  const blob = await gerarCartaoPng(d);
  if (!blob) return null;
  const arquivo = new File([blob], "carreira-lol.png", { type: "image/png" });
  try {
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: textoPronto });
      rastrear("cartao_compartilhado", { tipo: d.titulo, via: "share" });
      return "share";
    }
  } catch {
    // usuário cancelou o share — cai no download
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carreira-lol.png";
    a.click();
    URL.revokeObjectURL(url);
    try {
      await navigator.clipboard?.writeText(textoPronto);
    } catch {
      // clipboard bloqueado — só o download
    }
    rastrear("cartao_compartilhado", { tipo: d.titulo, via: "download" });
    return "download";
  } catch {
    return null;
  }
}
