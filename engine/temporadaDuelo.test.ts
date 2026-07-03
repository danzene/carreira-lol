import { describe, expect, it } from "vitest";
import {
  aplicarSoftReset,
  deltaRating,
  msAteProximaTemporada,
  RATING_BASE,
  temporadaDuelo,
  tierDuelo,
  tituloTemporada,
} from "./temporadaDuelo";

describe("temporadas do duelo", () => {
  it("temporada deriva da data real: ciclos de 3 semanas, igual em qualquer cliente", () => {
    const t1 = Date.UTC(2026, 0, 10); // semana 1 da época
    const aindaT1 = Date.UTC(2026, 0, 24); // semana 3
    const t2 = Date.UTC(2026, 0, 27); // semana 4 → temporada 2
    expect(temporadaDuelo(t1)).toBe(1);
    expect(temporadaDuelo(aindaT1)).toBe(1);
    expect(temporadaDuelo(t2)).toBe(2);
    expect(msAteProximaTemporada(t1)).toBeGreaterThan(0);
    // determinístico
    expect(temporadaDuelo(t2)).toBe(temporadaDuelo(t2));
  });

  it("soft reset é IDEMPOTENTE: rodar 2x não reseta 2x", () => {
    const r1 = aplicarSoftReset(1400, 3, 2);
    expect(r1.resetou).toBe(true);
    expect(r1.rating).toBe(1200); // 1000 + (1400-1000)*0.5
    expect(r1.temporada).toBe(3);
    const r2 = aplicarSoftReset(r1.rating, 3, r1.temporada);
    expect(r2.resetou).toBe(false);
    expect(r2.rating).toBe(1200); // intacto
    // abaixo da base também converge pra base
    expect(aplicarSoftReset(800, 2, 1).rating).toBe(900);
  });

  it("deltaRating: vencer o mais forte rende mais; sempre com teto e piso", () => {
    const vsForte = deltaRating(true, 50, 90);
    const vsFraco = deltaRating(true, 90, 50);
    expect(vsForte).toBeGreaterThan(vsFraco);
    expect(Math.abs(deltaRating(true, 0, 100))).toBeLessThanOrEqual(32);
    expect(Math.abs(deltaRating(false, 0, 100))).toBeGreaterThanOrEqual(8);
    expect(deltaRating(false, 50, 50)).toBeLessThan(0);
  });

  it("tiers e título exclusivo da temporada", () => {
    expect(tierDuelo(RATING_BASE).nome).toBe("Bronze");
    expect(tierDuelo(1130).nome).toBe("Ouro");
    expect(tierDuelo(1500).nome).toBe("Lenda");
    expect(tituloTemporada(2, 1300)).toBe("T2: Diamante no Duelo");
  });
});
