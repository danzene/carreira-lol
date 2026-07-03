// 🚨 Detector de anomalia de economia (PURO). Cruza o saldo atual de CoinPoints com a
// soma dos deltas registrados na telemetria (evento `coinpoints`). Como a telemetria é
// best-effort (pode perder eventos), o resultado é uma LISTA DE REVISÃO, não punição —
// falsos positivos são esperados. Severidade pela magnitude do delta inexplicável.

export type Severidade = "ok" | "baixa" | "media" | "alta";

export function classificarAnomalia(saldoAtual: number, somaEventos: number): { delta: number; severidade: Severidade } {
  const delta = saldoAtual - somaEventos; // >0 = saldo maior que o justificável (suspeito de crédito indevido)
  const abs = Math.abs(delta);
  let severidade: Severidade;
  if (abs <= 100) severidade = "ok"; // ruído normal de telemetria perdida
  else if (abs <= 500) severidade = "baixa";
  else if (abs <= 2000) severidade = "media";
  else severidade = "alta";
  return { delta, severidade };
}

export function corSeveridade(s: Severidade): string {
  return s === "alta" ? "#f87171" : s === "media" ? "#fb923c" : s === "baixa" ? "#fbbf24" : "#4ade80";
}
