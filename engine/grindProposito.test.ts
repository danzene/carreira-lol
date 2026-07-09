import { describe, expect, it } from "vitest";
import { ECONOMIA } from "@/data/economia";
import { GRIND } from "@/data/grind";
import { COLECAO_GRIND, GRIND_PROP, TALENTOS } from "@/data/grindProposito";
import { SIMULACAO } from "@/data/simulacao";
import {
  abrirBau,
  acumularSegundosGrind,
  aplicarGrind,
  comprarTalentoGrind,
  equiparCosmeticoGrind,
  estadoGrindInicial,
  fecharSemanaGrind,
  gerarItemGrind,
  modsDoGrind,
  resolverGrind,
  respecGrind,
} from "./grind";
import {
  bloqueioTalento,
  colecaoCompleta,
  comprarTalento,
  custoTalento,
  modsGrind,
  MODS_NEUTROS,
  rolarBau,
  rolarTierBau,
  sucataInvestida,
  talentosMaximos,
  type Talentos,
} from "./grindProposito";
import { criarCareerState, normalizarCareer } from "./player";
import { simularPartida } from "./simularPartida";
import type { Attributes, CareerState, Player } from "./types";

const H3 = GRIND.tetoSegundosDia;

function attrs(v: number): Attributes {
  return { mecanica: v, macro: v, laning: v, teamfight: v, consistencia: v, mental: v, comunicacao: v, championPool: v };
}

function jogador(forca = 50, maestria = 50): Player {
  return {
    nome: "Teste",
    nacionalidade: "Brasil",
    idade: 17,
    rota: "MID",
    atributos: attrs(forca),
    pool: [
      { championId: "Ahri", pontos: maestria },
      { championId: "Zed", pontos: maestria / 2 },
      { championId: "Lux", pontos: maestria / 4 },
    ],
    tracos: [],
    reputacao: 10,
    rankSoloq: { elo: "Prata IV", lp: 40, mmr: 1600, streak: 0 },
    energia: 80,
    moral: 60,
  };
}

function carreira(talentos: Talentos = {}, sucata = 0): CareerState {
  const c = criarCareerState(jogador());
  return { ...c, grind: { ...estadoGrindInicial("2026-07-07", 12345), talentos, sucata } };
}

// Roda 1 dia inteiro no teto e abre o baú se caiu (o fluxo real da borda).
function dia(career: CareerState, d: number): { career: CareerState; bausAbertos: number } {
  const g = acumularSegundosGrind(career.grind!, H3, `2026-08-${String(d + 1).padStart(2, "0")}`, (1000 + d * 7919) >>> 0);
  let c: CareerState = { ...career, grind: g };
  const r = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g));
  c = aplicarGrind(c, r).career;
  let bausAbertos = 0;
  while (c.grind!.bauPendente) {
    c = abrirBau(c, "2026-08-01")!.career;
    bausAbertos++;
  }
  return { career: c, bausAbertos };
}

describe("economia FECHADA da Sucata (Regra 1)", () => {
  it("Sucata só entra pelo grind e só sai na árvore — nunca vira $ nem CoinPoints", () => {
    const c0 = carreira();
    const r = resolverGrind(c0.player, 7200, c0.grind!.seedDia, modsDoGrind(c0.grind));
    const { career: c1 } = aplicarGrind(c0, r);
    const sucataGanha = r.completas.reduce((s, p) => s + p.sucata, 0);
    expect(c1.grind!.sucata).toBe(sucataGanha); // entrou SÓ das partidas
    expect(c1.scoutPontos).toBe(c0.scoutPontos); // CoinPoints intactos

    // gastar na árvore: sai Sucata, NADA entra em $/CoinPoints
    const comSucata = { ...c1, grind: { ...c1.grind!, sucata: 500 } };
    const compra = comprarTalentoGrind(comSucata, "atkspeed")!;
    expect(compra.career.grind!.sucata).toBe(500 - custoTalento(TALENTOS[0], 0));
    expect(compra.career.dinheiro).toBe(comSucata.dinheiro); // $ não muda ao comprar
    expect(compra.career.scoutPontos).toBe(comSucata.scoutPontos);

    // respec devolve exatamente o investido — a Sucata continua DENTRO do grind
    const dep = respecGrind(compra.career);
    expect(dep.grind!.sucata).toBe(500);
    expect(dep.grind!.talentos).toEqual({});
    expect(dep.dinheiro).toBe(comSucata.dinheiro);
  });

  it("nenhum caminho externo credita Sucata (só resolverGrind/abrirBau tocam nela)", () => {
    const c0 = carreira({}, 100);
    // ações que NÃO são do grind não podem mexer na Sucata
    expect(equiparCosmeticoGrind(c0, "skin", "skin_aureo").grind!.sucata).toBe(100); // nem equipar (nem possui)
    expect(fecharSemanaGrind(c0).grind!.sucata).toBe(100); // nem a virada de semana
    expect(respecGrind(c0).grind!.sucata).toBe(100); // respec sem talentos = neutro
  });
});

