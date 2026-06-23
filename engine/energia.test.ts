import { describe, expect, it } from "vitest";
import { LOOP } from "@/data/loop";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { regenerarEnergia, tempoAteProxima } from "./energia";
import type { CareerState } from "./types";

function carreira(energia: number, energiaEm?: number): CareerState {
  const c = criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      campeoes: ["A", "B", "C"],
    }),
  );
  c.player.energia = energia;
  if (energiaEm !== undefined) c.energiaEm = energiaEm;
  return c;
}

const MIN = 60 * 1000;

describe("energia em tempo real", () => {
  it("não regenera sem tempo passado", () => {
    const agora = 1_000_000;
    expect(regenerarEnergia(carreira(50, agora), agora).player.energia).toBe(50);
  });

  it("regenera 1 a cada intervalo configurado", () => {
    const agora = 1_000_000;
    const depois = agora + LOOP.energiaPorMinutos * MIN * 3;
    expect(regenerarEnergia(carreira(50, agora), depois).player.energia).toBe(53);
  });

  it("não passa do teto de 100", () => {
    const agora = 1_000_000;
    const depois = agora + LOOP.energiaPorMinutos * MIN * 10;
    expect(regenerarEnergia(carreira(98, agora), depois).player.energia).toBe(100);
  });

  it("tempoAteProxima é 0 quando está cheia", () => {
    expect(tempoAteProxima(carreira(100, 1), 2)).toBe(0);
  });

  it("tempoAteProxima diminui conforme o tempo passa", () => {
    const agora = 1_000_000;
    const c = carreira(50, agora);
    const intervalo = LOOP.energiaPorMinutos * MIN;
    expect(tempoAteProxima(c, agora + intervalo / 2)).toBeLessThan(intervalo);
  });
});
