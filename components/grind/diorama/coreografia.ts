import { idxElo } from "@/engine/elo";
import { criarRng, entre, type Rng } from "@/engine/rng";
import type { PartidaGrind } from "@/engine/grind";

// 🎬 Coreografia do Diorama (PURA, determinística) — traduz uma partida do grind em
// "beats" com timestamps que a cena encena. NUNCA decide nada de jogo: o resultado,
// KDA, $ e drop JÁ vieram prontos do engine (resolverGrind); aqui só se decide QUANDO
// e COMO cada coisa aparece na tela. Mesma partida+seed ⇒ mesma timeline (testado).
//
// Escolha de duração (documentada no CHANGELOG-diorama): a partida real do grind dura
// 8-10 min de acumulação; a encenação representa isso como um CORPO de ~45-60s de
// ação (waves de inimigos) que fica em LOOP até a partida fechar no engine — aí toca
// o DESFECHO (~8-12s: clímax contra o campeão adversário + resultado real + ganhos)
// e um respiro de ~4s antes da próxima.

export type TipoInimigo = "minion" | "lobo" | "golem" | "dragao" | "barao";

export interface InimigoWave {
  tipo: TipoInimigo;
  golpesPraMorrer: number; // quantos hits do jogador ele aguenta
}

export interface GolpeBeat {
  t: number; // relativo ao início da wave
  alvo: number; // índice do inimigo na wave
  dano: number; // número cosmético que voa na tela
  crit: boolean;
  mata: boolean;
}

export interface WaveCoreografia {
  t: number; // início da wave no clock do corpo
  inimigos: InimigoWave[];
  golpes: GolpeBeat[];
  contraGolpes: { t: number; dano: number }[]; // o jogador também apanha (variedade)
}

export type MicroEvento = "gank" | "petalas" | "vagalumes";

export interface CorpoCoreografia {
  waves: WaveCoreografia[];
  duracao: number; // 1 volta do loop (a cena repete até a partida fechar no engine)
  cenario: 0 | 1 | 2; // 0 = lane dia · 1 = lane noite · 2 = margem do rio
  microEvento?: { t: number; tipo: MicroEvento }; // raro, puramente cosmético
}

export type BeatDesfecho =
  | { t: number; tipo: "campeao_entra"; nome: string }
  | { t: number; tipo: "duelo_golpe"; deQuem: "voce" | "inimigo"; dano: number; crit: boolean }
  | { t: number; tipo: "resultado"; vitoria: boolean; penta: boolean }
  | { t: number; tipo: "gold"; valor: number }
  | { t: number; tipo: "drop"; raridade: number }
  | { t: number; tipo: "respiro"; emote: number; dur: number };

export interface DesfechoCoreografia {
  beats: BeatDesfecho[];
  duracao: number;
}

// Seed da coreografia derivada da partida (mistura própria — não colide com a do engine).
export function seedCoreografia(seedDia: number, idxPartida: number): number {
  return ((seedDia ^ 0xd10a) + (idxPartida + 1) * 0x85ebca6b) >>> 0;
}

// Inimigos disponíveis sobem com o elo (Ferro = minions; Ouro+ = camps; Platina+ = dragão).
function poolInimigos(elo: string, boss: boolean): TipoInimigo[] {
  const i = idxElo(elo);
  if (boss) return ["barao"]; // última partida antes do teto: Barão diorama
  const pool: TipoInimigo[] = ["minion"];
  if (i >= 12) pool.push("lobo"); // Ouro+
  if (i >= 14) pool.push("golem"); // Ouro II+
  if (i >= 16) pool.push("dragao"); // Platina+ (ocasional)
  return pool;
}

function golpesDe(tipo: TipoInimigo): number {
  return tipo === "minion" ? 2 : tipo === "lobo" ? 3 : tipo === "golem" ? 4 : tipo === "dragao" ? 6 : 8;
}

function dano(r: Rng, crit: boolean): number {
  const base = Math.round(entre(r, 18, 74));
  return crit ? base * 2 : base;
}

