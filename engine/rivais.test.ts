import { describe, expect, it } from "vitest";
import { atualizarRecords, recordsVazios } from "./records";
import { aplicarBonusRival, ehRival, registrarConfronto, RIVAL } from "./rivais";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState, MatchResult } from "./types";

function carreira(): CareerState {
  return criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
  );
}

describe("rivalidades (máquina de estados)", () => {
  it("2 derrotas seguidas viram RIVAL; vencer antes esfria a rixa", () => {
    let c = carreira();
    let r = registrarConfronto(c, "FRC", false);
    expect(r.evento).toBeNull();
    r = registrarConfronto(r.career, "FRC", true); // venceu → esfria
    expect(ehRival(r.career, "FRC")).toBe(false);
    r = registrarConfronto(r.career, "FRC", false);
    r = registrarConfronto(r.career, "FRC", false);
    expect(r.evento).toBe("virou_rival");
    expect(ehRival(r.career, "FRC")).toBe(true);
  });

  it("2 vitórias contra o rival = SUPERADO (perder no meio zera o progresso)", () => {
    let c = carreira();
    let r = registrarConfronto(c, "FRC", false);
    r = registrarConfronto(r.career, "FRC", false); // virou rival
    r = registrarConfronto(r.career, "FRC", true); // 1 vitória
    expect(r.evento).toBeNull();
    r = registrarConfronto(r.career, "FRC", false); // perdeu → zera progresso
    r = registrarConfronto(r.career, "FRC", true);
    expect(r.evento).toBeNull(); // só 1 vitória de novo
    r = registrarConfronto(r.career, "FRC", true);
    expect(r.evento).toBe("superado");
    expect(ehRival(r.career, "FRC")).toBe(false);
  });

  it("rivalidades são por adversário (independentes)", () => {
    let r = registrarConfronto(carreira(), "A", false);
    r = registrarConfronto(r.career, "A", false);
    expect(ehRival(r.career, "A")).toBe(true);
    expect(ehRival(r.career, "B")).toBe(false);
  });

  it("bônus de vencer rival: moral (cap 100) + dinheiro", () => {
    const c = carreira();
    const novo = aplicarBonusRival(c);
    expect(novo.dinheiro).toBe(c.dinheiro + RIVAL.bonusDinheiro);
    expect(novo.player.moral).toBe(Math.min(100, c.player.moral + RIVAL.bonusMoral));
  });
});

describe("Hall da Carreira (records)", () => {
  const partida = (over: Partial<MatchResult>): MatchResult => ({
    vitoria: true,
    kda: { k: 5, d: 2, a: 7 },
    notaPerformance: 7,
    csPorMin: 8,
    championId: "Ahri",
    lpDelta: 18,
    xpGanho: {},
    log: [],
    ...over,
  });

  it("atualiza recordes e registra o elo pisado pela primeira vez", () => {
    const c = carreira();
    const r1 = atualizarRecords(c, partida({}));
    expect(r1.career.records!.maisKills).toBe(5);
    expect(r1.career.records!.melhorNota).toBe(7);
    expect(r1.career.records!.elosAlcancados).toContain(c.player.rankSoloq.elo);
    // partida pior não rebaixa recorde
    const r2 = atualizarRecords(r1.career, partida({ kda: { k: 1, d: 5, a: 2 }, notaPerformance: 3 }));
    expect(r2.career.records!.maisKills).toBe(5);
    expect(r2.career.records!.melhorNota).toBe(7);
  });

  it("recorde notável (acima do piso) dispara cerimônia; abaixo não", () => {
    const c = carreira();
    const semCerimonia = atualizarRecords(c, partida({ kda: { k: 8, d: 2, a: 4 } }));
    expect(semCerimonia.cerimonias.filter((x) => x.tipo === "ACHIEVEMENT_UNLOCKED" && x.id === "rec_kills")).toHaveLength(0);
    const comCerimonia = atualizarRecords(c, partida({ kda: { k: 14, d: 2, a: 4 }, notaPerformance: 9.5 }));
    const ids = comCerimonia.cerimonias.map((x) => (x.tipo === "ACHIEVEMENT_UNLOCKED" ? x.id : ""));
    expect(ids).toContain("rec_kills");
    expect(ids).toContain("rec_nota");
  });

  it("recordsVazios é o ponto de partida", () => {
    expect(recordsVazios().maiorStreak).toBe(0);
  });
});
