// 🏠 build-casa.mjs — processa a arte da GAMING HOUSE gerada por IA
// (pasta "Design Carreira lol/Gaming House") pros assets que a cena consome.
//
// O que faz:
//  - Fundo: 1774×887 → 960×480 (webp) — a cena ampla onde o herói anda.
//  - Estações (Grupo B): cada imagem vem com 2 quadros lado a lado (APAGADA | ATIVA,
//    divisória fina no centro) → corta os 2, remove a margem da divisória e salva
//    estacao_<ID>_0/_1.webp (o close-up cinematográfico alterna os dois).
//  - Poses do herói (Grupo C): mesmo corte em 2 frames → pose_<id>_0/_1.webp
//    (viram a FACECAM do close-up — o fundo gradiente escuro delas fica bonito na moldura).
//  - Fagulhas (D1): branco sobre cinza → converte LUMINÂNCIA em alpha (branco puro
//    tingível) e fatia os clusters em sprites individuais.
//  - Zzz (D2) e brilhos (D4): coloridos sobre cinza neutro → alpha por SATURAÇÃO
//    (o cinza some, a cor fica) + fatia clusters.
//  - Overlays D5/D6: já gerados por gerar-overlays.mjs → copiados pro destino.
//
// Rodar:  node scripts/build-casa.mjs

import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ENTRADA = "C:/Users/User/Desktop/Design Carreira lol/Gaming House";
const OVERLAYS = "C:/Users/User/Desktop/Personagem carreira lol/casa";
const SAIDA = "public/carreira/casa";
mkdirSync(SAIDA, { recursive: true });

const log = (m) => console.log(m);

// divisória central: corta com folga de 10px de cada lado do meio
const MEIA = { w: 1536 / 2 - 10, esq: 0, dir: 1536 / 2 + 10 };

async function doisFrames(arquivo, prefixo, alturaAlvo, qualidade = 84) {
  const img = sharp(join(ENTRADA, arquivo));
  const meta = await img.metadata();
  const meia = Math.floor(meta.width / 2);
  const folga = Math.round(meta.width * 0.008); // ~10px em 1536
  const cortes = [
    { left: 0, top: 0, width: meia - folga, height: meta.height },
    { left: meia + folga, top: 0, width: meta.width - meia - folga, height: meta.height },
  ];
  for (let i = 0; i < 2; i++) {
    await sharp(join(ENTRADA, arquivo))
      .extract(cortes[i])
      .resize({ height: alturaAlvo, kernel: "nearest" })
      .webp({ quality: qualidade })
      .toFile(join(SAIDA, `${prefixo}_${i}.webp`));
  }
  log(`✔ ${prefixo}_0/_1.webp`);
}

// ---- clusters: acha grupos de pixels com alpha por projeção de colunas ----
function clustersPorColunas(data, w, h, minAlpha = 24, folgaCols = 6) {
  const temAlpha = new Array(w).fill(false);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (data[(y * w + x) * 4 + 3] > minAlpha) {
        temAlpha[x] = true;
        break;
      }
    }
  }
  const grupos = [];
  let inicio = -1;
  let vazio = 0;
  for (let x = 0; x < w; x++) {
    if (temAlpha[x]) {
      if (inicio < 0) inicio = x;
      vazio = 0;
    } else if (inicio >= 0 && ++vazio > folgaCols * 4) {
      grupos.push([inicio, x - vazio]);
      inicio = -1;
      vazio = 0;
    }
  }
  if (inicio >= 0) grupos.push([inicio, w - 1]);
  return grupos.filter(([a, b]) => b - a > 8);
}

function faixaVertical(data, w, h, x0, x1, minAlpha = 24) {
  let top = h;
  let bot = 0;
  for (let y = 0; y < h; y++) {
    for (let x = x0; x <= x1; x++) {
      if (data[(y * w + x) * 4 + 3] > minAlpha) {
        if (y < top) top = y;
        if (y > bot) bot = y;
        break;
      }
    }
  }
  return [Math.max(0, top - 4), Math.min(h - 1, bot + 4)];
}

