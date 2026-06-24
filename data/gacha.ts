// 🎰 Scout Gacha — cartas de Lendas (arquétipos originais). Passivo fixo + substats
// aleatórios (caçar o roll perfeito). Duplicata sobe de nível. PURO (só dados).

export const GACHA = {
  custo1: 100, // Pontos de Scout por puxada
  custo10: 900, // 10 puxadas (desconto)
  porSemana: 40, // PS ao avançar a semana
  porVitoria: 10, // PS por vitória
  porDerrota: 5, // PS mesmo perdendo
  pity5: 100, // 5★ (ou melhor) garantido nesta puxada
  nivelMax: 5, // duplicatas sobem até aqui
  slots: 3, // lendas equipadas ao mesmo tempo
} as const;

export type Raridade = 3 | 4 | 5 | 6;

export interface InfoRaridade {
  n: Raridade;
  nome: string;
  cor: string;
  chance: number;
  subMin: number;
  subMax: number;
}

// 6★ Mítica 0,01% · 5★ Lendária 0,5% · 4★ 10% · 3★ resto. (rarest first)
export const RARIDADES: InfoRaridade[] = [
  { n: 6, nome: "Mítica", cor: "#ffe14d", chance: 0.0001, subMin: 4, subMax: 4 },
  { n: 5, nome: "Lendária", cor: "#ff2d7e", chance: 0.005, subMin: 3, subMax: 4 },
  { n: 4, nome: "Ouro", cor: "#ffd34d", chance: 0.1, subMin: 2, subMax: 3 },
  { n: 3, nome: "Prata", cor: "#9a90c0", chance: 0.8949, subMin: 1, subMax: 2 },
];

export function infoRaridade(n: number): InfoRaridade {
  return RARIDADES.find((r) => r.n === n) ?? RARIDADES[RARIDADES.length - 1];
}

// Substats sorteáveis. tipo "atributo" soma no atributo; "especial" tem efeito próprio.
export type TipoSub = "atributo" | "xp" | "dinheiro" | "decaimento" | "comp";

export interface DefSubstat {
  chave: string;
  rotulo: string;
  tipo: TipoSub;
  faixa: Record<Raridade, [number, number]>;
}

const FAIXA_ATRIB: Record<Raridade, [number, number]> = { 3: [1, 3], 4: [2, 5], 5: [4, 8], 6: [7, 12] };
const FAIXA_PCT: Record<Raridade, [number, number]> = { 3: [3, 8], 4: [5, 12], 5: [8, 18], 6: [16, 28] };
const FAIXA_DECAY: Record<Raridade, [number, number]> = { 3: [5, 12], 4: [10, 20], 5: [15, 30], 6: [30, 50] };
const FAIXA_COMP: Record<Raridade, [number, number]> = { 3: [1, 2], 4: [1, 3], 5: [2, 4], 6: [4, 6] };

export const SUBSTATS: DefSubstat[] = [
  { chave: "mecanica", rotulo: "Mecânica", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "macro", rotulo: "Macro", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "laning", rotulo: "Laning", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "teamfight", rotulo: "Teamfight", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "consistencia", rotulo: "Consistência", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "mental", rotulo: "Mental", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "comunicacao", rotulo: "Comunicação", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "championPool", rotulo: "Champ Pool", tipo: "atributo", faixa: FAIXA_ATRIB },
  { chave: "xp", rotulo: "XP", tipo: "xp", faixa: FAIXA_PCT },
  { chave: "dinheiro", rotulo: "Salário", tipo: "dinheiro", faixa: FAIXA_PCT },
  { chave: "decaimento", rotulo: "Anti-decaimento", tipo: "decaimento", faixa: FAIXA_DECAY },
  { chave: "comp", rotulo: "Draft", tipo: "comp", faixa: FAIXA_COMP },
];

export function defSub(chave: string): DefSubstat | undefined {
  return SUBSTATS.find((s) => s.chave === chave);
}

// Tema do desenho pixel (RetratoLenda) e estilo (sinergias).
export type Tema =
  | "rei"
  | "mente"
  | "veterano"
  | "goat"
  | "gelo"
  | "mecanico"
  | "predador"
  | "maestro"
  | "prodigio"
  | "muralha"
  | "calculista"
  | "mercenario"
  | "capitao"
  | "atirador"
  | "imortal";

export type Estilo = "Agressivo" | "Estrategista" | "Mecânico" | "Resiliente" | "Carismático";
export const ESTILOS: Estilo[] = ["Agressivo", "Estrategista", "Mecânico", "Resiliente", "Carismático"];

// Paleta do desenho (cada lenda fica visualmente diferente).
export interface Paleta {
  pele: string;
  cabelo: string;
  roupa: string;
  olho: string;
}

export interface ModeloLenda {
  id: string;
  nome: string;
  titulo: string;
  raridade: Raridade;
  tema: Tema;
  estilo: Estilo;
  paleta: Paleta;
  passivo: { chave: string; valor: number }; // escala com o nível
}

const P = (pele: string, cabelo: string, roupa: string, olho: string): Paleta => ({ pele, cabelo, roupa, olho });

