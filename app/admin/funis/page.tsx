"use client";

import { useAdmin } from "@/components/admin/PeriodoContext";
import { BarChart, Carregando, FunnelChart, LineChart, Painel, Secao, Vazio } from "@/components/admin/ui";

type Etapa = { etapa: string; ordem: number; usuarios: number };
type KV = { k: string; v: number };
interface Funis {
  onboarding: Etapa[];
  progressao: Etapa[];
  abandono: { total: number; por_elo: KV[]; por_semana: KV[]; por_tela: KV[] };
  ritual: { serie: { dia: string; dau: number; gratis: number }[]; streaks: KV[]; escudos_usados: number };
}

export default function AdminFunis() {
  const { dados, carregando, erro } = useAdmin<Funis>("funis");
  if (carregando) return <Carregando />;
  if (erro || !dados) return <Vazio msg={erro ? `Erro: ${erro}` : "Sem dados."} />;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Funis & Abandono</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Onboarding" sub="Cadastro → primeiros passos → voltou no D1.">
          <Painel>
            <FunnelChart etapas={dados.onboarding.map((e) => ({ rotulo: e.etapa, valor: Number(e.usuarios) }))} />
          </Painel>
        </Secao>

        <Secao titulo="Progressão longa" sub="Quantos concluem o passe (60) e chegam ao 1º duelo.">
          <Painel>
            <FunnelChart etapas={dados.progressao.map((e) => ({ rotulo: e.etapa, valor: Number(e.usuarios) }))} />
          </Painel>
        </Secao>
      </div>

      <Secao titulo={`Ponto de abandono — ${dados.abandono.total} jogadores inativos há 7+ dias`} sub="Onde o jogo perde as pessoas: contexto do último acesso.">
        <div className="grid gap-3 md:grid-cols-3">
          <Painel>
            <p className="mb-2 text-xs text-zinc-400">Por elo (última sessão)</p>
            <BarChart dados={dados.abandono.por_elo.slice(0, 10).map((x) => ({ x: x.k, y: Number(x.v), cor: "#f87171" }))} altura={150} />
          </Painel>
          <Painel>
            <p className="mb-2 text-xs text-zinc-400">Por semana de carreira</p>
            <BarChart dados={dados.abandono.por_semana.slice(0, 12).map((x) => ({ x: `S${x.k}`, y: Number(x.v), cor: "#fb923c" }))} altura={150} />
          </Painel>
          <Painel>
            <p className="mb-2 text-xs text-zinc-400">Última tela vista</p>
            <BarChart dados={dados.abandono.por_tela.slice(0, 10).map((x) => ({ x: (x.k || "?").replace("/", ""), y: Number(x.v), cor: "#a78bfa" }))} altura={150} />
          </Painel>
        </div>
      </Secao>

      <Secao titulo="Ritual diário" sub={`${dados.ritual.escudos_usados} escudos de streak já salvaram alguém.`}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Painel>
            <p className="mb-1 text-xs text-zinc-400">DAU (azul) vs quem usou a puxada grátis (verde)</p>
            <LineChart dados={dados.ritual.serie.map((s) => ({ x: s.dia.slice(5), y: Number(s.dau) }))} cor="#38bdf8" altura={140} />
            <LineChart dados={dados.ritual.serie.map((s) => ({ x: s.dia.slice(5), y: Number(s.gratis) }))} cor="#34d399" altura={100} />
          </Painel>
          <Painel>
            <p className="mb-2 text-xs text-zinc-400">Distribuição de streaks ativos</p>
            <BarChart dados={dados.ritual.streaks.map((x) => ({ x: `${x.k} dias`, y: Number(x.v), cor: "#f59e0b" }))} altura={160} />
          </Painel>
        </div>
      </Secao>
    </div>
  );
}
