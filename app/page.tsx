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
  const user = useAuth((s) => s.user);
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-10 px-5 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="font-pixel text-[10px] tracking-[0.3em] text-ciano">MODO CARREIRA · ESPORTS</span>
        <h1
          className="font-pixel text-3xl leading-[1.6] text-rosa sm:text-5xl sm:leading-[1.6]"
          style={{ textShadow: "3px 3px 0 #0b0617, 6px 6px 0 rgba(25,230,224,0.35)" }}
        >
          CARREIRA
          <br />
          <span className="text-ciano">LoL</span>
        </h1>
      </div>

      <Link
        href="/criar"
        className="w-full border-2 border-rosa bg-rosa/10 px-6 py-4 font-pixel text-[10px] text-rosa shadow-[4px_4px_0_#0b0617] transition hover:bg-rosa hover:text-fundo"
      >
        ▶ NOVA CARREIRA
      </Link>

      {pronto && saves.length > 0 && (
        <section className="w-full">
          <h2 className="mb-3 text-left font-pixel text-[10px] text-suave">CONTINUAR</h2>
          <ul className="flex flex-col gap-2">
            {saves.map((s) => {
              const rota = ROTAS.find((r) => r.chave === s.rota);
              return (
                <li key={s.id} className="flex items-center gap-3 border-2 border-borda bg-painel p-3 text-left">
                  <button type="button" onClick={() => jogar(s.id)} className="flex flex-1 items-center gap-3 text-left">
                    <span className="text-2xl">{rota?.emoji}</span>
                    <span className="flex flex-col">
                      <span className="text-sm text-texto">{s.nome}</span>
                      <span className="text-[10px] text-suave">
                        {rota?.nome} · {s.elo} · Temp. {s.temporada}, Sem. {s.semana}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(s.id, s.nome)}
                    aria-label="Apagar carreira"
                    className="px-2 py-1 text-suave transition hover:text-rosa"
                  >
                    🗑
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col items-center gap-2">
        {user && (
          <p className="text-[10px] text-suave">
            Logado como <span className="text-texto">{user.email}</span> ·{" "}
            <button
              type="button"
              onClick={() => sairConta()}
              className="text-rosa underline-offset-2 transition hover:underline"
            >
              sair da conta
            </button>
          </p>
        )}
        <p className="font-pixel text-[8px] text-borda">FASE 1 · CRIAÇÃO + DASHBOARD</p>
      </div>
    </main>
  );
}
