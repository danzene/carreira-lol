import { create } from "zustand";
import { criarCareerState, normalizarCareer } from "@/engine/player";
import { aplicarResultado } from "@/engine/simularPartida";
import {
  alteracaoMental as alteracaoMentalEngine,
  avancarSemana as avancarSemanaEngine,
  gastarEnergiaSoloq,
  streaming as streamingEngine,
  treinar as treinarEngine,
} from "@/engine/loop";
import {
  alternarCoach as alternarCoachEngine,
  bonusVitoria,
  bootcampCoreia,
  processarSemanaEconomia,
  sessaoMental as sessaoMentalEngine,
} from "@/engine/economia";
import {
  adicionarOfertas,
  assinarContrato as assinarContratoEngine,
  contraproposta as contrapropostaEngine,
  gerarOfertas,
  recusarOferta as recusarOfertaEngine,
} from "@/engine/transferencias";
import {
  encerrarTemporada as encerrarTemporadaEngine,
  garantirLiga,
  proximoConfrontoJogador,
  registrarResultadoJogador,
} from "@/engine/liga";
import { aplicarBonusRival, ehRival, registrarConfronto, RIVAL } from "@/engine/rivais";
import {
  abrirEntrevista,
  fatosDaSemana,
  gerarPostsFeed,
  responderEntrevista as responderEntrevistaEngine,
  type PostFeed,
  type TomResposta,
} from "@/engine/feed";
import { garantirProva, gerarProvaSemanal, podeJogarProva, registrarPartidaProva, semanaISO } from "@/engine/prova";
import {
  aulaParticular as aulaParticularEngine,
  comprarCargaCampeonato,
  comprarEnergetico,
  comprarEscudoStreak,
  comprarMegaEnergetico,
  comprarPreparacao,
  consumirPreparacao,
  vodReview as vodReviewEngine,
} from "@/engine/loja";
import { useProva } from "./provaStore";
import { atualizarRecords } from "@/engine/records";
import { timeDe } from "@/data/times";
import { gerarEvento, premioEvento } from "@/engine/eventos";
import { verificarConquistas } from "@/engine/conquistas";
import { sortearAcontecimento } from "@/engine/acontecimentos";
import { avancarTorneio, criarTorneio, premioTorneio } from "@/engine/internacional";
import { GACHA } from "@/data/gacha";
import { equipar, ganharCampeao as ganharCampeaoEngine, puxar, type ResultadoCampeao, type ResultadoPuxada } from "@/engine/gacha";
import { cargasPartida, consumirCarga, inicializarTempo, registrarUso, sincronizarEnergia, usosRestantes } from "@/engine/tempo";
import { idxElo } from "@/engine/elo";
import { cerimoniaDeDrop, cerimoniaDeElo, cerimoniasDeConquistas } from "@/engine/cerimonias";
import {
  chaveDia,
  coletarDiaria as coletarDiariaEngine,
  marcarPuxadaGratis,
  marcoStreak,
  puxadaGratisDisponivel,
  recompensaDoDia,
  registrarLoginDiario,
  type EventoLogin,
} from "@/engine/diario";
import { acumularDrop, acumularPartida, fecharSemanaStats, statsVazias } from "@/engine/statsSemana";
import {
  abrirBau,
  acumularSegundosGrind,
  aplicarGrind,
  comprarTalentoGrind,
  equiparCosmeticoGrind,
  estadoGrindInicial,
  fecharSemanaGrind,
  gerarItemGrind,
  grindDisponivel,
  modsDoGrind,
  resolverGrind,
  respecGrind,
  tetoAtingido,
  consumirRitmo,
  entrarExpedicaoGrind,
  continuarExpedicaoGrind,
  recuarExpedicaoGrind,
  finalizarExpedicaoGrind,
  finalizarExpedicaoPendente,
  type ResultadoGrind,
  type FimExpedicao,
} from "@/engine/grind";
import { passivoAtivo, type EventoFase } from "@/engine/expedicao";
import { defCosmetico, type TierBau } from "@/data/grindProposito";
import { cerimoniasDeUnlocks, migrarUnlocks } from "@/engine/unlocks";
import { gerarItem } from "@/engine/itens";
import { SLOTS_GEAR } from "@/data/itens";
import { criarRng } from "@/engine/rng";
import { rastrear, rastrearSessao } from "@/lib/telemetria";
import { useCerimonias } from "./cerimoniaStore";
import { useProfile } from "./profileStore";
import { useInventory } from "./inventoryStore";
import { usePasse } from "./passeStore";
import type { AtributoKey, CareerState, MatchResult, OpcoesCarreira, Player, StatsSemana, TraitId } from "@/engine/types";
import {
  apagarSlot,
  definirSlotAtual,
  gerarId,
  lerSlot,
  lerSlotAtual,
  salvarSlot,
} from "./saves";

// Estado global da carreira atual + integração com os slots (localStorage).

// Resumo do que aconteceu ao avançar a semana (Fase 12) — transitório, não salvo.
export interface ResumoSemana {
  semana: number;
  temporada: number;
  viradaTemporada: boolean;
  dinheiroDelta: number;
  novasPropostas: number;
  eventoNovo?: string;
  patchNovo?: number;
  acontecimento?: string;
  conquistas: string[];
}

// Recap "wrapped" da semana que fechou (transitório, mostrado antes do resumo).
export interface RecapSemanal {
  atual: StatsSemana;
  anterior: StatsSemana;
  semana: number;
  temporada: number;
  posts: PostFeed[]; // 1-2 posts mais relevantes da semana (o mundo reagiu)
  grind?: import("@/engine/grind").GrindSemana; // totais do Grind de Normais na semana
}

