import { describe, expect, it } from "vitest";
import { GRIND } from "@/data/grind";
import {
  acumularSegundosGrind,
  aplicarGrind,
  estadoGrindInicial,
  fecharSemanaGrind,
  gerarItemGrind,
  normalizarGrind,
  placarDoDia,
  resolverGrind,
  tetoAtingido,
} from "./grind";
import { criarCareerState, normalizarCareer } from "./player";
import type { Attributes, CareerState, Player } from "./types";

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function jogador(forca: number, maestria = 50): Player {
  return {
    nome: "Teste",
    nacionalidade: "Brasil",
    idade: 17,
    rota: "MID",
    atributos: attrs(forca),
    pool: [
      { championId: "Ahri", pontos: maestria },
      { championId: "Zed", pontos: maestria / 2 },
      { championId: "Lux", pontos: maestria / 4 },
    ],
    tracos: [],
    reputacao: 10,
    rankSoloq: { elo: "Prata IV", lp: 40, mmr: 1600, streak: 0 },
    energia: 80,
    moral: 60,
  };
}

function carreiraComGrind(p = jogador(50)): CareerState {
  const c = criarCareerState(p);
  return { ...c, grind: estadoGrindInicial("2026-07-03", 12345) };
}

const H3 = GRIND.tetoSegundosDia;

