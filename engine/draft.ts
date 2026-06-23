import type { ChampionDef, Role } from "./types";

// Draft 5v5 (pick & ban). PURO: recebe estado → devolve estado.
// "azul" = seu time; "vermelho" = inimigo.

export type TimeDraft = "azul" | "vermelho";
export type FaseDraft = "ban" | "pick";
export interface PassoDraft {
  fase: FaseDraft;
  time: TimeDraft;
}

export interface EstadoDraft {
  ordem: PassoDraft[];
  passo: number; // índice do passo atual
  bans: Record<TimeDraft, string[]>;
  picks: Record<TimeDraft, string[]>;
  usados: string[]; // ids indisponíveis (banidos ou escolhidos)
}

const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Ordem oficial de torneio: 6 bans, 6 picks, 4 bans, 4 picks.
export function ordemDraft(): PassoDraft[] {
  const p: PassoDraft[] = [];
  const add = (fase: FaseDraft, times: TimeDraft[]) => times.forEach((time) => p.push({ fase, time }));
  add("ban", ["azul", "vermelho", "azul", "vermelho", "azul", "vermelho"]);
  add("pick", ["azul", "vermelho", "vermelho", "azul", "azul", "vermelho"]);
  add("ban", ["vermelho", "azul", "vermelho", "azul"]);
  add("pick", ["vermelho", "azul", "azul", "vermelho"]);
  return p;
}

export function iniciarDraft(): EstadoDraft {
  return {
    ordem: ordemDraft(),
    passo: 0,
    bans: { azul: [], vermelho: [] },
    picks: { azul: [], vermelho: [] },
    usados: [],
  };
}

export function draftCompleto(e: EstadoDraft): boolean {
  return e.passo >= e.ordem.length;
}

export function passoAtual(e: EstadoDraft): PassoDraft | null {
  return draftCompleto(e) ? null : e.ordem[e.passo];
}

export function disponivel(e: EstadoDraft, championId: string): boolean {
  return !e.usados.includes(championId);
}

export function aplicarEscolha(e: EstadoDraft, championId: string): EstadoDraft {
  const passo = passoAtual(e);
  if (!passo || !disponivel(e, championId)) return e;
  const bans = { azul: [...e.bans.azul], vermelho: [...e.bans.vermelho] };
  const picks = { azul: [...e.picks.azul], vermelho: [...e.picks.vermelho] };
  if (passo.fase === "ban") bans[passo.time].push(championId);
  else picks[passo.time].push(championId);
  return { ...e, bans, picks, usados: [...e.usados, championId], passo: e.passo + 1 };
}

function lookup(banco: ChampionDef[]): Map<string, ChampionDef> {
  const m = new Map<string, ChampionDef>();
  for (const c of banco) m.set(c.id, c);
  return m;
}

// Roles já cobertas por uma lista de picks (atribuição gulosa).
function rolesCobertas(ids: string[], map: Map<string, ChampionDef>): Set<Role> {
  const cobertas = new Set<Role>();
  for (const id of ids) {
    const def = map.get(id);
    if (!def) continue;
    const r = def.rolesValidas.find((x) => !cobertas.has(x));
    if (r) cobertas.add(r);
  }
  return cobertas;
}

// Escolha da IA (inimigo, ou coach do seu time). `comfort` só pesa pro coach.
export function escolhaIA(e: EstadoDraft, banco: ChampionDef[], comfort: string[] = []): string {
  const passo = passoAtual(e);
  if (!passo) return "";
  const disp = banco.filter((c) => disponivel(e, c.id));
  if (disp.length === 0) return "";

  if (passo.fase === "ban") {
    return [...disp].sort((a, b) => b.forcaMetaBase - a.forcaMetaBase)[0].id;
  }

  const map = lookup(banco);
  const cobertas = rolesCobertas(e.picks[passo.time], map);
  const faltam = ROLES.filter((r) => !cobertas.has(r));
  let cands = disp.filter((c) => c.rolesValidas.some((r) => faltam.includes(r)));
  if (cands.length === 0) cands = disp;

  const score = (c: ChampionDef) => c.forcaMetaBase + (comfort.includes(c.id) ? 8 : 0);
  return [...cands].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0].id;
}

interface StatsTime {
  metaMedia: number;
  dano: number;
  resistencia: number;
  cc: number;
  mobilidade: number;
  frontline: boolean;
  classes: number;
}

function statsTime(ids: string[], map: Map<string, ChampionDef>): StatsTime {
  const defs = ids.map((id) => map.get(id)).filter((d): d is ChampionDef => Boolean(d));
  const n = Math.max(1, defs.length);
  return {
    metaMedia: defs.reduce((s, d) => s + d.forcaMetaBase, 0) / n,
    dano: defs.reduce((s, d) => s + d.perfil.dano, 0),
    resistencia: defs.reduce((s, d) => s + d.perfil.resistencia, 0),
    cc: defs.reduce((s, d) => s + d.perfil.cc, 0),
    mobilidade: defs.reduce((s, d) => s + d.perfil.mobilidade, 0),
    frontline: defs.some((d) => d.classes.includes("TANK") || d.classes.includes("LUTADOR")),
    classes: new Set(defs.flatMap((d) => d.classes)).size,
  };
}

// Força de comp (0-100) por time: sinergia + counters. A diferença alimenta a Fase 4.
export function forcaComp(e: EstadoDraft, banco: ChampionDef[]): Record<TimeDraft, number> {
  const map = lookup(banco);
  const a = statsTime(e.picks.azul, map);
  const v = statsTime(e.picks.vermelho, map);

  const forca = (self: StatsTime, foe: StatsTime): number => {
    let f = self.metaMedia;
    f += self.frontline ? 4 : -4; // comp precisa de frente
    f += clamp((self.classes - 3) * 2, -4, 6); // diversidade
    f += clamp((self.dano - foe.resistencia) / 25, -5, 5); // dano vs resistência inimiga
    f += clamp((self.cc - foe.mobilidade) / 25, -4, 4); // cc vs mobilidade inimiga
    return clamp(Math.round(f), 0, 100);
  };

  return { azul: forca(a, v), vermelho: forca(v, a) };
}

// Quantos dos SEUS picks o coach assume (cai com a reputação).
export function passosCoach(reputacao: number): number {
  return reputacao < 20 ? 2 : reputacao < 50 ? 1 : 0;
}

// No passo atual, é VOCÊ que escolhe (vs coach/inimigo)?
export function vocePica(e: EstadoDraft, reputacao: number): boolean {
  const passo = passoAtual(e);
  if (!passo || passo.time !== "azul") return false;
  if (passo.fase === "ban") return true; // bans são seus
  return e.picks.azul.length < 5 - passosCoach(reputacao);
}
