"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchAdmin } from "@/lib/adminClient";

// Estado global do admin: período (7/14/30 dias, 0 = tudo) + hook de dados que
// re-busca quando o período muda. Datas no banco são UTC; a UI mostra em pt-BR.

interface PeriodoCtx {
  dias: number;
  setDias: (d: number) => void;
}
const Ctx = createContext<PeriodoCtx>({ dias: 30, setDias: () => {} });

export function PeriodoProvider({ children }: { children: ReactNode }) {
  const [dias, setDias] = useState(30);
  return <Ctx.Provider value={{ dias, setDias }}>{children}</Ctx.Provider>;
}

export function usePeriodo(): PeriodoCtx {
  return useContext(Ctx);
}

export const OPCOES_PERIODO: { rotulo: string; dias: number }[] = [
  { rotulo: "7 dias", dias: 7 },
  { rotulo: "14 dias", dias: 14 },
  { rotulo: "30 dias", dias: 30 },
  { rotulo: "Tudo", dias: 0 },
];

// Busca uma rota admin, re-buscando quando o período muda. Retorna {dados, carregando, erro}.
export function useAdmin<T>(path: string, deps: unknown[] = []): { dados: T | null; carregando: boolean; erro: string | null } {
  const { dias } = usePeriodo();
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    fetchAdmin<T>(path, dias)
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(String(e)))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, dias, ...deps]);
  return { dados, carregando, erro };
}
