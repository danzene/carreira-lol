import { timeDe } from "@/data/times";
import { criarRng, type Rng } from "./rng";
import type { CareerState, KDA } from "./types";

// 📱 Feed vivo (PURO): o mundo REAGE à sua carreira. Posts procedurais gerados por
// seed a partir dos FATOS da semana — mesma entrada, mesmos posts. Humor > toxicidade:
// até o hater é engraçado, nunca cruel.

export type ArquetipoAutor = "analista" | "torcedor" | "hater" | "noticia" | "meme" | "rival";

export interface AutorFeed {
  handle: string;
  nome: string;
  arquetipo: ArquetipoAutor;
  emoji: string;
}

export interface PostFeed {
  id: string;
  autor: AutorFeed;
  texto: string;
  likes: number; // fake, gerado por seed
  gatilho: string;
  semana: number;
  temporada: number;
}

export interface EntrevistaPendente {
  contexto: "titulo" | "rival" | "campeao_liga";
  adversarioId?: string;
  semana: number;
}

export const AUTORES: Record<Exclude<ArquetipoAutor, "rival">, AutorFeed> = {
  analista: { handle: "@CoachMalta", nome: "Coach Malta", arquetipo: "analista", emoji: "🧠" },
  torcedor: { handle: "@TorcidaDoNexus", nome: "Torcida do Nexus", arquetipo: "torcedor", emoji: "📣" },
  hater: { handle: "@xX_Duvido_Xx", nome: "Duvidador", arquetipo: "hater", emoji: "😏" },
  noticia: { handle: "@EsportsNoticias", nome: "Esports Notícias", arquetipo: "noticia", emoji: "📰" },
  meme: { handle: "@MemeLane", nome: "Meme Lane", arquetipo: "meme", emoji: "🐸" },
};

function autorRival(adversarioId: string): AutorFeed {
  const nome = timeDe(adversarioId)?.nome ?? adversarioId;
  return { handle: `@${nome.replace(/\s+/g, "")}`, nome, arquetipo: "rival", emoji: "😤" };
}

// ---- Fatos da semana (derivados do estado — puro) ----
export interface FatosSemana {
  nome: string;
  elo: string;
  partidas: number;
  vitorias: number;
  derrotas: number;
  streak: number; // sequência atual da soloq
  melhorNota: number;
  melhorKda?: KDA;
  lpLiquido: number;
  dropMitico: boolean;
  campeaoProblema?: { championId: string; derrotas: number }; // 3+ derrotas com o mesmo campeão
  rivalId?: string; // rival ATIVO
  perdeuPraRival: boolean;
  campeaoLiga: boolean; // fechou a liga em 1º nesta semana
  tituloInternacional?: string;
  // Grind de Normais (semana): alimenta NO MÁXIMO 1 post de grind por semana
  grindStreakV: number; // maior sequência de vitórias em normais na semana
  grindStreakD: number; // maior sequência de derrotas
  grindDrops: number; // drops no grind na semana
}

export function fatosDaSemana(c: CareerState): FatosSemana {
  const s = c.statsSemana ?? { partidas: 0, vitorias: 0, melhorNota: 0, lpLiquido: 0, dropsPorRaridade: {} as Record<number, number> };
  // derrotas por campeão nas partidas da semana (histórico é mais-recente-primeiro)
  const daSemana = c.historicoPartidas.slice(0, s.partidas);
  const derrotasPorChamp = new Map<string, number>();
  for (const m of daSemana) if (!m.vitoria) derrotasPorChamp.set(m.championId, (derrotasPorChamp.get(m.championId) ?? 0) + 1);
  const pior = [...derrotasPorChamp.entries()].sort((a, b) => b[1] - a[1])[0];
  const rivalId = Object.entries(c.rivais ?? {}).find(([, r]) => r.ativo)?.[0];

  return {
    nome: c.player.nome,
    elo: c.player.rankSoloq.elo,
    partidas: s.partidas,
    vitorias: s.vitorias,
    derrotas: s.partidas - s.vitorias,
    streak: c.player.rankSoloq.streak ?? 0,
    melhorNota: s.melhorNota,
    melhorKda: s.melhorKda,
    lpLiquido: s.lpLiquido,
    dropMitico: (s.dropsPorRaridade?.[5] ?? 0) > 0,
    campeaoProblema: pior && pior[1] >= 3 ? { championId: pior[0], derrotas: pior[1] } : undefined,
    rivalId,
    perdeuPraRival: !!rivalId, // rival ATIVO = perdeu 2+ seguidas pra ele (definição do sistema)
    campeaoLiga: c.liga?.fase === "ENCERRADA" && c.liga.campeao === "VOCE",
    tituloInternacional: undefined, // setado pelo chamador quando o título sai na semana
    grindStreakV: c.grind?.semana.maiorStreakV ?? 0,
    grindStreakD: c.grind?.semana.maiorStreakD ?? 0,
    grindDrops: c.grind?.semana.drops ?? 0,
  };
}

