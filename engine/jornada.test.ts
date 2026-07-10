import { describe, expect, it } from "vitest";
import { GRIND } from "@/data/grind";
import { JORNADA, ehGate, forcaInimigaJornada, multSucataJornada, regiaoDe } from "@/data/jornada";
import {
  acumularSegundosGrind,
  abrirBau,
  alternarModoAvanco,
  aplicarGrind,
  estadoGrindInicial,
  jornadaDoGrind,
  modsDoGrind,
  normalizarGrind,
  resolverGrind,
  type EstadoGrind,
} from "./grind";
import { sucataInvestida, talentosMaximos } from "./grindProposito";
import { criarCareerState } from "./player";
import type { Attributes, CareerState, Player } from "./types";

const H3 = GRIND.tetoSegundosDia;

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function jogador(forca = 50): Player {
  return {
    nome: "Teste",
    nacionalidade: "Brasil",
    idade: 17,
    rota: "MID",
    atributos: attrs(forca),
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

function carreira(jornada?: Partial<EstadoGrind["jornada"]>): CareerState {
  const c = criarCareerState(jogador());
  const g = estadoGrindInicial("2026-07-10", 12345);
  return { ...c, unlocksLegacy: true, grind: { ...g, jornada: { ...g.jornada, ...jornada } } };
}

// Um dia inteiro no teto na fase corrente (com jornada ligada), abrindo baús.
function diaNaJornada(c0: CareerState, d: number): CareerState {
  const hoje = `2026-08-${String(d + 1).padStart(2, "0")}`;
  const g = acumularSegundosGrind(c0.grind!, H3, hoje, (1000 + d * 7919) >>> 0);
  let c: CareerState = { ...c0, grind: g };
  const r = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g), jornadaDoGrind(g));
  c = aplicarGrind(c, r).career;
  while (c.grind!.bauPendente) c = abrirBau(c, hoje)!.career;
  return c;
}

describe("jornada — dados e curvas", () => {
  it("força inimiga tem PISO na calibração antiga e cresce com a fase até o teto", () => {
    expect(forcaInimigaJornada(1)).toBeGreaterThanOrEqual(GRIND.forcaInimigaMin); // nunca abaixo do neutro antigo
    expect(forcaInimigaJornada(10)).toBeGreaterThan(forcaInimigaJornada(5));
    expect(forcaInimigaJornada(999)).toBe(JORNADA.forcaTeto);
  });

  it("Sucata multiplica com a profundidade (capada) e regiões/gates caem certo", () => {
    expect(multSucataJornada(1)).toBe(1);
    expect(multSucataJornada(20)).toBeGreaterThan(multSucataJornada(10));
    expect(multSucataJornada(999)).toBe(JORNADA.sucataMultMax);
    expect(regiaoDe(1)).toBe(1);
    expect(regiaoDe(10)).toBe(1);
    expect(regiaoDe(11)).toBe(2);
    expect(ehGate(10)).toBe(true);
    expect(ehGate(11)).toBe(false);
  });
});

