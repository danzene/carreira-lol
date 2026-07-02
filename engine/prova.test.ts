import { describe, expect, it } from "vitest";
import {
  ajustarCtxProva,
  garantirProva,
  gerarProvaSemanal,
  podeJogarProva,
  proibidosProva,
  registrarPartidaProva,
  scoreProva,
  semanaISO,
} from "./prova";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { ContextoPartida } from "./simularPartida";
import type { CareerState, ChampionDef, Classe, MatchResult } from "./types";

function carreira(): CareerState {
  return criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["Ahri", "Zed", "Orianna"],
    }),
  );
}

const champ = (id: string, classes: Classe[]): ChampionDef => ({
  id,
  nome: id,
  classes,
  rolesValidas: ["MID"],
  perfil: { dano: 50, resistencia: 50, cc: 50, mobilidade: 50, sustain: 50 },
  forcaMetaBase: 50,
});

const resultado = (vitoria: boolean, nota = 7): MatchResult => ({
  vitoria,
  kda: { k: 8, d: 2, a: 6 },
  notaPerformance: nota,
  csPorMin: 8,
  championId: "Ahri",
  lpDelta: 0,
  xpGanho: {},
  log: [],
});

describe("prova semanal", () => {
  it("mesma semana ⇒ mesma prova e mesma seed em qualquer cliente", () => {
    expect(gerarProvaSemanal(202627)).toEqual(gerarProvaSemanal(202627));
    // semanas diferentes tendem a provas diferentes
    const provas = new Set([202601, 202602, 202603, 202604, 202605].map((s) => gerarProvaSemanal(s).modificadores.join(",")));
    expect(provas.size).toBeGreaterThan(1);
    // 1-2 modificadores, sempre válidos
    for (let s = 202601; s < 202640; s++) {
      const p = gerarProvaSemanal(s);
      expect(p.modificadores.length).toBeGreaterThanOrEqual(1);
      expect(p.modificadores.length).toBeLessThanOrEqual(2);
      if (p.modificadores.includes("so_classe")) expect(p.classeDaSemana).toBeTruthy();
    }
  });

  it("semanaISO estável dentro da mesma semana e muda na segunda-feira", () => {
    const qua = new Date(2026, 6, 1, 12).getTime(); // 01/07/2026 (quarta)
    const dom = new Date(2026, 6, 5, 23).getTime(); // domingo da mesma semana
    const seg = new Date(2026, 6, 6, 1).getTime(); // segunda seguinte
    expect(semanaISO(qua)).toBe(semanaISO(dom));
    expect(semanaISO(seg)).toBe(semanaISO(dom) + 1);
  });

  it("modificadores são honrados no contexto de partida", () => {
    const base: ContextoPartida = { championId: "A", forcaMetaCampeao: 50, comp: 62, compInimigo: 48, counterLane: 2, counterComp: 5 };
    const dobro = ajustarCtxProva(base, { semana: 1, seed: 1, modificadores: ["counters_dobro"] });
    expect(dobro.counterLane).toBe(4);
    expect(dobro.counterComp).toBe(10);
    const espelho = ajustarCtxProva(base, { semana: 1, seed: 1, modificadores: ["draft_espelhado"] });
    expect(espelho.compInimigo).toBe(espelho.comp);
    expect(espelho.counterLane).toBe(0);
    const cega = ajustarCtxProva(base, { semana: 1, seed: 1, modificadores: ["comp_cega"] });
    expect(cega.comp).toBe(50);
    expect(cega.compInimigo).toBe(50);
    const chefe = ajustarCtxProva(base, { semana: 1, seed: 1, modificadores: ["inimigos_buffados"] });
    expect(chefe.bonusInimigo).toBe(6);
  });

  it("proibidosProva filtra por maestria e por classe", () => {
    const banco = [champ("Ahri", ["MAGO"]), champ("Zed", ["ASSASSINO"]), champ("Ornn", ["TANK"])];
    const pool = [
      { championId: "Ahri", pontos: 45 },
      { championId: "Zed", pontos: 5 },
    ];
    const m20 = proibidosProva({ semana: 1, seed: 1, modificadores: ["maestria20"] }, pool, banco);
    expect(m20).toContain("Zed"); // maestria 5 < 20
    expect(m20).toContain("Ornn"); // nem está na pool
    expect(m20).not.toContain("Ahri");
    const soMago = proibidosProva({ semana: 1, seed: 1, modificadores: ["so_classe"], classeDaSemana: "MAGO" }, pool, banco);
    expect(soMago).toEqual(expect.arrayContaining(["Zed", "Ornn"]));
    expect(soMago).not.toContain("Ahri");
  });

  it("3 partidas fecham a prova com score; não deixa jogar a 4ª", () => {
    const prova = { semana: 202627, seed: 1, modificadores: [] as never[] };
    let c = garantirProva(carreira(), 202627);
    expect(podeJogarProva(c, 202627)).toBe(true);
    c = registrarPartidaProva(c, resultado(true, 8), prova);
    c = registrarPartidaProva(c, resultado(false, 6), prova);
    expect(c.prova?.finalizada).toBe(false);
    c = registrarPartidaProva(c, resultado(true, 9), prova);
    expect(c.prova?.finalizada).toBe(true);
    expect(c.prova?.scoreFinal).toBeGreaterThan(0);
    expect(podeJogarProva(c, 202627)).toBe(false);
    expect(registrarPartidaProva(c, resultado(true), prova)).toBe(c); // 4ª não entra
    // semana nova reabre
    expect(podeJogarProva(c, 202628)).toBe(true);
  });

  it("kda_rei e nota_de_ouro mudam o score como prometido", () => {
    const resultados = [
      { vitoria: true, nota: 8.5, kda: { k: 10, d: 1, a: 8 } },
      { vitoria: false, nota: 8.2, kda: { k: 9, d: 2, a: 4 } },
      { vitoria: true, nota: 6, kda: { k: 3, d: 3, a: 3 } },
    ];
    const normal = scoreProva(resultados, { semana: 1, seed: 1, modificadores: [] });
    const rei = scoreProva(resultados, { semana: 1, seed: 1, modificadores: ["kda_rei"] });
    const ouro = scoreProva(resultados, { semana: 1, seed: 1, modificadores: ["nota_de_ouro"] });
    expect(rei).not.toBe(normal); // KDA entra na conta
    expect(ouro).toBe(normal + 80); // 2 partidas com nota 8+ → +40 cada
  });
});
