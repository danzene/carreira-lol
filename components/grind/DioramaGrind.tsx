"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { GRIND } from "@/data/grind";
import { EXPEDICAO } from "@/data/expedicao";
import { placarDoDia, tetoAtingido, type ResultadoGrind } from "@/engine/grind";
import { buscarCampeoes } from "@/lib/ddragon";
import { tocarSom } from "@/lib/som";
import { rastrear } from "@/lib/telemetria";
import { useCareer } from "@/store/careerStore";
import { defCosmetico, GRIND_PROP } from "@/data/grindProposito";
import { modsDoGrind } from "@/engine/grind";
import { carregarAtlasReal } from "./diorama/atlasReal";
import { CENA_H, CENA_W, criarCena, type CenaDiorama, type EventoCena } from "./diorama/cena";
import { familiaPixel } from "./diorama/pixels";
import PainelGrind from "./PainelGrind";
import { grindVisivel, janelaPip, marcarPip, suportaPip } from "./pip";

// 🎪 Diorama do Grind — a "fazenda viva" na tela. O canvas COREOGRAFA o que o engine
// já decidiu (resolverGrind); zero regra de jogo aqui. Orçamento de performance:
// rAF capado a 30fps (12fps no modo economia), pausa TOTAL com a aba oculta (a menos
// que a janela PiP esteja aberta — aí a cena vive NELA), pré-render offscreen e pools.
//
// PiP (Regra de ouro pós-crash): NUNCA mover nós entre documentos. Abrir a PiP cria um
// CANVAS NOVO no documento dela e a cena só troca o alvo de render (definirCtx); o rAF
// é agendado na janela dona do canvas; fechar devolve o ctx pro canvas da página.
// Tudo embrulhado em try/catch com degradação limpa (diorama_pip_erro) — nunca trava.

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cenaRef = useRef<CenaDiorama | null>(null);
  const mainCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const iniciarLoopRef = useRef<() => void>(() => {});
  const [expandido, setExpandido] = useState(expandidoInicial);
  const [fpsAlvo, setFpsAlvo] = useState(FPS_NORMAL);
  const [pip, setPip] = useState(false);
  const [intro, setIntro] = useState(false);
  const [escolhaBau, setEscolhaBau] = useState(0); // >0 = Raro com "Segunda Chance" aguardando escolha

  const ligado = career?.grind?.ligado ?? true;
  const noTeto = career?.grind ? tetoAtingido(career.grind) : false;
  const g = career?.grind;
  const completas = useMemo(() => resultado?.completas ?? [], [resultado]);
  const placar = resultado ? placarDoDia(resultado) : { v: 0, d: 0 };
  const dinheiroHoje = completas.reduce((s, p) => s + p.dinheiro, 0);

  // refs vivos pro loop (sem recriar a cena a cada render)
  const vivoRef = useRef({ resultado, placar, dinheiroHoje, segundos: g?.segundosHoje ?? 0, sucata: g?.sucata ?? 0, barra: g?.barraBau ?? 0 });
  vivoRef.current = { resultado, placar, dinheiroHoje, segundos: g?.segundosHoje ?? 0, sucata: g?.sucata ?? 0, barra: g?.barraBau ?? 0 };
  const volumeDioramaRef = useRef<number>(GRIND.volumeDiorama);
  volumeDioramaRef.current = career?.opcoes?.volumeDiorama ?? GRIND.volumeDiorama;

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

  // ---- monta a cena + loop capado (dono único; agenda na janela onde o canvas vive) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const c0 = career;
    if (!canvas || !c0?.grind) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    mainCtxRef.current = ctx;

    // cooldown por som: kills/moedas em rajada não viram metralhadora de bipes
    const ultimoSom: Record<string, number> = {};
    const somDiorama = (id: Parameters<typeof tocarSom>[0], importante = false, cooldownMs = 350) => {
      const agora = performance.now();
      if (agora - (ultimoSom[id] ?? 0) < cooldownMs) return;
      const quieto = agora - ultimaInteracao.current > GRIND.autoSilencioSeg * 1000;
      if (quieto && !importante) return;
      ultimoSom[id] = agora;
      tocarSom(id, volumeDioramaRef.current);
    };

    const aoEvento = (ev: EventoCena) => {
      if (ev === "kill") somDiorama("tick", false, 600);
      else if (ev === "killGrande") somDiorama("moeda");
      else if (ev === "moeda") somDiorama("tick", false, 900);
      else if (ev === "sucata") somDiorama("tick", false, 1400); // parafuso: bipe raro
      else if (ev === "drop") somDiorama("tier2", true);
      else if (ev === "vitoria") somDiorama("missao", true);
      else if (ev === "penta") somDiorama("conquista", true);
      else if (ev === "derrota") somDiorama("rebaixamento", true);
      // 🎁 baú: som escala com o tier (o Lendário é o momento mais raro da cena)
      else if (ev === "bauCaiu") somDiorama("tick", true);
      else if (ev === "bauComum") somDiorama("tier1", true);
      else if (ev === "bauRaro") somDiorama("tier3", true);
      else if (ev === "bauLendario") somDiorama("tier5", true);
      else if (ev === "bauPronto") {
        // o engine já rolou o baú; a borda ABRE (aplica as recompensas) e a cena revela
        const pend = useCareer.getState().career?.grind?.bauPendente;
        if (pend?.opcoes) setEscolhaBau(pend.opcoes.length); // Segunda Chance: jogador escolhe
        else {
          const r = useCareer.getState().abrirBauGrind(0);
          if (r) cena.revelarBau(r.tier, r.cosmetico);
        }
      } else if (ev === "fimDesfecho") {
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
      sucataDia: () => vivoRef.current.sucata,
      barraPct: () => (vivoRef.current.barra / GRIND_PROP.barraCheia) * 100,
      tetoPct: () => (vivoRef.current.segundos / GRIND.tetoSegundosDia) * 100,
      aoEvento,
    });
    cenaRef.current = cena;
    cena.definirReduzido(reduzido || fpsAlvo === FPS_ECONOMIA);
    // arte real (cacheada por sessão): aplica quando chegar; sem atlas = programático
    void carregarAtlasReal().then((a) => {
      if (a && cenaRef.current === cena) cena.definirAtlasReal(a);
    });

    const r0 = vivoRef.current.resultado;
    if (r0?.atual) cena.definirPartida(r0.atual.idx, ehBoss(r0.atual.inicioSeg, r0.atual.duracaoSeg));
    idxEncenado.current = r0?.atual?.idx ?? -1;
    idxDesfechado.current = r0?.completas.length ?? 0;

    // cena recriada (PiP/economia) com baú pendente ⇒ ele volta a cair; cosméticos/mods também
    const gAtual = useCareer.getState().career?.grind;
    if (gAtual?.bauPendente) cena.soltarBau();
    cena.definirCosmeticos({
      skin: gAtual?.equipado.skin ? defCosmetico(gAtual.equipado.skin)?.cor : undefined,
      trilha: gAtual?.equipado.trilha ? defCosmetico(gAtual.equipado.trilha)?.cor : undefined,
      pet: gAtual?.equipado.pet ? defCosmetico(gAtual.equipado.pet)?.cor : undefined,
    });
    const m0 = modsDoGrind(gAtual);
    cena.definirMods({ encenacaoMult: m0.encenacaoMult, golpeDuplo: m0.golpeDuplo });

    // loop: cada frame agenda o PRÓXIMO na janela dona do canvas (principal ou PiP).
    // TEMPO: usamos SEMPRE o performance.now() da janela PRINCIPAL (closure) — o
    // timestamp do rAF muda de ÉPOCA entre janelas e envenenaria o dt na troca.
    let raf = 0;
    let rafWin: Window = window;
    let rodando = false;
    let vivo = true;
    let ultimo = performance.now();
    let acumulado = 0;
    const passo = 1 / (reduzido ? FPS_ECONOMIA : fpsAlvo);

    const frame = () => {
      if (!vivo || !rodando) return;
      rafWin = janelaPip() ?? window;
      try {
        raf = rafWin.requestAnimationFrame(frame);
      } catch {
        rafWin = window; // janela PiP morreu no meio: volta pro principal
        raf = window.requestAnimationFrame(frame);
      }
      const now = performance.now(); // época única (janela principal), sempre
      const dt = Math.max(0, Math.min(0.1, (now - ultimo) / 1000));
      ultimo = now;
      acumulado = Math.max(0, acumulado + dt);
      if (acumulado < passo) return;
      const passoReal = Math.min(0.2, acumulado);
      acumulado = 0;
      cena.atualizar(passoReal);
      cena.desenhar();
    };

    const iniciar = () => {
      if (rodando) return; // nunca dois loops
      rodando = true;
      ultimo = performance.now();
      acumulado = 0;
      rafWin = janelaPip() ?? window;
      raf = rafWin.requestAnimationFrame(frame);
    };
    const parar = () => {
      rodando = false;
      try {
        rafWin.cancelAnimationFrame(raf);
      } catch {
        /* janela já fechada */
      }
      raf = 0;
    };
    // REINICIAR de verdade (parar → iniciar): obrigatório ao abrir/fechar a PiP —
    // o rAF pendente pode estar agendado numa janela que acabou de morrer (o
    // callback nunca dispararia e o loop morreria "travado").
    iniciarLoopRef.current = () => {
      parar();
      iniciar();
    };

    const aoVisibilidade = () => {
      // reinício forçado ao ficar visível: se o rAF pendente morreu junto com uma
      // janela PiP fechada, parar()+iniciar() ressuscita o loop na janela certa
      if (grindVisivel()) {
        parar();
        iniciar();
      } else {
        parar();
      }
    };
    document.addEventListener("visibilitychange", aoVisibilidade);
    aoVisibilidade();

    return () => {
      vivo = false;
      parar();
      document.removeEventListener("visibilitychange", aoVisibilidade);
      iniciarLoopRef.current = () => {};
      cenaRef.current = null;
      mainCtxRef.current = null;
      // a cena desta instância morreu: fecha a PiP limpo (o pagehide dela cuida do resto)
      try {
        janelaPip()?.close();
      } catch {
        /* já fechada */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [career?.grind?.seedDia, career?.player.rota, reduzido, fpsAlvo]);

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

  // 🎁 baú pendente no engine ⇒ cai na cena (neutro). Cosméticos e mods visuais também
  // são espelhados aqui — o estado de jogo vive no save; a cena só apresenta.
  const bauPendente = !!g?.bauPendente;
  const equip = g?.equipado;
  const talentosKey = JSON.stringify(g?.talentos ?? {});
  useEffect(() => {
    if (bauPendente) cenaRef.current?.soltarBau();
  }, [bauPendente]);

  useEffect(() => {
    cenaRef.current?.definirCosmeticos({
      skin: equip?.skin ? defCosmetico(equip.skin)?.cor : undefined,
      trilha: equip?.trilha ? defCosmetico(equip.trilha)?.cor : undefined,
      pet: equip?.pet ? defCosmetico(equip.pet)?.cor : undefined,
    });
  }, [equip?.skin, equip?.trilha, equip?.pet]);

  useEffect(() => {
    const m = modsDoGrind(useCareer.getState().career?.grind);
    cenaRef.current?.definirMods({ encenacaoMult: m.encenacaoMult, golpeDuplo: m.golpeDuplo });
  }, [talentosKey]);

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
  }, [championAtual]);

  // ---- Picture-in-Picture (Document PiP): canvas NOVO no doc da PiP, nada se move ----
  async function abrirPip(): Promise<void> {
    type DPP = { requestWindow: (o: { width: number; height: number }) => Promise<Window> };
    const dpp = (window as Window & { documentPictureInPicture?: DPP }).documentPictureInPicture;
    if (!dpp) return;
    try {
      janelaPip()?.close(); // abrir 2× não duplica: fecha a anterior primeiro
      const win = await dpp.requestWindow({ width: 520, height: 128 });
      win.document.title = "Grind · Carreira LoL";
      const body = win.document.body;
      body.style.cssText = "margin:0;background:#0b0617;display:flex;align-items:center;min-height:100vh";
      const cv = win.document.createElement("canvas");
      cv.width = CENA_W;
      cv.height = CENA_H;
      cv.style.cssText = "width:100%;display:block;image-rendering:pixelated";
      body.appendChild(cv);
      const pctx = cv.getContext("2d");
      if (!pctx) throw new Error("sem contexto 2d na PiP");

      cenaRef.current?.definirCtx(pctx);
      marcarPip(win);
      setPip(true);
      rastrear("diorama_pip_aberto", {});
      const abertaEm = performance.now();
      iniciarLoopRef.current(); // garante o loop rodando (agora agendado na janela PiP)

      win.addEventListener("pagehide", () => {
        // fechou (X, navegação, outra PiP): devolve o render pra página, sem vazamentos
        try {
          marcarPip(null);
          setPip(false);
          const mctx = mainCtxRef.current;
          if (mctx) cenaRef.current?.definirCtx(mctx);
          rastrear("diorama_pip_fechado", { segundos: Math.round((performance.now() - abertaEm) / 1000) });
          if (grindVisivel()) iniciarLoopRef.current();
        } catch {
          /* nunca propaga erro no fechamento */
        }
      });
    } catch (e) {
      // degradação limpa: fecha se abriu, volta pro normal, loga — NUNCA congela o jogo
      try {
        janelaPip()?.close();
      } catch {
        /* ignora */
      }
      marcarPip(null);
      setPip(false);
      const mctx = mainCtxRef.current;
      if (mctx) cenaRef.current?.definirCtx(mctx);
      rastrear("diorama_pip_erro", { msg: e instanceof Error ? e.message : String(e) });
    }
  }

  if (!career?.grind) return null;

  const restante = Math.max(0, GRIND.tetoSegundosDia - (g?.segundosHoje ?? 0));
  const fmtRest = `${Math.floor(restante / 3600)}h ${Math.ceil((restante % 3600) / 60)
    .toString()
    .padStart(2, "0")}m`;

  return (
    <div className="pointer-events-auto w-full">
      {/* faixa do diorama (o aquário) */}
      <div className="relative w-full overflow-hidden border-2 border-borda bg-fundo">
        <canvas
          ref={canvasRef}
          width={CENA_W}
          height={CENA_H}
          onClick={() => {
            if (intro) dispensarIntro();
            // clique dispensa a cerimônia do baú (inclusive a do Lendário) antes de expandir
            if (cenaRef.current?.emCerimonia()) {
              cenaRef.current.pularCerimonia();
              return;
            }
            setExpandido((e) => {
              if (!e) rastrear("diorama_expandido", {});
              return !e;
            });
          }}
          className="block w-full cursor-pointer"
          style={{ imageRendering: "pixelated", aspectRatio: `${CENA_W}/${CENA_H}` }}
          title={expandido ? "Recolher" : "Expandir o treino"}
        />

        {/* cena destacada na PiP: a página mostra o aviso; o farm roda na janelinha */}
        {pip && (
          <div className="absolute inset-0 flex items-center justify-center bg-fundo/85">
            <button
              type="button"
              onClick={() => {
                try {
                  janelaPip()?.close();
                } catch {
                  /* já fechada */
                }
              }}
              className="border-2 border-ciano bg-fundo px-3 py-1.5 font-pixel text-[9px] text-ciano transition hover:bg-ciano hover:text-fundo"
            >
              ⧉ CENA DESTACADA — TRAZER DE VOLTA
            </button>
          </div>
        )}

        {/* 🍀 Segunda Chance (talento de Sorte): o Raro abre 2 pacotes, você escolhe 1 */}
        {escolhaBau > 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-fundo/90">
            <p className="font-pixel text-[9px] text-ciano">BAÚ RARO · ESCOLHA 1</p>
            <div className="flex gap-2">
              {Array.from({ length: escolhaBau }).map((_, i) => {
                const pacote = career.grind?.bauPendente?.opcoes?.[i] ?? [];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const r = useCareer.getState().abrirBauGrind(i);
                      setEscolhaBau(0);
                      if (r) cenaRef.current?.revelarBau(r.tier, r.cosmetico);
                    }}
                    className="border-2 border-borda bg-painel px-2.5 py-1.5 text-[10px] text-texto transition hover:border-ciano"
                  >
                    {pacote.map((x, j) => (
                      <span key={j} className="mr-1.5">
                        {x.tipo === "sucata" && <span className="text-[#b9c2d0]">🔩{x.valor}</span>}
                        {x.tipo === "dinheiro" && <span className="text-amber-300">${x.valor}</span>}
                        {x.tipo === "item" && <span className="text-suave">🎒 item</span>}
                        {x.tipo === "maestria" && <span className="text-ciano">+{x.valor} maestria</span>}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
        {!intro && !pip && resumo && (resumo.v > 0 || resumo.d > 0) && (
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
          {/* 🎁 badge de baú pronto (só o baú — badge de talento viraria spam) */}
          {bauPendente && !pip && <span className="mr-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-300" title="Baú pronto pra abrir!" />}
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

      {/* HUD expandido (DOM) — abas RESUMO / TALENTOS / COLEÇÃO */}
      {expandido && g && (
        <div className="border-2 border-t-0 border-borda bg-painel/95 p-2.5 backdrop-blur">
          <PainelGrind
            g={g}
            resumo={
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px]">
                  <span className="text-suave">
                    Hoje: <span className="text-emerald-400">{placar.v}V</span> <span className="text-rosa">{placar.d}D</span> ·{" "}
                    <span className="text-amber-300">+${dinheiroHoje}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-suave" title="O grind rende no máximo 3h por dia — depois o jogador descansa.">
                      {noTeto ? "teto ✔" : `⏳ ${fmtRest}`}
                    </span>
                    {EXPEDICAO.habilitado && (
                      <Link
                        href="/expedicao"
                        title="Modo ATIVO: scrim hardcore com risco de morte — só o loot da corrida está em jogo."
                        className="border border-rosa/70 px-2 py-0.5 font-pixel text-[8px] text-rosa transition hover:bg-rosa hover:text-fundo"
                      >
                        ⚔️ EXPEDIÇÃO
                      </Link>
                    )}
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
                  <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
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
                            {p.dinheiro > 0 ? `+$${Math.round(p.dinheiro)}` : `+${p.maestria} maestria`}
                            {p.drop && <span title="Dropou item Comum"> 🎒</span>}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}

                <div className="mt-1.5 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => useCareer.getState().alternarOcultarGrind()}
                    className="text-[10px] text-suave underline-offset-2 hover:text-texto hover:underline"
                    title="Reative no painel de som (🔊 no topo)."
                  >
                    ocultar widget
                  </button>
                </div>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

// A partida atual é a última antes do teto? (o corpo dela ganha o Barão diorama)
function ehBoss(inicioSeg: number, duracaoSeg: number): boolean {
  return inicioSeg + duracaoSeg * 2 >= GRIND.tetoSegundosDia;
}
