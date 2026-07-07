import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

// 🖼️ Pipeline de sprites do Diorama — roda OFFLINE (npm run sprites:build).
// Lê assets/sprites-raw/<personagem>/*.png (arte IA com fundo cinza em degradê) e
// produz public/sprites/diorama@{1x,2x}.png + diorama.json (atlas + metadados),
// commitados. Idempotente: rodar 2× dá o mesmo resultado; personagem novo = soltar a
// pasta e rodar de novo.
//
// Escolha de lib: sharp (binário pré-compilado — sem toolchain nativa no Windows,
// raw RGBA rápido e resize com kernel nearest, essencial pra pixel art).
//
// Passos por frame:
//  1. flood-fill do FUNDO a partir das bordas (BFS 4-conexo): pixel de fundo =
//     baixa saturação (max−min ≤ TOLERANCIA_SAT) — o degradê cinza cai todo,
//     buracos internos NÃO (só o que conecta à borda).
//  2. suavização de borda: alpha reduzido na fronteira do recorte (mata serrilhado).
//  3. trim pro bbox + baseline (linha dos pés; overrides pra poses caídas).
//  4. escala normalizada POR PERSONAGEM (âncora: altura do frame de referência em pé)
//     → nenhum frame "pula de tamanho"; downscale nearest, @1x e @2x.
//  5. shelf packing num atlas por resolução + JSON {x,y,w,h,anchorX,baselineY}.

const RAIZ = "assets/sprites-raw";
const SAIDA = "public/sprites";
const PREVIEW = "assets/sprites-preview.html";

// ---- calibração (documentada no CHANGELOG-sprites) ----
const TOLERANCIA_SAT = 26; // max(R,G,B)−min(R,G,B) ≤ isto = cinza de fundo (ajuste se sobrar franja)
// O personagem TAMBÉM tem cinzas (casaco escuro, armadura) — o que separa é a LUZ:
// o fundo é cinza médio-claro (~#888 com degradê), os escuros do personagem são quase
// pretos. Fundo = neutro E claro. Ilhas de fundo escuras que sobrarem nos cantos caem
// no filtro de componentes soltos.
const LUMI_MIN_FUNDO = 60; // max(R,G,B) ≥ isto pra contar como fundo
const ALPHA_BORDA = 140; // alpha da fronteira do recorte (suaviza serrilhado sobre fundo escuro)
const LARGURA_ATLAS = 1024; // largura máxima do atlas (shelf packing)
const PAD = 2; // respiro entre frames no atlas

// Altura-alvo @1x por personagem (px de cena; herói ≈ altura do sprite programático
// atual pra não mudar a leitura do strip; minion ≈ 0,62×H).
const ALTURA_ALVO = { heroi: 34, minion_azul: 21 };

// Frame de referência (em pé) que ancora a escala do personagem inteiro.
const FRAME_REF = { heroi: "heroi_idle_1", minion_azul: "minion_azul_walking_1" };

// Baseline (linha dos pés) como fração da ALTURA do bbox a partir do topo.
// Default 1.0 = fundo do bbox (pé no chão). Overrides pra poses caídas/sentadas se a
// arte pedir (ex.: "heroi_derrota_2": 0.97 sobe o corpo 3% pra assentar no chão).
const BASELINE_OVERRIDES = {
  // "heroi_derrota_2": 1.0,
  // "heroi_hit_1": 1.0,
};

function log(msg) {
  console.log(`[sprites] ${msg}`);
}

// nomes com vírgula acidental ("..._atk_1,png.png") → normaliza
function nomeFrame(arquivo) {
  return basename(arquivo)
    .replace(/,png/gi, "")
    .replace(/\.png$/i, "");
}

// ---- 1. flood-fill do fundo (BFS das bordas; personagem colorido bloqueia) ----
function removerFundo(data, w, h) {
  const fundo = new Uint8Array(w * h); // 1 = fundo
  const fila = new Int32Array(w * h);
  let ini = 0;
  let fim = 0;
  const ehFundo = (i) => {
    const a = data[i * 4 + 3];
    if (a < 10) return true; // já transparente propaga
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    return max - Math.min(r, g, b) <= TOLERANCIA_SAT && max >= LUMI_MIN_FUNDO;
  };
  const empurrar = (i) => {
    if (!fundo[i] && ehFundo(i)) {
      fundo[i] = 1;
      fila[fim++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    empurrar(x);
    empurrar((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    empurrar(y * w);
    empurrar(y * w + w - 1);
  }
  while (ini < fim) {
    const i = fila[ini++];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) empurrar(i - 1);
    if (x < w - 1) empurrar(i + 1);
    if (y > 0) empurrar(i - w);
    if (y < h - 1) empurrar(i + w);
  }
  // aplica: fundo vira alpha 0
  for (let i = 0; i < w * h; i++) if (fundo[i]) data[i * 4 + 3] = 0;
  // 2. suavização: pixel opaco encostado (8-conexo) em fundo removido → alpha reduzido
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fundo[i] || data[i * 4 + 3] === 0) continue;
      let borda = false;
      for (let dy = -1; dy <= 1 && !borda; dy++) {
        for (let dx = -1; dx <= 1 && !borda; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) borda = true;
          else if (fundo[ny * w + nx]) borda = true;
        }
      }
      if (borda) data[i * 4 + 3] = Math.min(data[i * 4 + 3], ALPHA_BORDA);
    }
  }
}

