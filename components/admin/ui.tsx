"use client";

import { useMemo, useState, type ReactNode } from "react";

// 📊 Primitivas do admin — SVG leve (sem dependência), dark e denso. Não é pixel art.

export function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-0.5 text-sm font-semibold text-zinc-200">{titulo}</h2>
      {sub && <p className="mb-2 text-xs text-zinc-500">{sub}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Painel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded border border-zinc-800 bg-zinc-900/60 p-3 ${className}`}>{children}</div>;
}

export function KpiCard({ rotulo, valor, anterior, formato }: { rotulo: string; valor: number; anterior?: number; formato?: (n: number) => string }) {
  const fmt = formato ?? ((n: number) => n.toLocaleString("pt-BR"));
  const delta = anterior !== undefined && anterior > 0 ? Math.round(((valor - anterior) / anterior) * 100) : null;
  return (
    <Painel>
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-100">{fmt(valor)}</p>
      {delta !== null && (
        <p className={`mt-0.5 text-xs ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs período anterior
        </p>
      )}
    </Painel>
  );
}

// Série temporal (linha). dados = [{ x: label, y: número }].
export function LineChart({ dados, altura = 160, cor = "#38bdf8" }: { dados: { x: string; y: number }[]; altura?: number; cor?: string }) {
  const W = 600;
  const H = altura;
  const pad = 28;
  if (dados.length === 0) return <Vazio />;
  const max = Math.max(1, ...dados.map((d) => d.y));
  const px = (i: number) => pad + (i / Math.max(1, dados.length - 1)) * (W - pad * 2);
  const py = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const pontos = dados.map((d, i) => `${px(i)},${py(d.y)}`).join(" ");
  const passo = Math.ceil(dados.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: altura }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#3f3f46" strokeWidth="1" />
      <text x={pad} y={12} fill="#71717a" fontSize="10">
        máx {max.toLocaleString("pt-BR")}
      </text>
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth="2" />
      {dados.map((d, i) => (
        <circle key={i} cx={px(i)} cy={py(d.y)} r="2" fill={cor} />
      ))}
      {dados.map((d, i) => (i % passo === 0 ? <text key={`l${i}`} x={px(i)} y={H - pad + 12} fill="#71717a" fontSize="9" textAnchor="middle">{d.x}</text> : null))}
    </svg>
  );
}

// Barras (distribuições). dados = [{ x, y, cor? }].
export function BarChart({ dados, altura = 180 }: { dados: { x: string; y: number; cor?: string }[]; altura?: number }) {
  const W = 600;
  const H = altura;
  const pad = 28;
  if (dados.length === 0) return <Vazio />;
  const max = Math.max(1, ...dados.map((d) => d.y));
  const bw = ((W - pad * 2) / dados.length) * 0.7;
  const gap = ((W - pad * 2) / dados.length) * 0.3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: altura }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#3f3f46" strokeWidth="1" />
      {dados.map((d, i) => {
        const x = pad + i * (bw + gap);
        const h = (d.y / max) * (H - pad * 2);
        return (
          <g key={i}>
            <rect x={x} y={H - pad - h} width={bw} height={h} fill={d.cor ?? "#38bdf8"} rx="1" />
            <text x={x + bw / 2} y={H - pad - h - 3} fill="#a1a1aa" fontSize="9" textAnchor="middle">{d.y}</text>
            <text x={x + bw / 2} y={H - pad + 12} fill="#71717a" fontSize="9" textAnchor="middle">{d.x}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Funil: etapas com contagem + % de conversão em relação à etapa anterior e ao topo.
export function FunnelChart({ etapas }: { etapas: { rotulo: string; valor: number }[] }) {
  if (etapas.length === 0) return <Vazio />;
  const topo = etapas[0].valor || 1;
  return (
    <div className="flex flex-col gap-1">
      {etapas.map((e, i) => {
        const pctTopo = Math.round((e.valor / topo) * 100);
        const anterior = i > 0 ? etapas[i - 1].valor || 1 : e.valor || 1;
        const pctAnt = i > 0 ? Math.round((e.valor / anterior) * 100) : 100;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="w-40 shrink-0 text-right text-xs text-zinc-400">{e.rotulo}</div>
            <div className="relative h-6 flex-1 rounded bg-zinc-800">
              <div className="absolute inset-y-0 left-0 rounded bg-sky-600/70" style={{ width: `${pctTopo}%` }} />
              <div className="absolute inset-0 flex items-center px-2 text-[11px] text-zinc-100">
                {e.valor.toLocaleString("pt-BR")} <span className="ml-2 text-zinc-400">({pctTopo}% do topo)</span>
              </div>
            </div>
            <div className={`w-14 shrink-0 text-right text-xs ${i > 0 && pctAnt < 60 ? "text-rose-400" : "text-zinc-500"}`}>
              {i > 0 ? `${pctAnt}%` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Coluna<T> = { chave: keyof T; rotulo: string; render?: (v: T) => ReactNode; num?: boolean };

export function DataTable<T extends Record<string, unknown>>({ colunas, dados, porPagina = 20 }: { colunas: Coluna<T>[]; dados: T[]; porPagina?: number }) {
  const [ordenar, setOrdenar] = useState<{ chave: keyof T; desc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);
  const ordenados = useMemo(() => {
    if (!ordenar) return dados;
    const c = ordenar.chave;
    return [...dados].sort((a, b) => {
      const va = a[c];
      const vb = b[c];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return ordenar.desc ? -cmp : cmp;
    });
  }, [dados, ordenar]);
  const paginas = Math.ceil(ordenados.length / porPagina);
  const fatia = ordenados.slice(pagina * porPagina, (pagina + 1) * porPagina);
  if (dados.length === 0) return <Vazio />;
  return (
    <div className="overflow-x-auto rounded border border-zinc-800">
      <table className="w-full text-xs">
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            {colunas.map((c) => (
              <th
                key={String(c.chave)}
                onClick={() => setOrdenar((o) => ({ chave: c.chave, desc: o?.chave === c.chave ? !o.desc : true }))}
                className={`cursor-pointer select-none px-3 py-2 font-medium ${c.num ? "text-right" : "text-left"} hover:text-zinc-200`}
              >
                {c.rotulo} {ordenar?.chave === c.chave ? (ordenar.desc ? "▼" : "▲") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fatia.map((linha, i) => (
            <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-900/50">
              {colunas.map((c) => (
                <td key={String(c.chave)} className={`px-3 py-1.5 text-zinc-300 ${c.num ? "text-right tabular-nums" : "text-left"}`}>
                  {c.render ? c.render(linha) : String(linha[c.chave] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {paginas > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
          <span>{ordenados.length} linhas</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0} className="disabled:opacity-30">
              ◀
            </button>
            <span>
              {pagina + 1}/{paginas}
            </span>
            <button onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))} disabled={pagina >= paginas - 1} className="disabled:opacity-30">
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Vazio({ msg = "Sem dados no período." }: { msg?: string }) {
  return <div className="rounded border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-600">{msg}</div>;
}

export function Carregando() {
  return <div className="animate-pulse rounded border border-zinc-800 bg-zinc-900/40 p-6 text-center text-xs text-zinc-600">Carregando…</div>;
}

// Aviso de métrica que só terá dados daqui pra frente (evento novo).
export function AvisoDados({ children }: { children: ReactNode }) {
  return <p className="mb-2 rounded border border-amber-700/40 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-300/90">ⓘ {children}</p>;
}
