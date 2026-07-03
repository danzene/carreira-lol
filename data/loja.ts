// 💰 Loja (dinheiro in-game $). Balanceamento dos sinks de salário — cada compra
// é uma DECISÃO: energia agora vs treino pago vs vantagem na próxima partida.
// (CoinPoints é OUTRA moeda — server-side, futura monetização — e não entra aqui.)

export const LOJA = {
  energetico: { custo: 120, energia: 30 }, // +30⚡ na hora
  megaEnergetico: { custo: 320 }, // energia CHEIA
  cargaCampeonato: { custo: 300 }, // +1 carga de partida de campeonato (respeita o teto)
  escudoStreak: { custo: 400 }, // repõe o escudo semanal do streak (se já consumido)
  preparacao: { custo: 250, comp: 3, counterLane: 1 }, // estudo do adversário: buff da PRÓXIMA partida
  vodReview: { custo: 280, maestria: 6 }, // +maestria num campeão da pool À ESCOLHA
  aulaParticular: { custo: 500, xp: 1.5 }, // +atributo à escolha SEM gastar energia
} as const;
