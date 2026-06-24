// 🎚️ Balanceamento do loop semanal (Fase 5). Energia por semana; cada ação custa.

export const LOOP = {
  custoSoloq: 15, // energia por partida (soloq)
  custoTreino: 20, // treino focado
  ganhoTreino: 1.0, // XP no atributo (focado)
  custoEspecial: 35, // treino especial
  ganhoEspecial: 3.0, // XP no atributo (especial)
  custoStream: 15, // streaming
  ganhoStream: 60, // dinheiro por live
  repStream: 0.5, // reputação por live
  custoAlteracao: 40, // alteração mental (ganhar traço)
  maxTracos: 3, // limite de traços
  recuperaEnergiaSemana: 40, // energia ao avançar a semana (normal) — única forma de recuperar
  decaimentoSemanal: 0.25, // atributos caem isto por semana (estilo Punch Club): precisa treinar pra manter
  moralDescanso: 15, // bônus de moral ao "descansar a semana" (energia vai ao máx.)
  moralPorForma: 1.5, // moral += (notaMédia - 5) * isto, ao avançar
  janelaForma: 5,
  semanasPorTemporada: 26,
} as const;
