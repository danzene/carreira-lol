"use client";

import { type ReactNode, useState } from "react";
import { ATRIBUTOS } from "@/data/config";
import { ECONOMIA, EQUIP_INFO, EQUIP_MAX_NIVEL } from "@/data/economia";
import { custoUpgrade, nivelEquip } from "@/engine/economia";
import type { CareerState, Equip } from "@/engine/types";
import { useCareer } from "@/store/careerStore";

const TIPOS: Equip["tipo"][] = ["HEADSET", "MOUSE", "CADEIRA", "MONITOR"];
const nomeAtr = (k: string) => ATRIBUTOS.find((a) => a.chave === k)?.nome ?? k;

export default function Loja({ career }: { career: CareerState }) {
  const bootcamp = useCareer((s) => s.bootcamp);
  const alternarCoach = useCareer((s) => s.alternarCoach);
  const sessaoMental = useCareer((s) => s.sessaoMental);
  const upgradeEquip = useCareer((s) => s.upgradeEquip);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function tenta(fn: () => boolean, sucesso: string) {
    if (fn()) {
      setOk(sucesso);
      setAviso(null);
    } else {
      setAviso("Dinheiro insuficiente.");
      setOk(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between border-2 border-borda bg-painel px-4 py-3">
        <span className="text-sm text-suave">Caixa</span>
        <span className="font-pixel text-sm text-emerald-400">${career.dinheiro}</span>
      </div>
      <p className="text-[10px] text-borda">
        Salário: ${ECONOMIA.rendaBaseSemanal}/sem · bônus vitória: ${ECONOMIA.bonusBaseVitoria} · coach:{" "}
        {career.coachAtivo ? "ativo" : "inativo"}
      </p>

      {aviso && <p className="border-2 border-rosa/40 bg-rosa/10 p-2 text-sm text-rosa">{aviso}</p>}
      {ok && <p className="border-2 border-ciano/40 bg-ciano/10 p-2 text-sm text-ciano">{ok}</p>}

      <h2 className="mt-2 font-pixel text-[10px] text-suave">INVESTIMENTOS</h2>
      <Card icone="🧠" titulo="Sessão mental/nutri" desc={`+${ECONOMIA.sessaoMental.moral} moral, +${ECONOMIA.sessaoMental.energia} energia · $${ECONOMIA.sessaoMental.custo}`}>
        <Botao onClick={() => tenta(sessaoMental, "Cabeça e corpo renovados.")}>Agendar</Botao>
      </Card>
      <Card icone="🎓" titulo="Coach" desc={`+${ECONOMIA.coach.xpPorAtributo} em tudo por semana · $${ECONOMIA.coach.upkeepSemanal}/semana`}>
        <Botao
          onClick={() => {
            alternarCoach();
            setOk(career.coachAtivo ? "Coach dispensado." : "Coach contratado!");
            setAviso(null);
          }}
        >
          {career.coachAtivo ? "Demitir" : "Contratar"}
        </Botao>
      </Card>
      <Card icone="🇰🇷" titulo="Bootcamp na Coreia" desc={`+XP geral forte · consome ${ECONOMIA.bootcamp.semanas} semanas · $${ECONOMIA.bootcamp.custo}`}>
        <Botao onClick={() => tenta(bootcamp, "Você voltou da Coreia muito melhor!")}>Ir</Botao>
      </Card>

      <h2 className="mt-2 font-pixel text-[10px] text-suave">PERIFÉRICOS</h2>
      {TIPOS.map((tipo) => {
        const info = EQUIP_INFO[tipo];
        const nivel = nivelEquip(career, tipo);
        const max = nivel >= EQUIP_MAX_NIVEL;
        const custo = custoUpgrade(nivel);
        return (
          <Card
            key={tipo}
            icone={info.icone}
            titulo={`${info.nome} · Nv ${nivel}/${EQUIP_MAX_NIVEL}`}
            desc={`+${info.bonusPorNivel}/nível em ${nomeAtr(info.atributo)}${max ? "" : ` · próximo: $${custo}`}`}
          >
            {max ? (
              <span className="font-pixel text-[10px] text-emerald-400">MÁX</span>
            ) : (
              <Botao onClick={() => tenta(() => upgradeEquip(tipo), `${info.nome} melhorado!`)}>Upgrade</Botao>
            )}
          </Card>
        );
      })}
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
          <p className="text-[11px] text-suave">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Botao({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-2 border-rosa bg-rosa/10 px-4 py-2 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
    >
      {children}
    </button>
  );
}