describe("REGRA 2: lista proibida varrida (talentos + QUALQUER baú)", () => {
  const PERMITIDOS = new Set(["sucata", "dinheiro", "item", "maestria", "cosmetico"]);
  // inclui os efeitos de Expedição (expHp/expLoot/expFase): mexem só no modo de treino,
  // nunca em PDL/CoinPoints/passe/energia/cargas/pity-do-gacha (Regra 3 da rodada Dois Modos).
  const EFEITOS_PERMITIDOS = new Set(["duracao", "encenacao", "golpeDuplo", "gold", "sucata", "barra", "raro", "pity", "escolha", "expHp", "expLoot", "expFase"]);

  it("efeitos de talento não tocam PDL/CoinPoints/passe/energia/cargas/pity-do-gacha", () => {
    for (const t of TALENTOS) {
      for (const k of Object.keys(t.efeito)) expect(EFEITOS_PERMITIDOS.has(k)).toBe(true);
    }
  });

  it("recompensas de baú (comum/raro/lendário, 400 rolagens) só emitem o union permitido; item SEMPRE Comum", () => {
    const maxs = modsGrind(talentosMaximos());
    for (let s = 0; s < 400; s++) {
      for (const [mods, pity] of [
        [MODS_NEUTROS, 0],
        [maxs, 0],
        [MODS_NEUTROS, GRIND_PROP.pityLendarioN - 1], // força o Lendário
      ] as const) {
        const b = rolarBau(s * 7919, s + 1, pity, mods, []);
        for (const r of b.recompensas) {
          expect(PERMITIDOS.has(r.tipo)).toBe(true);
          if (r.tipo === "item") expect(gerarItemGrind({ slot: r.slot, seedItem: r.seedItem }, 40).raridade).toBe(1);
          if (r.tipo === "dinheiro") expect(r.valor).toBeLessThanOrEqual(GRIND_PROP.raro.dinheiro);
          if (r.tipo === "maestria") expect(r.valor).toBeLessThanOrEqual(GRIND_PROP.raro.maestriaPack);
        }
      }
    }
  });

  it("abrir baú NÃO toca elo/MMR/CoinPoints/pity-do-gacha/energia/cargas/atributos/reputação", () => {
    let c = carreira({}, 0);
    // força um baú pendente de cada tier e abre
    for (const pity of [0, GRIND_PROP.pityLendarioN - 1]) {
      for (let s = 0; s < 40; s++) {
        const bau = rolarBau(s * 131, s + 1, pity, MODS_NEUTROS, []);
        const comBau = { ...c, grind: { ...c.grind!, bauPendente: bau } };
        const ab = abrirBau(comBau, "2026-08-01")!;
        const d = ab.career;
        expect(d.player.rankSoloq).toEqual(comBau.player.rankSoloq);
        expect(d.scoutPontos).toBe(comBau.scoutPontos);
        expect(d.pity).toBe(comBau.pity);
        expect(d.player.energia).toBe(comBau.player.energia);
        expect(d.cargasPartida).toBe(comBau.cargasPartida);
        expect(d.player.atributos).toEqual(comBau.player.atributos);
        expect(d.player.reputacao).toBe(comBau.player.reputacao);
        expect(d.lendas).toEqual(comBau.lendas);
        c = d;
      }
    }
  });

  it("cosméticos não alteram nenhum número de gameplay (Regra 3)", () => {
    const c0 = { ...carreira(), grind: { ...carreira().grind!, cosmeticos: COLECAO_GRIND.map((x) => x.id) } };
    const antes = modsDoGrind(c0.grind);
    const c1 = equiparCosmeticoGrind(equiparCosmeticoGrind(c0, "skin", "skin_aureo"), "pet", "pet_poro");
    expect(modsDoGrind(c1.grind)).toEqual(antes); // mods idênticos: cosmético é só desejo
    expect(c1.dinheiro).toBe(c0.dinheiro);
    expect(c1.player).toEqual(c0.player);
  });
});

