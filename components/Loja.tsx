"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ATRIBUTOS } from "@/data/config";
import { ECONOMIA } from "@/data/economia";
import { LOJA } from "@/data/loja";
import { LOOP } from "@/data/loop";
import { chaveDia, escudoDisponivel } from "@/engine/diario";
import { cargasPartida, energiaAgora } from "@/engine/tempo";
import { salarioSemanal } from "@/engine/economia";
import { tocarSom } from "@/lib/som";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import type { AtributoKey, CareerState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import AnimatedNumber from "./juice/AnimatedNumber";

// 💰 LOJA v2: o salário vira DECISÃO — energia agora, vantagem na próxima partida,
// treino pago ou investimento de longo prazo. Cada card mostra o estado vivo do recurso.

export default function Loja({ career }: { career: CareerState }) {
  const bootcamp = useCareer((s) => s.bootcamp);
  const alternarCoach = useCareer((s) => s.alternarCoach);
  const sessaoMental = useCareer((s) => s.sessaoMental);
  const comprarLoja = useCareer((s) => s.comprarLoja);
  const vodReview = useCareer((s) => s.vodReview);
  const aulaParticular = useCareer((s) => s.aulaParticular);

  const [aviso, setAviso] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [modal, setModal] = useState<"vod" | "aula" | null>(null);
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);

  useEffect(() => {
    let vivo = true;
    buscarCampeoes()
      .then((cs) => vivo && setCampeoes(cs))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  const campMap = new Map(campeoes.map((c) => [c.id, c]));

  const agora = Date.now();
  const hoje = chaveDia(agora);
  const energia = Math.round(energiaAgora(career, agora));
  const cargas = Math.floor(cargasPartida(career, agora));
  const escudoOk = !career.diario || escudoDisponivel(career.diario, hoje);
  const abalado = career.player.moral < 40; // sessão mental fica mais barata/eficaz

  function feito(msg: string) {
    setOk(msg);
    setAviso(null);
    tocarSom("moeda");
  }
  function falhou(msg = "Dinheiro insuficiente.") {
    setAviso(msg);
    setOk(null);
  }
  function tenta(fn: () => boolean, sucesso: string, motivoFalha?: string) {
    if (fn()) feito(sucesso);
    else falhou(motivoFalha);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* caixa + contexto do salário */}
      <div className="flex items-center justify-between border-2 border-emerald-500/50 bg-emerald-500/5 px-4 py-3">
        <div>
          <span className="text-sm text-suave">Caixa</span>
          <p className="mt-0.5 text-[10px] text-suave">
            salário <span className="text-emerald-400">${salarioSemanal(career)}/sem</span> · bônus por vitória
          </p>
        </div>
        <span className="font-pixel text-lg text-emerald-400">
          $<AnimatedNumber valor={career.dinheiro} />
        </span>
      </div>

      {aviso && <p className="border-2 border-rosa/40 bg-rosa/10 p-2 text-sm text-rosa">{aviso}</p>}
      {ok && <p className="border-2 border-ciano/40 bg-ciano/10 p-2 text-sm text-ciano">{ok}</p>}

      {/* ---- CONSUMÍVEIS ---- */}
      <h2 className="mt-1 font-pixel text-[11px] text-suave">⚡ CONSUMÍVEIS</h2>
      <Card icone="⚡" titulo="Energético" desc={`+${LOJA.energetico.energia} de energia na hora · você: ${energia}/100`}>
        <Botao
          preco={LOJA.energetico.custo}
          desabilitado={energia >= 100 || career.dinheiro < LOJA.energetico.custo}
          onClick={() => tenta(() => comprarLoja("energetico"), "Energia no talo! ⚡", energia >= 100 ? "Energia já está cheia." : undefined)}
        />
      </Card>
      <Card icone="🔋" titulo="Mega Energético" desc={`Energia CHEIA na hora · você: ${energia}/100`}>
        <Botao
          preco={LOJA.megaEnergetico.custo}
          desabilitado={energia >= 100 || career.dinheiro < LOJA.megaEnergetico.custo}
          onClick={() => tenta(() => comprarLoja("megaEnergetico"), "100 de energia! 🔋", energia >= 100 ? "Energia já está cheia." : undefined)}
        />
      </Card>
      <Card icone="🎫" titulo="Carga de campeonato" desc={`+1 partida de liga/torneio agora · você: ${cargas}/${LOOP.maxCargasPartida}`}>
        <Botao
          preco={LOJA.cargaCampeonato.custo}
          desabilitado={cargas >= LOOP.maxCargasPartida || career.dinheiro < LOJA.cargaCampeonato.custo}
          onClick={() => tenta(() => comprarLoja("carga"), "Carga extra na conta! 🎫", cargas >= LOOP.maxCargasPartida ? "Cargas já estão no máximo." : undefined)}
        />
      </Card>
      <Card icone="🛡️" titulo="Escudo de streak" desc={escudoOk ? "Seu escudo semanal está intacto" : "Repõe o escudo que salvou seu streak"}>
        <Botao
          preco={LOJA.escudoStreak.custo}
          desabilitado={escudoOk || career.dinheiro < LOJA.escudoStreak.custo}
          onClick={() => tenta(() => comprarLoja("escudo"), "Escudo reposto! 🛡️", "O escudo já está disponível.")}
        />
      </Card>

      {/* ---- PREPARAÇÃO ---- */}
      <h2 className="mt-2 font-pixel text-[11px] text-suave">📼 PREPARAÇÃO</h2>
      <Card
        icone="📼"
        titulo="Estudo do adversário"
        desc={
          career.preparacao
            ? "ATIVO: +3 comp e +1 na sua lane na próxima partida"
            : `Buff da PRÓXIMA partida: +${LOJA.preparacao.comp} comp, +${LOJA.preparacao.counterLane} matchup da lane`
        }
      >
        <Botao
          preco={LOJA.preparacao.custo}
          desabilitado={!!career.preparacao || career.dinheiro < LOJA.preparacao.custo}
          onClick={() => tenta(() => comprarLoja("preparacao"), "VODs estudadas. Próxima partida é sua! 📼", career.preparacao ? "Você já está preparado." : undefined)}
        />
      </Card>

      {/* ---- TREINAMENTO ---- */}
      <h2 className="mt-2 font-pixel text-[11px] text-suave">🎯 TREINAMENTO PAGO</h2>
      <Card icone="🎯" titulo="VOD review pessoal" desc={`+${LOJA.vodReview.maestria} de maestria num campeão da sua pool (à escolha)`}>
        <Botao preco={LOJA.vodReview.custo} desabilitado={career.dinheiro < LOJA.vodReview.custo} onClick={() => setModal("vod")} rotulo="Escolher" />
      </Card>
      <Card icone="📚" titulo="Aula particular" desc={`+${LOJA.aulaParticular.xp} num atributo à escolha · SEM gastar energia`}>
        <Botao preco={LOJA.aulaParticular.custo} desabilitado={career.dinheiro < LOJA.aulaParticular.custo} onClick={() => setModal("aula")} rotulo="Escolher" />
      </Card>

      {/* ---- INVESTIMENTOS ---- */}
      <h2 className="mt-2 font-pixel text-[11px] text-suave">💼 INVESTIMENTOS</h2>
      <Card
        icone="🧠"
        titulo={abalado ? "Sessão mental (URGENTE)" : "Sessão mental/nutri"}
        desc={
          abalado
            ? `Moral baixa: METADE do preço e efeito extra! +${ECONOMIA.sessaoMental.moral + 15} moral`
            : `+${ECONOMIA.sessaoMental.moral} moral, +${ECONOMIA.sessaoMental.energia} energia`
        }
      >
        <Botao
          preco={abalado ? Math.round(ECONOMIA.sessaoMental.custo / 2) : ECONOMIA.sessaoMental.custo}
          desabilitado={false}
          onClick={() => tenta(sessaoMental, "Cabeça e corpo renovados. 🧠")}
        />
      </Card>
      <Card icone="🎓" titulo="Coach" desc={`+${ECONOMIA.coach.xpPorAtributo} em TODOS os atributos por semana · assinatura`}>
        <Botao
          preco={ECONOMIA.coach.upkeepSemanal}
          sufixo="/sem"
          desabilitado={false}
          rotulo={career.coachAtivo ? "Demitir" : "Contratar"}
          onClick={() => {
            alternarCoach();
            feito(career.coachAtivo ? "Coach dispensado." : "Coach contratado! 🎓");
          }}
        />
      </Card>
      <Card icone="🇰🇷" titulo="Bootcamp na Coreia" desc={`+XP geral forte · consome ${ECONOMIA.bootcamp.semanas} semanas de temporada`}>
        <Botao preco={ECONOMIA.bootcamp.custo} desabilitado={career.dinheiro < ECONOMIA.bootcamp.custo} onClick={() => tenta(bootcamp, "Você voltou da Coreia MUITO melhor! 🇰🇷")} rotulo="Ir" />
      </Card>

      {/* ---- modal: VOD review (escolhe campeão da pool) ---- */}
      {modal === "vod" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4" onClick={() => setModal(null)}>
          <div className="max-h-[80vh] w-full max-w-xs overflow-y-auto border-2 border-ciano bg-fundo p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-center font-pixel text-[11px] text-ciano">🎯 VOD REVIEW · ${LOJA.vodReview.custo}</p>
            <p className="mt-1 text-center text-[10px] text-suave">+{LOJA.vodReview.maestria} de maestria em:</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {career.player.pool.map((p) => (
                <button
                  key={p.championId}
                  type="button"
                  disabled={p.pontos >= 100}
                  onClick={() => {
                    if (vodReview(p.championId)) feito(`Maestria de ${campMap.get(p.championId)?.nome ?? p.championId} subiu! 🎯`);
                    else falhou();
                    setModal(null);
                  }}
                  className="flex items-center gap-2 border-2 border-borda bg-painel p-2 text-left transition hover:border-ciano disabled:opacity-40"
                >
                  {campMap.get(p.championId)?.icone && <img src={campMap.get(p.championId)!.icone} alt="" className="h-8 w-8" />}
                  <span className="flex-1 text-[12px] text-texto">{campMap.get(p.championId)?.nome ?? p.championId}</span>
                  <span className="font-pixel text-[10px] text-ciano">M{Math.round(p.pontos)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- modal: aula particular (escolhe atributo) ---- */}
      {modal === "aula" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4" onClick={() => setModal(null)}>
          <div className="max-h-[80vh] w-full max-w-xs overflow-y-auto border-2 border-ciano bg-fundo p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-center font-pixel text-[11px] text-ciano">📚 AULA PARTICULAR · ${LOJA.aulaParticular.custo}</p>
            <p className="mt-1 text-center text-[10px] text-suave">+{LOJA.aulaParticular.xp} (sem gastar energia) em:</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {ATRIBUTOS.map((a) => (
                <button
                  key={a.chave}
                  type="button"
                  disabled={career.player.atributos[a.chave as AtributoKey] >= 100}
                  onClick={() => {
                    if (aulaParticular(a.chave as AtributoKey)) feito(`${a.nome} +${LOJA.aulaParticular.xp}! 📚`);
                    else falhou();
                    setModal(null);
                  }}
                  className="flex flex-col items-center gap-0.5 border-2 border-borda bg-painel p-2 transition hover:border-ciano disabled:opacity-40"
                >
                  <span className="text-[11px] text-texto">{a.nome}</span>
                  <span className="font-pixel text-[10px] text-ciano">{Math.round(career.player.atributos[a.chave as AtributoKey])}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ icone, titulo, desc, children }: { icone: string; titulo: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-borda bg-painel p-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icone}</span>
        <div className="min-w-0">
          <p className="text-sm text-texto">{titulo}</p>
          <p className="text-[12px] text-suave">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Botao({
  preco,
  sufixo = "",
  desabilitado,
  onClick,
  rotulo = "Comprar",
}: {
  preco: number;
  sufixo?: string;
  desabilitado: boolean;
  onClick: () => void;
  rotulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className="flex flex-col items-center border-2 border-rosa bg-rosa/10 px-3 py-1.5 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rosa/10 disabled:hover:text-rosa"
    >
      {rotulo}
      <span className="text-[9px] opacity-90">
        ${preco}
        {sufixo}
      </span>
    </button>
  );
}
