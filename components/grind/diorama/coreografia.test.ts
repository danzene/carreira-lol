import { describe, expect, it } from "vitest";
import type { PartidaGrind } from "@/engine/grind";
import { coreografarCorpo, coreografarDesfecho, seedCoreografia } from "./coreografia";

// 🎬 A coreografia é ENCENAÇÃO pura: determinística por seed e fiel ao resultado
// que o engine já decidiu — nunca o contrário.

function partida(vitoria: boolean, extra: Partial<PartidaGrind> = {}): PartidaGrind {
  return {
    idx: 3,
    championId: "Ahri",
    adversario: "TioDoLanche",
    vitoria,
    kda: { k: 5, d: 3, a: 7 },
    nota: 6.5,
    dinheiro: vitoria ? 2 : 0,
    maestria: vitoria ? 0.4 : 0.15,
    sucata: 3,
    inicioSeg: 1620,
    duracaoSeg: 540,
    ...extra,
  };
}

describe("coreografia do diorama", () => {
  it("determinismo: mesma partida+seed ⇒ mesma timeline (corpo e desfecho)", () => {
    expect(coreografarCorpo(42, 3, "Prata IV")).toEqual(coreografarCorpo(42, 3, "Prata IV"));
    expect(coreografarDesfecho(partida(true), 42)).toEqual(coreografarDesfecho(partida(true), 42));
    // seeds/partidas diferentes ⇒ timelines diferentes
    expect(JSON.stringify(coreografarCorpo(42, 4, "Prata IV"))).not.toBe(JSON.stringify(coreografarCorpo(42, 3, "Prata IV")));
    expect(seedCoreografia(42, 3)).not.toBe(seedCoreografia(42, 4));
  });

  it("corpo: 3-4 waves ordenadas, golpes com timestamps crescentes e kill no último hit de cada alvo", () => {
    const c = coreografarCorpo(7, 0, "Ouro I");
    expect(c.waves.length).toBeGreaterThanOrEqual(3);
    expect(c.waves.length).toBeLessThanOrEqual(4);
    expect(c.duracao).toBeGreaterThanOrEqual(30);
    expect(c.duracao).toBeLessThanOrEqual(90); // cabe num loop agradável de assistir
    for (const w of c.waves) {
      expect(w.inimigos.length).toBeGreaterThanOrEqual(1);
      expect(w.inimigos.length).toBeLessThanOrEqual(5);
      // golpes em ordem e cada inimigo morre exatamente no seu último golpe
      const porAlvo = new Map<number, number>();
      let tAnt = 0;
      for (const g of w.golpes) {
        expect(g.t).toBeGreaterThanOrEqual(tAnt);
        tAnt = g.t;
        porAlvo.set(g.alvo, (porAlvo.get(g.alvo) ?? 0) + 1);
        if (g.mata) expect(porAlvo.get(g.alvo)).toBe(w.inimigos[g.alvo].golpesPraMorrer);
      }
      for (const [alvo, hits] of porAlvo) expect(hits).toBe(w.inimigos[alvo].golpesPraMorrer);
    }
  });

  it("variedade por elo: Ferro só minions; Platina tem camps; boss = Barão", () => {
    const tipos = (elo: string, boss = false) => {
      const set = new Set<string>();
      for (let s = 0; s < 20; s++) for (const w of coreografarCorpo(s, s, elo, boss).waves) for (const i of w.inimigos) set.add(i.tipo);
      return set;
    };
    expect([...tipos("Ferro IV")]).toEqual(["minion"]);
    const plat = tipos("Platina I");
    expect(plat.has("minion")).toBe(true);
    expect(plat.size).toBeGreaterThan(1); // camps aparecem
    expect([...tipos("Ferro IV", true)]).toEqual(["barao"]); // última antes do teto
  });

  it("desfecho segue o resultado REAL: último golpe é de quem venceu; derrota é curta", () => {
    const v = coreografarDesfecho(partida(true), 9);
    const d = coreografarDesfecho(partida(false), 9);
    const ultimoGolpe = (x: typeof v) => [...x.beats].reverse().find((b) => b.tipo === "duelo_golpe");
    expect(ultimoGolpe(v)).toMatchObject({ deQuem: "voce" });
    expect(ultimoGolpe(d)).toMatchObject({ deQuem: "inimigo" });
    expect(v.beats.find((b) => b.tipo === "resultado")).toMatchObject({ vitoria: true });
    expect(d.beats.find((b) => b.tipo === "resultado")).toMatchObject({ vitoria: false });
    // vitória tem gold; derrota ($0) não tem beat de gold
    expect(v.beats.some((b) => b.tipo === "gold")).toBe(true);
    expect(d.beats.some((b) => b.tipo === "gold")).toBe(false);
    // ambos terminam num respiro com emote 0-2
    const resp = v.beats.find((b) => b.tipo === "respiro");
    expect(resp && resp.tipo === "respiro" && resp.emote >= 0 && resp.emote <= 2).toBe(true);
    expect(v.duracao).toBeLessThanOrEqual(15); // desfecho é clímax, não novela
  });

  it("pentakill encenado SÓ quando o KDA real foi altíssimo; drop vira beat com raridade Comum", () => {
    const comum = coreografarDesfecho(partida(true), 5);
    expect(comum.beats.find((b) => b.tipo === "resultado")).toMatchObject({ penta: false });
    const monstro = coreografarDesfecho(partida(true, { kda: { k: 12, d: 1, a: 4 } }), 5);
    expect(monstro.beats.find((b) => b.tipo === "resultado")).toMatchObject({ penta: true });
    const comDrop = coreografarDesfecho(partida(true, { drop: { slot: "MOUSE", seedItem: 99 } }), 5);
    expect(comDrop.beats.find((b) => b.tipo === "drop")).toMatchObject({ raridade: 1 });
  });

  it("nenhum beat inventa valor de jogo: gold/drop vêm SÓ da partida do engine", () => {
    const p = partida(true, { dinheiro: 2, drop: { slot: "TECLADO", seedItem: 1 } });
    const des = coreografarDesfecho(p, 11);
    const gold = des.beats.find((b) => b.tipo === "gold");
    expect(gold && gold.tipo === "gold" && gold.valor).toBe(2); // exatamente o $ do engine
    // beats em ordem cronológica
    let t = -1;
    for (const b of des.beats) {
      expect(b.t).toBeGreaterThanOrEqual(t);
      t = b.t;
    }
  });
});
