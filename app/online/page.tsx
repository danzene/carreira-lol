"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DueloResult, LadoDuelo } from "@/engine/duelo";
import { useCareer } from "@/store/careerStore";
import { useProfile } from "@/store/profileStore";
import { useDuelo, type LadderLinha } from "@/store/dueloStore";

function LinhaLado({ lado, destaque }: { lado: LadoDuelo; destaque: boolean }) {
  return (
    <div className={`flex-1 border-2 p-3 text-center ${destaque ? "border-ciano bg-ciano/10" : "border-borda bg-painel"}`}>
      <p className="font-pixel text-[11px] text-texto">{lado.nome}</p>
      <p className="mt-1 text-[10px] text-suave">
        {lado.rota} · {lado.elo}
      </p>
      <p className="mt-2 text-2xl font-bold text-rosa">{lado.abates}</p>
      <p className="text-[10px] text-suave">abates</p>
      <p className="mt-1 text-[10px] text-ciano">força {lado.forca} · nota {lado.nota}</p>
      {destaque && <p className="mt-1 font-pixel text-[10px] text-emerald-400">VENCEDOR 🏆</p>}
    </div>
  );
}

function ResultadoDuelo({ res, onFechar }: { res: DueloResult; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onFechar}>
      <div
        className="w-full max-w-lg border-2 border-ciano bg-fundo p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-center font-pixel text-sm text-ciano">RESULTADO DO DUELO</h2>
        <div className="flex items-stretch gap-2">
          <LinhaLado lado={res.a} destaque={res.a.venceu} />
          <div className="flex items-center font-pixel text-[11px] text-suave">VS</div>
          <LinhaLado lado={res.b} destaque={res.b.venceu} />
        </div>
        <div className="mt-4 space-y-1 border-2 border-borda bg-painel p-3 text-[11px] text-suave">
          {res.log.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="mt-4 w-full border-2 border-ciano py-2 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          FECHAR
        </button>
      </div>
    </div>
  );
}

