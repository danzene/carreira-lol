import { describe, expect, it } from "vitest";
import { LOOP } from "@/data/loop";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { alteracaoMental, avancarSemana, descansar, streaming, treinar } from "./loop";
import type { CareerState } from "./types";

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

describe("loop semanal", () => {
  it("treino focado sobe o atributo e gasta energia", () => {
    const c = carreira();
    const novo = treinar(c, "mecanica");
    expect(novo).not.toBeNull();
    if (!novo) return;
    expect(novo.player.atributos.mecanica).toBeGreaterThan(c.player.atributos.mecanica);
    expect(novo.player.energia).toBe(c.player.energia - LOOP.custoTreino);
  });

  it("treino especial dá mais XP que o focado", () => {
    const c = carreira();
    const foc = treinar(c, "mecanica", false);
    const esp = treinar(c, "mecanica", true);
    expect(esp && foc && esp.player.atributos.mecanica > foc.player.atributos.mecanica).toBe(true);
  });

  it("streaming dá dinheiro e gasta energia", () => {
    const c = carreira();
    const novo = streaming(c);
    expect(novo).not.toBeNull();
    if (!novo) return;
    expect(novo.dinheiro).toBe(c.dinheiro + LOOP.ganhoStream);
    expect(novo.player.energia).toBe(c.player.energia - LOOP.custoStream);
  });

  it("alteração mental ganha um traço novo (não duplica)", () => {
    const c = carreira();
    const novo = alteracaoMental(c, "CLUTCH");
    expect(novo?.player.tracos).toContain("CLUTCH");
    if (!novo) return;
    expect(alteracaoMental(novo, "CLUTCH")).toBeNull(); // já tem
  });

  it("descansar recupera energia e moral", () => {
    const c = carreira();
    c.player.energia = 20;
    c.player.moral = 50;
    const novo = descansar(c);
    expect(novo.player.energia).toBeGreaterThan(20);
    expect(novo.player.moral).toBeGreaterThan(50);
  });

  it("avançar semana incrementa a semana e recupera energia; vira a temporada", () => {
    const c = carreira();
    c.player.energia = 10;
    const novo = avancarSemana(c);
    expect(novo.semanaAtual).toBe(c.semanaAtual + 1);
    expect(novo.player.energia).toBeGreaterThan(10);

    const fimDeTemp = carreira();
    fimDeTemp.semanaAtual = LOOP.semanasPorTemporada;
    const vira = avancarSemana(fimDeTemp);
    expect(vira.semanaAtual).toBe(1);
    expect(vira.temporada).toBe(fimDeTemp.temporada + 1);
  });
});
