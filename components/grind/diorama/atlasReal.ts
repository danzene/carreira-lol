import { rastrear } from "@/lib/telemetria";

// 🖼️ Loader do atlas de ARTE REAL do diorama (gerado por npm run sprites:build).
// Progressive enhancement (Regra 4): se o atlas não existir/falhar, devolve null e a
// cena segue nos sprites programáticos SEM crash. Carrega UMA vez por sessão (cache).
//
// Resolução: a cena desenha num backing store lógico de 480×96 ampliado por CSS
// (estética pixel intencional) → o @1x é o correto SEMPRE; o @2x fica pronto pra um
// futuro canvas retina (decisão documentada no CHANGELOG-sprites).

export interface FrameReal {
  x: number;
  y: number;
  w: number;
  h: number;
  anchorX: number;
  baselineY: number;
}

export interface AtlasReal {
  img: HTMLImageElement;
  frames: Record<string, FrameReal>;
  branco: Record<string, HTMLCanvasElement>; // versões tingidas de branco (flash de hit)
}

let promessa: Promise<AtlasReal | null> | null = null;

export function carregarAtlasReal(): Promise<AtlasReal | null> {
  if (promessa) return promessa;
  promessa = carregar();
  return promessa;
}

async function carregar(): Promise<AtlasReal | null> {
  try {
    if (typeof window === "undefined") return null;
    const resp = await fetch("/sprites/diorama.json", { cache: "force-cache" });
    if (resp.status === 404) return null; // arte ainda não publicada: fallback SILENCIOSO
    if (!resp.ok) throw new Error(`diorama.json: ${resp.status}`);
    const meta = (await resp.json()) as { "1x"?: { frames: Record<string, FrameReal> } };
    const frames = meta["1x"]?.frames;
    if (!frames || Object.keys(frames).length === 0) throw new Error("diorama.json sem frames @1x");

    const img = new Image();
    img.src = "/sprites/diorama@1x.png";
    await img.decode();

    // pré-tinge os frames de hit de branco (flash de 60ms por cima — barato: 1x no load)
    const branco: Record<string, HTMLCanvasElement> = {};
    for (const nome of ["heroi_hit_1", "minion_azul_hit"]) {
      const f = frames[nome];
      if (!f) continue;
      const cv = document.createElement("canvas");
      cv.width = f.w;
      cv.height = f.h;
      const c = cv.getContext("2d");
      if (!c) continue;
      c.imageSmoothingEnabled = false;
      c.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      c.globalCompositeOperation = "source-in";
      c.fillStyle = "#fff7ff";
      c.fillRect(0, 0, f.w, f.h);
      branco[nome] = cv;
    }

    return { img, frames, branco };
  } catch (e) {
    // atlas EXISTIA mas falhou (deploy quebrado?): canário de produção
    rastrear("diorama_assets_fallback", { msg: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