export default function OnlinePage() {
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const nick = useProfile((s) => s.perfil?.nick ?? "—");

  const meuPoder = useDuelo((s) => s.meuPoder);
  const ladder = useDuelo((s) => s.ladder);
  const ranking = useDuelo((s) => s.ranking);
  const historico = useDuelo((s) => s.historico);
  const carregando = useDuelo((s) => s.carregando);
  const buscando = useDuelo((s) => s.buscando);
  const ultimoResultado = useDuelo((s) => s.ultimoResultado);
  const carregar = useDuelo((s) => s.carregar);
  const desafiar = useDuelo((s) => s.desafiar);
  const buscarPorNick = useDuelo((s) => s.buscarPorNick);
  const limparResultado = useDuelo((s) => s.limparResultado);

  const [busca, setBusca] = useState("");
  const [achado, setAchado] = useState<LadderLinha | null>(null);
  const [erroBusca, setErroBusca] = useState("");
  const [duelando, setDuelando] = useState(false);

  useEffect(() => {
    if (!career) recarregarAtual();
  }, [career, recarregarAtual]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const minhaLinha = ranking.find((r) => r.nick === nick);
  const semCarreira = !career;

  // rival online (derivado do histórico do servidor): saldo de derrotas − vitórias ≥ 2
  const saldoContra = new Map<string, number>();
  for (const h of historico) {
    const rivalNick = h.souDesafiante ? h.oponenteNick : h.desafianteNick;
    saldoContra.set(rivalNick, (saldoContra.get(rivalNick) ?? 0) + (h.euGanhei ? -1 : 1));
  }
  const ehRivalOnline = (n: string) => (saldoContra.get(n) ?? 0) >= 2;

  async function handleDesafiar(op: LadderLinha) {
    if (semCarreira || duelando) return;
    setDuelando(true);
    await desafiar(op);
    setDuelando(false);
  }

  async function handleBuscar() {
    setErroBusca("");
    setAchado(null);
    const r = await buscarPorNick(busca);
    if (!r) setErroBusca("Nenhum duelista com esse nick (ele precisa ter entrado no Online).");
    else setAchado(r);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">ONLINE · DUELO 1v1</h1>
          <p className="mt-1 text-[11px] text-suave">Assíncrono e determinístico — enfrente o snapshot de outros players</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* meu perfil de duelista */}
      <div className="flex items-center justify-between border-2 border-ciano/40 bg-ciano/5 p-4">
        <div>
          <p className="font-pixel text-[12px] text-ciano">{nick}</p>
          <p className="mt-1 text-[10px] text-suave">
            {career ? `${career.player.rota} · ${career.player.rankSoloq.elo}` : "sem carreira ativa"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-pixel text-sm text-rosa">⚔ {meuPoder}</p>
          <p className="text-[10px] text-suave">
            poder · {minhaLinha ? `${minhaLinha.vitorias}V / ${minhaLinha.jogos - minhaLinha.vitorias}D` : "0V / 0D"}
          </p>
        </div>
      </div>

      {semCarreira && (
        <div className="border-2 border-rosa/50 bg-rosa/5 p-3 text-center text-[11px] text-suave">
          Entre numa carreira pra publicar seu snapshot e poder duelar.
        </div>
      )}

      {/* buscar por nick */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">DESAFIAR POR NICK</h2>
        <div className="flex gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            placeholder="nick do adversário"
            className="flex-1 border-2 border-borda bg-painel px-3 py-2 text-[12px] text-texto outline-none focus:border-ciano"
          />
          <button
            type="button"
            onClick={handleBuscar}
            disabled={buscando || !busca.trim()}
            className="border-2 border-ciano px-4 py-2 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo disabled:opacity-40"
          >
            {buscando ? "..." : "BUSCAR"}
          </button>
        </div>
        {erroBusca && <p className="text-[10px] text-rosa">{erroBusca}</p>}
        {achado && (
          <div className="flex items-center justify-between border-2 border-ciano bg-ciano/10 p-3">
            <div>
              <p className="font-pixel text-[11px] text-texto">{achado.nick}</p>
              <p className="mt-1 text-[10px] text-suave">
                {achado.snapshot.rota} · {achado.snapshot.elo} · ⚔ {achado.poder}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDesafiar(achado)}
              disabled={semCarreira || duelando}
              className="border-2 border-rosa bg-rosa/10 px-4 py-2 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo disabled:opacity-40"
            >
              DESAFIAR
            </button>
          </div>
        )}
      </section>

      {/* ladder */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">LADDER · ADVERSÁRIOS</h2>
        {carregando ? (
          <p className="text-[11px] text-suave">Carregando…</p>
        ) : ladder.length === 0 ? (
          <p className="text-[11px] text-suave">Ninguém publicou snapshot ainda. Seja o primeiro — volte depois pra encontrar rivais.</p>
        ) : (
          ladder.map((op) => (
            <div
              key={op.userId}
              className={`flex items-center justify-between border-2 p-3 ${ehRivalOnline(op.nick) ? "border-rosa bg-rosa/10" : "border-borda bg-painel"}`}
            >
              <div>
                <p className="font-pixel text-[11px] text-texto">
                  {op.nick}
                  {ehRivalOnline(op.nick) && <span className="ml-2 bg-rosa px-1 font-pixel text-[9px] text-fundo">😤 RIVAL</span>}
                </p>
                <p className="mt-1 text-[10px] text-suave">
                  {op.snapshot.rota} · {op.snapshot.elo}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-pixel text-[11px] text-rosa">⚔ {op.poder}</span>
                <button
                  type="button"
                  onClick={() => handleDesafiar(op)}
                  disabled={semCarreira || duelando}
                  className="border-2 border-rosa bg-rosa/10 px-3 py-1.5 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo disabled:opacity-40"
                >
                  DUELAR
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ranking */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">🏆 RANKING</h2>
        {ranking.length === 0 ? (
          <p className="text-[11px] text-suave">Ranking vazio — jogue duelos pra aparecer aqui.</p>
        ) : (
          ranking.slice(0, 10).map((r, i) => (
            <div
              key={r.userId}
              className={`flex items-center justify-between border-2 px-3 py-2 ${r.nick === nick ? "border-ciano bg-ciano/10" : "border-borda bg-painel"}`}
            >
              <span className="flex items-center gap-2 text-[11px] text-texto">
                <span className="font-pixel text-[10px] text-suave">{i + 1}º</span>
                {r.nick}
              </span>
              <span className="text-[10px] text-suave">
                {r.vitorias}V / {r.jogos - r.vitorias}D · ⚔ {r.poder}
              </span>
            </div>
          ))
        )}
      </section>

      {/* histórico */}
      {historico.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-pixel text-[11px] text-suave">HISTÓRICO</h2>
          {historico.map((h) => {
            const rival = h.souDesafiante ? h.oponenteNick : h.desafianteNick;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => useDuelo.setState({ ultimoResultado: h.resultado })}
                className={`flex items-center justify-between border-2 px-3 py-2 text-left ${h.euGanhei ? "border-emerald-500/50" : "border-rosa/40"}`}
              >
                <span className="text-[11px] text-texto">vs {rival}</span>
                <span className={`font-pixel text-[10px] ${h.euGanhei ? "text-emerald-400" : "text-rosa"}`}>
                  {h.euGanhei ? "VITÓRIA" : "DERROTA"}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {ultimoResultado && <ResultadoDuelo res={ultimoResultado} onFechar={limparResultado} />}
    </main>
  );
}
