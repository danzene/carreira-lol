import { describe, expect, it } from "vitest";
import type { Item } from "@/data/itens";
import { efeitoItens, gerarItem, rerollAfixos } from "./itens";

function item(setId: Item["setId"], afixos: Item["afixos"]): Item {
  return { id: "x", slot: "MOUSE", raridade: 1, iLvl: 10, implicito: { chave: "mecanica", valor: 2 }, afixos, setId };
}

describe("itens RPG", () => {
  it("gerarItem é determinístico (mesma seed = mesmo item)", () => {
    expect(gerarItem("MOUSE", 30, 123)).toEqual(gerarItem("MOUSE", 30, 123));
  });

  it("nº de afixos segue a raridade (com chance de 1 EXTRA — item abençoado)", () => {
    const a3 = gerarItem("MOUSE", 20, 5, { raridade: 3 }).afixos.length;
    expect([3, 4]).toContain(a3);
    const a5 = gerarItem("HEADSET", 20, 7, { raridade: 5 }).afixos.length;
    expect([5, 6]).toContain(a5);
    // o bônus existe: em muitas seeds, alguma vem abençoada
    let abencoados = 0;
    for (let s = 0; s < 100; s++) if (gerarItem("MOUSE", 20, s, { raridade: 2 }).afixos.length === 3) abencoados++;
    expect(abencoados).toBeGreaterThan(0);
    expect(abencoados).toBeLessThan(40); // é raro, não regra
  });

  it("nome procedural: determinístico, com base do slot; raridade alta ganha prefixo/sufixo", () => {
    const a = gerarItem("MOUSE", 20, 42, { raridade: 5 });
    expect(a.nome).toBeTruthy();
    expect(a.nome).toBe(gerarItem("MOUSE", 20, 42, { raridade: 5 }).nome);
    expect(a.nome).toMatch(/Mouse/);
    expect(a.nome!.split(" ").length).toBeGreaterThan(2); // prefixo + base + sufixo
    // reroll muda os afixos e re-nomeia
    const re = rerollAfixos(a, 77);
    expect(re.nome).toBeTruthy();
  });

  it("afixo SORTE soma no efeito com cap 25", () => {
    const ef = efeitoItens([item(undefined, [{ chave: "sorte", valor: 8 }]), { ...item(undefined, [{ chave: "sorte", valor: 30 }]), id: "y", slot: "TECLADO" }]);
    expect(ef.sorte).toBe(25); // 38 → cap 25
    const ef2 = efeitoItens([item(undefined, [{ chave: "sorte", valor: 6 }])]);
    expect(ef2.sorte).toBe(6);
  });

  it("implícito é o atributo do slot", () => {
    expect(gerarItem("HEADSET", 20, 9, { raridade: 1 }).implicito.chave).toBe("comunicacao");
  });

  it("efeitoItens soma implícito + afixos e roteia especiais", () => {
    const ef = efeitoItens([item(undefined, [{ chave: "xp", valor: 10 }, { chave: "comp", valor: 2 }])]);
    expect(ef.atributos.mecanica ?? 0).toBe(2); // implícito
    expect(ef.xpMult).toBeCloseTo(1.1, 5);
    expect(ef.bonusComp).toBe(2);
  });

  it("set dá bônus com 2 peças", () => {
    const ef = efeitoItens([
      item("mecanico", [{ chave: "macro", valor: 3 }]),
      item("mecanico", [{ chave: "macro", valor: 3 }]),
    ]);
    // mecânica = implícito 2*2 + set Mecânico b2 (+4) = 8
    expect(ef.atributos.mecanica ?? 0).toBe(8);
    expect(ef.atributos.macro ?? 0).toBe(6);
    expect(ef.sets).toHaveLength(1);
    expect(ef.sets[0]).toMatchObject({ id: "mecanico", pecas: 2 });
  });

  it("rerollAfixos mantém slot/raridade/iLvl e re-sorteia os afixos", () => {
    const base = gerarItem("MONITOR", 40, 42, { raridade: 4 });
    const r = rerollAfixos(base, 999);
    expect(r.slot).toBe(base.slot);
    expect(r.raridade).toBe(base.raridade);
    expect(r.iLvl).toBe(base.iLvl);
    expect(r.afixos).toHaveLength(base.afixos.length);
  });
});
