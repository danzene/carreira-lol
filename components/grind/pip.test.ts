import { describe, expect, it } from "vitest";
import { janelaPip, marcarPip, pipAberta, visibilidadeEfetiva } from "./pip";

// A contagem de segundos do grind usa UM acumulador com UM guard (visibilidadeEfetiva).
// Dupla contagem é impossível por construção — estes testes travam a tabela-verdade.

describe("visibilidade efetiva (aba × PiP)", () => {
  it("só aba visível ⇒ conta; só PiP ⇒ conta; ambas ⇒ conta UMA vez; nenhuma ⇒ não conta", () => {
    expect(visibilidadeEfetiva(true, false)).toBe(true); // cenário 1: só a aba
    expect(visibilidadeEfetiva(false, true)).toBe(true); // cenário 2: só a PiP (o propósito do recurso)
    expect(visibilidadeEfetiva(true, true)).toBe(true); // cenário 3: ambas — booleano único, sem 2×
    expect(visibilidadeEfetiva(false, false)).toBe(false); // aba oculta sem PiP: zero ganho
  });

  it("singleton da PiP: janela fechada não conta como aberta (sem listener órfão enganando o guard)", () => {
    marcarPip(null);
    expect(pipAberta()).toBe(false);
    expect(janelaPip()).toBeNull();
    const fake = { closed: false } as Window;
    marcarPip(fake);
    expect(pipAberta()).toBe(true);
    expect(janelaPip()).toBe(fake);
    // a janela foi fechada pelo X: o singleton percebe sozinho, mesmo antes do pagehide
    (fake as { closed: boolean }).closed = true;
    expect(pipAberta()).toBe(false);
    expect(janelaPip()).toBeNull();
    marcarPip(null);
  });
});
