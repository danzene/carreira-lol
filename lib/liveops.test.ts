import { describe, expect, it } from "vitest";
import { bannerDoDia, featureLigada } from "./liveops";

describe("live-ops fail-open", () => {
  it("feature LIGADA quando não há config (falha de leitura não tira o jogo do ar)", () => {
    expect(featureLigada(null, "gacha")).toBe(true);
    expect(featureLigada({}, "gacha")).toBe(true);
    expect(featureLigada({ feature_flags: {} }, "duelo_online")).toBe(true);
  });

  it("feature LIGADA quando a chave está ausente, DESLIGADA só com false explícito", () => {
    expect(featureLigada({ feature_flags: { gacha: true } }, "prova_semanal")).toBe(true);
    expect(featureLigada({ feature_flags: { gacha: false } }, "gacha")).toBe(false);
    expect(featureLigada({ feature_flags: { gacha: true } }, "gacha")).toBe(true);
  });
});

describe("mensagem do dia", () => {
  it("some quando inativa, ausente ou sem texto", () => {
    expect(bannerDoDia(null)).toBeNull();
    expect(bannerDoDia({ mensagem_do_dia: { ativo: false, texto: "oi" } })).toBeNull();
    expect(bannerDoDia({ mensagem_do_dia: { ativo: true, texto: "  " } })).toBeNull();
  });

  it("aparece quando ativa e com texto; tipo default = info", () => {
    expect(bannerDoDia({ mensagem_do_dia: { ativo: true, titulo: "Oi", texto: "Novidade!" } })).toEqual({
      titulo: "Oi",
      texto: "Novidade!",
      tipo: "info",
    });
    expect(bannerDoDia({ mensagem_do_dia: { ativo: true, texto: "x", tipo: "aviso" } })?.tipo).toBe("aviso");
  });
});
