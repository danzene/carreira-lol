"use client";

import { type FormEvent, useState } from "react";
import { useProfile } from "@/store/profileStore";

// Onboarding: ao logar pela 1ª vez sem perfil, escolhe um nick (cria o profile).
export default function EscolherNick() {
  const criarPerfil = useProfile((s) => s.criarPerfil);
  const [nick, setNick] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const res = await criarPerfil(nick);
    setSalvando(false);
    if (res) setErro(res); // sucesso → o AuthGate troca pra dentro do jogo
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-8 px-5 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="font-pixel text-[10px] tracking-[0.3em] text-ciano">SUA CONTA</span>
        <h1
          className="font-pixel text-2xl leading-[1.6] text-rosa"
          style={{ textShadow: "3px 3px 0 #0b0617, 6px 6px 0 rgba(25,230,224,0.35)" }}
        >
          ESCOLHA SEU NICK
        </h1>
        <p className="text-[11px] text-suave">É o nome que os outros jogadores vão ver no modo online.</p>
      </div>

      <form onSubmit={enviar} className="flex w-full flex-col gap-3 border-2 border-borda bg-painel p-5">
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={16}
          placeholder="Ex.: Faker"
          className="border-2 border-borda bg-fundo/40 px-3 py-2 text-texto placeholder:text-suave focus:border-rosa focus:outline-none"
        />
        {erro && <p className="text-[11px] text-rosa">{erro}</p>}
        <button
          type="submit"
          disabled={salvando}
          className="border-2 border-ciano bg-ciano/10 py-2.5 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "CONFIRMAR"}
        </button>
      </form>
    </main>
  );
}
