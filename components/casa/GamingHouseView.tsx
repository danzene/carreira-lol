"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ATRIBUTOS, TRACOS } from "@/data/config";
import { CASA, ESTACOES, TIPOS_STREAM, VARIANTES_MENTAL, type EstacaoId, type Intensidade, type TipoStream, type VarianteMental } from "@/data/gamingHouse";
import { LOOP } from "@/data/loop";
import { timeDe } from "@/data/times";
import { casaDe, emBurnout, multiplicadoresSessao, tendenciasDoTime } from "@/engine/gamingHouse";
import { proximoConfrontoJogador } from "@/engine/liga";
import { energiaAgora } from "@/engine/tempo";
import { featureLiberada } from "@/engine/unlocks";
import type { AtributoKey, TraitId } from "@/engine/types";
import { tocarSom } from "@/lib/som";
import { useCareer } from "@/store/careerStore";
import { familiaPixel } from "../grind/diorama/pixels";
import { CASA_H, CASA_W, criarCenaCasa, type CenaCasa } from "./cenaCasa";

// 🏠 Gaming House — a tela que substitui os 4 botões vagos. Clicar numa estação abre o
// painel com NÚMEROS EXPLÍCITOS (intensidades, multiplicadores de moral/foco/rendimento)
// antes de confirmar; confirmar roda a cena (o herói anda até a estação e treina).

const NOME_ATTR = Object.fromEntries(ATRIBUTOS.map((a) => [a.chave, a.nome])) as Record<AtributoKey, string>;
const LS_INTRO_CASA = "carreira-casa-intro";

// Onboarding de 3 balões na primeira visita (estação → intensidade → foco).
const PASSOS_INTRO = [
  { emoji: "🖱️", txt: "Clique numa ESTAÇÃO da casa — cada uma treina atributos diferentes e o seu jogador vai até lá." },
  { emoji: "🎚️", txt: "Escolha a INTENSIDADE: intensa rende mais, mas cansa (fadiga) e belisca a Moral. Os números aparecem ANTES de confirmar." },
  { emoji: "🎯", txt: "Declare o FOCO DA SEMANA: 2 atributos com +28% de rendimento. Variar as estações também rende mais (repetir cansa a rotina)." },
];