// ---- Templates (pt-BR) — {placeholders} + 2-3 variações por gatilho ----
type Tpl = { arquetipo: Exclude<ArquetipoAutor, "rival"> | "rival"; textos: string[]; peso: number };

const TEMPLATES: Record<string, Tpl[]> = {
  stomp: [
    { arquetipo: "analista", peso: 70, textos: [
      "Análise fria: {nome} jogou {nota} hoje. Posicionamento impecável, zero erros puníveis. Nível altíssimo.",
      "Revi a VOD do {nome}. Nota {nota}. O timing das rotações foi de outro patamar. Anotem esse nome.",
    ] },
    { arquetipo: "meme", peso: 40, textos: [
      "{nome} jogou tanto que o inimigo abriu ticket no suporte 🐸",
      "cientistas ainda estudam como {nome} fez nota {nota} sem monitor de 500hz",
    ] },
  ],
  sequencia_vitorias: [
    { arquetipo: "torcedor", peso: 80, textos: [
      "{streak} VITÓRIAS SEGUIDAS!!! O {nome} TÁ VOANDO, NINGUÉM SEGURA!!! 🔥🔥🔥",
      "EU FALEI QUE O {nome} ERA DIFERENTE!!! {streak} WINS!!! CHORA HATER!!!",
    ] },
    { arquetipo: "hater", peso: 40, textos: [
      "{streak} vitórias seguidas… contra quem, exatamente? 😏 Quero ver na semana que vem.",
      "ok {nome} tá numa sequência boa. calma que quando cair eu tô aqui pra lembrar vocês.",
    ] },
  ],
  sequencia_derrotas: [
    { arquetipo: "hater", peso: 80, textos: [
      "{streak} derrotas seguidas do {nome}. Não tô rindo… tá bom, tô rindo um pouquinho 😏",
      "alguém checa se o {nome} tá jogando com os pés? {streak} L seguidas. incrível a consistência (de perder).",
    ] },
    { arquetipo: "torcedor", peso: 50, textos: [
      "Fase ruim do {nome}, mas a torcida NÃO ABANDONA!!! Volta mais forte!!! 💪",
      "quem nunca teve uma semana ruim??? confia no processo, {nome}!!!",
    ] },
  ],
  campeao_problema: [
    { arquetipo: "torcedor", peso: 75, textos: [
      "{nome}, com todo respeito: TIRA O {campeao} DA POOL!!! {derrotasChamp} derrotas já!!! POR FAVOR!!!",
      "assinei a petição pra banirem {campeao} da pool do {nome}. {derrotasChamp} derrotas, chega!!!",
    ] },
    { arquetipo: "analista", peso: 45, textos: [
      "Dado da semana: {nome} tem {derrotasChamp} derrotas com {campeao}. A pool precisa de revisão tática.",
    ] },
  ],
  rival_provoca: [
    { arquetipo: "rival", peso: 90, textos: [
      "O {nome} de novo… relaxa, a gente empresta a replay pra você estudar 😤",
      "GG. Avisa quando quiser a revanche, a gente tá sempre por aqui 😤",
      "Respeito o grind do {nome}, mas contra a gente o script é outro.",
    ] },
  ],
  promocao: [
    { arquetipo: "noticia", peso: 85, textos: [
      "OFICIAL: {nome} alcança {elo} após semana de {lp} PDL líquidos. A escalada continua.",
      "{nome} sobe para {elo}. Fontes próximas dizem que o próximo objetivo já está definido.",
    ] },
    { arquetipo: "meme", peso: 60, textos: [
      "{nome} chegou em {elo} e já tá se achando. amamos ver 🐸✨",
    ] },
  ],
  titulo: [
    { arquetipo: "noticia", peso: 100, textos: [
      "MANCHETE: {nome} é CAMPEÃO! Título conquistado e nome cravado na história. 🏆",
      "É CAMPEÃO! {nome} levanta a taça e silencia os céticos. Cobertura completa em instantes.",
    ] },
    { arquetipo: "torcedor", peso: 90, textos: [
      "CAMPEÃOOOOO!!! EU SEMPRE ACREDITEI!!! SEMPRE!!! 🏆😭😭",
    ] },
  ],
  drop_mitico: [
    { arquetipo: "meme", peso: 65, textos: [
      "{nome} dropou item MÍTICO e postou foto do setup em 0.3 segundos 🐸📸",
      "setup do {nome} agora vale mais que meu carro. item mítico??? 😳",
    ] },
  ],
  semana_solida: [
    { arquetipo: "analista", peso: 30, textos: [
      "Semana de {vitorias}V/{derrotas}D do {nome}. Saldo de {lp} PDL. Consistência constrói campeões.",
      "{nome} fechou a semana com {vitorias} vitórias. Sem brilho excessivo, mas o trabalho aparece.",
    ] },
  ],
  grind_maratona: [
    { arquetipo: "torcedor", peso: 70, textos: [
      "O {nome} NÃO SAI DA FILA!!! {grindStreak} normais seguidas ganhas, o cara respira jogo!!! 🔥",
      "olha o grind do {nome}: {grindStreak} vitórias seguidas nas normais. É DISSO que os pros são feitos!!!",
    ] },
    { arquetipo: "meme", peso: 40, textos: [
      "{nome} ganhou {grindStreak} normais seguidas. a cadeira já criou o formato dele 🐸🪑",
    ] },
  ],
  grind_bagre: [
    { arquetipo: "hater", peso: 60, textos: [
      "{grindStreak} derrotas seguidas em NORMAL, {nome}? em normal?? 😏 até o bot da fila tá com pena.",
      "dizem que normal não vale nada. o {nome} levou {grindStreak} L seguidas e concordou na hora 😏",
    ] },
    { arquetipo: "meme", peso: 40, textos: [
      "{nome} perdendo normal em sequência é o meu espírito animal 🐸",
    ] },
  ],
  grind_farm: [
    { arquetipo: "meme", peso: 55, textos: [
      "{nome} tá farmando até dormindo: dropou item na fila de normal 🐸💤🎒",
      "o setup do {nome} se monta sozinho — mais um item saído do grind de normais 📦",
    ] },
  ],
};

