import type { Rng } from "./rng";
import type { ChampionDef, Classe, Role } from "./types";

// Draft 5v5 (pick & ban). PURO: recebe estado → devolve estado.
// "azul" = seu time; "vermelho" = inimigo.
// Dois clima de draft: SOLOQ (cada um joga do seu jeito — one-tricks, conforto,
// bans "pessoais" → partidas variadas) vs COMPETITIVO (meta-slave: melhores picks/bans).
export type ModoDraft = "soloq" | "competitivo";

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
  rotas: Record<TimeDraft, Partial<Record<Role, string>>>; // FLEX PICKS: rota escolhida manualmente (Yasuo ADC? pode)
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
    rotas: { azul: {}, vermelho: {} },
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

// `rota` (opcional, só em PICK): fixa o campeão naquela rota — flex pick manual.
// Rota já fixada não é sobrescrita (o pick entra e cai na atribuição automática).
export function aplicarEscolha(e: EstadoDraft, championId: string, rota?: Role): EstadoDraft {
  const passo = passoAtual(e);
  if (!passo || !disponivel(e, championId)) return e;
  const bans = { azul: [...e.bans.azul], vermelho: [...e.bans.vermelho] };
  const picks = { azul: [...e.picks.azul], vermelho: [...e.picks.vermelho] };
  const rotasBase = e.rotas ?? { azul: {}, vermelho: {} };
  const rotas = { azul: { ...rotasBase.azul }, vermelho: { ...rotasBase.vermelho } };
  if (passo.fase === "ban") bans[passo.time].push(championId);
  else {
    picks[passo.time].push(championId);
    if (rota && !rotas[passo.time][rota]) rotas[passo.time][rota] = championId;
  }
  return { ...e, bans, picks, rotas, usados: [...e.usados, championId], passo: e.passo + 1 };
}

// Distribui os picks nas 5 rotas: PRIMEIRO as fixadas manualmente (flex picks),
// depois guloso pelas rolesValidas, e o que sobrar preenche buraco.
export function atribuirRotas(
  ids: string[],
  defMap: Record<string, ChampionDef>,
  fixas: Partial<Record<Role, string>> = {},
): { role: Role; id: string | null }[] {
  const slot: Record<Role, string | null> = { TOP: null, JUNGLE: null, MID: null, ADC: null, SUPPORT: null };
  const colocados = new Set<string>();
  for (const r of ROLES) {
    const id = fixas[r];
    if (id && ids.includes(id) && !colocados.has(id)) {
      slot[r] = id;
      colocados.add(id);
    }
  }
  const sobra: string[] = [];
  for (const id of ids) {
    if (colocados.has(id)) continue;
    const r = defMap[id]?.rolesValidas.find((x) => slot[x] === null);
    if (r) {
      slot[r] = id;
      colocados.add(id);
    } else sobra.push(id);
  }
  for (const id of sobra) {
    const r = ROLES.find((x) => slot[x] === null);
    if (r) slot[r] = id;
  }
  return ROLES.map((role) => ({ role, id: slot[role] }));
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
// `modo` muda o clima: soloq sorteia (meta pesa, mas todo mundo aparece);
// competitivo mira os melhores. `rng` default 0 = determinístico (compatível).
// `vies` (Análise de Adversário): classes FAVORITAS do time — quando presente, a IA
// tende a picá-las (~2/3 das vezes que há candidato do viés). É o que torna a
// "tendência" revelada pelo Quadro Tático VERDADEIRA e counterável no draft.
export function escolhaIA(
  e: EstadoDraft,
  banco: ChampionDef[],
  comfort: string[] = [],
  modo: ModoDraft = "competitivo",
  rng: Rng = () => 0,
  vies: Classe[] = [],
): string {
  const passo = passoAtual(e);
  if (!passo) return "";
  const disp = banco.filter((c) => disponivel(e, c.id));
  if (disp.length === 0) return "";

  if (passo.fase === "ban") {
    const porMeta = [...disp].sort((a, b) => b.forcaMetaBase - a.forcaMetaBase);
    if (modo === "soloq") {
      // soloq: geralmente bane algo forte da meta (top 12), mas 25% é ban "pessoal"
      // (aquele campeão que te tiltou na última partida)
      if (rng() < 0.25) return porMeta[Math.floor(rng() * Math.min(30, porMeta.length))].id;
      return porMeta[Math.floor(rng() * Math.min(12, porMeta.length))].id;
    }
    return porMeta[Math.floor(rng() * Math.min(3, porMeta.length))].id; // alvo nos 3 do topo
  }

  const map = lookup(banco);
  const cobertas = rolesCobertas(e.picks[passo.time], map);
  const faltam = ROLES.filter((r) => !cobertas.has(r));
  let cands = disp.filter((c) => c.rolesValidas.some((r) => faltam.includes(r)));
  if (cands.length === 0) cands = disp;

  // viés de tendência: 2/3 das vezes restringe aos candidatos das classes favoritas
  if (vies.length > 0 && rng() < 0.67) {
    const doVies = cands.filter((c) => c.classes.some((cl) => vies.includes(cl)));
    if (doVies.length > 0) cands = doVies;
  }

  if (modo === "soloq") {
    // soloq real: sorteio PONDERADO pela meta — os fortes aparecem mais, mas
    // one-tricks e picks de conforto surgem toda hora (nenhuma partida é igual)
    const minF = Math.min(...cands.map((c) => c.forcaMetaBase));
    const pesos = cands.map((c) => Math.pow(c.forcaMetaBase - minF + 4, 1.6));
    let alvo = rng() * pesos.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cands.length; i++) {
      alvo -= pesos[i];
      if (alvo <= 0) return cands[i].id;
    }
    return cands[cands.length - 1].id;
  }

  const score = (c: ChampionDef) => c.forcaMetaBase + (comfort.includes(c.id) ? 8 : 0);
  const top = [...cands].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  return top[Math.floor(rng() * Math.min(3, top.length))].id; // roda entre os 3 melhores
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

// No passo atual, é VOCÊ que escolhe? AUTONOMIA TOTAL: todos os SEUS bans e picks
// são seus, do começo ao fim (o coach não assume mais nenhum). O inimigo
// (vermelho) segue jogado pela IA.
export function vocePica(e: EstadoDraft): boolean {
  const passo = passoAtual(e);
  return !!passo && passo.time === "azul";
}
