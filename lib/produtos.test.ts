import { describe, expect, it } from "vitest";
import { PACOTES_MOEDA, PRODUTOS, formatarReais, produto } from "./produtos";

describe("catálogo de produtos", () => {
  it("todo produto tem valor e dados coerentes", () => {
    for (const p of Object.values(PRODUTOS)) {
      expect(p.valorCentavos).toBeGreaterThan(0);
      expect(Number.isInteger(p.valorCentavos)).toBe(true);
      expect(p.moedas).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(p.moedas)).toBe(true);
      // ou dá moeda, ou dá passe — nunca os dois zerados
      expect(p.moedas > 0 || p.concedePasse).toBe(true);
    }
  });

  it("só o passe premium concede passe", () => {
    const comPasse = Object.values(PRODUTOS).filter((p) => p.concedePasse);
    expect(comPasse).toHaveLength(1);
    expect(comPasse[0].id).toBe("passe_premium");
    expect(comPasse[0].moedas).toBe(0);
  });

  it("pacotes de moeda sobem em preço e em moedas", () => {
    for (let i = 1; i < PACOTES_MOEDA.length; i++) {
      expect(PACOTES_MOEDA[i].valorCentavos).toBeGreaterThan(PACOTES_MOEDA[i - 1].valorCentavos);
      expect(PACOTES_MOEDA[i].moedas).toBeGreaterThan(PACOTES_MOEDA[i - 1].moedas);
    }
  });

  it("o bônus por moeda nunca diminui (pacote maior = melhor ou igual custo-benefício)", () => {
    const razao = (id: string) => PRODUTOS[id].moedas / PRODUTOS[id].valorCentavos;
    for (let i = 1; i < PACOTES_MOEDA.length; i++) {
      expect(razao(PACOTES_MOEDA[i].id)).toBeGreaterThanOrEqual(razao(PACOTES_MOEDA[i - 1].id) - 1e-9);
    }
  });

  it("pacote base é 1 real = 100 moedas", () => {
    expect(PRODUTOS.moedas_10.valorCentavos).toBe(1000);
    expect(PRODUTOS.moedas_10.moedas).toBe(1000);
  });

  it("produto() devolve null pra id inválido", () => {
    expect(produto("nao_existe")).toBeNull();
    expect(produto("moedas_50")?.id).toBe("moedas_50");
  });

  it("formatarReais formata em BRL", () => {
    expect(formatarReais(990)).toContain("9,90");
    expect(formatarReais(1000)).toContain("10,00");
  });
});
