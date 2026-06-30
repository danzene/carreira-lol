import { describe, expect, it } from "vitest";
import { PASSE, recompensaDe } from "@/data/passe";
import {
  criarPasse,
  gerarMissoes,
  marcarResgatada,
  nivelDoPasse,
  podeResgatar,
  ppParaProximo,
  progredirMissoes,
  type MissaoAtiva,
} from "./passe";

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
    expect(ppParaProximo(999999)).toBe(0); // no topo
  });

  it("gera o nº certo de missões e é determinístico", () => {
    const a = gerarMissoes(7);
    expect(a).toHaveLength(PASSE.qtdDiarias + PASSE.qtdSemanais);
    expect(gerarMissoes(7)).toEqual(a);
  });

  it("progredirMissoes conclui e dá o PP só no tipo certo", () => {
    const ms: MissaoAtiva[] = [
      { tipo: "vencer", texto: "Vença 1", escopo: "diaria", alvo: 1, pp: 40, id: "a", progresso: 0, concluida: false },
    ];
    const r = progredirMissoes(ms, "vencer", 1);
    expect(r.ppGanho).toBe(40);
    expect(r.missoes[0].concluida).toBe(true);
    expect(progredirMissoes(ms, "treinar", 1).ppGanho).toBe(0);
  });

  it("resgate exige nível e não repete; premium exige premium", () => {
    const rec = recompensaDe(10, "free")!;
    const passe = { ...criarPasse(1, 0), pp: 1000 }; // nível 11
    expect(podeResgatar(passe, rec)).toBe(true);
    const depois = marcarResgatada(passe, rec);
    expect(podeResgatar(depois, rec)).toBe(false);

    const cedo = { ...criarPasse(1, 0), pp: 0 }; // nível 1
    expect(podeResgatar(cedo, rec)).toBe(false);
  });
});
