"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PostFeedCard from "@/components/PostFeedCard";
import { useCareer } from "@/store/careerStore";

// 📱 FEED: o mundo reagindo à sua carreira (posts procedurais por semana).

export default function FeedPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregar = useCareer((s) => s.recarregarAtual);
  const marcarFeedVisto = useCareer((s) => s.marcarFeedVisto);

  useEffect(() => {
    if (!career && !recarregar()) router.replace("/");
  }, [career, recarregar, router]);

  useEffect(() => {
    marcarFeedVisto(); // abriu o feed → some o badge
  }, [marcarFeedVisto]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const posts = career.feed ?? [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">📱 FEED</h1>
          <p className="mt-1 text-[11px] text-suave">O mundo tá de olho na sua carreira</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {posts.length === 0 ? (
        <div className="border-2 border-borda bg-painel/40 p-6 text-center">
          <p className="text-2xl">🦗</p>
          <p className="mt-2 text-[12px] text-suave">
            Silêncio total por enquanto. Jogue, vença (ou perca feio) e avance a semana — o mundo vai comentar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((p) => (
            <PostFeedCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </main>
  );
}
