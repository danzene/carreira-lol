"use client";

import { timeDe } from "@/data/times";
import type { TomResposta } from "@/engine/feed";
import { tocarSom } from "@/lib/som";
import { useCareer } from "@/store/careerStore";

// 🎤 Entrevista pós-jogo (dilema leve): 3 tons de resposta com efeitos pequenos e claros.
// A fala escolhida vira post no feed. Máx. 1 por semana (regra no engine).

const CONTEXTO: Record<string, string> = {
  titulo: "Você acabou de levantar um título internacional! A imprensa quer ouvir:",
  campeao_liga: "CAMPEÃO da liga! Microfones apontados pra você:",
  rival: "Vitória sobre o seu RIVAL! O repórter pergunta o que passa pela sua cabeça:",
};

const OPCOES: { tom: TomResposta; rotulo: string; fala: string; efeito: string; cor: string }[] = [
  { tom: "humilde", rotulo: "😊 HUMILDE", fala: "Foi mérito do time inteiro…", efeito: "+2 reputação · +5 moral", cor: "#2fd66e" },
  { tom: "confiante", rotulo: "😎 CONFIANTE", fala: "A gente treinou pra isso.", efeito: "+4 reputação", cor: "#19e6e0" },
  { tom: "provocadora", rotulo: "😈 PROVOCADORA", fala: "Esperava mais deles…", efeito: "+5 reputação · acende RIVALIDADE", cor: "#ff2d7e" },
];

export default function EntrevistaModal() {
  const career = useCareer((s) => s.career);
  const responder = useCareer((s) => s.responderEntrevista);
  const pend = career?.entrevistaPendente;
  if (!pend) return null;

  const rivalNome = pend.adversarioId ? timeDe(pend.adversarioId)?.nome ?? pend.adversarioId : null;

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/80 px-4" role="dialog" aria-label="Entrevista">
      <div className="w-full max-w-sm border-2 border-ciano bg-fundo p-4">
        <p className="text-center text-2xl">🎤</p>
        <h2 className="mt-1 text-center font-pixel text-[12px] text-ciano">ENTREVISTA PÓS-JOGO</h2>
        <p className="mt-2 text-center text-[12px] text-texto">
          {CONTEXTO[pend.contexto]}
          {rivalNome && pend.contexto === "rival" && <span className="text-suave"> (vs {rivalNome})</span>}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {OPCOES.map((o) => (
            <button
              key={o.tom}
              type="button"
              onClick={() => {
                responder(o.tom);
                tocarSom("tick");
              }}
              className="border-2 p-3 text-left transition hover:brightness-125"
              style={{ borderColor: o.cor, background: `${o.cor}12` }}
            >
              <p className="font-pixel text-[10px]" style={{ color: o.cor }}>
                {o.rotulo}
              </p>
              <p className="mt-1 text-[11px] italic text-texto">“{o.fala}”</p>
              <p className="mt-1 text-[10px] text-suave">{o.efeito}</p>
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[9px] text-suave/80">Sua resposta vira post no FEED 📱</p>
      </div>
    </div>
  );
}
