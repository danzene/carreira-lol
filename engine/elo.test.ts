import { describe, expect, it } from "vitest";
import { infoElo, proximoElo, trilhaElos } from "@/data/elo";
import { eloDeMmr } from "./elo";

describe("apresentação de elo", () => {
  it("infoElo separa tier e divisão", () => {
    const f = infoElo("Ferro IV");
    expect(f.tier).toBe("Ferro");
    expect(f.divisao).toBe("IV");
    expect(f.idx).toBe(0);

    const gm = infoElo("Grão-Mestre");
    expect(gm.tier).toBe("Grão-Mestre");
    expect(gm.divisao).toBe("");
  });

  it("proximoElo sobe a ladder e trava no topo", () => {
    expect(proximoElo("Ferro IV")).toBe("Ferro III");
    expect(proximoElo("Desafiante")).toBeNull();
  });

  it("trilha começa no elo atual", () => {
    expect(trilhaElos("Ferro IV", 3)).toEqual(["Ferro IV", "Ferro III", "Ferro II"]);
  });

  it("começa em Ferro IV no MMR base", () => {
    expect(eloDeMmr(800)).toEqual({ elo: "Ferro IV", lp: 0 });
  });
});
