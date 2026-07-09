// 🎯 Grind com Propósito — Sucata, Árvore de Talentos e Baús. Balanceamento (dados puros).
//
// REGRA 1 (economia FECHADA): Sucata só é ganha no grind e só é gasta na árvore de
// talentos. Nunca vira $/CoinPoints; nada externo compra Sucata. Testado.
// REGRA 2 (lista proibida): talentos e baús NUNCA dão PDL/CoinPoints/passe/energia/
// cargas/Raro+/Lendas/pity-do-gacha. Varrido por teste.
// REGRA 3: baú Lendário dá DESEJO (cosmético do diorama) + jackpot de Sucata — zero
// efeito em número de gameplay.
// REGRA 4 (teto): os talentos multiplicam o rendimento DENTRO do teto de 3h. Só dois
// alavancam a economia ($/maestria): velocidade de ataque (mais partidas no teto) e
// +ouro (só $). Maestria de partida NÃO é multiplicada por talento. Simulação MAX de
// 4 semanas ≤ ~25% do ativo (números no CHANGELOG-grind-proposito).

export type RamoTalento = "combate" | "fortuna" | "sorte";
export type TierBau = "comum" | "raro" | "lendario";
export type TipoCosmetico = "skin" | "trilha" | "pet";

export interface DefTalento {
  id: string;
  ramo: RamoTalento;
  ordem: number; // 1..5 — prereq: o nó de `ordem-1` no mesmo ramo tem nível ≥ 1
  nome: string;
  desc: string; // efeito em número claro, com {v} = valor no PRÓXIMO nível
  nivelMax: number;
  custoBase: number; // Sucata pro nível 1
  custoMult: number; // custo escala por nível (custoBase * custoMult^(nivel))
  // efeito acumulado por nível (multiplicado pelo nível comprado):
  efeito: Partial<{
    duracao: number; // − fração da duração da partida (accumulation → +partidas no teto)
    encenacao: number; // + fração de velocidade da ENCENAÇÃO (visual; sem efeito econômico)
    golpeDuplo: number; // + chance de golpe duplo (visual + acelera a encenação)
    gold: number; // + fração do $ por partida
    sucata: number; // + fração da Sucata por partida
    barra: number; // + fração da carga da barra de baú
    raro: number; // + chance absoluta de tier Raro no baú
    pity: number; // − no N do pity do Lendário (nunca abaixo do piso)
    escolha: number; // 1 = baú Raro abre 2 e você escolhe 1
    // 🗺️ efeitos que ligam a árvore à EXPEDIÇÃO (o modo ativo/arriscado)
    expHp: number; // + HP máximo do herói na Expedição
    expLoot: number; // + fração da Sucata por fase da Expedição
    expFase: number; // fração → começa em fase avançada (floor da soma)
  }>;
}

// ⚔️💰🍀 3 ramos × 5 nós. Cada nó tem níveis; prereq linear dentro do ramo.
export const TALENTOS: DefTalento[] = [
  // ⚔️ COMBATE — acelera a cena; velocidade/foco também rendem mais partidas no teto
  { id: "atkspeed", ramo: "combate", ordem: 1, nome: "Velocidade de Ataque", desc: "+{v} velocidade (partidas mais rápidas)", nivelMax: 5, custoBase: 18, custoMult: 1.55, efeito: { duracao: 0.015, encenacao: 0.08 } },
  { id: "dano", ramo: "combate", ordem: 2, nome: "Dano", desc: "+{v} — waves caem mais rápido (visual)", nivelMax: 5, custoBase: 16, custoMult: 1.5, efeito: { encenacao: 0.06 } },
  { id: "duplo", ramo: "combate", ordem: 3, nome: "Golpe Duplo", desc: "+{v} chance de golpe duplo", nivelMax: 5, custoBase: 22, custoMult: 1.55, efeito: { golpeDuplo: 0.06, encenacao: 0.02 } },
  { id: "foco", ramo: "combate", ordem: 4, nome: "Foco", desc: "+{v} velocidade extra", nivelMax: 5, custoBase: 30, custoMult: 1.6, efeito: { duracao: 0.008, encenacao: 0.04 } },
  { id: "furia", ramo: "combate", ordem: 5, nome: "Fúria", desc: "+{v} impacto visual · +12 HP na Expedição", nivelMax: 3, custoBase: 45, custoMult: 1.7, efeito: { encenacao: 0.05, expHp: 12 } },

  // 💰 FORTUNA — só $ e Sucata (maestria NÃO cresce por talento)
  { id: "gold", ramo: "fortuna", ordem: 1, nome: "Ouro do Farm", desc: "+{v} de $ por partida", nivelMax: 5, custoBase: 20, custoMult: 1.55, efeito: { gold: 0.03 } },
  { id: "catador", ramo: "fortuna", ordem: 2, nome: "Catador", desc: "+{v} de Sucata por partida", nivelMax: 5, custoBase: 18, custoMult: 1.5, efeito: { sucata: 0.08 } },
  { id: "ima", ramo: "fortuna", ordem: 3, nome: "Ímã de Baú", desc: "+{v} de carga da barra de baú", nivelMax: 5, custoBase: 24, custoMult: 1.55, efeito: { barra: 0.06 } },
  { id: "bonus", ramo: "fortuna", ordem: 4, nome: "Bônus de Kill", desc: "+{v} de $ extra por partida", nivelMax: 5, custoBase: 32, custoMult: 1.6, efeito: { gold: 0.012 } },
  { id: "cofre", ramo: "fortuna", ordem: 5, nome: "Cofre", desc: "+{v} de Sucata extra · +10% loot na Expedição", nivelMax: 3, custoBase: 50, custoMult: 1.7, efeito: { sucata: 0.05, expLoot: 0.1 } },

  // 🍀 SORTE — muda a distribuição de tier e o pity (proteção, não promessa)
  { id: "raro", ramo: "sorte", ordem: 1, nome: "Faro Raro", desc: "+{v} chance de baú Raro", nivelMax: 5, custoBase: 22, custoMult: 1.55, efeito: { raro: 0.02 } },
  { id: "pity", ramo: "sorte", ordem: 2, nome: "Presságio", desc: "−{v} na espera do Lendário", nivelMax: 5, custoBase: 26, custoMult: 1.6, efeito: { pity: 4 } },
  { id: "escolha", ramo: "sorte", ordem: 3, nome: "Segunda Chance", desc: "Baú Raro abre 2 e você escolhe 1", nivelMax: 1, custoBase: 120, custoMult: 1, efeito: { escolha: 1 } },
  { id: "instinto", ramo: "sorte", ordem: 4, nome: "Instinto", desc: "+{v} chance de baú Raro extra", nivelMax: 5, custoBase: 34, custoMult: 1.6, efeito: { raro: 0.01 } },
  { id: "trevo", ramo: "sorte", ordem: 5, nome: "Trevo", desc: "+{v} chance de Raro · maxado começa 1 fase à frente", nivelMax: 3, custoBase: 55, custoMult: 1.7, efeito: { raro: 0.015, expFase: 0.34 } },
];

