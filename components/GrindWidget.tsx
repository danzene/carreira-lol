"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GRIND } from "@/data/grind";
import { grindDisponivel, placarDoDia, tetoAtingido } from "@/engine/grind";
import { tocarSom } from "@/lib/som";
import { rastrear } from "@/lib/telemetria";
import { useCareer } from "@/store/careerStore";
import DioramaGrind from "./grind/DioramaGrind";
import { grindVisivel } from "./grind/pip";
import { modoVisualGrind } from "./grind/visual";

// 🛋️ Coordenador do Grind de Normais: heartbeat de segundos VISÍVEIS (aba visível OU
// janela PiP aberta — guard único, sem dupla contagem), resumo de retorno, título e
// favicon da aba. Apresentação: DIORAMA animado por padrão; a pílula vive como
// preferência (config), kill switch visual e estado recolhido.

const TICK_SEG = 5;
const TITULO_PADRAO = "Carreira LoL";

export default function GrindWidget() {
  const pathname = usePathname();
  const career = useCareer((s) => s.career);
  const resultado = useCareer((s) => s.grindResultado);
  const tick = useCareer((s) => s.tickGrind);
  const resumo = useCareer((s) => s.grindResumo);
  const definirResumo = useCareer((s) => s.definirGrindResumo);

  const [minimizado, setMinimizado] = useState(false); // strip recolhida em pílula (sessão)
  const [flash, setFlash] = useState<"v" | "d" | null>(null);
  const vistoRef = useRef(0);
  const completasRef = useRef(0);

  const ativo = !!career && grindDisponivel(career);
  const oculto = career?.opcoes?.ocultarGrind === true;
  const usaPilula = modoVisualGrind(career?.opcoes, minimizado) === "pilula";
  const ligado = career?.grind?.ligado ?? true;

  // ---- heartbeat: 1 intervalo; conta com aba visível OU PiP aberta ----
  useEffect(() => {
    if (!ativo) return;
    tick(0);
    const id = setInterval(() => {
      if (grindVisivel()) tick(TICK_SEG);
    }, TICK_SEG * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, career?.grind?.ligado]);

  // ---- visibilitychange: voltou ⇒ resumo do que fechou sem você olhar ----
  useEffect(() => {
    if (!ativo) return;
    const aoMudar = () => {
      if (document.visibilityState !== "visible") return;
      const total = useCareer.getState().grindResultado?.completas.length ?? 0;
      const pendentes = useCareer.getState().grindResultado?.completas.slice(vistoRef.current) ?? [];
      if (pendentes.length > 0) {
        const v = pendentes.filter((p) => p.vitoria).length;
        definirResumo({ v, d: pendentes.length - v, dinheiro: pendentes.reduce((s, p) => s + p.dinheiro, 0) });
        rastrear("grind_resumo_visto", { partidas: pendentes.length });
      }
      vistoRef.current = total;
      tick(0);
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // ---- micro-celebração da PÍLULA (o diorama tem a própria festa) ----
  const completas = resultado?.completas ?? [];
  useEffect(() => {
    const n = completas.length;
    const antes = completasRef.current;
    completasRef.current = n;
    if (antes === 0 || n <= antes) {
      if (document.visibilityState === "visible") vistoRef.current = n;
      return;
    }
    if (document.visibilityState !== "visible") return;
    vistoRef.current = n;
    if (!usaPilula) return;
    const ultima = completas[n - 1];
    setFlash(ultima.vitoria ? "v" : "d");
    if (ultima.vitoria) tocarSom("moeda");
    if (ultima.drop) tocarSom("tier2");
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completas.length]);

  // ---- título + favicon dinâmicos da aba ----
  const placar = resultado ? placarDoDia(resultado) : { v: 0, d: 0 };
  useEffect(() => {
    if (!ativo || !ligado) {
      document.title = TITULO_PADRAO;
      restaurarFavicon();
      return;
    }
    document.title = `⚔️ ${placar.v}V ${placar.d}D · Grind ativo`;
    desenharFavicon(placar.v, placar.d);
    return () => {
      document.title = TITULO_PADRAO;
      restaurarFavicon();
    };
  }, [ativo, ligado, placar.v, placar.d]);

  if (!ativo || oculto) return null;
  // no dashboard o diorama tem dock integrado ao layout (GrindDock) — sem strip dobrada
  if (pathname === "/dashboard" && !usaPilula) return null;

  const g = career.grind;
  const noTeto = g ? tetoAtingido(g) : false;

  // ---- PÍLULA ----
  if (usaPilula) {
    const corFlash = flash === "v" ? "border-emerald-400" : flash === "d" ? "border-rosa" : "border-borda";
    const pctTeto = Math.min(100, Math.round(((g?.segundosHoje ?? 0) / GRIND.tetoSegundosDia) * 100));
    return (
      <button
        type="button"
        onClick={() => {
          if (minimizado) setMinimizado(false);
          else useCareer.getState().alternarGrind();
        }}
        className={`fixed bottom-2 right-2 z-30 flex items-center gap-2 border-2 bg-painel/95 px-2.5 py-1.5 shadow-lg backdrop-blur transition-colors sm:bottom-3 sm:right-3 ${corFlash}`}
        title={minimizado ? "Reabrir o diorama do grind" : ligado ? "Grind ativo — clique pra pausar" : "Grind pausado — clique pra ligar"}
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

  // ---- STRIP flutuante do diorama (todas as rotas fora do dashboard) ----
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-1.5 pb-1.5 sm:px-3 sm:pb-2">
      <div className="pointer-events-auto relative mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => setMinimizado(true)}
          className="absolute -top-2 right-1 z-10 border border-borda bg-fundo px-1.5 font-pixel text-[8px] text-suave transition hover:text-texto"
          title="Recolher pra pílula"
        >
          ▁
        </button>
        <DioramaGrind resultado={resultado} />
      </div>
    </div>
  );
}

// ---- favicon dinâmico: canvas 32px com o placar V/D do dia ----
let faviconOriginal: string | null = null;

function linkFavicon(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  return link;
}

function desenharFavicon(v: number, d: number): void {
  try {
    const link = linkFavicon();
    if (faviconOriginal === null) faviconOriginal = link.href || "/favicon.ico";
    const cv = document.createElement("canvas");
    cv.width = 32;
    cv.height = 32;
    const c = cv.getContext("2d");
    if (!c) return;
    c.fillStyle = "#0b0617";
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = "#19e6e0";
    c.fillRect(0, 0, 32, 3);
    c.font = "bold 15px monospace";
    c.textAlign = "center";
    c.fillStyle = "#46d36a";
    c.fillText(String(Math.min(99, v)), 9, 22);
    c.fillStyle = "#ff2d7e";
    c.fillText(String(Math.min(99, d)), 24, 22);
    link.href = cv.toDataURL("image/png");
  } catch {
    // favicon é cosmético — nunca quebra
  }
}

function restaurarFavicon(): void {
  try {
    if (faviconOriginal !== null) linkFavicon().href = faviconOriginal;
  } catch {
    // ignora
  }
}
