import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

// 📊 Telemetria mínima: fila em memória + flush em lote (20 eventos / 30s /
// visibilitychange). FIRE-AND-FORGET com falha SILENCIOSA — telemetria NUNCA quebra
// nem atrasa o jogo. Offline: guarda pouco (cap) e descarta o excedente.

interface EventoTele {
  evento: string;
  props: Record<string, unknown>;
  client_ts: string;
}

const MAX_FILA = 200; // nunca cresce infinito
const LOTE = 20;

let fila: EventoTele[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let enviando = false;
let sessaoRegistrada = false;

function iniciarLoop(): void {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => void flush(), 30_000);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // marca fim de sessão best-effort (melhora a precisão da duração de sessão no admin)
      if (sessaoRegistrada) fila.push({ evento: "sessao_fim", props: {}, client_ts: new Date().toISOString() });
      void flush();
    }
  });
}

async function flush(): Promise<void> {
  if (enviando || fila.length === 0) return;
  enviando = true;
  const lote = fila.splice(0, fila.length);
  try {
    if (!isSupabaseConfigured()) return; // descarta
    const sb = getSupabase();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return; // sem sessão: descarta
    const uid = u.user.id;
    await sb
      .from("telemetria_eventos")
      .insert(lote.map((e) => ({ user_id: uid, evento: e.evento, props: e.props, client_ts: e.client_ts })));
  } catch {
    // falha de rede: preserva só um pedaço pequeno pra próxima tentativa
    fila = [...lote.slice(-40), ...fila].slice(-MAX_FILA);
  } finally {
    enviando = false;
  }
}

// Registra um evento (não-op no servidor; nunca lança).
export function rastrear(evento: string, props: Record<string, unknown> = {}): void {
  try {
    if (typeof window === "undefined") return;
    fila.push({ evento, props, client_ts: new Date().toISOString() });
    if (fila.length > MAX_FILA) fila = fila.slice(-MAX_FILA);
    iniciarLoop();
    if (fila.length >= LOTE) void flush();
  } catch {
    // telemetria nunca quebra o jogo
  }
}

// `sessao_inicio` só 1x por carregamento da página.
export function rastrearSessao(props: Record<string, unknown>): void {
  if (sessaoRegistrada) return;
  sessaoRegistrada = true;
  rastrear("sessao_inicio", props);
}

// `tela_visitada` com throttle (mesma rota no máx. 1x/30s).
const ultimaTela = new Map<string, number>();
export function rastrearTela(rota: string): void {
  try {
    const agora = Date.now();
    if ((ultimaTela.get(rota) ?? 0) > agora - 30_000) return;
    ultimaTela.set(rota, agora);
    rastrear("tela_visitada", { rota });
  } catch {
    // silêncio
  }
}
