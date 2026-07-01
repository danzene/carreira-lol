import { PESOS_ROTA } from "@/data/simulacao";
import { criarRng, entre, hashString, type Rng } from "./rng";
import type { Attributes, AtributoKey, ChampionMastery, Player, Role, TraitId } from "./types";

// Motor de DUELO 1v1 assíncrono (modo online, Fase B). PURO e DETERMINÍSTICO:
// (snapshotA, snapshotB, seed) -> resultado. Mesma entrada => mesmo resultado no
// cliente ou numa Edge Function. O vencedor NÃO depende da ordem dos argumentos
// (cada lado rola com uma sub-seed estável derivada da sua `chave`), então o
// oponente pode revalidar o duelo que recebeu.

// Snapshot de combate do jogador — subconjunto do Player que importa pro duelo.
// Não mexe no save da carreira; é publicado no servidor pra outros enfrentarem.
export interface PlayerSnapshot {
  chave: string; // id estável (user_id no servidor) — só p/ semear e apontar o vencedor
  nome: string;
  rota: Role;
  atributos: Attributes;
  tracos: TraitId[];
  pool: ChampionMastery[];
  championId: string; // campeão principal que ele traz pro duelo
  elo: string;
  mmr: number;
}

export interface LadoDuelo {
  chave: string;
  nome: string;
  rota: Role;
  championId: string;
  elo: string;
  forca: number; // força final (com ruído) 0–100
  nota: number; // 0–10
  abates: number;
  venceu: boolean;
}

export interface DueloResult {
  seed: number;
  vencedorChave: string;
  a: LadoDuelo;
  b: LadoDuelo;
  log: string[];
}

const DUELO = { pesoRota: 0.6, pesoMaestria: 0.3, pesoElo: 0.1, ruidoMax: 16, ruidoMin: 5 } as const;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function forcaRotaDuelo(atributos: Attributes, rota: Role): number {
  let total = 0;
  for (const [chave, peso] of Object.entries(PESOS_ROTA[rota])) {
    total += atributos[chave as AtributoKey] * (peso ?? 0);
  }
  return total; // pesos somam 1 => 0–100
}

function maestria(pool: ChampionMastery[], championId: string): number {
  return pool.find((p) => p.championId === championId)?.pontos ?? 0;
}

function contribuicaoElo(mmr: number): number {
  return clamp(50 + ((mmr - 800) / 100) * 2, 0, 100); // Ferro ~50, Desafiante ~94
}

// Bônus de força e multiplicador de variância dos traços (mesma linguagem do motor de partida).
function modTracos(tracos: TraitId[]): { forca: number; ruidoMult: number } {
  let forca = 0;
  let ruidoMult = 1;
  for (const t of tracos) {
    if (t === "LANE_BULLY" || t === "SHOTCALLER") forca += 2;
    else if (t === "ROAMER" || t === "FLEX" || t === "CARRY_TARDIO" || t === "CLUTCH") forca += 1;
    else if (t === "FRIO") ruidoMult *= 0.8;
    else if (t === "AGRESSIVO") {
      ruidoMult *= 1.25;
      forca += 1;
    } else if (t === "TILTAVEL") {
      ruidoMult *= 1.3;
      forca -= 1;
    }
  }
  return { forca, ruidoMult };
}

interface Base {
  base: number;
  tracoForca: number;
  ruidoMult: number;
  estab: number;
}

function baseDe(snap: PlayerSnapshot): Base {
  const fRota = forcaRotaDuelo(snap.atributos, snap.rota);
  const fMaestria = maestria(snap.pool, snap.championId);
  const fElo = contribuicaoElo(snap.mmr);
  const base = DUELO.pesoRota * fRota + DUELO.pesoMaestria * fMaestria + DUELO.pesoElo * fElo;
  const { forca: tracoForca, ruidoMult } = modTracos(snap.tracos);
  const estab = (snap.atributos.consistencia + snap.atributos.mental) / 2;
  return { base, tracoForca, ruidoMult, estab };
}

