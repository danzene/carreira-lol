import { describe, expect, it } from "vitest";
import { TIMES } from "@/data/times";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { adicionarOfertas, assinarContrato, contraproposta, gerarOfertas, recusarOferta } from "./transferencias";
import type { CareerState, Offer } from "./types";

function carreira(rep = 30): CareerState {
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
  c.player.reputacao = rep;
  return c;
}

function ofertaDe(timeId: string): Offer {
  const t = TIMES.find((x) => x.id === timeId);
  if (!t) throw new Error("time inexistente");
  return { timeId, tier: t.tier, salarioSemanal: 200, bonusPorVitoria: 50, duracaoSemanas: 30 };
}

describe("transferências", () => {
  it("gera ofertas só de times elegíveis pela reputação", () => {
    const c = carreira(45);
    for (let s = 0; s < 60; s++) {
      for (const o of gerarOfertas(c, s)) {
        const t = TIMES.find((x) => x.id === o.timeId);
        expect(t).toBeTruthy();
        if (!t) continue;
        expect(t.prestigio).toBeLessThanOrEqual(45 + 12);
        expect(t.prestigio).toBeGreaterThanOrEqual(45 - 25);
      }
    }
  });

  it("assinar contrato muda tier/salário e limpa a inbox", () => {
    let c = adicionarOfertas(carreira(45), [ofertaDe("nimbus")]);
    c = assinarContrato(c, "nimbus");
    expect(c.contratoAtual?.timeId).toBe("nimbus");
    expect(c.tierAtual).toBe("ACADEMY");
    expect(c.inbox).toHaveLength(0);
  });

  it("recusar remove a oferta", () => {
    const c = recusarOferta(adicionarOfertas(carreira(), [ofertaDe("nimbus")]), "nimbus");
    expect(c.inbox).toHaveLength(0);
  });

  it("contraproposta: aceita com reputação alta (sobe salário); senão o time retira", () => {
    const cAlta = adicionarOfertas(carreira(50), [ofertaDe("nimbus")]); // 50 >= 40
    const r = contraproposta(cAlta, "nimbus");
    expect(r.aceita).toBe(true);
    expect(r.career.inbox[0].salarioSemanal).toBeGreaterThan(200);

    const cBaixa = adicionarOfertas(carreira(20), [ofertaDe("nimbus")]); // 20 < 40
    const r2 = contraproposta(cBaixa, "nimbus");
    expect(r2.aceita).toBe(false);
    expect(r2.career.inbox).toHaveLength(0);
  });
});
