"use client";

import Link from "next/link";
import { RARIDADES } from "@/data/gacha";
import { formatarReais } from "@/lib/produtos";
import { classificarAnomalia, corSeveridade } from "@/lib/economiaAnomalia";
import { useAdmin } from "@/components/admin/PeriodoContext";
import { BarChart, Carregando, KpiCard, LineChart, Painel, Secao, Vazio } from "@/components/admin/ui";

type KV = { k: string; v: number };
interface Receita {
  total_centavos: number;
  pedidos: number;
  por_dia: { dia: string; v: number }[];
  por_produto: KV[];
}
interface Eco {
  economia: { serie: { dia: string; criado: number; destruido: number }[]; por_motivo: KV[]; saldo_hist: KV[]; top_saldos: { user_id: string; nick: string; saldo: number }[] };
  gacha: { puxadas_dia: { dia: string; v: number }[]; raridade_obs: KV[]; pity_5: KV[] };
  itens: { drops_por_raridade: KV[]; reroll: number; desmonte: number; drops_total: number };
  anomalias: { user_id: string; nick: string; saldo: number; soma_eventos: number }[];
  receita: Receita | null;
}

const NOME_RAR: Record<string, string> = Object.fromEntries(RARIDADES.map((r) => [String(r.n), r.nome]));
const ESPERADO: Record<string, number> = Object.fromEntries(RARIDADES.map((r) => [String(r.n), r.chance * 100]));