export const GRIND_PROP = {
  // 🔩 Sucata — dropa por partida (representa os minions mortos na cena).
  // RECALIBRADO na rodada "Dois Modos": a Sucata do passivo foi reduzida ~½ pra ele virar
  // o CHÃO lento e seguro (~4 meses sozinho até a árvore), abrindo espaço pra Expedição ser
  // o acelerador real sem furar o teto de ~1,5-2,5 meses combinado (números no CHANGELOG).
  sucataPartidaMin: 1,
  sucataPartidaMax: 2,
  respecCusto: 0, // respec GRÁTIS (incentiva experimentar — decisão documentada)

  // 🎁 Barra de baú — o $ coletado na cena carrega a barra.
  // Só VITÓRIA paga gold ($2 base), e um dia no teto rende ~20 partidas (~11 vitórias
  // ⇒ ~$22 de gold). Com 12 de carga isso dá ~1.8 baús/dia — o ritual de abrir cabe
  // no dia sem virar chuva de baú (medido no teste de 4 semanas).
  barraCheia: 12,

  // 🎲 tiers (calibráveis) — somam 1
  chanceRaroBase: 0.15,
  chanceLendarioBase: 0.01,
  pityLendarioN: 60, // Lendário garantido no máx. a cada N baús
  pityLendarioPiso: 40, // talento de Sorte reduz N até AQUI, nunca abaixo

  // 💰 recompensas por baú (o $/maestria contam vs o teto; medido na simulação).
  // Sucata dos baús também reduzida ~½ na rodada "Dois Modos" (ver nota acima).
  comum: { sucataMin: 4, sucataMax: 8, dinheiro: 1 },
  raro: { sucataMin: 12, sucataMax: 22, dinheiro: 2, maestriaPack: 1 }, // item Comum OU +maestria
  lendario: { sucataMin: 80, sucataMax: 130, jackpotColecaoCheia: 3 }, // ×3 se a coleção estiver completa
} as const;

// 🎨 Coleção do Grind v1 (cosméticos exclusivos do diorama — só Lendário concede).
// Cor = hue de tint programático (skins) / cor do rastro (trilhas) / cor do pet.
export interface DefCosmetico {
  id: string;
  nome: string;
  tipo: TipoCosmetico;
  cor: string; // hex — hue-shift preserva a LUZ do sprite (ver CHANGELOG)
  emoji: string;
}

export const COLECAO_GRIND: DefCosmetico[] = [
  { id: "skin_carmesim", nome: "Herói Carmesim", tipo: "skin", cor: "#ff3b5c", emoji: "🟥" },
  { id: "skin_esmeralda", nome: "Herói Esmeralda", tipo: "skin", cor: "#2ee6a0", emoji: "🟩" },
  { id: "skin_aureo", nome: "Herói Áureo", tipo: "skin", cor: "#ffd34d", emoji: "🟨" },
  { id: "skin_sombrio", nome: "Herói Sombrio", tipo: "skin", cor: "#9a6bff", emoji: "🟪" },
  { id: "trilha_ciano", nome: "Rastro Ciano", tipo: "trilha", cor: "#19e6e0", emoji: "➰" },
  { id: "trilha_aurea", nome: "Rastro Áureo", tipo: "trilha", cor: "#ffd34d", emoji: "➰" },
  { id: "trilha_verde", nome: "Rastro Verde", tipo: "trilha", cor: "#2ee6a0", emoji: "➰" },
  { id: "pet_poro", nome: "Poro de Estimação", tipo: "pet", cor: "#f5e6d0", emoji: "🐾" },
  { id: "pet_barao", nome: "Mini-Barão", tipo: "pet", cor: "#9a6bff", emoji: "🐛" },
] as const;

export function defTalento(id: string): DefTalento | undefined {
  return TALENTOS.find((t) => t.id === id);
}
export function defCosmetico(id: string): DefCosmetico | undefined {
  return COLECAO_GRIND.find((c) => c.id === id);
}
