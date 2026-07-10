// ⚡ Skills de Treino (PURO) — compra com Sucata, 3 slots, mods internos do grind.
// ECONOMIA FECHADA: Sucata é o único recurso gasto; respec devolve exato (grátis,
// mesma decisão dos talentos). Efeito SÓ das equipadas — o loadout é a escolha.

import { SKILLS, SKILL_SLOTS, defSkill, type DefSkill } from "@/data/skills";

export type Skills = Record<string, number>; // id → nível comprado
export type SkillSlots = (string | null)[]; // len SKILL_SLOTS; null = slot vazio

export interface ModsSkills {
  poder: number; // + força aliada na Jornada
  escudo: number; // − fração do dano no Desafio (capado)
  cura: number; // + fração de cura por fase no Desafio
  hp: number; // + HP máximo no Desafio
}

export const MODS_SKILLS_NEUTROS: ModsSkills = { poder: 0, escudo: 0, cura: 0, hp: 0 };

export function slotsVazios(): SkillSlots {
  return Array.from({ length: SKILL_SLOTS }, () => null);
}

export function custoSkill(s: DefSkill, nivelAtual: number): number {
  return Math.round(s.custoBase * Math.pow(s.custoMult, nivelAtual));
}

export type MotivoBloqueioSkill = "max" | "sucata" | null;

export function bloqueioSkill(skills: Skills, sucata: number, id: string): MotivoBloqueioSkill {
  const s = defSkill(id);
  if (!s) return "max";
  const nivel = skills[id] ?? 0;
  if (nivel >= s.nivelMax) return "max";
  if (sucata < custoSkill(s, nivel)) return "sucata";
  return null;
}

// Compra PURA de 1 nível: devolve o novo par ou null se bloqueada.
export function comprarSkill(skills: Skills, sucata: number, id: string): { skills: Skills; sucata: number; nivel: number } | null {
  if (bloqueioSkill(skills, sucata, id) !== null) return null;
  const s = defSkill(id)!;
  const nivel = (skills[id] ?? 0) + 1;
  return { skills: { ...skills, [id]: nivel }, sucata: sucata - custoSkill(s, nivel - 1), nivel };
}

// Equipa no slot (precisa nível ≥ 1; sem duplicata — equipar remove de onde estava).
// `id` null = esvazia o slot.
export function equiparSkill(slots: SkillSlots, skills: Skills, idx: number, id: string | null): SkillSlots {
  if (idx < 0 || idx >= SKILL_SLOTS) return slots;
  if (id !== null && ((skills[id] ?? 0) < 1 || !defSkill(id))) return slots;
  const novos = slots.map((s) => (id !== null && s === id ? null : s)); // sem duplicata
  novos[idx] = id;
  return novos;
}

// Mods agregados — SÓ das skills equipadas nos slots. Guardas duras nos caps.
export function modsSkills(skills: Skills | undefined, slots: SkillSlots | undefined): ModsSkills {
  if (!skills || !slots) return MODS_SKILLS_NEUTROS;
  const m: ModsSkills = { ...MODS_SKILLS_NEUTROS };
  for (const id of slots) {
    if (!id) continue;
    const s = defSkill(id);
    const nivel = Math.max(0, Math.min(s?.nivelMax ?? 0, Math.floor(skills[id] ?? 0)));
    if (!s || nivel === 0) continue;
    const e = s.efeito;
    if (e.poder) m.poder += e.poder * nivel;
    if (e.escudo) m.escudo += e.escudo * nivel;
    if (e.cura) m.cura += e.cura * nivel;
    if (e.hp) m.hp += e.hp * nivel;
  }
  m.poder = Math.min(15, m.poder); // teto duro: skills nunca viram um segundo elo
  m.escudo = Math.min(0.35, m.escudo); // o Desafio nunca fica imortal
  return m;
}

export function sucataInvestidaSkills(skills: Skills): number {
  let total = 0;
  for (const s of SKILLS) {
    const nivel = Math.min(s.nivelMax, Math.max(0, Math.floor(skills[s.id] ?? 0)));
    for (let n = 0; n < nivel; n++) total += custoSkill(s, n);
  }
  return total;
}

// Respec GRÁTIS: devolve toda a Sucata investida e esvazia os slots.
export function respecSkills(skills: Skills, sucata: number): { skills: Skills; slots: SkillSlots; sucata: number } {
  return { skills: {}, slots: slotsVazios(), sucata: sucata + sucataInvestidaSkills(skills) };
}

// ---- normalização de save ----
export function normalizarSkills(bruto: unknown): Skills {
  if (!bruto || typeof bruto !== "object") return {};
  const out: Skills = {};
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
    if (n > 0 && defSkill(k)) out[k] = Math.min(defSkill(k)!.nivelMax, n);
  }
  return out;
}

export function normalizarSlots(bruto: unknown, skills: Skills): SkillSlots {
  const base = slotsVazios();
  if (!Array.isArray(bruto)) return base;
  const vistos = new Set<string>();
  for (let i = 0; i < SKILL_SLOTS; i++) {
    const v = bruto[i];
    if (typeof v === "string" && (skills[v] ?? 0) >= 1 && defSkill(v) && !vistos.has(v)) {
      base[i] = v;
      vistos.add(v);
    }
  }
  return base;
}
