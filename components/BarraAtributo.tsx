"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedNumber from "./juice/AnimatedNumber";

// Barra de atributo com SEMÂNTICA de cor por faixa (<40 fraco / 40–69 ok / 70+ forte),
// largura animada e "+X" flutuante quando o valor sobe.

function corFaixa(v: number): string {
  if (v >= 70) return "linear-gradient(to right, #19e6e0, #2fd66e)";
  if (v >= 40) return "linear-gradient(to right, #ffd34d, #ffb84d)";
  return "linear-gradient(to right, #ff2d7e, #ff5a5a)";
}

export default function BarraAtributo({
  nome,
  valor,
  esconder = false,
}: {
  nome: string;
  valor: number;
  esconder?: boolean;
}) {
  const anterior = useRef(valor);
  const [ganho, setGanho] = useState<number | null>(null);

  useEffect(() => {
    const delta = valor - anterior.current;
    anterior.current = valor;
    if (delta > 0.005) {
      setGanho(Math.round(delta * 100) / 100);
      const t = setTimeout(() => setGanho(null), 1200);
      return () => clearTimeout(t);
    }
  }, [valor]);

  return (
    <div className="relative flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-suave sm:w-32">{nome}</span>
      <div className="h-3 flex-1 border-2 border-borda bg-fundo">
        {esconder ? (
          <div className="h-full w-full bg-borda/50" />
        ) : (
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${valor}%`, background: corFaixa(valor) }}
          />
        )}
      </div>
      <span className="w-7 shrink-0 text-right font-pixel text-[11px] text-texto">
        {esconder ? "?" : <AnimatedNumber valor={Math.round(valor)} />}
      </span>
      {ganho !== null && !esconder && (
        <span className="flutua-ganho pointer-events-none absolute -top-3 right-0 font-pixel text-[10px] text-emerald-400">
          +{ganho}
        </span>
      )}
    </div>
  );
}
