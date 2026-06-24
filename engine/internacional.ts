import { PREMIO_TORNEIO, REP_TORNEIO } from "@/data/internacional";
import { REGIOES, TIMES_REGIONAIS, regiaoDoPais, timesDaRegiao } from "@/data/regioes";
import { avancarLiga, forcaTimeDe, montarBracket, proximoConfrontoJogador } from "./liga";
import type { CareerState, TorneioInternacional } from "./types";

// MSI e Worlds (circuito mundial, parte 2). PURO. Reutiliza o bracket da liga.

export type TipoTorneio = "MSI" | "WORLDS";

// Escolhe 5 rivais internacionais para o bracket de 6 (você + 5).
function selecionarRivais(tipo: TipoTorneio, minhaReg: string, meuTime: string): string[] {
  const todos = TIMES_REGIONAIS.filter((t) => t.id !== meuTime);
  let base: string[];
  if (tipo === "MSI") {
    // campeão (maior prestígio) de cada OUTRA região
    base = REGIOES.filter((r) => r.id !== minhaReg)
      .map((r) => [...timesDaRegiao(r.id)].sort((a, b) => b.prestigio - a.prestigio)[0])
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => t.id);
  } else {
    // Worlds: os melhores do mundo
    base = [...todos]
      .sort((a, b) => forcaTimeDe(b.id) - forcaTimeDe(a.id))
      .slice(0, 6)
      .map((t) => t.id);
  }
  const set = new Set(base.filter((id) => id !== meuTime));
  for (const t of [...todos].sort((a, b) => forcaTimeDe(b.id) - forcaTimeDe(a.id))) {
    if (set.size >= 5) break;
    set.add(t.id);
  }
  return [...set].slice(0, 5);
}

export function criarTorneio(tipo: TipoTorneio, career: CareerState): TorneioInternacional {
  const minhaReg = regiaoDoPais(career.player.nacionalidade).id;
  const meuTime = career.contratoAtual?.timeId ?? "";
  const rivais = selecionarRivais(tipo, minhaReg, meuTime);
  return { tipo, nome: tipo === "MSI" ? "MSI" : "Worlds", bracket: montarBracket(rivais, "INTERNACIONAL") };
}

export function avancarTorneio(career: CareerState, vitoria: boolean, seed: number): CareerState {
  if (!career.torneioAtual) return career;
  return {
    ...career,
    torneioAtual: { ...career.torneioAtual, bracket: avancarLiga(career.torneioAtual.bracket, vitoria, seed) },
  };
}

export function proximoConfrontoTorneio(t?: TorneioInternacional): string | null {
  return proximoConfrontoJogador(t?.bracket);
}

export function premioTorneio(tipo: TipoTorneio, colocacao: number): { dinheiro: number; reputacao: number } {
  const di = PREMIO_TORNEIO[tipo];
  const re = REP_TORNEIO[tipo];
  const i = Math.min(Math.max(colocacao - 1, 0), di.length - 1);
  return { dinheiro: di[i] ?? 0, reputacao: re[i] ?? 0 };
}
