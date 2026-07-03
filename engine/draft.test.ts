import { describe, expect, it } from "vitest";
import {
  aplicarEscolha,
  atribuirRotas,
  draftCompleto,
  escolhaIA,
  forcaComp,
  iniciarDraft,
  ordemDraft,
  passosCoach,
  vocePica,
} from "./draft";
import { criarRng } from "./rng";
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

  it("FLEX PICK: campeão vai pra rota ESCOLHIDA, mesmo fora das rolesValidas (Yasuo ADC)", () => {
    const defMap = Object.fromEntries(BANCO.map((c) => [c.id, c]));
    // pula os 6 bans pra chegar no primeiro pick (azul)
    let e = iniciarDraft();
    for (let i = 0; i < 6; i++) e = aplicarEscolha(e, escolhaIA(e, BANCO));
    // "Mid0" só tem MID nas rolesValidas — fixado na ADC pelo flex pick
    e = aplicarEscolha(e, "Mid0", "ADC");
    expect(e.rotas.azul.ADC).toBe("Mid0");
    const rotas = atribuirRotas(e.picks.azul, defMap, e.rotas.azul);
    expect(rotas.find((r) => r.role === "ADC")?.id).toBe("Mid0");
    // rota já fixada não é sobrescrita pelo próximo flex
    let e2 = e;
    while (passosCoach(0) >= 0 && e2.ordem[e2.passo]?.time !== "azul") e2 = aplicarEscolha(e2, escolhaIA(e2, BANCO));
    e2 = aplicarEscolha(e2, "Top0", "ADC");
    expect(e2.rotas.azul.ADC).toBe("Mid0"); // continua o primeiro
    // sem rota = atribuição automática (comportamento antigo)
    const auto = atribuirRotas(["Top0", "Jungle0"], defMap);
    expect(auto.find((r) => r.role === "TOP")?.id).toBe("Top0");
  });

  it("a IA escolhe sempre um campeão disponível", () => {
    let e = iniciarDraft();
    for (let i = 0; i < 6; i++) {
      const id = escolhaIA(e, BANCO);
      expect(e.usados).not.toContain(id);
      e = aplicarEscolha(e, id);
    }
  });

  it("SOLOQ varia entre partidas; COMPETITIVO fica nos melhores da meta", () => {
    // soloq: seeds diferentes → lobbies diferentes (nem sempre os mesmos picks)
    const draftCom = (seed: number) => {
      const rng = criarRng(seed);
      let e = iniciarDraft();
      while (!draftCompleto(e)) e = aplicarEscolha(e, escolhaIA(e, BANCO, [], "soloq", rng));
      return [...e.picks.azul, ...e.picks.vermelho].join(",");
    };
    const distintos = new Set([draftCom(1), draftCom(2), draftCom(3), draftCom(4)]);
    expect(distintos.size).toBeGreaterThan(1);

    // competitivo: o primeiro ban é sempre um dos 3 mais fortes da meta
    const topMeta = [...BANCO].sort((a, b) => b.forcaMetaBase - a.forcaMetaBase).slice(0, 3).map((c) => c.id);
    for (let s = 0; s < 10; s++) {
      const ban = escolhaIA(iniciarDraft(), BANCO, [], "competitivo", criarRng(s));
      expect(topMeta).toContain(ban);
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
