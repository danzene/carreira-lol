import { describe, expect, it } from "vitest";
import { CASA, ESTACOES, VARIANTES_MENTAL } from "@/data/gamingHouse";
import { LOOP } from "@/data/loop";
import {
  analiseValePara,
  casaDe,
  casaInicial,
  consolidar,
  consumirAnalise,
  decairComPisos,
  definirFoco,
  emBurnout,
  executarSessao,
  fecharSemanaCasa,
  focoHonrado,
  multiplicadoresSessao,
  normalizarCasa,
  tendenciasDoTime,
} from "./gamingHouse";
import { avancarSemana } from "./loop";
import { criarCareerState, criarPlayer, normalizarCareer } from "./player";
import type { Attributes, AtributoKey, CareerState } from "./types";

const AGORA = 1_750_000_000_000; // timestamp fixo (engine puro: o relógio entra por parâmetro)

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function carreira(patch: { moral?: number; energia?: number; atributos?: Attributes } = {}): CareerState {
  const c = criarCareerState(
    criarPlayer({ nome: "Teste", nacionalidade: "Brasil", rota: "MID", atributos: patch.atributos ?? attrs(50), traco: "FLEX", campeoes: ["Ahri", "Zed"] }),
  );
  return {
    ...c,
    casa: casaInicial(),
    player: { ...c.player, moral: patch.moral ?? 60, energia: patch.energia ?? 100 },
  };
}

function sessao(c: CareerState, estacao: Parameters<typeof executarSessao>[1]["estacao"], extra: Partial<Parameters<typeof executarSessao>[1]> = {}) {
  return executarSessao(c, { estacao, intensidade: "normal", agora: AGORA, ...extra });
}

