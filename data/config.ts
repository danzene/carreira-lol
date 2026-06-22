import type { AtributoKey, Role } from "@/engine/types";

// 🎚️ Balanceamento e dados estáticos — Fase 1 (criação). Ajuste tudo aqui.

export const ATRIBUTOS: { chave: AtributoKey; nome: string; desc: string }[] = [
  { chave: "mecanica", nome: "Mecânica", desc: "Micro, combos, mira." },
  { chave: "macro", nome: "Macro", desc: "Mapa, rotação, objetivos." },
  { chave: "laning", nome: "Laning", desc: "Fase de rotas, wave management." },
  { chave: "teamfight", nome: "Teamfight", desc: "Posicionamento e impacto em luta." },
  { chave: "consistencia", nome: "Consistência", desc: "Reduz a variância da performance." },
  { chave: "mental", nome: "Mental", desc: "Clutch, não tiltar, jogo sob pressão." },
  { chave: "comunicacao", nome: "Comunicação", desc: "Sinergia e shotcalling com o time." },
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

// Regras da criação de jogador.
export const CRIACAO = {
  atributoBase: 40, // todo atributo começa aqui
  pontosParaDistribuir: 80, // total a gastar (em passos de 5)
  tetoNaCriacao: 75, // máximo por atributo na criação (deixa espaço pra evoluir até 100)
  passo: 5, // incremento dos botões +/-
  tamanhoPool: 3, // quantos campeões escolher
  maestriaInicial: 20, // maestria dos campeões escolhidos
  idadeInicial: 17,
} as const;

// Estado inicial da carreira (começa do zero).
export const INICIO = {
  dinheiro: 500,
  energia: 100,
  moral: 70,
  reputacao: 5,
  rank: { elo: "Ferro IV", lp: 0, mmr: 800 },
} as const;
