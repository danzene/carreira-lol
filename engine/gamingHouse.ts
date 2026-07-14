// 🏠 Gaming House (PURO) — sessões de treino parametrizadas, fadiga/burnout, Foco da
// Semana, rendimentos decrescentes e o decay com PISOS DE CONSOLIDAÇÃO.
//
// Lições do Punch Club aplicadas (missão da rodada):
// - TRADE-OFF fica: intensidade (custo×ganho×fadiga×moral), moral multiplicando,
//   especialização por escolha (Foco), variedade por rendimentos decrescentes.
// - ROUBO sai: o decay é suave e NUNCA cruza um marco consolidado (20/40/60/80) —
//   o jogador jamais "volta à estaca zero". Burnout é temporário, visível e não
//   toca atributos.
//
// Nada aqui lê relógio: `agora` entra por parâmetro (a borda passa Date.now()).

import {
  CASA,
  ESTACOES,
  TIPOS_STREAM,
  VARIANTES_MENTAL,
  type EstacaoId,
  type Intensidade,
  type TipoStream,
  type VarianteMental,
} from "@/data/gamingHouse";
import type { Attributes, AtributoKey, CareerState, Classe } from "./types";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
const round2 = (v: number): number => Math.round(v * 100) / 100;

// ---- Estado persistido no save ----
export interface EstadoCasa {
  fadiga: number; // 0-100
  burnoutAte: number | null; // timestamp ms do fim do burnout (transparente na UI)
  foco: AtributoKey[]; // 0-2 atributos do Foco da Semana
  focoSemana: number; // chave temporada*1000+semana em que o foco foi declarado
  sessoesSemana: Partial<Record<EstacaoId, number>>; // por estação (rendimentos decrescentes)
  ganhosSemana: Partial<Attributes>; // XP ganho por atributo na semana (recap/foco honrado)
  intensasSemana: number; // sessões intensas na semana (feed)
  consolidado: Partial<Attributes>; // PISOS: maior marco já cruzado por atributo
  analise: { timeId: string } | null; // adversário estudado (consumível, 1 partida)
  sessoesTotal: number; // recorde de carreira (hall)
  semanasFocoHonrado: number; // streak de semanas honrando o foco (hall)
}

