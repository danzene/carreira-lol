"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { ATRIBUTOS, TRACOS } from "@/data/config";
import { LOOP } from "@/data/loop";
import { energiaAgora, proximoUsoEm, usosRestantes } from "@/engine/tempo";
import type { AtributoKey, CareerState, TraitId } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import AnimacaoAcao, { type TipoAcao } from "./AnimacaoAcao";
import AnimatedNumber from "./juice/AnimatedNumber";

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

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const energia = energiaAgora(career, agora);
  const tempoCheia = energia >= 100 ? 0 : Math.ceil((100 - energia) * (LOOP.energiaCheiaMs / 100));
  const usosAvancar = usosRestantes(career.avancosEm, agora);
  const usosDescansar = usosRestantes(career.descansosEm, agora);
  const liberaAvancar = proximoUsoEm(career.avancosEm, agora);
  const liberaDescansar = proximoUsoEm(career.descansosEm, agora);
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
      <h2 className="mb-3 font-pixel text-[11px] text-suave">
        TEMPORADA {career.temporada} · SEMANA {career.semanaAtual}
      </h2>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-suave">Energia</span>
          <span className="text-texto">
            <AnimatedNumber valor={Math.round(energia)} />/100
          </span>
        </div>
        <div className="h-3 border-2 border-borda bg-fundo">
          <div className="h-full bg-gradient-to-r from-rosa to-ciano transition-all" style={{ width: `${energia}%` }} />
        </div>
        <p className="mt-1 text-right text-[10px] text-suave">
          {tempoCheia > 0 ? `🕒 cheia em ${fmt(tempoCheia)}` : "⚡ energia cheia"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={podeSoloq ? "/draft" : "#"}
          aria-disabled={!podeSoloq}
          className={`flex flex-col items-center gap-0.5 border-2 px-2 py-3 text-center font-pixel text-[11px] transition ${
            podeSoloq
              ? "border-rosa bg-rosa/10 text-rosa hover:bg-rosa hover:text-fundo"
              : "pointer-events-none border-borda text-borda"
          }`}
        >
          ⚔️ JOGAR
          <span className="text-[9px] font-normal opacity-80">−{LOOP.custoSoloq}</span>
        </Link>
        <Atividade rotulo={<IconeAcao acao="treino" label="TREINO" />} sub={`−${LOOP.custoTreino}`} disabled={energia < LOOP.custoTreino} onClick={() => setPainel((p) => (p === "focado" ? null : "focado"))} />
        <Atividade rotulo={<IconeAcao acao="especial" label="ESPECIAL" />} sub={`−${LOOP.custoEspecial}`} disabled={energia < LOOP.custoEspecial} onClick={() => setPainel((p) => (p === "especial" ? null : "especial"))} />
        <Atividade rotulo={<IconeAcao acao="stream" label="STREAM" />} sub={`−${LOOP.custoStream} +$`} disabled={energia < LOOP.custoStream} onClick={live} />
        <Atividade rotulo={<IconeAcao acao="mental" label="MENTAL" />} sub={`−${LOOP.custoAlteracao}`} disabled={energia < LOOP.custoAlteracao} onClick={() => setPainel((p) => (p === "mental" ? null : "mental"))} />
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
                <span className="font-pixel text-[11px] text-ciano">
                  <AnimatedNumber valor={Math.round(career.player.atributos[a.chave])} />
                </span>
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
                  <span className="font-pixel text-[11px] text-ciano">{t.nome}</span>
                  <span className="mt-1 block text-[12px] text-suave">{t.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aviso && <p className="mt-2 text-xs text-amber-400">{aviso}</p>}

      <p className="mt-3 text-center text-[11px] text-borda">
        A energia regenera sozinha (2h pra encher). Avançar/descansar a semana têm limite por tempo.
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={usosAvancar <= 0}
          onClick={() => {
            avancarSemana("normal");
            setAviso(null);
            setPainel(null);
          }}
          className="flex flex-col items-center gap-0.5 border-2 border-ciano bg-ciano/10 py-3 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ciano/10 disabled:hover:text-ciano"
        >
          ⏭️ AVANÇAR SEMANA
          <span className="text-[9px] font-normal opacity-80">
            {usosAvancar > 0 ? `${usosAvancar}/${LOOP.maxPassesJanela} · +${LOOP.ganhoAvancoEnergia}⚡` : `🔒 ${fmt(liberaAvancar)}`}
          </span>
        </button>
        <button
          type="button"
          disabled={usosDescansar <= 0}
          onClick={() => {
            avancarSemana("descanso");
            setAviso(null);
            setPainel(null);
          }}
          className="flex flex-col items-center gap-0.5 border-2 border-borda bg-fundo/40 py-3 font-pixel text-[11px] text-suave transition hover:border-suave disabled:cursor-not-allowed disabled:opacity-40"
        >
          😴 DESCANSAR
          <span className="text-[9px] font-normal opacity-80">
            {usosDescansar > 0 ? `${usosDescansar}/${LOOP.maxPassesJanela} · energia cheia` : `🔒 ${fmt(liberaDescansar)}`}
          </span>
        </button>
      </div>

      {anim && <AnimacaoAcao tipo={anim.tipo} titulo={anim.titulo} legenda={anim.legenda} onFechar={() => setAnim(null)} />}
    </div>
  );
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  if (m > 0) return `${m}m${seg.toString().padStart(2, "0")}s`;
  return `${seg}s`;
}

function IconeAcao({ acao, label }: { acao: TipoAcao; label: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <img src={`/carreira/icones/${acao}.png`} alt="" className="img-hd h-9 w-9" />
      <span>{label}</span>
    </span>
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
      className="flex flex-col items-center gap-0.5 border-2 border-borda bg-fundo/40 px-2 py-3 text-center font-pixel text-[11px] text-texto transition hover:border-suave disabled:opacity-40"
    >
      {rotulo}
      <span className="text-[9px] font-normal text-suave">{sub}</span>
    </button>
  );
}
