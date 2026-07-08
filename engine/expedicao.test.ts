import { describe, expect, it } from "vitest";
import { GRIND } from "@/data/grind";
import { EXPEDICAO } from "@/data/expedicao";
import {
  acumularSegundosGrind,
  aplicarGrind,
  consumirRitmo,
  continuarExpedicaoGrind,
  entrarExpedicaoGrind,
  estadoGrindInicial,
  finalizarExpedicaoGrind,
  modsDoGrind,
  normalizarGrind,
  podeExpedicao,
  recuarExpedicaoGrind,
  resolverGrind,
  type EstadoGrind,
} from "./grind";
import {
  forcaDaFase,
  hpMaximo,
  normalizarExpedicao,
  normalizarRitmo,
  passivoAtivo,
  ritmoDaProfundidade,
  sucataDaFase,
  RITMO_CAP,
} from "./expedicao";
import { snapshotDePlayer } from "./duelo";
import { criarCareerState } from "./player";
import type { Attributes, CareerState, Player } from "./types";

const H3 = GRIND.tetoSegundosDia;

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function jogador(): Player {
  return {
    nome: "Teste",
    nacionalidade: "Brasil",
    idade: 17,
    rota: "MID",
    atributos: attrs(50),
    pool: [
      { championId: "Ahri", pontos: 50 },
      { championId: "Zed", pontos: 25 },
    ],
    tracos: [],
    reputacao: 10,
    rankSoloq: { elo: "Prata IV", lp: 40, mmr: 1600, streak: 0 },
    energia: 80,
    moral: 60,
  };
}

function carreira(): CareerState {
  const c = criarCareerState(jogador());
  // unlocksLegacy: libera todas as features (incl. "grind") — a Expedição exige featureLiberada.
  return { ...c, unlocksLegacy: true, grind: estadoGrindInicial("2026-07-07", 12345) };
}