// ---- 2a. corte da TARJA de legenda na base (antes do flood-fill) ----
// A arte IA traz uma faixa preta com o nome do arquivo colada na base; em poses
// baixas (derrota) ela FUNDE com o personagem e o filtro de componentes não pega.
// Perfil inconfundível: linhas contíguas a partir da base com ≥50% de pixels quase
// pretos na LARGURA TODA (o corpo nunca ocupa 50% da largura em linha escura).
function removerTarjaBase(data, w, h) {
  // linha de tarja: escura de BORDA A BORDA (x≈0 até x≈w) e majoritariamente preta —
  // um corpo deitado nunca cruza a largura inteira encostando nas duas bordas.
  const ehLinhaTarja = (y) => {
    let escuros = 0;
    let primeiro = -1;
    let ultimo = -1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 10 && Math.max(data[i], data[i + 1], data[i + 2]) < 60) {
        escuros++;
        if (primeiro < 0) primeiro = x;
        ultimo = x;
      }
    }
    return escuros / w >= 0.6 && primeiro <= 2 && ultimo >= w - 3;
  };
  // procura a PRIMEIRA linha de tarja no quarto de baixo (a tarja pode estar
  // levemente afastada da borda); exige ≥3 linhas seguidas pra não confundir
  let inicio = -1;
  for (let y = Math.floor(h * 0.75); y < h - 2; y++) {
    if (ehLinhaTarja(y) && ehLinhaTarja(y + 1) && ehLinhaTarja(y + 2)) {
      inicio = y;
      break;
    }
  }
  if (inicio < 0) return 0;
  const de = Math.max(0, inicio - 2); // buffer pro serrilhado
  for (let y = de; y < h; y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = 0;
  return h - de;
}

// ---- 2b. descarte de componentes soltos (selos/etiquetas da arte IA) ----
// A arte bruta traz um selo rosa numerado no canto e uma tarja de legenda — o selo é
// SATURADO (o flood-fill não remove). Solução: componentes conexos do que sobrou;
// mantém o MAIOR (o personagem) + componentes encostados no bbox dele (margem 2px —
// efeitos de golpe destacados sobrevivem); o resto (selos de canto, sobras) some.
function manterComponentePrincipal(data, w, h) {
  const comp = new Int32Array(w * h).fill(-1);
  const componentes = [];
  const fila = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (comp[start] !== -1 || data[start * 4 + 3] <= 10) continue;
    const id = componentes.length;
    let n = 0;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    let ini = 0;
    let fim = 0;
    fila[fim++] = start;
    comp[start] = id;
    while (ini < fim) {
      const i = fila[ini++];
      n++;
      const x = i % w;
      const y = (i / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const tenta = (v) => {
        if (comp[v] === -1 && data[v * 4 + 3] > 10) {
          comp[v] = id;
          fila[fim++] = v;
        }
      };
      if (x > 0) tenta(i - 1);
      if (x < w - 1) tenta(i + 1);
      if (y > 0) tenta(i - w);
      if (y < h - 1) tenta(i + w);
    }
    componentes.push({ n, x0, y0, x1, y1 });
  }
  if (componentes.length <= 1) return 0;
  let principal = 0;
  for (let i = 1; i < componentes.length; i++) if (componentes[i].n > componentes[principal].n) principal = i;
  const P = componentes[principal];
  const M = 2;
  // perfis dos contaminantes da arte IA (sempre descartados, mesmo encostados):
  // SELO numerado = componente pequeno inteiro num canto SUPERIOR da imagem;
  // TARJA de legenda = faixa larga e baixa colada na base da imagem.
  const ehSelo = (cp) =>
    cp.n < w * h * 0.08 && cp.y1 <= h * 0.3 && (cp.x1 <= w * 0.32 || cp.x0 >= w * 0.68);
  const ehTarja = (cp) => cp.y0 >= h * 0.8 && cp.x1 - cp.x0 >= w * 0.5 && cp.y1 - cp.y0 <= h * 0.2;
  const manter = componentes.map((cp, i) => {
    if (i === principal) return true; // o personagem nunca é descartado
    if (ehSelo(cp) || ehTarja(cp)) return false;
    return cp.x1 >= P.x0 - M && cp.x0 <= P.x1 + M && cp.y1 >= P.y0 - M && cp.y0 <= P.y1 + M;
  });
  let removidos = 0;
  for (let i = 0; i < w * h; i++) {
    if (comp[i] >= 0 && !manter[comp[i]]) {
      data[i * 4 + 3] = 0;
      removidos++;
    }
  }
  return removidos;
}

