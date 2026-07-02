import { describe, expect, it } from "vitest";
import { ECONOMIA } from "@/data/economia";
import { atributosIniciais, criarCareerState, criarPlayer, normalizarCareer } from "./player";
import { alternarCoach, bootcampCoreia, processarSemanaEconomia, sessaoMental } from "./economia";
import type { CareerState } from "./types";

function carreira(dinheiro = 500): CareerState {
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
  c.dinheiro = dinheiro;
  return c;
}

describe("economia + equipamentos", () => {
  it("salário base entra ao processar a semana", () => {
    expect(processarSemanaEconomia(carreira(500)).dinheiro).toBe(500 + ECONOMIA.rendaBaseSemanal);
  });

  it("coach gasta upkeep e dá XP; demite se faltar grana", () => {
    const rico = processarSemanaEconomia(alternarCoach(carreira(1000)));
    expect(rico.dinheiro).toBe(1000 + ECONOMIA.rendaBaseSemanal - ECONOMIA.coach.upkeepSemanal);
    expect(rico.player.atributos.mecanica).toBeGreaterThan(40);
    expect(processarSemanaEconomia(alternarCoach(carreira(0))).coachAtivo).toBe(false);
  });

  it("sessão mental sobe moral e custa dinheiro", () => {
    const c = carreira(1000);
    c.player.moral = 50;
    const novo = sessaoMental(c);
    expect(novo?.player.moral).toBeGreaterThan(50);
    expect(novo?.dinheiro).toBe(1000 - ECONOMIA.sessaoMental.custo);
  });

  it("bootcamp custa, consome semanas e dá XP; falha sem grana", () => {
    const novo = bootcampCoreia(carreira(2000));
    expect(novo?.dinheiro).toBe(2000 - ECONOMIA.bootcamp.custo);
    expect(novo?.semanaAtual).toBe(1 + ECONOMIA.bootcamp.semanas);
    expect(novo?.player.atributos.macro).toBeGreaterThan(40);
    expect(bootcampCoreia(carreira(100))).toBeNull();
  });

  it("periféricos antigos são REEMBOLSADOS em $ na migração (sistema removido)", () => {
    const c = carreira(500);
    // save antigo com mouse nível 2 (investiu 200 + 450 = 650) e headset nível 1 (200)
    c.equipamentos = [
      { tipo: "MOUSE", nivel: 2, bonus: { mecanica: 4 } },
      { tipo: "HEADSET", nivel: 1, bonus: { comunicacao: 2 } },
    ];
    const m = normalizarCareer(c);
    expect(m.equipamentos).toEqual([]);
    expect(m.dinheiro).toBe(500 + 650 + 200);
    // idempotente: migrar de novo não paga de novo
    expect(normalizarCareer(m).dinheiro).toBe(m.dinheiro);
  });
});
