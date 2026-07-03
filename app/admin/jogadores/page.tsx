"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAdmin, postAdmin } from "@/lib/adminClient";
import { classificarAnomalia, corSeveridade } from "@/lib/economiaAnomalia";
import type { AcaoAdmin } from "@/lib/adminAcoes";
import { Carregando, fmtData, fmtDataHora, Painel, Secao, Vazio } from "@/components/admin/ui";

interface Busca {
  user_id: string;
  nick: string | null;
  email: string | null;
  coinpoints: number;
  role: string;
  banned_at: string | null;
  flagged_at: string | null;
  created_at: string;
}
interface Ficha {
  perfil: (Busca & { user_id: string }) | null;
  save: { updated_at: string; slots: number } | null;
  inventario: { updated_at: string; itens: number; equipado: number } | null;
  passe_nivel: number | null;
  duelos: { jogos: number; vitorias: number; recentes: { quando: string; adv: string; venceu: boolean }[] } | null;
  provas: { semana: number; score: number; invalido: boolean }[];
  coinpoints_soma_eventos: number;
  eventos: { evento: string; props: Record<string, unknown>; quando: string }[];
}

function Chip({ texto, cor }: { texto: string; cor: string }) {
  return <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-zinc-900" style={{ background: cor }}>{texto}</span>;
}

