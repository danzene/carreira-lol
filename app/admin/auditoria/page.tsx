"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAdmin } from "@/lib/adminClient";
import { ROTULO_ACAO, type AcaoAdmin } from "@/lib/adminAcoes";
import { Carregando, fmtDataHora, Vazio } from "@/components/admin/ui";

interface Linha {
  id: number;
  quando: string;
  admin_nick: string | null;
  acao: string;
  alvo_nick: string | null;
  alvo_user_id: string | null;
  detalhe: Record<string, unknown>;
}

const COR_ACAO: Record<string, string> = {
  ban: "#f87171",
  unban: "#34d399",
  flag: "#f59e0b",
  unflag: "#a1a1aa",
  ajustar_coinpoints: "#fbbf24",
  invalidar_prova: "#f87171",
  revalidar_prova: "#34d399",
  set_config: "#38bdf8",
};

export default function AdminAuditoria() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setLinhas(await fetchAdmin<Linha[]>("auditoria"));
    } catch (e) {
      setErro(String(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erro) return <Vazio msg={`Erro: ${erro}`} />;
  if (!linhas) return <Carregando />;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-zinc-100">Log de auditoria</h1>
      <p className="mb-4 text-xs text-zinc-500">Toda ação administrativa (ajuste de saldo, ban, flag, invalidação, live-ops) fica registrada aqui, com quem fez, quando e por quê.</p>

      {linhas.length === 0 ? (
        <Vazio msg="Nenhuma ação registrada ainda." />
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-800">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-2 text-left">Quando</th><th className="px-3 py-2 text-left">Admin</th><th className="px-3 py-2 text-left">Ação</th><th className="px-3 py-2 text-left">Alvo</th><th className="px-3 py-2 text-left">Motivo / detalhe</th></tr></thead>
            <tbody>
              {linhas.map((l) => {
                const motivo = (l.detalhe?.motivo as string | undefined) ?? "";
                const extra = Object.entries(l.detalhe ?? {}).filter(([k]) => k !== "motivo").map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(" · ");
                return (
                  <tr key={l.id} className="border-t border-zinc-800 align-top">
                    <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">{fmtDataHora(l.quando)}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{l.admin_nick ?? "—"}</td>
                    <td className="px-3 py-1.5"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-zinc-900" style={{ background: COR_ACAO[l.acao] ?? "#71717a" }}>{ROTULO_ACAO[l.acao as AcaoAdmin] ?? l.acao}</span></td>
                    <td className="px-3 py-1.5">
                      {l.alvo_user_id ? <Link href={`/admin/jogadores?u=${l.alvo_user_id}`} className="text-sky-400 hover:underline">{l.alvo_nick ?? "ficha"}</Link> : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-400">
                      {motivo && <span className="text-zinc-200">{motivo}</span>}
                      {extra && <span className="ml-1 text-[11px] text-zinc-600">({extra})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
