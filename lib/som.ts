// 🔊 SoundManager fino sobre Web Audio API — sons chiptune SINTETIZADOS (square/triangle,
// envelopes curtos), zero assets externos. Volume/mute persistidos por dispositivo
// (localStorage — é config de apresentação, não entra no save do jogo).

export type SomId =
  | "tier1"
  | "tier2"
  | "tier3"
  | "tier4"
  | "tier5"
  | "promocao"
  | "rebaixamento"
  | "levelup"
  | "missao"
  | "conquista"
  | "unlock"
  | "moeda"
  | "tick";

interface ConfigSom {
  volume: number; // 0..1
  mute: boolean;
}

const CHAVE_LS = "carreira-som";
const PADRAO: ConfigSom = { volume: 0.5, mute: false };

let ctx: AudioContext | null = null;
let config: ConfigSom | null = null;

function lerConfig(): ConfigSom {
  if (config) return config;
  if (typeof window === "undefined") return PADRAO;
  try {
    const raw = window.localStorage.getItem(CHAVE_LS);
    config = raw ? { ...PADRAO, ...(JSON.parse(raw) as Partial<ConfigSom>) } : { ...PADRAO };
  } catch {
    config = { ...PADRAO };
  }
  return config;
}

function salvarConfig(c: ConfigSom): void {
  config = c;
  try {
    window.localStorage.setItem(CHAVE_LS, JSON.stringify(c));
  } catch {
    // sem storage — segue só em memória
  }
}

export function somMutado(): boolean {
  return lerConfig().mute;
}
export function volumeSom(): number {
  return lerConfig().volume;
}
export function alternarMute(): boolean {
  const c = lerConfig();
  salvarConfig({ ...c, mute: !c.mute });
  return !c.mute;
}
export function definirVolumeSom(v: number): void {
  salvarConfig({ ...lerConfig(), volume: Math.min(1, Math.max(0, v)) });
}

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume(); // browsers exigem gesto do usuário
  return ctx;
}

// Uma nota: oscilador + envelope curto (ataque 10ms, decay exponencial).
function nota(ac: AudioContext, freq: number, inicio: number, dur: number, tipo: OscillatorType, vol: number): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = tipo;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + inicio;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// N = nota { f: freq, t: início relativo (s), d: duração (s), o?: oscilador, v?: volume relativo }
interface N {
  f: number;
  t: number;
  d: number;
  o?: OscillatorType;
  v?: number;
}

// Partituras chiptune — melodias curtas por evento. Frequências em Hz (escala pentatônica
// pra tudo soar bem junto). Tiers altos = arpejos ascendentes maiores.
const PARTITURAS: Record<SomId, N[]> = {
  tick: [{ f: 880, t: 0, d: 0.06, o: "square", v: 0.25 }],
  moeda: [
    { f: 988, t: 0, d: 0.07, o: "square", v: 0.5 },
    { f: 1319, t: 0.07, d: 0.18, o: "square", v: 0.5 },
  ],
  missao: [
    { f: 659, t: 0, d: 0.09, o: "square", v: 0.5 },
    { f: 880, t: 0.09, d: 0.2, o: "square", v: 0.5 },
  ],
  tier1: [{ f: 523, t: 0, d: 0.12, o: "triangle", v: 0.6 }],
  tier2: [
    { f: 523, t: 0, d: 0.08, o: "square", v: 0.45 },
    { f: 659, t: 0.08, d: 0.16, o: "square", v: 0.45 },
  ],
  tier3: [
    { f: 523, t: 0, d: 0.08, o: "square", v: 0.45 },
    { f: 659, t: 0.08, d: 0.08, o: "square", v: 0.45 },
    { f: 784, t: 0.16, d: 0.22, o: "square", v: 0.5 },
  ],
  tier4: [
    { f: 523, t: 0, d: 0.08, o: "square", v: 0.5 },
    { f: 659, t: 0.08, d: 0.08, o: "square", v: 0.5 },
    { f: 784, t: 0.16, d: 0.08, o: "square", v: 0.5 },
    { f: 1047, t: 0.24, d: 0.3, o: "square", v: 0.55 },
    { f: 1568, t: 0.24, d: 0.3, o: "triangle", v: 0.3 },
  ],
  tier5: [
    { f: 523, t: 0, d: 0.07, o: "square", v: 0.5 },
    { f: 659, t: 0.07, d: 0.07, o: "square", v: 0.5 },
    { f: 784, t: 0.14, d: 0.07, o: "square", v: 0.5 },
    { f: 1047, t: 0.21, d: 0.07, o: "square", v: 0.55 },
    { f: 1319, t: 0.28, d: 0.1, o: "square", v: 0.55 },
    { f: 1568, t: 0.38, d: 0.45, o: "square", v: 0.6 },
    { f: 2093, t: 0.38, d: 0.45, o: "triangle", v: 0.35 },
    { f: 3136, t: 0.5, d: 0.3, o: "triangle", v: 0.2 }, // sparkle
  ],
  promocao: [
    { f: 392, t: 0, d: 0.1, o: "square", v: 0.5 },
    { f: 523, t: 0.1, d: 0.1, o: "square", v: 0.5 },
    { f: 659, t: 0.2, d: 0.1, o: "square", v: 0.5 },
    { f: 784, t: 0.3, d: 0.35, o: "square", v: 0.55 },
    { f: 1047, t: 0.42, d: 0.4, o: "square", v: 0.55 },
    { f: 1568, t: 0.42, d: 0.4, o: "triangle", v: 0.3 },
  ],
  rebaixamento: [
    { f: 392, t: 0, d: 0.12, o: "triangle", v: 0.45 },
    { f: 330, t: 0.12, d: 0.25, o: "triangle", v: 0.4 },
  ],
  levelup: [
    { f: 659, t: 0, d: 0.08, o: "square", v: 0.5 },
    { f: 784, t: 0.08, d: 0.08, o: "square", v: 0.5 },
    { f: 1047, t: 0.16, d: 0.28, o: "square", v: 0.55 },
  ],
  conquista: [
    { f: 784, t: 0, d: 0.09, o: "square", v: 0.5 },
    { f: 988, t: 0.09, d: 0.09, o: "square", v: 0.5 },
    { f: 1175, t: 0.18, d: 0.09, o: "square", v: 0.5 },
    { f: 1568, t: 0.27, d: 0.32, o: "square", v: 0.55 },
  ],
  unlock: [
    { f: 440, t: 0, d: 0.1, o: "square", v: 0.5 },
    { f: 554, t: 0.1, d: 0.1, o: "square", v: 0.5 },
    { f: 659, t: 0.2, d: 0.1, o: "square", v: 0.5 },
    { f: 880, t: 0.3, d: 0.35, o: "square", v: 0.55 },
  ],
};

// Toca um som (não-op no servidor, mutado ou sem Web Audio).
export function tocarSom(id: SomId): void {
  const c = lerConfig();
  if (c.mute || c.volume <= 0) return;
  const ac = contexto();
  if (!ac) return;
  for (const n of PARTITURAS[id]) nota(ac, n.f, n.t, n.d, n.o ?? "square", (n.v ?? 0.5) * c.volume);
}

// Som do tier de raridade (1..5).
export function tocarSomTier(tier: 1 | 2 | 3 | 4 | 5): void {
  tocarSom(`tier${tier}` as SomId);
}