describe("grind de normais — engine puro", () => {
  it("determinismo: mesma (snapshot, segundos, seed) ⇒ mesmas partidas e recompensas", () => {
    const p = jogador(60);
    const a = resolverGrind(p, 7200, 999);
    const b = resolverGrind(p, 7200, 999);
    expect(a).toEqual(b);
    // seed diferente ⇒ (quase certamente) partidas diferentes
    const c = resolverGrind(p, 7200, 1000);
    expect(JSON.stringify(c.completas)).not.toBe(JSON.stringify(a.completas));
  });

  it("segundos viram partidas na duração esperada (8-10 min cada)", () => {
    const r = resolverGrind(jogador(50), 3600, 42); // 1h
    expect(r.completas.length).toBeGreaterThanOrEqual(3); // 3600/600 = 6 no mínimo teórico… ≥3 folgado
    expect(r.completas.length).toBeLessThanOrEqual(7); // 3600/480 = 7.5
    for (const p of r.completas) {
      expect(p.duracaoSeg).toBeGreaterThanOrEqual(GRIND.duracaoMinSeg);
      expect(p.duracaoSeg).toBeLessThanOrEqual(GRIND.duracaoMaxSeg);
    }
    // a "em andamento" existe e começa onde as completas terminam
    expect(r.atual).not.toBeNull();
    const fimUltima = r.completas.length ? r.completas[r.completas.length - 1].inicioSeg + r.completas[r.completas.length - 1].duracaoSeg : 0;
    expect(r.atual!.inicioSeg).toBe(fimUltima);
  });

  it("teto diário: segundos além do teto são IGNORADOS; no teto não há partida em andamento", () => {
    const p = jogador(50);
    const noTeto = resolverGrind(p, H3, 7);
    const alem = resolverGrind(p, H3 + 99999, 7);
    expect(alem).toEqual(noTeto); // ganho extra zero
    expect(noTeto.tetoAtingido).toBe(true);
    expect(noTeto.atual).toBeNull(); // "cansou" — sem próxima partida
    const g = acumularSegundosGrind(estadoGrindInicial("2026-07-03", 1), H3 * 5, "2026-07-03", 2);
    expect(g.segundosHoje).toBe(H3);
    expect(tetoAtingido(g)).toBe(true);
  });

  it("virada de dia: zera acumulado/checkpoint/streak do dia e troca a seed; preserva recordes", () => {
    let g = estadoGrindInicial("2026-07-03", 111);
    g = { ...g, segundosHoje: 5000, partidasAplicadas: 8, streakDia: 4, totalPartidas: 40, maiorStreakV: 6 };
    const novo = acumularSegundosGrind(g, 10, "2026-07-04", 222);
    expect(novo.dia).toBe("2026-07-04");
    expect(novo.seedDia).toBe(222);
    expect(novo.segundosHoje).toBe(10);
    expect(novo.partidasAplicadas).toBe(0);
    expect(novo.streakDia).toBe(0);
    expect(novo.totalPartidas).toBe(40); // recorde de carreira intacto
    expect(novo.maiorStreakV).toBe(6);
    // mesmo dia: só acumula
    const mesmo = acumularSegundosGrind(novo, 20, "2026-07-04", 999);
    expect(mesmo.seedDia).toBe(222); // seed NÃO troca dentro do dia
    expect(mesmo.segundosHoje).toBe(30);
  });

  it("idempotência: aplicar o MESMO lote duas vezes não duplica recompensa", () => {
    const c0 = carreiraComGrind();
    const r = resolverGrind(c0.player, 3600, c0.grind!.seedDia);
    expect(r.completas.length).toBeGreaterThan(0);
    const uma = aplicarGrind(c0, r);
    expect(uma.novas.length).toBe(r.completas.length);
    const duas = aplicarGrind(uma.career, r);
    expect(duas.novas.length).toBe(0);
    expect(duas.career.dinheiro).toBe(uma.career.dinheiro); // nada duplicou
    expect(duas.career.player.pool).toEqual(uma.career.player.pool);
    expect(duas.career.grind!.totalPartidas).toBe(uma.career.grind!.totalPartidas);
    // lote incremental: mais segundos ⇒ aplica SÓ as novas
    const r2 = resolverGrind(c0.player, 5400, c0.grind!.seedDia);
    const tres = aplicarGrind(duas.career, r2);
    expect(tres.novas.length).toBe(r2.completas.length - r.completas.length);
  });

  it("W/L coerente com a força do snapshot (estatístico por simulação)", () => {
    const forte = jogador(90, 90);
    const fraco = jogador(15, 5);
    let vF = 0;
    let vW = 0;
    let n = 0;
    for (let seed = 0; seed < 15; seed++) {
      const rf = resolverGrind(forte, H3, seed);
      const rw = resolverGrind(fraco, H3, seed);
      for (const p of rf.completas) if (p.vitoria) vF++;
      for (const p of rw.completas) if (p.vitoria) vW++;
      n += rf.completas.length;
    }
    const wrForte = vF / n;
    const wrFraco = vW / n;
    expect(wrForte).toBeGreaterThan(0.6); // jogador forte domina normal (~50 de lobby)
    expect(wrFraco).toBeLessThan(0.45);
    expect(wrForte).toBeGreaterThan(wrFraco + 0.2);
  });

  it("REGRA 1: nenhuma recompensa proibida jamais emitida (varredura do retorno)", () => {
    const c0 = carreiraComGrind(jogador(70, 80));
    for (let seed = 0; seed < 10; seed++) {
      const r = resolverGrind(c0.player, H3, seed);
      for (const p of r.completas) {
        // só os campos permitidos de recompensa: $ pequeno, maestria, drop Comum
        expect(p.dinheiro).toBeLessThanOrEqual(GRIND.dinheiroVitoria);
        expect(p.dinheiro).toBeGreaterThan(0);
        expect(p.maestria).toBeLessThanOrEqual(GRIND.maestriaVitoria);
        expect(p).not.toHaveProperty("lpDelta");
        expect(p).not.toHaveProperty("coinpoints");
        expect(p).not.toHaveProperty("energia");
        expect(p).not.toHaveProperty("pp");
        if (p.drop) {
          const item = gerarItemGrind(p.drop, 30);
          expect(item.raridade).toBe(1); // SEMPRE Comum — cap inviolável
        }
      }
      // aplicar NÃO toca no núcleo: elo/MMR/streak da soloq, CoinPoints, pity, energia,
      // cargas, atributos, reputação, lendas e passe ficam idênticos.
      const { career: c1 } = aplicarGrind(c0, r);
      expect(c1.player.rankSoloq).toEqual(c0.player.rankSoloq);
      expect(c1.scoutPontos).toBe(c0.scoutPontos);
      expect(c1.pity).toBe(c0.pity);
      expect(c1.player.energia).toBe(c0.player.energia);
      expect(c1.cargasPartida).toBe(c0.cargasPartida);
      expect(c1.player.atributos).toEqual(c0.player.atributos);
      expect(c1.player.reputacao).toBe(c0.player.reputacao);
      expect(c1.lendas).toEqual(c0.lendas);
      expect(c1.historicoPartidas).toEqual(c0.historicoPartidas); // normal não entra no histórico ranqueado
    }
  });

  it("recompensas aplicadas: $ e maestria batem com a soma das partidas", () => {
    const c0 = carreiraComGrind();
    const r = resolverGrind(c0.player, 7200, c0.grind!.seedDia);
    const { career: c1, novas } = aplicarGrind(c0, r);
    const dinheiroEsperado = novas.reduce((s, p) => s + p.dinheiro, 0);
    expect(c1.dinheiro - c0.dinheiro).toBe(dinheiroEsperado);
    const somaPool = (c: CareerState) => c.player.pool.reduce((s, p) => s + p.pontos, 0);
    const maestriaEsperada = novas.reduce((s, p) => s + p.maestria, 0);
    expect(somaPool(c1) - somaPool(c0)).toBeCloseTo(maestriaEsperada, 1);
    // estado do grind coerente
    expect(c1.grind!.partidasAplicadas).toBe(r.completas.length);
    expect(c1.grind!.semana.partidas).toBe(novas.length);
    const placar = placarDoDia(r);
    expect(placar.v + placar.d).toBe(r.completas.length);
  });

  it("pool vazia: não crasha e não gera partidas", () => {
    const p = { ...jogador(50), pool: [] };
    const r = resolverGrind(p, H3, 1);
    expect(r.completas).toEqual([]);
    expect(r.atual).toBeNull();
  });

  it("virada de semana zera os totais semanais (recordes ficam)", () => {
    const c0 = carreiraComGrind();
    const r = resolverGrind(c0.player, 7200, c0.grind!.seedDia);
    const { career: c1 } = aplicarGrind(c0, r);
    const c2 = fecharSemanaGrind(c1);
    expect(c2.grind!.semana.partidas).toBe(0);
    expect(c2.grind!.semana.dinheiro).toBe(0);
    expect(c2.grind!.totalPartidas).toBe(c1.grind!.totalPartidas);
  });

  it("migração de save: sem grind e com grind corrompido abrem sem crash", () => {
    const antigo = criarCareerState(jogador(50));
    const n1 = normalizarCareer(antigo);
    expect(n1.grind).toBeUndefined(); // save antigo: sem grind até a borda inicializar
    const corrompido = { ...antigo, grind: { dia: 123, lixo: true } } as unknown as CareerState;
    const n2 = normalizarCareer(corrompido);
    expect(n2.grind).toBeUndefined(); // shape inválido → descartado com segurança
    const valido = { ...antigo, grind: { ...estadoGrindInicial("2026-07-01", 5), segundosHoje: H3 * 9, partidasAplicadas: -3 } };
    const n3 = normalizarCareer(valido);
    expect(n3.grind!.segundosHoje).toBe(H3); // clampa no teto
    expect(n3.grind!.partidasAplicadas).toBe(0); // saneia negativo
    expect(normalizarGrind(undefined)).toBeUndefined();
  });
});
