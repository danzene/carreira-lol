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
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">Carregando…</main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-100">Investimentos</h1>
        <Link
          href="/dashboard"
          className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-borda hover:text-zinc-200"
        >
          Voltar
        </Link>
      </header>

      <Loja career={career} />
    </main>
  );
}
