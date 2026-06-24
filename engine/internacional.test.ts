import { describe, expect, it } from "vitest";
import { VOCE } from "@/data/liga";
import { avancarTorneio, criarTorneio, premioTorneio, proximoConfrontoTorneio } from "./internacional";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState } from "./types";

function carreira(nac = "Brasil"): CareerState {
  const c = criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: nac,
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
  );
  return {
    ...c,
    contratoAtual: { timeId: "loud", salarioSemanal: 1200, bonusPorVitoria: 300, semanasRestantes: 30, tier: "TIER1" },
    tierAtual: "TIER1",
  };
}

describe("torneio internacional (MSI/Worlds)", () => {
  it("cria um bracket de 6 (você + 5 times reais, sem o seu time)", () => {
    const t = criarTorneio("MSI", carreira());
    expect(t.bracket.participantes).toHaveLength(6);
    expect(t.bracket.participantes).toContain(VOCE);
    expect(t.bracket.participantes).not.toContain("loud");
  });

  it("vencendo tudo o jogador é campeão", () => {
    let c: CareerState = { ...carreira(), torneioAtual: undefined };
    c = { ...c, torneioAtual: criarTorneio("WORLDS", c) };
    for (let i = 0; i < 5; i++) c = avancarTorneio(c, true, 100 + i);
    expect(c.torneioAtual?.bracket.fase).toBe("PLAYOFFS");
    c = avancarTorneio(c, true, 200); // semifinal
    if (c.torneioAtual?.bracket.fase === "PLAYOFFS") c = avancarTorneio(c, true, 201); // final
    expect(c.torneioAtual?.bracket.fase).toBe("ENCERRADA");
    expect(c.torneioAtual?.bracket.colocacaoFinal).toBe(1);
  });

  it("Worlds paga mais que o MSI", () => {
    expect(premioTorneio("WORLDS", 1).dinheiro).toBeGreaterThan(premioTorneio("MSI", 1).dinheiro);
  });

  it("proximoConfrontoTorneio devolve um adversário", () => {
    const t = criarTorneio("MSI", carreira());
    expect(proximoConfrontoTorneio(t)).toBeTruthy();
  });
});