async function fatiarSprites(bufRGBA, w, h, prefixo, maxLado = 96, minAlphaCluster = 24) {
  // o limiar do CLUSTER pode ser maior que o do sprite: o glow fraco não emenda
  // partículas vizinhas, mas continua dentro do recorte final
  const grupos = clustersPorColunas(bufRGBA, w, h, minAlphaCluster);
  let n = 0;
  for (const [x0, x1] of grupos) {
    const [y0, y1] = faixaVertical(bufRGBA, w, h, x0, x1, minAlphaCluster);
    const cw = x1 - x0 + 9;
    const ch = y1 - y0 + 1;
    await sharp(bufRGBA, { raw: { width: w, height: h, channels: 4 } })
      .extract({ left: Math.max(0, x0 - 4), top: y0, width: Math.min(cw, w - Math.max(0, x0 - 4)), height: ch })
      .resize({ width: maxLado, height: maxLado, fit: "inside", kernel: "nearest" })
      .png()
      .toFile(join(SAIDA, `${prefixo}_${n}.png`));
    n++;
  }
  log(`✔ ${prefixo}_0..${n - 1}.png (${n} sprites)`);
}

// luminância → alpha (pro branco tingível das fagulhas)
async function extrairPorLuminancia(arquivo) {
  const { data, info } = await sharp(join(ENTRADA, arquivo)).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const c = info.channels;
  // fundo = mediana das bordas (cinza)
  const out = Buffer.alloc(w * h * 4);
  let base = 0;
  for (let x = 0; x < w; x += 7) base += data[x * c];
  base = base / Math.ceil(w / 7);
  for (let i = 0; i < w * h; i++) {
    const lum = (data[i * c] + data[i * c + 1] + data[i * c + 2]) / 3;
    const a = Math.max(0, Math.min(255, Math.round(((lum - base - 14) / (255 - base)) * 340)));
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = a;
  }
  return { out, w, h };
}

// saturação → alpha (Zzz lavanda e brilhos dourados sobre cinza neutro)
async function extrairPorSaturacao(arquivo, ganho = 9) {
  const { data, info } = await sharp(join(ENTRADA, arquivo)).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const c = info.channels;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * c];
    const g = data[i * c + 1];
    const b = data[i * c + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const a = Math.max(0, Math.min(255, (sat - 10) * ganho));
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  }
  return { out, w, h };
}

// ================================ EXECUÇÃO ================================
log("🏠 build-casa: processando a arte da Gaming House…");

// 1) fundo (cena ampla 2:1)
await sharp(join(ENTRADA, "GRUPO B/Fundo da Gaming House.png"))
  .resize(960, 480, { fit: "cover" })
  .webp({ quality: 86 })
  .toFile(join(SAIDA, "fundo.webp"));
log("✔ fundo.webp (960×480)");

// 2) estações (2 frames: apagada | ativa) — altura 640 preserva o detalhe no close-up
const ESTACOES = {
  "GRUPO B/Quadro Tático.png": "ANALISE_ADVERSARIO",
  "GRUPO B/Sala de Replay.png": "REPLAY_ROOM",
  "GRUPO B/Simulador de Scrim.png": "SCRIM_SIM",
  "GRUPO B/Aim Trainer.png": "AIM_TRAINER",
  "GRUPO B/Custom 1v1.png": "CUSTOM_1V1",
  "GRUPO B/Treino de Campeão.png": "CHAMPION_PRACTICE",
  "GRUPO B/Sala de Stream.png": "SALA_DE_STREAM",
  "GRUPO B/Sofá central.png": "SOFA",
};
for (const [arq, id] of Object.entries(ESTACOES)) await doisFrames(arq, `estacao_${id}`, 640);

