import { describe, expect, it } from "vitest";
import { GRIND } from "@/data/grind";
import { EXPEDICAO } from "@/data/expedicao";
import { LOJA } from "@/data/loja";
import {
  abrirBau,
  acumularSegundosGrind,
  aplicarGrind,
  consumirRitmo,
  continuarExpedicaoGrind,
  entrarExpedicaoGrind,
  estadoGrindInicial,
  finalizarExpedicaoGrind,
  finalizarExpedicaoPendente,
  modsDoGrind,
  modsExpedicaoDoGrind,
  normalizarGrind,
  podeExpedicao,
  recuarExpedicaoGrind,
  resolverGrind,
  type EstadoGrind,
} from "./grind";
import {
  estimarProximaFase,
  forcaDaFase,
  hpMaximo,
  normalizarExpedicao,
  normalizarRitmo,
  passivoAtivo,
  ritmoDaProfundidade,
  roteiroDaFase,
  sucataDaFase,
  tiposDaFase,
  RITMO_CAP,
  type EventoFase,
} from "./expedicao";
import { sucataInvestida, talentosMaximos } from "./grindProposito";
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

  it("loot por fase é MODESTO mas cresce com a profundidade (fase funda > fase rasa)", () => {
    // valores pequenos de propósito (o horizonte da árvore não pode furar — ver Fase 3),
    // mas a curva existe: uma fase funda rende mais Sucata que uma rasa.
    expect(sucataDaFase(14)).toBeGreaterThan(sucataDaFase(2));
    expect(sucataDaFase(20)).toBeGreaterThanOrEqual(sucataDaFase(8));
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

describe("dois modos — Fase 2: robustez (sair no meio não corrompe nem duplica)", () => {
  it("sair no MEIO (status escolha) encerra e embolsa o loot das fases COMPLETADAS", () => {
    const c = carreira();
    const r = entrarExpedicaoGrind(c, "2026-07-07", 55)!; // fica em "escolha"
    expect(r.career.grind!.expedicao!.status).toBe("escolha");
    const lootGarantido = r.career.grind!.expedicao!.lootSucata;
    const sucataAntes = r.career.grind!.sucata;

    const { career, fim } = finalizarExpedicaoPendente(r.career, "2026-07-07");
    expect(fim).not.toBeNull();
    expect(fim!.morreu).toBe(false); // sair no meio = recuo honroso, não morte
    expect(career.grind!.expedicao).toBeNull(); // corrida encerrada
    expect(career.grind!.modo).toBe("PASSIVO"); // voltou pro passivo
    expect(career.grind!.sucata).toBeGreaterThanOrEqual(sucataAntes + lootGarantido);

    // 2ª chamada é no-op (nada duplica)
    const dupla = finalizarExpedicaoPendente(career, "2026-07-07");
    expect(dupla.fim).toBeNull();
    expect(dupla.career.grind!.sucata).toBe(career.grind!.sucata);
  });

  it("sem corrida ativa: finalizarExpedicaoPendente é no-op", () => {
    const c = carreira();
    const { career, fim } = finalizarExpedicaoPendente(c, "2026-07-07");
    expect(fim).toBeNull();
    expect(career).toBe(c);
  });

  it("uma corrida MORTA pendente é finalizada como morte (não vira recuo)", () => {
    const c = carreira();
    const morto = rodarAteMorte(c, "2026-07-07", 909090);
    expect(morto.grind!.expedicao!.status).toBe("morto");
    const { fim } = finalizarExpedicaoPendente(morto, "2026-07-07");
    expect(fim!.morreu).toBe(true);
  });
});

describe("expedição viva — roteiro batida-a-batida (teatro determinístico)", () => {
  function eventoSobrevive(fase = 3): EventoFase {
    return { fase, boss: false, limpou: true, morreu: false, danoRecebido: 37, cura: 4, sucata: 2, ganhouBau: false, hpApos: 70 };
  }

  it("sobrevivência: dano fatiado soma EXATO, todos os inimigos morrem e a cura fecha no hpApos do engine", () => {
    const ev = eventoSobrevive();
    const rot = roteiroDaFase(4242, ev, jogador());
    const hits = rot.batidas.filter((b) => b.t === "inimigoAtaca");
    const kills = rot.batidas.filter((b) => b.t === "heroiMata");
    expect(hits.reduce((s, b) => s + b.dano, 0)).toBe(ev.danoRecebido); // soma exata
    expect(kills.length).toBe(rot.tipos.length); // leva inteira cai
    expect(rot.batidas[rot.batidas.length - 1].t).toBe("cura");
    expect(rot.batidas[rot.batidas.length - 1].hpApos).toBe(ev.hpApos); // teatro termina no valor real
    expect(rot.morte).toBe(false);
  });

  it("morte: o roteiro trunca no golpe fatal — HP termina em 0 e nem todos os inimigos caem", () => {
    const ev: EventoFase = { fase: 8, boss: false, limpou: false, morreu: true, danoRecebido: 55, cura: 0, sucata: 0, ganhouBau: false, hpApos: 0 };
    const rot = roteiroDaFase(1337, ev, jogador());
    const ultima = rot.batidas[rot.batidas.length - 1];
    expect(ultima.t).toBe("inimigoAtaca"); // o golpe fatal encerra
    expect(ultima.hpApos).toBe(0);
    const kills = rot.batidas.filter((b) => b.t === "heroiMata").length;
    expect(kills).toBeLessThan(rot.tipos.length); // a leva NÃO foi limpa
    expect(rot.morte).toBe(true);
  });

  it("determinístico (mesma seed = mesmo roteiro) e o boss é o último da fila", () => {
    const ev = eventoSobrevive(5); // fase 5 = boss
    const a = roteiroDaFase(99, { ...ev, boss: true }, jogador());
    const b = roteiroDaFase(99, { ...ev, boss: true }, jogador());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(["barao", "dragao"]).toContain(a.tipos[a.tipos.length - 1]);
    // leva visível respeita o pool da cena (máx. 6)
    for (let f = 1; f <= 20; f++) expect(tiposDaFase(7, f).length).toBeLessThanOrEqual(6);
  });
});

// Um dia inteiro de passivo no teto, abrindo os baús → Sucata ganha no dia.
function diaPassivo(c0: CareerState, hoje: string, seedDia: number): { career: CareerState; sucata: number } {
  const g = acumularSegundosGrind(c0.grind!, GRIND.tetoSegundosDia, hoje, seedDia);
  let c: CareerState = { ...c0, grind: g };
  const r = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g));
  c = aplicarGrind(c, r).career;
  while (c.grind!.bauPendente) c = abrirBau(c, hoje)!.career;
  return { career: c, sucata: c.grind!.sucata - c0.grind!.sucata };
}