// ---- 3. trim pro bbox do conteúdo ----
function bbox(data, w, h) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // frame vazio
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---- shelf packing simples ----
function empacotar(frames, larguraMax, pad) {
  const ordenados = [...frames].sort((a, b) => b.h - a.h);
  let x = pad;
  let y = pad;
  let alturaLinha = 0;
  let larguraUsada = 0;
  for (const f of ordenados) {
    if (x + f.w + pad > larguraMax) {
      x = pad;
      y += alturaLinha + pad;
      alturaLinha = 0;
    }
    f.ax = x;
    f.ay = y;
    x += f.w + pad;
    alturaLinha = Math.max(alturaLinha, f.h);
    larguraUsada = Math.max(larguraUsada, x);
  }
  return { w: larguraUsada + pad, h: y + alturaLinha + pad };
}

async function main() {
  if (!existsSync(RAIZ)) {
    mkdirSync(RAIZ, { recursive: true });
    log(`${RAIZ} criado (vazio). Solte as pastas de personagens lá e rode de novo: npm run sprites:build`);
    return;
  }
  const pastas = readdirSync(RAIZ, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (pastas.length === 0) {
    log("nenhum personagem em assets/sprites-raw — nada a fazer.");
    return;
  }

  // ---- processa cada frame: recorte + trim (mantém raw pra escalar depois) ----
  const brutos = []; // { nome, pers, data, w, h }
  for (const pers of pastas) {
    const dir = join(RAIZ, pers);
    const arquivos = readdirSync(dir).filter((f) => f.toLowerCase().includes("png") && !f.includes("_ref"));
    for (const arq of arquivos) {
      const nome = nomeFrame(arq);
      const { data, info } = await sharp(join(dir, arq)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const tarja = removerTarjaBase(data, info.width, info.height);
      if (tarja > 0) log(`${nome}: tarja de legenda cortada (${tarja} linhas na base)`);
      removerFundo(data, info.width, info.height);
      const soltos = manterComponentePrincipal(data, info.width, info.height);
      if (soltos > 0) log(`${nome}: ${soltos}px de componentes soltos descartados (selo/etiqueta)`);
      const bb = bbox(data, info.width, info.height);
      if (!bb) {
        log(`AVISO: ${nome} ficou vazio após o recorte — tolerância alta demais? Pulando.`);
        continue;
      }
      // recorta o bbox pra um buffer novo
      const rec = Buffer.alloc(bb.w * bb.h * 4);
      for (let y = 0; y < bb.h; y++) {
        const src = ((bb.y + y) * info.width + bb.x) * 4;
        data.copy(rec, y * bb.w * 4, src, src + bb.w * 4);
      }
      brutos.push({ nome, pers, data: rec, w: bb.w, h: bb.h });
      log(`${nome}: ${info.width}×${info.height} → recorte ${bb.w}×${bb.h}`);
    }
  }
  if (brutos.length === 0) {
    log("nenhum frame válido — nada a fazer.");
    return;
  }

  // ---- 4. escala por personagem (âncora no frame de referência em pé) ----
  const razao = {};
  for (const pers of pastas) {
    const alvo = ALTURA_ALVO[pers];
    const refNome = FRAME_REF[pers];
    const ref = brutos.find((b) => b.nome === refNome) ?? brutos.find((b) => b.pers === pers);
    if (!alvo || !ref) {
      log(`AVISO: ${pers} sem altura-alvo/frame de referência — usando escala 1:4.`);
      razao[pers] = 0.25;
      continue;
    }
    razao[pers] = alvo / ref.h;
    log(`${pers}: referência ${ref.nome} (${ref.h}px) → alvo ${alvo}px @1x (razão ${razao[pers].toFixed(4)})`);
  }

  mkdirSync(SAIDA, { recursive: true });
  const json = { v: 1, gerado: "npm run sprites:build" };

  for (const [sufixo, mult] of [
    ["1x", 1],
    ["2x", 2],
  ]) {
    // escala cada frame (nearest preserva o pixel art)
    const frames = [];
    for (const b of brutos) {
      const esc = razao[b.pers] * mult;
      const w = Math.max(1, Math.round(b.w * esc));
      const h = Math.max(1, Math.round(b.h * esc));
      const png = await sharp(b.data, { raw: { width: b.w, height: b.h, channels: 4 } })
        .resize(w, h, { kernel: "nearest" })
        .png()
        .toBuffer();
      const fracBase = BASELINE_OVERRIDES[b.nome] ?? 1.0;
      frames.push({ nome: b.nome, png, w, h, anchorX: Math.round(w / 2), baselineY: Math.round(h * fracBase) });
    }
    const dim = empacotar(frames, LARGURA_ATLAS * mult, PAD * mult);
    const composites = frames.map((f) => ({ input: f.png, left: f.ax, top: f.ay }));
    await sharp({ create: { width: dim.w, height: dim.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(composites)
      .png()
      .toFile(join(SAIDA, `diorama@${sufixo}.png`));
    json[sufixo] = {
      w: dim.w,
      h: dim.h,
      frames: Object.fromEntries(
        frames.map((f) => [f.nome, { x: f.ax, y: f.ay, w: f.w, h: f.h, anchorX: f.anchorX, baselineY: f.baselineY }]),
      ),
    };
    log(`atlas @${sufixo}: ${dim.w}×${dim.h} com ${frames.length} frames`);
  }

  writeFileSync(join(SAIDA, "diorama.json"), JSON.stringify(json, null, 1));
  log(`escrito ${SAIDA}/diorama.json`);

  // ---- 7. preview local (QA visual — fora do build do app) ----
  const animacoes = {
    heroi_idle: ["heroi_idle_1", "heroi_idle_2"],
    heroi_run: ["heroi_run_1", "heroi_run_2", "heroi_run_3", "heroi_run_4"],
    heroi_atk: ["heroi_atk_1", "heroi_atk_2", "heroi_atk_3"],
    heroi_hit: ["heroi_hit_1"],
    heroi_derrota: ["heroi_derrota_1", "heroi_derrota_2"],
    heroi_vitoria: ["heroi_vitoria_1", "heroi_vitoria_2", "heroi_vitoria_3"],
    minion_walk: ["minion_azul_walking_1", "minion_azul_walking_2", "minion_azul_walking_3"],
    minion_atk: ["minion_azul_atk_1", "minion_azul_atk_2"],
    minion_morte: ["minion_azul_hit"],
  };
  const html = `<!doctype html><meta charset="utf-8"><title>sprites-preview</title>
<body style="background:#0b0617;color:#ece8ff;font-family:monospace;padding:20px">
<h3>Diorama · preview do atlas (@2x)</h3><p>Fundo escuro do jogo — confira franja, escala e baseline.</p>
<div id="grid" style="display:flex;flex-wrap:wrap;gap:24px"></div>
<script>
const ANIM = ${JSON.stringify(animacoes)};
fetch("../public/sprites/diorama.json").then(r=>r.json()).then(meta=>{
  const img = new Image(); img.src = "../public/sprites/diorama@2x.png";
  img.onload = () => { for (const [nome, frames] of Object.entries(ANIM)) {
    const fs = frames.map(f=>meta["2x"].frames[f]).filter(Boolean);
    if (!fs.length) continue;
    const w = Math.max(...fs.map(f=>f.w)), h = Math.max(...fs.map(f=>f.h));
    const cv = document.createElement("canvas"); cv.width=w; cv.height=h;
    cv.style.cssText = "image-rendering:pixelated;border:1px solid #2a2150;background:#15102a";
    const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
    const rot = document.createElement("div");
    rot.textContent = nome + " ("+fs.length+"f)"; rot.style.cssText="font-size:11px;color:#9a90c0;margin-top:4px";
    const cel = document.createElement("div"); cel.append(cv, rot); document.getElementById("grid").append(cel);
    let i = 0; setInterval(()=>{ const f = fs[i++ % fs.length]; cx.clearRect(0,0,w,h);
      cx.drawImage(img, f.x, f.y, f.w, f.h, Math.round((w-f.w)/2), h-f.h, f.w, f.h); }, 180);
  }};
});
</script>`;
  writeFileSync(PREVIEW, html);
  log(`preview: abra ${PREVIEW} no navegador (via servidor local na raiz do repo)`);
}

main().catch((e) => {
  console.error("[sprites] ERRO:", e);
  process.exitCode = 1;
});
