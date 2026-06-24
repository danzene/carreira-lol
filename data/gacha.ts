// 🎰 Scout Gacha — cartas de Lendas (arquétipos originais). Passivo fixo + substats
// aleatórios (caçar o roll perfeito). Duplicata sobe de nível. PURO (só dados).

export const GACHA = {
  custo1: 100, // Pontos de Scout por puxada
  custo10: 900, // 10 puxadas (desconto)
  porSemana: 30, // PS ao avançar a semana
  porVitoria: 8, // PS por vitória
  pity5: 60, // 5★ garantido nesta puxada
  nivelMax: 5, // duplicatas sobem até aqui
  slots: 3, // lendas equipadas ao mesmo tempo
} as const;

export type Raridade = 3 | 4 | 5;

export interface InfoRaridade {
  n: Raridade;
  nome: string;
  cor: string;
  chance: number;
  subMin: number;
  subMax: number;
}

export const RARIDADES: InfoRaridade[] = [
  { n: 5, nome: "Lendário", cor: "#ff2d7e", chance: 0.04, subMin: 3, subMax: 4 },
  { n: 4, nome: "Ouro", cor: "#ffd34d", chance: 0.16, subMin: 2, subMax: 3 },
  { n: 3, nome: "Prata", cor: "#9a90c0", chance: 0.8, subMin: 1, subMax: 2 },
];

export function infoRaridade(n: number): InfoRaridade {
  return RARIDADES.find((r) => r.n === n) ?? RARIDADES[2];
}

// Substats sorteáveis. tipo "atributo" soma no atributo; "especial" tem efeito próprio.
export type TipoSub = "atributo" | "xp" | "dinheiro" | "decaimento" | "comp";

export interface DefSubstat {
  chave: string;
  rotulo: string;
  tipo: TipoSub;
  faixa: Record<Raridade, [number, number]>;
}

const FAIXA_ATRIB: Record<Raridade, [number, number]> = { 3: [1, 3], 4: [2, 5], 5: [4, 8] };
const FAIXA_PCT: Record<Raridade, [number, number]> = { 3: [3, 8], 4: [5, 12], 5: [8, 18] };
const FAIXA_DECAY: Record<Raridade, [number, number]> = { 3: [5, 12], 4: [10, 20], 5: [15, 30] };
const FAIXA_COMP: Record<Raridade, [number, number]> = { 3: [1, 2], 4: [1, 3], 5: [2, 4] };

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

export interface ModeloLenda {
  id: string;
  nome: string;
  titulo: string; // sabor
  raridade: Raridade;
  // passivo fixo e forte (escala com o nível da carta)
  passivo: { chave: string; valor: number };
}

export const LENDAS: ModeloLenda[] = [
  // 5★
  { id: "rei_mid", nome: "O Rei do Mid", titulo: "Inevitável", raridade: 5, passivo: { chave: "mecanica", valor: 7 } },
  { id: "a_mente", nome: "A Mente", titulo: "IGL supremo", raridade: 5, passivo: { chave: "comp", valor: 4 } },
  { id: "veterano", nome: "O Veterano", titulo: "Nunca enferruja", raridade: 5, passivo: { chave: "decaimento", valor: 35 } },
  { id: "lenda_viva", nome: "A Lenda Viva", titulo: "GOAT", raridade: 5, passivo: { chave: "teamfight", valor: 6 } },
  // 4★
  { id: "inabalavel", nome: "O Inabalável", titulo: "Cabeça de gelo", raridade: 4, passivo: { chave: "consistencia", valor: 6 } },
  { id: "mao_tesoura", nome: "Mão de Tesoura", titulo: "Mecânica pura", raridade: 4, passivo: { chave: "mecanica", valor: 5 } },
  { id: "predador", nome: "O Predador", titulo: "Dono do mapa", raridade: 4, passivo: { chave: "macro", valor: 5 } },
  { id: "maestro", nome: "O Maestro", titulo: "Rege o time", raridade: 4, passivo: { chave: "comunicacao", valor: 5 } },
  { id: "prodigio", nome: "O Prodígio", titulo: "Aprende rápido", raridade: 4, passivo: { chave: "xp", valor: 12 } },
  // 3★
  { id: "muralha", nome: "A Muralha", titulo: "Não cai", raridade: 3, passivo: { chave: "mental", valor: 4 } },
  { id: "calculista", nome: "O Calculista", titulo: "Lê o jogo", raridade: 3, passivo: { chave: "laning", valor: 4 } },
  { id: "mercenario", nome: "O Mercenário", titulo: "Joga por grana", raridade: 3, passivo: { chave: "dinheiro", valor: 12 } },
];

export function modeloLenda(id: string): ModeloLenda | undefined {
  return LENDAS.find((l) => l.id === id);
}
