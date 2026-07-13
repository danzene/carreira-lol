"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import GamingHouseView from "@/components/casa/GamingHouseView";
import { useCareer } from "@/store/careerStore";

// 🏠 Gaming House — o treino profundo (substitui os 4 botões vagos do painel semanal).
export default function CasaPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregar = useCareer((s) => s.recarregarAtual);

  useEffect(() => {
    if (!career && !recarregar()) router.replace("/");
  }, [career, recarregar, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">🏠 GAMING HOUSE</h1>
          <p className="mt-1 text-[11px] text-suave">onde treinar · com que intensidade · com que foco — o treino agora é decisão</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>
      <GamingHouseView />
    </main>
  );
}