interface CareerStore {
  career: CareerState | null;
  slotId: string | null;
  ultimoResumo: ResumoSemana | null;
  dailyHub: { streak: number; evento: EventoLogin } | null;
  recapSemanal: RecapSemanal | null;
  grindResultado: ResultadoGrind | null; // transiente: lote do dia resolvido (widget lê daqui)
  grindResumo: { v: number; d: number; dinheiro: number } | null; // "enquanto você estava fora" (transiente)
  definirGrindResumo: (r: { v: number; d: number; dinheiro: number } | null) => void;
  tickGrind: (deltaSegundos: number) => void;
  alternarGrind: () => void;
  alternarOcultarGrind: () => void;
  definirOpcaoGrind: (patch: Partial<Pick<OpcoesCarreira, "grindPilula" | "reduzirAnimacoes" | "volumeDiorama">>) => void;
  // 🎯 Grind com Propósito
  abrirBauGrind: (escolha?: number) => { tier: TierBau; cosmetico?: string } | null;
  comprarTalento: (id: string) => boolean;
  respecTalentos: () => void;
  equiparCosmetico: (tipo: "skin" | "trilha" | "pet", id?: string) => void;
  registrarLogin: () => void;
  coletarDiaria: () => boolean;
  puxarGratis: () => Promise<ResultadoPuxada[] | null>;
  limparDailyHub: () => void;
  limparRecap: () => void;
  responderEntrevista: (tom: TomResposta) => void;
  marcarFeedVisto: () => void;
  aplicarPartidaProva: (resultado: MatchResult) => void;
  concederTitulo: (titulo: string) => void;
  comprarLoja: (item: "energetico" | "megaEnergetico" | "carga" | "escudo" | "preparacao") => boolean;
  vodReview: (championId: string) => boolean;
  aulaParticular: (attr: AtributoKey) => boolean;
  iniciarCarreira: (player: Player, opcoes: OpcoesCarreira) => string;
  carregar: (slotId: string) => boolean;
  recarregarAtual: () => boolean;
  aplicarPartida: (resultado: MatchResult) => void;
  treinar: (atributo: AtributoKey, especial?: boolean) => boolean;
  streaming: () => boolean;
  alteracaoMental: (traco: TraitId) => boolean;
  avancarSemana: (modo?: "normal" | "descanso") => void;
  limparResumo: () => void;
  bootcamp: () => boolean;
  alternarCoach: () => void;
  sessaoMental: () => boolean;
  puxarGacha: (qtd: number) => Promise<ResultadoPuxada[] | null>;
  ganharCampeao: (championId: string) => Promise<ResultadoCampeao | null>;
  equiparLenda: (id: string) => void;
  assinarContrato: (timeId: string) => void;
  recusarOferta: (timeId: string) => void;
  contraproposta: (timeId: string) => boolean;
  aplicarPartidaOficial: (resultado: MatchResult) => void;
  aplicarPartidaEvento: (resultado: MatchResult) => void;
  aplicarPartidaTorneio: (resultado: MatchResult) => void;
  encerrarTorneioInternacional: () => void;
  sincronizarLiga: () => void;
  encerrarTemporadaLiga: () => void;
  // 🗺️ Expedição (modo ATIVO). entrar/continuar podem já terminar a corrida (morte) → devolvem o fim.
  // `seed` = seed da corrida (a view monta o ROTEIRO do combate com ela — teatro determinístico).
  entrarExpedicao: () => { evento: EventoFase; fim: FimExpedicao | null; seed: number } | null;
  continuarExpedicao: () => { evento: EventoFase; fim: FimExpedicao | null; seed: number } | null;
  recuarExpedicao: () => FimExpedicao | null;
  encerrarExpedicaoPendente: () => void; // robustez: sair no meio embolsa o loot garantido
  apagar: (slotId: string) => void;
  sair: () => void;
}

// iLvl dos drops conforme o MMR do jogador (elo mais alto → itens melhores).
function iLvlDe(c: CareerState): number {
  return Math.max(10, Math.min(60, Math.round((c.player.rankSoloq.mmr - 800) / 50) + 10));
}

// Efeitos colaterais ao ENCERRAR uma corrida de Expedição: itens do baú pro inventário
// (raridade capada na borda) + telemetria. O loot em Sucata/cosmético/Ritmo já foi aplicado
// ao save pelo finalizarExpedicaoGrind puro — aqui só o que não é puro.
function aplicarFimExpedicao(fim: FimExpedicao): void {
  for (const it of fim.itens) useInventory.getState().adicionarItem(gerarItemGrind(it, iLvlDe(fim.career)));
  rastrear("expedicao_fim", { fase: fim.faseLimpa, morreu: fim.morreu, sucata: fim.sucata, baus: fim.baus.length, recorde: fim.recorde });
  if (fim.ritmo) rastrear("expedicao_ritmo_variante", { variante: fim.ritmo.variante, fase: fim.faseLimpa });
  for (const id of fim.cosmeticos) rastrear("grind_cosmetico_ganho", { id, origem: "expedicao" });
}

// Últimos segundos de grind já persistidos (throttle da gravação do heartbeat).
let segGravado = 0;

// Aplica conquistas e emite as cerimônias das novas (borda store→apresentação).
function comConquistas(c: CareerState): CareerState {
  const { career, novas } = verificarConquistas(c);
  useCerimonias.getState().emitir(cerimoniasDeConquistas(novas));
  return career;
}

