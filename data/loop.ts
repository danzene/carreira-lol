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
  recuperaEnergiaSemana: 40, // (legado) substituído por ganhoAvancoEnergia + regen por tempo real
  decaimentoSemanal: 0.25, // atributos caem isto por semana (estilo Punch Club): precisa treinar pra manter
  moralDescanso: 15, // bônus de moral ao "descansar a semana" (energia vai ao máx.)
  moralPorForma: 1.5, // moral += (notaMédia - 5) * isto, ao avançar
  janelaForma: 5,
  semanasPorTemporada: 26,

  // ⏱️ Progressão por tempo real (stamina estilo mobile)
  ganhoAvancoEnergia: 50, // energia ganha ao avançar a semana
  energiaCheiaMs: 2 * 60 * 60 * 1000, // energia regenera de 0→100 em 2h reais
  janelaPassesMs: 4 * 60 * 60 * 1000, // janela do limite de avançar/descansar
  maxPassesJanela: 2, // pode avançar 2x e descansar 2x por janela

  // 🎟️ Cargas de partida de campeonato (liga/torneio) — NÃO gastam energia
  maxCargasPartida: 3, // partidas de campeonato jogáveis sem esperar
  cargaPartidaMs: 10 * 60 * 1000, // +1 carga a cada 10 min (3 cargas = 30 min)
} as const;
