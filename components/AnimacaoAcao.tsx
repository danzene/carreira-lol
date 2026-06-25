"use client";

import { useRef, useState } from "react";

export type TipoAcao = "treino" | "especial" | "stream" | "mental";

const ACENTO: Record<TipoAcao, string> = {
  treino: "#19e6e0",
  especial: "#e8762b",
  stream: "#ff2d7e",
  mental: "#9a6bff",
};

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const acento = ACENTO[tipo];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/85 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-md border-2 bg-painel p-4"
        style={{ borderColor: acento }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-center font-pixel text-[11px]" style={{ color: acento }}>
          {titulo}
        </p>
        <video
          ref={videoRef}
          src={`/carreira/tarefas/${tipo}.mp4`}
          autoPlay
          muted
          playsInline
          onEnded={() => setPronto(true)}
          onError={() => setPronto(true)}
          className="block max-h-[60vh] w-full border-2 border-borda bg-black object-contain"
        />
        <p className="mt-2 text-center text-sm text-texto">{legenda}</p>
        <button
          type="button"
          onClick={onFechar}
          className="mt-3 w-full border-2 py-2 font-pixel text-[10px] transition"
          style={{ borderColor: acento, color: acento }}
        >
          {pronto ? "CONTINUAR" : "PULAR"}
        </button>
      </div>
    </div>
  );
}
