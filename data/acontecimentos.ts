// 🎲 Eventos aleatórios de carreira (Fase 12): pequenos acontecimentos ao avançar a semana.

export interface Acontecimento {
  id: string;
  texto: string;
  efeito: Partial<{ energia: number; moral: number; dinheiro: number; reputacao: number }>;
  peso: number; // chance relativa de sortear
}

export const ACONTECIMENTOS: Acontecimento[] = [
  { id: "viral", texto: "Uma jogada sua viralizou nas redes! (+reputação)", efeito: { reputacao: 3 }, peso: 3 },
  { id: "sono", texto: "Semana de sono em dia. (+energia)", efeito: { energia: 12 }, peso: 3 },
  { id: "fa", texto: "Encontro com fãs te animou. (+moral)", efeito: { moral: 8 }, peso: 3 },
  { id: "patrocinio", texto: "Fechou um micro-patrocínio. (+dinheiro)", efeito: { dinheiro: 200 }, peso: 2 },
  { id: "resfriado", texto: "Pegou um resfriado e treinou menos. (−energia)", efeito: { energia: -15 }, peso: 2 },
  { id: "climao", texto: "Clima tenso no elenco essa semana. (−moral)", efeito: { moral: -10 }, peso: 2 },
  { id: "critica", texto: "Um analista te criticou publicamente. (−reputação)", efeito: { reputacao: -2 }, peso: 2 },
  { id: "multa", texto: "Pequena multa por atraso no treino. (−dinheiro)", efeito: { dinheiro: -120 }, peso: 1 },
];

export const CHANCE_ACONTECIMENTO = 0.5; // metade das semanas, em média, têm um acontecimento
