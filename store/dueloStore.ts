import { create } from "zustand";
import { poderDeSnapshot, simularDuelo, snapshotDePlayer, type DueloResult, type PlayerSnapshot } from "@/engine/duelo";
import { aplicarSoftReset, deltaRating, temporadaDuelo, tituloTemporada, RATING_BASE } from "@/engine/temporadaDuelo";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { rastrear } from "@/lib/telemetria";
import { useCareer } from "./careerStore";
import { useCerimonias } from "./cerimoniaStore";
import { useProfile } from "./profileStore";

// Modo online — Fase B. Duelo 1v1 assíncrono e determinístico.
// Snapshot de combate por conta em `duel_snapshots`; resultados (fonte da verdade
// do placar) em `duelos`. Sem aposta de CoinPoints ainda (moeda continua intocada).

export interface LadderLinha {
  userId: string;
  nick: string;
  poder: number;
  snapshot: PlayerSnapshot;
}

export interface RankingLinha {
  userId: string;
  nick: string;
  poder: number;
  rating: number; // rating da TEMPORADA (soft reset a cada virada)
}

export interface DueloRegistro {
  id: string;
  desafianteNick: string;
  oponenteNick: string;
  souDesafiante: boolean;
  euGanhei: boolean;
  resultado: DueloResult;
  criadoEm: string;
}

interface DueloStore {
  meuPoder: number;
  meuRating: number;
  temporada: number;
  publicado: boolean;
  ladder: LadderLinha[];
  ranking: RankingLinha[];
  historico: DueloRegistro[];
  carregando: boolean;
  ultimoResultado: DueloResult | null;
  buscando: boolean;

  carregar: () => Promise<void>;
  publicar: () => Promise<void>;
  desafiar: (op: LadderLinha) => Promise<DueloResult | null>;
  buscarPorNick: (nick: string) => Promise<LadderLinha | null>;
  limparResultado: () => void;
  limpar: () => void;
}

