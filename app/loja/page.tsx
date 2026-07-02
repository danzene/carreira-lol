"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loja from "@/components/Loja";
import { useCareer } from "@/store/careerStore";

export default function LojaPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-pixel text-sm text-ciano">LOJA</h1>
        <Link
          href="/dashboard"
          className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto"
        >
          Voltar
        </Link>
      </header>
      <Loja career={career} />
    </main>
  );
}
