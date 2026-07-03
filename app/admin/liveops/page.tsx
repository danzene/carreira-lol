"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdmin, postAdmin } from "@/lib/adminClient";
import type { FlagChave, LiveConfig, MensagemDoDia } from "@/lib/liveops";
import { AvisoDados, Carregando, fmtDataHora, Painel, Secao, Vazio } from "@/components/admin/ui";

interface ConfigRow {
  chave: string;
  valor: unknown;
  publica: boolean;
  updated_at: string;
}

const FLAGS: { chave: FlagChave; rotulo: string }[] = [
  { chave: "gacha", rotulo: "Gacha" },
  { chave: "duelo_online", rotulo: "Duelo online" },
  { chave: "prova_semanal", rotulo: "Prova semanal" },
  { chave: "compartilhamento", rotulo: "Compartilhar cartão" },
];

export default function AdminLiveOps() {
  const [rows, setRows] = useState<ConfigRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [flags, setFlags] = useState<Partial<Record<FlagChave, boolean>>>({});
  const [msgDia, setMsgDia] = useState<MensagemDoDia>({ ativo: false, titulo: "", texto: "", tipo: "info" });
  const [motivoFlags, setMotivoFlags] = useState("");
  const [motivoMsg, setMotivoMsg] = useState("");
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await fetchAdmin<ConfigRow[]>("config");
      setRows(r);
      const ff = r.find((x) => x.chave === "feature_flags")?.valor as LiveConfig["feature_flags"] | undefined;
      const md = r.find((x) => x.chave === "mensagem_do_dia")?.valor as MensagemDoDia | undefined;
      setFlags(ff ?? {});
      setMsgDia({ ativo: md?.ativo ?? false, titulo: md?.titulo ?? "", texto: md?.texto ?? "", tipo: md?.tipo ?? "info" });
    } catch (e) {
      setErro(String(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(chave: string, valor: unknown, motivo: string) {
    if (motivo.trim().length < 3) {
      setFeedback({ tipo: "erro", texto: "Informe um motivo (mín. 3 caracteres) — vai pro log." });
      return;
    }
    setSalvando(true);
    setFeedback(null);
    try {
      await postAdmin("config", { chave, valor, motivo });
      setFeedback({ tipo: "ok", texto: "Config salva. O jogo aplica na próxima leitura (sem deploy). ✅" });
      setMotivoFlags("");
      setMotivoMsg("");
      await carregar();
    } catch (e) {
      setFeedback({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setSalvando(false);
    }
  }

  if (!rows && !erro) return <Carregando />;
  if (erro) return <Vazio msg={`Erro: ${erro}`} />;

  const updFlags = rows?.find((x) => x.chave === "feature_flags")?.updated_at;
  const updMsg = rows?.find((x) => x.chave === "mensagem_do_dia")?.updated_at;

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-zinc-100">Live-Ops</h1>
      <AvisoDados>
        As flags são lidas pelo jogo em modo <b>fail-open</b>: se a leitura falhar ou a chave sumir, a feature fica
        LIGADA. Desligar aqui é um <b>kill switch</b> — reflete no jogo sem novo deploy.
      </AvisoDados>

      {feedback && <p className={`mb-3 text-xs ${feedback.tipo === "ok" ? "text-emerald-400" : "text-rose-400"}`}>{feedback.texto}</p>}

      <Secao titulo="Feature flags (kill switches)" sub={updFlags ? `atualizado ${fmtDataHora(updFlags)}` : undefined}>
        <Painel>
          <div className="grid gap-2 sm:grid-cols-2">
            {FLAGS.map((f) => {
              const ligada = flags[f.chave] !== false;
              return (
                <label key={f.chave} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <span className="text-sm text-zinc-200">{f.rotulo}</span>
                  <button
                    onClick={() => setFlags((s) => ({ ...s, [f.chave]: !ligada }))}
                    className={`rounded px-2 py-1 text-xs font-bold ${ligada ? "bg-emerald-600 text-white" : "bg-rose-700 text-white"}`}
                  >
                    {ligada ? "LIGADA" : "DESLIGADA"}
                  </button>
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={motivoFlags}
              onChange={(e) => setMotivoFlags(e.target.value)}
              placeholder="motivo (ex: desligar gacha durante incidente)"
              className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
            />
            <button
              disabled={salvando}
              onClick={() => salvar("feature_flags", { duelo_online: flags.duelo_online !== false, prova_semanal: flags.prova_semanal !== false, gacha: flags.gacha !== false, compartilhamento: flags.compartilhamento !== false }, motivoFlags)}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Salvar flags
            </button>
          </div>
        </Painel>
      </Secao>

      <Secao titulo="Mensagem do dia" sub={updMsg ? `atualizado ${fmtDataHora(updMsg)}` : undefined}>
        <Painel>
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={msgDia.ativo ?? false} onChange={(e) => setMsgDia((s) => ({ ...s, ativo: e.target.checked }))} />
            Mostrar banner no jogo
          </label>
          <div className="mt-3 grid gap-2">
            <input
              value={msgDia.titulo ?? ""}
              onChange={(e) => setMsgDia((s) => ({ ...s, titulo: e.target.value }))}
              placeholder="Título"
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
            />
            <textarea
              value={msgDia.texto ?? ""}
              onChange={(e) => setMsgDia((s) => ({ ...s, texto: e.target.value }))}
              placeholder="Texto do aviso (ex: manutenção às 22h, novidade no gacha...)"
              rows={2}
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
            />
            <select
              value={msgDia.tipo ?? "info"}
              onChange={(e) => setMsgDia((s) => ({ ...s, tipo: e.target.value as "info" | "aviso" }))}
              className="w-40 rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
            >
              <option value="info">info (azul)</option>
              <option value="aviso">aviso (âmbar)</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={motivoMsg}
              onChange={(e) => setMotivoMsg(e.target.value)}
              placeholder="motivo (ex: comunicar manutenção)"
              className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-600"
            />
            <button
              disabled={salvando}
              onClick={() => salvar("mensagem_do_dia", msgDia, motivoMsg)}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Salvar mensagem
            </button>
          </div>
        </Painel>
      </Secao>
    </div>
  );
}
