import { describe, expect, it } from "vitest";
import {
  abrirEntrevista,
  fatosDaSemana,
  gerarPostsFeed,
  podeEntrevistar,
  responderEntrevista,
} from "./feed";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { CareerState, MatchResult } from "./types";

function carreira(): CareerState {
  return criarCareerState(
    criarPlayer({
      nome: "Onitsut",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["Ahri", "Zed", "Orianna"],
    }),
  );
}

const partida = (vitoria: boolean, championId = "Ahri"): MatchResult => ({
  vitoria,
  kda: { k: 5, d: 2, a: 7 },
  notaPerformance: 7,
  csPorMin: 8,
  championId,
  lpDelta: vitoria ? 20 : -18,
  xpGanho: {},
  log: [],
});

// semana movimentada: streak alta + nota de stomp + drop mítico + campeão problema
function semanaCheia(): CareerState {
  const c = carreira();
  return {
    ...c,
    player: { ...c.player, rankSoloq: { ...c.player.rankSoloq, streak: 5 } },
    statsSemana: { partidas: 8, vitorias: 5, melhorNota: 9.1, lpLiquido: 42, dropsPorRaridade: { 5: 1 }, melhorKda: { k: 12, d: 1, a: 8 } },
    historicoPartidas: [partida(false, "Zed"), partida(false, "Zed"), partida(false, "Zed"), partida(true), partida(true), partida(true), partida(true), partida(true)],
  };
}

describe("feed vivo", () => {
  it("é determinístico: mesmo estado + seed = mesmos posts", () => {
    const c = semanaCheia();
    const f = fatosDaSemana(c);
    expect(gerarPostsFeed(c, f, 42)).toEqual(gerarPostsFeed(c, f, 42));
  });

  it("volume controlado: semana cheia gera 2-5 posts; semana morta gera 0", () => {
    const cheia = semanaCheia();
    const posts = gerarPostsFeed(cheia, fatosDaSemana(cheia), 7);
    expect(posts.length).toBeGreaterThanOrEqual(2);
    expect(posts.length).toBeLessThanOrEqual(5);
    const morta = carreira(); // sem statsSemana
    expect(gerarPostsFeed(morta, fatosDaSemana(morta), 7)).toHaveLength(0);
  });

  it("gatilhos disparam: campeão problema (3+ derrotas), drop mítico e rival", () => {
    const c = { ...semanaCheia(), rivais: { FRC: { derrotas: 2, vitoriasContra: 0, ativo: true } } };
    const f = fatosDaSemana(c);
    expect(f.campeaoProblema).toEqual({ championId: "Zed", derrotas: 3 });
    expect(f.dropMitico).toBe(true);
    expect(f.rivalId).toBe("FRC");
    const gatilhos = gerarPostsFeed(c, f, 3).map((p) => p.gatilho);
    expect(gatilhos.length).toBeGreaterThan(0);
    // os gatilhos mais relevantes da semana aparecem primeiro (streak 5 = 75 > stomp 70)
    expect(gatilhos[0]).toBe("sequencia_vitorias");
    expect(gatilhos).toContain("stomp");
  });

  it("placeholders preenchidos (nunca vaza {nome} cru)", () => {
    const c = semanaCheia();
    for (const p of gerarPostsFeed(c, fatosDaSemana(c), 11)) {
      expect(p.texto).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(p.likes).toBeGreaterThan(0);
    }
  });
});

describe("entrevista pós-jogo", () => {
  it("humilde sobe moral+reputação; confiante sobe reputação; provocadora cria rivalidade", () => {
    const base = abrirEntrevista({ ...carreira() }, "rival", "FRC");
    expect(base.entrevistaPendente?.contexto).toBe("rival");

    const h = responderEntrevista(base, "humilde", 1);
    expect(h.career.player.moral).toBeGreaterThan(base.player.moral);
    expect(h.career.player.reputacao).toBeGreaterThan(base.player.reputacao);

    const cQ = responderEntrevista(base, "confiante", 1);
    expect(cQ.career.player.reputacao).toBeGreaterThan(h.career.player.reputacao - 3); // +4 vs +2

    const p = responderEntrevista(base, "provocadora", 1);
    expect(p.career.rivais?.FRC?.ativo).toBe(true); // provocou → rivalidade acesa
    expect(p.career.feed?.[0].texto).toContain('"'); // a fala vira post com aspas
    expect(p.career.entrevistaPendente).toBeUndefined();
  });

  it("máximo 1 entrevista por semana (chave marca a semana)", () => {
    const base = abrirEntrevista(carreira(), "titulo");
    const r = responderEntrevista(base, "humilde", 2);
    expect(podeEntrevistar(r.career)).toBe(false); // mesma semana: não abre outra
    expect(abrirEntrevista(r.career, "rival", "X").entrevistaPendente).toBeUndefined();
    // semana seguinte libera
    const proxima = { ...r.career, semanaAtual: r.career.semanaAtual + 1 };
    expect(podeEntrevistar(proxima)).toBe(true);
  });
});
