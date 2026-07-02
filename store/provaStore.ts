import { create } from "zustand";
import type { EstadoProva, ProvaSemanal } from "@/engine/prova";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { rastrear } from "@/lib/telemetria";
import { useProfile } from "./profileStore";

// 🏁 Prova Semanal — lado servidor: envia score (auto-reportado; `detalhe` rico pra
// revalidação futura por Edge Function) e lê o leaderboard público da semana.

export interface LinhaLeaderboard {
  userId: string;
  nick: string;
  score: number;
}

interface ProvaStore {
  leaderboard: LinhaLeaderboard[];
  minhaPosicao: number | null;
  totalParticipantes: number;
  historico: { semana: number; score: number }[];
  carregando: boolean;
  enviarScore: (prova: ProvaSemanal, estado: EstadoProva, resumo: Record<string, unknown>) => Promise<void>;
  carregar: (semana: number) => Promise<void>;
  limpar: () => void;
}

export const useProva = create<ProvaStore>((set) => ({
  leaderboard: [],
  minhaPosicao: null,
  totalParticipantes: 0,
  historico: [],
  carregando: false,

  // Envia o score final (upsert — 1 linha por semana). Falha silenciosa (retenta ao reabrir).
  enviarScore: async (prova, estado, resumo) => {
    if (!isSupabaseConfigured() || !estado.finalizada || estado.scoreFinal == null) return;
    try {
      const sb = getSupabase();
      const { data: u } = await sb.auth.getUser();
      const nick = useProfile.getState().perfil?.nick;
      if (!u.user || !nick) return;
      await sb.from("prova_semanal_scores").upsert({
        user_id: u.user.id,
        semana: prova.semana,
        nick,
        score: estado.scoreFinal,
        // detalhe rico pra REVALIDAÇÃO futura por Edge Function (seed + resultados + snapshot)
        detalhe: { seed: prova.seed, modificadores: prova.modificadores, resultados: estado.resultados, resumo },
      });
      rastrear("prova_fim", { semana: prova.semana, score: estado.scoreFinal, mods: prova.modificadores });
    } catch {
      // rede — tenta na próxima
    }
  },

  carregar: async (semana) => {
    if (!isSupabaseConfigured()) return;
    set({ carregando: true });
    try {
      const sb = getSupabase();
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id;
      const [top, meus] = await Promise.all([
        sb.from("prova_semanal_scores").select("user_id, nick, score").eq("semana", semana).order("score", { ascending: false }).limit(50),
        uid ? sb.from("prova_semanal_scores").select("semana, score").eq("user_id", uid).order("semana", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
      ]);
      const leaderboard: LinhaLeaderboard[] = (top.data ?? []).map((r) => ({ userId: r.user_id, nick: r.nick, score: r.score }));
      // posição: dentro do top 50 usa o índice; senão conta quantos têm score maior
      let minhaPosicao: number | null = null;
      const meuScore = (meus.data as { semana: number; score: number }[] | null)?.find((m) => m.semana === semana)?.score;
      const idx = uid ? leaderboard.findIndex((l) => l.userId === uid) : -1;
      if (idx >= 0) minhaPosicao = idx + 1;
      else if (uid && meuScore != null) {
        const { count } = await getSupabase()
          .from("prova_semanal_scores")
          .select("user_id", { count: "exact", head: true })
          .eq("semana", semana)
          .gt("score", meuScore);
        minhaPosicao = (count ?? 0) + 1;
      }
      const { count: total } = await sb
        .from("prova_semanal_scores")
        .select("user_id", { count: "exact", head: true })
        .eq("semana", semana);
      set({
        leaderboard,
        minhaPosicao,
        totalParticipantes: total ?? leaderboard.length,
        historico: (meus.data as { semana: number; score: number }[] | null) ?? [],
        carregando: false,
      });
    } catch {
      set({ carregando: false });
    }
  },

  limpar: () => set({ leaderboard: [], minhaPosicao: null, totalParticipantes: 0, historico: [], carregando: false }),
}));

// Fui top 10% na semana dada? (checagem client-side com dados públicos do leaderboard;
// a concessão validada por Edge Function é TODO da rodada de monetização.)
export async function checarTopoSemana(semana: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const sb = getSupabase();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return false;
    const { data: minha } = await sb
      .from("prova_semanal_scores")
      .select("score")
      .eq("semana", semana)
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (!minha) return false;
    const [{ count: acima }, { count: total }] = await Promise.all([
      sb.from("prova_semanal_scores").select("user_id", { count: "exact", head: true }).eq("semana", semana).gt("score", minha.score),
      sb.from("prova_semanal_scores").select("user_id", { count: "exact", head: true }).eq("semana", semana),
    ]);
    if (!total) return false;
    return (acima ?? 0) + 1 <= Math.max(1, Math.ceil(total * 0.1));
  } catch {
    return false;
  }
}
