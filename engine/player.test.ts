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
  type FormularioCriacao,
} from "./player";

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
