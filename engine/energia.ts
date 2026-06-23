import { LOOP } from "@/data/loop";
import type { CareerState } from "./types";

// Energia em tempo real: regenera 1 a cada LOOP.energiaPorMinutos minutos de relógio.
// Tudo puro (recebe "agora"); o `energiaEm` é o âncora de quando começou a contar.

export function intervaloEnergiaMs(): number {
  return LOOP.energiaPorMinutos * 60 * 1000;
}

export function regenerarEnergia(career: CareerState, agora: number = Date.now()): CareerState {
  const intervalo = intervaloEnergiaMs();
  const desde = career.energiaEm ?? agora;

  // Cheia: mantém o âncora em "agora" (não acumula enquanto está no teto).
  if (career.player.energia >= LOOP.energiaMax) {
    return { ...career, energiaEm: agora };
  }

  const ganho = Math.max(0, Math.floor((agora - desde) / intervalo));
  if (ganho === 0) {
    return career.energiaEm === undefined ? { ...career, energiaEm: desde } : career;
  }

  const novaEnergia = Math.min(LOOP.energiaMax, career.player.energia + ganho);
  return {
    ...career,
    energiaEm: novaEnergia >= LOOP.energiaMax ? agora : desde + ganho * intervalo,
    player: { ...career.player, energia: novaEnergia },
  };
}

// ms até a próxima +1 de energia (0 se já está cheia).
export function tempoAteProxima(career: CareerState, agora: number = Date.now()): number {
  if (career.player.energia >= LOOP.energiaMax) return 0;
  const intervalo = intervaloEnergiaMs();
  const desde = career.energiaEm ?? agora;
  const resto = ((agora - desde) % intervalo + intervalo) % intervalo;
  return intervalo - resto;
}