describe("árvore de talentos", () => {
  it("prereq linear no ramo, custo crescente e teto de nível", () => {
    let t: Talentos = {};
    expect(bloqueioTalento(t, 9999, "dano")).toBe("prereq"); // nó 2 exige nó 1
    expect(bloqueioTalento(t, 0, "atkspeed")).toBe("sucata");
    expect(bloqueioTalento(t, 9999, "atkspeed")).toBeNull();
    // custo cresce a cada nível
    expect(custoTalento(TALENTOS[0], 1)).toBeGreaterThan(custoTalento(TALENTOS[0], 0));
    // compra até o máx e depois trava
    let sucata = 100000;
    for (let i = 0; i < TALENTOS[0].nivelMax; i++) {
      const r = comprarTalento(t, sucata, "atkspeed")!;
      t = r.talentos;
      sucata = r.sucata;
    }
    expect(t.atkspeed).toBe(TALENTOS[0].nivelMax);
    expect(bloqueioTalento(t, 9999, "atkspeed")).toBe("max");
    expect(comprarTalento(t, 9999, "atkspeed")).toBeNull();
    expect(bloqueioTalento(t, 9999, "dano")).toBeNull(); // prereq liberado
  });

  it("respec devolve EXATAMENTE a Sucata investida (grátis)", () => {
    const max = talentosMaximos();
    const investido = sucataInvestida(max);
    expect(investido).toBeGreaterThan(0);
    const c = { ...carreira(max, 7), grind: { ...carreira(max, 7).grind! } };
    const d = respecGrind(c);
    expect(d.grind!.sucata).toBe(7 + investido);
  });

  it("COMBATE: velocidade de ataque encurta a partida ⇒ MAIS partidas dentro do mesmo teto", () => {
    const p = jogador();
    const semTalento = resolverGrind(p, H3, 42, MODS_NEUTROS);
    const comVel = resolverGrind(p, H3, 42, modsGrind({ atkspeed: 5, dano: 1, duplo: 1, foco: 5 }));
    expect(comVel.completas[0].duracaoSeg).toBeLessThan(semTalento.completas[0].duracaoSeg);
    expect(comVel.completas.length).toBeGreaterThan(semTalento.completas.length); // rende mais no teto
    // a encenação também acelera (visual) e o golpe duplo aparece
    const m = modsGrind({ atkspeed: 5, dano: 5, duplo: 5, foco: 5, furia: 3 });
    expect(m.encenacaoMult).toBeGreaterThan(1);
    expect(m.golpeDuplo).toBeGreaterThan(0);
    // guarda dura: a duração nunca some
    expect(modsGrind({ atkspeed: 99, foco: 99 }).duracaoMult).toBeGreaterThanOrEqual(0.5);
  });

  it("FORTUNA: sobe $ e Sucata médios; maestria NÃO escala com talento (Regra 4)", () => {
    const p = jogador();
    const base = resolverGrind(p, H3, 7, MODS_NEUTROS);
    const rico = resolverGrind(p, H3, 7, modsGrind({ gold: 5, catador: 5, ima: 5, bonus: 5, cofre: 3 }));
    const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(media(rico.completas.map((x) => x.dinheiro))).toBeGreaterThan(media(base.completas.map((x) => x.dinheiro)));
    expect(media(rico.completas.map((x) => x.sucata))).toBeGreaterThan(media(base.completas.map((x) => x.sucata)));
    // maestria por partida é IDÊNTICA (só o nº de partidas muda, e Fortuna não mexe nisso)
    expect(rico.completas.length).toBe(base.completas.length);
    expect(media(rico.completas.map((x) => x.maestria))).toBe(media(base.completas.map((x) => x.maestria)));
  });

  it("SORTE: muda a distribuição de tier (estatístico) e nunca fura o piso do pity", () => {
    const conta = (mods: ReturnType<typeof modsGrind>) => {
      let raros = 0;
      const N = 3000;
      for (let s = 0; s < N; s++) if (rolarTierBau(s * 2654435761, 0, mods).tier === "raro") raros++;
      return raros / N;
    };
    const semSorte = conta(MODS_NEUTROS);
    const comSorte = conta(modsGrind({ raro: 5, pity: 5, escolha: 1, instinto: 5, trevo: 3 }));
    expect(semSorte).toBeGreaterThan(0.1);
    expect(semSorte).toBeLessThan(0.2); // ~15% base
    expect(comSorte).toBeGreaterThan(semSorte + 0.08); // +~15% absoluto

    // pity: N reduz com o talento, mas o PISO é intransponível
    expect(MODS_NEUTROS.pityN).toBe(GRIND_PROP.pityLendarioN);
    expect(modsGrind({ raro: 1, pity: 5 }).pityN).toBe(GRIND_PROP.pityLendarioN - 20);
    expect(modsGrind({ raro: 1, pity: 999 }).pityN).toBe(GRIND_PROP.pityLendarioPiso);
    expect(modsGrind({ raro: 1, pity: 999 }).pityN).toBeGreaterThanOrEqual(GRIND_PROP.pityLendarioPiso);

    // "Segunda Chance": Raro abre 2 pacotes pra escolher 1
    const b = rolarBau(1234, 1, 0, modsGrind({ raro: 1, pity: 1, escolha: 1 }), []);
    if (b.tier === "raro") expect(b.opcoes).toHaveLength(2);
  });
});

