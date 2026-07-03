import { create } from "zustand";
import type { JogarInfo } from "@/components/DraftBoard";
import type { EstadoDraft } from "@/engine/draft";
import type { MatchResult } from "@/engine/types";

// 🧭 Fluxo do draft/partida (transiente, em memória): sobrevive à NAVEGAÇÃO entre telas
// — sair no meio do draft ou da batalha e voltar retoma de onde parou (F5 recomeça).
// `aplicado` garante que uma partida restaurada NUNCA conta duas vezes.

export type FaseFlow = "draft" | "partida" | "resultado";

interface DraftFlowStore {
  chave: string | null; // modo do fluxo em andamento: soloq | oficial | evento | internacional | prova
  fase: FaseFlow;
  info: JogarInfo | null;
  resultado: MatchResult | null;
  seed: number | null; // seed da partida (restaurar = MESMO resultado, sem re-roll)
  draft: EstadoDraft | null; // pick/ban em andamento
  aplicado: boolean; // resultado já aplicado na carreira?
  atualizar: (parcial: Partial<Omit<DraftFlowStore, "atualizar" | "resetar">>) => void;
  resetar: (chave: string) => void;
}

export const useDraftFlow = create<DraftFlowStore>((set) => ({
  chave: null,
  fase: "draft",
  info: null,
  resultado: null,
  seed: null,
  draft: null,
  aplicado: false,

  atualizar: (parcial) => set(parcial),
  resetar: (chave) => set({ chave, fase: "draft", info: null, resultado: null, seed: null, draft: null, aplicado: false }),
}));