export const LENDAS: ModeloLenda[] = [
  // 6★ MÍTICA
  { id: "imortal", nome: "O Imortal", titulo: "Acima de todos", raridade: 6, tema: "imortal", estilo: "Agressivo", paleta: P("#f4ddc4", "#ffe14d", "#5a2a8a", "#ffe14d"), passivo: { chave: "mecanica", valor: 12 } },
  // 5★
  { id: "rei_mid", nome: "O Rei do Mid", titulo: "Inevitável", raridade: 5, tema: "rei", estilo: "Mecânico", paleta: P("#e8c39e", "#e8c34a", "#8a2535", "#4a8adf"), passivo: { chave: "mecanica", valor: 7 } },
  { id: "a_mente", nome: "A Mente", titulo: "IGL supremo", raridade: 5, tema: "mente", estilo: "Estrategista", paleta: P("#d9a878", "#a8b0c8", "#2a3560", "#19e6e0"), passivo: { chave: "comp", valor: 4 } },
  { id: "veterano", nome: "O Veterano", titulo: "Nunca enferruja", raridade: 5, tema: "veterano", estilo: "Resiliente", paleta: P("#c98e6a", "#dadae8", "#5a3a2a", "#7a4a2a"), passivo: { chave: "decaimento", valor: 35 } },
  { id: "lenda_viva", nome: "A Lenda Viva", titulo: "GOAT", raridade: 5, tema: "goat", estilo: "Agressivo", paleta: P("#e8c39e", "#2a2233", "#7a6a2a", "#e0a030"), passivo: { chave: "teamfight", valor: 6 } },
  { id: "imperador", nome: "O Imperador", titulo: "Domina o mapa", raridade: 5, tema: "rei", estilo: "Estrategista", paleta: P("#b9805a", "#8a5ac0", "#3a2056", "#9a6bff"), passivo: { chave: "macro", valor: 6 } },
  { id: "fantasma", nome: "O Fantasma", titulo: "Ninguém vê chegar", raridade: 5, tema: "predador", estilo: "Agressivo", paleta: P("#cdb6a6", "#d8d8e8", "#1f1a2a", "#ff2d7e"), passivo: { chave: "mecanica", valor: 6 } },
  // 4★
  { id: "inabalavel", nome: "O Inabalável", titulo: "Cabeça de gelo", raridade: 4, tema: "gelo", estilo: "Resiliente", paleta: P("#e8c39e", "#4a6ad8", "#2a5a6a", "#6aa8df"), passivo: { chave: "consistencia", valor: 6 } },
  { id: "mao_tesoura", nome: "Mão de Tesoura", titulo: "Mecânica pura", raridade: 4, tema: "mecanico", estilo: "Mecânico", paleta: P("#d9a878", "#2aa8a8", "#3a3a4a", "#19e6e0"), passivo: { chave: "mecanica", valor: 5 } },
  { id: "predador", nome: "O Predador", titulo: "Dono da selva", raridade: 4, tema: "predador", estilo: "Agressivo", paleta: P("#b9805a", "#4a7a3a", "#2a4a2a", "#6ad05a"), passivo: { chave: "macro", valor: 5 } },
  { id: "maestro", nome: "O Maestro", titulo: "Rege o time", raridade: 4, tema: "maestro", estilo: "Carismático", paleta: P("#e8c39e", "#6a4a2a", "#5a3a7a", "#e0a030"), passivo: { chave: "comunicacao", valor: 5 } },
  { id: "prodigio", nome: "O Prodígio", titulo: "Aprende rápido", raridade: 4, tema: "prodigio", estilo: "Mecânico", paleta: P("#f0d0b0", "#e08a3a", "#2a6a8a", "#4a8adf"), passivo: { chave: "xp", valor: 12 } },
  { id: "capitao", nome: "O Capitão", titulo: "Lidera de frente", raridade: 4, tema: "capitao", estilo: "Carismático", paleta: P("#8a5a3c", "#1f1a2a", "#8a2535", "#6a4226"), passivo: { chave: "comunicacao", valor: 4 } },
  // 3★
  { id: "muralha", nome: "A Muralha", titulo: "Não cai", raridade: 3, tema: "muralha", estilo: "Resiliente", paleta: P("#c98e6a", "#4a3320", "#4a4a5a", "#7a4a2a"), passivo: { chave: "mental", valor: 4 } },
  { id: "calculista", nome: "O Calculista", titulo: "Lê o jogo", raridade: 3, tema: "calculista", estilo: "Estrategista", paleta: P("#e8c39e", "#2a2233", "#2a3a5a", "#4a9a5a"), passivo: { chave: "laning", valor: 4 } },
  { id: "mercenario", nome: "O Mercenário", titulo: "Joga por grana", raridade: 3, tema: "mercenario", estilo: "Carismático", paleta: P("#d9a878", "#d8b84a", "#3a5a3a", "#c89030"), passivo: { chave: "dinheiro", valor: 12 } },
  { id: "franco", nome: "O Franco-atirador", titulo: "Mira cirúrgica", raridade: 3, tema: "atirador", estilo: "Mecânico", paleta: P("#b9805a", "#6a6a7a", "#8a4a2a", "#d0404a"), passivo: { chave: "teamfight", valor: 3 } },
  { id: "promessa", nome: "A Promessa", titulo: "O futuro", raridade: 3, tema: "prodigio", estilo: "Agressivo", paleta: P("#f0d0b0", "#ff8fc0", "#2a7a9a", "#9a6bff"), passivo: { chave: "xp", valor: 8 } },
  { id: "tatico", nome: "O Tático", titulo: "Tudo planejado", raridade: 3, tema: "calculista", estilo: "Estrategista", paleta: P("#d9a878", "#5a8a4a", "#2a3560", "#4a9a5a"), passivo: { chave: "macro", valor: 3 } },
];

// Sinergia por estilo: ativa com 2+ lendas do mesmo estilo equipadas.
export const SINERGIA: Record<Estilo, { chave: string; valor: number }> = {
  Agressivo: { chave: "teamfight", valor: 3 },
  Estrategista: { chave: "macro", valor: 3 },
  Mecânico: { chave: "mecanica", valor: 3 },
  Resiliente: { chave: "consistencia", valor: 3 },
  Carismático: { chave: "comunicacao", valor: 3 },
};

export function modeloLenda(id: string): ModeloLenda | undefined {
  return LENDAS.find((l) => l.id === id);
}
