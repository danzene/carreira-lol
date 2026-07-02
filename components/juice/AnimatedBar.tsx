"use client";

import { useEffect, useRef, useState } from "react";
import { DURACOES, EASING_OUT } from "@/data/juice";

// Barra que enche com transição suave e dá um "flash" ao completar (100%).

export default function AnimatedBar({
  pct,
  cor = "linear-gradient(to right, #ff2d7e, #19e6e0)",
  alturaClass = "h-2",
  className = "",
}: {
  pct: number; // 0..100
  cor?: string; // CSS background da barra
  alturaClass?: string;
  className?: string;
}) {
  const alvo = Math.min(100, Math.max(0, pct));
  const [flash, setFlash] = useState(false);
  const anterior = useRef(alvo);

  useEffect(() => {
    if (alvo >= 100 && anterior.current < 100) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      anterior.current = alvo;
      return () => clearTimeout(t);
    }
    anterior.current = alvo;
  }, [alvo]);

  return (
    <div className={`overflow-hidden border-2 border-borda bg-fundo ${alturaClass} ${className}`}>
      <div
        className={`h-full ${flash ? "animate-pulse brightness-150" : ""}`}
        style={{
          width: `${alvo}%`,
          background: cor,
          transition: `width ${DURACOES.barra}ms ${EASING_OUT}, filter 200ms`,
        }}
      />
    </div>
  );
}
