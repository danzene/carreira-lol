import { describe, expect, it } from "vitest";
import { getBadges } from "./badges";
import { registrarLoginDiario } from "./diario";
import { criarPasse } from "./passe";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState } from "./types";
import { cerimoniasDeUnlocks, featureLiberada, migrarUnlocks } from "./unlocks";

function carreira(): CareerState {
  return criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
  );
}

describe("unlock progressivo", () => {
  it("carreira nova (semana 1, Ferro IV) tem stream/booster/passe/online travados", () => {
    const c = { ...carreira(), unlocksLegacy: false };
    expect(featureLiberada(c, "stream")).toBe(false);
    expect(featureLiberada(c, "booster")).toBe(false);
    expect(featureLiberada(c, "passe")).toBe(false);
    expect(featureLiberada(c, "online")).toBe(false);
  });

  it("semana 2 libera stream/mental/loja; semana 3 libera o passe", () => {
    const c = { ...carreira(), unlocksLegacy: false, semanaAtual: 2 };
    expect(featureLiberada(c, "stream")).toBe(true);
    expect(featureLiberada(c, "loja")).toBe(true);
    expect(featureLiberada(c, "passe")).toBe(false);
    expect(featureLiberada({ ...c, semanaAtual: 3 }, "passe")).toBe(true);
  });

  it("promoção libera o booster; Bronze libera itens; Prata libera o online", () => {
    const c = { ...carreira(), unlocksLegacy: false };
    const com = (elo: string): CareerState => ({ ...c, player: { ...c.player, rankSoloq: { ...c.player.rankSoloq, elo } } });
    expect(featureLiberada(com("Ferro III"), "booster")).toBe(true);
    expect(featureLiberada(com("Ferro III"), "itens")).toBe(false);
    expect(featureLiberada(com("Bronze IV"), "itens")).toBe(true);
    expect(featureLiberada(com("Bronze IV"), "online")).toBe(false);
    expect(featureLiberada(com("Prata IV"), "online")).toBe(true);
  });

  it("save legacy tem tudo destravado; migração marca legacy só com progresso", () => {
    const legacy = { ...carreira(), unlocksLegacy: true };
    expect(featureLiberada(legacy, "online")).toBe(true);
    // save antigo em progresso (semana 5, sem o campo) → vira legacy
    const antigo = migrarUnlocks({ ...carreira(), semanaAtual: 5 });
    expect(antigo.unlocksLegacy).toBe(true);
    // carreira zerada sem o campo → gates valem
    const novo = migrarUnlocks(carreira());
    expect(novo.unlocksLegacy).toBe(false);
    // já migrado não muda (mesma ref)
    expect(migrarUnlocks(novo)).toBe(novo);
  });

  it("cerimoniasDeUnlocks emite só o que destravou AGORA (nada pra legacy)", () => {
    const antes = { ...carreira(), unlocksLegacy: false };
    const depois = { ...antes, semanaAtual: 2 };
    const evs = cerimoniasDeUnlocks(antes, depois);
    expect(evs.map((e) => e.tipo === "FEATURE_UNLOCKED" && e.feature)).toEqual(["stream", "mental", "loja"]);
    expect(cerimoniasDeUnlocks(antes, { ...depois, unlocksLegacy: true })).toHaveLength(0);
    expect(cerimoniasDeUnlocks(depois, depois)).toHaveLength(0);
  });
});

describe("badges", () => {
  it("deriva o que tem pra pegar", () => {
    const c = registrarLoginDiario(carreira(), "2026-07-02").career;
    const passe = { ...criarPasse(1, 0), pp: 950 }; // nível 10 → recompensas liberadas
    const b = getBadges(c, passe, 2, "2026-07-02");
    expect(b.booster).toBe(true); // puxada grátis do dia
    expect(b.diaria).toBe(true); // streak pra coletar
    expect(b.passe).toBeGreaterThan(0);
    expect(b.inventario).toBe(2);
  });

  it("sem carreira → tudo apagado", () => {
    const b = getBadges(null, null, 0, "2026-07-02");
    expect(b).toEqual({ booster: false, diaria: false, passe: 0, inventario: 0 });
  });
});