describe("gaming house — sessões: estações, intensidade, moral, foco, decrescente", () => {
  it("cada estação treina os atributos certos; a energia gasta é a MESMA stamina de sempre", () => {
    const c = carreira();
    const r = sessao(c, "AIM_TRAINER")!;
    expect(r.ganhos.mecanica).toBeGreaterThan(0);
    expect(Object.keys(r.ganhos)).toEqual(["mecanica"]);
    expect(r.career.player.energia).toBe(100 - ESTACOES.AIM_TRAINER.custoBase);
    const r2 = sessao(c, "SCRIM_SIM")!;
    expect(r2.ganhos.teamfight).toBeGreaterThan(0);
    expect(r2.ganhos.comunicacao).toBeGreaterThan(0);
    // sem energia = null (nunca meia-sessão)
    expect(sessao(carreira({ energia: 5 }), "AIM_TRAINER")).toBeNull();
  });

  it("intensidade: intensa ganha mais, custa mais energia/fadiga e belisca a Moral; leve é o inverso", () => {
    const c = carreira();
    const leve = sessao(c, "AIM_TRAINER", { intensidade: "leve" })!;
    const normal = sessao(c, "AIM_TRAINER")!;
    const intensa = sessao(c, "AIM_TRAINER", { intensidade: "intensa" })!;
    expect(intensa.ganhos.mecanica!).toBeGreaterThan(normal.ganhos.mecanica!);
    expect(normal.ganhos.mecanica!).toBeGreaterThan(leve.ganhos.mecanica!);
    expect(intensa.fadigaDelta).toBeGreaterThan(normal.fadigaDelta);
    expect(intensa.career.player.energia).toBeLessThan(normal.career.player.energia);
    expect(intensa.moralDelta).toBeLessThan(0); // pequena perda — trade-off transparente
    expect(leve.moralDelta).toBe(0);
  });

  it("Moral multiplica: alta (+18%) e baixa (−15%) — e a UI consegue ler o multiplicador antes", () => {
    const alta = sessao(carreira({ moral: 90 }), "AIM_TRAINER")!;
    const media = sessao(carreira({ moral: 60 }), "AIM_TRAINER")!;
    const baixa = sessao(carreira({ moral: 10 }), "AIM_TRAINER")!;
    expect(alta.ganhos.mecanica!).toBeCloseTo(media.ganhos.mecanica! * CASA.moralAltaMult, 1);
    expect(baixa.ganhos.mecanica!).toBeCloseTo(media.ganhos.mecanica! * CASA.moralBaixaMult, 1);
    expect(multiplicadoresSessao(carreira({ moral: 90 }), "AIM_TRAINER", AGORA).moral).toBe(CASA.moralAltaMult);
  });

  it("Foco da Semana: sessão que treina um atributo do foco ganha o bônus; as demais rendem normal", () => {
    const semFoco = sessao(carreira(), "AIM_TRAINER")!;
    const comFoco = sessao(definirFoco(carreira(), ["mecanica", "macro"], 1001), "AIM_TRAINER")!;
    expect(comFoco.ganhos.mecanica!).toBeCloseTo(semFoco.ganhos.mecanica! * (1 + CASA.focoBonus), 1);
    // estação fora do foco não ganha nada a mais
    const foraDoFoco = sessao(definirFoco(carreira(), ["mecanica", "macro"], 1001), "SCRIM_SIM")!;
    const base = sessao(carreira(), "SCRIM_SIM")!;
    expect(foraDoFoco.ganhos.teamfight!).toBeCloseTo(base.ganhos.teamfight!, 2);
  });

  it("rendimentos decrescentes POR ESTAÇÃO na semana (1ª cheia, depois cai até o piso) — e o coach suaviza", () => {
    let c = carreira();
    const g1 = sessao(c, "AIM_TRAINER")!;
    c = { ...g1.career, player: { ...g1.career.player, energia: 100 } };
    const g2 = sessao(c, "AIM_TRAINER")!;
    c = { ...g2.career, player: { ...g2.career.player, energia: 100 } };
    const g3 = sessao(c, "AIM_TRAINER")!;
    expect(g2.ganhos.mecanica!).toBeCloseTo(g1.ganhos.mecanica! * 0.7, 1);
    expect(g3.ganhos.mecanica!).toBeCloseTo(g1.ganhos.mecanica! * 0.4, 1);
    // outra estação não sofre (o contador é POR estação)
    expect(sessao(c, "CUSTOM_1V1")!.mult.decrescente).toBe(1);
    // coach reduz o passo (treinos repetidos rendem mais)
    const comCoach = { ...c, coachAtivo: true };
    expect(multiplicadoresSessao(comCoach, "AIM_TRAINER", AGORA).decrescente).toBeGreaterThan(
      multiplicadoresSessao(c, "AIM_TRAINER", AGORA).decrescente,
    );
  });

  it("CHAMPION_PRACTICE sobe maestria do campeão ESCOLHIDO da pool (e recusa campeão de fora)", () => {
    const c = carreira();
    const r = sessao(c, "CHAMPION_PRACTICE", { championId: "Zed" })!;
    expect(r.maestria?.championId).toBe("Zed");
    expect(r.career.player.pool.find((p) => p.championId === "Zed")!.pontos).toBeGreaterThan(
      c.player.pool.find((p) => p.championId === "Zed")!.pontos,
    );
    expect(sessao(c, "CHAMPION_PRACTICE", { championId: "Yasuo" })).toBeNull(); // fora da pool
  });

  it("SALA_DE_STREAM paga $ e reputação mas cobra a MAIOR fadiga (streamar cansa)", () => {
    const c = carreira();
    const r = sessao(c, "SALA_DE_STREAM")!;
    expect(r.dinheiro).toBe(ESTACOES.SALA_DE_STREAM.dinheiro);
    expect(r.career.player.reputacao).toBeGreaterThan(c.player.reputacao);
    expect(r.fadigaDelta).toBeGreaterThanOrEqual(ESTACOES.SALA_DE_STREAM.fadigaBase);
  });

  it("bem-estar: terapia recupera Moral, sono derruba fadiga E limpa burnout, academia dá Mental", () => {
    let c = carreira({ moral: 40 });
    c = { ...c, casa: { ...casaDe(c), fadiga: 90, burnoutAte: AGORA + 9999999 } };
    const terapia = sessao(c, "ACADEMIA_SONO_TERAPIA", { variante: "terapia" })!;
    expect(terapia.moralDelta).toBe(VARIANTES_MENTAL.terapia.moral);
    const sono = sessao(c, "ACADEMIA_SONO_TERAPIA", { variante: "sono" })!;
    expect(casaDe(sono.career).fadiga).toBe(90 + VARIANTES_MENTAL.sono.fadiga);
    expect(casaDe(sono.career).burnoutAte).toBeNull(); // dormir sara o burnout
    const academia = sessao(carreira(), "ACADEMIA_SONO_TERAPIA", { variante: "academia" })!;
    expect(academia.ganhos.mental).toBeGreaterThan(0);
  });
});

