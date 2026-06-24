import { describe, expect, it } from "vitest";
import { gerarEvento, premioEvento } from "./eventos";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState, EventoAtivo } from "./types";

function carreira(rep = 0): CareerState {
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
  c.player.reputacao = rep;
  return c;
}

describe("partidas-evento", () => {
  it("não sobrescreve um evento já ativo", () => {
    const c = carreira(80);
    const ev: EventoAtivo = { tipo: "x", nome: "X", desc: "", bonusInimigo: 0, premioDinheiro: 1, premioReputacao: 1 };
    c.eventoAtual = ev;
    expect(gerarEvento(c, 1)).toBe(ev);
  });

  it("gera algum evento elegível ao longo de várias semanas", () => {
    const c = carreira(80);
    let achou: EventoAtivo | null = null;
    for (let s = 0; s < 200 && !achou; s++) achou = gerarEvento(c, s);
    expect(achou).toBeTruthy();
  });

  it("convite internacional só aparece com reputação alta", () => {
    const baixa = carreira(0);
    for (let s = 0; s < 300; s++) {
      const ev = gerarEvento(baixa, s);
      if (ev) expect(ev.tipo).not.toBe("convite");
    }
  });

  it("premiação maior na vitória que na derrota", () => {
    const ev: EventoAtivo = { tipo: "x", nome: "X", desc: "", bonusInimigo: 0, premioDinheiro: 1000, premioReputacao: 10 };
    expect(premioEvento(ev, true).dinheiro).toBeGreaterThan(premioEvento(ev, false).dinheiro);
    expect(premioEvento(ev, true).reputacao).toBeGreaterThan(premioEvento(ev, false).reputacao);
  });
});
