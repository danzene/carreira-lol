import { describe, expect, it } from "vitest";
import { validarAcao } from "./adminAcoes";

describe("validação de ação administrativa", () => {
  it("nenhuma ação passa sem motivo (Regra 2: tudo é auditado com razão)", () => {
    expect(validarAcao({ acao: "ban", alvo: "u1" })).toMatch(/motivo/i);
    expect(validarAcao({ acao: "ban", alvo: "u1", motivo: "  " })).toMatch(/motivo/i);
    expect(validarAcao({ acao: "ban", alvo: "u1", motivo: "ab" })).toMatch(/motivo/i);
    expect(validarAcao({ acao: "ban", alvo: "u1", motivo: "abuso confirmado" })).toBeNull();
  });

  it("exige alvo e ação", () => {
    expect(validarAcao({ motivo: "x qualquer" })).toMatch(/Ação/i);
    expect(validarAcao({ acao: "flag", motivo: "x qualquer" })).toMatch(/Alvo/i);
  });

  it("ajustar_coinpoints exige delta != 0", () => {
    expect(validarAcao({ acao: "ajustar_coinpoints", alvo: "u1", motivo: "estorno", delta: 0 })).toMatch(/delta/i);
    expect(validarAcao({ acao: "ajustar_coinpoints", alvo: "u1", motivo: "estorno" })).toMatch(/delta/i);
    expect(validarAcao({ acao: "ajustar_coinpoints", alvo: "u1", motivo: "estorno", delta: -500 })).toBeNull();
  });

  it("(in)validar_prova exige semana", () => {
    expect(validarAcao({ acao: "invalidar_prova", alvo: "u1", motivo: "score impossível" })).toMatch(/semana/i);
    expect(validarAcao({ acao: "invalidar_prova", alvo: "u1", motivo: "score impossível", semana: 202601 })).toBeNull();
  });
});