export const useCareer = create<CareerStore>((set, get) => ({
  career: null,
  slotId: null,
  ultimoResumo: null,
  dailyHub: null,
  recapSemanal: null,
  grindResultado: null,
  grindResumo: null,
  definirGrindResumo: (r) => set({ grindResumo: r }),

  limparDailyHub: () => set({ dailyHub: null }),
  limparRecap: () => set({ recapSemanal: null }),

  // 🛋️ Heartbeat do Grind de Normais. Chamado pelo widget a cada tick com os SEGUNDOS
  // DE ABA VISÍVEL decorridos (nunca relógio — Regra 5). delta=0 só re-resolve/aplica
  // pendências (usado no mount e ao voltar de outra aba). Engine decide tudo em lote.
  tickGrind: (deltaSegundos) => {
    const { career: c0, slotId } = get();
    if (!c0 || !grindDisponivel(c0)) return;
    const hoje = chaveDia(Date.now());
    // seed nasce na BORDA (só usada se o dia virou / primeiro uso)
    const seedNova = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const gAntes = c0.grind ?? estadoGrindInicial(hoje, seedNova);

    if (!gAntes.ligado) {
      // pausado: não acumula; só garante o estado inicializado no save (1ª vez)
      if (!c0.grind) {
        const novo = { ...c0, grind: gAntes };
        set({ career: novo });
        if (slotId) salvarSlot(slotId, novo);
      }
      return;
    }

    // 🗺️ só UM modo ativo por vez: enquanto a Expedição está em andamento o PASSIVO não
    // acumula nem resolve (a corrida tem loop próprio — nada progride "nas costas" do jogador).
    if (!passivoAtivo(gAntes.modo, gAntes.expedicao)) {
      if (!c0.grind) {
        const novo = { ...c0, grind: gAntes };
        set({ career: novo });
        if (slotId) salvarSlot(slotId, novo);
      }
      return;
    }

    const g = acumularSegundosGrind(gAntes, deltaSegundos, hoje, seedNova);
    let novo: CareerState = { ...c0, grind: g };
    // os talentos da árvore entram como modificadores puros (velocidade, ouro, sucata…)
    const resultado = resolverGrind(novo.player, g.segundosHoje, g.seedDia, modsDoGrind(g));
    const ap = aplicarGrind(novo, resultado);
    novo = ap.career;

    // drops → inventário DIRETO (sem cerimônia fullscreen: grind é ambiente, não evento)
    for (const p of ap.novas) {
      if (p.drop) useInventory.getState().adicionarItem(gerarItemGrind(p.drop, iLvlDe(novo)));
      rastrear("grind_partida", { vitoria: p.vitoria, campeao: p.championId, idx: p.idx });
    }

    // teto do dia: telemetria + marca o aviso (badge) uma vez por dia
    if (novo.grind && tetoAtingido(novo.grind) && novo.grind.tetoAvisadoEm !== hoje) {
      novo = { ...novo, grind: { ...novo.grind, tetoAvisadoEm: hoje } };
      rastrear("grind_teto_atingido", { partidas: resultado.completas.length });
    }

    set({ career: novo, grindResultado: resultado });

    // persistência com parcimônia: gravar a cada tick spamaria o cloud sync (debounce de
    // 1.5s). Grava quando algo MATERIAL muda; segundos puros vão em lotes de ≥60s
    // (perda máxima ao fechar a aba: <60s de grind — aceitável e documentado).
    const material =
      ap.novas.length > 0 || gAntes.dia !== g.dia || !c0.grind || novo.grind?.tetoAvisadoEm !== gAntes.tetoAvisadoEm;
    if (material) segGravado = novo.grind?.segundosHoje ?? 0;
    const lote = (novo.grind?.segundosHoje ?? 0) - segGravado >= 60;
    if (lote) segGravado = novo.grind?.segundosHoje ?? 0;
    if ((material || lote) && slotId) salvarSlot(slotId, novo);
  },

  // Mostra/oculta o WIDGET do grind (config de conforto — se ligado, continua acumulando).
  alternarOcultarGrind: () => {
    const { career, slotId } = get();
    if (!career) return;
    const ocultar = !career.opcoes?.ocultarGrind;
    if (ocultar) rastrear("diorama_ocultado", {}); // o sinal de rejeição mais importante
    const opcoes = { esconderAtributos: false, fearless: false, ...career.opcoes, ocultarGrind: ocultar };
    const novo = { ...career, opcoes };
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // Preferências de apresentação do diorama (persistidas no save).
  definirOpcaoGrind: (patch) => {
    const { career, slotId } = get();
    if (!career) return;
    if (patch.grindPilula === true) rastrear("diorama_pilula", {});
    if (patch.reduzirAnimacoes === true) rastrear("diorama_reduzido", { motivo: "config" });
    const opcoes = { esconderAtributos: false, fearless: false, ...career.opcoes, ...patch };
    const novo = { ...career, opcoes };
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // 🎁 Abre o baú pendente (o tier só é REVELADO aqui). `escolha` só vale pro Raro com
  // "Segunda Chance". Devolve {tier, cosmetico} pra cena encenar a cerimônia certa.
  abrirBauGrind: (escolha = 0) => {
    const { career: c0, slotId } = get();
    if (!c0?.grind?.bauPendente) return null;
    const ab = abrirBau(c0, chaveDia(Date.now()), escolha);
    if (!ab) return null;
    let novo = ab.career;
    // item do baú Raro: raridade capada na borda, direto pro inventário
    if (ab.item) useInventory.getState().adicionarItem(gerarItemGrind(ab.item, iLvlDe(novo)));
    rastrear("grind_bau_aberto", { tier: ab.bau.tier, numero: ab.bau.numero, pity: ab.bau.foiPity });
    if (ab.cosmetico) rastrear("grind_cosmetico_ganho", { id: ab.cosmetico });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return { tier: ab.bau.tier, cosmetico: ab.cosmetico ? defCosmetico(ab.cosmetico)?.nome : undefined };
  },

  // 🌳 Compra 1 nível de um nó (Sucata é o único recurso gasto — economia fechada).
  comprarTalento: (id) => {
    const { career: c0, slotId } = get();
    if (!c0) return false;
    const r = comprarTalentoGrind(c0, id);
    if (!r) return false;
    rastrear("grind_talento_comprado", { no: id, nivel: r.nivel });
    set({ career: r.career });
    if (slotId) salvarSlot(slotId, r.career);
    return true;
  },

  // ♻️ Respec GRÁTIS: devolve toda a Sucata investida.
  respecTalentos: () => {
    const { career: c0, slotId } = get();
    if (!c0?.grind) return;
    const novo = respecGrind(c0);
    rastrear("grind_respec", { devolvido: (novo.grind?.sucata ?? 0) - c0.grind.sucata });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // 🎨 Equipa 1 cosmético por tipo (puro visual — Regra 3).
  equiparCosmetico: (tipo, id) => {
    const { career: c0, slotId } = get();
    if (!c0) return;
    const novo = equiparCosmeticoGrind(c0, tipo, id);
    if (novo === c0) return;
    if (id) rastrear("grind_cosmetico_equipado", { tipo, id });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // Liga/pausa o grind (toggle do widget). Inicializa o estado na primeira vez.
  alternarGrind: () => {
    const { career: c0, slotId } = get();
    if (!c0) return;
    const hoje = chaveDia(Date.now());
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const g = c0.grind ?? estadoGrindInicial(hoje, seed);
    const novoG = { ...g, ligado: !g.ligado };
    rastrear(novoG.ligado ? "grind_ligado" : "grind_pausado", { dia: hoje });
    const novo = { ...c0, grind: novoG };
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // 🚪 Entra na Expedição (modo ATIVO). Resolve a 1ª fase; se já morre, encerra na hora.
  entrarExpedicao: () => {
    const { career: c0, slotId } = get();
    if (!c0) return null;
    const hoje = chaveDia(Date.now());
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const r = entrarExpedicaoGrind(c0, hoje, seed);
    if (!r) return null;
    rastrear("expedicao_iniciada", { seed });
    if (r.evento.limpou) rastrear("expedicao_fase_limpa", { fase: r.evento.fase });
    // morte já na 1ª fase: embolsa (loot 0/quase 0) e volta pro passivo
    let career = r.career;
    let fim: FimExpedicao | null = null;
    if (career.grind!.expedicao!.status === "morto") {
      fim = finalizarExpedicaoGrind(career, hoje);
      if (fim) {
        aplicarFimExpedicao(fim);
        career = fim.career;
      }
    }
    set({ career });
    if (slotId) salvarSlot(slotId, career);
    return { evento: r.evento, fim, seed };
  },

  // 🎲 CONTINUAR: aposta consciente — resolve a próxima fase; morte encerra e embolsa.
  continuarExpedicao: () => {
    const { career: c0, slotId } = get();
    const exp = c0?.grind?.expedicao;
    if (!c0 || !exp || exp.status !== "escolha") return null;
    const seed = exp.seed; // capturada ANTES (na morte o finalize apaga a corrida do save)
    rastrear("expedicao_escolha", { escolha: "continuar", fase: exp.faseAtual });
    const r = continuarExpedicaoGrind(c0);
    if (!r) return null;
    if (r.evento.limpou) rastrear("expedicao_fase_limpa", { fase: r.evento.fase });
    const hoje = chaveDia(Date.now());
    let career = r.career;
    let fim: FimExpedicao | null = null;
    if (career.grind!.expedicao!.status === "morto") {
      fim = finalizarExpedicaoGrind(career, hoje);
      if (fim) {
        aplicarFimExpedicao(fim);
        career = fim.career;
      }
    }
    set({ career });
    if (slotId) salvarSlot(slotId, career);
    return { evento: r.evento, fim, seed };
  },

  // 🛟 RECUAR: sai com o loot garantido — encerra e embolsa na hora (nada fica pendente).
  recuarExpedicao: () => {
    const { career: c0, slotId } = get();
    const exp = c0?.grind?.expedicao;
    if (!c0 || !exp || exp.status !== "escolha") return null;
    rastrear("expedicao_escolha", { escolha: "recuar", fase: exp.faseLimpa });
    const fim = finalizarExpedicaoGrind(recuarExpedicaoGrind(c0), chaveDia(Date.now()));
    if (!fim) return null;
    aplicarFimExpedicao(fim);
    set({ career: fim.career });
    if (slotId) salvarSlot(slotId, fim.career);
    return fim;
  },

  // Robustez: fechar a aba / navegar no meio embolsa o loot das fases COMPLETADAS.
  encerrarExpedicaoPendente: () => {
    const { career: c0, slotId } = get();
    if (!c0?.grind?.expedicao) return;
    const { career, fim } = finalizarExpedicaoPendente(c0, chaveDia(Date.now()));
    if (!fim) return;
    aplicarFimExpedicao(fim);
    set({ career });
    if (slotId) salvarSlot(slotId, career);
  },

  // Responde a entrevista pendente (a fala vira post no feed; efeitos no engine).
  responderEntrevista: (tom) => {
    const { career, slotId } = get();
    if (!career?.entrevistaPendente) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const { career: novo } = responderEntrevistaEngine(career, tom, seed);
    rastrear("entrevista_respondida", { tom, contexto: career.entrevistaPendente.contexto });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  marcarFeedVisto: () => {
    const { career, slotId } = get();
    if (!career || !(career.feedNovos ?? 0)) return;
    const novo = { ...career, feedNovos: 0 };
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // Partida da PROVA SEMANAL: lateral — não gasta energia, não mexe em elo/liga.
  // Na 3ª partida fecha o score, dá recompensa de participação e envia pro leaderboard.
  aplicarPartidaProva: (resultado) => {
    const { career: c0, slotId } = get();
    if (!c0) return;
    const semana = semanaISO(Date.now());
    const prova = gerarProvaSemanal(semana);
    let novo = garantirProva(c0, semana);
    if (!podeJogarProva(novo, semana)) return;
    novo = consumirPreparacao(registrarPartidaProva(novo, resultado, prova));

    const provaFinal = novo.prova;
    if (provaFinal?.finalizada && provaFinal.scoreFinal != null) {
      // recompensa de participação: item garantido (sorte alta) + título da semana
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      const rng = criarRng(seed);
      const slot = SLOTS_GEAR[Math.floor(rng() * SLOTS_GEAR.length)].slot;
      const item = gerarItem(slot, iLvlDe(novo), seed, { sorte: 0.3 });
      useInventory.getState().adicionarItem(item);
      useCerimonias.getState().emitir(cerimoniaDeDrop(item));
      const titulo = `Prova Semanal S${semana % 100}`;
      if (!(novo.titulos ?? []).includes(titulo)) novo = { ...novo, titulos: [...(novo.titulos ?? []), titulo] };
      useCerimonias.getState().emitir({
        tipo: "ACHIEVEMENT_UNLOCKED",
        id: `prova_${semana}`,
        nome: `Prova concluída · ${provaFinal.scoreFinal} pts`,
        emoji: "🏁",
        desc: "Score enviado pro placar mundial da semana.",
      });
      void useProva.getState().enviarScore(prova, provaFinal, { elo: novo.player.rankSoloq.elo, semanaJogo: novo.semanaAtual });
    }

    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // 💰 Compras da loja (consumíveis/preparação). Engine valida tudo; false = não rolou.
  comprarLoja: (item) => {
    const { career: c0, slotId } = get();
    if (!c0) return false;
    const agora = Date.now();
    const c = sincronizarEnergia(c0, agora);
    const novo =
      item === "energetico"
        ? comprarEnergetico(c)
        : item === "megaEnergetico"
          ? comprarMegaEnergetico(c)
          : item === "carga"
            ? comprarCargaCampeonato(c, agora)
            : item === "escudo"
              ? comprarEscudoStreak(c, chaveDia(agora))
              : comprarPreparacao(c);
    if (!novo) return false;
    rastrear("loja_compra", { item });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  vodReview: (championId) => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = vodReviewEngine(career, championId);
    if (!novo) return false;
    rastrear("loja_compra", { item: "vodReview", championId });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  aulaParticular: (attr) => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = aulaParticularEngine(career, attr);
    if (!novo) return false;
    rastrear("loja_compra", { item: "aulaParticular", attr });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  // Concede um título cosmético (idempotente) — usado pelo topo do leaderboard da prova.
  concederTitulo: (titulo) => {
    const { career, slotId } = get();
    if (!career || (career.titulos ?? []).includes(titulo)) return;
    const novo = { ...career, titulos: [...(career.titulos ?? []), titulo] };
    useCerimonias.getState().emitir({ tipo: "ACHIEVEMENT_UNLOCKED", id: `titulo_${titulo}`, nome: titulo, emoji: "👑", desc: "Título exclusivo conquistado!" });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  // Registra o login do dia (streak com escudo). Abre o Daily Hub se é um dia novo.
  registrarLogin: () => {
    const { career: c0, slotId } = get();
    if (!c0) return;
    const r = registrarLoginDiario(c0, chaveDia(Date.now()));
    rastrearSessao({ semana: c0.semanaAtual, temporada: c0.temporada, elo: c0.player.rankSoloq.elo, streak: r.streak });
    if (r.evento === "mesmo_dia") return;
    rastrear("streak_dia", { streak: r.streak, evento: r.evento });
    set({ career: r.career, dailyHub: { streak: r.streak, evento: r.evento } });
    if (slotId) salvarSlot(slotId, r.career);
    if (marcoStreak(r.streak)) {
      useCerimonias.getState().emitir({ tipo: "STREAK_MILESTONE", dias: r.streak, recompensa: recompensaDoDia(r.streak).rotulo });
    }
  },

  // Coleta a recompensa de streak do dia ($/energia no engine; item vai pro inventário).
  coletarDiaria: () => {
    const { career: c0, slotId } = get();
    if (!c0) return false;
    const agora = Date.now();
    const r = coletarDiariaEngine(sincronizarEnergia(c0, agora), chaveDia(agora));
    if (!r) return false;
    if (r.recompensa.tipo === "item") {
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      const rng = criarRng(seed);
      const slot = SLOTS_GEAR[Math.floor(rng() * SLOTS_GEAR.length)].slot;
      const item = gerarItem(slot, iLvlDe(r.career), seed, { sorte: 0.1 });
      useInventory.getState().adicionarItem(item);
      useCerimonias.getState().emitir(cerimoniaDeDrop(item));
    }
    set({ career: r.career });
    if (slotId) salvarSlot(slotId, r.career);
    return true;
  },

  // Puxada diária GRÁTIS no Carreira Booster (conta pro pity — decisão documentada).
  puxarGratis: async () => {
    const { career, slotId } = get();
    if (!career) return null;
    const hoje = chaveDia(Date.now());
    if (!puxadaGratisDisponivel(career, hoje)) return null;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const r = puxar(career, 1, seed);
    const novo = comConquistas(marcarPuxadaGratis(r.career, hoje));
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    usePasse.getState().progredir("booster");
    rastrear("gacha_puxada", { qtd: 1, melhor: Math.max(...r.resultados.map((x) => x.raridade)), raridades: r.resultados.map((x) => x.raridade), pity: novo.pity ?? 0, gratis: true });
    return r.resultados;
  },

  iniciarCarreira: (player, opcoes) => {
    // carreira NOVA joga com unlock progressivo (saves antigos viram legacy na migração)
    const career = inicializarTempo({ ...criarCareerState(player, opcoes), unlocksLegacy: false }, Date.now());
    const slotId = gerarId();
    salvarSlot(slotId, career);
    definirSlotAtual(slotId);
    set({ career, slotId });
    rastrear("carreira_criada", { rota: player.rota });
    return slotId;
  },

  carregar: (slotId) => {
    const slot = lerSlot(slotId);
    if (!slot) return false;
    definirSlotAtual(slotId);
    // migração de save (campos faltando) + relógios de recarga + migração de unlocks
    let state = migrarUnlocks(inicializarTempo(normalizarCareer(slot.state), Date.now()));
    // 🗺️ Expedição que ficou "no meio" (fechou a aba): encerra e embolsa o loot das fases
    // COMPLETADAS — nunca resume por trás nem duplica (regra de robustez da Fase 2).
    const pend = finalizarExpedicaoPendente(state, chaveDia(Date.now()));
    if (pend.fim) {
      state = pend.career;
      for (const it of pend.fim.itens) useInventory.getState().adicionarItem(gerarItemGrind(it, iLvlDe(state)));
      rastrear("expedicao_fim", { fase: pend.fim.faseLimpa, morreu: pend.fim.morreu, sucata: pend.fim.sucata, baus: pend.fim.baus.length, motivo: "saiu" });
    }
    set({ career: state, slotId });
    if (state !== slot.state) salvarSlot(slotId, state);
    return true;
  },

  recarregarAtual: () => {
    const atual = lerSlotAtual();
    if (!atual) return false;
    return get().carregar(atual);
  },

  aplicarPartida: (resultado) => {
    const { career: c0, slotId } = get();
    if (!c0) return;
    const career = sincronizarEnergia(c0, Date.now());
    let novo = acumularPartida(gastarEnergiaSoloq(aplicarResultado(career, resultado)), resultado);
    if (resultado.vitoria) novo = { ...novo, dinheiro: novo.dinheiro + bonusVitoria(career) };
    novo = comConquistas(novo);
    useCerimonias.getState().emitir(cerimoniaDeElo(career.player.rankSoloq.elo, novo.player.rankSoloq.elo));
    const unlocks = cerimoniasDeUnlocks(career, novo);
    useCerimonias.getState().emitir(unlocks);
    for (const u of unlocks) if (u.tipo === "FEATURE_UNLOCKED") rastrear("feature_desbloqueada", { feature: u.feature });
    const rec = atualizarRecords(novo, resultado);
    novo = rec.career;
    useCerimonias.getState().emitir(rec.cerimonias);
    // anti-tilt: 1 mensagem HUMANA por sequência (streak === -3 só acontece 1x)
    if ((novo.player.rankSoloq.streak ?? 0) === -3) {
      useCerimonias.getState().emitir({ tipo: "MENSAGEM", texto: "Dia difícil? Um treino leve ou um descanso podem virar o jogo.", emoji: "💜" });
    }
    novo = consumirPreparacao(novo); // buff da loja vale 1 partida
    novo = consumirRitmo(novo); // 🔥 Ritmo de Treino (da Expedição) também vale 1 partida
    rastrear("partida_fim", { modo: "soloq", vitoria: resultado.vitoria, nota: resultado.notaPerformance, elo: novo.player.rankSoloq.elo });
    void useProfile.getState().ajustar(resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota, "partida");
    if (resultado.vitoria) {
      const drop = useInventory.getState().dropDePartida(iLvlDe(career));
      if (drop) novo = acumularDrop(novo, drop.raridade);
    }
    usePasse.getState().progredir("jogar");
    if (resultado.vitoria) usePasse.getState().progredir("vencer");
    const subiuElo = idxElo(novo.player.rankSoloq.elo) - idxElo(career.player.rankSoloq.elo);
    if (subiuElo > 0) usePasse.getState().progredir("subir_elo", subiuElo);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  treinar: (atributo, especial = false) => {
    const { career: c0, slotId } = get();
    if (!c0) return false;
    const career = sincronizarEnergia(c0, Date.now());
    const novo = treinarEngine(career, atributo, especial);
    if (!novo) return false;
    usePasse.getState().progredir("treinar");
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  streaming: () => {
    const { career: c0, slotId } = get();
    if (!c0) return false;
    const career = sincronizarEnergia(c0, Date.now());
    const novo = streamingEngine(career);
    if (!novo) return false;
    usePasse.getState().progredir("stream");
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  alteracaoMental: (traco) => {
    const { career: c0, slotId } = get();
    if (!c0) return false;
    const career = sincronizarEnergia(c0, Date.now());
    const novo = alteracaoMentalEngine(career, traco);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  avancarSemana: (modo = "normal") => {
    const { career: c0, slotId } = get();
    if (!c0) return;
    const agora = Date.now();
    const antes = sincronizarEnergia(c0, agora);
    const lista = modo === "descanso" ? antes.descansosEm : antes.avancosEm;
    if (usosRestantes(lista, agora) <= 0) return; // sem usos na janela (a UI já desabilita)
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    let novo = processarSemanaEconomia(avancarSemanaEngine(antes, modo));

    const inboxAntes = novo.inbox.length;
    novo = adicionarOfertas(novo, gerarOfertas(novo, seed));
    const novasPropostas = novo.inbox.length - inboxAntes;

    const evento = antes.eventoAtual ? null : gerarEvento(novo, (seed ^ 0x55aa) >>> 0);
    if (evento) novo = { ...novo, eventoAtual: evento };

    const ac = sortearAcontecimento(novo, (seed ^ 0x1234) >>> 0);
    if (ac) novo = ac.career;

    const conq = verificarConquistas(novo);
    novo = conq.career;
    useCerimonias.getState().emitir(cerimoniasDeConquistas(conq.novas));

    novo =
      modo === "descanso"
        ? { ...novo, descansosEm: registrarUso(antes.descansosEm, agora) }
        : { ...novo, avancosEm: registrarUso(antes.avancosEm, agora) };

    void useProfile.getState().ajustar(GACHA.porSemana, "semana");

    const resumo: ResumoSemana = {
      semana: novo.semanaAtual,
      temporada: novo.temporada,
      viradaTemporada: novo.temporada > antes.temporada,
      dinheiroDelta: novo.dinheiro - antes.dinheiro,
      novasPropostas,
      eventoNovo: evento?.nome,
      patchNovo: novo.patchVigente !== antes.patchVigente ? novo.patchVigente : undefined,
      acontecimento: ac?.acontecimento.texto,
      conquistas: conq.novas.map((c) => c.nome),
    };

    // o mundo REAGE: posts do feed sobre a semana que fechou (determinístico por seed)
    const posts = gerarPostsFeed(antes, fatosDaSemana(antes), (seed ^ 0xfeed) >>> 0);
    if (posts.length > 0) {
      novo = { ...novo, feed: [...posts, ...(novo.feed ?? [])].slice(0, 30), feedNovos: (novo.feedNovos ?? 0) + posts.length };
    }

    // recap "wrapped" da semana que fechou + vira as stats pra próxima
    const recap: RecapSemanal = {
      atual: antes.statsSemana ?? statsVazias(),
      anterior: antes.statsSemanaAnterior ?? statsVazias(),
      semana: antes.semanaAtual,
      temporada: antes.temporada,
      posts: posts.slice(0, 2),
      grind: antes.grind && antes.grind.semana.partidas > 0 ? antes.grind.semana : undefined,
    };
    novo = fecharSemanaGrind(fecharSemanaStats(novo));
    const unlocksSemana = cerimoniasDeUnlocks(antes, novo);
    useCerimonias.getState().emitir(unlocksSemana);
    for (const u of unlocksSemana) if (u.tipo === "FEATURE_UNLOCKED") rastrear("feature_desbloqueada", { feature: u.feature });

    set({ career: novo, ultimoResumo: resumo, recapSemanal: recap });
    if (slotId) salvarSlot(slotId, novo);
  },

  limparResumo: () => set({ ultimoResumo: null }),

  bootcamp: () => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = bootcampCoreia(career);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  alternarCoach: () => {
    const { career, slotId } = get();
    if (!career) return;
    const novo = alternarCoachEngine(career);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  sessaoMental: () => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = sessaoMentalEngine(career);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  puxarGacha: async (qtd) => {
    const { career, slotId } = get();
    if (!career) return null;
    const custo = qtd >= 10 ? GACHA.custo10 : GACHA.custo1 * qtd;
    const pago = await useProfile.getState().ajustar(-custo, "carreira-booster"); // cobra no servidor
    if (!pago) return null; // saldo insuficiente / offline
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const r = puxar(career, qtd, seed);
    const novo = comConquistas(r.career);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    usePasse.getState().progredir("booster");
    rastrear("gacha_puxada", { qtd, melhor: Math.max(...r.resultados.map((x) => x.raridade)), raridades: r.resultados.map((x) => x.raridade), pity: novo.pity ?? 0, gratis: false });
    return r.resultados;
  },

  ganharCampeao: async (championId) => {
    const { career, slotId } = get();
    if (!career) return null;
    const pago = await useProfile.getState().ajustar(-GACHA.custoCampeao, "campeao");
    if (!pago) return null;
    const r = ganharCampeaoEngine(career, championId);
    const novo = comConquistas(r.career);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    usePasse.getState().progredir("booster");
    return r.resultado;
  },

  equiparLenda: (id) => {
    const { career, slotId } = get();
    if (!career) return;
    const novo = equipar(career, id);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  assinarContrato: (timeId) => {
    const { career, slotId } = get();
    if (!career) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    let novo = assinarContratoEngine(career, timeId);
    novo = garantirLiga({ ...novo, liga: undefined }, seed); // nova temporada no novo tier
    novo = comConquistas(novo);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  recusarOferta: (timeId) => {
    const { career, slotId } = get();
    if (!career) return;
    const novo = recusarOfertaEngine(career, timeId);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  contraproposta: (timeId) => {
    const { career, slotId } = get();
    if (!career) return false;
    const { career: novo, aceita } = contrapropostaEngine(career, timeId);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return aceita;
  },

  aplicarPartidaOficial: (resultado) => {
    const { career: c0, slotId } = get();
    if (!c0) return;
    const agora = Date.now();
    if (cargasPartida(c0, agora) < 1) return; // sem carga de partida (a UI já desabilita)
    const adversario = proximoConfrontoJogador(c0.liga); // quem você enfrentou nesta rodada
    const eraRival = !!adversario && ehRival(c0, adversario);
    const semRank = { ...resultado, lpDelta: 0 }; // partida oficial não mexe no elo de soloq
    let novo = acumularPartida(aplicarResultado(c0, semRank), semRank); // partida de campeonato NÃO gasta energia
    if (resultado.vitoria) novo = { ...novo, dinheiro: novo.dinheiro + bonusVitoria(c0) };
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    novo = registrarResultadoJogador(novo, resultado.vitoria, seed);
    // rivalidade: 2 derrotas seguidas viram rival; vencer o rival dá bônus + drop com sorte
    if (adversario) {
      if (eraRival && resultado.vitoria) {
        novo = aplicarBonusRival(novo);
        novo = abrirEntrevista(novo, "rival", adversario); // vitória sobre rival = imprensa quer ouvir
      }
      const rv = registrarConfronto(novo, adversario, resultado.vitoria);
      novo = rv.career;
      const nomeAdv = timeDe(adversario)?.nome ?? adversario;
      if (rv.evento === "virou_rival") useCerimonias.getState().emitir({ tipo: "RIVAL_DECLARED", nome: nomeAdv });
      if (rv.evento === "superado") useCerimonias.getState().emitir({ tipo: "RIVAL_DEFEATED", nome: nomeAdv });
    }
    void useProfile.getState().ajustar(resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota, "liga");
    if (resultado.vitoria) {
      const drop = useInventory.getState().dropDePartida(iLvlDe(c0), eraRival ? 0.05 + RIVAL.bonusSorteDrop : 0.05);
      if (drop) novo = acumularDrop(novo, drop.raridade);
    }
    usePasse.getState().progredir("jogar");
    usePasse.getState().progredir("campeonato");
    if (resultado.vitoria) usePasse.getState().progredir("vencer");
    novo = consumirCarga(novo, agora);
    novo = comConquistas(novo);
    novo = consumirPreparacao(novo);
    rastrear("partida_fim", { modo: "liga", vitoria: resultado.vitoria, nota: resultado.notaPerformance, elo: novo.player.rankSoloq.elo });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  aplicarPartidaEvento: (resultado) => {
    const { career: c0, slotId } = get();
    if (!c0 || !c0.eventoAtual) return;
    const career = sincronizarEnergia(c0, Date.now());
    const premio = premioEvento(career.eventoAtual!, resultado.vitoria);
    const semRank = { ...resultado, lpDelta: 0 }; // evento não mexe no elo
    let novo = acumularPartida(gastarEnergiaSoloq(aplicarResultado(career, semRank)), semRank);
    novo = {
      ...novo,
      dinheiro: novo.dinheiro + premio.dinheiro,
      player: {
        ...novo.player,
        reputacao: Math.min(100, Math.round((novo.player.reputacao + premio.reputacao) * 10) / 10),
      },
      eventoAtual: undefined,
    };
    void useProfile.getState().ajustar(resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota, "evento");
    usePasse.getState().progredir("jogar");
    if (resultado.vitoria) usePasse.getState().progredir("vencer");
    novo = comConquistas(novo);
    novo = consumirPreparacao(novo);
    rastrear("partida_fim", { modo: "evento", vitoria: resultado.vitoria, nota: resultado.notaPerformance, elo: novo.player.rankSoloq.elo });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  sincronizarLiga: () => {
    const { career, slotId } = get();
    if (!career) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const novo = garantirLiga(career, seed);
    if (novo === career) return;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  encerrarTemporadaLiga: () => {
    const { career, slotId } = get();
    if (!career) return;
    const colocacao = career.liga?.colocacaoFinal ?? 99;
    const eraTier1Campeao = career.liga?.tier === "TIER1" && colocacao === 1;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    let novo = encerrarTemporadaEngine(career, seed);
    // ir bem no campeonato coloca você nos holofotes: surto de propostas.
    if (colocacao <= 2) novo = adicionarOfertas(novo, gerarOfertas(novo, (seed ^ 0x77) >>> 0));
    if (colocacao === 1) novo = abrirEntrevista(novo, "campeao_liga"); // campeão fala com a imprensa
    // campeão da liga profissional → vaga no torneio internacional (MSI/Worlds).
    if (eraTier1Campeao && !novo.torneioAtual) {
      const tipo = career.temporada % 2 === 1 ? "MSI" : "WORLDS";
      novo = { ...novo, torneioAtual: criarTorneio(tipo, novo) };
    }
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  aplicarPartidaTorneio: (resultado) => {
    const { career: c0, slotId } = get();
    if (!c0 || !c0.torneioAtual) return;
    const agora = Date.now();
    if (cargasPartida(c0, agora) < 1) return; // sem carga de partida (a UI já desabilita)
    const semRank = { ...resultado, lpDelta: 0 }; // torneio não mexe no elo
    let novo = acumularPartida(aplicarResultado(c0, semRank), semRank); // campeonato NÃO gasta energia
    if (resultado.vitoria) novo = { ...novo, dinheiro: novo.dinheiro + bonusVitoria(c0) };
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    novo = avancarTorneio(novo, resultado.vitoria, seed);
    void useProfile.getState().ajustar(resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota, "torneio");
    if (resultado.vitoria) {
      const drop = useInventory.getState().dropDePartida(iLvlDe(c0), 0.05);
      if (drop) novo = acumularDrop(novo, drop.raridade);
    }
    usePasse.getState().progredir("jogar");
    usePasse.getState().progredir("campeonato");
    if (resultado.vitoria) usePasse.getState().progredir("vencer");
    novo = consumirCarga(novo, agora);
    novo = comConquistas(novo);
    novo = consumirPreparacao(novo);
    rastrear("partida_fim", { modo: "torneio", vitoria: resultado.vitoria, nota: resultado.notaPerformance, elo: novo.player.rankSoloq.elo });
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  encerrarTorneioInternacional: () => {
    const { career, slotId } = get();
    const t = career?.torneioAtual;
    if (!career || !t || t.bracket.fase !== "ENCERRADA") return;
    const col = t.bracket.colocacaoFinal ?? 99;
    const pr = premioTorneio(t.tipo, col);
    const titulos = col === 1 ? [...(career.titulosInternacionais ?? []), t.tipo] : career.titulosInternacionais;
    let novo: CareerState = {
      ...career,
      dinheiro: career.dinheiro + pr.dinheiro,
      player: {
        ...career.player,
        reputacao: Math.min(100, Math.round((career.player.reputacao + pr.reputacao) * 10) / 10),
      },
      titulosInternacionais: titulos,
      torneioAtual: undefined,
    };
    if (col === 1) novo = abrirEntrevista(novo, "titulo"); // campeão internacional = entrevista
    novo = comConquistas(novo);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  apagar: (slotId) => {
    apagarSlot(slotId);
    if (get().slotId === slotId) set({ career: null, slotId: null });
  },

  sair: () => {
    definirSlotAtual(null);
    set({ career: null, slotId: null });
  },
}));