// ---- corpo: waves em loop enquanto a partida real acumula ----
// `boss` = true na última partida antes do teto (a cena ganha um Barão).
export function coreografarCorpo(seedDia: number, idxPartida: number, elo: string, boss = false): CorpoCoreografia {
  const r = criarRng(seedCoreografia(seedDia, idxPartida));
  const cenario = (Math.floor(r() * 3) % 3) as 0 | 1 | 2;
  const pool = poolInimigos(elo, boss);
  const nWaves = boss ? 2 : 3 + Math.floor(r() * 2); // 3-4 waves (boss: 2, mais curtas e pesadas)

  const waves: WaveCoreografia[] = [];
  let t = 2.2 + r() * 1.2; // respiro inicial: o jogador corre pela lane

  for (let w = 0; w < nWaves; w++) {
    // composição da wave: minions na frente, às vezes 1 camp maior no fim
    const qtd = boss ? 1 : 3 + Math.floor(r() * 3); // 3-5 (boss: só ele)
    const inimigos: InimigoWave[] = [];
    for (let i = 0; i < qtd; i++) {
      const grandeNoFim = i === qtd - 1 && pool.length > 1 && r() < 0.45;
      const tipo = boss ? "barao" : grandeNoFim ? pool[1 + Math.floor(r() * (pool.length - 1))] : "minion";
      inimigos.push({ tipo, golpesPraMorrer: golpesDe(tipo) });
    }

    // golpes: cadência ~0.55-0.8s por hit, com crits (~18%) e o hit final matando
    const golpes: GolpeBeat[] = [];
    let tg = 1.1; // o inimigo chega e a troca começa
    for (let alvo = 0; alvo < inimigos.length; alvo++) {
      for (let h = 0; h < inimigos[alvo].golpesPraMorrer; h++) {
        const crit = r() < 0.18;
        golpes.push({ t: tg, alvo, dano: dano(r, crit), crit, mata: h === inimigos[alvo].golpesPraMorrer - 1 });
        tg += entre(r, 0.55, 0.8);
      }
      tg += entre(r, 0.3, 0.6); // pausa entre alvos
    }

    // contra-golpes: 1-2 hits que o jogador TOMA no meio da wave (variedade, não drama)
    const contraGolpes: { t: number; dano: number }[] = [];
    const nContra = 1 + (r() < 0.4 ? 1 : 0);
    for (let c = 0; c < nContra; c++) contraGolpes.push({ t: entre(r, 1.6, Math.max(2.2, tg - 1)), dano: Math.round(entre(r, 9, 31)) });

    waves.push({ t, inimigos, golpes, contraGolpes });
    t += tg + entre(r, 2.4, 3.6); // corre pro próximo ponto da lane (parallax anda)
  }

  // micro-evento raro (~1 em 6 partidas): puramente cosmético
  let microEvento: CorpoCoreografia["microEvento"];
  const sorte = r();
  if (sorte < 0.06) microEvento = { t: entre(r, 6, t - 6), tipo: "gank" };
  else if (sorte < 0.12) microEvento = { t: 1, tipo: cenario === 1 ? "vagalumes" : "petalas" };

  return { waves, duracao: Math.max(30, t), cenario, microEvento };
}

// ---- desfecho: clímax contra o campeão adversário + resultado REAL do engine ----
export function coreografarDesfecho(partida: PartidaGrind, seedDia: number): DesfechoCoreografia {
  const r = criarRng((seedCoreografia(seedDia, partida.idx) ^ 0xf17a1) >>> 0);
  const beats: BeatDesfecho[] = [];
  let t = 0;

  beats.push({ t, tipo: "campeao_entra", nome: partida.adversario });
  t += 1.4;

  // duelo: 4-6 trocas; quem dá o último golpe segue o resultado REAL
  const trocas = 4 + Math.floor(r() * 3);
  for (let i = 0; i < trocas; i++) {
    const ultimo = i === trocas - 1;
    const deQuem: "voce" | "inimigo" = ultimo ? (partida.vitoria ? "voce" : "inimigo") : r() < 0.5 ? "voce" : "inimigo";
    const crit = ultimo || r() < 0.2;
    beats.push({ t, tipo: "duelo_golpe", deQuem, dano: dano(r, crit), crit });
    t += entre(r, 0.5, 0.75);
  }

  // pentakill encenado quando o KDA real foi MUITO alto (cosmético; o número é do engine)
  const penta = partida.vitoria && partida.kda.k >= 10 && partida.kda.d <= 2;
  beats.push({ t, tipo: "resultado", vitoria: partida.vitoria, penta });
  t += partida.vitoria ? 1.6 : 1.1; // derrota é RÁPIDA e não humilhante

  if (partida.dinheiro > 0) {
    beats.push({ t, tipo: "gold", valor: partida.dinheiro });
    t += 0.9;
  }
  if (partida.drop) {
    beats.push({ t, tipo: "drop", raridade: 1 }); // grind só dropa Comum (cap do engine)
    t += 1.2;
  }

  // respiro: senta na base com um emote idle (3 variações) e "aguardando fila…"
  const dur = entre(r, 3.2, 4.6);
  beats.push({ t, tipo: "respiro", emote: Math.floor(r() * 3), dur });
  t += dur;

  return { beats, duracao: t };
}
