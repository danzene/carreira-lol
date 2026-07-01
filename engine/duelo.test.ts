import { describe, expect, it } from "vitest";
import { poderDeSnapshot, simularDuelo, snapshotDePlayer, type PlayerSnapshot } from "./duelo";
import type { Attributes, Player } from "./types";

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function snap(over: Partial<PlayerSnapshot> & { chave: string }): PlayerSnapshot {
  return {
    nome: over.chave,
    rota: "MID",
    atributos: attrs(50),
    tracos: [],
    pool: [{ championId: "Ahri", pontos: 50 }],
    championId: "Ahri",
    elo: "Ouro IV",
    mmr: 1200,
    ...over,
  };
}

describe("simularDuelo", () => {
  it("é determinístico: mesma entrada, mesmo resultado", () => {
    const a = snap({ chave: "a" });
    const b = snap({ chave: "b", atributos: attrs(60) });
    expect(simularDuelo(a, b, 42)).toEqual(simularDuelo(a, b, 42));
  });

  it("o vencedor e as forças independem da ordem dos argumentos", () => {
    const a = snap({ chave: "a", atributos: attrs(55) });
    const b = snap({ chave: "b", atributos: attrs(48) });
    const r1 = simularDuelo(a, b, 7);
    const r2 = simularDuelo(b, a, 7);
    expect(r1.vencedorChave).toBe(r2.vencedorChave);
    const forcaA1 = r1.a.chave === "a" ? r1.a.forca : r1.b.forca;
    const forcaA2 = r2.a.chave === "a" ? r2.a.forca : r2.b.forca;
    expect(forcaA1).toBe(forcaA2);
  });

  it("o vencedor sempre é apontado por chave e um dos dois lados venceu", () => {
    const a = snap({ chave: "a" });
    const b = snap({ chave: "b" });
    const r = simularDuelo(a, b, 99);
    expect([a.chave, b.chave]).toContain(r.vencedorChave);
    expect(r.a.venceu).toBe(!r.b.venceu);
    expect(r.vencedorChave).toBe(r.a.venceu ? "a" : "b");
  });

  it("jogador muito mais forte vence a esmagadora maioria dos duelos", () => {
    const forte = snap({ chave: "forte", atributos: attrs(90), pool: [{ championId: "Ahri", pontos: 95 }], mmr: 2200 });
    const fraco = snap({ chave: "fraco", atributos: attrs(28), pool: [{ championId: "Ahri", pontos: 8 }], mmr: 850 });
    let vitoriasForte = 0;
    for (let s = 0; s < 200; s++) if (simularDuelo(forte, fraco, s).vencedorChave === "forte") vitoriasForte++;
    expect(vitoriasForte).toBeGreaterThan(185);
  });
});

describe("poderDeSnapshot", () => {
  it("é maior para atributos/maestria maiores", () => {
    const fraco = snap({ chave: "f", atributos: attrs(30), pool: [{ championId: "Ahri", pontos: 20 }] });
    const forte = snap({ chave: "F", atributos: attrs(80), pool: [{ championId: "Ahri", pontos: 90 }], mmr: 1800 });
    expect(poderDeSnapshot(forte)).toBeGreaterThan(poderDeSnapshot(fraco));
  });

  it("não usa ruído (é estável entre chamadas)", () => {
    const s = snap({ chave: "s" });
    expect(poderDeSnapshot(s)).toBe(poderDeSnapshot(s));
  });
});

describe("snapshotDePlayer", () => {
  it("traz o campeão de maior maestria como principal", () => {
    const player = {
      nome: "Faker",
      nacionalidade: "KR",
      idade: 27,
      rota: "MID",
      atributos: attrs(70),
      pool: [
        { championId: "Ahri", pontos: 40 },
        { championId: "LeBlanc", pontos: 88 },
        { championId: "Azir", pontos: 60 },
      ],
      tracos: ["SHOTCALLER"],
      reputacao: 90,
      rankSoloq: { elo: "Desafiante", lp: 800, mmr: 2500, streak: 3 },
      energia: 100,
      moral: 80,
    } satisfies Player;
    const s = snapshotDePlayer(player, "user-123");
    expect(s.championId).toBe("LeBlanc");
    expect(s.chave).toBe("user-123");
    expect(s.mmr).toBe(2500);
  });
});
