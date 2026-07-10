// ⚡ Skills de Treino — balanceamento (dados puros). Golpes especiais que o herói
// dispara SOZINHO na cena (auto-cast com cooldown — espetáculo) e que dão poder
// INTERNO do treino: ajudam a limpar fases da Jornada e a sobreviver ao Desafio
// de Região. NUNCA poder de carreira (lista proibida varrida por teste): nada aqui
// toca PDL/MMR/atributos/snapshot ranqueado — o efeito vive só dentro do grind.
//
// Compradas e evoluídas com SUCATA (economia fechada). 3 SLOTS: só as equipadas
// aplicam efeito — escolher o loadout é decisão (defesa pro boss × velocidade de fase).

export interface DefSkill {
  id: string;
  nome: string;
  desc: string; // com {v} = valor no PRÓXIMO nível
  emoji: string;
  nivelMax: number;
  custoBase: number; // Sucata pro nível 1
  custoMult: number; // custo escala por nível
  cooldownSeg: number; // ritmo do auto-cast na CENA (visual)
  cor: string; // cor do efeito visual na cena
  // efeito por nível (multiplicado pelo nível; só vale EQUIPADA):
  efeito: Partial<{
    poder: number; // + força aliada na JORNADA (limpa fases mais fácil)
    escudo: number; // − fração do dano recebido no DESAFIO
    cura: number; // + fração de cura extra por fase limpa no DESAFIO
    hp: number; // + HP máximo no DESAFIO
  }>;
}

export const SKILL_SLOTS = 3;

export const SKILLS: DefSkill[] = [
  { id: "giro", nome: "Golpe Giratório", desc: "+{v} de poder na Jornada", emoji: "🌀", nivelMax: 5, custoBase: 30, custoMult: 1.6, cooldownSeg: 7, cor: "#19e6e0", efeito: { poder: 2 } },
  { id: "flechas", nome: "Chuva de Flechas", desc: "+{v} de poder · +{v2} HP no Desafio", emoji: "🏹", nivelMax: 5, custoBase: 35, custoMult: 1.6, cooldownSeg: 9, cor: "#ffd34d", efeito: { poder: 1.2, hp: 3 } },
  { id: "muralha", nome: "Muralha", desc: "−{v} do dano recebido no Desafio", emoji: "🛡️", nivelMax: 5, custoBase: 40, custoMult: 1.6, cooldownSeg: 11, cor: "#9a90c0", efeito: { escudo: 0.04 } },
  { id: "vampirismo", nome: "Vampirismo", desc: "+{v} de cura por fase limpa no Desafio", emoji: "🩸", nivelMax: 5, custoBase: 40, custoMult: 1.6, cooldownSeg: 8, cor: "#ff2d7e", efeito: { cura: 0.015 } },
  { id: "furia", nome: "Fúria de Batalha", desc: "+{v} de HP máximo no Desafio", emoji: "💢", nivelMax: 5, custoBase: 32, custoMult: 1.6, cooldownSeg: 10, cor: "#ff6b35", efeito: { hp: 10 } },
  { id: "foco", nome: "Foco Letal", desc: "+{v} de poder · −{v2} de dano no Desafio", emoji: "🎯", nivelMax: 5, custoBase: 50, custoMult: 1.65, cooldownSeg: 12, cor: "#2ee6a0", efeito: { poder: 0.8, escudo: 0.015 } },
];

export function defSkill(id: string): DefSkill | undefined {
  return SKILLS.find((s) => s.id === id);
}