export default function GamingHouseView() {
  const career = useCareer((s) => s.career);
  const executar = useCareer((s) => s.executarSessaoCasa);
  const definirFoco = useCareer((s) => s.definirFocoSemana);
  const alteracaoMental = useCareer((s) => s.alteracaoMental);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cenaRef = useRef<CenaCasa | null>(null);
  const [selecionada, setSelecionada] = useState<EstacaoId | null>(null);
  const [intensidade, setIntensidade] = useState<Intensidade>("normal");
  const [tipoStream, setTipoStream] = useState<TipoStream>("ranqueada");
  const [variante, setVariante] = useState<VarianteMental | "traco">("academia");
  const [championId, setChampionId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editandoFoco, setEditandoFoco] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [intro, setIntro] = useState(-1); // -1 = sem tutorial; 0..2 = passo atual

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(LS_INTRO_CASA)) setIntro(0);
    } catch {
      /* localStorage indisponível: segue sem tutorial */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // palco (cena compacta reusando os blocos do diorama)
  useEffect(() => {
    const canvas = canvasRef.current;
    const c0 = useCareer.getState().career;
    if (!canvas || !c0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = CASA_W;
    canvas.height = CASA_H;
    ctx.imageSmoothingEnabled = false;
    const cena = criarCenaCasa(ctx, { rota: c0.player.rota, familia: familiaPixel() });
    cenaRef.current = cena;

    let raf = 0;
    let vivo = true;
    let ultimo = performance.now();
    let acc = 0;
    const passo = 1 / 30;
    const frame = () => {
      if (!vivo) return;
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.max(0, Math.min(0.1, (now - ultimo) / 1000));
      ultimo = now;
      acc += dt;
      if (acc < passo) return;
      acc = 0;
      cena.atualizar(passo);
      cena.desenhar();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      cenaRef.current = null;
    };
  }, []);

  // a casa REFLETE o estado (fadiga/burnout/moral) — sincronizado a cada mudança
  const casa = career ? casaDe(career) : null;
  const burnout = casa ? emBurnout(casa, agora) : false;
  useEffect(() => {
    if (!career || !casa) return;
    cenaRef.current?.definirEstado({
      fadiga01: casa.fadiga / CASA.fadigaMax,
      burnout,
      moralAlta: career.player.moral >= CASA.moralAltaMin,
      aoVivo: false,
    });
  }, [career, casa, burnout]);

  const aoClicarCena = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const est = cenaRef.current?.estacaoEm((e.clientX - rect.left) / rect.width);
    if (est) {
      setSelecionada((s) => (s === est ? null : est));
      setIntensidade("normal");
      setAviso(null);
    }
  }, []);

  if (!career || !casa) return null;

  const energia = energiaAgora(career, agora);
  const proximoAdv = proximoConfrontoJogador(career.liga);
  const chaveSemana = career.temporada * 1000 + career.semanaAtual;
  const focoDesatualizado = casa.foco.length > 0 && casa.focoSemana !== chaveSemana;

  const confirmar = () => {
    if (!selecionada) return;
    if (selecionada === "CHAMPION_PRACTICE" && !championId) {
      setAviso("Escolha um campeão da pool.");
      return;
    }
    if (selecionada === "ACADEMIA_SONO_TERAPIA" && variante === "traco") return; // traço tem botões próprios
    const r = executar({
      estacao: selecionada,
      intensidade,
      championId: championId ?? undefined,
      variante: variante === "traco" ? undefined : variante,
      tipoStream: selecionada === "SALA_DE_STREAM" ? tipoStream : undefined,
    });
    if (!r) {
      setAviso("Sem energia pra essa sessão.");
      return;
    }
    setAviso(null);
    const est = selecionada;
    tocarSom("tick", 0.5);
    cenaRef.current?.irPara(est, 2.6, () => {
      // fim do teatro: os +X reais flutuam (o engine já aplicou tudo no clique)
      const itens = Object.entries(r.ganhos).map(([k, v]) => ({ txt: `+${v} ${NOME_ATTR[k as AtributoKey] ?? k}`, cor: "#2ee6a0" }));
      if (r.maestria) itens.push({ txt: `+${r.maestria.ganho} maestria`, cor: "#ffd34d" });
      if (r.dinheiro > 0) itens.push({ txt: `+$${r.dinheiro}`, cor: "#ffd34d" });
      if (r.moralDelta > 0) itens.push({ txt: `+${r.moralDelta} moral`, cor: "#7ec8ff" });
      if (r.fadigaDelta < 0) itens.push({ txt: `${r.fadigaDelta} fadiga`, cor: "#7ec8ff" });
      cenaRef.current?.soltarGanhos(itens);
      tocarSom(r.entrouBurnout ? "rebaixamento" : "moeda", 0.5);
    });
    setSelecionada(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* medidores: energia (a MESMA de sempre), fadiga e moral com multiplicador */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Medidor rotulo="⚡ Energia" valor={Math.round(energia)} cor="#19e6e0" />
        <Medidor rotulo="😮‍💨 Fadiga" valor={Math.round(casa.fadiga)} cor={casa.fadiga >= 70 ? "#f43f5e" : "#f59e0b"} alerta={burnout ? "BURNOUT" : undefined} />
        <Medidor
          rotulo={`🎭 Moral ×${multiplicadoresSessao(career, "AIM_TRAINER", agora).moral.toFixed(2)}`}
          valor={Math.round(career.player.moral)}
          cor={career.player.moral >= CASA.moralAltaMin ? "#2ee6a0" : career.player.moral < CASA.moralBaixaMax ? "#f43f5e" : "#9a90c0"}
        />
      </div>

      {/* a casa (mobile: faixa horizontal scrollável) */}
      <div className="overflow-x-auto rounded border-2 border-borda bg-fundo">
        <canvas
          ref={canvasRef}
          onClick={aoClicarCena}
          className="block cursor-pointer"
          style={{ imageRendering: "pixelated", width: "100%", minWidth: 480, aspectRatio: `${CASA_W}/${CASA_H}` }}
          title="Clique numa estação pra treinar"
        />
      </div>

      {/* 🎯 Foco da Semana */}
      <div className="flex flex-wrap items-center gap-2 border border-borda bg-painel/60 px-2 py-1.5 text-[11px]">
        <span className="font-pixel text-[9px] text-suave">🎯 FOCO DA SEMANA:</span>
        {casa.foco.length === 0 ? (
          <span className="text-amber-300">nenhum — declare 2 atributos (+{Math.round(CASA.focoBonus * 100)}% neles)</span>
        ) : (
          <span className={focoDesatualizado ? "text-amber-300" : "text-ciano"}>
            {casa.foco.map((f) => NOME_ATTR[f]).join(" + ")}
            {focoDesatualizado && " · semana nova — confirme ou troque"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditandoFoco((v) => !v)}
          className="ml-auto border border-borda px-2 py-0.5 font-pixel text-[8px] text-suave transition hover:text-texto"
        >
          {casa.foco.length === 0 ? "DECLARAR" : "TROCAR"}
        </button>
      </div>
      {editandoFoco && (
        <SeletorFoco
          atual={casa.foco}
          onConfirmar={(foco) => {
            definirFoco(foco);
            setEditandoFoco(false);
            tocarSom("missao", 0.5);
          }}
        />
      )}

      {/* painel da estação selecionada (números explícitos ANTES de confirmar) */}
      {selecionada && (
        <PainelEstacao
          estacao={selecionada}
          intensidade={intensidade}
          setIntensidade={setIntensidade}
          tipoStream={tipoStream}
          setTipoStream={setTipoStream}
          variante={variante}
          setVariante={setVariante}
          championId={championId}
          setChampionId={setChampionId}
          agora={agora}
          energia={energia}
          proximoAdv={proximoAdv}
          onConfirmar={confirmar}
          onFechar={() => setSelecionada(null)}
          alteracaoMental={(t: TraitId) => {
            if (alteracaoMental(t)) {
              tocarSom("conquista", 0.5);
              setSelecionada(null);
            } else setAviso("Sem energia ou máximo de traços.");
          }}
        />
      )}

      {aviso && <p className="text-[11px] text-amber-400">{aviso}</p>}

      {/* 🎈 onboarding: 3 balões na primeira visita */}
      {intro >= 0 && intro < PASSOS_INTRO.length && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-[min(92vw,420px)] border-2 border-ciano bg-painel p-3 shadow-lg">
          <p className="text-[12px] text-texto">
            <span className="mr-1 text-lg">{PASSOS_INTRO[intro].emoji}</span>
            {PASSOS_INTRO[intro].txt}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-pixel text-[8px] text-suave">{intro + 1}/{PASSOS_INTRO.length}</span>
            <button
              type="button"
              onClick={() => {
                if (intro + 1 >= PASSOS_INTRO.length) {
                  try {
                    window.localStorage.setItem(LS_INTRO_CASA, "1");
                  } catch { /* sem persistência: ok */ }
                  setIntro(-1);
                } else setIntro(intro + 1);
              }}
              className="border-2 border-ciano bg-ciano/10 px-3 py-1 font-pixel text-[9px] text-ciano transition hover:bg-ciano hover:text-fundo"
            >
              {intro + 1 >= PASSOS_INTRO.length ? "ENTENDI!" : "PRÓXIMO →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Medidor({ rotulo, valor, cor, alerta }: { rotulo: string; valor: number; cor: string; alerta?: string }) {
  return (
    <div className="border border-borda bg-painel/60 px-2 py-1">
      <div className="flex justify-between">
        <span className="text-suave">{rotulo}</span>
        <span className="text-texto">
          {valor}
          {alerta && <span className="ml-1 animate-pulse font-pixel text-[8px] text-rose-400">{alerta}</span>}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 border border-borda bg-fundo">
        <div className="h-full transition-all" style={{ width: `${Math.min(100, valor)}%`, background: cor }} />
      </div>
    </div>
  );
}

function SeletorFoco({ atual, onConfirmar }: { atual: AtributoKey[]; onConfirmar: (foco: AtributoKey[]) => void }) {
  const [sel, setSel] = useState<AtributoKey[]>(atual);
  return (
    <div className="border-2 border-ciano/50 bg-ciano/5 p-2">
      <p className="mb-1.5 text-[11px] text-suave">
        Escolha <span className="text-texto">2 atributos</span> — sessões que os treinam ganham{" "}
        <span className="text-ciano">+{Math.round(CASA.focoBonus * 100)}%</span> (troca livre a cada semana):
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {ATRIBUTOS.map((a) => {
          const on = sel.includes(a.chave);
          return (
            <button
              key={a.chave}
              type="button"
              onClick={() => setSel((s) => (on ? s.filter((x) => x !== a.chave) : s.length < CASA.focoMax ? [...s, a.chave] : s))}
              className={`border px-1.5 py-1 text-[11px] transition ${on ? "border-ciano bg-ciano/15 text-ciano" : "border-borda text-suave hover:text-texto"}`}
            >
              {a.nome}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={sel.length !== CASA.focoMax}
        onClick={() => onConfirmar(sel)}
        className="mt-2 border-2 border-ciano bg-ciano/10 px-3 py-1 font-pixel text-[9px] text-ciano transition enabled:hover:bg-ciano enabled:hover:text-fundo disabled:opacity-40"
      >
        CONFIRMAR FOCO
      </button>
    </div>
  );
}

function PainelEstacao({
  estacao, intensidade, setIntensidade, tipoStream, setTipoStream, variante, setVariante, championId, setChampionId,
  agora, energia, proximoAdv, onConfirmar, onFechar, alteracaoMental,
}: {
  estacao: EstacaoId;
  intensidade: Intensidade;
  setIntensidade: (i: Intensidade) => void;
  tipoStream: TipoStream;
  setTipoStream: (t: TipoStream) => void;
  variante: VarianteMental | "traco";
  setVariante: (v: VarianteMental | "traco") => void;
  championId: string | null;
  setChampionId: (c: string | null) => void;
  agora: number;
  energia: number;
  proximoAdv: string | null;
  onConfirmar: () => void;
  onFechar: () => void;
  alteracaoMental: (t: TraitId) => void;
}) {
  const career = useCareer((s) => s.career)!;
  const casa = casaDe(career);
  const def = ESTACOES[estacao];
  const mult = multiplicadoresSessao(career, estacao, agora);
  const int = CASA.intensidades[intensidade];
  const bloqueada =
    (estacao === "SALA_DE_STREAM" && !featureLiberada(career, "stream")) ||
    (estacao === "ACADEMIA_SONO_TERAPIA" && !featureLiberada(career, "mental"));

  const ehMental = estacao === "ACADEMIA_SONO_TERAPIA";
  const ehStream = estacao === "SALA_DE_STREAM";
  const varSel = ehMental && variante !== "traco" ? VARIANTES_MENTAL[variante] : null;
  const streamSel = ehStream ? TIPOS_STREAM[tipoStream] : null;
  const recuperacao = varSel !== null && varSel.mental === 0;
  const custo = varSel ? varSel.custo : streamSel ? streamSel.custo : Math.round(def.custoBase * int.custo);
  const semEnergia = energia < custo;
  const nSessoes = casa.sessoesSemana[estacao] ?? 0;
  const tracosDisponiveis = TRACOS.filter((t) => t.inicial && !(career.player.tracos ?? []).includes(t.id));

  // ganhos estimados COM todos os multiplicadores (transparência antes do confirmar)
  const fator = (recuperacao ? 1 : int.ganho) * mult.total;
  const ganhos = Object.entries(varSel ? { mental: varSel.mental } : def.ganhos)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ attr: k as AtributoKey, valor: Math.round((v as number) * fator * 100) / 100 }));

  return (
    <div className="border-2 border-borda bg-painel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-pixel text-[10px] text-texto">
          {def.emoji} {def.nome.toUpperCase()}
        </h3>
        <button type="button" onClick={onFechar} className="text-[11px] text-suave hover:text-texto">✕</button>
      </div>
      <p className="mb-2 text-[11px] text-suave">{def.desc}</p>

      {bloqueada ? (
        <p className="text-[11px] text-amber-300">🔒 Destrava na semana 2 (unlock progressivo).</p>
      ) : (
        <>
          {/* variantes do bem-estar (incl. a alteração mental de sempre — o traço) */}
          {ehMental && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(Object.entries(VARIANTES_MENTAL) as [VarianteMental, (typeof VARIANTES_MENTAL)[VarianteMental]][]).map(([id, v]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVariante(id)}
                  className={`border px-2 py-1 text-[11px] transition ${variante === id ? "border-ciano bg-ciano/15 text-ciano" : "border-borda text-suave hover:text-texto"}`}
                >
                  {v.emoji} {v.nome}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setVariante("traco")}
                className={`border px-2 py-1 text-[11px] transition ${variante === "traco" ? "border-ciano bg-ciano/15 text-ciano" : "border-borda text-suave hover:text-texto"}`}
              >
                🧠 Traço novo (−{LOOP.custoAlteracao}⚡)
              </button>
            </div>
          )}

          {/* alteração mental (traço) — a 4ª variante, preservada do sistema antigo */}
          {ehMental && variante === "traco" ? (
            tracosDisponiveis.length === 0 ? (
              <p className="text-[11px] text-suave">Nenhum traço novo disponível.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {tracosDisponiveis.map((t) => (
                  <button key={t.id} type="button" onClick={() => alteracaoMental(t.id)} className="border border-borda bg-fundo/40 p-2 text-left transition hover:border-ciano">
                    <span className="font-pixel text-[9px] text-ciano">{t.nome}</span>
                    <span className="mt-0.5 block text-[11px] text-suave">{t.desc}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              {/* campeão (practice) / adversário (análise) */}
              {estacao === "CHAMPION_PRACTICE" && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {career.player.pool.map((p) => (
                    <button
                      key={p.championId}
                      type="button"
                      onClick={() => setChampionId(p.championId)}
                      className={`border px-2 py-1 text-[11px] transition ${championId === p.championId ? "border-ciano bg-ciano/15 text-ciano" : "border-borda text-suave hover:text-texto"}`}
                    >
                      {p.championId} · {Math.round(p.pontos)}
                    </button>
                  ))}
                </div>
              )}
              {estacao === "ANALISE_ADVERSARIO" &&
                (proximoAdv ? (
                  <p className="mb-2 text-[11px] text-texto">
                    Próximo adversário: <span className="font-pixel text-[9px] text-rosa">{timeDe(proximoAdv)?.nome ?? proximoAdv}</span>
                    {casaDe(career).analise?.timeId === proximoAdv ? (
                      <span className="mt-0.5 block text-emerald-400">
                        ✔ Estudado — tendência: gosta de <b>{tendenciasDoTime(proximoAdv).join(" + ")}</b>. O bônus entra no próximo draft contra ele.
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-suave">
                        Revela as tendências dele e dá <span className="text-ciano">+{CASA.analiseBonusComp} de counter</span> no draft — vale 1 partida, só contra ele.
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mb-2 text-[11px] text-amber-300">Sem confronto oficial à vista — entre numa liga pra ter o que estudar.</p>
                ))}

              {/* 🔴 stream: a decisão é o TIPO (co-stream destrava por reputação) */}
              {ehStream && (
                <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {(Object.entries(TIPOS_STREAM) as [TipoStream, (typeof TIPOS_STREAM)[TipoStream]][]).map(([id, t]) => {
                    const travado = career.player.reputacao < t.repMin;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={travado}
                        onClick={() => setTipoStream(id)}
                        title={travado ? `Destrava com ${t.repMin} de reputação` : t.desc}
                        className={`border p-1.5 text-left transition disabled:opacity-40 ${tipoStream === id && !travado ? "border-rosa bg-rosa/10" : "border-borda hover:border-suave"}`}
                      >
                        <span className={`block font-pixel text-[9px] ${tipoStream === id && !travado ? "text-rosa" : "text-texto"}`}>
                          {t.emoji} {t.nome}
                          {travado && <span className="ml-1 text-suave">🔒 rep {t.repMin}</span>}
                        </span>
                        <span className="block text-[10px] text-suave">
                          +${t.dinheiro} · +{t.reputacao} rep · fadiga +{t.fadiga}
                          {t.moral > 0 && <span className="text-sky-300"> · +{t.moral} moral</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* intensidades com números explícitos (não vale pra recuperação/análise/stream) */}
              {!recuperacao && !ehStream && estacao !== "ANALISE_ADVERSARIO" && (
                <div className="mb-2 grid grid-cols-3 gap-1.5">
                  {(Object.entries(CASA.intensidades) as [Intensidade, (typeof CASA.intensidades)[Intensidade]][]).map(([id, i]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setIntensidade(id)}
                      className={`border p-1.5 text-center transition ${intensidade === id ? "border-rosa bg-rosa/10" : "border-borda hover:border-suave"}`}
                    >
                      <span className={`block font-pixel text-[9px] ${intensidade === id ? "text-rosa" : "text-texto"}`}>{id.toUpperCase()}</span>
                      <span className="block text-[10px] text-suave">
                        −{Math.round(def.custoBase * i.custo)}⚡ · ganho ×{i.ganho} · fadiga ×{i.fadiga}
                        {i.moral < 0 && <span className="text-rose-400"> · {i.moral} moral</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* o EXTRATO da sessão: tudo explícito antes do clique */}
              <div className="mb-2 border border-borda bg-fundo/40 p-2 text-[11px]">
                {ganhos.length > 0 && (
                  <p className="text-emerald-400">
                    {ganhos.map((g) => `+${g.valor} ${NOME_ATTR[g.attr]}`).join(" · ")}
                    {estacao === "CHAMPION_PRACTICE" && def.maestria && <span className="text-amber-300"> · +{Math.round(def.maestria * fator * 10) / 10} maestria</span>}
                  </p>
                )}
                {streamSel && <p className="text-amber-300">+${streamSel.dinheiro} · +{streamSel.reputacao} reputação{streamSel.moral > 0 && <span className="text-sky-300"> · +{streamSel.moral} moral</span>}</p>}
                {varSel && varSel.moral !== 0 && <p className="text-sky-300">+{varSel.moral} moral</p>}
                {varSel && varSel.fadiga < 0 && <p className="text-sky-300">{varSel.fadiga} fadiga{varSel.limpaBurnout ? " · sara burnout" : ""}</p>}
                <p className="mt-1 text-suave">
                  custo <span className="text-texto">−{custo}⚡</span>
                  {!recuperacao && <> · fadiga <span className="text-texto">+{varSel ? varSel.fadiga : streamSel ? streamSel.fadiga : Math.round(def.fadigaBase * int.fadiga)}</span></>}
                  {" · "}mult: moral <b className={mult.moral > 1 ? "text-emerald-400" : mult.moral < 1 ? "text-rose-400" : "text-texto"}>×{mult.moral.toFixed(2)}</b>
                  {mult.foco > 1 && <> · foco <b className="text-ciano">×{mult.foco.toFixed(2)}</b></>}
                  {" · "}
                  <span title={`${nSessoes + 1}ª sessão nesta estação esta semana`}>
                    rendimento <b className={mult.decrescente < 1 ? "text-amber-300" : "text-texto"}>×{mult.decrescente.toFixed(2)}</b>
                  </span>
                  {mult.burnout < 1 && <> · <b className="text-rose-400">burnout ×{mult.burnout}</b></>}
                </p>
                {nSessoes > 0 && <p className="mt-0.5 text-[10px] text-amber-300">{nSessoes + 1}ª sessão nesta estação esta semana: −{Math.round((1 - mult.decrescente) * 100)}% de rendimento</p>}
              </div>

              <button
                type="button"
                disabled={semEnergia || (estacao === "ANALISE_ADVERSARIO" && !proximoAdv)}
                onClick={onConfirmar}
                className="border-2 border-rosa bg-rosa/10 px-4 py-1.5 font-pixel text-[10px] text-rosa transition enabled:hover:bg-rosa enabled:hover:text-fundo disabled:opacity-40"
              >
                {semEnergia ? `SEM ENERGIA (precisa ${custo}⚡)` : "▶ TREINAR"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
