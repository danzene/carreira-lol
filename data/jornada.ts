// 🗺️ Jornada de Treino — balanceamento (dados puros). O Treino passivo agora é uma
// TRILHA DE FASES estilo idle: o diorama luta a fase atual sozinho; o jogador escolhe
// FARMAR (repete a fase — seguro) ou AVANÇAR (vitória ⇒ próxima fase, mais forte).
//
// PRINCÍPIOS (invioláveis):
// - IDLE SEGURO: no passivo NUNCA há morte. A fase forte demais é uma PAREDE natural —
//   a taxa de vitória cai e o avanço estanca; o herói segue lutando sem perder nada.
//   Morte de verdade só existe no Desafio de Região (presencial, opt-in).
// - ECONOMIA PROTEGIDA: a força inimiga tem PISO na calibração antiga (47 = mínimo da
//   faixa neutra validada pela Regra 4) — farm raso NUNCA rende mais $ que o grind
//   antigo; fase funda só fica MAIS difícil (WR cai ⇒ $ cai). O que escala com a
//   profundidade é a SUCATA (economia fechada) — o incentivo de empurrar a parede.
// - Gate de região: a cada 10 fases, avançar exige vencer o DESAFIO DE REGIÃO
//   (a expedição presencial). O idle fica farmando o gate enquanto isso.

export const JORNADA = {
  // 🔌 kill switch próprio: false volta o grind ao comportamento pré-jornada
  // (força neutra 47-53, sem fases) sem quebrar nenhum save.
  habilitado: true,

  trilhaMax: 40, // 1ª dificuldade tem 40 fases (4 regiões); dificuldades+ = rodada futura
  fasesPorRegiao: 10, // gate de boss nas fases 10/20/30/40

  // 👹 força do time inimigo por fase (entra no simularPartida como forcaTimeInimigo)
  forcaBase: 44,
  forcaPorFase: 1.8,
  forcaPiso: 47, // = mínimo da faixa neutra antiga (protege a calibração da Regra 4)
  forcaTeto: 95,

  // 🔩 Sucata escala com a profundidade (o motivo de empurrar a parede)
  sucataPorFase: 0.08, // mult = 1 + (fase-1)*isto
  sucataMultMax: 2.8,
} as const;

export function forcaInimigaJornada(fase: number): number {
  return Math.min(JORNADA.forcaTeto, Math.max(JORNADA.forcaPiso, JORNADA.forcaBase + fase * JORNADA.forcaPorFase));
}

export function multSucataJornada(fase: number): number {
  return Math.min(JORNADA.sucataMultMax, 1 + (fase - 1) * JORNADA.sucataPorFase);
}

export function regiaoDe(fase: number): number {
  return Math.max(1, Math.ceil(fase / JORNADA.fasesPorRegiao));
}

// Fase-gate: o fim de uma região (10/20/30/40). Vencê-la NÃO avança — o Desafio de
// Região (presencial) é quem destrava a próxima região.
export function ehGate(fase: number): boolean {
  return fase > 0 && fase % JORNADA.fasesPorRegiao === 0;
}

export function nomeRegiao(regiao: number): string {
  const nomes = ["Campos de Treino", "Ginásio da Elite", "Sala das Lendas", "Palco Mundial"];
  return nomes[Math.min(nomes.length - 1, Math.max(0, regiao - 1))];
}
