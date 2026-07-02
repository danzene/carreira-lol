import { describe, expect, it } from "vitest";
import { CRIACAO, INICIO } from "@/data/config";
import {
  atributosIniciais,
  criarCareerState,
  criarPlayer,
  normalizarCareer,
  pontosRestantes,
  somaPontosDistribuidos,
  validarCriacao,
  type CriarPlayerInput,
  type FormularioCriacao,
} from "./player";
import type { CareerState } from "./types";

describe("normalizarCareer (migração de save)", () => {
  it("save antigo/parcial ganha todos os campos obrigatórios (crash de produção)", () => {
    // save de versão velha: player sem tracos/pool, sem inbox/historico
    const bruto = {
      player: { nome: "Onitsut", rota: "MID", atributos: { mecanica: 60 }, rankSoloq: { elo: "Ferro III", lp: 20, mmr: 900 } },
      dinheiro: 500,
      semanaAtual: 9,
      temporada: 1,
    } as unknown as CareerState;
    const c = normalizarCareer(bruto);
    expect(c.player.tracos).toEqual([]); // era o crash: tracos.includes de undefined
    expect(c.player.pool).toEqual([]);
    expect(c.historicoPartidas).toEqual([]);
    expect(c.inbox).toEqual([]);
    expect(c.equipamentos).toEqual([]);
    expect(c.feed).toEqual([]); // campos do feed (Mundo Vivo) com default seguro
    expect(c.feedNovos).toBe(0);
    expect(c.player.atributos.macro).toBeGreaterThan(0); // atributos completados
    expect(c.player.atributos.mecanica).toBe(60); // sem perder o que existia
    expect(c.player.rankSoloq.elo).toBe("Ferro III");
    expect(c.semanaAtual).toBe(9);
    expect(c.dinheiro).toBe(500);
  });

  it("save completo passa intacto nos campos preenchidos", () => {
    const completo = criarCareerState(
      criarPlayer({ nome: "T", nacionalidade: "Brasil", rota: "MID", atributos: atributosIniciais(), traco: "FLEX", campeoes: ["A", "B", "C"] }),
    );
    const n = normalizarCareer(completo);
    expect(n.player.tracos).toEqual(completo.player.tracos);
    expect(n.player.pool).toEqual(completo.player.pool);
    expect(n.dinheiro).toBe(completo.dinheiro);
  });
});

function formValido(): FormularioCriacao {
  const atributos = atributosIniciais();
  atributos.mecanica = 75; // +35
  atributos.laning = 75; // +35
  atributos.macro = 50; // +10  => total +80
  return { nome: "Faker", atributos, traco: "LANE_BULLY", campeoes: ["Ahri", "LeBlanc", "Azir"] };
}

function inputValido(): CriarPlayerInput {
  const f = formValido();
  return { nome: f.nome, nacionalidade: "Coreia do Sul", rota: "MID", atributos: f.atributos, traco: "LANE_BULLY", campeoes: f.campeoes };
}

describe("criação de jogador", () => {
  it("atributos iniciais ficam na base", () => {
    const a = atributosIniciais();
    expect(a.mecanica).toBe(CRIACAO.atributoBase);
    expect((Object.values(a) as number[]).every((v) => v === CRIACAO.atributoBase)).toBe(true);
  });

  it("conta pontos distribuídos e restantes", () => {
    const a = atributosIniciais();
    a.mecanica = 60;
    expect(somaPontosDistribuidos(a)).toBe(20);
    expect(pontosRestantes(a)).toBe(CRIACAO.pontosParaDistribuir - 20);
  });

  it("form válido não tem erros", () => {
    expect(validarCriacao(formValido())).toEqual([]);
  });

  it("acusa erro sem traço", () => {
    const f: FormularioCriacao = { ...formValido(), traco: null };
    expect(validarCriacao(f).length).toBeGreaterThan(0);
  });

  it("acusa erro com pool incompleta", () => {
    const f: FormularioCriacao = { ...formValido(), campeoes: ["Ahri"] };
    expect(validarCriacao(f).length).toBeGreaterThan(0);
  });

  it("criarPlayer guarda o traço e a pool", () => {
    const p = criarPlayer(inputValido());
    expect(p.tracos).toEqual(["LANE_BULLY"]);
    expect(p.pool).toHaveLength(CRIACAO.tamanhoPool);
    expect(p.pool[0].pontos).toBe(CRIACAO.maestriaInicial);
    expect(p.energia).toBe(INICIO.energia);
  });

  it("criarCareerState usa o modelo novo (tier, patch, equipamentos)", () => {
    const s = criarCareerState(criarPlayer(inputValido()));
    expect(s.semanaAtual).toBe(1);
    expect(s.temporada).toBe(1);
    expect(s.tierAtual).toBe("SOLOQ");
    expect(s.patchVigente).toBe(1);
    expect(s.equipamentos).toEqual([]);
    expect(s.contratoAtual).toBeNull();
    expect(s.dinheiro).toBe(INICIO.dinheiro);
  });
});