// Jogador SENSATO na Expedição: continua enquanto o risco de morte < 50%, senão recua.
function corridaEstrategica(c0: CareerState, hoje: string, seed: number): { career: CareerState; sucata: number; fase: number } {
  const entrada = entrarExpedicaoGrind(c0, hoje, seed);
  if (!entrada) return { career: c0, sucata: 0, fase: 0 };
  let c = entrada.career;
  for (let i = 0; i < 300; i++) {
    const exp = c.grind!.expedicao;
    if (!exp || exp.status !== "escolha") break;
    const prev = estimarProximaFase(exp, c.player, modsExpedicaoDoGrind(c.grind ?? undefined));
    if (prev.chanceMorte >= 0.5) {
      c = recuarExpedicaoGrind(c);
      break;
    }
    const cont = continuarExpedicaoGrind(c);
    if (!cont) break;
    c = cont.career;
  }
  const antes = c0.grind!.sucata;
  const pronta = c.grind!.expedicao?.status === "escolha" ? recuarExpedicaoGrind(c) : c;
  const fim = finalizarExpedicaoGrind(pronta, hoje);
  if (!fim) return { career: c, sucata: c.grind!.sucata - antes, fase: 0 };
  return { career: fim.career, sucata: fim.career.grind!.sucata - antes, fase: fim.faseLimpa };
}