function preencher(tpl: string, f: FatosSemana): string {
  return tpl
    .replace(/\{nome\}/g, f.nome)
    .replace(/\{elo\}/g, f.elo)
    .replace(/\{nota\}/g, f.melhorNota.toFixed(1))
    .replace(/\{streak\}/g, String(Math.abs(f.streak)))
    .replace(/\{vitorias\}/g, String(f.vitorias))
    .replace(/\{derrotas\}/g, String(f.derrotas))
    .replace(/\{lp\}/g, `${f.lpLiquido >= 0 ? "+" : ""}${f.lpLiquido}`)
    .replace(/\{campeao\}/g, f.campeaoProblema?.championId ?? "?")
    .replace(/\{derrotasChamp\}/g, String(f.campeaoProblema?.derrotas ?? 0))
    .replace(/\{grindStreak\}/g, String(Math.max(f.grindStreakV, f.grindStreakD)))
    .replace(/\{kda\}/g, f.melhorKda ? `${f.melhorKda.k}/${f.melhorKda.d}/${f.melhorKda.a}` : "?");
}

// Gatilhos ativos + relevância (dirige a seleção e os likes).
function gatilhosAtivos(f: FatosSemana): { gatilho: string; relevancia: number }[] {
  const out: { gatilho: string; relevancia: number }[] = [];
  if (f.tituloInternacional || f.campeaoLiga) out.push({ gatilho: "titulo", relevancia: 100 });
  if (f.lpLiquido >= 80) out.push({ gatilho: "promocao", relevancia: 85 });
  if (f.melhorNota >= 8.5) out.push({ gatilho: "stomp", relevancia: 70 });
  if (f.streak >= 3) out.push({ gatilho: "sequencia_vitorias", relevancia: 60 + f.streak * 3 });
  if (f.streak <= -3) out.push({ gatilho: "sequencia_derrotas", relevancia: 55 });
  if (f.campeaoProblema) out.push({ gatilho: "campeao_problema", relevancia: 50 });
  if (f.perdeuPraRival && f.rivalId) out.push({ gatilho: "rival_provoca", relevancia: 65 });
  if (f.dropMitico) out.push({ gatilho: "drop_mitico", relevancia: 45 });
  // grind: relevância BAIXA e NO MÁXIMO 1 gatilho (o grind não pode dominar o feed)
  if (f.grindStreakV >= 5) out.push({ gatilho: "grind_maratona", relevancia: 40 });
  else if (f.grindStreakD >= 5) out.push({ gatilho: "grind_bagre", relevancia: 35 });
  else if (f.grindDrops > 0) out.push({ gatilho: "grind_farm", relevancia: 28 });
  if (f.partidas >= 4 && out.length === 0) out.push({ gatilho: "semana_solida", relevancia: 25 });
  return out.sort((a, b) => b.relevancia - a.relevancia);
}

