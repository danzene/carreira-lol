"use client";

import { type ReactNode } from "react";
import { useLiveOps } from "@/store/liveopsStore";
import { featureLigada, type FlagChave } from "@/lib/liveops";

// Porta de feature controlada por live-ops (kill switch). FAIL-OPEN: enquanto a
// config não carregou, ou se ela falhou, a feature é tratada como LIGADA.
export default function FeatureGate({ flag, children, titulo }: { flag: FlagChave; children: ReactNode; titulo?: string }) {
  const config = useLiveOps((s) => s.config);
  const carregado = useLiveOps((s) => s.carregado);

  // Só bloqueia depois de carregar E com desligamento explícito.
  if (carregado && !featureLigada(config, flag)) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-4xl">🚧</div>
        <h1 className="mb-1 text-lg font-bold text-zinc-100">{titulo ?? "Temporariamente indisponível"}</h1>
        <p className="max-w-sm text-sm text-zinc-400">Estamos com esta seção em manutenção. Tente de novo daqui a pouco.</p>
      </main>
    );
  }
  return <>{children}</>;
}