function seedAleatoria(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

// Monta meu snapshot atual (carreira ativa + nick do perfil) + meu user_id.
async function montarMeu(): Promise<{ uid: string; nick: string; snapshot: PlayerSnapshot } | null> {
  const player = useCareer.getState().career?.player;
  const nick = useProfile.getState().perfil?.nick;
  if (!player || !nick) return null;
  const sb = getSupabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  return { uid: u.user.id, nick, snapshot: snapshotDePlayer(player, u.user.id) };
}

function reidratarSnapshot(row: { user_id: string; snapshot: unknown }): PlayerSnapshot {
  // garante que a chave do snapshot é o user_id dono da linha (aponta o vencedor certo)
  return { ...(row.snapshot as PlayerSnapshot), chave: row.user_id };
}

export const useDuelo = create<DueloStore>((set, get) => ({
  meuPoder: 0,
  publicado: false,
  meuRating: RATING_BASE,
  temporada: 1,
  ladder: [],
  ranking: [],
  historico: [],
  carregando: true,
  ultimoResultado: null,
  buscando: false,

  carregar: async () => {
    if (!isSupabaseConfigured()) {
      set({ carregando: false });
      return;
    }
    set({ carregando: true });
    try {
      await get().publicar(); // publica/atualiza meu snapshot antes de listar
      const sb = getSupabase();
      const { data: u } = await sb.auth.getUser();
      const uid = u.user?.id ?? "";

      const [snaps, hist] = await Promise.all([
        sb.from("duel_snapshots").select("user_id, nick, poder, rating, snapshot").order("poder", { ascending: false }).limit(50),
        sb
          .from("duelos")
          .select("id, desafiante, oponente, desafiante_nick, oponente_nick, vencedor, resultado, criado_at")
          .or(`desafiante.eq.${uid},oponente.eq.${uid}`)
          .order("criado_at", { ascending: false })
          .limit(20),
      ]);

      const ladder: LadderLinha[] = (snaps.data ?? [])
        .filter((r) => r.user_id !== uid)
        .map((r) => ({ userId: r.user_id, nick: r.nick, poder: r.poder, snapshot: reidratarSnapshot(r) }));

      // ranking da TEMPORADA = rating (soft reset a cada virada de 3 semanas)
      const ranking: RankingLinha[] = (snaps.data ?? [])
        .map((r) => ({ userId: r.user_id, nick: r.nick, poder: r.poder, rating: (r.rating as number) ?? RATING_BASE }))
        .sort((a, b) => b.rating - a.rating);

      const historico: DueloRegistro[] = (hist.data ?? []).map((r) => ({
        id: r.id,
        desafianteNick: r.desafiante_nick,
        oponenteNick: r.oponente_nick,
        souDesafiante: r.desafiante === uid,
        euGanhei: r.vencedor === uid,
        resultado: r.resultado as DueloResult,
        criadoEm: r.criado_at,
      }));

      set({ ladder, ranking, historico, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  publicar: async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const meu = await montarMeu();
      if (!meu) return;
      const poder = poderDeSnapshot(meu.snapshot);
      const sb = getSupabase();

      // rating existente + SOFT RESET lazy/idempotente na virada de temporada
      const tempAtual = temporadaDuelo(Date.now());
      const { data: linha } = await sb
        .from("duel_snapshots")
        .select("rating, temporada_rating")
        .eq("user_id", meu.uid)
        .maybeSingle();
      const ratingAntigo = (linha?.rating as number) ?? RATING_BASE;
      const tempRegistrada = (linha?.temporada_rating as number) ?? tempAtual;
      const reset = aplicarSoftReset(ratingAntigo, tempAtual, tempRegistrada);

      if (reset.resetou) {
        // fim de temporada: título exclusivo por tier final + cerimônia (nunca volta)
        const titulo = tituloTemporada(tempRegistrada, ratingAntigo);
        useCareer.getState().concederTitulo(titulo);
        useCerimonias.getState().emitir({
          tipo: "ACHIEVEMENT_UNLOCKED",
          id: `temporada_duelo_${tempRegistrada}`,
          nome: `Fim da Temporada ${tempRegistrada}!`,
          emoji: "🗓️",
          desc: `${titulo} · rating ajustado pra nova temporada (${ratingAntigo} → ${reset.rating}).`,
        });
      }

      await sb.from("duel_snapshots").upsert({
        user_id: meu.uid,
        nick: meu.nick,
        poder,
        rating: reset.rating,
        temporada_rating: reset.temporada,
        snapshot: meu.snapshot,
        updated_at: new Date().toISOString(),
      });
      set({ meuPoder: poder, meuRating: reset.rating, temporada: tempAtual, publicado: true });
    } catch {
      // rede — tenta na próxima
    }
  },

  desafiar: async (op) => {
    if (!isSupabaseConfigured()) return null;
    try {
      const meu = await montarMeu();
      if (!meu) return null;
      const seed = seedAleatoria();
      const resultado = simularDuelo(meu.snapshot, op.snapshot, seed);
      const sb = getSupabase();
      const venceu = resultado.vencedorChave === meu.uid;
      await sb.from("duelos").insert({
        desafiante: meu.uid,
        oponente: op.userId,
        desafiante_nick: meu.nick,
        oponente_nick: op.nick,
        seed,
        vencedor: resultado.vencedorChave,
        resultado,
        temporada: temporadaDuelo(Date.now()),
      });
      // rating da temporada (elo-lite, auto-reportado como o resto do duelo)
      const meuPoderAtual = get().meuPoder;
      const novoRating = Math.max(0, get().meuRating + deltaRating(venceu, meuPoderAtual, op.poder));
      await sb.from("duel_snapshots").update({ rating: novoRating }).eq("user_id", meu.uid);
      set({ meuRating: novoRating });
      const registro: DueloRegistro = {
        id: `local-${seed}`,
        desafianteNick: meu.nick,
        oponenteNick: op.nick,
        souDesafiante: true,
        euGanhei: resultado.vencedorChave === meu.uid,
        resultado,
        criadoEm: new Date().toISOString(),
      };
      set({ ultimoResultado: resultado, historico: [registro, ...get().historico].slice(0, 20) });
      rastrear("duelo_fim", { venceu: resultado.vencedorChave === meu.uid, poderRival: op.poder });
      void get().carregar(); // atualiza ranking/histórico do servidor em segundo plano
      return resultado;
    } catch {
      return null;
    }
  },

  buscarPorNick: async (nick) => {
    const alvo = nick.trim();
    if (!alvo || !isSupabaseConfigured()) return null;
    set({ buscando: true });
    try {
      const sb = getSupabase();
      const { data: u } = await sb.auth.getUser();
      const { data } = await sb
        .from("duel_snapshots")
        .select("user_id, nick, poder, snapshot")
        .ilike("nick", alvo)
        .limit(1)
        .maybeSingle();
      set({ buscando: false });
      if (!data || data.user_id === u.user?.id) return null;
      return { userId: data.user_id, nick: data.nick, poder: data.poder, snapshot: reidratarSnapshot(data) };
    } catch {
      set({ buscando: false });
      return null;
    }
  },

  limparResultado: () => set({ ultimoResultado: null }),
  limpar: () => set({ ladder: [], ranking: [], historico: [], ultimoResultado: null, meuPoder: 0, publicado: false, carregando: true }),
}));
