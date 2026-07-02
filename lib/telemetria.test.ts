import { describe, expect, it } from "vitest";
import { rastrear, rastrearSessao, rastrearTela } from "./telemetria";

// Telemetria NUNCA quebra o jogo: em ambiente sem window (SSR/node) e sem Supabase,
// todas as chamadas são no-op silenciosos — jamais lançam.

describe("telemetria (falha silenciosa)", () => {
  it("nunca lança, mesmo sem window/Supabase", () => {
    expect(() => rastrear("teste", { a: 1 })).not.toThrow();
    expect(() => rastrearSessao({ b: 2 })).not.toThrow();
    expect(() => rastrearTela("/dashboard")).not.toThrow();
    // rajada não explode a fila (cap interno)
    expect(() => {
      for (let i = 0; i < 500; i++) rastrear("rajada", { i });
    }).not.toThrow();
  });
});
