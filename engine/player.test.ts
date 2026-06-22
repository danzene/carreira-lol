import { describe, expect, it } from "vitest";
import { CRIACAO, INICIO } from "@/data/config";
import {
  atributosIniciais,
  criarCareerState,
  criarPlayer,
  pontosRestantes,
  somaPontosDistribuidos,
  validarCriacao,
  type CriarPlayerInput,
} from "./player";

function inputValido(): CriarPlayerInput {
  const atributos = atributosIniciais();
  atributos.mecanica = 75; // +35
  atributos.laning = 75; // +35
  atributos.macro = 50; // +10  => total +80
  return {
    nome: "Faker",
    nacionalidade: "Coreia do Sul",
    rota: "MID",
    atributos,
    campeoes: ["Ahri", "LeBlanc", "Azir"],
  };
}

describe("criação de jogador", () => {
  it("atributos iniciais ficam todos na base", () => {
    const a = atributosIniciais();
    expect(a.mecanica).toBe(CRIACAO.atributoBase);
    expect((Object.values(a) as number[]).every((v) => v === CRIACAO.atributoBase)).toBe(true);
  });

  it("conta pontos distribuídos e restantes", () => {
    const a = atributosIniciais();
    a.mecanica = 60; // +20
    expect(somaPontosDistribuidos(a)).toBe(20);
    expect(pontosRestantes(a)).toBe(CRIACAO.pontosParaDistribuir - 20);
  });

  it("input válido não tem erros", () => {
    expect(validarCriacao(inputValido())).toEqual([]);
  });

  it("acusa erro quando sobram pontos", () => {
    const input = inputValido();
    input.atributos.macro = 40; // tira os +10 -> faltam 10
    expect(validarCriacao(input).length).toBeGreaterThan(0);
  });

  it("acusa erro com pool incompleta", () => {
    const input: CriarPlayerInput = { ...inputValido(), campeoes: ["Ahri"] };
    expect(validarCriacao(input).length).toBeGreaterThan(0);
  });

  it("criarPlayer monta a pool com maestria e idade padrão", () => {
    const p = criarPlayer(inputValido());
    expect(p.pool).toHaveLength(CRIACAO.tamanhoPool);
    expect(p.pool[0].pontos).toBe(CRIACAO.maestriaInicial);
    expect(p.idade).toBe(CRIACAO.idadeInicial);
    expect(p.energia).toBe(INICIO.energia);
    expect(p.atributos.mecanica).toBe(75);
  });

  it("criarCareerState começa na semana 1, temporada 1, sem time", () => {
    const s = criarCareerState(criarPlayer(inputValido()));
    expect(s.semanaAtual).toBe(1);
    expect(s.temporada).toBe(1);
    expect(s.contratoAtual).toBeNull();
    expect(s.dinheiro).toBe(INICIO.dinheiro);
    expect(s.historicoPartidas).toEqual([]);
    expect(s.inbox).toEqual([]);
  });
});
