"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DraftBoard, { type JogarInfo } from "@/components/DraftBoard";
import Partida from "@/components/Partida";
import ResultadoPartida from "@/components/ResultadoPartida";
import { bonusEquipamentos } from "@/engine/economia";
import type { MatchResult } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

type Fase = "draft" | "partida" | "resultado";

export default function DraftPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const aplicarPartida = useCareer((s) => s.aplicarPartida);

  const [fase, setFase] = useState<Fase>("draft");
  const [info, setInfo] = useState<JogarInfo | null>(null);
  const [resultado, setResultado] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  function aoJogar(i: JogarInfo) {
    setInfo(i);
    setFase("partida");
  }
  function aoFim(r: MatchResult) {
    aplicarPartida(r);
    setResultado(r);
    setFase("resultado");
  }
  function denovo() {
    setInfo(null);
    setResultado(null);
    setFase("draft");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">
            {fase === "draft" ? "DRAFT" : fase === "partida" ? "PARTIDA" : "RESULTADO"}
          </h1>
          <p className="mt-1 text-[10px] text-suave">Draft → auto-battle → progressão</p>
        </div>
        <Link
          href="/dashboard"
          className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto"
        >
          Voltar
        </Link>
      </header>

      {fase === "draft" && (
        <DraftBoard
          comfort={career.player.pool.map((p) => p.championId)}
          reputacao={career.player.reputacao}
          rota={career.player.rota}
          onJogar={aoJogar}
        />
      )}

      {fase === "partida" && info && (
        <Partida
          player={career.player}
          ctx={{
            championId: info.championId,
            forcaMetaCampeao: info.forcaMetaCampeao,
            comp: info.comp,
            compInimigo: info.compInimigo,
            bonusAtributos: bonusEquipamentos(career.equipamentos),
          }}
          icone={info.icone}
          onFim={aoFim}
        />
      )}

      {fase === "resultado" && resultado && (
        <div className="flex flex-col gap-4">
          <ResultadoPartida resultado={resultado} icone={info?.icone} elo={career.player.rankSoloq.elo} />
          <div className="flex justify-center gap-3">
            <Link href="/dashboard" className="px-4 py-2 text-sm text-suave transition hover:text-texto">
              Dashboard
            </Link>
            <button
              type="button"
              onClick={denovo}
              className="border-2 border-rosa bg-rosa/10 px-6 py-2 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
            >
              JOGAR DE NOVO
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
