"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NACIONALIDADES, ROTAS } from "@/data/config";
import {
  atributosIniciais,
  criarPlayer,
  pontosRestantes,
  validarCriacao,
  type CriarPlayerInput,
} from "@/engine/player";
import type { Attributes, Role } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import EditorAtributos from "./EditorAtributos";
import SeletorCampeoes from "./SeletorCampeoes";

const PASSOS = ["Identidade", "Atributos", "Campeões"] as const;

export default function CriacaoWizard() {
  const router = useRouter();
  const iniciarCarreira = useCareer((s) => s.iniciarCarreira);

  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState("");
  const [nacionalidade, setNacionalidade] = useState(NACIONALIDADES[0].nome);
  const [rota, setRota] = useState<Role>("MID");
  const [atributos, setAtributos] = useState<Attributes>(atributosIniciais());
  const [campeoes, setCampeoes] = useState<string[]>([]);

  const input: CriarPlayerInput = { nome, nacionalidade, rota, atributos, campeoes };
  const erros = validarCriacao(input);

  const podeAvancar = passo === 0 ? nome.trim().length > 0 : pontosRestantes(atributos) === 0;

  function finalizar() {
    if (erros.length > 0) return;
    iniciarCarreira(criarPlayer(input));
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-zinc-100">Criar carreira</h1>
        <div className="flex gap-2">
          {PASSOS.map((p, i) => (
            <div key={p} className="flex flex-1 flex-col gap-1">
              <div className={`h-1 rounded-full ${i <= passo ? "bg-destaque" : "bg-borda"}`} />
              <span className={`text-[11px] ${i === passo ? "text-zinc-200" : "text-zinc-600"}`}>
                {i + 1}. {p}
              </span>
            </div>
          ))}
        </div>
      </header>

      {passo === 0 && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-zinc-400">Nome do jogador</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={16}
              placeholder="Ex.: Faker"
              className="rounded-lg border border-borda bg-painel px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-destaque focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-zinc-400">Nacionalidade</span>
            <select
              value={nacionalidade}
              onChange={(e) => setNacionalidade(e.target.value)}
              className="rounded-lg border border-borda bg-painel px-3 py-2 text-zinc-100 focus:border-destaque focus:outline-none"
            >
              {NACIONALIDADES.map((n) => (
                <option key={n.nome} value={n.nome}>
                  {n.bandeira} {n.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-zinc-400">Rota</span>
            <div className="grid grid-cols-5 gap-2">
              {ROTAS.map((r) => (
                <button
                  key={r.chave}
                  type="button"
                  onClick={() => setRota(r.chave)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                    rota === r.chave
                      ? "border-destaque bg-destaque/15 text-zinc-100"
                      : "border-borda text-zinc-500 hover:text-zinc-300"
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
      {passo === 2 && <SeletorCampeoes selecionados={campeoes} onChange={setCampeoes} />}

      <footer className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => (passo === 0 ? router.push("/") : setPasso(passo - 1))}
          className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          {passo === 0 ? "Cancelar" : "Voltar"}
        </button>

        {passo < PASSOS.length - 1 ? (
          <button
            type="button"
            onClick={() => setPasso(passo + 1)}
            disabled={!podeAvancar}
            className="rounded-lg bg-destaque px-6 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
          >
            Próximo
          </button>
        ) : (
          <button
            type="button"
            onClick={finalizar}
            disabled={erros.length > 0}
            className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
          >
            Criar carreira
          </button>
        )}
      </footer>

      {passo === PASSOS.length - 1 && erros.length > 0 && (
        <ul className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          {erros.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
