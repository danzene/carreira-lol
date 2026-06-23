"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROTAS } from "@/data/config";
import { listarResumos, type SlotResumo } from "@/store/saves";
import { useCareer } from "@/store/careerStore";
import { useAuth } from "@/store/authStore";

export default function Home() {
  const router = useRouter();
  const carregar = useCareer((s) => s.carregar);
  const apagar = useCareer((s) => s.apagar);
  const sairConta = useAuth((s) => s.sairConta);
  const [saves, setSaves] = useState<SlotResumo[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setSaves(listarResumos());
    setPronto(true);
  }, []);

  function jogar(id: string) {
    if (carregar(id)) router.push("/dashboard");
  }

  function remover(id: string, nome: string) {
    if (window.confirm(`Apagar a carreira de ${nome}? Isso não pode ser desfeito.`)) {
      apagar(id);
      setSaves(listarResumos());
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-10 overflow-hidden px-5 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-destaque/20 blur-3xl"
      />

      <button
        type="button"
        onClick={() => sairConta()}
        className="absolute right-4 top-4 z-10 rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-borda hover:text-zinc-200"
      >
        Sair da conta
      </button>

      <div className="relative flex flex-col items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-destaque2">
          Modo Carreira · Esports
        </span>
        <h1 className="bg-gradient-to-r from-destaque via-fuchsia-400 to-destaque2 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-7xl">
          Carreira LoL
        </h1>
        <p className="max-w-md text-balance text-sm text-zinc-400 sm:text-base">
          Do zero na soloq ao Worlds. Crie seu pro player e construa uma lenda.
        </p>
      </div>

      <Link
        href="/criar"
        className="relative w-full max-w-xs rounded-xl bg-destaque px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-destaque/30 transition hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-destaque2 focus:ring-offset-2 focus:ring-offset-fundo"
      >
        Nova Carreira
      </Link>

      {pronto && saves.length > 0 && (
        <section className="relative w-full">
          <h2 className="mb-3 text-left text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Continuar
          </h2>
          <ul className="flex flex-col gap-2">
            {saves.map((s) => {
              const rota = ROTAS.find((r) => r.chave === s.rota);
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-borda bg-painel p-3 text-left"
                >
                  <button
                    type="button"
                    onClick={() => jogar(s.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span className="text-2xl">{rota?.emoji}</span>
                    <span className="flex flex-col">
                      <span className="font-semibold text-zinc-100">{s.nome}</span>
                      <span className="text-xs text-zinc-500">
                        {rota?.nome} · {s.elo} · Temp. {s.temporada}, Sem. {s.semana}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(s.id, s.nome)}
                    aria-label="Apagar carreira"
                    className="rounded-lg px-2 py-1 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    🗑
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="relative text-xs text-zinc-600">Fase 1 — criação + dashboard</p>
    </main>
  );
}
