import { describe, expect, it } from "vitest";
import { GACHA } from "@/data/gacha";
import { efeitoLendas, equipar, puxar } from "./gacha";
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

  it("pity garante 5★ e reseta", () => {
    const r = puxar({ ...carreira(1000), pity: GACHA.pity5 - 1 }, 1, 5);
    expect(r?.resultados[0].raridade).toBe(5);
    expect(r?.career.pity).toBe(0);
  });

  it("efeitoLendas soma passivo + substats da lenda equipada", () => {
    let c: CareerState = { ...carreira(), lendas: [{ id: "mao_tesoura", nivel: 1, substats: [{ chave: "macro", valor: 3 }] }] };
    c = equipar(c, "mao_tesoura");
    const ef = efeitoLendas(c);
    expect(ef.atributos.mecanica ?? 0).toBeGreaterThanOrEqual(5); // passivo +5 mecânica
    expect(ef.atributos.macro ?? 0).toBe(3); // substat
  });
});
