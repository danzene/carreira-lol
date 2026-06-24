import type { Tier } from "@/engine/types";
import type { Time } from "./times";

// 🌍 Regiões e suas ligas profissionais reais (Tier 1). A nacionalidade do jogador
// define a região; ao subir AMADOR → ACADEMY → liga PRO da sua região.

export interface Regiao {
  id: string;
  pais: string;
  liga: string; // CBLOL, LCK, LEC, LCS, LPL
  forca: number; // bônus de força internacional (importa no MSI/Worlds — Parte 2)
}

export const REGIOES: Regiao[] = [
  { id: "br", pais: "Brasil", liga: "CBLOL", forca: 3 },
  { id: "na", pais: "América do Norte", liga: "LCS", forca: 4 },
  { id: "eu", pais: "Europa", liga: "LEC", forca: 6 },
  { id: "cn", pais: "China", liga: "LPL", forca: 9 },
  { id: "kr", pais: "Coreia", liga: "LCK", forca: 10 },
];

// nacionalidade (data/config) -> região
const MAPA: Record<string, string> = {
  Brasil: "br",
  "Coreia do Sul": "kr",
  China: "cn",
  Vietnã: "cn",
  "Estados Unidos": "na",
  Dinamarca: "eu",
  Alemanha: "eu",
  França: "eu",
  Espanha: "eu",
  Suécia: "eu",
  Polônia: "eu",
  Turquia: "eu",
};

export function regiaoDoPais(nac: string | undefined): Regiao {
  return REGIOES.find((r) => r.id === (nac ? MAPA[nac] : undefined)) ?? REGIOES[0];
}

export function regiaoDe(id: string | undefined): Regiao | undefined {
  return id ? REGIOES.find((r) => r.id === id) : undefined;
}

const T1 = (id: string, nome: string, regiao: string, prestigio: number, instalacoes: number): Time => ({
  id,
  nome,
  tier: "TIER1" as Tier,
  prestigio,
  instalacoes,
  regiao,
});

// Times reais das ligas profissionais.
export const TIMES_REGIONAIS: Time[] = [
  // CBLOL (Brasil)
  T1("loud", "LOUD", "br", 86, 84),
  T1("pain", "paiN Gaming", "br", 80, 78),
  T1("red", "RED Canids", "br", 74, 72),
  T1("furia", "FURIA", "br", 70, 70),
  T1("intz", "INTZ", "br", 66, 64),
  T1("keyd", "Vivo Keyd", "br", 64, 62),
  // LCK (Coreia)
  T1("t1", "T1", "kr", 86, 90),
  T1("geng", "Gen.G", "kr", 84, 88),
  T1("dk", "Dplus KIA", "kr", 80, 84),
  T1("kt", "KT Rolster", "kr", 76, 80),
  T1("hle", "Hanwha Life", "kr", 72, 76),
  T1("drx", "DRX", "kr", 68, 72),
  // LEC (Europa)
  T1("g2", "G2 Esports", "eu", 84, 82),
  T1("fnc", "Fnatic", "eu", 80, 78),
  T1("mad", "MAD Lions", "eu", 74, 72),
  T1("rge", "Rogue", "eu", 70, 70),
  T1("vit", "Team Vitality", "eu", 68, 68),
  T1("bds", "Team BDS", "eu", 64, 64),
  // LCS (América do Norte)
  T1("c9", "Cloud9", "na", 82, 82),
  T1("tl", "Team Liquid", "na", 80, 80),
  T1("100t", "100 Thieves", "na", 74, 74),
  T1("eg", "Evil Geniuses", "na", 70, 70),
  T1("fly", "FlyQuest", "na", 66, 66),
  T1("tsm", "TSM", "na", 64, 64),
  // LPL (China)
  T1("jdg", "JD Gaming", "cn", 86, 88),
  T1("blg", "Bilibili Gaming", "cn", 84, 86),
  T1("tes", "Top Esports", "cn", 80, 82),
  T1("lng", "LNG Esports", "cn", 76, 78),
  T1("wbg", "Weibo Gaming", "cn", 72, 74),
  T1("edg", "EDward Gaming", "cn", 68, 70),
];

export function timesDaRegiao(regiaoId: string): Time[] {
  return TIMES_REGIONAIS.filter((t) => t.regiao === regiaoId);
}
