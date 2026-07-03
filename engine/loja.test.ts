import { describe, expect, it } from "vitest";
import { LOJA } from "@/data/loja";
import { LOOP } from "@/data/loop";
import { registrarLoginDiario } from "./diario";
import {
  aulaParticular,
  comprarCargaCampeonato,
  comprarEnergetico,
  comprarEscudoStreak,
  comprarMegaEnergetico,
  comprarPreparacao,
  consumirPreparacao,
  vodReview,
} from "./loja";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState } from "./types";

function carreira(dinheiro = 5000): CareerState {
  const c = criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["Ahri", "Zed", "Orianna"],
    }),
  );
  return { ...c, dinheiro };
}

describe("loja (sinks de $)", () => {
  it("energético: +30⚡ com cap 100; não compra com barra cheia nem sem $", () => {
    const c = { ...carreira(), player: { ...carreira().player, energia: 50 } };
    const r = comprarEnergetico(c)!;
    expect(r.player.energia).toBe(80);
    expect(r.dinheiro).toBe(c.dinheiro - LOJA.energetico.custo);
    expect(comprarEnergetico({ ...c, player: { ...c.player, energia: 100 } })).toBeNull();
    expect(comprarEnergetico({ ...c, dinheiro: 10 })).toBeNull();
    // mega enche
    expect(comprarMegaEnergetico(c)!.player.energia).toBe(100);
  });

  it("carga de campeonato: +1 respeitando o teto", () => {
    const agora = 1_000_000;
    const c = { ...carreira(), cargasPartida: 1, cargasEm: agora };
    const r = comprarCargaCampeonato(c, agora)!;
    expect(r.cargasPartida).toBe(2);
    expect(r.dinheiro).toBe(c.dinheiro - LOJA.cargaCampeonato.custo);
    const cheio = { ...carreira(), cargasPartida: LOOP.maxCargasPartida, cargasEm: agora };
    expect(comprarCargaCampeonato(cheio, agora)).toBeNull();
  });

  it("escudo de streak: só repõe se foi CONSUMIDO", () => {
    // login dia 1, pula 1 dia → escudo consumido no dia 3
    const l1 = registrarLoginDiario(carreira(), "2026-07-01");
    const l2 = registrarLoginDiario(l1.career, "2026-07-03");
    expect(l2.evento).toBe("escudo");
    const r = comprarEscudoStreak(l2.career, "2026-07-03")!;
    expect(r.diario?.escudoUsadoEm).toBeUndefined(); // escudo de volta
    expect(r.dinheiro).toBe(l2.career.dinheiro - LOJA.escudoStreak.custo);
    // com escudo disponível não vende
    expect(comprarEscudoStreak(l1.career, "2026-07-01")).toBeNull();
    expect(comprarEscudoStreak(carreira(), "2026-07-01")).toBeNull(); // sem streak ainda
  });

  it("preparação: única, e consome ao jogar", () => {
    const c = carreira();
    const r = comprarPreparacao(c)!;
    expect(r.preparacao).toBe(true);
    expect(comprarPreparacao(r)).toBeNull(); // já preparado
    const usado = consumirPreparacao(r);
    expect(usado.preparacao).toBeUndefined();
    expect(consumirPreparacao(c)).toBe(c); // sem preparação = mesma ref
  });

  it("VOD review: +maestria só em campeão DA POOL, com cap", () => {
    const c = carreira();
    const antes = c.player.pool.find((p) => p.championId === "Ahri")!.pontos;
    const r = vodReview(c, "Ahri")!;
    expect(r.player.pool.find((p) => p.championId === "Ahri")!.pontos).toBeCloseTo(antes + LOJA.vodReview.maestria, 1);
    expect(vodReview(c, "Yasuo")).toBeNull(); // fora da pool
  });

  it("aula particular: +atributo à escolha sem gastar energia", () => {
    const c = carreira();
    const energiaAntes = c.player.energia;
    const r = aulaParticular(c, "macro")!;
    expect(r.player.atributos.macro).toBeCloseTo(c.player.atributos.macro + LOJA.aulaParticular.xp, 2);
    expect(r.player.energia).toBe(energiaAntes); // sem custo de energia
    expect(r.dinheiro).toBe(c.dinheiro - LOJA.aulaParticular.custo);
  });
});
