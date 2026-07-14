// 🎨 Carregador da arte real da Gaming House (public/carreira/casa — gerada pelo
// scripts/build-casa.mjs). Progressive enhancement: cada peça é opcional; se o FUNDO
// falhar, a cena inteira cai no fallback programático. Singleton com cache de sessão.

import type { EstacaoId, VarianteMental } from "@/data/gamingHouse";

export type PoseCasa =
  | "digitando"
  | "mirando"
  | "peso"
  | "dormindo"
  | "terapia"
  | "burnout"
  | "quadro"
  | "comemorando";

export interface ArteCasa {
  fundo: HTMLImageElement;
  estacoes: Partial<Record<EstacaoId | "SOFA", [HTMLImageElement, HTMLImageElement]>>;
  variantes: Partial<Record<VarianteMental, [HTMLImageElement, HTMLImageElement]>>;
  poses: Partial<Record<PoseCasa, [HTMLImageElement, HTMLImageElement]>>;
  fagulhas: HTMLImageElement[];
  zzz: HTMLImageElement[];
  brilho: HTMLImageElement | null;
  overlayBurnout: HTMLImageElement | null;
  overlayMoral: HTMLImageElement | null;
}

const BASE = "/carreira/casa";

function img(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null); // peça ausente nunca quebra a cena
    i.src = `${BASE}/${src}`;
  });
}

async function par(prefixo: string): Promise<[HTMLImageElement, HTMLImageElement] | null> {
  const [a, b] = await Promise.all([img(`${prefixo}_0.webp`), img(`${prefixo}_1.webp`)]);
  return a && b ? [a, b] : null;
}

let cache: Promise<ArteCasa | null> | null = null;

export function carregarArteCasa(): Promise<ArteCasa | null> {
  if (cache) return cache;
  cache = (async () => {
    try {
      const fundo = await img("fundo.webp");
      if (!fundo) return null; // sem o palco não há show — fallback total

      const ESTACOES: (EstacaoId | "SOFA")[] = [
        "ANALISE_ADVERSARIO", "REPLAY_ROOM", "SCRIM_SIM", "AIM_TRAINER",
        "CUSTOM_1V1", "CHAMPION_PRACTICE", "SALA_DE_STREAM", "ACADEMIA_SONO_TERAPIA", "SOFA",
      ];
      const VARIANTES: VarianteMental[] = ["academia", "sono", "terapia"];
      const POSES: PoseCasa[] = ["digitando", "mirando", "peso", "dormindo", "terapia", "burnout", "quadro", "comemorando"];

      const [estacoesArr, variantesArr, posesArr, fagulhasArr, zzzArr, brilho, overlayBurnout, overlayMoral] =
        await Promise.all([
          Promise.all(ESTACOES.map((e) => par(`estacao_${e}`))),
          Promise.all(VARIANTES.map((v) => par(`variante_${v}`))),
          Promise.all(POSES.map((p) => par(`pose_${p}`))),
          Promise.all([0, 1, 2, 3].map((i) => img(`fagulha_${i}.png`))),
          Promise.all([0, 1, 2].map((i) => img(`zzz_${i}.png`))),
          img("brilho_0.png"),
          img("overlay_burnout.png"),
          img("overlay_moral.png"),
        ]);

      const arte: ArteCasa = {
        fundo,
        estacoes: {},
        variantes: {},
        poses: {},
        fagulhas: fagulhasArr.filter((f): f is HTMLImageElement => f !== null),
        zzz: zzzArr.filter((z): z is HTMLImageElement => z !== null),
        brilho,
        overlayBurnout,
        overlayMoral,
      };
      ESTACOES.forEach((e, i) => {
        if (estacoesArr[i]) arte.estacoes[e] = estacoesArr[i]!;
      });
      VARIANTES.forEach((v, i) => {
        if (variantesArr[i]) arte.variantes[v] = variantesArr[i]!;
      });
      POSES.forEach((p, i) => {
        if (posesArr[i]) arte.poses[p] = posesArr[i]!;
      });
      return arte;
    } catch {
      return null;
    }
  })();
  return cache;
}

// Tinge um sprite branco na cor da estação (uma vez por sessão — barato).
export function tintar(imgBase: HTMLImageElement, cor: string): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = imgBase.width;
  cv.height = imgBase.height;
  const c = cv.getContext("2d")!;
  c.drawImage(imgBase, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = cor;
  c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
