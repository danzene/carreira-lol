import { describe, expect, it } from "vitest";
import type { Item } from "@/data/itens";
import {
  cerimoniaDeDrop,
  cerimoniaDeElo,
  cerimoniaDeGacha,
  cerimoniasDeConquistas,
  cerimoniasDePasse,
  ehFullscreen,
  melhorRaridade,
} from "./cerimonias";
import type { ResultadoPuxada } from "./gacha";
import { criarPasse, type MissaoAtiva, type PasseState } from "./passe";

const missao = (over: Partial<MissaoAtiva>): MissaoAtiva => ({
  tipo: "vencer",
  texto: "Vença 1 partida",
  escopo: "diaria",
  alvo: 1,
  pp: 130,
  id: "m1",
  progresso: 0,
  concluida: false,
  ...over,
});

const passeCom = (over: Partial<PasseState>): PasseState => ({ ...criarPasse(1, 0), ...over });

describe("cerimoniaDeElo", () => {
  it("promoção quando o elo sobe", () => {
    expect(cerimoniaDeElo("Ferro IV", "Ferro III")).toEqual({ tipo: "RANK_PROMOTED", de: "Ferro IV", para: "Ferro III" });
  });
  it("queda quando o elo desce", () => {
    expect(cerimoniaDeElo("Ouro IV", "Prata I")).toEqual({ tipo: "RANK_DEMOTED", de: "Ouro IV", para: "Prata I" });
  });
  it("null quando não muda", () => {
    expect(cerimoniaDeElo("Ouro IV", "Ouro IV")).toBeNull();
  });
});

describe("cerimoniasDePasse", () => {
  it("emite MISSION_COMPLETED só pra missão que concluiu AGORA", () => {
    const antes = passeCom({ diarias: [missao({}), missao({ id: "m2", concluida: true })], semanais: [] });
    const depois = passeCom({
      diarias: [missao({ progresso: 1, concluida: true }), missao({ id: "m2", concluida: true })],
      semanais: [],
    });
    const evs = cerimoniasDePasse(antes, depois);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ tipo: "MISSION_COMPLETED", pp: 130 });
  });

  it("emite PASS_LEVEL_UP com as recompensas dos níveis cruzados", () => {
    const antes = passeCom({ pp: 350 }); // nível 4
    const depois = passeCom({ pp: 950 }); // nível 10 (cruza 5 premium e 10 free+premium)
    const evs = cerimoniasDePasse(antes, depois);
    const up = evs.find((e) => e.tipo === "PASS_LEVEL_UP");
    expect(up).toBeDefined();
    if (up?.tipo === "PASS_LEVEL_UP") {
      expect(up.de).toBe(4);
      expect(up.para).toBe(10);
      expect(up.recompensas.some((r) => r.nivel === 5 && r.trilha === "premium")).toBe(true);
      expect(up.recompensas.some((r) => r.nivel === 10 && r.trilha === "free")).toBe(true);
    }
  });

  it("nada muda → nenhum evento", () => {
    const p = passeCom({});
    expect(cerimoniasDePasse(p, p)).toHaveLength(0);
  });
});

describe("construtores e helpers", () => {
  const item: Item = {
    id: "i1",
    slot: "MOUSE",
    raridade: 4,
    iLvl: 20,
    implicito: { chave: "mecanica", valor: 3 },
    afixos: [{ chave: "xp", valor: 5 }],
  };
  const puxadas: ResultadoPuxada[] = [
    { id: "l1", raridade: 3, novo: true, nivel: 1, substats: [] },
    { id: "l2", raridade: 5, novo: false, nivel: 2, substats: [] },
  ];

  it("cerimoniaDeDrop embrulha o item", () => {
    expect(cerimoniaDeDrop(item)).toEqual({ tipo: "ITEM_DROPPED", item });
  });

  it("cerimoniaDeGacha guarda resultados e pity", () => {
    const c = cerimoniaDeGacha(puxadas, 7, 0);
    expect(c).toMatchObject({ tipo: "GACHA_PULLED", pityAntes: 7, pityDepois: 0 });
  });

  it("melhorRaridade acha a maior", () => {
    expect(melhorRaridade(puxadas)).toBe(5);
  });

  it("conquistas viram eventos serializáveis", () => {
    const evs = cerimoniasDeConquistas([{ id: "c1", nome: "Primeira vitória", emoji: "🏅", desc: "Vença 1" }]);
    expect(evs[0]).toMatchObject({ tipo: "ACHIEVEMENT_UNLOCKED", id: "c1" });
  });

  it("classifica fullscreen vs toast", () => {
    expect(ehFullscreen({ tipo: "RANK_PROMOTED", de: "a", para: "b" })).toBe(true);
    expect(ehFullscreen({ tipo: "MISSION_COMPLETED", texto: "x", pp: 10, escopo: "diaria" })).toBe(false);
  });
});
