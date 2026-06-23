"use client";

import { type ReactNode, useState } from "react";
import { ECONOMIA } from "@/data/economia";
import type { CareerState } from "@/engine/types";
import { useCareer, type TipoInvestimento } from "@/store/careerStore";

export default function Loja({ career }: { career: CareerState }) {
  const investir = useCareer((s) => s.investir);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function comprar(tipo: TipoInvestimento, sucesso: string) {
    const erro = investir(tipo);
    if (erro) {
      setAviso(erro);
      setOk(null);
    } else {
      setOk(sucesso);
      setAviso(null);
    }
  }

  const dinheiro = career.dinheiro;
  const energia = career.player.energia;

  return (
    <div className="flex flex-col gap-3">
      {/* resumo */}
      <div className="flex items-center justify-between rounded-xl border border-borda bg-painel px-4 py-3">
        <span className="text-sm text-zinc-400">Caixa</span>
        <span className="text-xl font-bold text-emerald-400">${dinheiro}</span>
      </div>
      <p className="text-xs text-zinc-600">
        Renda base: ${ECONOMIA.rendaBaseSemanal}/semana · Coach: {career.coachAtivo ? "ativo" : "inativo"}
      </p>

      {aviso && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{aviso}</p>}
      {ok && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-400">{ok}</p>}

      <Card
        icone="📺"
        titulo="Fazer uma live"
        desc={`+$${ECONOMIA.stream.dinheiro} e +${ECONOMIA.stream.moral} moral · custa ${ECONOMIA.stream.energia} energia`}
      >
        <Botao
          onClick={() => comprar("stream", "Live feita! Grana no bolso.")}
          desabilitado={energia < ECONOMIA.stream.energia}
        >
          Transmitir
        </Botao>
      </Card>

      <Card
        icone="🖱️"
        titulo="Setup pro"
        desc={`+${ECONOMIA.setup.mecanica} de Mecânica (permanente) · $${ECONOMIA.setup.custo}`}
      >
        {career.setupComprado ? (
          <span className="text-sm font-semibold text-emerald-400">Comprado ✓</span>
        ) : (
          <Botao onClick={() => comprar("setup", "Setup novo instalado!")} desabilitado={dinheiro < ECONOMIA.setup.custo}>
            Comprar
          </Botao>
        )}
      </Card>

      <Card
        icone="🧠"
        titulo="Psicólogo / nutri"
        desc={`+${ECONOMIA.sessaoMental.moral} moral e +${ECONOMIA.sessaoMental.energia} energia · $${ECONOMIA.sessaoMental.custo}`}
      >
        <Botao onClick={() => comprar("mental", "Cabeça e corpo renovados.")} desabilitado={dinheiro < ECONOMIA.sessaoMental.custo}>
          Agendar
        </Botao>
      </Card>

      <Card
        icone="🎓"
        titulo="Coach"
        desc={`+${ECONOMIA.coach.xpPorAtributo} em todos os atributos por semana · $${ECONOMIA.coach.upkeepSemanal}/semana`}
      >
        <Botao onClick={() => comprar("coach", career.coachAtivo ? "Coach dispensado." : "Coach contratado!")}>
          {career.coachAtivo ? "Demitir" : "Contratar"}
        </Botao>
      </Card>

      <Card
        icone="🇰🇷"
        titulo="Bootcamp na Coreia"
        desc={`+XP geral (forte) · consome ${ECONOMIA.bootcamp.semanas} semanas · $${ECONOMIA.bootcamp.custo}`}
      >
        <Botao onClick={() => comprar("bootcamp", "Você voltou da Coreia muito melhor!")} desabilitado={dinheiro < ECONOMIA.bootcamp.custo}>
          Ir pra Coreia
        </Botao>
      </Card>
    </div>
  );
}

function Card({ icone, titulo, desc, children }: { icone: string; titulo: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-painel p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icone}</span>
        <div className="min-w-0">
          <p className="font-semibold text-zinc-100">{titulo}</p>
          <p className="text-xs text-zinc-500">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Botao({
  children,
  onClick,
  desabilitado = false,
}: {
  children: ReactNode;
  onClick: () => void;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className="rounded-lg bg-destaque px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