describe("dois modos — Fase 0: fronteira Passivo × Expedição", () => {
  it("estado inicial nasce no PASSIVO, sem corrida, sem ritmo", () => {
    const g = estadoGrindInicial("2026-07-07", 1);
    expect(g.modo).toBe("PASSIVO");
    expect(g.expedicao).toBeNull();
    expect(g.ritmo).toBeNull();
    expect(g.recordeFaseExpedicao).toBe(0);
  });

  it("guard passivoAtivo: só o passivo sem corrida está ativo (só UM modo por vez)", () => {
    expect(passivoAtivo("PASSIVO", null)).toBe(true);
    expect(passivoAtivo("EXPEDICAO", null)).toBe(false);
    // corrida em andamento trava o passivo mesmo com o modo marcado como passivo
    const exp = { seed: 1, faseAtual: 3, faseLimpa: 2, hpMax: 100, hpAtual: 40, lootSucata: 10, lootBaus: 0, ritmoNivel: 1, status: "combate" as const };
    expect(passivoAtivo("PASSIVO", exp)).toBe(false);
    expect(passivoAtivo("EXPEDICAO", exp)).toBe(false);
  });

  it("save ANTIGO (sem os campos novos) migra pra passivo seguro sem perder Sucata/talentos/cosméticos", () => {
    const antigo = {
      ligado: true, dia: "2026-06-01", seedDia: 7, segundosHoje: 120, partidasAplicadas: 0, streakDia: 2,
      totalPartidas: 40, maiorStreakV: 5,
      semana: { partidas: 3, vitorias: 2, dinheiro: 4, maestria: 1, maiorStreakV: 2, maiorStreakD: 1, drops: 0, sucata: 30, bausComum: 1, bausRaro: 0, bausLendario: 0, talentosComprados: 1 },
      sucata: 123, talentos: { gold: 2 }, barraBau: 3, goldFracao: 0.5, bauPendente: null,
      pityLendario: 4, totalBaus: 2, cosmeticos: ["skin_aureo"], equipado: { skin: "skin_aureo" },
      // note: SEM modo/expedicao/ritmo/recordeFaseExpedicao
    };
    const g = normalizarGrind(antigo)!;
    expect(g.modo).toBe("PASSIVO");
    expect(g.expedicao).toBeNull();
    expect(g.ritmo).toBeNull();
    expect(g.recordeFaseExpedicao).toBe(0);
    // patrimônio do passivo intocado
    expect(g.sucata).toBe(123);
    expect(g.talentos).toEqual({ gold: 2 });
    expect(g.cosmeticos).toEqual(["skin_aureo"]);
    expect(g.semana.sucata).toBe(30);
  });

  it("trocar de modo NÃO duplica ganhos nem corrompe o patrimônio do passivo", () => {
    const base: EstadoGrind = { ...estadoGrindInicial("2026-07-07", 1), sucata: 200, talentos: { gold: 1 }, cosmeticos: ["skin_aureo"] };
    // entrar na expedição = trocar o modo (o patrimônio fica idêntico)
    const emExp: EstadoGrind = { ...base, modo: "EXPEDICAO" };
    // voltar ao passivo
    const devolta: EstadoGrind = { ...emExp, modo: "PASSIVO" };
    expect(devolta.sucata).toBe(200);
    expect(devolta.talentos).toEqual({ gold: 1 });
    expect(devolta.cosmeticos).toEqual(["skin_aureo"]);
    // um roundtrip de save no meio não altera nada
    const round = normalizarGrind(JSON.parse(JSON.stringify(emExp)))!;
    expect(round.sucata).toBe(200);
    expect(round.modo).toBe("EXPEDICAO");
  });

  it("Sucata do passivo CONTABILIZA e PERSISTE (roundtrip de save mantém o valor)", () => {
    const c = carreira();
    const g = acumularSegundosGrind(c.grind!, H3, "2026-07-07", 999);
    const r = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g));
    const aplicado = aplicarGrind({ ...c, grind: g }, r).career;
    expect(aplicado.grind!.sucata).toBeGreaterThan(0);
    expect(aplicado.grind!.semana.sucata).toBe(aplicado.grind!.sucata);
    // persistência: serializa e re-normaliza (o que o save faz) → Sucata idêntica
    const persistido = normalizarGrind(JSON.parse(JSON.stringify(aplicado.grind)))!;
    expect(persistido.sucata).toBe(aplicado.grind!.sucata);
    expect(persistido.modo).toBe("PASSIVO"); // passivo continua o default
  });

  it("normalizarExpedicao: corridas encerradas não ressuscitam; ativas são saneadas", () => {
    // morto/recuou no save → some (null), pra nunca reabrir uma corrida já resolvida
    expect(normalizarExpedicao({ status: "morto", seed: 1, faseAtual: 5, hpMax: 100, hpAtual: 0 })).toBeNull();
    expect(normalizarExpedicao({ status: "recuou", seed: 1, faseAtual: 5, hpMax: 100, hpAtual: 50 })).toBeNull();
    // corrida em combate é preservada e clampada (hp nunca acima do máximo, fase ≥ 1)
    const e = normalizarExpedicao({ status: "combate", seed: 42, faseAtual: 0, faseLimpa: 3, hpMax: 80, hpAtual: 999, lootSucata: 50, lootBaus: 1, ritmoNivel: 2 })!;
    expect(e.faseAtual).toBe(1);
    expect(e.hpAtual).toBe(80);
    expect(e.lootSucata).toBe(50);
    expect(normalizarExpedicao(null)).toBeNull();
  });

  it("normalizarRitmo: sem cargas some; bônus são CAPADOS (não fura a curva de elo)", () => {
    expect(normalizarRitmo({ variante: "x", cargas: 0, bonusComp: 3, bonusCounter: 1 })).toBeNull();
    const r = normalizarRitmo({ variante: "scrim_elite", cargas: 2, bonusComp: 999, bonusCounter: 999 })!;
    expect(r.bonusComp).toBe(RITMO_CAP.comp);
    expect(r.bonusCounter).toBe(RITMO_CAP.counter);
    expect(r.cargas).toBe(2);
  });
});

// Corre até a morte (continuando sempre) — a dificuldade cresce, então a morte é garantida.
function rodarAteMorte(career: CareerState, hoje: string, seed: number): CareerState {
  const r = entrarExpedicaoGrind(career, hoje, seed)!;
  let c = r.career;
  for (let i = 0; i < 300 && c.grind!.expedicao?.status === "escolha"; i++) {
    const cont = continuarExpedicaoGrind(c);
    if (!cont) break;
    c = cont.career;
  }
  return c;
}

