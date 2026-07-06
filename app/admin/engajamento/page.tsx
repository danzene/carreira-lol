"use client";

import { useAdmin } from "@/components/admin/PeriodoContext";
import { AvisoDados, BarChart, Carregando, KpiCard, LineChart, Painel, Secao, Vazio } from "@/components/admin/ui";

type KV = { k: string; v: number };
interface Eng {
  skip_por_tipo: { tipo: string; vista: number; pulada: number; taxa: number }[];
  partidas_por_modo: KV[];
  cartoes_por_tipo: KV[];
  duelos: number;
  provas: number;
  passe_niveis: KV[];
  grind: {
    adocao: { dia: string; ativos: number; grinders: number }[];
    pct_geral: number;
    horas_hist: KV[];
    teto_dias: number;
  } | null;
}

// Tipos de cerimônia (do EventBus do jogo) → nome legível em PT.
const NOME_CERIMONIA: Record<string, string> = {
  RANK_PROMOTED: "Promoção de elo",
  RANK_DEMOTED: "Queda de elo",
  PASS_LEVEL_UP: "Nível do passe",
  ACHIEVEMENT_UNLOCKED: "Conquista",
  FEATURE_UNLOCKED: "Novo recurso",
  STREAK_MILESTONE: "Marco de streak",
  ITEM_DROPPED: "Drop de item",
  GACHA_PULLED: "Puxada de gacha",
  MISSION_COMPLETED: "Missão concluída",
  RIVAL_DECLARED: "Rivalidade declarada",
  RIVAL_DEFEATED: "Rival superado",
  MENSAGEM: "Mensagem",
};

// Fallback: "ALGO_ASSIM" → "Algo assim" (pra tipos novos que ainda não mapeamos).
function humanizar(chave: string): string {
  const s = chave.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const nomeCerimonia = (t: string) => NOME_CERIMONIA[t] ?? humanizar(t);

const NOME_MODO: Record<string, string> = { soloq: "SoloQ", liga: "Liga", evento: "Evento", torneio: "Torneio" };
const nomeModo = (m: string) => NOME_MODO[m] ?? humanizar(m);

function corTaxa(taxa: number): string {
  if (taxa >= 80) return "text-rose-400";
  if (taxa >= 50) return "text-amber-400";
  return "text-zinc-300";
}

export default function AdminEngajamento() {
  const { dados, carregando, erro } = useAdmin<Eng>("engajamento");
  if (carregando) return <Carregando />;
  if (erro || !dados) return <Vazio msg={erro ? `Erro: ${erro}` : "Sem dados."} />;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Engajamento</h1>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard rotulo="Duelos" valor={dados.duelos} />
        <KpiCard rotulo="Provas" valor={dados.provas} />
        <KpiCard rotulo="Cartões" valor={dados.cartoes_por_tipo.reduce((s, c) => s + Number(c.v), 0)} />
        <KpiCard rotulo="Partidas" valor={dados.partidas_por_modo.reduce((s, p) => s + Number(p.v), 0)} />
      </div>

      <Secao titulo="Taxa de skip por tipo de cerimônia" sub="Skip alto = a cerimônia atrapalha mais do que recompensa. Base: cerimonia_vista / cerimonia_pulada.">
        <AvisoDados>O evento <code>cerimonia_vista</code> é novo — a taxa só é confiável para o período depois que ele passou a ser emitido.</AvisoDados>
        {dados.skip_por_tipo.length === 0 ? (
          <Vazio msg="Nenhuma cerimônia registrada no período." />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Vistas</th>
                  <th className="px-3 py-2 text-right">Puladas</th>
                  <th className="px-3 py-2 text-right">Taxa de skip</th>
                </tr>
              </thead>
              <tbody>
                {dados.skip_por_tipo.map((s) => (
                  <tr key={s.tipo} className="border-t border-zinc-800">
                    <td className="px-3 py-1.5 text-zinc-300">{nomeCerimonia(s.tipo)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">{Number(s.vista).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">{Number(s.pulada).toLocaleString("pt-BR")}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${corTaxa(Number(s.taxa))}`}>{Number(s.taxa)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Partidas por modo">
          <Painel>
            <BarChart dados={dados.partidas_por_modo.map((p) => ({ x: nomeModo(p.k), y: Number(p.v), cor: "#38bdf8" }))} altura={170} />
          </Painel>
        </Secao>
        <Secao titulo="Cartões compartilhados por tipo" sub="Uso da feature de compartilhamento.">
          <Painel>
            <BarChart dados={dados.cartoes_por_tipo.map((c) => ({ x: c.k, y: Number(c.v), cor: "#34d399" }))} altura={170} />
          </Painel>
        </Secao>
      </div>

      <Secao titulo="Distribuição de nível do passe" sub="Onde os jogadores estão no passe (nível 60 = completo).">
        <Painel>
          <BarChart dados={dados.passe_niveis.map((n) => ({ x: n.k, y: Number(n.v), cor: "#a78bfa" }))} altura={180} />
        </Painel>
      </Secao>

      <Secao
        titulo="Endgame — Grind de Normais"
        sub="Adoção da camada idle: % dos ativos do dia que usaram o grind e quanto do teto (3h) cada usuário-dia consumiu. É o que diz se a feature reteve ou virou ruído."
      >
        {!dados.grind ? (
          <Vazio msg="Sem dados do grind (rode a migration 016 e aguarde eventos grind_*)." />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <KpiCard rotulo="% ativos que usaram o grind" valor={Number(dados.grind.pct_geral)} formato={(n) => `${n}%`} />
              <KpiCard rotulo="Dias-usuário no teto (3h)" valor={Number(dados.grind.teto_dias)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Painel>
                <p className="mb-1 text-[11px] text-zinc-400">Ativos (azul) vs usaram grind (verde), por dia</p>
                <LineChart dados={dados.grind.adocao.map((a) => ({ x: a.dia.slice(5), y: Number(a.ativos) }))} cor="#38bdf8" altura={120} />
                <LineChart dados={dados.grind.adocao.map((a) => ({ x: a.dia.slice(5), y: Number(a.grinders) }))} cor="#34d399" altura={100} />
              </Painel>
              <Painel>
                <p className="mb-1 text-[11px] text-zinc-400">Horas de grind por usuário-dia (até o teto)</p>
                <BarChart dados={dados.grind.horas_hist.map((h) => ({ x: h.k, y: Number(h.v), cor: "#f59e0b" }))} altura={170} />
              </Painel>
            </div>
          </>
        )}
      </Secao>
    </div>
  );
}
