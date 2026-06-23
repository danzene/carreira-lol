"use client";

import { type FormEvent, useState } from "react";
import { useAuth } from "@/store/authStore";

export default function TelaLogin() {
  const entrar = useAuth((s) => s.entrar);
  const cadastrar = useAuth((s) => s.cadastrar);

  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setCarregando(true);
    const res = modo === "entrar" ? await entrar(email, senha) : await cadastrar(email, senha);
    setCarregando(false);

    if (res === null) return; // sucesso → o AuthGate troca pra dentro do jogo
    if (res === "CONFIRME_EMAIL") {
      setInfo("Conta criada! Confirme pelo link no seu email e depois faça login.");
      setModo("entrar");
      return;
    }
    setErro(res);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-destaque/20 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-destaque2">Modo Carreira · Esports</span>
        <h1 className="bg-gradient-to-r from-destaque via-fuchsia-400 to-destaque2 bg-clip-text text-5xl font-black tracking-tight text-transparent">
          Carreira LoL
        </h1>
      </div>

      <form onSubmit={enviar} className="relative flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-borda bg-painel p-6">
        <h2 className="text-lg font-bold text-zinc-100">{modo === "entrar" ? "Entrar" : "Criar conta"}</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-zinc-400">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-borda bg-fundo/40 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-destaque focus:outline-none"
            placeholder="voce@email.com"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-zinc-400">Senha</span>
          <input
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="rounded-lg border border-borda bg-fundo/40 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-destaque focus:outline-none"
            placeholder="mínimo 6 caracteres"
          />
        </label>

        {erro && <p className="text-sm text-red-400">{erro}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="mt-1 rounded-xl bg-destaque px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50"
        >
          {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>

        <button
          type="button"
          onClick={() => {
            setModo((m) => (m === "entrar" ? "cadastrar" : "entrar"));
            setErro(null);
            setInfo(null);
          }}
          className="text-center text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          {modo === "entrar" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </form>
    </main>
  );
}
