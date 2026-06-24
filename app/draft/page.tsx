"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DraftBoard, { type JogarInfo } from "@/components/DraftBoard";
import Partida from "@/components/Partida";
import ResultadoPartida from "@/components/ResultadoPartida";
import { timeDe } from "@/data/times";
import { bonusEquipamentos } from "@/engine/economia";
import { forcaTimeDe, proximoConfrontoJogador } from "@/engine/liga";
import type { MatchResult } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

type Fase = "draft" | "partida" | "resultado";

function DraftFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const oficial = params.get("oficial") === "1";
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const aplicarPartida = useCareer((s) => s.aplicarPartida);
  const aplicarPartidaOficial = useCareer((s) => s.aplicarPartidaOficial);

  const [fase, setFase] = useState<Fase>("draft");
  const [info, setInfo] = useState<JogarInfo | null>(null);
  const [resultado, setResultado] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  const adversarioId = oficial && career ? proximoConfrontoJogador(career.liga) : null;

  // Modo oficial sem partida pendente → volta pra liga.
  useEffect(() => {
    if (oficial && career && fase === "draft" && !proximoConfrontoJogador(career.liga)) {
      router.replace("/liga");
    }
  }, [oficial, career, fase, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const adversario = adversarioId ? timeDe(adversarioId) : null;

  function aoJogar(i: JogarInfo) {
    setInfo(i);
    setFase("partida");
  }
  function aoFim(r: MatchResult) {
    if (oficial) aplicarPartidaOficial(r);
    else aplicarPartida(r);
    setResultado(r);
    setFase("resultado");
  }
  function denovo() {
    setInfo(null);
    setResultado(null);
    setFase("draft");
  }

  const titulo =
    fase === "draft" ? (oficial ? "PARTIDA OFICIAL" : "DRAFT") : fase === "partida" ? "PARTIDA" : "RESULTADO";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">{titulo}</h1>
          <p className="mt-1 text-[10px] text-suave">
            {oficial && adversario ? `vs ${adversario.nome}` : "Draft → auto-battle → progressão"}
          </p>
        </div>
        <Link
          href={oficial ? "/liga" : "/dashboard"}
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
          patch={career.patchVigente}
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
            forcaTimeAliado: oficial && career.contratoAtual ? forcaTimeDe(career.contratoAtual.timeId) : undefined,
            forcaTimeInimigo: oficial && adversarioId ? forcaTimeDe(adversarioId) : undefined,
          }}
          icone={info.icone}
          onFim={aoFim}
        />
      )}

      {fase === "resultado" && resultado && (
        <div className="flex flex-col gap-4">
          <ResultadoPartida resultado={resultado} icone={info?.icone} elo={career.player.rankSoloq.elo} />
          <div className="flex justify-center gap-3">
            {oficial ? (
              <Link
                href="/liga"
                className="border-2 border-rosa bg-rosa/10 px-6 py-2 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
              >
                VOLTAR À LIGA
              </Link>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function DraftPage() {
  return (
    <Suspense
      fallback={<main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>}
    >
      <DraftFlow />
    </Suspense>
  );
}
