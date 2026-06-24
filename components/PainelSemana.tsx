"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { ATRIBUTOS, TRACOS } from "@/data/config";
import { LOOP } from "@/data/loop";
import type { AtributoKey, CareerState, TraitId } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import AnimacaoAcao, { type TipoAcao } from "./AnimacaoAcao";

type Painel = null | "focado" | "especial" | "mental";
type Anim = { tipo: TipoAcao; titulo: string; legenda: string };

export default function PainelSemana({ career }: { career: CareerState }) {
  const treinar = useCareer((s) => s.treinar);
  const streaming = useCareer((s) => s.streaming);
  const alteracaoMental = useCareer((s) => s.alteracaoMental);
  const avancarSemana = useCareer((s) => s.avancarSemana);

  const [painel, setPainel] = useState<Painel>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);

  const energia = career.player.energia;
  const podeSoloq = energia >= LOOP.custoSoloq;

  function treino(k: AtributoKey, especial: boolean) {
    if (!treinar(k, especial)) setAviso("Sem energia.");
    else {
      const nome = ATRIBUTOS.find((a) => a.chave === k)?.nome ?? k;
      setAnim({
        tipo: especial ? "especial" : "treino",
        titulo: especial ? "TREINO ESPECIAL" : "TREINO",
        legenda: `${nome} ↑`,
      });
      setAviso(null);
      setPainel(null);
    }
  }
  function live() {
    if (!streaming()) setAviso("Sem energia para a live.");
    else {
      setAnim({ tipo: "stream", titulo: "AO VIVO", legenda: `+$${LOOP.ganhoStream} · +reputação` });
      setAviso(null);
    }
  }
  function mental(t: TraitId) {
    if (!alteracaoMental(t)) {
      setAviso(career.player.tracos.length >= LOOP.maxTracos ? "Você já tem o máximo de traços." : "Sem energia.");
    } else {
      const nome = TRACOS.find((x) => x.id === t)?.nome ?? t;
      setAnim({ tipo: "mental", titulo: "FOCO MENTAL", legenda: `Novo traço: ${nome}` });
      setAviso(null);
      setPainel(null);
    }
  }

  const tracosDisponiveis = TRACOS.filter((t) => t.inicial && !career.player.tracos.includes(t.id));

  return (
    <div className="border-2 border-borda bg-painel p-5">
      <h2 className="mb-3 font-pixel text-[10px] text-suave">
        TEMPORADA {career.temporada} · SEMANA {career.semanaAtual}
      </h2>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-suave">Energia</span>
          <span className="text-texto">{Math.round(energia)}/100</span>
        </div>
        <div className="h-3 border-2 border-borda bg-fundo">
          <div className="h-full bg-gradient-to-r from-rosa to-ciano" style={{ width: `${energia}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={podeSoloq ? "/draft" : "#"}
          aria-disabled={!podeSoloq}
          className={`flex flex-col items-center gap-0.5 border-2 px-2 py-3 text-center font-pixel text-[10px] transition ${
            podeSoloq
              ? "border-rosa bg-rosa/10 text-rosa hover:bg-rosa hover:text-fundo"
              : "pointer-events-none border-borda text-borda"
          }`}
        >
          ⚔️ JOGAR
          <span className="text-[7px] font-normal opacity-80">−{LOOP.custoSoloq}</span>
        </Link>
        <Atividade rotulo="🎯 TREINO" sub={`−${LOOP.custoTreino}`} disabled={energia < LOOP.custoTreino} onClick={() => setPainel((p) => (p === "focado" ? null : "focado"))} />
        <Atividade rotulo="🔥 ESPECIAL" sub={`−${LOOP.custoEspecial}`} disabled={energia < LOOP.custoEspecial} onClick={() => setPainel((p) => (p === "especial" ? null : "especial"))} />
        <Atividade rotulo="📺 STREAM" sub={`−${LOOP.custoStream} +$`} disabled={energia < LOOP.custoStream} onClick={live} />
        <Atividade rotulo="🧠 MENTAL" sub={`−${LOOP.custoAlteracao}`} disabled={energia < LOOP.custoAlteracao} onClick={() => setPainel((p) => (p === "mental" ? null : "mental"))} />
      </div>

      {(painel === "focado" || painel === "especial") && (
        <div className="mt-3 border-2 border-borda bg-fundo/40 p-3">
          <p className="mb-2 text-xs text-suave">
            Treinar qual atributo? (+{painel === "especial" ? LOOP.ganhoEspecial : LOOP.ganhoTreino})
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ATRIBUTOS.map((a) => (
              <button
                key={a.chave}
                type="button"
                onClick={() => treino(a.chave, painel === "especial")}
                className="flex flex-col items-center gap-0.5 border-2 border-borda bg-painel p-2 text-center transition hover:border-rosa"
              >
                <span className="text-xs text-texto">{a.nome}</span>
                <span className="font-pixel text-[10px] text-ciano">{Math.round(career.player.atributos[a.chave])}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {painel === "mental" && (
        <div className="mt-3 border-2 border-borda bg-fundo/40 p-3">
          <p className="mb-2 text-xs text-suave">Ganhar um traço novo (até {LOOP.maxTracos}):</p>
          {tracosDisponiveis.length === 0 ? (
            <p className="text-xs text-borda">Nenhum traço novo disponível.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tracosDisponiveis.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => mental(t.id)}
                  className="border-2 border-borda bg-painel p-2 text-left transition hover:border-rosa"
                >
                  <span className="font-pixel text-[10px] text-ciano">{t.nome}</span>
                  <span className="mt-1 block text-[11px] text-suave">{t.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aviso && <p className="mt-2 text-xs text-amber-400">{aviso}</p>}

      <p className="mt-3 text-center text-[10px] text-borda">A energia só recupera quando o tempo passa.</p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            avancarSemana("normal");
            setAviso(null);
            setPainel(null);
          }}
          className="border-2 border-ciano bg-ciano/10 py-3 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          ⏭️ AVANÇAR SEMANA
        </button>
        <button
          type="button"
          onClick={() => {
            avancarSemana("descanso");
            setAviso(null);
            setPainel(null);
          }}
          className="border-2 border-borda bg-fundo/40 py-3 font-pixel text-[10px] text-suave transition hover:border-suave"
        >
          😴 DESCANSAR A SEMANA
        </button>
      </div>

      {anim && <AnimacaoAcao tipo={anim.tipo} titulo={anim.titulo} legenda={anim.legenda} onFechar={() => setAnim(null)} />}
    </div>
  );
}

function Atividade({
  rotulo,
  sub,
  onClick,
  disabled = false,
}: {
  rotulo: ReactNode;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-0.5 border-2 border-borda bg-fundo/40 px-2 py-3 text-center font-pixel text-[10px] text-texto transition hover:border-suave disabled:opacity-40"
    >
      {rotulo}
      <span className="text-[7px] font-normal text-suave">{sub}</span>
    </button>
  );
}