export default function AdminEconomia() {
  const { dados, carregando, erro } = useAdmin<Eco>("economia");
  if (carregando) return <Carregando />;
  if (erro || !dados) return <Vazio msg={erro ? `Erro: ${erro}` : "Sem dados."} />;

  const totalObs = dados.gacha.raridade_obs.reduce((s, x) => s + Number(x.v), 0) || 1;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Economia</h1>

      {dados.receita && (
        <Secao titulo="Receita real (R$)" sub="Pedidos Pix aprovados (Mercado Pago) no período. Fonte da verdade: tabela pedidos.">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <KpiCard rotulo="Receita" valor={dados.receita.total_centavos} formato={formatarReais} />
            <KpiCard rotulo="Pedidos pagos" valor={dados.receita.pedidos} />
            <KpiCard
              rotulo="Ticket médio"
              valor={dados.receita.pedidos > 0 ? Math.round(dados.receita.total_centavos / dados.receita.pedidos) : 0}
              formato={formatarReais}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Painel>
              <p className="mb-1 text-[11px] text-emerald-400">Receita por dia (R$)</p>
              <LineChart dados={dados.receita.por_dia.map((d) => ({ x: d.dia.slice(5), y: Number(d.v) / 100 }))} cor="#34d399" altura={130} />
            </Painel>
            <Painel>
              <p className="mb-1 text-[11px] text-zinc-400">Por produto (R$)</p>
              <BarChart dados={dados.receita.por_produto.map((p) => ({ x: p.k, y: Number(p.v) / 100, cor: "#f59e0b" }))} altura={130} />
            </Painel>
          </div>
        </Secao>
      )}

      <Secao titulo="Fluxo de CoinPoints por dia" sub="Verde = criado (fontes) · vermelho = destruído (sinks). Base: evento coinpoints (best-effort).">
        <Painel>
          <p className="mb-1 text-[11px] text-emerald-400">Criado</p>
          <LineChart dados={dados.economia.serie.map((s) => ({ x: s.dia.slice(5), y: Number(s.criado) }))} cor="#34d399" altura={130} />
          <p className="mb-1 mt-3 text-[11px] text-rose-400">Destruído</p>
          <LineChart dados={dados.economia.serie.map((s) => ({ x: s.dia.slice(5), y: Number(s.destruido) }))} cor="#f87171" altura={110} />
        </Painel>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Por motivo (fonte/sink)">
          <Painel>
            <BarChart dados={dados.economia.por_motivo.slice(0, 10).map((m) => ({ x: m.k, y: Math.abs(Number(m.v)), cor: Number(m.v) >= 0 ? "#34d399" : "#f87171" }))} altura={170} />
          </Painel>
        </Secao>
        <Secao titulo="Distribuição de saldo">
          <Painel>
            <BarChart dados={dados.economia.saldo_hist.map((h) => ({ x: h.k, y: Number(h.v) }))} altura={170} />
          </Painel>
        </Secao>
      </div>

      <Secao titulo="Top 20 saldos">
        <div className="overflow-x-auto rounded border border-zinc-800">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-2 text-left">Nick</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {dados.economia.top_saldos.map((t) => (
                <tr key={t.user_id} className="border-t border-zinc-800">
                  <td className="px-3 py-1.5 text-zinc-300">{t.nick ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-amber-300">{Number(t.saldo).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-1.5 text-right"><Link href={`/admin/jogadores?u=${t.user_id}`} className="text-sky-400 hover:underline">ficha →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Gacha — raridade observada vs esperada" sub="Divergência forte = bug ou trapaça. 'Observada' é por carta (evento enriquecido).">
        <div className="grid gap-4 lg:grid-cols-2">
          <Painel>
            <BarChart dados={dados.gacha.raridade_obs.map((r) => ({ x: NOME_RAR[r.k] ?? r.k, y: Number(r.v), cor: "#a78bfa" }))} altura={160} />
          </Painel>
          <Painel>
            <table className="w-full text-xs">
              <thead className="text-zinc-500"><tr><th className="py-1 text-left">Raridade</th><th className="py-1 text-right">Observado</th><th className="py-1 text-right">Esperado</th></tr></thead>
              <tbody>
                {dados.gacha.raridade_obs.map((r) => {
                  const obs = (Number(r.v) / totalObs) * 100;
                  const esp = ESPERADO[r.k] ?? 0;
                  const div = esp > 0 && Math.abs(obs - esp) / esp > 0.5;
                  return (
                    <tr key={r.k} className="border-t border-zinc-800">
                      <td className="py-1 text-zinc-300">{NOME_RAR[r.k] ?? r.k}</td>
                      <td className={`py-1 text-right tabular-nums ${div ? "text-rose-400" : "text-zinc-300"}`}>{obs.toFixed(2)}%</td>
                      <td className="py-1 text-right tabular-nums text-zinc-500">{esp.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-zinc-500">Vermelho = observado desvia &gt;50% do esperado (o pity distorce o topo — normal).</p>
          </Painel>
        </div>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Pity no momento do 5★">
          <Painel><BarChart dados={dados.gacha.pity_5.map((p) => ({ x: p.k, y: Number(p.v), cor: "#f59e0b" }))} altura={150} /></Painel>
        </Secao>
        <Secao titulo="Itens">
          <div className="mb-2 grid grid-cols-3 gap-2">
            <KpiCard rotulo="Drops" valor={dados.itens.drops_total} />
            <KpiCard rotulo="Rerolls" valor={dados.itens.reroll} />
            <KpiCard rotulo="Desmontes" valor={dados.itens.desmonte} />
          </div>
          <Painel><BarChart dados={dados.itens.drops_por_raridade.map((r) => ({ x: `R${r.k}`, y: Number(r.v) }))} altura={130} /></Painel>
        </Secao>
      </div>

      <Secao titulo={`Anomalias de economia — ${dados.anomalias.length} contas pra revisar`} sub="Saldo vs soma dos deltas registrados. Lista de REVISÃO (falsos positivos ok); validação definitiva por Edge Function na monetização.">
        {dados.anomalias.length === 0 ? (
          <Vazio msg="Nenhuma conta com desvio relevante. 👍" />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-2 text-left">Nick</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">Soma eventos</th><th className="px-3 py-2 text-right">Delta</th><th className="px-3 py-2 text-center">Sev.</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {dados.anomalias.map((a) => {
                  const { delta, severidade } = classificarAnomalia(Number(a.saldo), Number(a.soma_eventos));
                  return (
                    <tr key={a.user_id} className="border-t border-zinc-800">
                      <td className="px-3 py-1.5 text-zinc-300">{a.nick ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{Number(a.saldo).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-zinc-500">{Number(a.soma_eventos).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{delta > 0 ? "+" : ""}{delta.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-1.5 text-center"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-zinc-900" style={{ background: corSeveridade(severidade) }}>{severidade}</span></td>
                      <td className="px-3 py-1.5 text-right"><Link href={`/admin/jogadores?u=${a.user_id}`} className="text-sky-400 hover:underline">ficha →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
