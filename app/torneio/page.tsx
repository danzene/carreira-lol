"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TabelaLiga from "@/components/TabelaLiga";
import { VOCE } from "@/data/liga";
import { LOOP } from "@/data/loop";
import { timeDe } from "@/data/times";
import { premioTorneio, proximoConfrontoTorneio } from "@/engine/internacional";
import type { ConfrontoPO, LigaState, TorneioInternacional } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

function nomeTime(id: string): string {
  return id === VOCE ? "VOCÊ" : timeDe(id)?.nome ?? id;
}

function LinhaConfronto({ c }: { c: ConfrontoPO }) {
  const v = c.vencedorId;
  return (
    <div className="flex items-center justify-between border-2 border-borda bg-fundo/40 px-3 py-2 text-xs">
      <span className={v === c.aId ? "text-amber-300" : v ? "text-suave line-through" : "text-texto"}>{nomeTime(c.aId)}</span>
      <span className="font-pixel text-[8px] text-borda">VS</span>
      <span className={v === c.bId ? "text-amber-300" : v ? "text-suave line-through" : "text-texto"}>{nomeTime(c.bId)}</span>
    </div>
  );
}

function Playoffs({ liga }: { liga: LigaState }) {
  const po = liga.playoff;
  if (!po) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-pixel text-[10px] text-suave">MATA-MATA</h2>
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

export default function TorneioPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const encerrar = useCareer((s) => s.encerrarTorneioInternacional);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const t = career.torneioAtual;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-amber-300">{t ? t.nome.toUpperCase() : "TORNEIO"}</h1>
          <p className="mt-1 text-[10px] text-suave">Circuito internacional 🌍</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {!t ? (
        <div className="border-2 border-borda bg-painel p-5 text-center text-sm text-suave">
          Nenhum torneio em disputa. Seja <span className="text-amber-300">campeão da sua liga</span> pra se classificar pro MSI/Worlds.
        </div>
      ) : (
        <>
          {t.bracket.fase === "ENCERRADA" ? (
            <Encerramento t={t} aoColetar={() => { encerrar(); router.push("/dashboard"); }} />
          ) : (
            <ProximaPartida t={t} energia={career.player.energia} />
          )}

          {t.bracket.fase === "PLAYOFFS" && <Playoffs liga={t.bracket} />}
          <TabelaLiga liga={t.bracket} />
        </>
      )}
    </main>
  );
}

function ProximaPartida({ t, energia }: { t: TorneioInternacional; energia: number }) {
  const adversario = proximoConfrontoTorneio(t);
  const semEnergia = energia < LOOP.custoSoloq;
  const liga = t.bracket;
  return (
    <div className="border-2 border-borda bg-painel p-4">
      <p className="font-pixel text-[10px] text-amber-300">
        {liga.fase === "REGULAR" ? `FASE DE GRUPOS · ${liga.rodadaAtual + 1}/${liga.calendario.length}` : "MATA-MATA"}
      </p>
      {adversario ? (
        <>
          <p className="mt-2 text-sm text-texto">
            Próxima partida: <span className="text-amber-300">{nomeTime(adversario)}</span>
          </p>
          {semEnergia ? (
            <p className="mt-3 border-2 border-borda px-3 py-2 text-center text-[11px] text-suave">
              Sem energia. Avance/descanse a semana no dashboard.
            </p>
          ) : (
            <Link
              href="/draft?internacional=1"
              className="mt-3 block border-2 border-amber-300 bg-amber-300/10 px-4 py-2.5 text-center font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
            >
              ⚔️ JOGAR PARTIDA
            </Link>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-suave">Aguardando…</p>
      )}
    </div>
  );
}

function Encerramento({ t, aoColetar }: { t: TorneioInternacional; aoColetar: () => void }) {
  const col = t.bracket.colocacaoFinal ?? 99;
  const pr = premioTorneio(t.tipo, col);
  const venceu = col === 1;
  const rotulo = col === 1 ? "" : col === 2 ? "Vice-campeão" : col === 3 ? "Semifinalista" : `${col}º lugar`;

  return (
    <div className="border-2 border-amber-300 bg-amber-300/10 p-5 text-center">
      <p className="font-pixel text-[10px] text-suave">{t.nome.toUpperCase()} ENCERRADO</p>
      <p className="mt-3 font-pixel text-sm text-amber-300">
        {venceu ? (t.tipo === "WORLDS" ? "🏆 CAMPEÃO MUNDIAL!" : "🌐 CAMPEÃO DO MSI!") : rotulo}
      </p>
      {t.bracket.campeao && <p className="mt-1 text-xs text-suave">Campeão: {nomeTime(t.bracket.campeao)}</p>}
      <div className="mt-3 text-sm text-texto">
        + ${pr.dinheiro} · +{pr.reputacao} reputação
      </div>
      <button
        type="button"
        onClick={aoColetar}
        className="mt-4 border-2 border-amber-300 bg-amber-300/10 px-5 py-2 font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
      >
        COLETAR
      </button>
    </div>
  );
}
