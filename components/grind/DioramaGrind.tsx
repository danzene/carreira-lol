"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GRIND } from "@/data/grind";
import { placarDoDia, tetoAtingido, type ResultadoGrind } from "@/engine/grind";
import { buscarCampeoes } from "@/lib/ddragon";
import { tocarSom } from "@/lib/som";
import { rastrear } from "@/lib/telemetria";
import { useCareer } from "@/store/careerStore";
import { CENA_H, CENA_W, criarCena, type CenaDiorama, type EventoCena } from "./diorama/cena";
import { familiaPixel } from "./diorama/pixels";
import { janelaPip, marcarPip, pipAberta, suportaPip } from "./pip";

// 🎪 Diorama do Grind — a "fazenda viva" na tela. O canvas COREOGRAFA o que o engine
// já decidiu (resolverGrind); zero regra de jogo aqui. Orçamento de performance:
// rAF capado a 30fps (12fps no modo economia), pausa TOTAL com a aba oculta (a menos
// que a janela PiP esteja aberta — aí a cena vive NELA), pré-render offscreen e pools.

const FPS_NORMAL = 30;
const FPS_ECONOMIA = 12;
const LS_INTRO = "carreira-diorama-intro";

export interface ResumoFora {
  v: number;
  d: number;
  dinheiro: number;
}

