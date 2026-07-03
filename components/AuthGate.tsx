"use client";

import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/store/authStore";
import { useProfile } from "@/store/profileStore";
import { useInventory } from "@/store/inventoryStore";
import { usePasse } from "@/store/passeStore";
import { useLiveOps } from "@/store/liveopsStore";
import EscolherNick from "./EscolherNick";
import TelaLogin from "./TelaLogin";
import TelaBanido from "./TelaBanido";
import MensagemDoDia from "./MensagemDoDia";

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
  const carregarInv = useInventory((s) => s.carregar);
  const limparInv = useInventory((s) => s.limpar);
  const carregarPasse = usePasse((s) => s.carregar);
  const limparPasse = usePasse((s) => s.limpar);
  const carregarLiveOps = useLiveOps((s) => s.carregar);

  useEffect(() => {
    init();
  }, [init]);

  // Live-ops (feature flags + mensagem do dia) é público — carrega já no boot.
  useEffect(() => {
    void carregarLiveOps();
  }, [carregarLiveOps]);

  useEffect(() => {
    if (user) {
      carregarPerfil();
      carregarInv(); // inventário + passe em segundo plano (não bloqueiam a entrada)
      carregarPasse();
    } else {
      limparPerfil();
      limparInv();
      limparPasse();
    }
  }, [user, carregarPerfil, limparPerfil, carregarInv, limparInv, carregarPasse, limparPasse]);

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
  if (perfil?.banned_at) return <TelaBanido />;
  if (!perfil) return <EscolherNick />;
  return (
    <>
      <MensagemDoDia />
      {children}
    </>
  );
}
