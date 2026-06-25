"use client";

import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/store/authStore";
import { useProfile } from "@/store/profileStore";
import EscolherNick from "./EscolherNick";
import TelaLogin from "./TelaLogin";

function Centro({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-zinc-500">{children}</main>;
}

// Exige login pra acessar o jogo, e perfil (nick) pra entrar no jogo.
export default function AuthGate({ children }: { children: ReactNode }) {
  const carregando = useAuth((s) => s.carregando);
  const configurado = useAuth((s) => s.configurado);
  const user = useAuth((s) => s.user);
  const init = useAuth((s) => s.init);

  const perfil = useProfile((s) => s.perfil);
  const carregandoPerfil = useProfile((s) => s.carregando);
  const carregarPerfil = useProfile((s) => s.carregar);
  const limparPerfil = useProfile((s) => s.limpar);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (user) carregarPerfil();
    else limparPerfil();
  }, [user, carregarPerfil, limparPerfil]);

  if (carregando) return <Centro>Carregando…</Centro>;
  if (!configurado) {
    return (
      <Centro>
        Supabase não configurado. Defina <code className="mx-1 text-zinc-300">NEXT_PUBLIC_SUPABASE_URL</code> e
        <code className="mx-1 text-zinc-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (local e no Vercel).
      </Centro>
    );
  }
  if (!user) return <TelaLogin />;
  if (carregandoPerfil) return <Centro>Carregando…</Centro>;
  if (!perfil) return <EscolherNick />;
  return <>{children}</>;
}
