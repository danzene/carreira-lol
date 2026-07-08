import { describe, expect, it } from "vitest";
import { GRIND } from "@/data/grind";
import {
  acumularSegundosGrind,
  aplicarGrind,
  estadoGrindInicial,
  modsDoGrind,
  normalizarGrind,
  resolverGrind,
  type EstadoGrind,
} from "./grind";
import { normalizarExpedicao, normalizarRitmo, passivoAtivo, RITMO_CAP } from "./expedicao";
import { criarCareerState } from "./player";
import type { Attributes, CareerState, Player } from "./types";

const H3 = GRIND.tetoSegundosDia;

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function jogador(): Player {
  return {
    nome: "Teste",
    nacionalidade: "Brasil",
    idade: 17,
    rota: "MID",
    atributos: attrs(50),
    pool: [
      { championId: "Ahri", pontos: 50 },
      { championId: "Zed", pontos: 25 },
    ],
    tracos: [],
    reputacao: 10,
    rankSoloq: { elo: "Prata IV", lp: 40, mmr: 1600, streak: 0 },
    energia: 80,
    moral: 60,
  };
}

function carreira(): CareerState {
  const c = criarCareerState(jogador());
  return { ...c, grind: estadoGrindInicial("2026-07-07", 12345) };
}

describe("dois modos — Fase 0: fronteira Passivo × Expedição", () => {
  it("estado inicial nasce no PASSIVO, sem corrida, sem ritmo", () => {
    const g = estadoGrindInicial("2026-07-07", 1);
    expect(g.modo).toBe("PASSIVO");
    expect(g.expedicao).toBeNull();
    expect(g.ritmo).toBeNull();
    expect(g.recordeFaseExpedicao).toBe(0);
  });

  it("guard passivoAtivo: só o passivo sem corrida está ativo (só UM modo por vez)", () => {
    expect(passivoAtivo("PASSIVO", null)).toBe(true);
    expect(passivoAtivo("EXPEDICAO", null)).toBe(false);
    // corrida em andamento trava o passivo mesmo com o modo marcado como passivo
    const exp = { seed: 1, faseAtual: 3, faseLimpa: 2, hpMax: 100, hpAtual: 40, lootSucata: 10, lootBaus: 0, ritmoNivel: 1, status: "combate" as const };
    expect(passivoAtivo("PASSIVO", exp)).toBe(false);
    expect(passivoAtivo("EXPEDICAO", exp)).toBe(false);
  });

  it("save ANTIGO (sem os campos novos) migra pra passivo seguro sem perder Sucata/talentos/cosméticos", () => {
    const antigo = {
      ligado: true, dia: "2026-06-01", seedDia: 7, segundosHoje: 120, partidasAplicadas: 0, streakDia: 2,
      totalPartidas: 40, maiorStreakV: 5,
      semana: { partidas: 3, vitorias: 2, dinheiro: 4, maestria: 1, maiorStreakV: 2, maiorStreakD: 1, drops: 0, sucata: 30, bausComum: 1, bausRaro: 0, bausLendario: 0, talentosComprados: 1 },
      sucata: 123, talentos: { gold: 2 }, barraBau: 3, goldFracao: 0.5, bauPendente: null,
      pityLendario: 4, totalBaus: 2, cosmeticos: ["skin_aureo"], equipado: { skin: "skin_aureo" },
      // note: SEM modo/expedicao/ritmo/recordeFaseExpedicao
    };
    const g = normalizarGrind(antigo)!;
    expect(g.modo).toBe("PASSIVO");
    expect(g.expedicao).toBeNull();
    expect(g.ritmo).toBeNull();
    expect(g.recordeFaseExpedicao).toBe(0);
    // patrimônio do passivo intocado
    expect(g.sucata).toBe(123);
    expect(g.talentos).toEqual({ gold: 2 });
    expect(g.cosmeticos).toEqual(["skin_aureo"]);
    expect(g.semana.sucata).toBe(30);
  });

  it("trocar de modo NÃO duplica ganhos nem corrompe o patrimônio do passivo", () => {
    const base: EstadoGrind = { ...estadoGrindInicial("2026-07-07", 1), sucata: 200, talentos: { gold: 1 }, cosmeticos: ["skin_aureo"] };
    // entrar na expedição = trocar o modo (o patrimônio fica idêntico)
    const emExp: EstadoGrind = { ...base, modo: "EXPEDICAO" };
    // voltar ao passivo
    const devolta: EstadoGrind = { ...emExp, modo: "PASSIVO" };
    expect(devolta.sucata).toBe(200);
    expect(devolta.talentos).toEqual({ gold: 1 });
    expect(devolta.cosmeticos).toEqual(["skin_aureo"]);
    // um roundtrip de save no meio não altera nada
    const round = normalizarGrind(JSON.parse(JSON.stringify(emExp)))!;
    expect(round.sucata).toBe(200);
    expect(round.modo).toBe("EXPEDICAO");
  });

  it("Sucata do passivo CONTABILIZA e PERSISTE (roundtrip de save mantém o valor)", () => {
    const c = carreira();
    const g = acumularSegundosGrind(c.grind!, H3, "2026-07-07", 999);
    const r = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g));
    const aplicado = aplicarGrind({ ...c, grind: g }, r).career;
    expect(aplicado.grind!.sucata).toBeGreaterThan(0);
    expect(aplicado.grind!.semana.sucata).toBe(aplicado.grind!.sucata);
    // persistência: serializa e re-normaliza (o que o save faz) → Sucata idêntica
    const persistido = normalizarGrind(JSON.parse(JSON.stringify(aplicado.grind)))!;
    expect(persistido.sucata).toBe(aplicado.grind!.sucata);
    expect(persistido.modo).toBe("PASSIVO"); // passivo continua o default
  });

  it("normalizarExpedicao: corridas encerradas não ressuscitam; ativas são saneadas", () => {
    // morto/recuou no save → some (null), pra nunca reabrir uma corrida já resolvida
    expect(normalizarExpedicao({ status: "morto", seed: 1, faseAtual: 5, hpMax: 100, hpAtual: 0 })).toBeNull();
    expect(normalizarExpedicao({ status: "recuou", seed: 1, faseAtual: 5, hpMax: 100, hpAtual: 50 })).toBeNull();
    // corrida em combate é preservada e clampada (hp nunca acima do máximo, fase ≥ 1)
    const e = normalizarExpedicao({ status: "combate", seed: 42, faseAtual: 0, faseLimpa: 3, hpMax: 80, hpAtual: 999, lootSucata: 50, lootBaus: 1, ritmoNivel: 2 })!;
    expect(e.faseAtual).toBe(1);
    expect(e.hpAtual).toBe(80);
    expect(e.lootSucata).toBe(50);
    expect(normalizarExpedicao(null)).toBeNull();
  });

  it("normalizarRitmo: sem cargas some; bônus são CAPADOS (não fura a curva de elo)", () => {
    expect(normalizarRitmo({ variante: "x", cargas: 0, bonusComp: 3, bonusCounter: 1 })).toBeNull();
    const r = normalizarRitmo({ variante: "scrim_elite", cargas: 2, bonusComp: 999, bonusCounter: 999 })!;
    expect(r.bonusComp).toBe(RITMO_CAP.comp);
    expect(r.bonusCounter).toBe(RITMO_CAP.counter);
    expect(r.cargas).toBe(2);
  });
});