describe("dois modos — Fase 3: equilíbrio (simulação dupla)", () => {
  it("árvore completa em ~1,5–2,5 meses combinando Passivo + Expedição (não acelerou demais)", () => {
    const DIAS = 14;
    let c = carreira(); // talentos zerados: medindo a renda pra AFFORD a árvore
    let passivo = 0;
    let expedicaoTotal = 0;
    let somaFases = 0;
    for (let d = 0; d < DIAS; d++) {
      const hoje = `2026-08-${String(d + 1).padStart(2, "0")}`;
      const seedDia = (1000 + d * 7919) >>> 0;
      const p = diaPassivo(c, hoje, seedDia);
      c = p.career;
      passivo += p.sucata;
      for (let k = 0; k < EXPEDICAO.maxPorDia; k++) {
        const r = corridaEstrategica(c, hoje, (777 + d * 31 + k * 101) >>> 0);
        c = r.career;
        expedicaoTotal += r.sucata;
        somaFases += r.fase;
      }
    }
    const custoArvore = sucataInvestida(talentosMaximos());
    const rendaPassiva = passivo / DIAS;
    const rendaCombinada = (passivo + expedicaoTotal) / DIAS;
    const diasPassivo = custoArvore / rendaPassiva;
    const diasCombinado = custoArvore / rendaCombinada;
    const faseMedia = somaFases / (DIAS * EXPEDICAO.maxPorDia);
    // números MEDIDOS congelados no CHANGELOG-dois-modos.md
    // eslint-disable-next-line no-console
    console.log(
      `[sim dupla] árvore ${custoArvore} · passivo ~${rendaPassiva.toFixed(0)}/dia (${diasPassivo.toFixed(0)} dias) · combinado ~${rendaCombinada.toFixed(0)}/dia (${diasCombinado.toFixed(0)} dias) · fase média ${faseMedia.toFixed(1)}`,
    );
    // o jogador MAIS engajado (passivo no teto + Expedição no máximo) ainda leva ≥ ~1,5 mês
    expect(diasCombinado).toBeGreaterThanOrEqual(45);
    expect(diasCombinado).toBeLessThanOrEqual(75);
    // e o passivo sozinho continua lento (a Expedição acelera, mas não trivializa)
    expect(diasPassivo).toBeGreaterThan(diasCombinado);
  });

  it("Ritmo não fura a curva de elo: é comparável ao buff da loja e continua temporário/capado", () => {
    // o melhor Ritmo não introduz um NOVO patamar de poder — é da ordem do 'preparacao' da loja
    expect(RITMO_CAP.comp).toBeLessThanOrEqual(LOJA.preparacao.comp + 2);
    expect(RITMO_CAP.counter).toBeLessThanOrEqual(LOJA.preparacao.counterLane + 1);
    const elite = ritmoDaProfundidade(999)!; // profundíssimo ⇒ melhor variante
    expect(elite.bonusComp).toBe(RITMO_CAP.comp);
    expect(elite.cargas).toBeLessThanOrEqual(2); // pouquíssimas partidas, some rápido
  });

  it("talentos ligam a árvore à Expedição (mais HP; começa mais fundo)", () => {
    const p = jogador();
    const hpSemTalento = hpMaximo(p, modsExpedicaoDoGrind(estadoGrindInicial("2026-07-07", 1)));
    const gComFuria: EstadoGrind = { ...estadoGrindInicial("2026-07-07", 1), talentos: { furia: 3 } };
    const hpComFuria = hpMaximo(p, modsExpedicaoDoGrind(gComFuria));
    expect(hpComFuria).toBeGreaterThan(hpSemTalento); // Fúria dá +HP na Expedição
    // Trevo maxado começa 1 fase à frente
    const gTrevo: EstadoGrind = { ...estadoGrindInicial("2026-07-07", 1), talentos: { trevo: 3 } };
    expect(modsExpedicaoDoGrind(gTrevo).faseInicial).toBe(2);
    expect(modsExpedicaoDoGrind(estadoGrindInicial("2026-07-07", 1)).faseInicial).toBe(1);
  });
});