describe("baús: pity, pendência, transbordo e revelação", () => {
  it("pity OCULTO: Lendário garantido em ≤ N baús, mesmo sem sorte no dado", () => {
    const semPity = rolarTierBau(999, GRIND_PROP.pityLendarioN - 2, MODS_NEUTROS);
    expect(semPity.foiPity).toBe(false); // ainda não estourou
    const noPity = rolarTierBau(999, GRIND_PROP.pityLendarioN - 1, MODS_NEUTROS);
    expect(noPity).toEqual({ tier: "lendario", foiPity: true });
    // com o talento, a garantia chega mais cedo (mas nunca antes do piso)
    const mods = modsGrind({ raro: 1, pity: 5 });
    expect(rolarTierBau(999, mods.pityN - 1, mods)).toEqual({ tier: "lendario", foiPity: true });
    expect(rolarTierBau(999, GRIND_PROP.pityLendarioPiso - 2, modsGrind({ raro: 1, pity: 999 })).foiPity).toBe(false);
  });

  it("máx. 1 baú pendente: a barra para em cheia e NENHUM 2º baú rola até abrir", () => {
    let c = carreira();
    // um dia inteiro no teto gera gold de sobra pra mais de um baú
    const g = { ...c.grind!, segundosHoje: H3 };
    c = { ...c, grind: g };
    const r = resolverGrind(c.player, H3, g.seedDia, modsDoGrind(g));
    const ap = aplicarGrind(c, r);
    expect(ap.career.grind!.bauPendente).not.toBeNull();
    expect(ap.career.grind!.totalBaus).toBe(1); // só UM rolou
    expect(ap.career.grind!.barraBau).toBeLessThanOrEqual(GRIND_PROP.barraCheia); // parada em cheia

    // enquanto pendente, a Sucata do baú NÃO entrou (tier revelado só na abertura)
    const sucataAntes = ap.career.grind!.sucata;
    const somaPartidas = r.completas.reduce((s, p) => s + p.sucata, 0);
    expect(sucataAntes).toBe(somaPartidas); // nada do baú ainda

    const ab = abrirBau(ap.career, "2026-08-01")!;
    expect(ab.career.grind!.bauPendente).toBeNull();
    const sucataBau = ab.recompensas.reduce((s, x) => s + (x.tipo === "sucata" ? x.valor : 0), 0);
    expect(ab.career.grind!.sucata).toBe(sucataAntes + sucataBau); // só agora
  });

  it("transbordo: o excedente da barra vai pra próxima (nada some quando não há pendente)", () => {
    const c = carreira();
    const quaseCheia = GRIND_PROP.barraCheia - 1;
    const g = { ...c.grind!, barraBau: quaseCheia, segundosHoje: 600 };
    const c1: CareerState = { ...c, grind: g };
    const r = resolverGrind(c1.player, 600, g.seedDia, modsDoGrind(g));
    const ap = aplicarGrind(c1, r);
    if (ap.career.grind!.bauPendente) {
      const gold = r.completas.reduce((s, p) => s + p.dinheiro, 0);
      const esperado = quaseCheia + gold - GRIND_PROP.barraCheia;
      expect(ap.career.grind!.barraBau).toBeCloseTo(Math.min(GRIND_PROP.barraCheia, esperado), 4);
    }
  });

  it("coleção: Lendário dá cosmético inédito; coleção cheia vira jackpot TRIPLO de Sucata", () => {
    const inedito = rolarBau(555, 1, GRIND_PROP.pityLendarioN - 1, MODS_NEUTROS, []);
    expect(inedito.tier).toBe("lendario");
    const cosm = inedito.recompensas.find((r) => r.tipo === "cosmetico");
    expect(cosm).toBeDefined();
    // já possui aquele → nunca repete
    const possuidos = COLECAO_GRIND.map((x) => x.id).slice(0, COLECAO_GRIND.length - 1);
    const penultimo = rolarBau(777, 2, GRIND_PROP.pityLendarioN - 1, MODS_NEUTROS, possuidos);
    const c2 = penultimo.recompensas.find((r) => r.tipo === "cosmetico");
    expect(c2 && c2.tipo === "cosmetico" && c2.id).toBe(COLECAO_GRIND[COLECAO_GRIND.length - 1].id);
    // coleção completa → sem cosmético, jackpot ×3
    const todos = COLECAO_GRIND.map((x) => x.id);
    expect(colecaoCompleta(todos)).toBe(true);
    const cheio = rolarBau(888, 3, GRIND_PROP.pityLendarioN - 1, MODS_NEUTROS, todos);
    expect(cheio.recompensas.every((r) => r.tipo === "sucata")).toBe(true);
    const jackpot = cheio.recompensas[0];
    expect(jackpot.tipo === "sucata" && jackpot.valor).toBeGreaterThanOrEqual(GRIND_PROP.lendario.sucataMin * 3);
  });

  it("equipar cosmético só funciona com o item POSSUÍDO", () => {
    const c = carreira();
    expect(equiparCosmeticoGrind(c, "skin", "skin_aureo").grind!.equipado.skin).toBeUndefined();
    const dono = { ...c, grind: { ...c.grind!, cosmeticos: ["skin_aureo"] } };
    expect(equiparCosmeticoGrind(dono, "skin", "skin_aureo").grind!.equipado.skin).toBe("skin_aureo");
    expect(equiparCosmeticoGrind(dono, "skin", undefined).grind!.equipado.skin).toBeUndefined(); // desequipa
  });
});

