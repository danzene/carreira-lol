import { describe, expect, it } from "vitest";
import { SKILLS, SKILL_SLOTS, defSkill } from "@/data/skills";
import {
  comprarSkillGrind,
  equiparSkillGrind,
  estadoGrindInicial,
  jornadaDoGrind,
  modsExpedicaoDoGrind,
  normalizarGrind,
  respecSkillsGrind,
  type EstadoGrind,
} from "./grind";
import {
  bloqueioSkill,
  comprarSkill,
  custoSkill,
  equiparSkill,
  modsSkills,
  respecSkills,
  slotsVazios,
  sucataInvestidaSkills,
  type Skills,
} from "./skills";
import { criarCareerState } from "./player";
import type { Attributes, CareerState, Player } from "./types";

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function jogador(): Player {
  return {
    nome: "Teste", nacionalidade: "Brasil", idade: 17, rota: "MID", atributos: attrs(50),
    pool: [{ championId: "Ahri", pontos: 50 }], tracos: [], reputacao: 10,
    rankSoloq: { elo: "Prata IV", lp: 40, mmr: 1600, streak: 0 }, energia: 80, moral: 60,
  };
}

function carreira(patch: Partial<EstadoGrind> = {}): CareerState {
  const c = criarCareerState(jogador());
  return { ...c, unlocksLegacy: true, grind: { ...estadoGrindInicial("2026-07-10", 1), ...patch } };
}

describe("skills — compra, slots e mods (economia fechada)", () => {
  it("compra: custo escala por nível, bloqueia no máximo e sem Sucata; SÓ Sucata sai", () => {
    const giro = defSkill("giro")!;
    expect(bloqueioSkill({}, 0, "giro")).toBe("sucata");
    expect(bloqueioSkill({ giro: giro.nivelMax }, 99999, "giro")).toBe("max");

    let skills: Skills = {};
    let sucata = 100000;
    for (let n = 0; n < giro.nivelMax; n++) {
      const r = comprarSkill(skills, sucata, "giro")!;
      expect(sucata - r.sucata).toBe(custoSkill(giro, n)); // custo exato do nível
      skills = r.skills;
      sucata = r.sucata;
    }
    expect(comprarSkill(skills, sucata, "giro")).toBeNull(); // maxada

    // wrapper de CareerState: $ e CoinPoints jamais mudam ao comprar skill
    const c = carreira({ sucata: 500 });
    const compra = comprarSkillGrind(c, "muralha")!;
    expect(compra.career.grind!.sucata).toBe(500 - custoSkill(defSkill("muralha")!, 0));
    expect(compra.career.dinheiro).toBe(c.dinheiro);
    expect(compra.career.scoutPontos).toBe(c.scoutPontos);
  });

  it("slots: precisa nível ≥1, sem duplicata, e SÓ equipada aplica efeito", () => {
    const skills: Skills = { giro: 3, muralha: 2 };
    let slots = slotsVazios();
    expect(equiparSkill(slots, skills, 0, "furia")).toBe(slots); // sem nível → recusa
    slots = equiparSkill(slots, skills, 0, "giro");
    slots = equiparSkill(slots, skills, 1, "muralha");
    expect(slots[0]).toBe("giro");
    // mover pro slot 2 remove do 0 (sem duplicata)
    const movido = equiparSkill(slots, skills, 2, "giro");
    expect(movido[0]).toBeNull();
    expect(movido[2]).toBe("giro");

    // efeito: comprada mas NÃO equipada = zero
    expect(modsSkills(skills, slotsVazios()).poder).toBe(0);
    const m = modsSkills(skills, slots);
    expect(m.poder).toBe(3 * defSkill("giro")!.efeito.poder!);
    expect(m.escudo).toBeCloseTo(2 * defSkill("muralha")!.efeito.escudo!, 5);
  });

  it("caps duros: poder ≤15 e escudo ≤35% mesmo com tudo maxado (nunca imortal)", () => {
    const todas: Skills = Object.fromEntries(SKILLS.map((s) => [s.id, s.nivelMax]));
    const slots = ["giro", "flechas", "foco"]; // maior soma de poder possível
    const m = modsSkills(todas, slots);
    expect(m.poder).toBeLessThanOrEqual(15);
    const defensivas = ["muralha", "foco", "vampirismo"];
    expect(modsSkills(todas, defensivas).escudo).toBeLessThanOrEqual(0.35);
  });

  it("respec grátis devolve EXATO e esvazia slots; roundtrip de save preserva tudo", () => {
    let c = carreira({ sucata: 1000 });
    c = comprarSkillGrind(c, "giro")!.career;
    c = comprarSkillGrind(c, "giro")!.career;
    c = comprarSkillGrind(c, "vampirismo")!.career;
    c = equiparSkillGrind(c, 0, "giro");
    const investido = sucataInvestidaSkills(c.grind!.skills);
    expect(investido).toBeGreaterThan(0);

    // roundtrip de save (JSON → normalizar) preserva skills e slots
    const round = normalizarGrind(JSON.parse(JSON.stringify(c.grind)))!;
    expect(round.skills).toEqual(c.grind!.skills);
    expect(round.skillSlots).toEqual(c.grind!.skillSlots);

    const dep = respecSkillsGrind(c);
    expect(dep.grind!.sucata).toBe(c.grind!.sucata + investido);
    expect(dep.grind!.skills).toEqual({});
    expect(dep.grind!.skillSlots.every((s) => s === null)).toBe(true);
  });

  it("save sujo é saneado: skill inexistente some, nível clampa, slot sem nível esvazia", () => {
    const g = normalizarGrind({
      ...estadoGrindInicial("2026-07-10", 1),
      skills: { giro: 999, hack: 5, muralha: "a" },
      skillSlots: ["giro", "giro", "hack", "extra"],
    })!;
    expect(g.skills).toEqual({ giro: defSkill("giro")!.nivelMax });
    expect(g.skillSlots.length).toBe(SKILL_SLOTS);
    expect(g.skillSlots[0]).toBe("giro");
    expect(g.skillSlots[1]).toBeNull(); // duplicata caiu
    expect(g.skillSlots[2]).toBeNull(); // inexistente caiu
  });
});

