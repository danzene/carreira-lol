import type { CareerState, EstadoDiario } from "./types";

// 📅 Ritual diário (PURO): streak de login com escudo semanal, recompensas crescentes
// (ciclo de 7 dias) e puxada grátis diária. Todas as funções recebem `hoje` ("YYYY-MM-DD")
// — o relógio/timezone fica na borda (store), o engine segue determinístico.

export const DIAS_CICLO = 7;

// Chave do dia LOCAL (a borda chama com Date.now()).
export function chaveDia(agora: number): string {
  const d = new Date(agora);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// Escudo: 1 por semana — disponível se nunca usado ou usado há 7+ dias.
export function escudoDisponivel(d: EstadoDiario | undefined, hoje: string): boolean {
  if (!d?.escudoUsadoEm) return true;
  return diffDias(d.escudoUsadoEm, hoje) >= 7;
}

export type EventoLogin = "mesmo_dia" | "primeiro" | "continuou" | "escudo" | "zerou";

export interface ResultadoLogin {
  career: CareerState;
  evento: EventoLogin;
  streak: number;
}

// Registra o login do dia: dia seguinte sobe o streak; 1 dia perdido consome o escudo
// (em vez de zerar); mais que isso zera. Mesmo dia = não muda nada (mesma referência).
export function registrarLoginDiario(career: CareerState, hoje: string): ResultadoLogin {
  const d = career.diario;
  if (d?.ultimoLoginDia === hoje) return { career, evento: "mesmo_dia", streak: d.streak };
  if (!d) {
    const novo: EstadoDiario = { ultimoLoginDia: hoje, streak: 1 };
    return { career: { ...career, diario: novo }, evento: "primeiro", streak: 1 };
  }
  const dias = diffDias(d.ultimoLoginDia, hoje);
  if (dias <= 0) {
    // relógio andou pra trás — trata como mesmo dia (não pune nem duplica)
    return { career: { ...career, diario: { ...d, ultimoLoginDia: hoje } }, evento: "mesmo_dia", streak: d.streak };
  }
  if (dias === 1) {
    const novo = { ...d, ultimoLoginDia: hoje, streak: d.streak + 1 };
    return { career: { ...career, diario: novo }, evento: "continuou", streak: novo.streak };
  }
  if (dias === 2 && escudoDisponivel(d, hoje)) {
    const novo = { ...d, ultimoLoginDia: hoje, streak: d.streak + 1, escudoUsadoEm: hoje };
    return { career: { ...career, diario: novo }, evento: "escudo", streak: novo.streak };
  }
  const novo = { ...d, ultimoLoginDia: hoje, streak: 1 };
  return { career: { ...career, diario: novo }, evento: "zerou", streak: 1 };
}

// ---- Recompensas do streak (ciclo semanal: dia 1 pequeno → dia 7 forte) ----
// TODO(monetização): recompensa em CoinPoints exige crédito server-side via
// ajustar_coinpoints — nesta rodada só recompensas locais ($, energia, item).

export type RecompensaDiaria =
  | { tipo: "dinheiro"; valor: number; rotulo: string }
  | { tipo: "energia"; valor: number; rotulo: string }
  | { tipo: "item"; rotulo: string }; // iLvl definido pelo chamador (MMR atual)

export function diaDoCiclo(streak: number): number {
  return ((Math.max(1, streak) - 1) % DIAS_CICLO) + 1;
}

export function recompensaDoDia(streak: number): RecompensaDiaria {
  switch (diaDoCiclo(streak)) {
    case 1:
      return { tipo: "dinheiro", valor: 150, rotulo: "$150" };
    case 2:
      return { tipo: "energia", valor: 30, rotulo: "+30 ⚡" };
    case 3:
      return { tipo: "dinheiro", valor: 250, rotulo: "$250" };
    case 4:
      return { tipo: "energia", valor: 50, rotulo: "+50 ⚡" };
    case 5:
      return { tipo: "dinheiro", valor: 400, rotulo: "$400" };
    case 6:
      return { tipo: "energia", valor: 100, rotulo: "Energia cheia ⚡" };
    default:
      return { tipo: "item", rotulo: "Item garantido 🎒" };
  }
}

// Marco de streak que merece cerimônia (3 dias, depois a cada semana cheia).
export function marcoStreak(streak: number): boolean {
  return streak === 3 || (streak > 0 && streak % DIAS_CICLO === 0);
}

export function podeColetarDiaria(career: CareerState, hoje: string): boolean {
  const d = career.diario;
  return !!d && d.ultimoLoginDia === hoje && d.recompensaColetadaEm !== hoje;
}

// Coleta a recompensa do dia: aplica $/energia no estado e marca o dia. Item NÃO é
// gerado aqui (o chamador gera com seed e adiciona ao inventário — que é por conta).
export function coletarDiaria(career: CareerState, hoje: string): { career: CareerState; recompensa: RecompensaDiaria } | null {
  if (!podeColetarDiaria(career, hoje)) return null;
  const d = career.diario!;
  const recompensa = recompensaDoDia(d.streak);
  let novo: CareerState = { ...career, diario: { ...d, recompensaColetadaEm: hoje } };
  if (recompensa.tipo === "dinheiro") novo = { ...novo, dinheiro: novo.dinheiro + recompensa.valor };
  else if (recompensa.tipo === "energia")
    novo = { ...novo, player: { ...novo.player, energia: Math.min(100, novo.player.energia + recompensa.valor) } };
  return { career: novo, recompensa };
}

// ---- Puxada grátis diária no Carreira Booster ----
// Decisão de design: a puxada grátis CONTA pro pity (mais generoso; o pity é retenção).

export function puxadaGratisDisponivel(career: CareerState, hoje: string): boolean {
  return career.diario?.puxadaGratisEm !== hoje;
}

export function marcarPuxadaGratis(career: CareerState, hoje: string): CareerState {
  const d = career.diario ?? { ultimoLoginDia: hoje, streak: 1 };
  return { ...career, diario: { ...d, puxadaGratisEm: hoje } };
}
