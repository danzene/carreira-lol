import type { ChampionDef, Classe, Role } from "./types";

// ⚔️ Counters (PURO). Pedra-papel-tesoura de classes estilo LoL:
// assassino explode a backline, mago/atirador derretem a frontline, tank/suporte
// seguram o burst, lutador duela. Alimenta o matchup POR ROTA (sua lane) e o
// counter de COMP (soma das rotas) — os dois entram no motor de partida.

export const COUNTERS: Record<Classe, Classe[]> = {
  ASSASSINO: ["MAGO", "ATIRADOR"], // explode a backline
  MAGO: ["TANK", "LUTADOR"], // poke/dano mágico derrete a frontline
  ATIRADOR: ["TANK", "LUTADOR"], // DPS contínuo derrete a frontline
  TANK: ["ASSASSINO", "LUTADOR"], // aguenta o burst e a briga prolongada
  LUTADOR: ["ASSASSINO", "SUPORTE"], // duela e sobrevive ao all-in
  SUPORTE: ["ASSASSINO", "MAGO"], // peel/escudos anulam o burst
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Vantagem de matchup entre dois campeões (-2..+2): +1 pra cada relação de counter
// a seu favor, -1 pra cada contra (campeão pode ter 2 classes).
export function matchup(meu: ChampionDef | undefined, dele: ChampionDef | undefined): number {
  if (!meu || !dele) return 0;
  let v = 0;
  for (const cm of meu.classes) for (const cd of dele.classes) if (COUNTERS[cm]?.includes(cd)) v++;
  for (const cd of dele.classes) for (const cm of meu.classes) if (COUNTERS[cd]?.includes(cm)) v--;
  return clamp(v, -2, 2);
}

export interface PickRota {
  championId: string;
  rota: Role;
}

export interface MatchupRota {
  rota: Role;
  delta: number; // -2..+2 (positivo = vantagem do azul)
}

// Matchup rota a rota (TOP vs TOP, JG vs JG...). Positivo favorece o time azul.
export function counterLanes(azul: PickRota[], vermelho: PickRota[], banco: ChampionDef[]): MatchupRota[] {
  const map = new Map(banco.map((c) => [c.id, c]));
  const porRota = (lista: PickRota[]) => new Map(lista.map((p) => [p.rota, map.get(p.championId)]));
  const a = porRota(azul);
  const v = porRota(vermelho);
  const rotas: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  return rotas.map((rota) => ({ rota, delta: matchup(a.get(rota), v.get(rota)) }));
}

// Counter total da comp (soma das rotas, -10..+10). Positivo favorece o azul.
export function counterComp(lanes: MatchupRota[]): number {
  return clamp(
    lanes.reduce((s, l) => s + l.delta, 0),
    -10,
    10,
  );
}
