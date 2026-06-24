"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TabelaLiga from "@/components/TabelaLiga";
import { LOOP } from "@/data/loop";
import { ORDEM_TIER, VOCE } from "@/data/liga";
import { regiaoDoPais } from "@/data/regioes";
import { timeDe } from "@/data/times";
import { premio, proximoConfrontoJogador } from "@/engine/liga";
import type { ConfrontoPO, LigaState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

function nomeTime(id: string): string {
  return id === VOCE ? "VOCÊ" : timeDe(id)?.nome ?? id;
}

function rotuloColocacao(c: number): string {
  if (c === 1) return "Campeão 🏆";
  if (c === 2) return "Vice-campeão";
  if (c === 3) return "Semifinalista";
  return `${c}º lugar`;
}

function LinhaConfronto({ c }: { c: ConfrontoPO }) {
  const venc = c.vencedorId;
  return (
    <div className="flex items-center justify-between border-2 border-borda bg-fundo/40 px-3 py-2 text-xs">
      <span className={venc === c.aId ? "text-ciano" : venc ? "text-suave line-through" : "text-texto"}>{nomeTime(c.aId)}</span>
      <span className="font-pixel text-[8px] text-borda">VS</span>
      <span className={venc === c.bId ? "text-ciano" : venc ? "text-suave line-through" : "text-texto"}>{nomeTime(c.bId)}</span>
    </div>
  );
}

function Playoffs({ liga }: { liga: LigaState }) {
  const po = liga.playoff;
  if (!po) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-pixel text-[10px] text-suave">PLAYOFFS</h2>
      <p className="text-[10px] text-suave">Semifinais</p>
      {po.sf.map((c, i) => (
        <LinhaConfronto key={i} c={c} />
      ))}
      {po.final && (
        <>
          <p className="mt-1 text-[10px] text-suave">Final</p>
          <LinhaConfronto c={po.final} />
        </>
      )}
    </div>
  );
}

export default function LigaPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const sincronizarLiga = useCareer((s) => s.sincronizarLiga);
  const encerrarTemporadaLiga = useCareer((s) => s.encerrarTemporadaLiga);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  useEffect(() => {
    sincronizarLiga();
  }, [sincronizarLiga]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const liga = career.liga;
  const semEnergia = career.player.energia < LOOP.custoSoloq;
  const adversario = proximoConfrontoJogador(liga);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">LIGA</h1>
          {liga && (
            <p className="mt-1 text-[10px] text-suave">
              {liga.tier === "TIER1"
                ? regiaoDoPais(career.player.nacionalidade).liga
                : liga.tier === "INTERNACIONAL"
                  ? "Mundial 🌍"
                  : liga.tier === "ACADEMY"
                    ? "Liga Academy"
                    : "Liga Amadora"}
            </p>
          )}
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {!career.contratoAtual || !liga ? (
        <div className="border-2 border-borda bg-painel p-5 text-center text-sm text-suave">
          <p>Você está sem time, então não disputa nenhuma liga.</p>
          <Link href="/propostas" className="mt-3 inline-block border-2 border-ciano bg-ciano/10 px-4 py-2 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo">
            VER PROPOSTAS
          </Link>
        </div>
      ) : (
        <>
          {/* Status / próxima partida */}
          {liga.fase === "ENCERRADA" ? (
            <Encerramento liga={liga} aoProximaTemporada={() => encerrarTemporadaLiga()} />
          ) : (
            <div className="border-2 border-borda bg-painel p-4">
              <p className="font-pixel text-[10px] text-ciano">
                {liga.fase === "REGULAR" ? `RODADA ${liga.rodadaAtual + 1} / ${liga.calendario.length}` : "PLAYOFFS"}
              </p>
              {adversario ? (
                <>
                  <p className="mt-2 text-sm text-texto">
                    Próxima partida oficial: <span className="text-rosa">{nomeTime(adversario)}</span>
                  </p>
                  {semEnergia ? (
                    <p className="mt-3 border-2 border-borda px-3 py-2 text-center text-[11px] text-suave">
                      Sem energia. Avance/descanse a semana no dashboard.
                    </p>
                  ) : (
                    <Link
                      href="/draft?oficial=1"
                      className="mt-3 block border-2 border-rosa bg-rosa/10 px-4 py-2.5 text-center font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
                    >
                      ⚔️ JOGAR PARTIDA OFICIAL
                    </Link>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-suave">Aguardando o calendário…</p>
              )}
            </div>
          )}

          {liga.fase === "PLAYOFFS" && <Playoffs liga={liga} />}

          <TabelaLiga liga={liga} />
        </>
      )}
    </main>
  );
}

function Encerramento({ liga, aoProximaTemporada }: { liga: LigaState; aoProximaTemporada: () => void }) {
  const colocacao = liga.colocacaoFinal ?? liga.participantes.length;
  const p = premio(liga.tier, colocacao);
  const total = liga.participantes.length;
  const mundial = liga.tier === "INTERNACIONAL" && colocacao === 1;

  let movimento = "Permanece no tier.";
  if (colocacao === 1 && liga.tier !== "INTERNACIONAL") {
    const i = ORDEM_TIER.indexOf(liga.tier);
    movimento = `Promovido para ${ORDEM_TIER[i + 1]}! ⬆️`;
  } else if (mundial) {
    movimento = "🌍 CAMPEÃO MUNDIAL!";
  } else if (colocacao >= total && liga.tier !== "AMADOR") {
    const i = ORDEM_TIER.indexOf(liga.tier);
    movimento = `Rebaixado para ${ORDEM_TIER[i - 1]}. ⬇️`;
  }

  return (
    <div className="border-2 border-ciano/50 bg-ciano/10 p-5 text-center">
      <p className="font-pixel text-[10px] text-suave">TEMPORADA ENCERRADA</p>
      <p className="mt-3 font-pixel text-sm text-ciano">{rotuloColocacao(colocacao)}</p>
      {liga.campeao && <p className="mt-1 text-xs text-suave">Campeão: {nomeTime(liga.campeao)}</p>}
      <div className="mt-3 text-sm text-texto">
        + ${p.dinheiro} · +{p.reputacao} reputação
      </div>
      <p className="mt-2 text-xs text-rosa">{movimento}</p>
      <button
        type="button"
        onClick={aoProximaTemporada}
        className="mt-4 border-2 border-rosa bg-rosa/10 px-5 py-2 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
      >
        PRÓXIMA TEMPORADA
      </button>
    </div>
  );
}
