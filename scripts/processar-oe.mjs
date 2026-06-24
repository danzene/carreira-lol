// Processa o CSV do Oracle's Elixir → data/champions-oe.json (compacto).
// Uso (na raiz do projeto):  node scripts/processar-oe.mjs [caminho-do-csv]
// Padrão do CSV: ../2026_LoL_esports_match_data_from_OraclesElixir.csv (no Desktop).

import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const csvPath = process.argv[2] || "../2026_LoL_esports_match_data_from_OraclesElixir.csv";
const SAIDA = "data/champions-oe.json";

const POS = { top: "TOP", jng: "JUNGLE", mid: "MID", bot: "ADC", sup: "SUPPORT" };

function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const normaliza = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

async function main() {
  console.log("Lendo", csvPath, "…");
  const rl = createInterface({ input: createReadStream(csvPath, "utf8"), crlfDelay: Infinity });

  let idx = null;
  const champ = {}; // nome -> { roles:{ROLE:{jogos,vitorias}}, picks, vitorias, bans }
  const jogos = new Set();
  let linhas = 0;

  const ensure = (nome) => (champ[nome] ??= { roles: {}, picks: 0, vitorias: 0, bans: 0 });

  for await (const line of rl) {
    if (!line) continue;
    const f = parseLine(line);
    if (!idx) {
      idx = {};
      f.forEach((c, i) => (idx[c.trim()] = i));
      for (const col of ["gameid", "position", "champion", "result", "ban1"]) {
        if (idx[col] === undefined) throw new Error(`Coluna "${col}" não encontrada no CSV.`);
      }
      continue;
    }
    linhas++;
    if (linhas % 50000 === 0) console.log("…", linhas, "linhas");

    const gid = f[idx.gameid];
    if (gid) jogos.add(gid);
    const pos = (f[idx.position] || "").trim();
    const result = f[idx.result];

    const role = POS[pos];
    if (role) {
      const nome = (f[idx.champion] || "").trim();
      if (!nome) continue;
      const c = ensure(nome);
      c.picks++;
      const r = (c.roles[role] ??= { jogos: 0, vitorias: 0 });
      r.jogos++;
      if (result === "1") {
        c.vitorias++;
        r.vitorias++;
      }
    } else if (pos === "team") {
      for (const bk of ["ban1", "ban2", "ban3", "ban4", "ban5"]) {
        const b = (f[idx[bk]] || "").trim();
        if (b && b !== "None") ensure(b).bans++;
      }
    }
  }

  const totalGames = jogos.size || 1;
  const campeoes = {};
  let incluidos = 0;

  for (const [nome, c] of Object.entries(champ)) {
    if (c.picks + c.bans < 2) continue; // descarta ruído de amostra mínima
    const rolesOrd = Object.entries(c.roles).sort((a, b) => b[1].jogos - a[1].jogos);
    const limiar = Math.max(3, c.picks * 0.08);
    const roles = rolesOrd.filter(([, v]) => v.jogos >= limiar).map(([r]) => r);
    const winrate = c.picks > 0 ? c.vitorias / c.picks : 0.5;
    const presenca = clamp((c.picks + c.bans) / totalGames, 0, 1);
    const forca = Math.round(clamp(35 + presenca * 45 + (winrate - 0.5) * 30, 30, 78));

    campeoes[normaliza(nome)] = {
      nome,
      roles: roles.length ? roles : rolesOrd[0] ? [rolesOrd[0][0]] : [],
      jogos: c.picks,
      bans: c.bans,
      winrate: Math.round(winrate * 1000) / 1000,
      presenca: Math.round(presenca * 1000) / 1000,
      forca,
    };
    incluidos++;
  }

  writeFileSync(
    SAIDA,
    JSON.stringify(
      { metadados: { totalGames, campeoes: incluidos, geradoEm: new Date().toISOString() }, campeoes },
      null,
      0,
    ),
  );
  console.log(`\nPronto! ${incluidos} campeões de ${totalGames} jogos → ${SAIDA}`);
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
