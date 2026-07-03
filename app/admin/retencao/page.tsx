"use client";

import { useAdmin } from "@/components/admin/PeriodoContext";
import { AvisoDados, BarChart, Carregando, LineChart, Painel, Secao, Vazio } from "@/components/admin/ui";

interface Ret {
  coortes: { coorte: string; tamanho: number; d1: number; d3: number; d7: number; d14: number; d30: number }[];
  sessoes: { dia: string; sessoes: number; p50: number; p75: number; p90: number }[];
  hist: { faixa: string; ordem: number; qtd: number }[];
  sobrev: { dia_n: number; pct: number }[];
}

function cel(v: number | null): string {
  if (v == null) return "";
  if (v >= 40) return "bg-emerald-600/70";
  if (v >= 20) return "bg-emerald-700/50";
  if (v >= 10) return "bg-amber-700/40";
  if (v > 0) return "bg-rose-800/40";
  return "bg-zinc-800/40";
}

export default function AdminRetencao() {
  const { dados, carregando, erro } = useAdmin<Ret>("retencao");

  if (carregando) return <Carregando />;
  if (erro || !dados) return <Vazio msg={erro ? `Erro: ${erro}` : "Sem dados."} />;

  const cols: [keyof Ret["coortes"][number], string][] = [
    ["d1", "D1"],
    ["d3", "D3"],
    ["d7", "D7"],
    ["d14", "D14"],
    ["d30", "D30"],
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Retenção</h1>

      <Secao titulo="Coortes por semana de cadastro" sub='"Voltou no Dn" = teve sessao_inicio no dia D0+n (calendário UTC).'>
        {dados.coortes.length === 0 ? (
          <Vazio />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Coorte (semana)</th>
                  <th className="px-3 py-2 text-right font-medium">Tam.</th>
                  {cols.map(([, r]) => (
                    <th key={r} className="px-3 py-2 text-center font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.coortes.map((c) => (
                  <tr key={c.coorte} className="border-t border-zinc-800">
                    <td className="px-3 py-1.5 text-zinc-300">{c.coorte}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">{c.tamanho}</td>
                    {cols.map(([chave]) => {
                      const v = c[chave] as number | null;
                      return (
                        <td key={String(chave)} className={`px-3 py-1.5 text-center tabular-nums text-zinc-100 ${cel(v)}`}>
                          {v == null ? "—" : `${v}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Curva de sobrevivência" sub="% de cada coorte que ainda voltou pelo menos até o dia N.">
          <Painel>
            <LineChart dados={dados.sobrev.map((s) => ({ x: `D${s.dia_n}`, y: Number(s.pct) }))} cor="#a78bfa" />
          </Painel>
        </Secao>

        <Secao titulo="Duração de sessão (histograma)" sub="Sessão = eventos com gap < 30min.">
          <Painel>
            <BarChart dados={dados.hist.map((h) => ({ x: h.faixa, y: Number(h.qtd) }))} />
          </Painel>
        </Secao>
      </div>

      <Secao titulo="Duração de sessão por dia (p50 / p90)">
        <AvisoDados>
          Duração = intervalo entre o 1º e o último evento da sessão; sessões de 1 evento ≈ 0 min. O evento{" "}
          <code>sessao_fim</code> (novo) melhora a cauda daqui pra frente.
        </AvisoDados>
        <Painel>
          <p className="mb-1 text-[11px] text-zinc-400">p50 (mediana), min</p>
          <LineChart dados={dados.sessoes.map((s) => ({ x: s.dia.slice(5), y: Number(s.p50) }))} cor="#38bdf8" altura={130} />
          <p className="mb-1 mt-3 text-[11px] text-zinc-400">p90, min</p>
          <LineChart dados={dados.sessoes.map((s) => ({ x: s.dia.slice(5), y: Number(s.p90) }))} cor="#f59e0b" altura={110} />
        </Painel>
      </Secao>
    </div>
  );
}
