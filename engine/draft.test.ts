import { describe, expect, it } from "vitest";
import {
  aplicarEscolha,
  draftCompleto,
  escolhaIA,
  forcaComp,
  iniciarDraft,
  ordemDraft,
  passosCoach,
  vocePica,
} from "./draft";
import type { ChampionDef, Role } from "./types";

function def(id: string, roles: Role[], meta = 50): ChampionDef {
  return {
    id,
    nome: id,
    classes: ["LUTADOR"],
    rolesValidas: roles,
    perfil: { dano: 50, resistencia: 50, cc: 50, mobilidade: 50, sustain: 50 },
    forcaMetaBase: meta,
  };
}

// banco com 5 campeões por rota (25 no total) — suficiente p/ um draft inteiro (20).
const ROLES_T: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
const BANCO: ChampionDef[] = ROLES_T.flatMap((r, ri) =>
  Array.from({ length: 5 }, (_, i) => def(`${r}${i}`, [r], 45 + ((ri * 3 + i * 2) % 18))),
);

describe("draft (pick & ban)", () => {
  it("a ordem tem 20 passos, 5 bans e 5 picks por time", () => {
    const o = ordemDraft();
    expect(o).toHaveLength(20);
    expect(o.filter((p) => p.fase === "ban" && p.time === "azul")).toHaveLength(5);
    expect(o.filter((p) => p.fase === "pick" && p.time === "vermelho")).toHaveLength(5);
  });

  it("aplicar escolha avança o passo e marca o campeão como usado", () => {
    let e = iniciarDraft();
    e = aplicarEscolha(e, "Mid1");
    expect(e.passo).toBe(1);
    expect(e.usados).toContain("Mid1");
    expect(aplicarEscolha(e, "Mid1")).toBe(e); // já usado: não muda
  });

  it("a IA escolhe sempre um campeão disponível", () => {
    let e = iniciarDraft();
    for (let i = 0; i < 6; i++) {
      const id = escolhaIA(e, BANCO);
      expect(e.usados).not.toContain(id);
      e = aplicarEscolha(e, id);
    }
  });

  it("um draft inteiro pela IA completa com 5 picks por time", () => {
    let e = iniciarDraft();
    while (!draftCompleto(e)) e = aplicarEscolha(e, escolhaIA(e, BANCO));
    expect(e.picks.azul).toHaveLength(5);
    expect(e.picks.vermelho).toHaveLength(5);
    const fc = forcaComp(e, BANCO);
    expect(fc.azul).toBeGreaterThanOrEqual(0);
    expect(fc.azul).toBeLessThanOrEqual(100);
  });

  it("voz no draft: reputação baixa deixa o coach assumir picks", () => {
    expect(passosCoach(5)).toBe(2);
    expect(passosCoach(60)).toBe(0);
    const e = iniciarDraft();
    // primeiro passo é ban do azul → é seu
    expect(vocePica(e, 5)).toBe(true);
  });
});
