import { describe, expect, it } from "vitest";
import { GACHA } from "@/data/gacha";
import { efeitoLendas, equipar, ganharCampeao, puxar, sortearCampeaoBooster } from "./gacha";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState, ChampionDef } from "./types";

describe("sortearCampeaoBooster (débito Math.random quitado)", () => {
  const champ = (id: string, forca: number): ChampionDef => ({
    id,
    nome: id,
    classes: ["MAGO"],
    rolesValidas: ["MID"],
    perfil: { dano: 50, resistencia: 50, cc: 50, mobilidade: 50, sustain: 50 },
    forcaMetaBase: forca,
  });

  it("é determinístico e PONDERADO: o fraco cai bem mais que o forte no meta", () => {
    const banco = [champ("Forte", 70), champ("Fraco", 40)];
    expect(sortearCampeaoBooster(banco, 9)?.id).toBe(sortearCampeaoBooster(banco, 9)?.id);
    let fraco = 0;
    for (let s = 0; s < 400; s++) if (sortearCampeaoBooster(banco, s)?.id === "Fraco") fraco++;
    expect(fraco).toBeGreaterThan(250); // peso fraco=34 vs forte=4 → ~89%
    expect(fraco).toBeLessThan(400); // mas o forte AINDA cai
    expect(sortearCampeaoBooster([], 1)).toBeNull();
  });
});

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

// A moeda (CoinPoints) é POR CONTA e cobrada no servidor (profileStore) — o motor só faz a RNG.
describe("carreira booster (gacha)", () => {
  it("puxar devolve resultados e adiciona lendas", () => {
    const r = puxar(carreira(), 10, 1);
    expect(r.resultados).toHaveLength(10);
    expect((r.career.lendas ?? []).length).toBeGreaterThan(0);
  });

  it("pity garante 5★+ e reseta", () => {
    const r = puxar({ ...carreira(), pity: GACHA.pity5 - 1 }, 1, 5);
    expect(r.resultados[0].raridade).toBeGreaterThanOrEqual(5);
    expect(r.career.pity).toBe(0);
  });

  it("efeitoLendas soma passivo + substats da lenda equipada", () => {
    let c: CareerState = { ...carreira(), lendas: [{ id: "mao_tesoura", nivel: 1, substats: [{ chave: "macro", valor: 3 }] }] };
    c = equipar(c, "mao_tesoura");
    const ef = efeitoLendas(c);
    expect(ef.atributos.mecanica ?? 0).toBeGreaterThanOrEqual(5); // passivo +5 mecânica
    expect(ef.atributos.macro ?? 0).toBe(3); // substat
  });

  it("ganharCampeao novo entra no pool com a maestria de estreia", () => {
    const r = ganharCampeao(carreira(), "Zed");
    expect(r.resultado.novo).toBe(true);
    expect(r.career.player.pool.find((p) => p.championId === "Zed")?.pontos).toBe(GACHA.maestriaNovoCampeao);
  });

  it("ganharCampeao duplicado sobe a maestria (cap 100)", () => {
    const c = carreira();
    const antes = c.player.pool.find((p) => p.championId === "A")?.pontos ?? 0;
    const r = ganharCampeao(c, "A");
    expect(r.resultado.novo).toBe(false);
    expect(r.career.player.pool.find((p) => p.championId === "A")?.pontos).toBe(
      Math.min(100, antes + GACHA.maestriaDupCampeao),
    );
  });

  it("sinergia: 2 do mesmo estilo dão bônus extra", () => {
    const c: CareerState = {
      ...carreira(),
      lendas: [
        { id: "rei_mid", nivel: 1, substats: [] }, // Mecânico, passivo +7 mecânica
        { id: "mao_tesoura", nivel: 1, substats: [] }, // Mecânico, passivo +5 mecânica
      ],
      lendasEquipadas: ["rei_mid", "mao_tesoura"],
    };
    const ef = efeitoLendas(c);
    expect(ef.atributos.mecanica ?? 0).toBeGreaterThan(12); // 7+5 + sinergia Mecânico
  });
});