export default function DioramaGrind({
  resultado,
  expandidoInicial = false,
}: {
  resultado: ResultadoGrind | null;
  expandidoInicial?: boolean;
}) {
  const career = useCareer((s) => s.career);
  const alternar = useCareer((s) => s.alternarGrind);
  const resumo = useCareer((s) => s.grindResumo);
  const definirResumo = useCareer((s) => s.definirGrindResumo);

  const wrapRef = useRef<HTMLDivElement>(null);
  const origemRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cenaRef = useRef<CenaDiorama | null>(null);
  const [expandido, setExpandido] = useState(expandidoInicial);
  const [fpsAlvo, setFpsAlvo] = useState(FPS_NORMAL);
  const [pip, setPip] = useState(false);
  const [intro, setIntro] = useState(false);

  const ligado = career?.grind?.ligado ?? true;
  const noTeto = career?.grind ? tetoAtingido(career.grind) : false;
  const g = career?.grind;
  const completas = useMemo(() => resultado?.completas ?? [], [resultado]);
  const placar = resultado ? placarDoDia(resultado) : { v: 0, d: 0 };
  const dinheiroHoje = completas.reduce((s, p) => s + p.dinheiro, 0);

  // refs vivos pro loop (sem recriar a cena a cada render)
  const vivoRef = useRef({ resultado, placar, dinheiroHoje, segundos: g?.segundosHoje ?? 0 });
  vivoRef.current = { resultado, placar, dinheiroHoje, segundos: g?.segundosHoje ?? 0 };

  // modo economia: preferências do sistema/config
  const reduzido = useMemo(() => {
    if (career?.opcoes?.reduzirAnimacoes) return true;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
    return false;
  }, [career?.opcoes?.reduzirAnimacoes]);

  // onboarding: 1 balão na primeira vez com o diorama
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(LS_INTRO)) setIntro(true);
    } catch {
      /* sem storage */
    }
  }, []);
  function dispensarIntro(): void {
    setIntro(false);
    try {
      window.localStorage.setItem(LS_INTRO, "1");
    } catch {
      /* ignora */
    }
  }

  // bateria fraca (quando a API existe) ⇒ modo economia automático
  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, cb: () => void) => void }>;
    };
    if (!nav.getBattery) return;
    let vivo = true;
    nav
      .getBattery()
      .then((b) => {
        const avaliar = () => {
          if (!vivo) return;
          const economia = b.level < 0.2 && !b.charging;
          setFpsAlvo(economia ? FPS_ECONOMIA : FPS_NORMAL);
          if (economia) rastrear("diorama_reduzido", { motivo: "bateria" });
        };
        avaliar();
        b.addEventListener("levelchange", avaliar);
        b.addEventListener("chargingchange", avaliar);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // auto-silêncio: sem interação por X min ⇒ só drop/fim de partida tocam
  const ultimaInteracao = useRef(0);
  useEffect(() => {
    const marcar = () => {
      ultimaInteracao.current = performance.now();
    };
    marcar();
    window.addEventListener("pointerdown", marcar, { passive: true });
    window.addEventListener("keydown", marcar, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", marcar);
      window.removeEventListener("keydown", marcar);
    };
  }, []);

  // ---- monta a cena + loop capado (na janela certa: principal ou PiP) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const c0 = career;
    if (!canvas || !c0?.grind) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const somDiorama = (id: Parameters<typeof tocarSom>[0], importante = false) => {
      const quieto = performance.now() - ultimaInteracao.current > GRIND.autoSilencioSeg * 1000;
      if (quieto && !importante) return;
      tocarSom(id, GRIND.volumeDiorama);
    };

    const aoEvento = (ev: EventoCena) => {
      if (ev === "kill") somDiorama("tick");
      else if (ev === "killGrande") somDiorama("moeda");
      else if (ev === "moeda") somDiorama("tick");
      else if (ev === "drop") somDiorama("tier2", true);
      else if (ev === "vitoria") somDiorama("missao", true);
      else if (ev === "penta") somDiorama("conquista", true);
      else if (ev === "derrota") somDiorama("rebaixamento", true);
      else if (ev === "fimDesfecho") {
        const r = vivoRef.current.resultado;
        idxEncenado.current = r?.atual ? r.atual.idx : -1;
        if (r?.atual) cena.definirPartida(r.atual.idx, ehBoss(r.atual.inicioSeg, r.atual.duracaoSeg));
        idxDesfechado.current = r ? r.completas.length : idxDesfechado.current;
      }
    };

    const cena = criarCena(ctx, {
      rota: c0.player.rota,
      elo: c0.player.rankSoloq.elo,
      seedDia: c0.grind.seedDia,
      familia: familiaPixel(),
      placar: () => vivoRef.current.placar,
      dinheiroDia: () => vivoRef.current.dinheiroHoje,
      tetoPct: () => (vivoRef.current.segundos / GRIND.tetoSegundosDia) * 100,
      aoEvento,
    });
    cenaRef.current = cena;
    cena.definirReduzido(reduzido || fpsAlvo === FPS_ECONOMIA);

    const r0 = vivoRef.current.resultado;
    if (r0?.atual) cena.definirPartida(r0.atual.idx, ehBoss(r0.atual.inicioSeg, r0.atual.duracaoSeg));
    idxEncenado.current = r0?.atual?.idx ?? -1;
    idxDesfechado.current = r0?.completas.length ?? 0;

    // loop com CAP de FPS; o rAF nasce na janela onde o canvas VIVE (principal ou PiP)
    const win = janelaPip() ?? window;
    let raf = 0;
    let rodando = true;
    let ultimo = performance.now();
    let acumulado = 0;
    const passo = 1 / (reduzido ? FPS_ECONOMIA : fpsAlvo);

    const frame = (now: number) => {
      if (!rodando) return;
      raf = win.requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - ultimo) / 1000);
      ultimo = now;
      acumulado += dt;
      if (acumulado < passo) return;
      const passoReal = Math.min(0.2, acumulado);
      acumulado = 0;
      cena.atualizar(passoReal);
      cena.desenhar();
    };

    const iniciar = () => {
      if (raf) win.cancelAnimationFrame(raf);
      ultimo = performance.now();
      raf = win.requestAnimationFrame(frame);
    };
    const parar = () => {
      win.cancelAnimationFrame(raf);
      raf = 0;
    };

    const aoVisibilidade = () => {
      // com a PiP aberta a cena vive nela (sempre visível); sem PiP, aba oculta ⇒ zero render
      if (document.visibilityState === "visible" || pipAberta()) iniciar();
      else parar();
    };
    document.addEventListener("visibilitychange", aoVisibilidade);
    aoVisibilidade();

    return () => {
      rodando = false;
      parar();
      document.removeEventListener("visibilitychange", aoVisibilidade);
      cenaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career?.grind?.seedDia, career?.player.rota, reduzido, fpsAlvo, pip]);

  // ---- dirige a cena conforme o engine ----
  const idxEncenado = useRef(-1);
  const idxDesfechado = useRef(0);

  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || !resultado) return;
    if (!ligado) {
      cena.definirModo("pausado");
      return;
    }
    if (noTeto && !cena.emDesfecho()) {
      cena.definirModo("dormindo");
      return;
    }
    cena.definirModo("normal");
    if (completas.length > idxDesfechado.current && !cena.emDesfecho()) {
      const p = completas[completas.length - 1];
      idxDesfechado.current = completas.length;
      cena.tocarDesfecho(p);
      return;
    }
    if (resultado.atual && resultado.atual.idx !== idxEncenado.current && !cena.emDesfecho()) {
      idxEncenado.current = resultado.atual.idx;
      cena.definirPartida(resultado.atual.idx, ehBoss(resultado.atual.inicioSeg, resultado.atual.duracaoSeg));
    }
  }, [resultado, completas, ligado, noTeto]);

  // retrato do campeão da partida atual
  const championAtual = resultado?.atual?.championId ?? completas[completas.length - 1]?.championId ?? null;
  useEffect(() => {
    if (!championAtual) return;
    let vivo = true;
    void buscarCampeoes()
      .then((cs) => {
        if (!vivo) return;
        const url = cs.find((x) => x.id === championAtual)?.icone;
        if (!url) return;
        const img = new Image();
        img.src = url;
        cenaRef.current?.definirRetrato(img);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [championAtual, pip]);

  // ---- Picture-in-Picture (Document PiP — Chrome/Edge desktop) ----
  async function abrirPip(): Promise<void> {
    const wrap = wrapRef.current;
    type DPP = { requestWindow: (o: { width: number; height: number }) => Promise<Window> };
    const dpp = (window as Window & { documentPictureInPicture?: DPP }).documentPictureInPicture;
    if (!dpp || !wrap) return;
    try {
      const win = await dpp.requestWindow({ width: 520, height: 150 });
      // copia os estilos da página (Tailwind) pra janela PiP
      for (const ss of Array.from(document.styleSheets)) {
        try {
          const css = Array.from(ss.cssRules)
            .map((r) => r.cssText)
            .join("");
          const st = win.document.createElement("style");
          st.textContent = css;
          win.document.head.appendChild(st);
        } catch {
          if (ss.href) {
            const l = win.document.createElement("link");
            l.rel = "stylesheet";
            l.href = ss.href;
            win.document.head.appendChild(l);
          }
        }
      }
      win.document.body.style.margin = "0";
      win.document.body.style.background = "#0b0617";
      origemRef.current = wrap.parentElement;
      win.document.body.append(wrap);
      marcarPip(win);
      setPip(true);
      rastrear("diorama_pip_aberto", {});
      win.addEventListener("pagehide", () => {
        origemRef.current?.append(wrap);
        marcarPip(null);
        setPip(false);
      });
    } catch {
      // usuário negou/erro — segue na página
    }
  }

  if (!career?.grind) return null;

  const restante = Math.max(0, GRIND.tetoSegundosDia - (g?.segundosHoje ?? 0));
  const fmtRest = `${Math.floor(restante / 3600)}h ${Math.ceil((restante % 3600) / 60)
    .toString()
    .padStart(2, "0")}m`;

  return (
    <div ref={wrapRef} className="pointer-events-auto w-full">
      {/* faixa do diorama (o aquário) */}
      <div className="relative w-full overflow-hidden border-2 border-borda bg-fundo">
        <canvas
          ref={canvasRef}
          width={CENA_W}
          height={CENA_H}
          onClick={() => {
            if (intro) dispensarIntro();
            setExpandido((e) => {
              if (!e) rastrear("diorama_expandido", {});
              return !e;
            });
          }}
          className="block w-full cursor-pointer"
          style={{ imageRendering: "pixelated", aspectRatio: `${CENA_W}/${CENA_H}` }}
          title={expandido ? "Recolher" : "Expandir o grind"}
        />

        {/* onboarding: 1 balão na primeira vez */}
        {intro && !pip && (
          <button
            type="button"
            onClick={dispensarIntro}
            className="absolute inset-x-4 top-1.5 z-10 border-2 border-ciano bg-fundo/95 px-2 py-1 text-center text-[11px] text-texto shadow-lg sm:inset-x-auto sm:left-1/2 sm:w-96 sm:-translate-x-1/2"
          >
            🛋️ Seu jogador treina normais enquanto você navega — clique pra expandir. Rende até 3h/dia. <span className="text-suave">✕</span>
          </button>
        )}

        {/* resumo "enquanto você estava fora" */}
        {!intro && resumo && (resumo.v > 0 || resumo.d > 0) && (
          <button
            type="button"
            onClick={() => definirResumo(null)}
            className="absolute inset-x-6 top-2 z-10 border-2 border-ciano/70 bg-fundo/95 px-2 py-1 text-center text-[11px] text-texto shadow-lg backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:w-80 sm:-translate-x-1/2"
          >
            Enquanto você estava fora: <span className="text-emerald-400">+{resumo.v}V</span>{" "}
            <span className="text-rosa">{resumo.d}D</span> · <span className="text-amber-300">+${resumo.dinheiro}</span>
            <span className="ml-1 text-suave">✕</span>
          </button>
        )}

        {/* controles do canto: PiP + selo de estado */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {(!ligado || noTeto) && (
            <span className="border border-borda bg-fundo/90 px-1.5 py-0.5 font-pixel text-[8px] text-suave">
              {!ligado ? "⏸ PAUSADO" : `😴 volta em ${fmtRest}`}
            </span>
          )}
          {suportaPip() && !pip && (
            <button
              type="button"
              onClick={() => void abrirPip()}
              className="border border-borda bg-fundo/90 px-1.5 py-0.5 font-pixel text-[8px] text-suave transition hover:text-ciano"
              title="Destacar numa janela flutuante (farm no canto do monitor)"
            >
              ⧉ PIP
            </button>
          )}
        </div>
      </div>

      {/* HUD expandido (DOM) */}
      {expandido && (
        <div className="border-2 border-t-0 border-borda bg-painel/95 p-2.5 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="text-suave">
              Hoje: <span className="text-emerald-400">{placar.v}V</span> <span className="text-rosa">{placar.d}D</span> ·{" "}
              <span className="text-amber-300">+${dinheiroHoje}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-suave" title="O grind rende no máximo 3h por dia — depois o jogador descansa.">
                {noTeto ? "teto ✔" : `⏳ ${fmtRest}`}
              </span>
              <button
                type="button"
                onClick={alternar}
                className={`border px-2 py-0.5 font-pixel text-[8px] transition ${ligado ? "border-rosa text-rosa hover:bg-rosa hover:text-fundo" : "border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-fundo"}`}
              >
                {ligado ? "PAUSAR" : "LIGAR"}
              </button>
            </div>
          </div>

          {completas.length > 0 && (
            <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto">
              {completas
                .slice(-8)
                .reverse()
                .map((p) => (
                  <li key={p.idx} className="flex items-center justify-between border border-borda bg-fundo/50 px-2 py-1 text-[11px]">
                    <span className="truncate">
                      <span className={p.vitoria ? "text-emerald-400" : "text-rosa"}>{p.vitoria ? "V" : "D"}</span>{" "}
                      <span className="text-texto">{p.championId}</span>{" "}
                      <span className="text-suave">
                        {p.kda.k}/{p.kda.d}/{p.kda.a} · vs {p.adversario}
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

          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-[10px] text-suave">Seu jogador treina normais enquanto o jogo está aberto — até 3h/dia.</p>
            <button
              type="button"
              onClick={() => useCareer.getState().alternarOcultarGrind()}
              className="text-[10px] text-suave underline-offset-2 hover:text-texto hover:underline"
              title="Reative no painel de som (🔊 no topo)."
            >
              ocultar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// A partida atual é a última antes do teto? (o corpo dela ganha o Barão diorama)
function ehBoss(inicioSeg: number, duracaoSeg: number): boolean {
  return inicioSeg + duracaoSeg * 2 >= GRIND.tetoSegundosDia;
}
