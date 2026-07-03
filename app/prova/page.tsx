"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defModificador,
  gerarProvaSemanal,
  msAteProximaProva,
  podeJogarProva,
  PROVA,
  semanaISO,
} from "@/engine/prova";
import { featureLiberada, defUnlock } from "@/engine/unlocks";
import { compartilharCartao } from "@/lib/cartao";
import { checarTopoSemana, useProva } from "@/store/provaStore";
import { useCareer } from "@/store/careerStore";
import { useProfile } from "@/store/profileStore";

function fmtCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export default function ProvaPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregar = useCareer((s) => s.recarregarAtual);
  const concederTitulo = useCareer((s) => s.concederTitulo);
  const leaderboard = useProva((s) => s.leaderboard);
  const minhaPosicao = useProva((s) => s.minhaPosicao);
  const total = useProva((s) => s.totalParticipantes);
  const historico = useProva((s) => s.historico);
  const carregando = useProva((s) => s.carregando);
  const carregar = useProva((s) => s.carregar);

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const semana = semanaISO(agora);
  const prova = gerarProvaSemanal(semana);

  useEffect(() => {
    if (!career && !recarregar()) router.replace("/");
  }, [career, recarregar, router]);

  useEffect(() => {
    carregar(semana);
  }, [carregar, semana]);

  // top 10% da semana PASSADA → título exclusivo (client-side; validação Edge = TODO)
  useEffect(() => {
    let vivo = true;
    void checarTopoSemana(semana - 1).then((top) => {
      if (vivo && top) concederTitulo(`Lenda da Prova S${(semana - 1) % 100}`);
    });
    return () => {
      vivo = false;
    };
  }, [semana, concederTitulo]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  if (!featureLiberada(career, "online")) {
    const u = defUnlock("online");
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-3xl">🔒</p>
        <p className="font-pixel text-[12px] text-suave">PROVA SEMANAL</p>
        <p className="text-[11px] text-suave">{u.condicao}</p>
        <Link href="/dashboard" className="mt-2 border-2 border-borda px-4 py-2 text-[11px] text-suave hover:text-texto">
          Voltar
        </Link>
      </main>
    );
  }

  const estado = career.prova?.semana === semana ? career.prova : undefined;
  const jogadas = estado?.resultados.length ?? 0;
  const podeJogar = podeJogarProva(career, semana);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">🏁 PROVA SEMANAL</h1>
          <p className="mt-1 text-[11px] text-suave">
            Semana {semana % 100} · mesmas regras e seed pra TODO MUNDO · próxima em {fmtCountdown(msAteProximaProva(agora))}
          </p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* regras da semana */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">REGRAS DA SEMANA</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {prova.modificadores.map((m) => {
            const d = defModificador(m);
            return (
              <div key={m} className="flex items-center gap-3 border-2 border-amber-300/60 bg-amber-300/10 p-3">
                <span className="text-2xl">{d.emoji}</span>
                <div>
                  <p className="font-pixel text-[11px] text-amber-300">
                    {d.nome}
                    {m === "so_classe" && prova.classeDaSemana ? ` · ${prova.classeDaSemana}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-suave">{d.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* progresso das 3 partidas */}
      <section className="border-2 border-borda bg-painel p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[11px] text-suave">SUAS PARTIDAS</h2>
          {estado?.finalizada && <span className="font-pixel text-[12px] text-ciano">SCORE: {estado.scoreFinal}</span>}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: PROVA.partidas }, (_, i) => {
            const r = estado?.resultados[i];
            return (
              <div
                key={i}
                className={`flex flex-col items-center gap-1 border-2 py-3 ${
                  r ? (r.vitoria ? "border-ciano bg-ciano/10" : "border-rosa bg-rosa/10") : "border-borda bg-fundo/40"
                }`}
              >
                <span className="font-pixel text-[10px] text-suave">P{i + 1}</span>
                {r ? (
                  <>
                    <span className={`font-pixel text-[11px] ${r.vitoria ? "text-ciano" : "text-rosa"}`}>{r.vitoria ? "V" : "D"}</span>
                    <span className="text-[10px] text-suave">nota {r.nota.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-xl text-borda">·</span>
                )}
              </div>
            );
          })}
        </div>
        {podeJogar ? (
          <Link
            href="/draft?prova=1"
            className="mt-3 block border-2 border-amber-300 bg-amber-300/10 py-2.5 text-center font-pixel text-[11px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
          >
            ▶ JOGAR PARTIDA {jogadas + 1}/{PROVA.partidas}
          </Link>
        ) : (
          <>
            <p className="mt-3 text-center font-pixel text-[10px] text-emerald-400">
              ✓ PROVA CONCLUÍDA · recompensa coletada · volta semana que vem!
            </p>
            <button
              type="button"
              onClick={() => {
                const nick = useProfile.getState().perfil?.nick ?? "Jogador";
                void compartilharCartao(
                  {
                    titulo: "PROVA SEMANAL",
                    destaque: `${estado?.scoreFinal ?? 0} pts`,
                    sub: `semana ${semana % 100}${minhaPosicao ? ` · ${minhaPosicao}º do mundo` : ""}`,
                    nick,
                    elo: career.player.rankSoloq.elo,
                    emoji: "🏁",
                  },
                  `Fiz ${estado?.scoreFinal ?? 0} pts na Prova Semanal do Carreira LoL! ▶ https://carreira-lol.vercel.app`,
                );
              }}
              className="mt-2 w-full border-2 border-borda py-2 font-pixel text-[10px] text-suave transition hover:text-texto"
            >
              📤 COMPARTILHAR SCORE
            </button>
          </>
        )}
        <p className="mt-2 text-center text-[10px] text-suave">
          Partidas da prova são LATERAIS: não gastam energia e não mexem no seu elo.
        </p>
      </section>

      {/* leaderboard */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[11px] text-suave">🏆 PLACAR MUNDIAL</h2>
          {minhaPosicao && (
            <span className="font-pixel text-[10px] text-ciano">
              você: {minhaPosicao}º de {total}
            </span>
          )}
        </div>
        {carregando ? (
          <p className="text-[11px] text-suave">Carregando…</p>
        ) : leaderboard.length === 0 ? (
          <p className="border-2 border-borda bg-painel/40 p-3 text-center text-[11px] text-suave">
            Ninguém pontuou ainda — seja o primeiro do mundo! 🌍
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {leaderboard.map((l, i) => (
              <div
                key={l.userId}
                className={`flex items-center justify-between border-2 px-3 py-1.5 ${
                  minhaPosicao === i + 1 ? "border-ciano bg-ciano/10" : "border-borda bg-painel"
                }`}
              >
                <span className="text-[11px] text-texto">
                  <span className="font-pixel text-[9px] text-suave">{i + 1}º</span> {l.nick}
                  {i === 0 && " 👑"}
                </span>
                <span className="font-pixel text-[11px] text-amber-300">{l.score}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* histórico */}
      {historico.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-pixel text-[11px] text-suave">SUAS PROVAS</h2>
          <div className="flex flex-wrap gap-2">
            {historico.map((h) => (
              <span key={h.semana} className="border-2 border-borda bg-painel px-2 py-1 text-[11px] text-suave">
                S{h.semana % 100}: <span className="text-ciano">{h.score}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
