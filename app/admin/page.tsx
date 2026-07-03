"use client";

import { useAdmin } from "@/components/admin/PeriodoContext";
import { Carregando, LineChart, Secao, Vazio } from "@/components/admin/ui";

interface DauResp {
  serie: { dia: string; usuarios: number }[];
}

export default function AdminOverview() {
  const { dados, carregando, erro } = useAdmin<DauResp>("dau");

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Visão Geral</h1>

      <Secao titulo="Usuários ativos por dia (DAU)" sub="Ativo = ≥1 evento de telemetria no dia (UTC). Ajuste o período no topo.">
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <Vazio msg={`Erro: ${erro}`} />
        ) : (
          <LineChart dados={(dados?.serie ?? []).map((d) => ({ x: d.dia.slice(5), y: Number(d.usuarios) }))} />
        )}
      </Secao>

      <p className="text-xs text-zinc-600">
        KPIs completos (novos, WAU, D1/D7, sessões, % online) chegam na Fase 1. Fase 0 valida a fundação: papel de admin,
        proteção server-side e a camada de dados ponta a ponta.
      </p>
    </div>
  );
}