describe("idempotência e migração", () => {
  it("reprocessar o MESMO lote não duplica Sucata, barra nem baús", () => {
    const c0 = carreira();
    const g = { ...c0.grind!, segundosHoje: 5400 };
    const c1: CareerState = { ...c0, grind: g };
    const r = resolverGrind(c1.player, 5400, g.seedDia, modsDoGrind(g));
    const uma = aplicarGrind(c1, r);
    const duas = aplicarGrind(uma.career, r);
    expect(duas.novas).toHaveLength(0);
    expect(duas.career.grind!.sucata).toBe(uma.career.grind!.sucata);
    expect(duas.career.grind!.barraBau).toBe(uma.career.grind!.barraBau);
    expect(duas.career.grind!.totalBaus).toBe(uma.career.grind!.totalBaus);
    expect(duas.career.dinheiro).toBe(uma.career.dinheiro);
    // abrir 2× também não duplica
    if (uma.career.grind!.bauPendente) {
      const ab = abrirBau(uma.career, "2026-08-01")!;
      expect(abrirBau(ab.career, "2026-08-01")).toBeNull();
    }
  });

  it("$ fracionário do talento de Ouro não vaza: career.dinheiro fica INTEIRO", () => {
    const c0 = carreira({ gold: 5, bonus: 5 }); // goldMult = 1.35 → $2.7/vitória
    const g = { ...c0.grind!, segundosHoje: H3 };
    const c1: CareerState = { ...c0, grind: g };
    const r = resolverGrind(c1.player, H3, g.seedDia, modsDoGrind(g));
    const ap = aplicarGrind(c1, r);
    expect(Number.isInteger(ap.career.dinheiro)).toBe(true);
    const goldExato = r.completas.reduce((s, p) => s + p.dinheiro, 0);
    // o inteiro entregue + a fração guardada reconstroem o gold exato
    expect(ap.career.dinheiro - c1.dinheiro + ap.career.grind!.goldFracao).toBeCloseTo(goldExato, 2);
  });

  it("save antigo (sem os campos novos) migra com defaults e sem crash", () => {
    const antigo = criarCareerState(jogador());
    const comGrindVelho = {
      ...antigo,
      grind: { ligado: true, dia: "2026-07-01", seedDia: 5, segundosHoje: 100, partidasAplicadas: 0, streakDia: 0, totalPartidas: 3, maiorStreakV: 1, semana: { partidas: 3 } },
    } as unknown as CareerState;
    const n = normalizarCareer(comGrindVelho);
    expect(n.grind!.sucata).toBe(0);
    expect(n.grind!.talentos).toEqual({});
    expect(n.grind!.bauPendente).toBeNull();
    expect(n.grind!.cosmeticos).toEqual([]);
    expect(n.grind!.equipado).toEqual({ skin: undefined, trilha: undefined, pet: undefined });
    expect(n.grind!.pityLendario).toBe(0);
    expect(n.grind!.semana.bausRaro).toBe(0);
    // lixo nos campos novos é saneado
    const sujo = { ...comGrindVelho, grind: { ...(comGrindVelho.grind as object), sucata: -5, talentos: { x: "a", atkspeed: 2 }, barraBau: 9e9, bauPendente: { tier: "ouro" }, cosmeticos: [1, "skin_aureo"] } } as unknown as CareerState;
    const n2 = normalizarCareer(sujo);
    expect(n2.grind!.sucata).toBe(0);
    expect(n2.grind!.talentos).toEqual({ atkspeed: 2 });
    expect(n2.grind!.barraBau).toBe(GRIND_PROP.barraCheia);
    expect(n2.grind!.bauPendente).toBeNull();
    expect(n2.grind!.cosmeticos).toEqual(["skin_aureo"]);
  });

  it("virada de semana zera os contadores novos (Sucata/baús/talentos) sem perder o acervo", () => {
    const c = carreira({ atkspeed: 2 }, 300);
    const comSemana = { ...c, grind: { ...c.grind!, semana: { ...c.grind!.semana, sucata: 50, bausRaro: 2, talentosComprados: 1 }, cosmeticos: ["pet_poro"] } };
    const d = fecharSemanaGrind(comSemana);
    expect(d.grind!.semana.sucata).toBe(0);
    expect(d.grind!.semana.bausRaro).toBe(0);
    expect(d.grind!.semana.talentosComprados).toBe(0);
    expect(d.grind!.sucata).toBe(300); // acervo intacto
    expect(d.grind!.cosmeticos).toEqual(["pet_poro"]);
    expect(d.grind!.talentos).toEqual({ atkspeed: 2 });
  });
});

