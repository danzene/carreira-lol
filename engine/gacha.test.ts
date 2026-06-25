import { describe, expect, it } from "vitest";
import { GACHA } from "@/data/gacha";
import { efeitoLendas, equipar, ganharCampeao, puxar } from "./gacha";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState } from "./types";

function carreira(ps = 1000): CareerState {
  const c = criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
  );
  return { ...c, scoutPontos: ps };
}

describe("scout gacha", () => {
  it("puxar gasta PS e devolve resultados", () => {
    const r = puxar(carreira(1000), 10, 1);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.resultados).toHaveLength(10);
    expect(r.career.scoutPontos).toBe(1000 - GACHA.custo10);
    expect((r.career.lendas ?? []).length).toBeGreaterThan(0);
  });

  it("sem PS suficiente não puxa", () => {
    expect(puxar(carreira(10), 1, 1)).toBeNull();
  });

  it("pity garante 5★+ e reseta", () => {
    const r = puxar({ ...carreira(1000), pity: GACHA.pity5 - 1 }, 1, 5);
    expect(r?.resultados[0].raridade ?? 0).toBeGreaterThanOrEqual(5);
    expect(r?.career.pity).toBe(0);
  });

  it("efeitoLendas soma passivo + substats da lenda equipada", () => {
    let c: CareerState = { ...carreira(), lendas: [{ id: "mao_tesoura", nivel: 1, substats: [{ chave: "macro", valor: 3 }] }] };
    c = equipar(c, "mao_tesoura");
    const ef = efeitoLendas(c);
    expect(ef.atributos.mecanica ?? 0).toBeGreaterThanOrEqual(5); // passivo +5 mecânica
    expect(ef.atributos.macro ?? 0).toBe(3); // substat
  });

  it("ganharCampeao novo entra no pool com a maestria de estreia", () => {
    const c = carreira(100);
    const r = ganharCampeao(c, "Zed");
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.career.scoutPontos).toBe(100 - GACHA.custoCampeao);
    expect(r.resultado.novo).toBe(true);
    expect(r.career.player.pool.find((p) => p.championId === "Zed")?.pontos).toBe(GACHA.maestriaNovoCampeao);
  });

  it("ganharCampeao duplicado sobe a maestria (cap 100)", () => {
    const c = carreira(100);
    const antes = c.player.pool.find((p) => p.championId === "A")?.pontos ?? 0;
    const r = ganharCampeao(c, "A");
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.resultado.novo).toBe(false);
    expect(r.career.player.pool.find((p) => p.championId === "A")?.pontos).toBe(
      Math.min(100, antes + GACHA.maestriaDupCampeao),
    );
  });

  it("ganharCampeao sem PS suficiente retorna null", () => {
    expect(ganharCampeao(carreira(10), "Zed")).toBeNull();
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
