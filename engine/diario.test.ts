import { describe, expect, it } from "vitest";
import {
  coletarDiaria,
  diaDoCiclo,
  escudoDisponivel,
  marcarPuxadaGratis,
  marcoStreak,
  podeColetarDiaria,
  puxadaGratisDisponivel,
  recompensaDoDia,
  registrarLoginDiario,
} from "./diario";
import { acumularDrop, acumularPartida, fecharSemanaStats, statsVazias } from "./statsSemana";
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

describe("registrarLoginDiario", () => {
  it("primeiro login cria streak 1; mesmo dia não muda nada (mesma ref)", () => {
    const r1 = registrarLoginDiario(carreira(), "2026-07-01");
    expect(r1.evento).toBe("primeiro");
    expect(r1.streak).toBe(1);
    const r2 = registrarLoginDiario(r1.career, "2026-07-01");
    expect(r2.evento).toBe("mesmo_dia");
    expect(r2.career).toBe(r1.career);
  });

  it("dia seguinte sobe o streak", () => {
    const r1 = registrarLoginDiario(carreira(), "2026-07-01");
    const r2 = registrarLoginDiario(r1.career, "2026-07-02");
    expect(r2.evento).toBe("continuou");
    expect(r2.streak).toBe(2);
  });

  it("1 dia perdido consome o escudo em vez de zerar", () => {
    const r1 = registrarLoginDiario(carreira(), "2026-07-01");
    const r2 = registrarLoginDiario(r1.career, "2026-07-03"); // pulou o dia 2
    expect(r2.evento).toBe("escudo");
    expect(r2.streak).toBe(2);
    expect(escudoDisponivel(r2.career.diario, "2026-07-04")).toBe(false); // só 1/semana
    // perder de novo na mesma semana (sem escudo) → zera
    const r3 = registrarLoginDiario(r2.career, "2026-07-05");
    expect(r3.evento).toBe("zerou");
    expect(r3.streak).toBe(1);
  });

  it("2+ dias perdidos zeram mesmo com escudo", () => {
    const r1 = registrarLoginDiario(carreira(), "2026-07-01");
    const r2 = registrarLoginDiario(r1.career, "2026-07-05");
    expect(r2.evento).toBe("zerou");
  });
});

describe("recompensas do streak", () => {
  it("ciclo semanal: dia 8 volta pro dia 1; dia 7 = item", () => {
    expect(diaDoCiclo(1)).toBe(1);
    expect(diaDoCiclo(7)).toBe(7);
    expect(diaDoCiclo(8)).toBe(1);
    expect(recompensaDoDia(7).tipo).toBe("item");
    expect(recompensaDoDia(14).tipo).toBe("item");
  });

  it("marcos: 3 dias e múltiplos de 7", () => {
    expect(marcoStreak(3)).toBe(true);
    expect(marcoStreak(7)).toBe(true);
    expect(marcoStreak(5)).toBe(false);
  });

  it("coletarDiaria aplica $ e só uma vez por dia", () => {
    const r = registrarLoginDiario(carreira(), "2026-07-01");
    expect(podeColetarDiaria(r.career, "2026-07-01")).toBe(true);
    const col = coletarDiaria(r.career, "2026-07-01");
    expect(col).not.toBeNull();
    expect(col!.career.dinheiro).toBe(r.career.dinheiro + 150); // dia 1 = $150
    expect(coletarDiaria(col!.career, "2026-07-01")).toBeNull(); // já coletou hoje
  });

  it("energia respeita o teto 100", () => {
    const r1 = registrarLoginDiario(carreira(), "2026-07-01");
    const r2 = registrarLoginDiario(r1.career, "2026-07-02"); // streak 2 → +30 energia
    const cheio = { ...r2.career, player: { ...r2.career.player, energia: 95 } };
    const col = coletarDiaria(cheio, "2026-07-02");
    expect(col!.career.player.energia).toBe(100);
  });
});

describe("puxada grátis diária", () => {
  it("disponível 1x por dia", () => {
    const c = carreira();
    expect(puxadaGratisDisponivel(c, "2026-07-01")).toBe(true);
    const usado = marcarPuxadaGratis(c, "2026-07-01");
    expect(puxadaGratisDisponivel(usado, "2026-07-01")).toBe(false);
    expect(puxadaGratisDisponivel(usado, "2026-07-02")).toBe(true);
  });
});

describe("statsSemana", () => {
  const partida = (over: Partial<MatchResult>): MatchResult => ({
    vitoria: true,
    kda: { k: 5, d: 2, a: 7 },
    notaPerformance: 7.2,
    csPorMin: 8,
    championId: "Ahri",
    lpDelta: 18,
    xpGanho: {},
    log: [],
    ...over,
  });

  it("acumula partidas, vitórias, melhor KDA/nota e LP líquido", () => {
    let c = acumularPartida(carreira(), partida({}));
    c = acumularPartida(c, partida({ vitoria: false, lpDelta: -15, kda: { k: 10, d: 1, a: 8 }, notaPerformance: 9.1 }));
    expect(c.statsSemana!.partidas).toBe(2);
    expect(c.statsSemana!.vitorias).toBe(1);
    expect(c.statsSemana!.lpLiquido).toBe(3);
    expect(c.statsSemana!.melhorNota).toBe(9.1);
    expect(c.statsSemana!.melhorKda).toEqual({ k: 10, d: 1, a: 8 });
  });

  it("acumula drops por raridade e fecharSemanaStats vira a semana", () => {
    let c = acumularDrop(carreira(), 4);
    c = acumularDrop(c, 4);
    c = acumularDrop(c, 2);
    expect(c.statsSemana!.dropsPorRaridade).toEqual({ 4: 2, 2: 1 });
    const virado = fecharSemanaStats(c);
    expect(virado.statsSemanaAnterior).toEqual(c.statsSemana);
    expect(virado.statsSemana).toEqual(statsVazias());
  });
});
