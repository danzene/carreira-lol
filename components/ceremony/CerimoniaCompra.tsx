"use client";

import { useEffect, useMemo, useState } from "react";
import { tocarSom } from "@/lib/som";
import { rastrear } from "@/lib/telemetria";
import AnimatedNumber from "@/components/juice/AnimatedNumber";
import PixelBurst from "@/components/juice/PixelBurst";

// 🪙 Cerimônia de COMPRA (dinheiro real) — a mais caprichada da loja: chuva de moedas
// douradas, flash + "COMPRA CONFIRMADA", a contagem subindo do zero e um agradecimento.
// Variante premium (👑, roxo) pra assinatura. Sempre dispensável com 1 clique.

const OURO = "#ffd34d";
const OURO_BRILHO = "#ffe9a3";
const ROXO = "#c084fc";

export default function CerimoniaCompra({
  moedas,
  premium,
  onFechar,
}: {
  moedas?: number;
  premium?: boolean;
  onFechar: () => void;
}) {
  const [aceso, setAceso] = useState(false);
  const cor = premium ? ROXO : OURO;
  const emoji = premium ? "👑" : "🪙";

  useEffect(() => {
    rastrear("cerimonia_compra", { moedas: moedas ?? 0, premium: !!premium });
    const t1 = setTimeout(() => {
      setAceso(true);
      tocarSom("conquista");
    }, 350);
    const t2 = setTimeout(onFechar, 5400); // auto-dismiss generoso (dá pra saborear)
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chuva de moedas: posições/atrasos fixos (nada de Math.random no meio do render)
  const chuva = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: (i * 6 + (i % 3) * 5) % 98,
        delay: (i % 8) * 0.16,
        dur: 1.7 + (i % 4) * 0.45,
      })),
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[95] flex cursor-pointer items-center justify-center overflow-hidden px-4"
      style={{ background: "radial-gradient(circle at 50% 38%, rgba(0,0,0,0.82), rgba(0,0,0,0.95))" }}
      onClick={onFechar}
      role="dialog"
      aria-label={premium ? "Assinatura ativada" : "Compra confirmada"}
    >
      <style>{`
        @keyframes cc_cair { 0%{transform:translateY(-8vh) rotate(0);opacity:0} 12%{opacity:1} 100%{transform:translateY(108vh) rotate(340deg);opacity:.85} }
        @keyframes cc_pulso { 0%,100%{filter:drop-shadow(0 0 22px var(--cc))} 50%{filter:drop-shadow(0 0 42px var(--cc))} }
      `}</style>

      {/* chuva de moedas/brilhos */}
      {aceso &&
        chuva.map((m, i) => (
          <span
            key={i}
            className="pointer-events-none absolute top-0 text-2xl"
            style={{ left: `${m.left}%`, animation: `cc_cair ${m.dur}s linear ${m.delay}s infinite` }}
          >
            {premium ? "✨" : "🪙"}
          </span>
        ))}

      <div className="relative flex flex-col items-center gap-3 text-center" onClick={(e) => e.stopPropagation()}>
        {aceso && (
          <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2">
            <PixelBurst cores={[cor, OURO_BRILHO, "#ffffff"]} qtd={48} seed={premium ? 21 : 11} />
          </div>
        )}

        <span
          className="text-7xl transition-all"
          style={
            {
              "--cc": cor,
              transform: aceso ? "scale(1)" : "scale(0.3)",
              opacity: aceso ? 1 : 0.3,
              animation: aceso ? "cc_pulso 1.4s ease-in-out infinite" : "none",
              transitionDuration: "420ms",
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
            } as React.CSSProperties
          }
        >
          {emoji}
        </span>

        <h2
          className="font-pixel text-xl"
          style={{ color: cor, opacity: aceso ? 1 : 0, textShadow: `0 0 18px ${cor}` }}
        >
          {premium ? "PASSE PREMIUM ATIVO!" : "COMPRA CONFIRMADA!"}
        </h2>

        {aceso && (
          <>
            {premium ? (
              <p className="pop-estouro font-pixel text-[13px]" style={{ color: OURO_BRILHO }}>
                Trilha premium liberada 👑
              </p>
            ) : (
              <p className="pop-estouro font-pixel text-2xl" style={{ color: OURO_BRILHO }}>
                🪙 +<AnimatedNumber valor={moedas ?? 0} deZero duracao={1500} />
                <span className="ml-1 text-[11px] text-suave">CoinPoints</span>
              </p>
            )}
            <p className="desliza-cima mt-1 text-[12px] text-suave">Obrigado por apoiar o Carreira LoL 💛</p>
            <button
              type="button"
              onClick={onFechar}
              className="desliza-cima mt-3 border-2 px-6 py-2 font-pixel text-[11px] transition hover:brightness-125"
              style={{ borderColor: cor, color: cor, background: `${cor}1a` }}
            >
              CONTINUAR
            </button>
          </>
        )}
      </div>
    </div>
  );
}
