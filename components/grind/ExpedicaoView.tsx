"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPEDICAO, ehBoss, inimigosDaFase, nomeFase } from "@/data/expedicao";
import { defCosmetico } from "@/data/grindProposito";
import { estimarProximaFase, type EstadoExpedicao } from "@/engine/expedicao";
import { modsExpedicaoDoGrind, type FimExpedicao } from "@/engine/grind";
import { useCareer } from "@/store/careerStore";
import { carregarAtlasReal } from "./diorama/atlasReal";
import { CENA_H, CENA_W, criarCena, type CenaDiorama } from "./diorama/cena";
import { familiaPixel } from "./diorama/pixels";

// 🗺️ Expedição — a TELA do modo ativo/arriscado. Reusa o MOTOR do diorama (mesmos sprites,
// mesma linguagem visual) como cenário de combate; o HUD de HP/fase e o dilema push-your-luck
// vivem em React por cima. NÃO roda em segundo plano/PiP (só o Treino tem esse direito):
// sair da tela encerra a corrida e embolsa o loot das fases COMPLETADAS (robustez no store).

function barra(pct: number, cor: string) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-sm border border-borda bg-fundo">
      <div className="h-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} />
    </div>
  );
}

export default function ExpedicaoView() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const entrar = useCareer((s) => s.entrarExpedicao);
  const continuar = useCareer((s) => s.continuarExpedicao);
  const recuar = useCareer((s) => s.recuarExpedicao);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cenaRef = useRef<CenaDiorama | null>(null);
  const [resultado, setResultado] = useState<FimExpedicao | null>(null);
  const [flash, setFlash] = useState(0); // 0..1 clarão vermelho ao tomar dano

  const g = career?.grind;
  const exp: EstadoExpedicao | null = g?.expedicao ?? null;

  // 🛟 robustez: sair da tela (navegar/desmontar) encerra a corrida e embolsa o garantido.
  useEffect(() => {
    return () => {
      useCareer.getState().encerrarExpedicaoPendente();
    };
  }, []);

  // motor de cena como CENÁRIO (loop simples, sem PiP — a Expedição exige presença).
  useEffect(() => {
    const canvas = canvasRef.current;
    const c0 = useCareer.getState().career;
    if (!canvas || !c0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = CENA_W;
    canvas.height = CENA_H;
    ctx.imageSmoothingEnabled = false;

    const cena = criarCena(ctx, {
      rota: c0.player.rota,
      elo: c0.player.rankSoloq.elo,
      seedDia: c0.grind?.expedicao?.seed ?? c0.grind?.seedDia ?? 1,
      familia: familiaPixel(),
      placar: () => ({ v: 0, d: 0 }),
      dinheiroDia: () => 0,
      sucataDia: () => 0,
      barraPct: () => 0,
      tetoPct: () => 0,
      aoEvento: () => {},
    });
    cena.definirHud(false); // o HUD do passivo não aparece aqui (HP/fase é React)
    cenaRef.current = cena;
    void carregarAtlasReal().then((a) => {
      if (a && cenaRef.current === cena) cena.definirAtlasReal(a);
    });
    const gc = c0.grind;
    cena.definirCosmeticos({
      skin: gc?.equipado.skin ? defCosmetico(gc.equipado.skin)?.cor : undefined,
      trilha: gc?.equipado.trilha ? defCosmetico(gc.equipado.trilha)?.cor : undefined,
      pet: gc?.equipado.pet ? defCosmetico(gc.equipado.pet)?.cor : undefined,
    });

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

  // dirige a cena pela fase atual: nova leva + tensão crescente conforme a profundidade.
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || !exp) return;
    cena.definirPartida(exp.faseAtual, ehBoss(exp.faseAtual));
    cena.definirIntensidade(Math.min(1, (exp.faseAtual - 1) / 12));
  }, [exp?.faseAtual, exp?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // clarão de dano decai
  useEffect(() => {
    if (flash <= 0) return;
    const t = setTimeout(() => setFlash((f) => Math.max(0, f - 0.25)), 60);
    return () => clearTimeout(t);
  }, [flash]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const podeEntrar = !exp && !resultado;

  const onEntrar = () => {
    const r = entrar();
    if (r?.fim) setResultado(r.fim);
    else setFlash(1);
  };
  const onContinuar = () => {
    const r = continuar();
    if (r?.fim) setResultado(r.fim);
    else setFlash(1);
  };
  const onRecuar = () => {
    const f = recuar();
    if (f) setResultado(f);
  };
  const onVoltar = () => router.push("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-rosa">⚔️ EXPEDIÇÃO</h1>
          <p className="mt-1 text-[11px] text-suave">scrim hardcore contra times acima do seu nível — o auge do preparo</p>
        </div>
        <button onClick={onVoltar} className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar ao Treino
        </button>
      </header>

      {/* cenário de combate (motor do diorama reusado) */}
      <div className="relative overflow-hidden rounded border-2 border-borda bg-fundo">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ imageRendering: "pixelated", aspectRatio: `${CENA_W}/${CENA_H}` }}
        />
        {flash > 0 && <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(220,30,40,${flash * 0.4})` }} />}
        {/* HUD de HP + fase por cima do cenário */}
        {exp && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-1.5">
            <span className="font-pixel text-[9px] text-amber-300 drop-shadow">{nomeFase(exp.faseAtual)}</span>
            <span className="font-pixel text-[9px] text-suave drop-shadow">👥 {inimigosDaFase(exp.faseAtual)}</span>
          </div>
        )}
      </div>

      {/* PAINEL DE ESTADO */}
      {exp && !resultado && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-suave">
              <span>❤️ Vida do herói</span>
              <span className="tabular-nums">{exp.hpAtual}/{exp.hpMax}</span>
            </div>
            {barra((exp.hpAtual / exp.hpMax) * 100, exp.hpAtual / exp.hpMax > 0.35 ? "#34d399" : "#f43f5e")}
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
            <div className="border-2 border-borda bg-painel p-2">
              <p className="text-suave">Fase mais funda limpa</p>
              <p className="font-pixel text-ciano">{exp.faseLimpa}</p>
            </div>
            <div className="border-2 border-borda bg-painel p-2">
              <p className="text-suave">Loot em risco</p>
              <p className="font-pixel text-amber-300">🔩 {exp.lootSucata} · 🎁 {exp.lootBaus}</p>
            </div>
          </div>

          {/* O DILEMA push-your-luck */}
          {exp.status === "escolha" && <Dilema exp={exp} onContinuar={onContinuar} onRecuar={onRecuar} />}
        </section>
      )}

      {/* LANÇAMENTO */}
      {podeEntrar && <Lancamento onEntrar={onEntrar} />}

      {/* RESULTADO DA CORRIDA */}
      {resultado && <Resultado fim={resultado} onVoltar={onVoltar} onDeNovo={() => setResultado(null)} />}
    </main>
  );
}

function Dilema({ exp, onContinuar, onRecuar }: { exp: EstadoExpedicao; onContinuar: () => void; onRecuar: () => void }) {
  const career = useCareer((s) => s.career)!;
  const prev = estimarProximaFase(exp, career.player, modsExpedicaoDoGrind(career.grind ?? undefined));
  const risco = prev.chanceMorte >= 0.66 ? "MORTAL" : prev.chanceMorte >= 0.33 ? "ALTO" : prev.chanceMorte > 0 ? "MODERADO" : "SEGURO";
  const corRisco = prev.chanceMorte >= 0.66 ? "text-rose-500" : prev.chanceMorte >= 0.33 ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="flex flex-col gap-2 border-2 border-rosa/50 bg-rosa/5 p-3">
      <p className="text-center text-[11px] text-suave">
        Próxima: <span className="font-pixel text-texto">{nomeFase(prev.fase)}</span> · dano estimado{" "}
        <span className="text-rose-400">{prev.danoMin}–{prev.danoMax}</span> · risco de morte{" "}
        <span className={`font-pixel ${corRisco}`}>{risco}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onContinuar}
          className="border-2 border-rosa bg-rosa/10 px-3 py-2 font-pixel text-[11px] text-rosa transition hover:bg-rosa hover:text-fundo"
        >
          ⚔️ CONTINUAR<br />
          <span className="text-[9px] opacity-80">+🔩 {prev.sucataFase} · arrisca o loot</span>
        </button>
        <button
          onClick={onRecuar}
          className="border-2 border-emerald-400 bg-emerald-400/10 px-3 py-2 font-pixel text-[11px] text-emerald-400 transition hover:bg-emerald-400 hover:text-fundo"
        >
          🛟 RECUAR<br />
          <span className="text-[9px] opacity-80">garante 🔩 {exp.lootSucata} · 🎁 {exp.lootBaus}</span>
        </button>
      </div>
    </div>
  );
}

function Lancamento({ onEntrar }: { onEntrar: () => void }) {
  const career = useCareer((s) => s.career)!;
  const g = career.grind;
  const hoje = new Date().toISOString().slice(0, 10);
  const usadas = g?.expedicaoDia === hoje ? g.expedicoesNoDia : 0;
  const restam = Math.max(0, EXPEDICAO.maxPorDia - usadas);
  return (
    <section className="flex flex-col items-center gap-3 border-2 border-borda bg-painel p-4 text-center">
      <p className="text-[12px] text-texto">
        Entre por <span className="font-pixel text-rosa">conta própria</span>. Cada fase que você limpa te deixa escolher:{" "}
        <span className="text-rosa">ir mais fundo</span> (mais Sucata, melhor Ritmo, mais risco) ou{" "}
        <span className="text-emerald-400">recuar com o loot</span>.
      </p>
      <p className="text-[11px] text-suave">
        Morrer só custa o loot da corrida — <span className="text-texto">jamais</span> seu elo, atributos, itens ou Sucata guardada.
      </p>
      <p className="text-[10px] text-suave">Expedições hoje: <span className="font-pixel text-amber-300">{restam}/{EXPEDICAO.maxPorDia}</span></p>
      <button
        onClick={onEntrar}
        disabled={restam <= 0}
        className="border-2 border-rosa bg-rosa/10 px-5 py-2.5 font-pixel text-sm text-rosa transition enabled:hover:bg-rosa enabled:hover:text-fundo disabled:opacity-40"
      >
        {restam > 0 ? "⚔️ ENTRAR NA EXPEDIÇÃO" : "Sem expedições hoje — volte amanhã"}
      </button>
    </section>
  );
}

function Resultado({ fim, onVoltar, onDeNovo }: { fim: FimExpedicao; onVoltar: () => void; onDeNovo: () => void }) {
  const career = useCareer((s) => s.career);
  const hoje = new Date().toISOString().slice(0, 10);
  const g = career?.grind;
  const restam = Math.max(0, EXPEDICAO.maxPorDia - (g?.expedicaoDia === hoje ? g.expedicoesNoDia : 0));
  const nomeRitmo = fim.ritmo ? fim.ritmo.variante.replace("_", " ") : null;
  const nomesCosm = fim.cosmeticos.map((id) => defCosmetico(id)?.nome ?? id);
  return (
    <section className={`flex flex-col items-center gap-3 border-2 p-4 text-center ${fim.morreu ? "border-rose-500/60 bg-rose-500/5" : "border-emerald-400/60 bg-emerald-400/5"}`}>
      <h2 className="font-pixel text-sm">{fim.morreu ? "💀 VOCÊ CAIU" : "🛟 RECUOU COM O LOOT"}</h2>
      <p className="text-[12px] text-texto">
        Chegou à <span className="font-pixel text-ciano">Fase {fim.faseLimpa}</span>
        {fim.recorde && <span className="ml-1 font-pixel text-amber-300">· NOVO RECORDE! 🏆</span>}
      </p>
      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
        <span className="border border-borda bg-painel px-2 py-1">🔩 +{fim.sucata} Sucata</span>
        {fim.baus.length > 0 && <span className="border border-borda bg-painel px-2 py-1">🎁 {fim.baus.length} baú(s)</span>}
        {nomeRitmo && <span className="border border-rosa/50 bg-rosa/10 px-2 py-1 text-rosa">🔥 Ritmo: {nomeRitmo}</span>}
        {nomesCosm.map((n) => (
          <span key={n} className="border border-amber-300/60 bg-amber-300/10 px-2 py-1 text-amber-300">👑 {n}</span>
        ))}
      </div>
      {fim.ritmo && (
        <p className="text-[10px] text-suave">
          O Ritmo é o auge do preparo: buff <span className="text-texto">temporário</span> da próxima partida de soloq — some depois.
        </p>
      )}
      <div className="flex gap-2">
        {restam > 0 && (
          <button onClick={onDeNovo} className="border-2 border-rosa bg-rosa/10 px-4 py-2 font-pixel text-[11px] text-rosa transition hover:bg-rosa hover:text-fundo">
            ⚔️ DE NOVO ({restam})
          </button>
        )}
        <button onClick={onVoltar} className="border-2 border-borda px-4 py-2 font-pixel text-[11px] text-suave transition hover:text-texto">
          Voltar ao Treino
        </button>
      </div>
    </section>
  );
}