// Poder DETERMINÍSTICO (sem ruído) — pra matchmaking, leaderboard e exibição.
export function poderDeSnapshot(snap: PlayerSnapshot): number {
  const { base, tracoForca } = baseDe(snap);
  return Math.round(clamp(base + tracoForca, 0, 100));
}

function forcaComRuido(snap: PlayerSnapshot, rng: Rng): number {
  const { base, tracoForca, ruidoMult, estab } = baseDe(snap);
  const amp = (DUELO.ruidoMax - (DUELO.ruidoMax - DUELO.ruidoMin) * (estab / 100)) * ruidoMult;
  return clamp(base + tracoForca + entre(rng, -amp, amp), 0, 100);
}

function subSeed(seed: number, chave: string): number {
  return hashString(`${seed}:${chave}`);
}

// Constrói o resultado de um duelo determinístico entre dois snapshots.
export function simularDuelo(a: PlayerSnapshot, b: PlayerSnapshot, seed: number): DueloResult {
  const ra = criarRng(subSeed(seed, a.chave));
  const rb = criarRng(subSeed(seed, b.chave));
  const fa = forcaComRuido(a, ra);
  const fb = forcaComRuido(b, rb);

  // vencedor independe da ordem dos argumentos (desempate estável)
  let aVence: boolean;
  if (fa !== fb) aVence = fa > fb;
  else if (a.mmr !== b.mmr) aVence = a.mmr > b.mmr;
  else aVence = a.chave <= b.chave;

  const ladoA = montarLado(a, fa, ra, aVence, fa - fb);
  const ladoB = montarLado(b, fb, rb, !aVence, fb - fa);
  const log = narrarDuelo(ladoA, ladoB);

  return { seed, vencedorChave: aVence ? a.chave : b.chave, a: ladoA, b: ladoB, log };
}

function montarLado(snap: PlayerSnapshot, forca: number, rng: Rng, venceu: boolean, delta: number): LadoDuelo {
  const nota = clamp(5 + (forca - 50) * 0.1 + (venceu ? 0.4 : -0.2), 0, 10);
  const abates = Math.max(0, Math.round((venceu ? 6 : 3) + delta * 0.12 + entre(rng, -1, 2)));
  return {
    chave: snap.chave,
    nome: snap.nome,
    rota: snap.rota,
    championId: snap.championId,
    elo: snap.elo,
    forca: Math.round(forca * 10) / 10,
    nota: Math.round(nota * 10) / 10,
    abates,
    venceu,
  };
}

function narrarDuelo(a: LadoDuelo, b: LadoDuelo): string[] {
  const vencedor = a.venceu ? a : b;
  const perdedor = a.venceu ? b : a;
  return [
    `${a.nome} (${a.rota} · ${a.elo}) enfrenta ${b.nome} (${b.rota} · ${b.elo}).`,
    a.forca >= b.forca
      ? `Abertura: ${a.nome} controla o ritmo da partida.`
      : `Abertura: ${b.nome} sai na frente e pressiona.`,
    `Meio de jogo: as trocas apertam — ${vencedor.nome} encontra as melhores janelas.`,
    `Placar de abates: ${a.nome} ${a.abates} × ${b.abates} ${b.nome}.`,
    `${vencedor.nome} fecha o Nexus e vence o duelo! 🏆 (${perdedor.nome} cai lutando)`,
  ];
}

// Extrai o snapshot de combate a partir do Player da carreira (traz o campeão de maior maestria).
export function snapshotDePlayer(player: Player, chave: string): PlayerSnapshot {
  const principal = [...player.pool].sort((x, y) => y.pontos - x.pontos)[0];
  return {
    chave,
    nome: player.nome,
    rota: player.rota,
    atributos: player.atributos,
    tracos: player.tracos,
    pool: player.pool,
    championId: principal?.championId ?? "",
    elo: player.rankSoloq.elo,
    mmr: player.rankSoloq.mmr,
  };
}