describe("jornada — avanço, farm, gate e parede", () => {
  it("modo AVANÇAR: vitória sobe a fase; modo FARM: fica parado", () => {
    const avanca = diaNaJornada(carreira({ modoAvanco: "avancar" }), 0);
    expect(avanca.grind!.jornada.fase).toBeGreaterThan(1); // vitórias subiram fases
    expect(avanca.grind!.jornada.faseMax).toBe(avanca.grind!.jornada.fase);

    const farm = diaNaJornada(carreira({ modoAvanco: "farm" }), 0);
    expect(farm.grind!.jornada.fase).toBe(1); // farm não sai do lugar
  });

  it("gate de região: vitória na fase 10 NÃO avança até o boss ser vencido; com boss vencido, passa", () => {
    const preso = diaNaJornada(carreira({ fase: 10, faseMax: 10 }), 1);
    expect(preso.grind!.jornada.fase).toBe(10); // segura no gate

    const liberado = diaNaJornada(carreira({ fase: 10, faseMax: 10, bossVencidos: [10] }), 1);
    expect(liberado.grind!.jornada.fase).toBeGreaterThan(10); // destravou a região 2
  });

  it("trilha para no fim da 1ª dificuldade (fase 40) — nunca passa", () => {
    const fim = diaNaJornada(carreira({ fase: JORNADA.trilhaMax, faseMax: JORNADA.trilhaMax, bossVencidos: [10, 20, 30, 40] }), 2);
    expect(fim.grind!.jornada.fase).toBe(JORNADA.trilhaMax);
  });

  it("PAREDE natural: fase funda tem WR menor que fase rasa — sem morte, sem perda, só estanca", () => {
    const wr = (fase: number): number => {
      let v = 0;
      let total = 0;
      for (let s = 0; s < 6; s++) {
        const c = carreira({ fase, modoAvanco: "farm" });
        const g = acumularSegundosGrind(c.grind!, H3, "2026-08-01", (500 + s * 971) >>> 0);
        const r = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g), jornadaDoGrind(g));
        v += r.completas.filter((p) => p.vitoria).length;
        total += r.completas.length;
      }
      return v / total;
    };
    const raso = wr(2);
    const fundo = wr(30);
    expect(raso).toBeGreaterThan(fundo + 0.15); // dificuldade REAL
    expect(fundo).toBeGreaterThan(0.02); // mas nunca zero: o idle segue rendendo algo
  });

  it("Sucata por partida cresce com a fase; $ e maestria por partida NÃO mudam (Regra 4 protegida)", () => {
    const resolve = (fase: number) => {
      const c = carreira({ fase, modoAvanco: "farm" });
      const g = acumularSegundosGrind(c.grind!, H3, "2026-08-01", 777);
      return resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g), jornadaDoGrind(g));
    };
    const raso = resolve(1);
    const fundo = resolve(25);
    const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    expect(media(fundo.completas.map((p) => p.sucata))).toBeGreaterThan(media(raso.completas.map((p) => p.sucata)) * 1.8);
    // $ por VITÓRIA continua o constante calibrado (a fase muda o WR, nunca o valor unitário)
    for (const p of [...raso.completas, ...fundo.completas]) {
      expect(p.dinheiro).toBe(p.vitoria ? GRIND.dinheiroVitoria : GRIND.dinheiroDerrota);
      expect(p.maestria).toBe(p.vitoria ? GRIND.maestriaVitoria : GRIND.maestriaDerrota);
    }
  });

  it("kill switch: sem contexto de jornada o grind é EXATAMENTE o de antes (força neutra, sem fase)", () => {
    const c = carreira({ fase: 30 });
    const g = acumularSegundosGrind(c.grind!, H3, "2026-08-01", 4242);
    const semJornada = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g), jornadaDoGrind(g, false));
    for (const p of semJornada.completas) expect(p.fase).toBeUndefined();
    // aplicar não mexe na jornada quando as partidas não têm fase
    const ap = aplicarGrind({ ...c, grind: g }, semJornada);
    expect(ap.career.grind!.jornada.fase).toBe(30);
  });

  it("idempotência: reaplicar o MESMO lote não avança a fase duas vezes", () => {
    const c = carreira();
    const g = acumularSegundosGrind(c.grind!, 3600, "2026-08-01", 999);
    const r = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g), jornadaDoGrind(g));
    const uma = aplicarGrind({ ...c, grind: g }, r);
    const duas = aplicarGrind(uma.career, r);
    expect(duas.novas.length).toBe(0);
    expect(duas.career.grind!.jornada.fase).toBe(uma.career.grind!.jornada.fase);
  });

  it("alternarModoAvanco troca farm↔avançar sem tocar em mais nada", () => {
    const c = carreira();
    const t = alternarModoAvanco(c);
    expect(t.grind!.jornada.modoAvanco).toBe("farm");
    expect(alternarModoAvanco(t).grind!.jornada.modoAvanco).toBe("avancar");
    expect(t.grind!.sucata).toBe(c.grind!.sucata);
  });
});

describe("jornada — migração e horizonte", () => {
  it("save antigo migra: fase 1, faseMax herda o recorde da Expedição antiga, avançar por padrão", () => {
    const antigo = {
      ligado: true, dia: "2026-06-01", seedDia: 7, segundosHoje: 0, partidasAplicadas: 0, streakDia: 0,
      totalPartidas: 10, maiorStreakV: 2, semana: {}, sucata: 50, talentos: {}, barraBau: 0, goldFracao: 0,
      bauPendente: null, pityLendario: 0, totalBaus: 0, cosmeticos: [], equipado: {},
      recordeFaseExpedicao: 7, // o jogador já tinha provado a fase 7 no sistema antigo
      // SEM jornada
    };
    const g = normalizarGrind(antigo)!;
    expect(g.jornada.fase).toBe(1);
    expect(g.jornada.faseMax).toBe(7); // honrado
    expect(g.jornada.modoAvanco).toBe("avancar");
    expect(g.jornada.bossVencidos).toEqual([]);
    // jornada suja é saneada
    const sujo = normalizarGrind({ ...antigo, jornada: { fase: 999, faseMax: -3, modoAvanco: "x", bossVencidos: [10, 7, "a"] } })!;
    expect(sujo.jornada.fase).toBe(JORNADA.trilhaMax);
    expect(sujo.jornada.bossVencidos).toEqual([10]); // só gates válidos
  });

  it("HORIZONTE re-simulado: farmando na parede, a árvore completa segue na faixa de ~1,5-3 meses", () => {
    // jogador médio avança até estancar (parede) e segue farmando lá — o caso típico
    let c = carreira();
    let sucataTotal = 0;
    const DIAS = 10;
    for (let d = 0; d < DIAS; d++) {
      const antes = c.grind!.sucata;
      c = diaNaJornada(c, d);
      sucataTotal += c.grind!.sucata - antes;
    }
    const rendaDia = sucataTotal / DIAS;
    const custoArvore = sucataInvestida(talentosMaximos());
    const dias = custoArvore / rendaDia;
    const parede = c.grind!.jornada.fase;
    // números MEDIDOS congelados no CHANGELOG-jornada.md
    // eslint-disable-next-line no-console
    console.log(`[jornada] parede ~fase ${parede} · renda ~${rendaDia.toFixed(0)} Sucata/dia · árvore ${custoArvore} → ${dias.toFixed(0)} dias`);
    expect(parede).toBeGreaterThanOrEqual(8); // a trilha anda de verdade
    expect(parede).toBeLessThanOrEqual(25); // mas a parede existe (não atravessa a trilha)
    expect(dias).toBeGreaterThanOrEqual(40); // horizonte da árvore continua LENTO
    expect(dias).toBeLessThanOrEqual(95);
  });
});
