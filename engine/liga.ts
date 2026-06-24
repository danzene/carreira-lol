import { ORDEM_TIER, PREMIO_DINHEIRO, PREMIO_REPUTACAO, LIGA, VOCE } from "@/data/liga";
import { regiaoDe, regiaoDoPais, timesDaRegiao } from "@/data/regioes";
import { timeDe, timesDoTier } from "@/data/times";
import { criarRng, type Rng } from "./rng";
import type {
  CareerState,
  ConfrontoPO,
  LigaState,
  RodadaLiga,
  TimeClassificacao,
  Tier,
} from "./types";

// Ligas + campeonatos (Fase 8). PURO: estado -> estado, sem UI.
// O jogador ("VOCE") compete na liga do seu tier: todos-contra-todos + playoffs (top 4).

// Força competitiva de um time (a partir do prestígio). Pesa na partida oficial.
export function forcaTimeDe(timeId: string): number {
  const t = timeDe(timeId);
  if (!t) return 50;
  return 35 + t.prestigio * 0.45 + (regiaoDe(t.regiao)?.forca ?? 0);
}

function outro(c: ConfrontoPO, id: string): string {
  return c.aId === id ? c.bId : c.aId;
}

function clonar(liga: LigaState): LigaState {
  return JSON.parse(JSON.stringify(liga)) as LigaState;
}

function embaralhar<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tabela de jogos (método do círculo) — todos jogam contra todos uma vez.
function roundRobin(ids: string[]): [string, string][][] {
  const n = ids.length;
  const fixo = ids[0];
  let rot = ids.slice(1);
  const rodadas: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const linha = [fixo, ...rot];
    const rodada: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) rodada.push([linha[i], linha[n - 1 - i]]);
    rodadas.push(rodada);
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];
  }
  return rodadas;
}

// Monta a temporada do tier: VOCE + 5 rivais do tier, calendário todos-contra-todos.
export function gerarTemporada(tier: Tier, meuTimeId: string, seed: number, regiaoId?: string): LigaState {
  const rng = criarRng(seed);
  // No profissional (TIER1) a liga é a da sua região; nos tiers de base, genérica.
  const times = tier === "TIER1" && regiaoId ? timesDaRegiao(regiaoId) : timesDoTier(tier);
  const pool = times.map((t) => t.id).filter((id) => id !== meuTimeId);
  const rivais = embaralhar(pool, rng).slice(0, 5);
  const ids = [VOCE, ...rivais];
  const classificacao: TimeClassificacao[] = ids.map((timeId) => ({ timeId, vitorias: 0, derrotas: 0 }));
  const calendario: RodadaLiga[] = roundRobin(ids).map((pares) => {
    const meu = pares.find((p) => p[0] === VOCE || p[1] === VOCE)!;
    const adversarioId = meu[0] === VOCE ? meu[1] : meu[0];
    const outros = pares.filter((p) => p !== meu).map(([casaId, foraId]) => ({ casaId, foraId }));
    return { adversarioId, outros, jogada: false };
  });
  return { tier, participantes: ids, classificacao, calendario, rodadaAtual: 0, fase: "REGULAR" };
}

export function ordenarClassificacao(liga: LigaState): TimeClassificacao[] {
  return [...liga.classificacao].sort(
    (a, b) => b.vitorias - a.vitorias || a.derrotas - b.derrotas || a.timeId.localeCompare(b.timeId),
  );
}

export function posicaoDe(liga: LigaState, timeId: string): number {
  return ordenarClassificacao(liga).findIndex((c) => c.timeId === timeId) + 1;
}

function aplicarVD(cls: TimeClassificacao[], timeId: string, venceu: boolean): void {
  const t = cls.find((c) => c.timeId === timeId);
  if (!t) return;
  if (venceu) t.vitorias += 1;
  else t.derrotas += 1;
}

// Vencedor de um confronto IA x IA (mais forte tem mais chance, com ruído).
export function simularConfrontoIA(aId: string, bId: string, rng: Rng): string {
  const p = 1 / (1 + Math.exp(-0.12 * (forcaTimeDe(aId) - forcaTimeDe(bId))));
  return rng() < p ? aId : bId;
}

