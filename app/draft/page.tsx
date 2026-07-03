"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DraftBoard, { type JogarInfo } from "@/components/DraftBoard";
import type { EstadoDraft } from "@/engine/draft";
import EfeitosLendas from "@/components/EfeitosLendas";
import ItemVisual, { classeBrilho, corRaridade, estiloCartaItem } from "@/components/ItemVisual";
import Partida from "@/components/Partida";
import ResultadoPartida from "@/components/ResultadoPartida";
import { LOOP } from "@/data/loop";
import { FEARLESS_JANELA, mod } from "@/data/opcoes";
import { timeDe } from "@/data/times";
import { energiaAgora } from "@/engine/tempo";
import { dificuldadeSoloq } from "@/engine/elo";
import { efeitoLendas } from "@/engine/gacha";
import { efeitoItens } from "@/engine/itens";
import { forcaTimeDe, proximoConfrontoJogador } from "@/engine/liga";
import { proximoConfrontoTorneio } from "@/engine/internacional";
import { ajustarCtxProva, defModificador, gerarProvaSemanal, podeJogarProva, semanaISO } from "@/engine/prova";
import type { AtributoKey, MatchResult } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import { useDraftFlow } from "@/store/draftFlowStore";
import { itensEquipadosDe, useInventory } from "@/store/inventoryStore";

function DraftFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const oficial = params.get("oficial") === "1";
  const evento = params.get("evento") === "1";
  const internacional = params.get("internacional") === "1";
  const ehProva = params.get("prova") === "1";
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const aplicarPartida = useCareer((s) => s.aplicarPartida);
  const aplicarPartidaOficial = useCareer((s) => s.aplicarPartidaOficial);
  const aplicarPartidaEvento = useCareer((s) => s.aplicarPartidaEvento);
  const aplicarPartidaTorneio = useCareer((s) => s.aplicarPartidaTorneio);
  const aplicarPartidaProva = useCareer((s) => s.aplicarPartidaProva);
  const invItens = useInventory((s) => s.itens);
  const invEquip = useInventory((s) => s.equipado);
  const ultimoDrop = useInventory((s) => s.ultimoDrop);
  const limparDrop = useInventory((s) => s.limparDrop);

  // fluxo persiste em store transiente: navegar pra outra tela e voltar NÃO zera o draft/partida
  const chaveFlow = ehProva ? "prova" : internacional ? "internacional" : evento ? "evento" : oficial ? "oficial" : "soloq";
  const flowChave = useDraftFlow((s) => s.chave);
  const fase = useDraftFlow((s) => (s.chave === chaveFlow ? s.fase : "draft"));
  const info = useDraftFlow((s) => (s.chave === chaveFlow ? s.info : null));
  const resultado = useDraftFlow((s) => (s.chave === chaveFlow ? s.resultado : null));
  const seedPartida = useDraftFlow((s) => (s.chave === chaveFlow ? s.seed : null));
  const draftSalvo = useDraftFlow((s) => (s.chave === chaveFlow ? s.draft : null));
  const atualizarFlow = useDraftFlow((s) => s.atualizar);
  const resetarFlow = useDraftFlow((s) => s.resetar);

  // trocou de modo (soloq → oficial etc.) → fluxo antigo não vale mais
  useEffect(() => {
    if (flowChave !== chaveFlow) resetarFlow(chaveFlow);
  }, [flowChave, chaveFlow, resetarFlow]);

  const salvarDraft = useCallback(
    (e: EstadoDraft) => atualizarFlow({ chave: chaveFlow, draft: e }),
    [atualizarFlow, chaveFlow],
  );

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

  // Prova Semanal: mesma prova pra todo mundo (derivada da semana ISO real)
  const provaAtiva = useMemo(() => (ehProva ? gerarProvaSemanal(semanaISO(Date.now())) : undefined), [ehProva]);
  const semLendas = !!provaAtiva?.modificadores.includes("sem_lendas");
  const semItens = !!provaAtiva?.modificadores.includes("sem_itens");

  // prova esgotada/finalizada → volta pra tela da prova
  useEffect(() => {
    if (ehProva && career && fase === "draft" && !podeJogarProva(career, semanaISO(Date.now()))) router.replace("/prova");
  }, [ehProva, career, fase, router]);

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

  // bônus de gear: lendas equipadas + itens RPG. A Prova pode DESLIGAR cada um (modificador).
  const ef = efeitoLendas(career);
  const bonusAtributos: Partial<Record<AtributoKey, number>> = {};
  if (!semLendas) {
    (Object.keys(ef.atributos) as AtributoKey[]).forEach((k) => {
      bonusAtributos[k] = (bonusAtributos[k] ?? 0) + (ef.atributos[k] ?? 0);
    });
  }
  if (!semItens) {
    (Object.keys(efItens.atributos) as AtributoKey[]).forEach((k) => {
      bonusAtributos[k] = (bonusAtributos[k] ?? 0) + (efItens.atributos[k] ?? 0);
    });
  }

  const podeReplay = energiaAgora(career, Date.now()) >= LOOP.custoSoloq;

  function aoJogar(i: JogarInfo) {
    limparDrop(); // zera o drop antes da partida (só conta o desta)
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    atualizarFlow({ chave: chaveFlow, fase: "partida", info: i, seed, aplicado: false });
  }
  function aoFim(r: MatchResult) {
    // partida restaurada (saiu e voltou) NUNCA aplica duas vezes
    if (!useDraftFlow.getState().aplicado) {
      if (ehProva) aplicarPartidaProva(r);
      else if (internacional) aplicarPartidaTorneio(r);
      else if (evento) aplicarPartidaEvento(r);
      else if (oficial) aplicarPartidaOficial(r);
      else aplicarPartida(r);
    }
    atualizarFlow({ fase: "resultado", resultado: r, aplicado: true });
  }
  function denovo() {
    resetarFlow(chaveFlow);
  }

  const titulo =
    fase === "draft"
      ? ehProva
        ? "🏁 PROVA SEMANAL"
        : internacional
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
          <p className="mt-1 text-[11px] text-suave">
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
          href={ehProva ? "/prova" : oficial ? "/liga" : internacional ? "/torneio" : "/dashboard"}
          className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto"
        >
          Voltar
        </Link>
      </header>

      {provaAtiva && fase === "draft" && (
        <div className="flex flex-wrap gap-2">
          {provaAtiva.modificadores.map((m) => {
            const d = defModificador(m);
            return (
              <span key={m} className="border-2 border-amber-300/60 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-300" title={d.desc}>
                {d.emoji} {d.nome}
                {m === "so_classe" && provaAtiva.classeDaSemana ? ` (${provaAtiva.classeDaSemana})` : ""}
              </span>
            );
          })}
        </div>
      )}

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
            modo={oficial || internacional ? "competitivo" : "soloq"}
            prova={provaAtiva}
            draftInicial={draftSalvo ?? undefined}
            onDraft={salvarDraft}
            onJogar={aoJogar}
          />
        </>
      )}

      {fase === "partida" && info && (
        <Partida
          player={career.player}
          ctx={(() => {
            const base = {
              championId: info.championId,
              forcaMetaCampeao: info.forcaMetaCampeao,
              comp: info.comp + (semLendas ? 0 : ef.bonusComp) + (semItens ? 0 : efItens.bonusComp),
              compInimigo: info.compInimigo,
              bonusAtributos,
              forcaTimeAliado: (oficial || internacional) && career.contratoAtual ? forcaTimeDe(career.contratoAtual.timeId) : undefined,
              forcaTimeInimigo: adversarioId ? forcaTimeDe(adversarioId) : undefined,
              bonusInimigo: mod(career.opcoes).forcaInimigo + (evento && career.eventoAtual ? career.eventoAtual.bonusInimigo : 0),
              dificuldadeElo: !oficial && !internacional && !evento && !ehProva ? dificuldadeSoloq(career.player.rankSoloq.elo) : 0,
              counterLane: info.counterLane,
              counterComp: info.counterComp,
            };
            return provaAtiva ? ajustarCtxProva(base, provaAtiva) : base; // modificadores honrados no engine
          })()}
          times={{ azul: info.timeAzul, vermelho: info.timeVermelho }}
          seed={seedPartida ?? undefined}
          onFim={aoFim}
        />
      )}

      {fase === "resultado" && resultado && (
        <div className="flex flex-col gap-4">
          {ehProva ? (
            // resultado da PROVA: sem LP/CoinPoints (partida lateral) — só o que conta pro score
            <div className={`border-2 p-5 text-center ${resultado.vitoria ? "border-ciano bg-ciano/10" : "border-rosa bg-rosa/10"}`}>
              <p className={`font-pixel text-xl ${resultado.vitoria ? "text-ciano" : "text-rosa"}`}>
                {resultado.vitoria ? "VITÓRIA" : "DERROTA"}
              </p>
              <p className="mt-2 text-[12px] text-texto">
                Nota <span className="font-pixel text-ciano">{resultado.notaPerformance.toFixed(1)}</span> · KDA{" "}
                <span className="font-pixel">{resultado.kda.k}/{resultado.kda.d}/{resultado.kda.a}</span>
              </p>
              <p className="mt-2 font-pixel text-[10px] text-amber-300">
                🏁 PARTIDA {career.prova?.resultados.length ?? 0}/3 DA PROVA
              </p>
            </div>
          ) : (
            <ResultadoPartida resultado={resultado} icone={info?.icone} elo={career.player.rankSoloq.elo} atributos={career.player.atributos} />
          )}
          {ultimoDrop && (
            <div className={`item-card border-2 bg-painel p-3 ${classeBrilho(ultimoDrop.raridade)}`} style={estiloCartaItem(ultimoDrop.raridade)}>
              <p className="mb-2 text-center font-pixel text-[10px]" style={{ color: corRaridade(ultimoDrop.raridade) }}>
                🎁 ITEM DROPADO!
              </p>
              <ItemVisual item={ultimoDrop} />
              <Link
                href="/inventario"
                className="mt-3 block border-2 border-borda py-1.5 text-center font-pixel text-[10px] text-suave transition hover:border-ciano hover:text-ciano"
              >
                VER NO INVENTÁRIO
              </Link>
            </div>
          )}
          <div className="flex justify-center gap-3">
            {ehProva ? (
              (career.prova?.resultados.length ?? 0) < 3 ? (
                <button
                  type="button"
                  onClick={denovo}
                  className="border-2 border-amber-300 bg-amber-300/10 px-6 py-2 font-pixel text-[11px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
                >
                  ▶ PRÓXIMA PARTIDA ({(career.prova?.resultados.length ?? 0) + 1}/3)
                </button>
              ) : (
                <Link
                  href="/prova"
                  className="border-2 border-amber-300 bg-amber-300/10 px-6 py-2 font-pixel text-[11px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
                >
                  🏁 VER PLACAR DA PROVA
                </Link>
              )
            ) : internacional ? (
              <Link
                href="/torneio"
                className="border-2 border-amber-300 bg-amber-300/10 px-6 py-2 font-pixel text-[11px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
              >
                VOLTAR AO TORNEIO
              </Link>
            ) : evento ? (
              <Link
                href="/dashboard"
                className="border-2 border-amber-300 bg-amber-300/10 px-6 py-2 font-pixel text-[11px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
              >
                VOLTAR
              </Link>
            ) : oficial ? (
              <Link
                href="/liga"
                className="border-2 border-rosa bg-rosa/10 px-6 py-2 font-pixel text-[11px] text-rosa transition hover:bg-rosa hover:text-fundo"
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
                  disabled={!podeReplay}
                  className="flex flex-col items-center border-2 border-rosa bg-rosa/10 px-6 py-2 font-pixel text-[11px] text-rosa transition hover:bg-rosa hover:text-fundo disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rosa/10 disabled:hover:text-rosa"
                >
                  {podeReplay ? "JOGAR DE NOVO" : "SEM ENERGIA"}
                  <span className="text-[9px] font-normal opacity-80">−{LOOP.custoSoloq}⚡</span>
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
