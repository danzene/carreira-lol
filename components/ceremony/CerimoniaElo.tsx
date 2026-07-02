"use client";

import { useEffect, useState } from "react";
import { corElo } from "@/data/juice";
import { criarRng, hashString } from "@/engine/rng";
import { tocarSom } from "@/lib/som";
import PixelBurst from "@/components/juice/PixelBurst";

// 🏆 Cerimônia de elo. PROMOÇÃO: a moldura antiga se despedaça em cacos pixel → o novo
// elo se forma com pop + fanfarra + partículas. QUEDA: versão sóbria e rápida (~1,5s,
// tom neutro — sem humilhar o jogador).

type Fase = "quebra" | "forma" | "celebra";

function Cacos({ elo }: { elo: string }) {
  // cacos determinísticos (PRNG seedado do engine — nada de Math.random)
  const rng = criarRng(hashString(elo));
  const cacos = Array.from({ length: 8 }, (_, i) => ({
    dx: Math.round((rng() - 0.5) * 140),
    dy: Math.round(30 + rng() * 90),
    rot: Math.round((rng() - 0.5) * 160),
    delay: i * 0.03,
  }));
  const cor = corElo(elo);
  return (
    <div className="relative flex items-center justify-center">
      {cacos.map((c, i) => (
        <span
          key={i}
          className="despedaca absolute font-pixel text-lg"
          style={
            {
              color: cor,
              "--dx": `${c.dx}px`,
              "--dy": `${c.dy}px`,
              "--rot": `${c.rot}deg`,
              animationDelay: `${c.delay}s`,
            } as React.CSSProperties
          }
        >
          ▪
        </span>
      ))}
      <span className="font-pixel text-lg opacity-40" style={{ color: cor }}>
        {elo}
      </span>
    </div>
  );
}

export default function CerimoniaElo({
  de,
  para,
  promocao,
  onFechar,
}: {
  de: string;
  para: string;
  promocao: boolean;
  onFechar: () => void;
}) {
  const [fase, setFase] = useState<Fase>("quebra");
  const cor = corElo(para);

  useEffect(() => {
    if (!promocao) {
      // queda: sóbria e rápida
      tocarSom("rebaixamento");
      const t = setTimeout(onFechar, 1500);
      return () => clearTimeout(t);
    }
    setFase("quebra");
    const t1 = setTimeout(() => {
      setFase("forma");
      tocarSom("promocao");
    }, 700);
    const t2 = setTimeout(() => setFase("celebra"), 1150);
    const t3 = setTimeout(onFechar, 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, para, promocao]);

  if (!promocao) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4" onClick={onFechar} role="dialog">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-3xl">📉</span>
          <p className="font-pixel text-[12px] text-suave">Queda de elo</p>
          <p className="font-pixel text-sm text-texto">{para}</p>
          <p className="text-[11px] text-suave">A subida continua — próxima é sua.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[90] flex cursor-pointer items-center justify-center bg-black/85 px-4 ${fase === "forma" ? "shake-tela" : ""}`}
      onClick={onFechar}
      role="dialog"
      aria-label="Promoção de elo"
    >
      <div className="relative flex flex-col items-center gap-4 text-center" onClick={(e) => e.stopPropagation()}>
        {fase === "celebra" && (
          <div className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2">
            <PixelBurst cores={[cor, "#ffffff", "#ffe14d"]} qtd={48} seed={hashString(para)} tamanho={220} />
          </div>
        )}

        <p className="font-pixel text-[12px] text-suave">{fase === "quebra" ? "..." : "PROMOÇÃO!"}</p>

        {fase === "quebra" ? (
          <Cacos elo={de} />
        ) : (
          <h2
            className="pop-estouro font-pixel text-3xl"
            style={{ color: cor, textShadow: `0 0 24px ${cor}, 0 0 60px ${cor}66` }}
          >
            {para}
          </h2>
        )}

        {fase === "celebra" && (
          <>
            <p className="desliza-cima text-[12px] text-texto">
              {de} → <span style={{ color: cor }}>{para}</span>
            </p>
            <p className="text-[10px] text-suave/70">clique pra continuar</p>
          </>
        )}
      </div>
    </div>
  );
}
