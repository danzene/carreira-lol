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

  it("nº de afixos segue a raridade forçada", () => {
    expect(gerarItem("MOUSE", 20, 5, { raridade: 3 }).afixos).toHaveLength(3);
    expect(gerarItem("HEADSET", 20, 7, { raridade: 5 }).afixos).toHaveLength(5);
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