function montarPost(gatilho: string, relevancia: number, f: FatosSemana, c: CareerState, rng: Rng): PostFeed | null {
  const tpls = TEMPLATES[gatilho];
  if (!tpls || tpls.length === 0) return null;
  const tpl = tpls[Math.floor(rng() * tpls.length)];
  const autor = tpl.arquetipo === "rival" ? autorRival(f.rivalId ?? "RIVAL") : AUTORES[tpl.arquetipo];
  const texto = preencher(tpl.textos[Math.floor(rng() * tpl.textos.length)], f);
  const likes = Math.round((relevancia * 3 + rng() * relevancia * 8) / 5) * 5; // fake, escala com relevância
  return {
    id: `post_${c.temporada}_${c.semanaAtual}_${gatilho}_${Math.floor(rng() * 1e6).toString(36)}`,
    autor,
    texto,
    likes,
    gatilho,
    semana: c.semanaAtual,
    temporada: c.temporada,
  };
}

// Gera os posts da semana (2–5 quando há assunto; 0 em semana morta). Determinístico por seed.
export function gerarPostsFeed(c: CareerState, fatos: FatosSemana, seed: number): PostFeed[] {
  const rng = criarRng(seed >>> 0);
  const ativos = gatilhosAtivos(fatos);
  if (ativos.length === 0) return [];
  const max = Math.min(5, Math.max(2, ativos.length));
  const posts: PostFeed[] = [];
  for (const g of ativos.slice(0, max)) {
    const p = montarPost(g.gatilho, g.relevancia, fatos, c, rng);
    if (p) posts.push(p);
  }
  return posts.slice(0, 5);
}

// ---- Entrevista pós-jogo (dilema leve, máx. 1 por semana) ----
export type TomResposta = "humilde" | "confiante" | "provocadora";

export const FALAS_ENTREVISTA: Record<TomResposta, string[]> = {
  humilde: [
    "Foi mérito do time inteiro. Eu só fiz a minha parte.",
    "Ainda tenho muito a melhorar. Hoje deu certo, amanhã é outro treino.",
  ],
  confiante: [
    "A gente treinou pra isso. O resultado era questão de tempo.",
    "Eu sabia que ia dar certo. Confiança no nosso jogo.",
  ],
  provocadora: [
    "Sinceramente? Esperava mais deles. Que venham mais fortes na próxima.",
    "Se eu fosse eles, mudava de estratégia... ou de jogo.",
  ],
};

export function chaveSemana(c: CareerState): number {
  return c.temporada * 1000 + c.semanaAtual;
}

export function podeEntrevistar(c: CareerState): boolean {
  return c.ultimaEntrevistaChave !== chaveSemana(c) && !c.entrevistaPendente;
}

export function abrirEntrevista(c: CareerState, contexto: EntrevistaPendente["contexto"], adversarioId?: string): CareerState {
  if (!podeEntrevistar(c)) return c;
  return { ...c, entrevistaPendente: { contexto, adversarioId, semana: c.semanaAtual } };
}

// Responde a entrevista: efeitos pequenos e claros + a fala vira post no feed.
export function responderEntrevista(c: CareerState, tom: TomResposta, seed: number): { career: CareerState; post: PostFeed } {
  const rng = criarRng(seed >>> 0);
  const pend = c.entrevistaPendente;
  const fala = FALAS_ENTREVISTA[tom][Math.floor(rng() * FALAS_ENTREVISTA[tom].length)];
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));

  let player = c.player;
  let rivais = c.rivais;
  if (tom === "humilde") {
    player = { ...player, reputacao: clamp(player.reputacao + 2), moral: clamp(player.moral + 5) };
  } else if (tom === "confiante") {
    player = { ...player, reputacao: clamp(player.reputacao + 4) };
  } else {
    // provocadora: mais holofote, mas cria/intensifica rivalidade com o adversário
    player = { ...player, reputacao: clamp(player.reputacao + 5) };
    if (pend?.adversarioId) {
      rivais = { ...rivais, [pend.adversarioId]: { derrotas: 2, vitoriasContra: 0, ativo: true } };
    }
  }

  const post: PostFeed = {
    id: `post_entrevista_${chaveSemana(c)}_${Math.floor(rng() * 1e6).toString(36)}`,
    autor: AUTORES.noticia,
    texto: `${c.player.nome}, em entrevista: "${fala}"`,
    likes: Math.round((30 + rng() * 120) / 5) * 5,
    gatilho: `entrevista_${tom}`,
    semana: c.semanaAtual,
    temporada: c.temporada,
  };

  const career: CareerState = {
    ...c,
    player,
    rivais,
    entrevistaPendente: undefined,
    ultimaEntrevistaChave: chaveSemana(c),
    feed: [post, ...(c.feed ?? [])].slice(0, 30),
    feedNovos: (c.feedNovos ?? 0) + 1,
  };
  return { career, post };
}
