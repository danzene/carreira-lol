import { describe, expect, it } from "vitest";
import { ECONOMIA, EQUIP_MAX_NIVEL } from "@/data/economia";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import {
  alternarCoach,
  bonusEquipamentos,
  bootcampCoreia,
  processarSemanaEconomia,
  sessaoMental,
  upgradeEquip,
} from "./economia";
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

  it("upgrade de periférico sobe nível, dá bônus e custa; respeita o teto", () => {
    let c = carreira(99999);
    const r = upgradeEquip(c, "MOUSE");
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.equipamentos.find((e) => e.tipo === "MOUSE")?.nivel).toBe(1);
    expect(bonusEquipamentos(r.equipamentos).mecanica).toBeGreaterThan(0);

    c = r;
    for (let i = 1; i < EQUIP_MAX_NIVEL; i++) {
      const up = upgradeEquip(c, "MOUSE");
      if (up) c = up;
    }
    expect(upgradeEquip(c, "MOUSE")).toBeNull(); // no teto
  });
});
