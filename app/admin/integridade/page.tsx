"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAdmin } from "@/lib/adminClient";
import { AvisoDados, Carregando, Secao, Vazio } from "@/components/admin/ui";

interface Outlier {
  user_id: string;
  nick: string | null;
  semana: number;
  score: number;
  z: number;
  invalido: boolean;
}
interface Suspeito {
  user_id: string;
  nick: string | null;
  jogos: number;
  vitorias: number;
  taxa: number;
}
interface Dados {
  prova_outliers: Outlier[];
  duelo_suspeitos: Suspeito[];
}

export default function AdminIntegridade() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await fetchAdmin<Dados>("integridade"));
    } catch (e) {
      setErro(String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando) return <Carregando />;
  if (erro || !dados) return <Vazio msg={erro ? `Erro: ${erro}` : "Sem dados."} />;

  const semana = dados.prova_outliers[0]?.semana;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-zinc-100">Integridade do leaderboard</h1>
      <AvisoDados>
        Score de prova e resultado de duelo são AUTO-REPORTADOS nesta versão. Isto é <b>triagem</b> — a validação
        definitiva vem por Edge Function que recalcula a partir do seed na rodada de monetização.
      </AvisoDados>

      <Secao titulo={`Prova semanal — outliers (z-score${semana ? ` · semana ${semana}` : ""})`} sub="z alto = score muito acima da média da semana. Investigar antes de invalidar.">
        {dados.prova_outliers.length === 0 ? (
          <Vazio msg="Sem scores nessa semana." />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-2 text-left">Nick</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2 text-right">z</th><th className="px-3 py-2 text-center">Estado</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {dados.prova_outliers.map((o) => {
                  const suspeito = Number(o.z) >= 3;
                  return (
                    <tr key={o.user_id} className={`border-t border-zinc-800 ${suspeito ? "bg-rose-950/30" : ""}`}>
                      <td className="px-3 py-1.5 text-zinc-300">{o.nick ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{Number(o.score).toLocaleString("pt-BR")}</td>
                      <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${suspeito ? "text-rose-400" : "text-zinc-400"}`}>{Number(o.z).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-center">{o.invalido ? <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-900">INVÁLIDO</span> : suspeito ? <span className="text-rose-400">⚠ revisar</span> : "—"}</td>
                      <td className="px-3 py-1.5 text-right"><Link href={`/admin/jogadores?u=${o.user_id}`} className="text-sky-400 hover:underline">ficha →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">Para invalidar um score, abra a ficha do jogador (a ação é auditada com motivo).</p>
          </div>
        )}
      </Secao>

      <Secao titulo="Duelos — winrates impossíveis" sub="≥10 jogos e ≥90% de vitória. Duelo é determinístico, mas o desafiante escolhe quem enfrenta.">
        {dados.duelo_suspeitos.length === 0 ? (
          <Vazio msg="Nenhuma winrate suspeita. 👍" />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-2 text-left">Nick</th><th className="px-3 py-2 text-right">Jogos</th><th className="px-3 py-2 text-right">Vitórias</th><th className="px-3 py-2 text-right">Winrate</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {dados.duelo_suspeitos.map((s) => (
                  <tr key={s.user_id} className="border-t border-zinc-800">
                    <td className="px-3 py-1.5 text-zinc-300">{s.nick ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{s.jogos}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{s.vitorias}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-amber-400">{Math.round(Number(s.taxa) * 100)}%</td>
                    <td className="px-3 py-1.5 text-right"><Link href={`/admin/jogadores?u=${s.user_id}`} className="text-sky-400 hover:underline">ficha →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
