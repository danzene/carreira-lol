import { create } from "zustand";
import { criarCareerState } from "@/engine/player";
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
  upgradeEquip as upgradeEquipEngine,
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
  registrarResultadoJogador,
} from "@/engine/liga";
import { gerarEvento, premioEvento } from "@/engine/eventos";
import { verificarConquistas } from "@/engine/conquistas";
import { sortearAcontecimento } from "@/engine/acontecimentos";
import { avancarTorneio, criarTorneio, premioTorneio } from "@/engine/internacional";
import { GACHA } from "@/data/gacha";
import { equipar, ganharCampeao as ganharCampeaoEngine, puxar, type ResultadoCampeao, type ResultadoPuxada } from "@/engine/gacha";
import { cargasPartida, consumirCarga, inicializarTempo, registrarUso, sincronizarEnergia, usosRestantes } from "@/engine/tempo";
import { idxElo } from "@/engine/elo";
import { cerimoniaDeElo, cerimoniasDeConquistas } from "@/engine/cerimonias";
import { useCerimonias } from "./cerimoniaStore";
import { useProfile } from "./profileStore";
import { useInventory } from "./inventoryStore";
import { usePasse } from "./passeStore";
import type { AtributoKey, CareerState, Equip, MatchResult, OpcoesCarreira, Player, TraitId } from "@/engine/types";
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

interface CareerStore {
  career: CareerState | null;
  slotId: string | null;
  ultimoResumo: ResumoSemana | null;
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
  upgradeEquip: (tipo: Equip["tipo"]) => boolean;
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
  apagar: (slotId: string) => void;
  sair: () => void;
}

// iLvl dos drops conforme o MMR do jogador (elo mais alto → itens melhores).
function iLvlDe(c: CareerState): number {
  return Math.max(10, Math.min(60, Math.round((c.player.rankSoloq.mmr - 800) / 50) + 10));
}

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

  iniciarCarreira: (player, opcoes) => {
    const career = inicializarTempo(criarCareerState(player, opcoes), Date.now());
    const slotId = gerarId();
    salvarSlot(slotId, career);
    definirSlotAtual(slotId);
    set({ career, slotId });
    return slotId;
  },

  carregar: (slotId) => {
    const slot = lerSlot(slotId);
    if (!slot) return false;
    definirSlotAtual(slotId);
    const state = inicializarTempo(slot.state, Date.now()); // garante relógios de recarga
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
    let novo = gastarEnergiaSoloq(aplicarResultado(career, resultado));
    if (resultado.vitoria) novo = { ...novo, dinheiro: novo.dinheiro + bonusVitoria(career) };
    novo = comConquistas(novo);
    useCerimonias.getState().emitir(cerimoniaDeElo(career.player.rankSoloq.elo, novo.player.rankSoloq.elo));
    void useProfile.getState().ajustar(resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota, "partida");
    if (resultado.vitoria) void useInventory.getState().dropDePartida(iLvlDe(career));
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

    set({ career: novo, ultimoResumo: resumo });
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

  upgradeEquip: (tipo) => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = upgradeEquipEngine(career, tipo);
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
    const semRank = { ...resultado, lpDelta: 0 }; // partida oficial não mexe no elo de soloq
    let novo = aplicarResultado(c0, semRank); // partida de campeonato NÃO gasta energia
    if (resultado.vitoria) novo = { ...novo, dinheiro: novo.dinheiro + bonusVitoria(c0) };
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    novo = registrarResultadoJogador(novo, resultado.vitoria, seed);
    void useProfile.getState().ajustar(resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota, "liga");
    if (resultado.vitoria) void useInventory.getState().dropDePartida(iLvlDe(c0), 0.05);
    usePasse.getState().progredir("jogar");
    usePasse.getState().progredir("campeonato");
    if (resultado.vitoria) usePasse.getState().progredir("vencer");
    novo = consumirCarga(novo, agora);
    novo = comConquistas(novo);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  aplicarPartidaEvento: (resultado) => {
    const { career: c0, slotId } = get();
    if (!c0 || !c0.eventoAtual) return;
    const career = sincronizarEnergia(c0, Date.now());
    const premio = premioEvento(career.eventoAtual!, resultado.vitoria);
    const semRank = { ...resultado, lpDelta: 0 }; // evento não mexe no elo
    let novo = gastarEnergiaSoloq(aplicarResultado(career, semRank));
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
    let novo = aplicarResultado(c0, semRank); // campeonato NÃO gasta energia
    if (resultado.vitoria) novo = { ...novo, dinheiro: novo.dinheiro + bonusVitoria(c0) };
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    novo = avancarTorneio(novo, resultado.vitoria, seed);
    void useProfile.getState().ajustar(resultado.vitoria ? GACHA.porVitoria : GACHA.porDerrota, "torneio");
    if (resultado.vitoria) void useInventory.getState().dropDePartida(iLvlDe(c0), 0.05);
    usePasse.getState().progredir("jogar");
    usePasse.getState().progredir("campeonato");
    if (resultado.vitoria) usePasse.getState().progredir("vencer");
    novo = consumirCarga(novo, agora);
    novo = comConquistas(novo);
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
