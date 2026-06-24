import { describe, expect, it } from "vitest";
import { gerarRoteiro, type EntradaRoteiro } from "./batalha";
import type { Role } from "./types";

function entrada(over: Partial<EntradaRoteiro> = {}): EntradaRoteiro {
  const roles: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  const time = roles.map((rota) => ({ championId: rota.toLowerCase(), rota }));
  return {
    vitoria: true,
    kda: { k: 5, d: 2, a: 7 },
    nota: 7,
    rotaVoce: "MID",
    timeAzul: time,
    timeVermelho: time,
    vantagem: 10,
    seed: 123,
    ...over,
  };
}

describe("roteiro de batalha", () => {
  it("monta 10 combatentes com exatamente um VOCÊ na rota certa", () => {
    const r = gerarRoteiro(entrada());
    expect(r.combatentes).toHaveLength(10);
    expect(r.combatentes.filter((c) => c.ehVoce)).toHaveLength(1);
    expect(r.combatentes.find((c) => c.ehVoce)?.rota).toBe("MID");
  });

  it("eventos em ordem de tempo e termina no nexus", () => {
    const r = gerarRoteiro(entrada());
    for (let i = 1; i < r.eventos.length; i++) {
      expect(r.eventos[i].t).toBeGreaterThanOrEqual(r.eventos[i - 1].t);
    }
    expect(r.eventos[r.eventos.length - 1].tipo).toBe("nexus");
  });

  it("vitória → nexus do azul; derrota → do vermelho", () => {
    expect(gerarRoteiro(entrada({ vitoria: true })).eventos.at(-1)?.vencedor).toBe("azul");
    expect(gerarRoteiro(entrada({ vitoria: false })).eventos.at(-1)?.vencedor).toBe("vermelho");
  });

  it("é determinístico para a mesma entrada", () => {
    expect(gerarRoteiro(entrada())).toEqual(gerarRoteiro(entrada()));
  });
});