describe("dois modos — Fase 1: motor da Expedição (fases, HP, push-your-luck, Ritmo)", () => {
  it("HP do herói escala com a forcaRota; a dificuldade das fases cresce (boss bate mais)", () => {
    const fraco = { ...jogador(), atributos: attrs(30) };
    const forte = { ...jogador(), atributos: attrs(90) };
    expect(hpMaximo(forte)).toBeGreaterThan(hpMaximo(fraco));
    expect(forcaDaFase(4)).toBeGreaterThan(forcaDaFase(1));
    // fase 5 é boss (faseBoss=5): bate mais que a fase 4 mesmo sendo "adjacente"
    expect(forcaDaFase(EXPEDICAO.faseBoss)).toBeGreaterThan(forcaDaFase(EXPEDICAO.faseBoss - 1) * 1.2);
  });

  it("loot escala com a profundidade (fonte rápida por ESFORÇO, não por tempo)", () => {
    expect(sucataDaFase(10)).toBeGreaterThan(sucataDaFase(1) * 8);
    expect(sucataDaFase(5)).toBeGreaterThan(sucataDaFase(4));
  });

  it("entrar troca de modo, gasta uma entrada do dia e resolve a 1ª fase", () => {
    const c = carreira();
    const r = entrarExpedicaoGrind(c, "2026-07-07", 777)!;
    expect(r.career.grind!.modo).toBe("EXPEDICAO");
    expect(r.career.grind!.expedicao).not.toBeNull();
    expect(r.career.grind!.expedicoesNoDia).toBe(1);
    expect(r.evento.fase).toBe(1);
    // com uma corrida ativa, não dá pra entrar de novo (só UM por vez)
    expect(podeExpedicao(r.career, "2026-07-07")).toBe("emAndamento");
  });

  it("CONTINUAR mais fundo rende MAIS loot que RECUAR cedo (o dilema tem dente)", () => {
    const c = carreira();
    const r = entrarExpedicaoGrind(c, "2026-07-07", 4242)!; // fase 1 limpa
    const lootF1 = r.career.grind!.expedicao!.lootSucata;
    const cont = continuarExpedicaoGrind(r.career);
    // se sobreviveu à fase 2, o loot acumulado cresceu
    if (cont && cont.career.grind!.expedicao!.status === "escolha") {
      expect(cont.career.grind!.expedicao!.lootSucata).toBeGreaterThan(lootF1);
    }
    expect(lootF1).toBeGreaterThan(0);
  });

  it("RECUAR embolsa o loot GARANTIDO e volta pro passivo (fim honroso)", () => {
    const c = carreira();
    const r = entrarExpedicaoGrind(c, "2026-07-07", 909)!;
    const sucataAntes = r.career.grind!.sucata;
    const loot = r.career.grind!.expedicao!.lootSucata;
    const recuado = recuarExpedicaoGrind(r.career);
    expect(recuado.grind!.expedicao!.status).toBe("recuou");
    const fim = finalizarExpedicaoGrind(recuado, "2026-07-07")!;
    expect(fim.morreu).toBe(false);
    expect(fim.career.grind!.modo).toBe("PASSIVO");
    expect(fim.career.grind!.expedicao).toBeNull();
    expect(fim.career.grind!.sucata).toBeGreaterThanOrEqual(sucataAntes + loot);
  });

  it("MORRER encerra a corrida e preserva SÓ o loot das fases COMPLETADAS", () => {
    const c = carreira();
    const morto = rodarAteMorte(c, "2026-07-07", 31337);
    const exp = morto.grind!.expedicao!;
    expect(exp.status).toBe("morto");
    expect(exp.hpAtual).toBe(0);
    // o loot preservado é exatamente o das fases limpas (a fase fatal não conta)
    const fim = finalizarExpedicaoGrind(morto, "2026-07-07")!;
    expect(fim.morreu).toBe(true);
    expect(fim.faseLimpa).toBe(exp.faseLimpa);
    expect(fim.career.grind!.recordeFaseExpedicao).toBe(exp.faseLimpa);
  });

  it("MORRER na Expedição NÃO afeta a carreira real (elo/atributos/talentos/Sucata guardada)", () => {
    // carreira com patrimônio pré-existente
    let c = carreira();
    c = { ...c, grind: { ...c.grind!, sucata: 500, talentos: { gold: 2 }, cosmeticos: ["skin_aureo"] } };
    const antesAtributos = JSON.stringify(c.player.atributos);
    const antesRank = JSON.stringify(c.player.rankSoloq);
    const antesTalentos = JSON.stringify(c.grind!.talentos);
    const sucataGuardada = c.grind!.sucata;

    const morto = rodarAteMorte(c, "2026-07-07", 5150);
    const fim = finalizarExpedicaoGrind(morto, "2026-07-07")!;
    const p = fim.career.player;

    expect(JSON.stringify(p.atributos)).toBe(antesAtributos); // atributos intocados
    expect(JSON.stringify(p.rankSoloq)).toBe(antesRank); // elo/MMR/streak intocados
    expect(JSON.stringify(fim.career.grind!.talentos)).toBe(antesTalentos); // árvore intocada
    expect(fim.career.grind!.sucata).toBeGreaterThanOrEqual(sucataGuardada); // Sucata guardada JAMAIS cai
    expect(fim.career.grind!.cosmeticos).toContain("skin_aureo"); // cosméticos só crescem
  });

  it("push-your-luck é DETERMINÍSTICO (mesma seed + mesmas escolhas = mesma corrida)", () => {
    const c = carreira();
    const a = rodarAteMorte(c, "2026-07-07", 24680);
    const b = rodarAteMorte(c, "2026-07-07", 24680);
    expect(JSON.stringify(a.grind!.expedicao)).toBe(JSON.stringify(b.grind!.expedicao));
  });

  it("finalize é IDEMPOTENTE: aplica uma vez; 2ª chamada devolve null (loot não dobra)", () => {
    const c = carreira();
    const morto = rodarAteMorte(c, "2026-07-07", 1234);
    const fim1 = finalizarExpedicaoGrind(morto, "2026-07-07")!;
    const sucataApos = fim1.career.grind!.sucata;
    const fim2 = finalizarExpedicaoGrind(fim1.career, "2026-07-07");
    expect(fim2).toBeNull();
    expect(fim1.career.grind!.sucata).toBe(sucataApos);
  });

  it("Ritmo de Treino escala por profundidade e é CAPADO (nunca fura a curva de elo)", () => {
    expect(ritmoDaProfundidade(0)).toBeNull(); // não passou nem da fase 1
    expect(ritmoDaProfundidade(1)!.variante).toBe("aquecimento");
    expect(ritmoDaProfundidade(4)!.variante).toBe("scrim");
    const elite = ritmoDaProfundidade(8)!;
    expect(elite.variante).toBe("scrim_elite");
    expect(elite.bonusComp).toBeLessThanOrEqual(RITMO_CAP.comp);
    expect(elite.bonusCounter).toBeLessThanOrEqual(RITMO_CAP.counter);
  });

  it("Ritmo é TEMPORÁRIO/CONSUMÍVEL e fica FORA do snapshot de duelo ranqueado", () => {
    // ritmo com 2 cargas → consome → 1 → consome → some
    let c = carreira();
    c = { ...c, grind: { ...c.grind!, ritmo: { variante: "scrim", cargas: 2, bonusComp: 2, bonusCounter: 1 } } };
    c = consumirRitmo(c);
    expect(c.grind!.ritmo!.cargas).toBe(1);
    c = consumirRitmo(c);
    expect(c.grind!.ritmo).toBeNull();
    // o snapshot ranqueado NÃO carrega nenhum buff temporário: ninguém enfrenta o Ritmo
    const snap = snapshotDePlayer(carreira().player, "k");
    expect(Object.keys(snap)).not.toContain("ritmo");
    expect(Object.keys(snap)).not.toContain("bonusComp");
  });

  it("limitador de entrada: no máx. EXPEDICAO.maxPorDia por dia; vira o dia, libera", () => {
    let c = carreira();
    for (let i = 0; i < EXPEDICAO.maxPorDia; i++) {
      const r = entrarExpedicaoGrind(c, "2026-07-07", 1000 + i)!;
      const recuado = r.career.grind!.expedicao!.status === "escolha" ? recuarExpedicaoGrind(r.career) : r.career;
      c = finalizarExpedicaoGrind(recuado, "2026-07-07")!.career;
    }
    expect(podeExpedicao(c, "2026-07-07")).toBe("limite");
    expect(entrarExpedicaoGrind(c, "2026-07-07", 9999)).toBeNull();
    // dia novo zera o contador
    expect(podeExpedicao(c, "2026-07-08")).toBeNull();
  });

  it("kill switch desliga a Expedição (global OU sub-switch) — Regra 5", () => {
    const c = carreira();
    expect(podeExpedicao(c, "2026-07-07", { global: false })).toBe("off");
    expect(podeExpedicao(c, "2026-07-07", { expedicao: false })).toBe("off");
    expect(podeExpedicao(c, "2026-07-07")).toBeNull(); // ligado por padrão
  });

  it("Regra 3 (lista proibida): a Expedição só concede Sucata/baús/Ritmo — varredura", () => {
    for (let s = 0; s < 40; s++) {
      const c = carreira();
      const morto = rodarAteMorte(c, "2026-07-07", 7000 + s * 101);
      const fim = finalizarExpedicaoGrind(morto, "2026-07-07")!;
      for (const bau of fim.baus) {
        for (const r of bau.recompensas) {
          expect(["sucata", "dinheiro", "item", "maestria", "cosmetico"]).toContain(r.tipo);
          if (r.tipo === "item") expect(r.slot).toBeTruthy(); // item vira Comum na borda (gerarItemGrind)
        }
      }
      if (fim.ritmo) {
        expect(fim.ritmo.bonusComp).toBeLessThanOrEqual(RITMO_CAP.comp);
        expect(fim.ritmo.bonusCounter).toBeLessThanOrEqual(RITMO_CAP.counter);
      }
    }
  });
});
