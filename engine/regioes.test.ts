import { describe, expect, it } from "vitest";
import { VOCE } from "@/data/liga";
import { regiaoDoPais, timesDaRegiao } from "@/data/regioes";
import { forcaTimeDe, gerarTemporada } from "./liga";

describe("regiões / liga profissional", () => {
  it("nacionalidade vira região e liga real", () => {
    expect(regiaoDoPais("Brasil").liga).toBe("CBLOL");
    expect(regiaoDoPais("Coreia do Sul").liga).toBe("LCK");
    expect(regiaoDoPais("Estados Unidos").liga).toBe("LCS");
    expect(regiaoDoPais("França").liga).toBe("LEC");
    expect(regiaoDoPais(undefined).liga).toBeTruthy(); // default
  });

  it("a liga do TIER1 usa só os times da sua região", () => {
    const liga = gerarTemporada("TIER1", "loud", 5, "br");
    const idsBr = new Set(timesDaRegiao("br").map((t) => t.id));
    for (const id of liga.participantes) {
      if (id === VOCE) continue;
      expect(idsBr.has(id)).toBe(true);
    }
    expect(liga.participantes).toContain(VOCE);
    expect(liga.participantes).not.toContain("loud"); // seu time fora dos rivais
  });

  it("região mais forte deixa o time mais forte (LCK > CBLOL no mesmo prestígio)", () => {
    expect(forcaTimeDe("t1")).toBeGreaterThan(forcaTimeDe("loud"));
  });
});