export function casaInicial(): EstadoCasa {
  return {
    fadiga: 0,
    burnoutAte: null,
    foco: [],
    focoSemana: 0,
    sessoesSemana: {},
    ganhosSemana: {},
    intensasSemana: 0,
    consolidado: {},
    analise: null,
    sessoesTotal: 0,
    semanasFocoHonrado: 0,
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Migração de save (normalizarCareer chama): defaults seguros, nada crasha.
export function normalizarCasa(bruto: unknown): EstadoCasa {
  const base = casaInicial();
  if (!bruto || typeof bruto !== "object") return base;
  const c = bruto as Partial<EstadoCasa>;
  const attrsParciais = (x: unknown): Partial<Attributes> => {
    if (!x || typeof x !== "object") return {};
    const out: Partial<Attributes> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      const n = num(v);
      if (n > 0) out[k as AtributoKey] = n;
    }
    return out;
  };
  return {
    fadiga: clamp(num(c.fadiga), 0, CASA.fadigaMax),
    burnoutAte: typeof c.burnoutAte === "number" && c.burnoutAte > 0 ? c.burnoutAte : null,
    foco: Array.isArray(c.foco) ? (c.foco.filter((f): f is AtributoKey => typeof f === "string").slice(0, CASA.focoMax)) : [],
    focoSemana: Math.max(0, Math.floor(num(c.focoSemana))),
    sessoesSemana: (c.sessoesSemana && typeof c.sessoesSemana === "object" ? c.sessoesSemana : {}) as EstadoCasa["sessoesSemana"],
    ganhosSemana: attrsParciais(c.ganhosSemana),
    intensasSemana: Math.max(0, Math.floor(num(c.intensasSemana))),
    consolidado: attrsParciais(c.consolidado),
    analise: c.analise && typeof c.analise === "object" && typeof (c.analise as { timeId?: unknown }).timeId === "string" ? { timeId: (c.analise as { timeId: string }).timeId } : null,
    sessoesTotal: Math.max(0, Math.floor(num(c.sessoesTotal))),
    semanasFocoHonrado: Math.max(0, Math.floor(num(c.semanasFocoHonrado))),
  };
}

export function casaDe(career: CareerState): EstadoCasa {
  return career.casa ?? casaInicial();
}

// ---- 🧗 Decay com pisos de consolidação (Regra 2 — o coração anti-roubo) ----

// Consolida marcos cruzados pelo VALOR ATUAL (qualquer fonte de XP conta: sessão,
// partida, coach, bootcamp) — chamado antes de todo decay.
export function consolidar(attrs: Attributes, consolidado: Partial<Attributes>): Partial<Attributes> {
  const novo: Partial<Attributes> = { ...consolidado };
  (Object.keys(attrs) as AtributoKey[]).forEach((k) => {
    let piso = novo[k] ?? 0;
    for (const m of CASA.marcos) if (attrs[k] >= m && m > piso) piso = m;
    if (piso > 0) novo[k] = piso;
  });
  return novo;
}

// Decai `total` de cada atributo, mas NUNCA abaixo do piso consolidado.
export function decairComPisos(attrs: Attributes, consolidado: Partial<Attributes>, total: number): Attributes {
  if (total <= 0) return attrs;
  const novo: Attributes = { ...attrs };
  (Object.keys(novo) as AtributoKey[]).forEach((k) => {
    const piso = consolidado[k] ?? 0;
    novo[k] = clamp(round2(novo[k] - total), piso, 100);
  });
  return novo;
}

// ---- 🎚️ Multiplicadores (transparentes: a UI mostra ANTES de confirmar) ----

export function emBurnout(casa: EstadoCasa, agora: number): boolean {
  return casa.burnoutAte !== null && agora < casa.burnoutAte;
}

export function multMoral(moral: number): number {
  if (moral >= CASA.moralAltaMin) return CASA.moralAltaMult;
  if (moral < CASA.moralBaixaMax) return CASA.moralBaixaMult;
  return 1;
}

// Bônus de foco se a sessão treina PELO MENOS um atributo do Foco da Semana.
export function multFoco(casa: EstadoCasa, ganhos: Partial<Attributes>): number {
  if (casa.foco.length === 0) return 1;
  const treinaFoco = casa.foco.some((f) => (ganhos[f] ?? 0) > 0);
  return treinaFoco ? 1 + CASA.focoBonus : 1;
}

// Rendimento decrescente da n-ésima sessão da semana na estação (1ª = cheia).
export function multDecrescente(casa: EstadoCasa, estacao: EstacaoId, comCoach: boolean): number {
  const n = casa.sessoesSemana[estacao] ?? 0;
  const passo = comCoach ? CASA.decrescentePassoComCoach : CASA.decrescentePasso;
  return Math.max(CASA.decrescentePiso, 1 - passo * n);
}

export interface MultiplicadoresSessao {
  moral: number;
  foco: number;
  decrescente: number;
  burnout: number;
  total: number;
}

// Tudo que a UI precisa mostrar no painel da estação antes do confirmar.
export function multiplicadoresSessao(career: CareerState, estacao: EstacaoId, agora: number): MultiplicadoresSessao {
  const casa = casaDe(career);
  const def = ESTACOES[estacao];
  const moral = multMoral(career.player.moral);
  const foco = multFoco(casa, def.ganhos);
  const decrescente = multDecrescente(casa, estacao, career.coachAtivo ?? false);
  const burnout = emBurnout(casa, agora) ? CASA.burnoutMult : 1;
  return { moral, foco, decrescente, burnout, total: moral * foco * decrescente * burnout };
}

// ---- 🏋️ A sessão (o coração) ----

export interface ParamsSessao {
  estacao: EstacaoId;
  intensidade: Intensidade;
  championId?: string; // CHAMPION_PRACTICE: campeão da pool a praticar
  variante?: VarianteMental; // ACADEMIA_SONO_TERAPIA
  tipoStream?: TipoStream; // SALA_DE_STREAM: o trade-off é o TIPO (não a intensidade)
  timeIdAlvo?: string; // ANALISE_ADVERSARIO: o PRÓXIMO adversário oficial (borda resolve)
  agora: number; // Date.now() da borda (burnout é por tempo real)
}

export interface ResultadoSessao {
  career: CareerState;
  ganhos: Partial<Attributes>;
  maestria?: { championId: string; ganho: number };
  dinheiro: number;
  reputacao: number;
  moralDelta: number;
  fadigaDelta: number;
  entrouBurnout: boolean;
  mult: MultiplicadoresSessao;
}

// Executa uma sessão. null = energia insuficiente ou parâmetros inválidos.
// A energia usada é a MESMA do sistema atual (Regra 1 — nunca uma segunda stamina).
export function executarSessao(career: CareerState, p: ParamsSessao): ResultadoSessao | null {
  const def = ESTACOES[p.estacao];
  if (!def) return null;
  const casa = casaDe(career);
  const int = CASA.intensidades[p.intensidade] ?? CASA.intensidades.normal;

  // variantes de bem-estar têm custo/efeito próprios (recuperação não escala intensidade)
  const variante = p.estacao === "ACADEMIA_SONO_TERAPIA" ? VARIANTES_MENTAL[p.variante ?? "academia"] : null;
  const recuperacao = variante !== null && variante.mental === 0; // sono/terapia

  // stream: a decisão é o TIPO ($ × moral × fadiga × reputação); co-stream tem gate de rep
  const stream = p.estacao === "SALA_DE_STREAM" ? TIPOS_STREAM[p.tipoStream ?? "ranqueada"] : null;
  if (stream && career.player.reputacao < stream.repMin) return null;

  const custo = variante ? variante.custo : stream ? stream.custo : Math.round(def.custoBase * int.custo);
  if (career.player.energia < custo) return null;
  if (p.estacao === "CHAMPION_PRACTICE" && !career.player.pool.some((c) => c.championId === p.championId)) return null;
  if (p.estacao === "ANALISE_ADVERSARIO" && !p.timeIdAlvo) return null;

  const mult = multiplicadoresSessao(career, p.estacao, p.agora);
  const fator = (recuperacao ? 1 : int.ganho) * mult.total;

  // ganhos de atributo (XP real — a progressão legítima do jogo)
  const ganhos: Partial<Attributes> = {};
  const baseGanhos = variante ? ({ mental: variante.mental } as Partial<Attributes>) : def.ganhos;
  let atributos = career.player.atributos;
  for (const [k, v] of Object.entries(baseGanhos) as [AtributoKey, number][]) {
    if (v <= 0) continue;
    const g = round2(v * fator);
    if (g <= 0) continue;
    ganhos[k] = g;
    atributos = { ...atributos, [k]: clamp(round2(atributos[k] + g), 0, 100) };
  }

  // maestria (CHAMPION_PRACTICE)
  let pool = career.player.pool;
  let maestria: ResultadoSessao["maestria"];
  if (p.estacao === "CHAMPION_PRACTICE" && def.maestria && p.championId) {
    const ganho = round2(def.maestria * fator);
    pool = pool.map((c) => (c.championId === p.championId ? { ...c, pontos: clamp(round2(c.pontos + ganho), 0, 100) } : c));
    maestria = { championId: p.championId, ganho };
  }

  // $ e reputação (SALA_DE_STREAM: definidos pelo TIPO escolhido)
  const dinheiro = stream ? stream.dinheiro : 0;
  const reputacao = stream ? stream.reputacao : 0;

  // fadiga: acumula (ou dissipa, nas variantes de recuperação)
  const fadigaDelta = variante ? variante.fadiga : stream ? stream.fadiga : Math.round(def.fadigaBase * int.fadiga);
  let fadiga = clamp(casa.fadiga + fadigaDelta, 0, CASA.fadigaMax);

  // burnout: entra ao ESTOURAR a fadiga; sai por tempo, sono ou descanso de semana
  let burnoutAte = casa.burnoutAte;
  let entrouBurnout = false;
  if (variante?.limpaBurnout) burnoutAte = null;
  else if (fadiga >= CASA.fadigaMax && !emBurnout(casa, p.agora)) {
    burnoutAte = p.agora + CASA.burnoutMs;
    entrouBurnout = true;
  }
  if (variante?.limpaBurnout) fadiga = clamp(fadiga, 0, CASA.fadigaMax);

  // moral: intensa custa um pouco; burnout dói mais; bem-estar/react recuperam
  const moralExtra = emBurnout(casa, p.agora) && !recuperacao ? -CASA.burnoutMoralExtra : 0;
  const moralDelta = (variante ? variante.moral : stream ? stream.moral : int.moral) + moralExtra;
  const moral = clamp(Math.round((career.player.moral + moralDelta) * 10) / 10, 0, 100);

  // análise de adversário (consumível — 1 por vez; estudar de novo troca o alvo)
  const analise = p.estacao === "ANALISE_ADVERSARIO" && p.timeIdAlvo ? { timeId: p.timeIdAlvo } : casa.analise;

  // contadores da semana (rendimentos decrescentes + recap + foco honrado)
  const ganhosSemana: Partial<Attributes> = { ...casa.ganhosSemana };
  for (const [k, v] of Object.entries(ganhos) as [AtributoKey, number][]) {
    ganhosSemana[k] = round2((ganhosSemana[k] ?? 0) + v);
  }

  const novaCasa: EstadoCasa = {
    ...casa,
    fadiga,
    burnoutAte,
    analise,
    sessoesSemana: { ...casa.sessoesSemana, [p.estacao]: (casa.sessoesSemana[p.estacao] ?? 0) + 1 },
    ganhosSemana,
    intensasSemana: casa.intensasSemana + (p.intensidade === "intensa" && !recuperacao ? 1 : 0),
    consolidado: consolidar(atributos, casa.consolidado), // marcos cruzados AGORA viram piso
    sessoesTotal: casa.sessoesTotal + 1,
  };

  return {
    career: {
      ...career,
      dinheiro: career.dinheiro + dinheiro,
      casa: novaCasa,
      player: {
        ...career.player,
        energia: clamp(career.player.energia - custo, 0, 100),
        atributos,
        pool,
        moral,
        reputacao: clamp(round2(career.player.reputacao + reputacao), 0, 100),
      },
    },
    ganhos,
    maestria,
    dinheiro,
    reputacao,
    moralDelta,
    fadigaDelta,
    entrouBurnout,
    mult,
  };
}

// Mapeamento EXPLÍCITO sessão → missão do passe (as missões antigas de "treinar" e
// "stream" continuam progredindo com as sessões novas — testado).
export function chavePasseDaSessao(estacao: EstacaoId): "treinar" | "stream" | null {
  if (estacao === "SALA_DE_STREAM") return "stream";
  if (estacao === "ANALISE_ADVERSARIO") return null; // estudo não é treino nem stream
  return "treinar";
}

// ---- 🎯 Foco da Semana ----
export function definirFoco(career: CareerState, foco: AtributoKey[], chaveSemana: number): CareerState {
  const casa = casaDe(career);
  return { ...career, casa: { ...casa, foco: foco.slice(0, CASA.focoMax), focoSemana: chaveSemana } };
}

// Foco honrado = TODOS os atributos declarados receberam ganho na semana.
export function focoHonrado(casa: EstadoCasa): boolean {
  return casa.foco.length > 0 && casa.foco.every((f) => (casa.ganhosSemana[f] ?? 0) > 0);
}

// ---- 📅 virada de semana (chamada pelo avancarSemana do loop) ----
// Dissipa fadiga (descanso zera + limpa burnout), fecha o streak do foco e zera os
// contadores semanais. O foco declarado CONTINUA (troca é livre, nunca obrigatória).
export function fecharSemanaCasa(casa: EstadoCasa, modo: "normal" | "descanso"): EstadoCasa {
  const honrou = focoHonrado(casa);
  return {
    ...casa,
    fadiga: modo === "descanso" ? 0 : clamp(casa.fadiga - CASA.fadigaAvancarSemana, 0, CASA.fadigaMax),
    burnoutAte: modo === "descanso" ? null : casa.burnoutAte,
    sessoesSemana: {},
    ganhosSemana: {},
    intensasSemana: 0,
    semanasFocoHonrado: honrou ? casa.semanasFocoHonrado + 1 : casa.foco.length > 0 ? 0 : casa.semanasFocoHonrado,
  };
}

// ---- 📋 Análise de Adversário (a joia: treino → counters → draft) ----

// Tendências DETERMINÍSTICAS do time (2 classes favoritas por hash do id) — o que o
// Quadro Tático revela e o viés que o draft inimigo passa a exibir de verdade.
const CLASSES: Classe[] = ["ASSASSINO", "MAGO", "ATIRADOR", "TANK", "LUTADOR", "SUPORTE"];
export function tendenciasDoTime(timeId: string): Classe[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < timeId.length; i++) {
    h = ((h ^ timeId.charCodeAt(i)) * 16777619) >>> 0;
  }
  const a = h % CLASSES.length;
  const b = (a + 1 + ((h >>> 8) % (CLASSES.length - 1))) % CLASSES.length;
  return [CLASSES[a], CLASSES[b]];
}

// O bônus vale SÓ contra o time estudado (o draft consulta; a partida consome).
export function analiseValePara(career: CareerState, timeId: string | null | undefined): boolean {
  return !!timeId && casaDe(career).analise?.timeId === timeId;
}

export function consumirAnalise(career: CareerState): CareerState {
  const casa = casaDe(career);
  if (!casa.analise) return career;
  return { ...career, casa: { ...casa, analise: null } };
}
