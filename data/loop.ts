// 🎚️ Balanceamento do loop semanal (Fase 3). Ajuste tudo aqui.

export const LOOP = {
  custoSoloq: 12, // energia por partida de soloq
  custoTreino: 20, // energia por sessão de treino
  ganhoTreino: 1.2, // XP no atributo treinado (foco > soloq)
  energiaPorMinutos: 2, // +1 de energia a cada X minutos de tempo real
  energiaMax: 100, // teto da energia
  moralPorForma: 1.5, // moral += (notaMédiaRecente - 5) * isto, ao avançar
  moralDescanso: 15, // bônus de moral ao "Descansar a semana"
  janelaForma: 5, // nº de partidas usadas pra medir a forma
  semanasPorTemporada: 26, // ao passar disso, vira a temporada
} as const;
