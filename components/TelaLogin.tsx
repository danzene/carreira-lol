"use client";

import { type FormEvent, useState } from "react";
import { useAuth } from "@/store/authStore";

export default function TelaLogin() {
  const entrar = useAuth((s) => s.entrar);
  const cadastrar = useAuth((s) => s.cadastrar);
  const entrarComGoogle = useAuth((s) => s.entrarComGoogle);

  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [google, setGoogle] = useState(false);

  async function comGoogle() {
    setErro(null);
    setInfo(null);
    setGoogle(true);
    const res = await entrarComGoogle();
    if (res) {
      setErro(res);
      setGoogle(false);
    }
    // sucesso → o navegador redireciona pro Google; não precisa resetar.
  }

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

        <div className="my-1 flex items-center gap-3 text-[11px] text-zinc-600">
          <span className="h-px flex-1 bg-borda" />
          ou
          <span className="h-px flex-1 bg-borda" />
        </div>

        <button
          type="button"
          onClick={comGoogle}
          disabled={google || carregando}
          className="flex items-center justify-center gap-2 rounded-xl border border-borda bg-white px-6 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001 6.19 5.238 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
          {google ? "Conectando…" : "Entrar com Google"}
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
