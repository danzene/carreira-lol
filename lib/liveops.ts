// 🎛️ Live-Ops (lado do jogo) — lê app_config (chaves públicas) e decide feature
// flags + mensagem do dia. REGRA FAIL-OPEN: na dúvida (config ausente, ilegível ou
// chave faltando) a feature fica LIGADA. Desligar exige um `false` explícito no banco.
// Assim uma falha de rede/leitura nunca tira o jogo do ar.

export type FlagChave = "duelo_online" | "prova_semanal" | "gacha" | "compartilhamento";

export interface MensagemDoDia {
  ativo?: boolean;
  titulo?: string;
  texto?: string;
  tipo?: "info" | "aviso";
}

export interface LiveConfig {
  feature_flags?: Partial<Record<FlagChave, boolean>>;
  mensagem_do_dia?: MensagemDoDia | null;
}

// Fail-open: só desliga quando o valor é EXPLICITAMENTE false.
export function featureLigada(cfg: LiveConfig | null, chave: FlagChave): boolean {
  return cfg?.feature_flags?.[chave] !== false;
}

// Banner só aparece quando ativo === true e há texto.
export function bannerDoDia(cfg: LiveConfig | null): { titulo: string; texto: string; tipo: "info" | "aviso" } | null {
  const m = cfg?.mensagem_do_dia;
  if (!m || m.ativo !== true) return null;
  const texto = (m.texto ?? "").trim();
  if (!texto) return null;
  return { titulo: (m.titulo ?? "").trim(), texto, tipo: m.tipo === "aviso" ? "aviso" : "info" };
}

// Assinatura estável pra saber se o jogador já dispensou ESTA mensagem HOJE.
export function assinaturaBanner(b: { titulo: string; texto: string } | null, hojeISO: string): string {
  if (!b) return "";
  return `${hojeISO}|${b.titulo}|${b.texto}`;
}
