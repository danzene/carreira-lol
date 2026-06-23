import { describe, expect, it } from "vitest";
import { ECONOMIA } from "@/data/economia";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import {
  alternarCoach,
  bootcampCoreia,
  comprarSetup,
  processarSemanaEconomia,
  sessaoMental,
  stream,
} from "./economia";
import type { CareerState } from "./types";

function carreira(dinheiro = 500): CareerState {
  const c = criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      campeoes: ["A", "B", "C"],
    }),
  );
  c.dinheiro = dinheiro;
  return c;
}

describe("economia", () => {
  it("renda semanal entra no dinheiro", () => {
    const c = carreira(500);
    expect(processarSemanaEconomia(c).dinheiro).toBe(500 + ECONOMIA.rendaBaseSemanal);
  });

  it("coach ativo gasta upkeep e dá XP; se faltar grana, é demitido", () => {
    const c = alternarCoach(carreira(1000));
    const depois = processarSemanaEconomia(c);
    expect(depois.dinheiro).toBe(1000 + ECONOMIA.rendaBaseSemanal - ECONOMIA.coach.upkeepSemanal);
    expect(depois.player.atributos.mecanica).toBeGreaterThan(c.player.atributos.mecanica);

    const pobre = alternarCoach(carreira(0));
    expect(processarSemanaEconomia(pobre).coachAtivo).toBe(false);
  });

  it("stream troca energia por dinheiro", () => {
    const c = carreira(100);
    const depois = stream(c);
    expect(depois).not.toBeNull();
    if (!depois) return;
    expect(depois.dinheiro).toBe(100 + ECONOMIA.stream.dinheiro);
    expect(depois.player.energia).toBe(c.player.energia - ECONOMIA.stream.energia);
  });

  it("setup sobe mecânica e não pode ser comprado duas vezes", () => {
    const c = carreira(1000);
    const depois = comprarSetup(c);
    expect(depois).not.toBeNull();
    if (!depois) return;
    expect(depois.player.atributos.mecanica).toBe(c.player.atributos.mecanica + ECONOMIA.setup.mecanica);
    expect(comprarSetup(depois)).toBeNull();
  });

  it("sessão mental sobe moral e custa dinheiro", () => {
    const c = carreira(1000);
    c.player.moral = 50;
    const depois = sessaoMental(c);
    expect(depois).not.toBeNull();
    if (!depois) return;
    expect(depois.player.moral).toBeGreaterThan(50);
    expect(depois.dinheiro).toBe(1000 - ECONOMIA.sessaoMental.custo);
  });

  it("bootcamp custa, consome semanas e dá XP; falha sem dinheiro", () => {
    const c = carreira(2000);
    const depois = bootcampCoreia(c);
    expect(depois).not.toBeNull();
    if (!depois) return;
    expect(depois.dinheiro).toBe(2000 - ECONOMIA.bootcamp.custo);
    expect(depois.semanaAtual).toBe(c.semanaAtual + ECONOMIA.bootcamp.semanas);
    expect(depois.player.atributos.macro).toBeGreaterThan(c.player.atributos.macro);
    expect(bootcampCoreia(carreira(100))).toBeNull();
  });
});
