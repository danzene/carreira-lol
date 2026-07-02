"use client";

import { useRef, useState } from "react";

export type TipoAcao = "treino" | "especial" | "stream" | "mental";

const ACENTO: Record<TipoAcao, { cor: string; brilho: string; emoji: string }> = {
  treino: { cor: "#19e6e0", brilho: "rgba(25,230,224,0.35)", emoji: "🎯" },
  especial: { cor: "#e8762b", brilho: "rgba(232,118,43,0.35)", emoji: "🔥" },
  stream: { cor: "#ff2d7e", brilho: "rgba(255,45,126,0.35)", emoji: "📺" },
  mental: { cor: "#9a6bff", brilho: "rgba(154,107,255,0.35)", emoji: "🧠" },
};

// Vinheta de ação (treino/stream/mental): vídeo SEMPRE enquadrado (corte central em
// proporção fixa, sem tarjas pretas), moldura com glow da cor da ação e scanlines.

export default function AnimacaoAcao({
  tipo,
  titulo,
  legenda,
  onFechar,
}: {
  tipo: TipoAcao;
  titulo: string;
  legenda: string;
  onFechar: () => void;
}) {
  const [pronto, setPronto] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const a = ACENTO[tipo];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onFechar}>
      <div className="desliza-cima w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        {/* moldura com glow */}
        <div
          className="border-2 bg-painel p-3"
          style={{ borderColor: a.cor, boxShadow: `0 0 24px ${a.brilho}, inset 0 0 12px rgba(0,0,0,0.6)` }}
        >
          <p className="mb-2 flex items-center justify-center gap-2 text-center font-pixel text-[12px]" style={{ color: a.cor }}>
            <span>{a.emoji}</span> {titulo}
          </p>

          {/* quadro: corte central SEM tarjas (object-cover em proporção fixa) */}
          <div className="relative overflow-hidden border-2" style={{ borderColor: `${a.cor}66` }}>
            <video
              ref={videoRef}
              src={`/carreira/tarefas/${tipo}.mp4`}
              autoPlay
              muted
              playsInline
              onLoadedData={() => setCarregou(true)}
              onEnded={() => setPronto(true)}
              onError={() => setPronto(true)}
              className="block aspect-square w-full object-cover transition-opacity duration-300"
              style={{ opacity: carregou ? 1 : 0 }}
            />
            {!carregou && (
              <div className="absolute inset-0 grid place-items-center bg-fundo">
                <span className="animate-pulse text-3xl">{a.emoji}</span>
              </div>
            )}
            {/* scanlines CRT */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px)" }}
            />
            {/* cantos pixel */}
            <span className="absolute left-1 top-1 h-2 w-2 border-l-2 border-t-2" style={{ borderColor: a.cor }} />
            <span className="absolute right-1 top-1 h-2 w-2 border-r-2 border-t-2" style={{ borderColor: a.cor }} />
            <span className="absolute bottom-1 left-1 h-2 w-2 border-b-2 border-l-2" style={{ borderColor: a.cor }} />
            <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2" style={{ borderColor: a.cor }} />
          </div>

          <p className="mt-2 text-center font-pixel text-[11px] text-texto">{legenda}</p>

          <button
            type="button"
            onClick={onFechar}
            className="mt-3 w-full border-2 py-2 font-pixel text-[11px] transition hover:brightness-150"
            style={{ borderColor: a.cor, color: a.cor, background: `${a.cor}14` }}
          >
            {pronto ? "CONTINUAR ▸" : "PULAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
