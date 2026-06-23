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
        setErro("Não consegui carregar os campeões. Verifique a conexão e recarregue.");
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
    if (selecionados.includes(id)) onChange(selecionados.filter((x) => x !== id));
    else if (selecionados.length < CRIACAO.tamanhoPool) onChange([...selecionados, id]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar campeão…"
          className="flex-1 border-2 border-borda bg-painel px-3 py-2 text-sm text-texto placeholder:text-suave focus:border-rosa focus:outline-none"
        />
        <span className="shrink-0 font-pixel text-[10px] text-suave">
          {selecionados.length}/{CRIACAO.tamanhoPool}
        </span>
      </div>

      {carregando && <p className="py-8 text-center text-sm text-suave">Carregando campeões…</p>}
      {erro && <p className="py-8 text-center text-sm text-rosa">{erro}</p>}

      {!carregando && !erro && (
        <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto border-2 border-borda bg-fundo/40 p-2 sm:grid-cols-5">
          {filtrados.map((c) => {
            const sel = selecionados.includes(c.id);
            const bloq = !sel && selecionados.length >= CRIACAO.tamanhoPool;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternar(c.id)}
                disabled={bloq}
                className={`flex flex-col items-center gap-1 border-2 p-1.5 transition ${
                  sel ? "border-rosa bg-rosa/10" : "border-transparent hover:border-borda"
                } ${bloq ? "opacity-30" : ""}`}
              >
                <img src={c.icone} alt={c.nome} width={48} height={48} loading="lazy" className="h-12 w-12" />
                <span className="w-full truncate text-center text-[10px] text-suave">{c.nome}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
