import { describe, expect, it } from "vitest";
import { LOOP } from "@/data/loop";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { cargasPartida, consumirCarga, energiaAgora, inicializarTempo, proximoUsoEm, registrarUso, usosRestantes } from "./tempo";
import type { CareerState } from "./types";

function carreira(energia: number, energiaEm?: number): CareerState {
  const c = criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
  );
  return { ...c, energiaEm, player: { ...c.player, energia } };
}

const AGORA = 1_700_000_000_000;

describe("tempo (progressão por tempo real)", () => {
  it("energia regenera proporcional ao tempo (2h => 100)", () => {
    const meia = carreira(0, AGORA - LOOP.energiaCheiaMs / 2);
    const e = energiaAgora(meia, AGORA);
    expect(e).toBeGreaterThan(45);
    expect(e).toBeLessThan(55);
  });

  it("energia satura em 100", () => {
    const cheia = carreira(80, AGORA - LOOP.energiaCheiaMs);
    expect(energiaAgora(cheia, AGORA)).toBe(100);
  });

  it("limite de usos por janela", () => {
    expect(usosRestantes([], AGORA)).toBe(LOOP.maxPassesJanela);
    const cheio = Array(LOOP.maxPassesJanela).fill(AGORA);
    expect(usosRestantes(cheio, AGORA)).toBe(0);
    expect(proximoUsoEm(cheio, AGORA)).toBeGreaterThan(0);

    const antigos = Array(LOOP.maxPassesJanela).fill(AGORA - LOOP.janelaPassesMs - 1);
    expect(usosRestantes(antigos, AGORA)).toBe(LOOP.maxPassesJanela);
    expect(proximoUsoEm(antigos, AGORA)).toBe(0);
  });

  it("registrarUso adiciona o novo e descarta os fora da janela", () => {
    const ts = registrarUso([AGORA - LOOP.janelaPassesMs - 1], AGORA);
    expect(ts).toEqual([AGORA]);
  });

  it("cargas de partida começam cheias e regeneram por tempo", () => {
    expect(cargasPartida(carreira(0), AGORA)).toBe(LOOP.maxCargasPartida);

    const umaCarga = { ...carreira(0), cargasPartida: 0, cargasEm: AGORA - LOOP.cargaPartidaMs };
    expect(cargasPartida(umaCarga, AGORA)).toBeCloseTo(1, 4);

    const acima = { ...carreira(0), cargasPartida: LOOP.maxCargasPartida, cargasEm: AGORA - LOOP.cargaPartidaMs * 5 };
    expect(cargasPartida(acima, AGORA)).toBe(LOOP.maxCargasPartida); // satura
  });

  it("consumirCarga desconta uma carga", () => {
    const apos = consumirCarga({ ...carreira(0), cargasPartida: 2, cargasEm: AGORA }, AGORA);
    expect(apos.cargasPartida).toBe(1);
  });

  it("inicializarTempo cria os relógios faltantes (pra contar offline) sem sobrescrever", () => {
    const init = inicializarTempo(carreira(50), AGORA);
    expect(init.energiaEm).toBe(AGORA);
    expect(init.cargasEm).toBe(AGORA);

    const comRelogio = { ...carreira(50), energiaEm: 123, cargasEm: 456 };
    const r = inicializarTempo(comRelogio, AGORA);
    expect(r).toBe(comRelogio); // já tinha tudo → mesmo objeto
    expect(r.energiaEm).toBe(123);
  });
});
