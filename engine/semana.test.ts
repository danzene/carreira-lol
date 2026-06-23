import { describe, expect, it } from "vitest";
import { LOOP } from "@/data/loop";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { avancarSemana, treinar } from "./semana";
import type { CareerState } from "./types";

function novaCarreira(): CareerState {
  return criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      campeoes: ["A", "B", "C"],
    }),
  );
}

describe("loop semanal", () => {
  it("treinar sobe o atributo e gasta energia", () => {
    const c = novaCarreira();
    const antes = c.player.atributos.mecanica;
    const energiaAntes = c.player.energia;
    const novo = treinar(c, "mecanica");
    expect(novo).not.toBeNull();
    if (!novo) return;
    expect(novo.player.atributos.mecanica).toBeGreaterThan(antes);
    expect(novo.player.energia).toBe(energiaAntes - LOOP.custoTreino);
  });

  it("treinar falha sem energia", () => {
    const c = novaCarreira();
    c.player.energia = 0;
    expect(treinar(c, "mecanica")).toBeNull();
  });

  it("avançar semana incrementa a semana (energia não muda — é em tempo real)", () => {
    const c = novaCarreira();
    c.player.energia = 10;
    const novo = avancarSemana(c, "normal");
    expect(novo.semanaAtual).toBe(c.semanaAtual + 1);
    expect(novo.player.energia).toBe(10);
  });

  it("descansar sobe a moral", () => {
    const c = novaCarreira();
    c.player.moral = 50;
    const novo = avancarSemana(c, "descanso");
    expect(novo.player.moral).toBeGreaterThan(50);
  });

  it("vira a temporada ao passar do limite de semanas", () => {
    const c = novaCarreira();
    c.semanaAtual = LOOP.semanasPorTemporada;
    const novo = avancarSemana(c, "normal");
    expect(novo.semanaAtual).toBe(1);
    expect(novo.temporada).toBe(c.temporada + 1);
  });
});