// Próximo adversário oficial do jogador (regular ou playoff). null = nada a jogar agora.
export function proximoConfrontoJogador(liga?: LigaState): string | null {
  if (!liga) return null;
  if (liga.fase === "REGULAR") {
    const r = liga.calendario[liga.rodadaAtual];
    return r && !r.jogada ? r.adversarioId : null;
  }
  if (liga.fase === "PLAYOFFS" && liga.playoff) {
    const po = liga.playoff;
    if (po.final && (po.final.aId === VOCE || po.final.bId === VOCE) && !po.final.vencedorId) {
      return outro(po.final, VOCE);
    }
    const sf = po.sf.find((c) => (c.aId === VOCE || c.bId === VOCE) && !c.vencedorId);
    return sf ? outro(sf, VOCE) : null;
  }
  return null;
}

function iniciarPlayoffs(liga: LigaState, rng: Rng): void {
  const top = ordenarClassificacao(liga)
    .slice(0, LIGA.tamanhoPlayoff)
    .map((c) => c.timeId);
  const [s1, s2, s3, s4] = top;
  const sf: ConfrontoPO[] = [
    { aId: s1, bId: s4 },
    { aId: s2, bId: s3 },
  ];
  liga.playoff = { sf };
  liga.fase = "PLAYOFFS";
  // resolve já as semis que não têm o jogador
  for (const c of sf) {
    if (c.aId !== VOCE && c.bId !== VOCE) c.vencedorId = simularConfrontoIA(c.aId, c.bId, rng);
  }
  const jogadorNasSemis = sf.some((c) => c.aId === VOCE || c.bId === VOCE);
  if (!jogadorNasSemis) {
    const finalistas = sf.map((c) => c.vencedorId!);
    const fin: ConfrontoPO = { aId: finalistas[0], bId: finalistas[1] };
    fin.vencedorId = simularConfrontoIA(fin.aId, fin.bId, rng);
    liga.playoff.final = fin;
    liga.campeao = fin.vencedorId;
    liga.fase = "ENCERRADA";
    liga.colocacaoFinal = posicaoDe(liga, VOCE); // ficou de fora dos playoffs
  }
}

function registrarPlayoff(liga: LigaState, venceu: boolean, rng: Rng): void {
  const po = liga.playoff!;
  // jogando a final?
  if (po.final && (po.final.aId === VOCE || po.final.bId === VOCE) && !po.final.vencedorId) {
    po.final.vencedorId = venceu ? VOCE : outro(po.final, VOCE);
    liga.campeao = po.final.vencedorId;
    liga.fase = "ENCERRADA";
    liga.colocacaoFinal = venceu ? 1 : 2;
    return;
  }
  // jogando uma semifinal
  const sf = po.sf.find((c) => (c.aId === VOCE || c.bId === VOCE) && !c.vencedorId);
  if (!sf) return;
  sf.vencedorId = venceu ? VOCE : outro(sf, VOCE);
  for (const c of po.sf) if (!c.vencedorId) c.vencedorId = simularConfrontoIA(c.aId, c.bId, rng);
  const finalistas = po.sf.map((c) => c.vencedorId!);
  po.final = { aId: finalistas[0], bId: finalistas[1] };
  if (!finalistas.includes(VOCE)) {
    // jogador eliminado na semi: simula a final
    po.final.vencedorId = simularConfrontoIA(po.final.aId, po.final.bId, rng);
    liga.campeao = po.final.vencedorId;
    liga.fase = "ENCERRADA";
    liga.colocacaoFinal = 3;
  }
}

