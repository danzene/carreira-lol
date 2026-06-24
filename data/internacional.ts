// 🌍 Premiação dos torneios internacionais (MSI / Worlds). Índice 0 = campeão, 1 = vice,
// 2 = semifinalista, depois fase de grupos.

export const PREMIO_TORNEIO: Record<"MSI" | "WORLDS", number[]> = {
  MSI: [6000, 3000, 1500, 1500, 800, 800],
  WORLDS: [20000, 10000, 5000, 5000, 2500, 2500],
};

export const REP_TORNEIO: Record<"MSI" | "WORLDS", number[]> = {
  MSI: [18, 10, 5, 5, 2, 2],
  WORLDS: [35, 20, 10, 10, 5, 5],
};
