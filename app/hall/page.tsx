"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CONQUISTAS } from "@/engine/conquistas";
import { recordsVazios } from "@/engine/records";
import { corElo } from "@/data/juice";
import { useCareer } from "@/store/careerStore";

// 🏛️ Hall da Carreira: mural de troféus pixel com marcos permanentes — recordes
// pessoais, elos alcançados pela primeira vez, títulos e conquistas.

function Placa({ emoji, rotulo, valor }: { emoji: string; rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col items-center gap-1 border-2 border-borda bg-painel p-3 text-center">
      <span className="text-2xl">{emoji}</span>
      <span className="font-pixel text-sm text-ciano">{valor}</span>
      <span className="text-[10px] text-suave">{rotulo}</span>
    </div>
  );
}

export default function HallPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregar = useCareer((s) => s.recarregarAtual);

  useEffect(() => {
    if (!career && !recarregar()) router.replace("/");
  }, [career, recarregar, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const rec = career.records ?? recordsVazios();
  const titulos = career.titulosInternacionais ?? [];
  const conquistadas = new Set(career.conquistas ?? []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">🏛️ HALL DA CARREIRA</h1>
          <p className="mt-1 text-[11px] text-suave">
            {career.player.nome} · marcos permanentes da jornada
          </p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* recordes pessoais */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">RECORDES PESSOAIS</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Placa emoji="🔥" rotulo="maior sequência de vitórias" valor={`${rec.maiorStreak}`} />
          <Placa emoji="⚔️" rotulo="mais abates numa partida" valor={`${rec.maisKills}`} />
          <Placa emoji="🌟" rotulo="melhor nota" valor={rec.melhorNota > 0 ? rec.melhorNota.toFixed(1) : "—"} />
          <Placa
            emoji="🎯"
            rotulo="melhor KDA"
            valor={rec.melhorKda ? `${rec.melhorKda.k}/${rec.melhorKda.d}/${rec.melhorKda.a}` : "—"}
          />
        </div>
      </section>

      {/* títulos internacionais */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">TÍTULOS</h2>
        {titulos.length === 0 ? (
          <p className="border-2 border-borda bg-painel/40 p-3 text-center text-[11px] text-suave">
            Nenhum título internacional ainda — o Worlds espera por você. 🌍
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {titulos.map((t, i) => (
              <span key={i} className="border-2 border-amber-300 bg-amber-300/10 px-3 py-2 font-pixel text-[11px] text-amber-300">
                🏆 {t}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* elos alcançados pela primeira vez */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">ELOS ALCANÇADOS</h2>
        <div className="flex flex-wrap gap-1.5">
          {rec.elosAlcancados.length === 0 ? (
            <p className="text-[11px] text-suave">Jogue soloq pra registrar sua escalada.</p>
          ) : (
            rec.elosAlcancados.map((e) => (
              <span key={e} className="border-2 px-2 py-1 font-pixel text-[10px]" style={{ borderColor: corElo(e), color: corElo(e) }}>
                {e}
              </span>
            ))
          )}
        </div>
      </section>

      {/* conquistas (mural) */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">
          CONQUISTAS · {conquistadas.size}/{CONQUISTAS.length}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CONQUISTAS.map((c) => {
            const tem = conquistadas.has(c.id);
            return (
              <div
                key={c.id}
                className={`border-2 p-2.5 ${tem ? "border-amber-300/60 bg-amber-300/5" : "border-borda bg-painel/40 opacity-60"}`}
              >
                <p className="text-lg">{tem ? c.emoji : "🔒"}</p>
                <p className={`mt-1 font-pixel text-[10px] ${tem ? "text-amber-300" : "text-suave"}`}>{c.nome}</p>
                <p className="mt-0.5 text-[10px] text-suave">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