describe("ECONOMIA (Regra 4): 4 semanas no teto, talentos ZERADOS × MAXIMIZADOS", () => {
  const DIAS = 28;

  // Baseline ativo (conservador: só bônus de vitória + maestria de partida)
  function ativo4Semanas(): { dinheiro: number; maestria: number } {
    const p = jogador();
    let dinheiro = 0;
    let maestria = 0;
    for (let d = 0; d < DIAS; d++) {
      for (let i = 0; i < 12; i++) {
        const res = simularPartida(p, { championId: "Ahri", forcaMetaCampeao: 50, comp: 50, compInimigo: 50 }, (d * 131 + i) >>> 0);
        dinheiro += res.vitoria ? ECONOMIA.bonusBaseVitoria : 0;
        maestria += res.vitoria ? SIMULACAO.maestriaVitoria : SIMULACAO.maestriaDerrota;
      }
    }
    return { dinheiro, maestria };
  }

  // Grind no teto TODOS os dias, ABRINDO os baús (o $ e a maestria deles contam!).
  // Modelo HONESTO do jogador engajado: as partidas entram uma a uma (como os ticks de
  // 5s da borda) e o baú é aberto assim que cai — se aplicássemos o dia inteiro de uma
  // vez, o "máx. 1 pendente" travaria a barra e o ouro seria DESPERDIÇADO, subestimando
  // o rendimento. Este é o limite SUPERIOR que precisa caber no teto de ~25%.
  function grind4Semanas(talentos: Talentos): { dinheiro: number; maestria: number; partidas: number; baus: number; sucata: number } {
    let c = carreira(talentos, 0);
    const dinheiro0 = c.dinheiro;
    let maestria = 0;
    let partidas = 0;
    let baus = 0;
    for (let d = 0; d < DIAS; d++) {
      const g = acumularSegundosGrind(c.grind!, H3, `2026-08-${String((d % 28) + 1).padStart(2, "0")}`, (1000 + d * 7919) >>> 0);
      c = { ...c, grind: g };
      const doDia = resolverGrind(c.player, g.segundosHoje, g.seedDia, modsDoGrind(g));
      for (let k = 1; k <= doDia.completas.length; k++) {
        const parcial = { completas: doDia.completas.slice(0, k), atual: null, tetoAtingido: false };
        const ap = aplicarGrind(c, parcial);
        c = ap.career;
        for (const p of ap.novas) {
          maestria += p.maestria;
          partidas++;
        }
        while (c.grind!.bauPendente) {
          const ab = abrirBau(c, "2026-08-01")!;
          c = ab.career;
          baus++;
          for (const rec of ab.recompensas) if (rec.tipo === "maestria") maestria += rec.valor;
        }
      }
    }
    return { dinheiro: c.dinheiro - dinheiro0, maestria, partidas, baus, sucata: c.grind!.sucata };
  }

  it("zerado ≤20% e MAXIMIZADO ≤25% da progressão ativa (em $ e maestria)", () => {
    const ativo = ativo4Semanas();
    const zero = grind4Semanas({});
    const max = grind4Semanas(talentosMaximos());

    // MAX rende mais que zerado (o loop de upgrade funciona de verdade)
    expect(max.partidas).toBeGreaterThan(zero.partidas); // velocidade de ataque
    expect(max.dinheiro).toBeGreaterThan(zero.dinheiro); // ouro + mais partidas
    expect(max.sucata).toBeGreaterThan(zero.sucata); // catador
    expect(max.baus).toBeGreaterThanOrEqual(zero.baus); // ímã de baú

    const razao = (g: number, a: number) => g / a;
    // Números MEDIDOS (congelados no CHANGELOG-grind-proposito.md) — ativo: $4175 / 921.5 maestria
    //   ZERADO: 546 partidas · 49 baús · $645 · 160.4 maestria · 2405 sucata → $ 15.4% · maestria 17.4%
    //   MAX   : 620 partidas · 88 baús · $924 · 192.0 maestria · 4762 sucata → $ 22.1% · maestria 20.8%
    expect(razao(zero.dinheiro, ativo.dinheiro)).toBeLessThanOrEqual(0.2);
    expect(razao(zero.maestria, ativo.maestria)).toBeLessThanOrEqual(0.2);
    expect(razao(max.dinheiro, ativo.dinheiro)).toBeLessThanOrEqual(0.25); // critério da rodada
    expect(razao(max.maestria, ativo.maestria)).toBeLessThanOrEqual(0.25);
    // piso de sanidade: o grind não é inútil
    expect(razao(max.dinheiro, ativo.dinheiro)).toBeGreaterThan(0.05);
  });
});

describe("kill switch e fluxo real de dia", () => {
  it("um dia no teto rende Sucata, abre baús e a Sucata compra talento (loop fechado)", () => {
    let c = carreira();
    let baus = 0;
    for (let d = 0; d < 3; d++) {
      const r = dia(c, d);
      c = r.career;
      baus += r.bausAbertos;
    }
    expect(c.grind!.sucata).toBeGreaterThan(0);
    expect(baus).toBeGreaterThan(0);
    expect(c.grind!.totalPartidas).toBeGreaterThan(40);
    // dá pra comprar o primeiro nó com o que juntou
    expect(bloqueioTalento(c.grind!.talentos, c.grind!.sucata, "atkspeed")).toBeNull();
    const compra = comprarTalentoGrind(c, "atkspeed")!;
    expect(compra.nivel).toBe(1);
    expect(compra.career.grind!.semana.talentosComprados).toBe(1);
  });
});