// Bem-estar veio como FOLHA 3-em-1 (topo = cena inteira apagada; embaixo = 6 painéis:
// academia A/B, cama A/B, poltrona A/B com barras de legenda) → cortes específicos.
{
  const ARQ = join(ENTRADA, "GRUPO B/Bem-estar.png");
  const { width: W, height: H } = await sharp(ARQ).metadata();
  // cena apagada (faixa larga do topo) — vira o frame "idle" e o preview do painel
  await sharp(ARQ)
    .extract({ left: 0, top: 0, width: W, height: Math.round(H * 0.522) })
    .resize({ height: 480, kernel: "nearest" })
    .webp({ quality: 84 })
    .toFile(join(SAIDA, "estacao_ACADEMIA_SONO_TERAPIA_0.webp"));
  await sharp(ARQ)
    .extract({ left: 0, top: 0, width: W, height: Math.round(H * 0.522) })
    .resize({ height: 480, kernel: "nearest" })
    .webp({ quality: 84 })
    .toFile(join(SAIDA, "estacao_ACADEMIA_SONO_TERAPIA_1.webp"));
  // painéis inferiores (terços com 2 frames cada; legenda fica FORA do corte)
  const yTopo = Math.round(H * 0.582);
  const hPainel = H - yTopo;
  const terco = W / 3;
  const VARS = ["academia", "sono", "terapia"];
  for (let t = 0; t < 3; t++) {
    for (let f = 0; f < 2; f++) {
      const left = Math.round(terco * t + (f === 0 ? 6 : terco / 2 + 6));
      const width = Math.round(terco / 2 - 12);
      await sharp(ARQ)
        .extract({ left, top: yTopo, width, height: hPainel })
        .resize({ height: 512, kernel: "nearest" })
        .webp({ quality: 84 })
        .toFile(join(SAIDA, `variante_${VARS[t]}_${f}.webp`));
    }
    log(`✔ variante_${VARS[t]}_0/_1.webp`);
  }
}

// 3) poses do herói (facecam do close-up) — altura 384 basta pra moldura pequena
const POSES = {
  "GRUPO C/Sentado digitando (usada em replayscrimstream1v1).png": "digitando",
  "GRUPO C/Mirando (aim trainer).png": "mirando",
  "GRUPO C/Levantando peso (academia).png": "peso",
  "GRUPO C/Dormindo (sono).png": "dormindo",
  "GRUPO C/Na poltrona  terapia.png": "terapia",
  "GRUPO C/Exausto no sofá (BURNOUT).png": "burnout",
  "GRUPO C/Anotando no quadro (análise).png": "quadro",
  "GRUPO C/Comemorando treino (fim de sessão — opcional).png": "comemorando",
};
for (const [arq, id] of Object.entries(POSES)) await doisFrames(arq, `pose_${id}`, 384);

// 4) fagulhas (D1): branco tingível + fatiar
{
  const { out, w, h } = await extrairPorLuminancia(
    "GRUPO D/Fagulhas de treino (o jogo tinge na cor de cada estação — gerar em BRANCO).png",
  );
  await fatiarSprites(out, w, h, "fagulha", 72, 160); // núcleos brancos separam os clusters
}

// 5) Zzz (D2) + brilhos (D4): saturação + fatiar
{
  const { out, w, h } = await extrairPorSaturacao("GRUPO D/Zzz do sonofadiga.png");
  await fatiarSprites(out, w, h, "zzz", 80);
}
{
  const { out, w, h } = await extrairPorSaturacao("GRUPO D/Brilhos de moral alta.png");
  await fatiarSprites(out, w, h, "brilho", 72, 200);
}

// 6) overlays D5/D6 (gerados por gerar-overlays.mjs)
for (const f of ["overlay_burnout.png", "overlay_moral.png"]) {
  if (existsSync(join(OVERLAYS, f))) {
    copyFileSync(join(OVERLAYS, f), join(SAIDA, f));
    log(`✔ ${f} (copiado)`);
  } else log(`⚠ ${f} não encontrado em ${OVERLAYS} — rode scripts/gerar-overlays.mjs`);
}

log("🏁 pronto: " + SAIDA);
