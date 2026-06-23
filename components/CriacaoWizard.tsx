"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NACIONALIDADES, ROTAS } from "@/data/config";
import {
  atributosIniciais,
  criarPlayer,
  pontosRestantes,
  validarCriacao,
  type FormularioCriacao,
} from "@/engine/player";
import type { Attributes, Role, TraitId } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import EditorAtributos from "./EditorAtributos";
import SeletorCampeoes from "./SeletorCampeoes";
import SeletorTraco from "./SeletorTraco";

const PASSOS = ["Identidade", "Atributos", "Traço", "Campeões"] as const;

export default function CriacaoWizard() {
  const router = useRouter();
  const iniciarCarreira = useCareer((s) => s.iniciarCarreira);

  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState("");
  const [nacionalidade, setNacionalidade] = useState(NACIONALIDADES[0].nome);
  const [rota, setRota] = useState<Role>("MID");
  const [atributos, setAtributos] = useState<Attributes>(atributosIniciais());
  const [traco, setTraco] = useState<TraitId | null>(null);
  const [campeoes, setCampeoes] = useState<string[]>([]);

  const form: FormularioCriacao = { nome, atributos, traco, campeoes };
  const erros = validarCriacao(form);

  const podeAvancar =
    passo === 0
      ? nome.trim().length > 0
      : passo === 1
        ? pontosRestantes(atributos) === 0
        : passo === 2
          ? traco !== null
          : true;

  function finalizar() {
    if (erros.length > 0 || !traco) return;
    iniciarCarreira(criarPlayer({ nome, nacionalidade, rota, atributos, traco, campeoes }));
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-pixel text-sm text-ciano">CRIAR CARREIRA</h1>
        <div className="flex gap-2">
          {PASSOS.map((p, i) => (
            <div key={p} className="flex flex-1 flex-col gap-1">
              <div className={`h-1.5 ${i <= passo ? "bg-rosa" : "bg-borda"}`} />
              <span className={`text-[10px] ${i === passo ? "text-texto" : "text-suave"}`}>
                {i + 1}. {p}
              </span>
            </div>
          ))}
        </div>
      </header>

      {passo === 0 && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Nome do jogador</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={16}
              placeholder="Ex.: Faker"
              className="border-2 border-borda bg-painel px-3 py-2 text-texto placeholder:text-suave focus:border-rosa focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Nacionalidade</span>
            <select
              value={nacionalidade}
              onChange={(e) => setNacionalidade(e.target.value)}
              className="border-2 border-borda bg-painel px-3 py-2 text-texto focus:border-rosa focus:outline-none"
            >
              {NACIONALIDADES.map((n) => (
                <option key={n.nome} value={n.nome}>
                  {n.bandeira} {n.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Rota</span>
            <div className="grid grid-cols-5 gap-2">
              {ROTAS.map((r) => (
                <button
                  key={r.chave}
                  type="button"
                  onClick={() => setRota(r.chave)}
                  className={`flex flex-col items-center gap-1 border-2 p-2 transition ${
                    rota === r.chave ? "border-rosa bg-rosa/10 text-texto" : "border-borda text-suave hover:border-suave"
                  }`}
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="text-[10px]">{r.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {passo === 1 && <EditorAtributos atributos={atributos} onChange={setAtributos} />}
      {passo === 2 && <SeletorTraco selecionado={traco} onChange={setTraco} />}
      {passo === 3 && <SeletorCampeoes selecionados={campeoes} onChange={setCampeoes} />}

      <footer className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => (passo === 0 ? router.push("/") : setPasso(passo - 1))}
          className="px-4 py-2 text-sm text-suave transition hover:text-texto"
        >
          {passo === 0 ? "Cancelar" : "Voltar"}
        </button>

        {passo < PASSOS.length - 1 ? (
          <button
            type="button"
            onClick={() => setPasso(passo + 1)}
            disabled={!podeAvancar}
            className="border-2 border-rosa bg-rosa/10 px-6 py-2 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo disabled:opacity-40"
          >
            PRÓXIMO
          </button>
        ) : (
          <button
            type="button"
            onClick={finalizar}
            disabled={erros.length > 0}
            className="border-2 border-ciano bg-ciano/10 px-6 py-2 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo disabled:opacity-40"
          >
            CRIAR
          </button>
        )}
      </footer>

      {passo === PASSOS.length - 1 && erros.length > 0 && (
        <ul className="border-2 border-rosa/40 bg-rosa/5 p-3 text-xs text-rosa">
          {erros.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
