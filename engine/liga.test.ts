import { describe, expect, it } from "vitest";
import { VOCE } from "@/data/liga";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import {
  encerrarTemporada,
  forcaTimeDe,
  gerarTemporada,
  premio,
  registrarResultadoJogador,
} from "./liga";
import type { CareerState } from "./types";

function carreiraComLiga(timeId = "patos"): CareerState {
  const base = criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
  );
  return {
    ...base,
    contratoAtual: { timeId, salarioSemanal: 150, bonusPorVitoria: 40, semanasRestantes: 30, tier: "AMADOR" },
    tierAtual: "AMADOR",
    liga: gerarTemporada("AMADOR", timeId, 123),
  };
}

describe("liga", () => {
  it("gera temporada com 6 participantes e calendário todos-contra-todos", () => {
    const liga = gerarTemporada("AMADOR", "patos", 7);
    expect(liga.participantes).toHaveLength(6);
    expect(liga.participantes[0]).toBe(VOCE);
    expect(liga.participantes).not.toContain("patos");
    expect(liga.calendario).toHaveLength(5);
    const advs = liga.calendario.map((r) => r.adversarioId);
    expect(new Set(advs).size).toBe(5); // joga contra cada rival uma vez
  });

  it("vencendo tudo o jogador é campeão", () => {
    let c = carreiraComLiga();
    for (let i = 0; i < 5; i++) c = registrarResultadoJogador(c, true, 1000 + i);
    expect(c.liga?.fase).toBe("PLAYOFFS"); // 5-0 garante top 4
    c = registrarResultadoJogador(c, true, 2000); // semifinal
    if (c.liga?.fase === "PLAYOFFS") c = registrarResultadoJogador(c, true, 2001); // final
    expect(c.liga?.fase).toBe("ENCERRADA");
    expect(c.liga?.colocacaoFinal).toBe(1);
    expect(c.liga?.campeao).toBe(VOCE);
  });

  it("perdendo tudo o jogador fica fora dos playoffs", () => {
    let c = carreiraComLiga();
    for (let i = 0; i < 5; i++) c = registrarResultadoJogador(c, false, 5000 + i);
    expect(c.liga?.fase).toBe("ENCERRADA");
    expect(c.liga?.colocacaoFinal ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("premiação e força de time escalam com o tier/prestígio", () => {
    expect(premio("AMADOR", 1).dinheiro).toBe(800);
    expect(premio("INTERNACIONAL", 1).dinheiro).toBeGreaterThan(premio("AMADOR", 1).dinheiro);
    expect(forcaTimeDe("mirai")).toBeGreaterThan(forcaTimeDe("meteoro"));
  });

  it("campeão é promovido de tier e recebe premiação", () => {
    let c = carreiraComLiga();
    c = { ...c, liga: { ...c.liga!, fase: "ENCERRADA", colocacaoFinal: 1, campeao: VOCE } };
    const dinheiroAntes = c.dinheiro;
    const d = encerrarTemporada(c, 9);
    expect(d.tierAtual).toBe("ACADEMY");
    expect(d.contratoAtual?.tier).toBe("ACADEMY");
    expect(d.dinheiro).toBeGreaterThan(dinheiroAntes);
    expect(d.liga?.tier).toBe("ACADEMY"); // nova temporada já no novo tier
  });
});
