"use client";

import type { PostFeed } from "@/engine/feed";

// Card de post do feed (reutilizado na tela FEED e no recap semanal).

const COR_ARQ: Record<string, string> = {
  analista: "#19e6e0",
  torcedor: "#ffd34d",
  hater: "#ff5a5a",
  noticia: "#9a90c0",
  meme: "#2fd66e",
  rival: "#ff2d7e",
};

export default function PostFeedCard({ post, compacto = false }: { post: PostFeed; compacto?: boolean }) {
  const cor = COR_ARQ[post.autor.arquetipo] ?? "#9a90c0";
  return (
    <div className={`border-2 border-borda bg-painel ${compacto ? "p-2" : "p-3"}`}>
      <div className="flex items-center gap-2">
        {/* avatar pixel 16px */}
        <span
          className="grid h-6 w-6 shrink-0 place-items-center border text-[13px]"
          style={{ borderColor: cor, background: `${cor}1a` }}
        >
          {post.autor.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px]">
            <span className="text-texto">{post.autor.nome}</span>{" "}
            <span style={{ color: cor }}>{post.autor.handle}</span>
          </p>
          {!compacto && (
            <p className="text-[9px] text-suave">
              T{post.temporada} · Semana {post.semana}
            </p>
          )}
        </div>
      </div>
      <p className={`mt-1.5 leading-relaxed text-texto ${compacto ? "text-[11px]" : "text-[12px]"}`}>{post.texto}</p>
      <p className="mt-1.5 text-[10px] text-suave">
        <span className="text-rosa">♥</span> {post.likes} · <span className="text-ciano">↻</span> {Math.round(post.likes / 4)}
      </p>
    </div>
  );
}
