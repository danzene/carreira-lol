"use client";

import { useEffect, useState } from "react";
import { ATRIBUTOS } from "@/data/config";
import type { LocalMapa, Momento, OpcaoDecisao, RoteiroPartida } from "@/engine/partida";
import type { Campeao } from "@/lib/ddragon";

const POS: Record<LocalMapa, { x: number; y: number }> = {
  TOP: { x: 45, y: 62 },
  MID: { x: 100, y: 100 },
  BOT: { x: 155, y: 138 },
  DRAGAO: { x: 128, y: 120 },
  BARAO: { x: 72, y: 80 },
  RIO: { x: 112, y: 92 },
};

interface LinhaLog {
  texto: string;
  tom: "bom" | "ruim" | "neutro";
}

export default function MapaPartida({
  roteiro,
  campeao,
  onFim,
}: {
  roteiro: RoteiroPartida;
  campeao?: Campeao;
  onFim: (modificador: number) => void;
}) {
  const [minuto, setMinuto] = useState(0);
  const [modificador, setModificador] = useState(0);
  const [log, setLog] = useState<LinhaLog[]>([]);
  const [decisao, setDecisao] = useState<Momento | null>(null);
  const [terminado, setTerminado] = useState(false);
  const [local, setLocal] = useState<LocalMapa>("MID");

  useEffect(() => {
    if (decisao || terminado) return;
    if (minuto >= roteiro.duracaoMin) {
      setTerminado(true);
      return;
    }
    const id = setTimeout(() => {
      const prox = minuto + 1;

      const flavs = roteiro.flavor.filter((f) => f.minuto === prox);
      if (flavs.length > 0) {
        setLog((l) => [...flavs.map((f) => ({ texto: `${prox}' ${f.texto}`, tom: "neutro" as const })), ...l]);
        setLocal(flavs[0].local);
      }

      const mom = roteiro.momentos.find((m) => m.minuto === prox);
      if (mom) {
        setDecisao(mom);
        setLocal(mom.local);
      }

      setMinuto(prox);
    }, 480);
    return () => clearTimeout(id);
  }, [minuto, decisao, terminado, roteiro]);

  function escolher(op: OpcaoDecisao, minutoMom: number) {
    setModificador((m) => m + op.efeito);
    setLog((l) => [{ texto: `${minutoMom}' ${op.consequencia}`, tom: op.efeito >= 0 ? "bom" : "ruim" }, ...l]);
    setDecisao(null);
  }

  const nomeAtributo = (k: OpcaoDecisao["atributo"]) => ATRIBUTOS.find((a) => a.chave === k)?.nome ?? k;
  const p = POS[local];
  const progresso = Math.min(100, (minuto / roteiro.duracaoMin) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* timeline */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-400">
          <span>{minuto}&apos; / {roteiro.duracaoMin}&apos;</span>
          <span>
            Impacto:{" "}
            <span className={modificador >= 0 ? "text-emerald-400" : "text-red-400"}>
              {modificador >= 0 ? "+" : ""}
              {modificador}
            </span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-borda">
          <div
            className="h-full rounded-full bg-gradient-to-r from-destaque to-destaque2 transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      {/* mapa Summoner's Rift estilizado */}
      <div className="relative mx-auto w-full max-w-sm">
        <svg viewBox="0 0 200 200" className="w-full rounded-xl border border-borda">
          <rect x="2" y="2" width="196" height="196" rx="14" fill="#0d1117" />
          {/* lanes */}
          <polyline points="28,172 28,28 172,28" fill="none" stroke="#23233a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="28,172 172,172 172,28" fill="none" stroke="#23233a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="42" y1="158" x2="158" y2="42" stroke="#23233a" strokeWidth="7" strokeLinecap="round" />
          {/* river */}
          <line x1="36" y1="36" x2="164" y2="164" stroke="#1e3a5f" strokeWidth="16" strokeLinecap="round" opacity="0.55" />
          {/* pits */}
          <circle cx="128" cy="120" r="9" fill="#3a2a1a" stroke="#7a5a2a" strokeWidth="1.5" />
          <circle cx="72" cy="80" r="9" fill="#2a1a3a" stroke="#7a2a9a" strokeWidth="1.5" />
          {/* bases */}
          <circle cx="26" cy="174" r="13" fill="#16324f" stroke="#2f6fb0" strokeWidth="2" />
          <circle cx="174" cy="26" r="13" fill="#4f1620" stroke="#b02f3f" strokeWidth="2" />
          {/* torres */}
          {[
            [28, 110], [28, 60], [60, 28], [110, 28], [86, 114], [114, 86], [172, 90], [172, 140], [90, 172], [140, 172],
          ].map(([cx, cy], i) => (
            <rect key={i} x={cx - 2.5} y={cy - 2.5} width="5" height="5" rx="1" fill="#3a3a4f" />
          ))}
          {/* marcador da ação */}
          <circle cx={p.x} cy={p.y} r="9" fill="#6d28d9" opacity="0.35">
            <animate attributeName="r" values="7;15;7" dur="1.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.05;0.4" dur="1.3s" repeatCount="indefinite" />
          </circle>
          <circle cx={p.x} cy={p.y} r="4.5" fill="#22d3ee" />
        </svg>
        {campeao && (
          <img
            src={campeao.icone}
            alt=""
            width={30}
            height={30}
            className="absolute h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-destaque2 shadow-lg transition-all duration-500"
            style={{ left: `${(p.x / 200) * 100}%`, top: `${(p.y / 200) * 100}%` }}
          />
        )}
      </div>

      {/* feed de eventos */}
      <div className="h-24 overflow-y-auto rounded-xl border border-borda bg-painel p-3 text-sm">
        {log.length === 0 ? (
          <p className="text-zinc-600">A partida começou… acompanhe o mapa.</p>
        ) : (
          log.map((l, i) => (
            <p
              key={i}
              className={l.tom === "bom" ? "text-emerald-400" : l.tom === "ruim" ? "text-red-400" : "text-zinc-400"}
            >
              {l.texto}
            </p>
          ))
        )}
      </div>

      {/* decisão */}
      {decisao && (
        <div className="rounded-xl border border-destaque/50 bg-destaque/10 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-100">
            {decisao.minuto}&apos; — {decisao.contexto}
          </p>
          <div className="flex flex-col gap-2">
            {decisao.opcoes.map((op, i) => (
              <button
                key={i}
                type="button"
                onClick={() => escolher(op, decisao.minuto)}
                className="flex items-center justify-between gap-2 rounded-lg border border-borda bg-painel px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:border-destaque"
              >
                <span>{op.texto}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600">{nomeAtributo(op.atributo)}</span>
                  {op.arriscada && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
                      risco
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* fim */}
      {terminado && !decisao && (
        <button
          type="button"
          onClick={() => onFim(modificador)}
          className="rounded-xl bg-emerald-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-600"
        >
          Ver resultado
        </button>
      )}
    </div>
  );
}
