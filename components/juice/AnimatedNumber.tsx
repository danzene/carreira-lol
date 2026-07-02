"use client";

import { useEffect, useRef, useState } from "react";
import { DURACOES } from "@/data/juice";

// Número que "rola" do valor anterior até o novo (rAF + easing) — nada de número teleportando.

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedNumber({
  valor,
  duracao = DURACOES.numero,
  formato,
  className,
  deZero = false, // anima de 0 até o valor já na montagem (bom pra deltas tipo +18 LP)
}: {
  valor: number;
  duracao?: number;
  formato?: (v: number) => string;
  className?: string;
  deZero?: boolean;
}) {
  const [exibido, setExibido] = useState(deZero ? 0 : valor);
  const anterior = useRef(deZero ? 0 : valor);
  const raf = useRef<number>(0);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = valor;
    if (de === valor) return;
    const inicio = performance.now();
    cancelAnimationFrame(raf.current);
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const v = de + (valor - de) * easeOutCubic(t);
      setExibido(Math.abs(valor - de) >= 2 ? Math.round(v) : Math.round(v * 10) / 10);
      if (t < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf.current);
  }, [valor, duracao]);

  return <span className={className}>{formato ? formato(exibido) : exibido}</span>;
}