describe("skills — integração com Jornada e Desafio (nunca poder de carreira)", () => {
  it("poder equipado entra na força ALIADA da jornada (empurra a parede)", () => {
    const sem = jornadaDoGrind(carreira().grind)!;
    const c = carreira({ skills: { giro: 5 }, skillSlots: ["giro", null, null] });
    const com = jornadaDoGrind(c.grind)!;
    expect(com.forcaAliada).toBeGreaterThan(sem.forcaAliada);
    expect(com.forcaAliada - sem.forcaAliada).toBe(5 * defSkill("giro")!.efeito.poder!);
  });

  it("escudo/cura/hp equipados entram nos mods do modo ativo", () => {
    const c = carreira({
      skills: { muralha: 5, vampirismo: 3, furia: 2 },
      skillSlots: ["muralha", "vampirismo", "furia"],
    });
    const m = modsExpedicaoDoGrind(c.grind);
    expect(m.danoMult).toBeLessThan(1); // escudo reduz o dano
    expect(m.danoMult).toBeGreaterThanOrEqual(0.5); // mas nunca imortal
    expect(m.curaExtra).toBeCloseTo(3 * defSkill("vampirismo")!.efeito.cura!, 5);
    expect(m.bonusHp).toBe(2 * defSkill("furia")!.efeito.hp!);
  });

  it("REGRA (lista proibida): efeitos de skill só tocam o TREINO — whitelist varrida", () => {
    const PERMITIDOS = new Set(["poder", "escudo", "cura", "hp"]);
    for (const s of SKILLS) {
      for (const k of Object.keys(s.efeito)) expect(PERMITIDOS.has(k)).toBe(true);
    }
    // e o snapshot de duelo ranqueado continua sem NADA de skill
    const c = carreira({ skills: { giro: 5 }, skillSlots: ["giro", null, null] });
    expect(JSON.stringify(c.player)).not.toContain("giro"); // skills vivem no grind, não no player
  });
});
