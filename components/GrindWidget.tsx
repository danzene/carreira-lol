"use client";

import { useEffect, useRef, useState } from "react";
import { GRIND } from "@/data/grind";
import { grindDisponivel, placarDoDia, tetoAtingido } from "@/engine/grind";
import { tocarSom } from "@/lib/som";
import { rastrear } from "@/lib/telemetria";
import { useCareer } from "@/store/careerStore";

// 🛋️ Widget do Grind de Normais — presença compacta e persistente (todas as rotas).
// A UI só ENCENA o que o engine já decidiu em lote (resolverGrind); o heartbeat conta
// SEGUNDOS DE ABA VISÍVEL (nunca relógio) e é 1 intervalo simples (Regra 7: CPU ~0
// em segundo plano — aba oculta ⇒ o tick sai no guard, sem render, sem animação).

const TICK_SEG = 5;
const TITULO_PADRAO = "Carreira LoL";

function fmtRestante(seg: number): string {
  const s = Math.max(0, seg);
  const h = Math.floor(s / 3600);
  const m = Math.ceil((s % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

interface Resumo {
  v: number;
  d: number;
  dinheiro: number;
}

export default function GrindWidget() {
  const career = useCareer((s) => s.career);
  const resultado = useCareer((s) => s.grindResultado);
  const tick = useCareer((s) => s.tickGrind);
  const alternar = useCareer((s) => s.alternarGrind);

  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [flash, setFlash] = useState<"v" | "d" | null>(null);
  const vistoRef = useRef(0); // nº de completas já vistas (pro resumo "enquanto você estava fora")
  const completasRef = useRef(0); // detecção de partida nova (micro-celebração)

  // heartbeat roda sempre que a feature existe; `oculto` esconde SÓ o visual
  // (config: com o widget oculto o grind segue acumulando se ligado).
  const ativo = !!career && grindDisponivel(career);
  const oculto = career?.opcoes?.ocultarGrind === true;
  const ligado = career?.grind?.ligado ?? true;

  // ---- heartbeat: 1 intervalo; só CONTA com a aba visível (Regra 4-5) ----
  useEffect(() => {
    if (!ativo) return;
    tick(0); // mount/carreira trocada: resolve pendências sem somar tempo
    const id = setInterval(() => {
      if (document.visibilityState === "visible") tick(TICK_SEG);
    }, TICK_SEG * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, career?.grind?.ligado]);

  // ---- visibilitychange: voltou ⇒ resumo do que fechou sem você olhar + retoma ----
  useEffect(() => {
    if (!ativo) return;
    const aoMudar = () => {
      if (document.visibilityState !== "visible") return;
      const total = useCareer.getState().grindResultado?.completas.length ?? 0;
      const pendentes = useCareer.getState().grindResultado?.completas.slice(vistoRef.current) ?? [];
      if (pendentes.length > 0) {
        const v = pendentes.filter((p) => p.vitoria).length;
        setResumo({ v, d: pendentes.length - v, dinheiro: pendentes.reduce((s, p) => s + p.dinheiro, 0) });
        rastrear("grind_resumo_visto", { partidas: pendentes.length });
      }
      vistoRef.current = total;
      tick(0);
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // ---- micro-celebração (flash + som curto) quando uma partida fecha COM a aba visível ----
  const completas = resultado?.completas ?? [];
  useEffect(() => {
    const n = completas.length;
    const antes = completasRef.current;
    completasRef.current = n;
    if (antes === 0 || n <= antes) {
      if (document.visibilityState === "visible") vistoRef.current = n;
      return;
    }
    if (document.visibilityState !== "visible") return; // oculto: sem som/animação (Regra 7)
    vistoRef.current = n;
    const ultima = completas[n - 1];
    setFlash(ultima.vitoria ? "v" : "d");
    if (ultima.vitoria) tocarSom("moeda");
    if (ultima.drop) tocarSom("tier2");
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completas.length]);

  // ---- título da aba: placar enquanto o grind roda; restaura ao desligar ----
  const placar = resultado ? placarDoDia(resultado) : { v: 0, d: 0 };
  useEffect(() => {
    if (!ativo || !ligado) {
      document.title = TITULO_PADRAO;
      return;
    }
    document.title = `⚔️ ${placar.v}V ${placar.d}D · Grind ativo`;
    return () => {
      document.title = TITULO_PADRAO;
    };
  }, [ativo, ligado, placar.v, placar.d]);

  if (!ativo || oculto) return null;

  const g = career.grind;
  const segundos = g?.segundosHoje ?? 0;
  const pctTeto = Math.min(100, Math.round((segundos / GRIND.tetoSegundosDia) * 100));
  const noTeto = g ? tetoAtingido(g) : false;
  const atual = resultado?.atual ?? null;
  const dinheiroHoje = completas.reduce((s, p) => s + p.dinheiro, 0);
  const pctPartida = atual ? Math.min(100, Math.round(((segundos - atual.inicioSeg) / atual.duracaoSeg) * 100)) : 0;

  const corFlash = flash === "v" ? "border-emerald-400" : flash === "d" ? "border-rosa" : "border-borda";

  // ---- colapsado: pílula discreta (mobile) / mini-card (desktop) ----
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setResumo(null);
        }}
        className={`fixed bottom-2 right-2 z-30 flex items-center gap-2 border-2 bg-painel/95 px-2.5 py-1.5 shadow-lg backdrop-blur transition-colors sm:bottom-3 sm:right-3 ${corFlash}`}
        title="Grind de Normais — clique pra abrir"
      >
        <span className="text-[13px]">{ligado ? (noTeto ? "😴" : "⚔️") : "⏸️"}</span>
        <span className="font-pixel text-[9px] text-texto">
          <span className="text-emerald-400">{placar.v}V</span> <span className="text-rosa">{placar.d}D</span>
        </span>
        {resumo && (resumo.v > 0 || resumo.d > 0) && <span className="h-1.5 w-1.5 rounded-full bg-ciano" title="Resumo pendente" />}
        {noTeto && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Teto do dia atingido" />}
        <span className="hidden h-1 w-10 overflow-hidden border border-borda bg-fundo sm:block" title={`${pctTeto}% do teto diário`}>
          <span className="block h-full bg-gradient-to-r from-ciano to-rosa transition-all duration-700" style={{ width: `${pctTeto}%` }} />
        </span>
      </button>
    );
  }

  // ---- expandido: painel (desktop) / bottom sheet (mobile) ----
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-borda bg-fundo/98 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-3 sm:right-3 sm:w-80 sm:border-2">
      <div className="flex items-center justify-between border-b-2 border-borda bg-painel px-3 py-2">
        <span className="font-pixel text-[10px] text-ciano">🛋️ GRIND DE NORMAIS</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={alternar}
            className={`border px-2 py-0.5 font-pixel text-[8px] transition ${ligado ? "border-rosa text-rosa hover:bg-rosa hover:text-fundo" : "border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-fundo"}`}
          >
            {ligado ? "PAUSAR" : "LIGAR"}
          </button>
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="px-1 text-suave transition hover:text-texto">
            ▾
          </button>
        </div>
      </div>

      <div className="max-h-[55vh] overflow-y-auto p-3 sm:max-h-none">
        {/* resumo "enquanto você estava fora" */}
        {resumo && (resumo.v > 0 || resumo.d > 0) && (
          <button
            type="button"
            onClick={() => setResumo(null)}
            className="mb-2 w-full border-2 border-ciano/50 bg-ciano/10 px-2 py-1.5 text-left text-[11px] text-texto"
          >
            Enquanto você olhava outra aba: <span className="text-emerald-400">+{resumo.v}V</span>{" "}
            <span className="text-rosa">{resumo.d}D</span> · <span className="text-emerald-300">+${resumo.dinheiro}</span>{" "}
            <span className="text-suave">(toque pra dispensar)</span>
          </button>
        )}

        {/* estado atual */}
        {!ligado ? (
          <p className="mb-2 text-[11px] text-suave">Grind pausado. Seu jogador está fora da fila.</p>
        ) : noTeto ? (
          <div className="mb-2 border-2 border-amber-500/40 bg-amber-900/15 px-2 py-1.5 text-[11px] text-amber-200">
            😴 Cansou por hoje! Rendeu o teto de {Math.round(GRIND.tetoSegundosDia / 3600)}h. Volta amanhã.
          </div>
        ) : atual ? (
          <div className="mb-2 border-2 border-borda bg-painel p-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-texto">
                ⚔️ <b>{atual.championId}</b> vs <span className="text-suave">{atual.adversario}</span>
              </span>
              <span className="font-pixel text-[8px] text-ciano">AO VIVO</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden border border-borda bg-fundo">
              <div className="h-full bg-gradient-to-r from-ciano to-emerald-400 transition-all duration-[5000ms] ease-linear" style={{ width: `${pctPartida}%` }} />
            </div>
          </div>
        ) : (
          <p className="mb-2 text-[11px] text-suave">Procurando partida…</p>
        )}

        {/* totais do dia + teto */}
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-suave">
            Hoje: <span className="text-emerald-400">{placar.v}V</span> <span className="text-rosa">{placar.d}D</span> ·{" "}
            <span className="text-emerald-300">+${dinheiroHoje}</span>
          </span>
          <span className="text-suave" title="O grind rende no máximo 3h de ganho por dia — depois o jogador descansa.">
            {noTeto ? "teto ✔" : `⏳ ${fmtRestante(GRIND.tetoSegundosDia - segundos)}`}
          </span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden border border-borda bg-fundo" title={`${pctTeto}% do teto diário`}>
          <div className="h-full bg-gradient-to-r from-ciano to-rosa transition-all duration-700" style={{ width: `${pctTeto}%` }} />
        </div>

        {/* últimas partidas do dia */}
        {completas.length > 0 && (
          <ul className="flex flex-col gap-1">
            {completas
              .slice(-8)
              .reverse()
              .map((p) => (
                <li key={p.idx} className="flex items-center justify-between border border-borda bg-painel/60 px-2 py-1 text-[11px]">
                  <span className="truncate">
                    <span className={p.vitoria ? "text-emerald-400" : "text-rosa"}>{p.vitoria ? "V" : "D"}</span>{" "}
                    <span className="text-texto">{p.championId}</span>{" "}
                    <span className="text-suave">
                      {p.kda.k}/{p.kda.d}/{p.kda.a}
                    </span>
                  </span>
                  <span className="shrink-0 text-suave">
                    {p.dinheiro > 0 ? `+$${p.dinheiro}` : `+${p.maestria} maestria`}
                    {p.drop && <span title="Dropou item Comum"> 🎒</span>}
                  </span>
                </li>
              ))}
          </ul>
        )}

        <p className="mt-2 text-[10px] text-suave">
          Seu jogador joga normais sozinho enquanto o jogo está aberto e visível. Rende $ pequeno, maestria e às vezes um
          item Comum — até {Math.round(GRIND.tetoSegundosDia / 3600)}h por dia.
        </p>
        <button
          type="button"
          onClick={() => useCareer.getState().alternarOcultarGrind()}
          className="mt-1 text-[10px] text-suave underline-offset-2 transition hover:text-texto hover:underline"
          title="O grind continua acumulando se estiver ligado. Reative no painel de som (🔊 no topo)."
        >
          ocultar widget
        </button>
      </div>
    </div>
  );
}
