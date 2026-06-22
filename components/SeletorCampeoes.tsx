"use client";

import { useEffect, useMemo, useState } from "react";
import { CRIACAO } from "@/data/config";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";

export default function SeletorCampeoes({
  selecionados,
  onChange,
}: {
  selecionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    buscarCampeoes()
      .then((cs) => {
        if (!vivo) return;
        setCampeoes(cs);
        setCarregando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setErro("Não consegui carregar os campeões. Verifique sua conexão e recarregue a página.");
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const filtrados = useMemo(
    () => campeoes.filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase())),
    [campeoes, busca],
  );

  function alternar(id: string) {
    if (selecionados.includes(id)) {
      onChange(selecionados.filter((x) => x !== id));
    } else if (selecionados.length < CRIACAO.tamanhoPool) {
      onChange([...selecionados, id]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar campeão…"
          className="flex-1 rounded-lg border border-borda bg-painel px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-destaque focus:outline-none"
        />
        <span className="shrink-0 text-sm font-semibold text-zinc-400">
          {selecionados.length}/{CRIACAO.tamanhoPool}
        </span>
      </div>

      {carregando && <p className="py-8 text-center text-sm text-zinc-500">Carregando campeões…</p>}
      {erro && <p className="py-8 text-center text-sm text-red-400">{erro}</p>}

      {!carregando && !erro && (
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-borda bg-fundo/40 p-2 sm:grid-cols-5">
          {filtrados.map((c) => {
            const sel = selecionados.includes(c.id);
            const bloqueado = !sel && selecionados.length >= CRIACAO.tamanhoPool;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternar(c.id)}
                disabled={bloqueado}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                  sel ? "border-destaque bg-destaque/15" : "border-transparent hover:border-borda"
                } ${bloqueado ? "opacity-30" : ""}`}
              >
                <img
                  src={c.icone}
                  alt={c.nome}
                  width={48}
                  height={48}
                  loading="lazy"
                  className="h-12 w-12 rounded-md"
                />
                <span className="w-full truncate text-center text-[10px] text-zinc-400">{c.nome}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