function JogadoresInner() {
  const router = useRouter();
  const params = useSearchParams();
  const alvo = params.get("u");

  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Busca[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);

  // painel de ação (motivo compartilhado — vai pro audit log)
  const [motivo, setMotivo] = useState("");
  const [delta, setDelta] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [executando, setExecutando] = useState(false);

  const buscar = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (termo.trim().length < 1) return;
    setBuscando(true);
    setResultados(null);
    try {
      setResultados(await fetchAdmin<Busca[]>(`jogadores?q=${encodeURIComponent(termo.trim())}`));
    } catch (err) {
      setMsg({ tipo: "erro", texto: String(err) });
    } finally {
      setBuscando(false);
    }
  }, [termo]);

  const carregarFicha = useCallback(async (id: string) => {
    setCarregandoFicha(true);
    setFicha(null);
    try {
      setFicha(await fetchAdmin<Ficha>(`jogadores?u=${encodeURIComponent(id)}`));
    } catch (err) {
      setMsg({ tipo: "erro", texto: String(err) });
    } finally {
      setCarregandoFicha(false);
    }
  }, []);

  useEffect(() => {
    if (alvo) void carregarFicha(alvo);
  }, [alvo, carregarFicha]);

  function abrir(id: string) {
    router.push(`/admin/jogadores?u=${encodeURIComponent(id)}`);
  }

  async function executar(acao: AcaoAdmin, extra: Record<string, unknown> = {}) {
    if (!alvo) return;
    setExecutando(true);
    setMsg(null);
    try {
      await postAdmin("acoes", { acao, alvo, motivo, ...extra });
      setMsg({ tipo: "ok", texto: "Ação registrada e auditada. ✅" });
      setMotivo("");
      setDelta("");
      await carregarFicha(alvo);
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setExecutando(false);
    }
  }

  const p = ficha?.perfil ?? null;
  const anom = p ? classificarAnomalia(Number(p.coinpoints), Number(ficha?.coinpoints_soma_eventos ?? 0)) : null;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Ficha de jogador</h1>

      <form onSubmit={buscar} className="mb-4 flex gap-2">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="nick, e-mail ou user_id"
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
        />
        <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500">Buscar</button>
      </form>

      {buscando && <Carregando />}
      {resultados && resultados.length === 0 && <Vazio msg="Nenhum jogador encontrado." />}
      {resultados && resultados.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded border border-zinc-800">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-2 text-left">Nick</th><th className="px-3 py-2 text-left">E-mail</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-center">Estado</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.user_id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                  <td className="px-3 py-1.5 text-zinc-200">{r.nick ?? "—"}</td>
                  <td className="px-3 py-1.5 text-zinc-500">{r.email ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-amber-300">{Number(r.coinpoints).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-1.5 text-center">
                    {r.banned_at && <Chip texto="BANIDO" cor="#f87171" />}
                    {r.flagged_at && !r.banned_at && <Chip texto="FLAG" cor="#f59e0b" />}
                    {r.role === "admin" && <Chip texto="ADMIN" cor="#38bdf8" />}
                  </td>
                  <td className="px-3 py-1.5 text-right"><button onClick={() => abrir(r.user_id)} className="text-sky-400 hover:underline">abrir →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {carregandoFicha && <Carregando />}

      {ficha && !p && <Vazio msg="Perfil não encontrado para esse ID." />}

      {p && (
        <>
          <Secao titulo={`${p.nick ?? "sem nick"}`} sub={`${p.email ?? "sem e-mail"} · ${p.user_id}`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Painel>
                <p className="text-[11px] uppercase text-zinc-500">CoinPoints</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">{Number(p.coinpoints).toLocaleString("pt-BR")}</p>
                {anom && anom.severidade !== "ok" && (
                  <p className="mt-1 text-[11px]">
                    <Chip texto={`anomalia ${anom.severidade}`} cor={corSeveridade(anom.severidade)} />
                    <span className="ml-1 text-zinc-500">Δ {anom.delta.toLocaleString("pt-BR")} vs eventos</span>
                  </p>
                )}
              </Painel>
              <Painel>
                <p className="text-[11px] uppercase text-zinc-500">Estado</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.banned_at ? <Chip texto="BANIDO" cor="#f87171" /> : <Chip texto="ativo" cor="#34d399" />}
                  {p.flagged_at && <Chip texto="FLAG" cor="#f59e0b" />}
                  {p.role === "admin" && <Chip texto="ADMIN" cor="#38bdf8" />}
                </div>
                {p.banned_at && <p className="mt-1 text-[11px] text-zinc-500">banido em {fmtDataHora(p.banned_at)}</p>}
              </Painel>
              <Painel>
                <p className="text-[11px] uppercase text-zinc-500">Passe · Inventário</p>
                <p className="mt-1 text-sm text-zinc-200">Nível {ficha?.passe_nivel ?? "—"}</p>
                <p className="text-[11px] text-zinc-500">{ficha?.inventario?.itens ?? 0} itens · {ficha?.inventario?.equipado ?? 0} equipados</p>
              </Painel>
              <Painel>
                <p className="text-[11px] uppercase text-zinc-500">Conta</p>
                <p className="mt-1 text-sm text-zinc-200">desde {fmtData(p.created_at)}</p>
                <p className="text-[11px] text-zinc-500">save: {ficha?.save ? fmtData(ficha.save.updated_at) : "nunca"} · {ficha?.save?.slots ?? 0} slots</p>
              </Painel>
            </div>
          </Secao>

          {/* AÇÕES AUDITADAS */}
          <Secao titulo="Ações" sub="Toda ação exige um motivo e é gravada no log de auditoria (Regra 2/3).">
            <Painel>
              <label className="mb-1 block text-[11px] uppercase text-zinc-500">Motivo (obrigatório — vai pro log)</label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="ex: estorno de compra com bug / abuso confirmado no ticket #12"
                className="mb-3 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    inputMode="numeric"
                    placeholder="± CoinPoints"
                    className="w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
                  />
                  <button
                    disabled={executando}
                    onClick={() => executar("ajustar_coinpoints", { delta: Number(delta) })}
                    className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40"
                  >
                    Ajustar saldo
                  </button>
                </div>
                <button disabled={executando} onClick={() => executar(p.flagged_at ? "unflag" : "flag")} className="rounded bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-600 disabled:opacity-40">
                  {p.flagged_at ? "Remover flag" : "Sinalizar suspeita"}
                </button>
                <button disabled={executando} onClick={() => executar(p.banned_at ? "unban" : "ban")} className={`rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 ${p.banned_at ? "bg-emerald-700 hover:bg-emerald-600" : "bg-rose-700 hover:bg-rose-600"}`}>
                  {p.banned_at ? "Desbanir" : "Banir"}
                </button>
              </div>
              {msg && <p className={`mt-2 text-xs ${msg.tipo === "ok" ? "text-emerald-400" : "text-rose-400"}`}>{msg.texto}</p>}
            </Painel>
          </Secao>

          <div className="grid gap-4 lg:grid-cols-2">
            <Secao titulo="Duelos">
              {ficha?.duelos && ficha.duelos.jogos > 0 ? (
                <Painel>
                  <p className="mb-2 text-xs text-zinc-400">{ficha.duelos.vitorias}/{ficha.duelos.jogos} vitórias ({Math.round((ficha.duelos.vitorias / ficha.duelos.jogos) * 100)}%)</p>
                  <ul className="space-y-1 text-[11px]">
                    {ficha.duelos.recentes.map((d, i) => (
                      <li key={i} className="flex justify-between">
                        <span className={d.venceu ? "text-emerald-400" : "text-rose-400"}>{d.venceu ? "V" : "D"} vs {d.adv}</span>
                        <span className="text-zinc-600">{fmtData(d.quando)}</span>
                      </li>
                    ))}
                  </ul>
                </Painel>
              ) : <Vazio msg="Sem duelos." />}
            </Secao>

            <Secao titulo="Provas semanais" sub="Invalidar zera o score visível (preserva o original) e loga.">
              {ficha && ficha.provas.length > 0 ? (
                <Painel>
                  <ul className="space-y-1.5 text-[11px]">
                    {ficha.provas.map((pr) => (
                      <li key={pr.semana} className="flex items-center justify-between gap-2">
                        <span className="text-zinc-300">Semana {pr.semana} · <span className="tabular-nums">{pr.score.toLocaleString("pt-BR")}</span> {pr.invalido && <Chip texto="INVÁLIDO" cor="#f87171" />}</span>
                        <button
                          disabled={executando}
                          onClick={() => executar(pr.invalido ? "revalidar_prova" : "invalidar_prova", { semana: pr.semana })}
                          className="rounded bg-zinc-700 px-2 py-0.5 text-[10px] text-white hover:bg-zinc-600 disabled:opacity-40"
                        >
                          {pr.invalido ? "revalidar" : "invalidar"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Painel>
              ) : <Vazio msg="Sem provas." />}
            </Secao>
          </div>

          <Secao titulo="Últimos 100 eventos" sub="Telemetria bruta — pra reconstruir o que o jogador fez.">
            {ficha && ficha.eventos.length > 0 ? (
              <div className="max-h-96 overflow-y-auto rounded border border-zinc-800">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-1.5 text-left">Quando</th><th className="px-3 py-1.5 text-left">Evento</th><th className="px-3 py-1.5 text-left">Props</th></tr></thead>
                  <tbody>
                    {ficha.eventos.map((e, i) => (
                      <tr key={i} className="border-t border-zinc-800">
                        <td className="whitespace-nowrap px-3 py-1 text-zinc-500">{fmtDataHora(e.quando)}</td>
                        <td className="px-3 py-1 text-zinc-300">{e.evento}</td>
                        <td className="px-3 py-1 font-mono text-zinc-500">{JSON.stringify(e.props)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Vazio msg="Sem eventos." />}
          </Secao>
        </>
      )}
    </div>
  );
}

export default function AdminJogadores() {
  return (
    <Suspense fallback={<Carregando />}>
      <JogadoresInner />
    </Suspense>
  );
}
