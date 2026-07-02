import { describe, expect, it } from "vitest";
import { PASSE, recompensaDe } from "@/data/passe";
import {
  DIA_MS,
  criarPasse,
  gerarDiarias,
  gerarSemanais,
  marcarResgatada,
  nivelDoPasse,
  normalizarPasse,
  podeResgatar,
  ppParaProximo,
  progredirPasse,
  renovarMissoes,
  type PasseState,
} from "./passe";

const passeCom = (over: Partial<PasseState>): PasseState => ({ ...criarPasse(1, 0), ...over });

describe("passe de batalha", () => {
  it("nível pelo PP (1 → 60, capado)", () => {
    expect(nivelDoPasse(0)).toBe(1);
    expect(nivelDoPasse(100)).toBe(2);
    expect(nivelDoPasse(900)).toBe(10);
    expect(nivelDoPasse(999999)).toBe(PASSE.niveis);
  });

  it("PP para o próximo nível", () => {
    expect(ppParaProximo(0)).toBe(PASSE.ppPorNivel);
    expect(ppParaProximo(40)).toBe(PASSE.ppPorNivel - 40);
    expect(ppParaProximo(999999)).toBe(0);
  });

  it("gera nº certo de missões, determinístico", () => {
    expect(gerarDiarias(7)).toHaveLength(PASSE.qtdDiarias);
    expect(gerarSemanais(7)).toHaveLength(PASSE.qtdSemanais);
    expect(gerarDiarias(7)).toEqual(gerarDiarias(7));
  });

  it("progredirPasse conclui e dá PP só no tipo certo (mesmo objeto se nada muda)", () => {
    const passe = passeCom({
      diarias: [{ tipo: "vencer", texto: "Vença 1", escopo: "diaria", alvo: 1, pp: 40, id: "a", progresso: 0, concluida: false }],
      semanais: [],
    });
    const p2 = progredirPasse(passe, "vencer", 1);
    expect(p2.pp).toBe(passe.pp + 40);
    expect(p2.diarias[0].concluida).toBe(true);
    expect(progredirPasse(passe, "treinar", 1)).toBe(passe); // nada muda → mesma referência
  });

  it("premium ganha +10% de PP ao concluir missão", () => {
    const base = {
      diarias: [{ tipo: "vencer" as const, texto: "Vença 1", escopo: "diaria" as const, alvo: 1, pp: 40, id: "a", progresso: 0, concluida: false }],
      semanais: [],
    };
    const free = progredirPasse(passeCom({ ...base, premium: false }), "vencer", 1);
    const prem = progredirPasse(passeCom({ ...base, premium: true }), "vencer", 1);
    expect(free.pp).toBe(40);
    expect(prem.pp).toBe(40 + Math.round(40 * PASSE.premiumBonusPP)); // 44
  });

  it("resgate da trilha premium exige o passe premium", () => {
    const rec = recompensaDe(5, "premium")!;
    expect(podeResgatar(passeCom({ pp: 1000, premium: false }), rec)).toBe(false);
    expect(podeResgatar(passeCom({ pp: 1000, premium: true }), rec)).toBe(true);
  });

  it("renova diárias após 24h, semanais só após 7 dias", () => {
    const p = criarPasse(1, 0);
    const r = renovarMissoes(p, 9, 26 * 3600 * 1000);
    expect(r.diariasEm).toBe(26 * 3600 * 1000);
    expect(r.semanaisEm).toBe(0); // < 7 dias
    expect(renovarMissoes(p, 9, DIA_MS - 1)).toBe(p); // < 24h → nada muda
  });

  it("estado PARCIAL do servidor não explode (crash de produção)", () => {
    // jsonb salvo só com {premium:true} — sem arrays nem pp
    const parcial = { premium: true } as Partial<PasseState>;
    const p = normalizarPasse(parcial, 1, 1000);
    expect(p.premium).toBe(true);
    expect(p.resgatadasFree).toEqual([]);
    expect(p.resgatadasPremium).toEqual([]);
    expect(p.diarias.length).toBeGreaterThan(0);
    expect(p.pp).toBe(0);
    // podeResgatar defensivo mesmo SEM normalizar
    const quebrado = { pp: 1000, premium: true } as PasseState;
    expect(() => podeResgatar(quebrado, recompensaDe(10, "free")!)).not.toThrow();
    expect(podeResgatar(quebrado, recompensaDe(10, "free")!)).toBe(true);
    // jsonb vazio {} e null também normalizam
    expect(normalizarPasse({}, 1, 0).resgatadasFree).toEqual([]);
    expect(normalizarPasse(null, 1, 0).semanais.length).toBeGreaterThan(0);
  });

  it("resgate exige nível e não repete", () => {
    const rec = recompensaDe(10, "free")!;
    const passe = passeCom({ pp: 1000 }); // nível 11
    expect(podeResgatar(passe, rec)).toBe(true);
    expect(podeResgatar(marcarResgatada(passe, rec), rec)).toBe(false);
    expect(podeResgatar(passeCom({ pp: 0 }), rec)).toBe(false); // nível 1
  });
});
