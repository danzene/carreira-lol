import { CLASSE_PERFIL, TAG_CLASSE } from "@/data/champions";
import { hashString } from "./rng";
import type { ChampionDef, Classe, PerfilCampeao, Role } from "./types";

// Constrói o banco de `ChampionDef` a partir dos dados do Data Dragon. PURO.
// `forcaMetaBase` é sintética e determinística (o Auto Patch ajusta depois).

export interface CampeaoEntrada {
  id: string;
  nome: string;
  tags: string[];
  info: { attack: number; defense: number; magic: number; difficulty: number };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function classesDe(tags: string[]): Classe[] {
  const cs = tags.map((t) => TAG_CLASSE[t]).filter((c): c is Classe => Boolean(c));
  return cs.length > 0 ? cs : ["LUTADOR"];
}

function rolesDe(classes: Classe[]): Role[] {
  const roles = new Set<Role>();
  for (const c of classes) {
    if (c === "ATIRADOR") roles.add("ADC");
    else if (c === "SUPORTE") roles.add("SUPPORT");
    else if (c === "MAGO") roles.add("MID");
    else if (c === "ASSASSINO") {
      roles.add("MID");
      roles.add("JUNGLE");
    } else if (c === "LUTADOR") {
      roles.add("TOP");
      roles.add("JUNGLE");
    } else if (c === "TANK") {
      roles.add("TOP");
      roles.add("SUPPORT");
    }
  }
  if (roles.size === 0) roles.add("MID");
  return [...roles];
}

function perfilDe(classes: Classe[], info: CampeaoEntrada["info"]): PerfilCampeao {
  return {
    dano: clamp(Math.max(info.attack, info.magic) * 10, 0, 100),
    resistencia: clamp(info.defense * 10, 0, 100),
    cc: Math.max(...classes.map((c) => CLASSE_PERFIL[c].cc)),
    mobilidade: Math.max(...classes.map((c) => CLASSE_PERFIL[c].mobilidade)),
    sustain: Math.max(...classes.map((c) => CLASSE_PERFIL[c].sustain)),
  };
}

export function mapearCampeao(e: CampeaoEntrada): ChampionDef {
  const classes = classesDe(e.tags);
  const r = (hashString(e.id) % 1000) / 1000;
  return {
    id: e.id,
    nome: e.nome,
    classes,
    rolesValidas: rolesDe(classes),
    perfil: perfilDe(classes, e.info),
    forcaMetaBase: Math.round(45 + r * 18), // 45–63 sintético, determinístico
  };
}

export function construirBanco(campeoes: CampeaoEntrada[]): ChampionDef[] {
  return campeoes.map(mapearCampeao).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
