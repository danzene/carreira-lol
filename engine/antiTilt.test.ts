import { describe, expect, it } from "vitest";
import { ECONOMIA } from "@/data/economia";
import { sessaoMental } from "./economia";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { pityDerrota, simularPartida, type ContextoPartida } from "./simularPartida";
import type { CareerState, Player } from "./types";

function playerCom(streak: number): Player {
  return {
    ...criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
    rankSoloq: { elo: "Prata IV", lp: 0, mmr: 1600, streak },
  };
}

const ctx: ContextoPartida = { championId: "A", forcaMetaCampeao: 50, comp: 50, compInimigo: 50, dificuldadeElo: -6.4 };

// Simula uma corrida de N partidas encadeadas (streak evolui) e conta quantas vezes
// o jogador entrou numa sequência de 5+ derrotas. `comPity=false` congela o streak
// visto pelo motor em 0 (desliga a compensação) — é o cenário "antes".
function corridas(nCorridas: number, nPartidas: number, comPity: boolean): number {
  let sequenciasLongas = 0;
  for (let c = 0; c < nCorridas; c++) {
    let streak = 0;
    let derrotasSeguidas = 0;
    let contou = false;
    for (let p = 0; p < nPartidas; p++) {
      const jogador = playerCom(comPity ? streak : Math.max(0, streak));
      const r = simularPartida(jogador, ctx, (c * 1000 + p) >>> 0);
      if (r.vitoria) {
        streak = streak >= 0 ? streak + 1 : 1;
        derrotasSeguidas = 0;
        contou = false;
      } else {
        streak = streak <= 0 ? streak - 1 : -1;
        derrotasSeguidas++;
        if (derrotasSeguidas >= 5 && !contou) {
          sequenciasLongas++;
          contou = true; // conta 1x por sequência
        }
      }
    }
  }
  return sequenciasLongas;
}

describe("anti-tilt", () => {
  it("pityDerrota: cresce por derrota seguida, tem TETO e zera quando não há derrotas", () => {
    expect(pityDerrota(0)).toBe(0);
    expect(pityDerrota(3)).toBe(0); // vencendo: sem pity
    expect(pityDerrota(-1)).toBeCloseTo(1.2, 5);
    expect(pityDerrota(-3)).toBeCloseTo(3.6, 5);
    expect(pityDerrota(-10)).toBe(6); // teto
    expect(pityDerrota(undefined)).toBe(0);
  });

  it("compensação sente: com 5 derrotas seguidas o win rate sobe (mesmo jogador/ctx)", () => {
    let frio = 0;
    let neutro = 0;
    for (let s = 0; s < 300; s++) {
      if (simularPartida(playerCom(-5), ctx, s).vitoria) frio++;
      if (simularPartida(playerCom(0), ctx, s).vitoria) neutro++;
    }
    expect(frio).toBeGreaterThan(neutro);
  });

  it("AUDITORIA: pity reduz mensuravelmente as sequências de 5+ derrotas", () => {
    const sem = corridas(150, 25, false);
    const com = corridas(150, 25, true);
    // números registrados no CHANGELOG-mundo-vivo.md
    console.log(`[auditoria anti-tilt] 150 corridas × 25 partidas (Prata IV): sequências 5+ derrotas SEM pity=${sem}, COM pity=${com} (redução ${Math.round((1 - com / sem) * 100)}%)`);
    expect(com).toBeLessThan(sem);
    expect(sem).toBeGreaterThan(0); // a espiral estatística EXISTE sem o pity
  });

  it("sessão mental com moral BAIXA: metade do custo e mais moral", () => {
    const base = criarCareerState(playerCom(0));
    const abalado: CareerState = { ...base, dinheiro: 100, player: { ...base.player, moral: 30 } };
    const r = sessaoMental(abalado); // 100 ≥ 75 (metade de 150)
    expect(r).not.toBeNull();
    expect(r!.dinheiro).toBe(100 - Math.round(ECONOMIA.sessaoMental.custo / 2));
    expect(r!.player.moral).toBe(30 + ECONOMIA.sessaoMental.moral + 15);
    // moral ok: preço cheio
    const tranquilo: CareerState = { ...base, dinheiro: 1000, player: { ...base.player, moral: 80 } };
    expect(sessaoMental(tranquilo)!.dinheiro).toBe(1000 - ECONOMIA.sessaoMental.custo);
  });
});
