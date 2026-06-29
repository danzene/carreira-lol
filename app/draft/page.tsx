"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DraftBoard, { type JogarInfo } from "@/components/DraftBoard";
import EfeitosLendas from "@/components/EfeitosLendas";
import Partida from "@/components/Partida";
import ResultadoPartida from "@/components/ResultadoPartida";
import { FEARLESS_JANELA, mod } from "@/data/opcoes";
import { timeDe } from "@/data/times";
import { bonusEquipamentos } from "@/engine/economia";
import { efeitoLendas } from "@/engine/gacha";
import { efeitoItens } from "@/engine/itens";
import { forcaTimeDe, proximoConfrontoJogador } from "@/engine/liga";
import { proximoConfrontoTorneio } from "@/engine/internacional";
import type { AtributoKey, MatchResult } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import { itensEquipadosDe, useInventory } from "@/store/inventoryStore";

type Fase = "draft" | "partida" | "resultado";

function DraftFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const oficial = params.get("oficial") === "1";
  const evento = params.get("evento") === "1";
  const internacional = params.get("internacional") === "1";
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const aplicarPartida = useCareer((s) => s.aplicarPartida);
  const aplicarPartidaOficial = useCareer((s) => s.aplicarPartidaOficial);
  const aplicarPartidaEvento = useCareer((s) => s.aplicarPartidaEvento);
  const aplicarPartidaTorneio = useCareer((s) => s.aplicarPartidaTorneio);
  const invItens = useInventory((s) => s.itens);
  const invEquip = useInventory((s) => s.equipado);

  const [fase, setFase] = useState<Fase>("draft");
  const [info, setInfo] = useState<JogarInfo | null>(null);
  const [resultado, setResultado] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  const advOficial = oficial && career ? proximoConfrontoJogador(career.liga) : null;
  const advTorneio = internacional && career ? proximoConfrontoTorneio(career.torneioAtual) : null;
  const adversarioId = advOficial ?? advTorneio;

  // Fearless: campeões usados nas últimas partidas ficam fora do draft.
  const proibidos = useMemo(
    () => (career?.opcoes?.fearless ? career.historicoPartidas.slice(0, FEARLESS_JANELA).map((m) => m.championId) : []),
    [career],
  );

  const equipadosItens = useMemo(() => itensEquipadosDe(invItens, invEquip), [invItens, invEquip]);
  const efItens = useMemo(() => efeitoItens(equipadosItens), [equipadosItens]);

  // Modo oficial sem partida pendente → volta pra liga.
  useEffect(() => {
    if (oficial && career && fase === "draft" && !proximoConfrontoJogador(career.liga)) {
      router.replace("/liga");
    }
  }, [oficial, career, fase, router]);

  // Modo evento sem evento ativo → volta pro dashboard.
  useEffect(() => {
    if (evento && career && fase === "draft" && !career.eventoAtual) router.replace("/dashboard");
  }, [evento, career, fase, router]);

  // Modo internacional sem torneio/partida pendente → volta pro dashboard.
  useEffect(() => {
    if (internacional && career && fase === "draft" && !proximoConfrontoTorneio(career.torneioAtual)) {
      router.replace("/dashboard");
    }
  }, [internacional, career, fase, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const adversario = adversarioId ? timeDe(adversarioId) : null;

  // bônus das lendas equipadas: atributos somam aos periféricos; comp ajuda no draft.
  const ef = efeitoLendas(career);
  const bonusAtributos: Partial<Record<AtributoKey, number>> = { ...bonusEquipamentos(career.equipamentos) };
  (Object.keys(ef.atributos) as AtributoKey[]).forEach((k) => {
    bonusAtributos[k] = (bonusAtributos[k] ?? 0) + (ef.atributos[k] ?? 0);
  });
  (Object.keys(efItens.atributos) as AtributoKey[]).forEach((k) => {
    bonusAtributos[k] = (bonusAtributos[k] ?? 0) + (efItens.atributos[k] ?? 0);
  });

  function aoJogar(i: JogarInfo) {
    setInfo(i);
    setFase("partida");
  }
  function aoFim(r: MatchResult) {
    if (internacional) aplicarPartidaTorneio(r);
    else if (evento) aplicarPartidaEvento(r);
    else if (oficial) aplicarPartidaOficial(r);
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
    fase === "draft"
      ? internacional
        ? (career.torneioAtual?.nome ?? "INTERNACIONAL").toUpperCase()
        : evento
          ? "PARTIDA-EVENTO"
          : oficial
            ? "PARTIDA OFICIAL"
            : "DRAFT"
      : fase === "partida"
        ? "PARTIDA"
        : "RESULTADO";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">{titulo}</h1>
          <p className="mt-1 text-[10px] text-suave">
            {internacional && adversario
              ? `vs ${adversario.nome}`
              : evento && career.eventoAtual
                ? career.eventoAtual.nome
                : oficial && adversario
                  ? `vs ${adversario.nome}`
                  : "Draft → auto-battle → progressão"}
          </p>
        </div>
        <Link
          href={oficial ? "/liga" : internacional ? "/torneio" : "/dashboard"}
          className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto"
        >
          Voltar
        </Link>
      </header>

      {fase === "draft" && (
        <>
          <EfeitosLendas career={career} itens={equipadosItens} />
          <DraftBoard
            comfort={career.player.pool.map((p) => p.championId)}
            maestria={Object.fromEntries(career.player.pool.map((p) => [p.championId, p.pontos]))}
            reputacao={career.player.reputacao}
            rota={career.player.rota}
            patch={career.patchVigente}
            proibidos={proibidos}
            onJogar={aoJogar}
          />
        </>
      )}

      {fase === "partida" && info && (
        <Partida
          player={career.player}
          ctx={{
            championId: info.championId,
            forcaMetaCampeao: info.forcaMetaCampeao,
            comp: info.comp + ef.bonusComp + efItens.bonusComp,
            compInimigo: info.compInimigo,
            bonusAtributos,
            forcaTimeAliado: (oficial || internacional) && career.contratoAtual ? forcaTimeDe(career.contratoAtual.timeId) : undefined,
            forcaTimeInimigo: adversarioId ? forcaTimeDe(adversarioId) : undefined,
            bonusInimigo: mod(career.opcoes).forcaInimigo + (evento && career.eventoAtual ? career.eventoAtual.bonusInimigo : 0),
          }}
          times={{ azul: info.timeAzul, vermelho: info.timeVermelho }}
          onFim={aoFim}
        />
      )}

      {fase === "resultado" && resultado && (
        <div className="flex flex-col gap-4">
          <ResultadoPartida resultado={resultado} icone={info?.icone} elo={career.player.rankSoloq.elo} />
          <div className="flex justify-center gap-3">
            {internacional ? (
              <Link
                href="/torneio"
                className="border-2 border-amber-300 bg-amber-300/10 px-6 py-2 font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
              >
                VOLTAR AO TORNEIO
              </Link>
            ) : evento ? (
              <Link
                href="/dashboard"
                className="border-2 border-amber-300 bg-amber-300/10 px-6 py-2 font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
              >
                VOLTAR
              </Link>
            ) : oficial ? (
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
