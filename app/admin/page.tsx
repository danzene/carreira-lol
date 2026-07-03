"use client";

import { useAdmin } from "@/components/admin/PeriodoContext";
import { Carregando, KpiCard, LineChart, Painel, Secao, Vazio } from "@/components/admin/ui";

interface Overview {
  kpis: {
    jogadores_total: number;
    novos: number;
    dau: number;
    wau: number;
    sessoes: number;
    dur_mediana: number;
    d1: number;
    d7: number;
    partidas: number;
    pct_online: number;
  };
  serie: { dia: string; dau: number; novos: number }[];
}

export default function AdminOverview() {
  const { dados, carregando, erro } = useAdmin<Overview>("overview");
  const k = dados?.kpis;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Visão Geral</h1>

      {carregando ? (
        <Carregando />
      ) : erro || !k ? (
        <Vazio msg={erro ? `Erro: ${erro}` : "Sem dados."} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiCard rotulo="Jogadores" valor={k.jogadores_total} />
            <KpiCard rotulo="Novos (período)" valor={k.novos} />
            <KpiCard rotulo="DAU (hoje)" valor={k.dau} />
            <KpiCard rotulo="WAU (7d)" valor={k.wau} />
            <KpiCard rotulo="Sessões (período)" valor={k.sessoes} />
            <KpiCard rotulo="Sessão mediana" valor={k.dur_mediana} formato={(n) => `${n} min`} />
            <KpiCard rotulo="Retenção D1" valor={k.d1} formato={(n) => `${n}%`} />
            <KpiCard rotulo="Retenção D7" valor={k.d7} formato={(n) => `${n}%`} />
            <KpiCard rotulo="Partidas (período)" valor={k.partidas} />
            <KpiCard rotulo="% chegou ao online" valor={k.pct_online} formato={(n) => `${n}%`} />
          </div>

          <Secao titulo="Ativos por dia (DAU) e novos cadastros" sub="Linha azul = DAU; verde = novos (primeiro login no dia). UTC.">
            <Painel>
              <p className="mb-1 text-[11px] text-sky-400">DAU</p>
              <LineChart dados={dados.serie.map((d) => ({ x: d.dia.slice(5), y: Number(d.dau) }))} cor="#38bdf8" />
              <p className="mb-1 mt-3 text-[11px] text-emerald-400">Novos</p>
              <LineChart dados={dados.serie.map((d) => ({ x: d.dia.slice(5), y: Number(d.novos) }))} cor="#34d399" altura={120} />
            </Painel>
          </Secao>
        </>
      )}
    </div>
  );
}
