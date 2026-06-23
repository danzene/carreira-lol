"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MapaPartida from "@/components/MapaPartida";
import ResultadoPartida from "@/components/ResultadoPartida";
import { LOOP } from "@/data/loop";
import type { RoteiroPartida } from "@/engine/partida";
import type { MatchResult } from "@/engine/types";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import { useCareer } from "@/store/careerStore";

type Etapa = "pick" | "partida" | "resultado";

export default function SoloqPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const prepararSoloq = useCareer((s) => s.prepararSoloq);
  const finalizarSoloq = useCareer((s) => s.finalizarSoloq);

  const [campeoes, setCampeoes] = useState<Campeao[]>([]);
  const [etapa, setEtapa] = useState<Etapa>("pick");
  const [championId, setChampionId] = useState("");
  const [seed, setSeed] = useState(0);
  const [roteiro, setRoteiro] = useState<RoteiroPartida | null>(null);
  const [resultado, setResultado] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  useEffect(() => {
    buscarCampeoes().then(setCampeoes).catch(() => {});
  }, []);

  const campMap = useMemo(() => {
    const m: Record<string, Campeao> = {};
    for (const c of campeoes) m[c.id] = c;
    return m;
  }, [campeoes]);

  if (!career) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">Carregando…</main>
    );
  }

  const pool = career.player.pool;
  const semEnergia = career.player.energia < LOOP.custoSoloq;

  function escolher(id: string) {
    const r = prepararSoloq();
    if (!r) return;
    setChampionId(id);
    setSeed(r.seed);
    setRoteiro(r.roteiro);
    setEtapa("partida");
  }

  function aoFim(modificador: number) {
    const r = finalizarSoloq(championId, seed, modificador);
    if (r) {
      setResultado(r);
      setEtapa("resultado");
    }
  }

  function denovo() {
    setChampionId("");
    setRoteiro(null);
    setResultado(null);
    setEtapa("pick");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Soloq</h1>
          <p className="text-xs text-zinc-500">
            Energia: {Math.round(career.player.energia)}/100 · custo {LOOP.custoSoloq}/partida
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-borda hover:text-zinc-200"
        >
          Voltar
        </Link>
      </header>

      {etapa === "pick" && (
        <section className="flex flex-col gap-3">
          {semEnergia ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-300">
              Sem energia para jogar. Volte ao dashboard e <strong>avance a semana</strong> para recuperar.
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Escolha o campeão desta partida:</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {pool.map((m) => {
              const c = campMap[m.championId];
              return (
                <button
                  key={m.championId}
                  type="button"
                  onClick={() => escolher(m.championId)}
                  disabled={semEnergia}
                  className="flex flex-col items-center gap-2 rounded-xl border border-borda bg-painel p-4 transition hover:border-destaque disabled:opacity-40"
                >
                  {c ? (
                    <img src={c.icone} alt={c.nome} width={64} height={64} className="h-16 w-16 rounded-lg" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-borda" />
                  )}
                  <span className="text-sm text-zinc-200">{c?.nome ?? m.championId}</span>
                  <span className="text-[10px] text-zinc-600">Maestria {m.pontos}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {etapa === "partida" && roteiro && (
        <MapaPartida roteiro={roteiro} campeao={campMap[championId]} onFim={aoFim} />
      )}

      {etapa === "resultado" && resultado && (
        <section className="flex flex-col gap-5">
          <ResultadoPartida
            resultado={resultado}
            campeao={campMap[resultado.championId]}
            elo={career.player.rankSoloq.elo}
          />
          <div className="flex justify-center gap-3">
            <Link href="/dashboard" className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
              Voltar ao dashboard
            </Link>
            <button
              type="button"
              onClick={denovo}
              disabled={semEnergia}
              className="rounded-lg bg-destaque px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
            >
              Jogar de novo
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
