import { describe, expect, it } from "vitest";
import { construirBanco, mapearCampeao, type CampeaoEntrada } from "./champions";

function ent(
  id: string,
  tags: string[],
  info: CampeaoEntrada["info"] = { attack: 5, defense: 5, magic: 5, difficulty: 5 },
): CampeaoEntrada {
  return { id, nome: id, tags, info };
}

describe("banco de campeões", () => {
  it("mapeia tags do Data Dragon em classes", () => {
    const c = mapearCampeao(ent("Garen", ["Fighter", "Tank"]));
    expect(c.classes).toContain("LUTADOR");
    expect(c.classes).toContain("TANK");
  });

  it("perfil fica entre 0 e 100 e o dano vem do info", () => {
    const c = mapearCampeao(ent("Ahri", ["Mage", "Assassin"], { attack: 3, defense: 4, magic: 8, difficulty: 5 }));
    for (const v of Object.values(c.perfil)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(c.perfil.dano).toBe(80); // max(3,8)*10
  });

  it("forcaMetaBase é determinística e está na faixa sintética", () => {
    const a = mapearCampeao(ent("Lux", ["Mage"])).forcaMetaBase;
    const b = mapearCampeao(ent("Lux", ["Mage"])).forcaMetaBase;
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(45);
    expect(a).toBeLessThanOrEqual(63);
  });

  it("atirador joga de ADC; suporte de SUPPORT", () => {
    expect(mapearCampeao(ent("Jinx", ["Marksman"])).rolesValidas).toContain("ADC");
    expect(mapearCampeao(ent("Thresh", ["Support", "Tank"])).rolesValidas).toContain("SUPPORT");
  });

  it("construirBanco ordena por nome", () => {
    const banco = construirBanco([ent("Zed", ["Assassin"]), ent("Aatrox", ["Fighter"])]);
    expect(banco[0].nome).toBe("Aatrox");
  });
});