describe("gaming house — fadiga e burnout (overtraining SEM roubo)", () => {
  it("fadiga acumula até estourar → burnout TEMPORÁRIO: rende 40%, moral dói mais, atributos INTACTOS", () => {
    let c = carreira();
    c = { ...c, casa: { ...casaDe(c), fadiga: 95 } };
    const r = sessao(c, "AIM_TRAINER", { intensidade: "intensa" })!;
    expect(r.entrouBurnout).toBe(true);
    expect(casaDe(r.career).fadiga).toBe(CASA.fadigaMax);
    expect(emBurnout(casaDe(r.career), AGORA + 1000)).toBe(true);
    expect(emBurnout(casaDe(r.career), AGORA + CASA.burnoutMs + 1)).toBe(false); // expira sozinho

    // durante o burnout: rende burnoutMult e a moral cai mais — mas NENHUM atributo cai
    const antes = r.career.player.atributos.mecanica;
    const dentro = executarSessao(r.career, { estacao: "AIM_TRAINER", intensidade: "normal", agora: AGORA + 1000 })!;
    expect(dentro.mult.burnout).toBe(CASA.burnoutMult);
    expect(dentro.moralDelta).toBeLessThan(0);
    expect(dentro.career.player.atributos.mecanica).toBeGreaterThanOrEqual(antes); // treino nunca REGRIDE
  });

  it("avançar a semana dissipa fadiga; DESCANSAR zera e limpa o burnout", () => {
    const casa = { ...casaInicial(), fadiga: 80, burnoutAte: AGORA + 99999 };
    const normal = fecharSemanaCasa(casa, "normal");
    expect(normal.fadiga).toBe(80 - CASA.fadigaAvancarSemana);
    expect(normal.burnoutAte).toBe(casa.burnoutAte); // avanço normal não sara — descanso sim
    const descanso = fecharSemanaCasa(casa, "descanso");
    expect(descanso.fadiga).toBe(0);
    expect(descanso.burnoutAte).toBeNull();
  });
});

describe("gaming house — decay com PISOS DE CONSOLIDAÇÃO (Regra 2: banido o roubo)", () => {
  it("cruzar um marco consolida o piso; o decay NUNCA derruba abaixo dele", () => {
    const consolidado = consolidar(attrs(41), {});
    expect(consolidado.mecanica).toBe(40); // cruzou 20 e 40 → piso 40

    // decay gigante (pior caso absurdo): para EXATAMENTE no piso, jamais abaixo
    const depois = decairComPisos(attrs(41), consolidado, 999);
    (Object.keys(depois) as AtributoKey[]).forEach((k) => expect(depois[k]).toBe(40));

    // decay suave normal desconta só acima do piso
    const suave = decairComPisos(attrs(41), consolidado, 0.25);
    expect(suave.mecanica).toBe(40.75);
  });

  it("avancarSemana consolida ANTES de decair (qualquer fonte de XP conta) e persiste no save", () => {
    let c = carreira({ atributos: attrs(60.1) }); // acabou de cruzar o 60 (ex.: XP de partida)
    c = avancarSemana(c);
    expect(casaDe(c).consolidado.macro).toBe(60);
    expect(c.player.atributos.macro).toBeGreaterThanOrEqual(60); // decaiu no máximo até o piso
    // muitas semanas sem treinar: nunca cai abaixo do último marco — nada de estaca zero
    for (let i = 0; i < 200; i++) c = avancarSemana(c);
    (Object.keys(c.player.atributos) as AtributoKey[]).forEach((k) => {
      expect(c.player.atributos[k]).toBeGreaterThanOrEqual(60);
    });
  });

  it("o anti-decaimento existente (Lendas) segue reduzindo o decay ACIMA do piso", () => {
    // sem alterar o sistema de Lendas: só conferimos que o decay usa o caminho antigo
    const c = carreira({ atributos: attrs(50) });
    const depois = avancarSemana(c);
    // decay padrão 0.25 aplicado (sem lenda equipada): 50 → 49.75, piso 40 intacto
    expect(depois.player.atributos.mecanica).toBe(49.75);
    expect(casaDe(depois).consolidado.mecanica).toBe(40);
  });
});

