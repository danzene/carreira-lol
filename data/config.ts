import type { AtributoKey, Role, TraitId } from "@/engine/types";

// 🎚️ Dados estáticos e balanceamento da criação. Ajuste aqui.

export const ATRIBUTOS: { chave: AtributoKey; nome: string; desc: string }[] = [
  { chave: "mecanica", nome: "Mecânica", desc: "Micro, combos, mira." },
  { chave: "macro", nome: "Macro", desc: "Mapa, rotação, objetivos." },
  { chave: "laning", nome: "Laning", desc: "Fase de rotas, wave management." },
  { chave: "teamfight", nome: "Teamfight", desc: "Posicionamento e impacto em luta." },
  { chave: "consistencia", nome: "Consistência", desc: "Reduz a variância da performance." },
  { chave: "mental", nome: "Mental", desc: "Clutch, não tiltar, jogo sob pressão." },
  { chave: "comunicacao", nome: "Comunicação", desc: "Sinergia e shotcalling." },
  { chave: "championPool", nome: "Champion Pool", desc: "Versatilidade da pool." },
];

export const ROTAS: { chave: Role; nome: string; emoji: string }[] = [
  { chave: "TOP", nome: "Top", emoji: "🛡️" },
  { chave: "JUNGLE", nome: "Jungle", emoji: "🌿" },
  { chave: "MID", nome: "Mid", emoji: "✨" },
  { chave: "ADC", nome: "Atirador", emoji: "🏹" },
  { chave: "SUPPORT", nome: "Suporte", emoji: "💖" },
];

export const NACIONALIDADES: { nome: string; bandeira: string }[] = [
  { nome: "Brasil", bandeira: "🇧🇷" },
  { nome: "Coreia do Sul", bandeira: "🇰🇷" },
  { nome: "China", bandeira: "🇨🇳" },
  { nome: "Estados Unidos", bandeira: "🇺🇸" },
  { nome: "Dinamarca", bandeira: "🇩🇰" },
  { nome: "Alemanha", bandeira: "🇩🇪" },
  { nome: "França", bandeira: "🇫🇷" },
  { nome: "Espanha", bandeira: "🇪🇸" },
  { nome: "Suécia", bandeira: "🇸🇪" },
  { nome: "Polônia", bandeira: "🇵🇱" },
  { nome: "Turquia", bandeira: "🇹🇷" },
  { nome: "Vietnã", bandeira: "🇻🇳" },
];

// Traços (inspirados no TFM). `inicial` = pode ser escolhido na criação.
export const TRACOS: { id: TraitId; nome: string; desc: string; tipo: "bom" | "ruim" | "neutro"; inicial: boolean }[] = [
  { id: "ROAMER", nome: "Roamer", desc: "Macro melhor fora da rota (ganks/rotações).", tipo: "bom", inicial: true },
  { id: "LANE_BULLY", nome: "Lane Bully", desc: "Domina a fase de rotas; pressão cedo.", tipo: "bom", inicial: true },
  { id: "CLUTCH", nome: "Clutch", desc: "Joga melhor sob pressão e em desvantagem.", tipo: "bom", inicial: true },
  { id: "FLEX", nome: "Flex", desc: "Versátil: várias rotas e campeões.", tipo: "bom", inicial: true },
  { id: "CARRY_TARDIO", nome: "Carry Tardio", desc: "Fraco cedo, monstro no late.", tipo: "neutro", inicial: true },
  { id: "AGRESSIVO", nome: "Agressivo", desc: "Joga pra cima: mais kills, mais risco.", tipo: "neutro", inicial: true },
  { id: "SHOTCALLER", nome: "Shotcaller", desc: "Lidera as calls; melhora a sinergia do time.", tipo: "bom", inicial: true },
  { id: "FRIO", nome: "Cabeça Fria", desc: "Não tilta; baixa variância.", tipo: "bom", inicial: true },
  { id: "TILTAVEL", nome: "Tiltável", desc: "Tilta fácil; mais variância negativa.", tipo: "ruim", inicial: false },
];

export const CRIACAO = {
  atributoBase: 40,
  pontosParaDistribuir: 80,
  tetoNaCriacao: 75,
  passo: 5,
  tamanhoPool: 3,
  maestriaInicial: 20,
  idadeInicial: 17,
} as const;

export const INICIO = {
  dinheiro: 500,
  energia: 100,
  moral: 70,
  reputacao: 5,
  rank: { elo: "Ferro IV", lp: 0, mmr: 800 },
} as const;
