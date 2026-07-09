"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EXPEDICAO } from "@/data/expedicao";
import { grindDisponivel } from "@/engine/grind";
import { useCareer } from "@/store/careerStore";
import ExpedicaoView from "@/components/grind/ExpedicaoView";

// 🗺️ Rota dedicada da Expedição (modo ATIVO). Tela FOCADA — sair daqui encerra a corrida
// (o ExpedicaoView embolsa o loot garantido no unmount). Kill switch: grind global + EXPEDICAO.
export default function ExpedicaoPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregar = useCareer((s) => s.recarregarAtual);

  useEffect(() => {
    if (!career && !recarregar()) router.replace("/");
  }, [career, recarregar, router]);

  useEffect(() => {
    if (career && (!grindDisponivel(career) || !EXPEDICAO.habilitado)) router.replace("/dashboard");
  }, [career, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }
  return <ExpedicaoView />;
}