describe("gaming house — Análise de Adversário (treino → counters → draft)", () => {
  it("estudar arma o consumível pro time certo; vale SÓ contra ele; consumir esvazia", () => {
    const c = carreira();
    const r = sessao(c, "ANALISE_ADVERSARIO", { timeIdAlvo: "FRC" })!;
    expect(analiseValePara(r.career, "FRC")).toBe(true);
    expect(analiseValePara(r.career, "LOS")).toBe(false); // outro time: nada
    expect(analiseValePara(r.career, null)).toBe(false); // soloq: nada
    const usado = consumirAnalise(r.career);
    expect(analiseValePara(usado, "FRC")).toBe(false); // consumido: 1 partida só
    // sem alvo (não há próximo adversário oficial) → sessão recusada
    expect(sessao(c, "ANALISE_ADVERSario" as never)).toBeNull();
    expect(sessao(c, "ANALISE_ADVERSARIO")).toBeNull();
  });

  it("tendências do time são DETERMINÍSTICAS (2 classes) — o que o Quadro Tático revela", () => {
    const a = tendenciasDoTime("FRC");
    expect(a).toEqual(tendenciasDoTime("FRC")); // estável
    expect(a.length).toBe(2);
    expect(a[0]).not.toBe(a[1]);
    expect(tendenciasDoTime("LOS")).not.toEqual(a); // times diferentes tendem diferente (quase sempre)
  });

  it("o snapshot de duelo ranqueado NÃO carrega a análise (fora do ranqueado, como sempre)", () => {
    const r = sessao(carreira(), "ANALISE_ADVERSARIO", { timeIdAlvo: "FRC" })!;
    expect(JSON.stringify(r.career.player)).not.toContain("FRC"); // vive em casa, não no player
  });
});

describe("gaming house — foco honrado, migração e calibração", () => {
  it("foco honrado = TODOS os atributos do foco ganharam na semana; streak fecha na virada", () => {
    let c = definirFoco(carreira(), ["mecanica", "macro"], 1001);
    expect(focoHonrado(casaDe(c))).toBe(false);
    c = sessao(c, "AIM_TRAINER")!.career; // só mecanica
    expect(focoHonrado(casaDe(c))).toBe(false);
    c = { ...c, player: { ...c.player, energia: 100 } };
    c = sessao(c, "REPLAY_ROOM")!.career; // + macro
    expect(focoHonrado(casaDe(c))).toBe(true);
    const virada = fecharSemanaCasa(casaDe(c), "normal");
    expect(virada.semanasFocoHonrado).toBe(1);
    expect(virada.ganhosSemana).toEqual({});
    // semana seguinte SEM honrar → streak zera (foco declarado cobra presença)
    expect(fecharSemanaCasa(virada, "normal").semanasFocoHonrado).toBe(0);
  });

  it("save antigo migra: normalizarCareer injeta a casa com defaults; casa suja é saneada", () => {
    const antigo = carreira();
    delete (antigo as { casa?: unknown }).casa;
    const migrado = normalizarCareer(JSON.parse(JSON.stringify(antigo)));
    expect(migrado.casa).toBeDefined();
    expect(migrado.casa!.fadiga).toBe(0);
    const sujo = normalizarCasa({ fadiga: 9999, foco: ["mecanica", "macro", "laning", 7], consolidado: { mecanica: -5, macro: 40 }, analise: { timeId: 42 } });
    expect(sujo.fadiga).toBe(CASA.fadigaMax);
    expect(sujo.foco.length).toBe(CASA.focoMax);
    expect(sujo.consolidado).toEqual({ macro: 40 });
    expect(sujo.analise).toBeNull();
  });

  it("CALIBRAÇÃO por energia: o melhor caso novo fica na ordem do ESPECIAL antigo (sem inflar)", () => {
    // antigo: ESPECIAL = 3.0 attr / 35⚡ ≈ 0.0857/⚡ (era o teto do otimizador)
    const antigoPorEnergia = LOOP.ganhoEspecial / LOOP.custoEspecial;
    // novo (teto): AIM intensa + foco + moral alta, 1ª sessão da semana
    const c = definirFoco(carreira({ moral: 90 }), ["mecanica", "macro"], 1001);
    const r = executarSessao(c, { estacao: "AIM_TRAINER", intensidade: "intensa", agora: AGORA })!;
    const custo = 100 - r.career.player.energia;
    const novoPorEnergia = r.ganhos.mecanica! / custo;
    // mesma ordem de grandeza: nem 15% acima do antigo (a simulação completa é a F3)
    expect(novoPorEnergia).toBeLessThanOrEqual(antigoPorEnergia * 1.15);
    expect(novoPorEnergia).toBeGreaterThanOrEqual(antigoPorEnergia * 0.6);
  });
});