// Registra o resultado da partida OFICIAL do jogador e simula o resto da rodada.
export function registrarResultadoJogador(career: CareerState, vitoria: boolean, seed: number): CareerState {
  if (!career.liga) return career;
  const rng = criarRng(seed);
  const liga = clonar(career.liga);

  if (liga.fase === "REGULAR") {
    const rodada = liga.calendario[liga.rodadaAtual];
    if (!rodada || rodada.jogada) return career;
    aplicarVD(liga.classificacao, VOCE, vitoria);
    aplicarVD(liga.classificacao, rodada.adversarioId, !vitoria);
    for (const c of rodada.outros) {
      const venc = simularConfrontoIA(c.casaId, c.foraId, rng);
      aplicarVD(liga.classificacao, c.casaId, venc === c.casaId);
      aplicarVD(liga.classificacao, c.foraId, venc === c.foraId);
    }
    rodada.jogada = true;
    liga.rodadaAtual += 1;
    if (liga.rodadaAtual >= liga.calendario.length) iniciarPlayoffs(liga, rng);
  } else if (liga.fase === "PLAYOFFS") {
    registrarPlayoff(liga, vitoria, rng);
  }

  return { ...career, liga };
}

// Garante que exista uma liga quando há contrato (e limpa liga órfã sem contrato).
export function garantirLiga(career: CareerState, seed: number): CareerState {
  if (!career.contratoAtual) return career.liga ? { ...career, liga: undefined } : career;
  if (career.liga) return career;
  const regiao = regiaoDoPais(career.player.nacionalidade).id;
  return { ...career, liga: gerarTemporada(career.tierAtual, career.contratoAtual.timeId, seed, regiao) };
}

export function premio(tier: Tier, colocacao: number): { dinheiro: number; reputacao: number } {
  const di = PREMIO_DINHEIRO[tier] ?? [];
  const re = PREMIO_REPUTACAO[tier] ?? [];
  const i = Math.min(Math.max(colocacao - 1, 0), di.length - 1);
  return { dinheiro: di[i] ?? 0, reputacao: re[i] ?? 0 };
}

function tierAcima(t: Tier): Tier {
  const i = ORDEM_TIER.indexOf(t);
  return i >= 0 && i < ORDEM_TIER.length - 1 ? ORDEM_TIER[i + 1] : t;
}

function tierAbaixo(t: Tier): Tier {
  const i = ORDEM_TIER.indexOf(t);
  return i > 0 ? ORDEM_TIER[i - 1] : t;
}

// Fim de temporada: premiação + promoção/rebaixamento + gera a próxima liga.
export function encerrarTemporada(career: CareerState, seed: number): CareerState {
  const liga = career.liga;
  if (!liga || liga.fase !== "ENCERRADA" || !career.contratoAtual) return career;

  const totalTimes = liga.participantes.length;
  const colocacao = liga.colocacaoFinal ?? totalTimes;
  const p = premio(liga.tier, colocacao);

  let novoTier = career.tierAtual;
  // TIER1 é o teto doméstico (vencer = vaga no MSI/Worlds, Parte 2 — não promove).
  if (colocacao === 1 && liga.tier !== "INTERNACIONAL" && liga.tier !== "TIER1") novoTier = tierAcima(liga.tier);
  else if (colocacao >= totalTimes && liga.tier !== "AMADOR") novoTier = tierAbaixo(liga.tier);

  // Ao chegar no profissional, você é assinado por um time PRO da sua região (entra por um menor).
  let contrato = { ...career.contratoAtual, tier: novoTier };
  if (novoTier === "TIER1" && career.tierAtual !== "TIER1") {
    const reg = regiaoDoPais(career.player.nacionalidade).id;
    const rookie = [...timesDaRegiao(reg)].sort((a, b) => a.prestigio - b.prestigio)[0];
    if (rookie) contrato = { ...contrato, timeId: rookie.id, salarioSemanal: 1200, bonusPorVitoria: 300 };
  }

  const base: CareerState = {
    ...career,
    player: {
      ...career.player,
      reputacao: Math.min(100, Math.round((career.player.reputacao + p.reputacao) * 10) / 10),
    },
    dinheiro: career.dinheiro + p.dinheiro,
    contratoAtual: contrato,
    tierAtual: novoTier,
    liga: undefined,
  };
  return garantirLiga(base, (seed ^ 0x9e3779b9) >>> 0);
}
