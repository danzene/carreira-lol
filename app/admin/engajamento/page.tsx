"use client";

import { useAdmin } from "@/components/admin/PeriodoContext";
import { AvisoDados, BarChart, Carregando, KpiCard, LineChart, Painel, Secao, Vazio } from "@/components/admin/ui";

type KV = { k: string; v: number };
interface Eng {
  skip_por_tipo: { tipo: string; vista: number; pulada: number; taxa: number }[];
  partidas_por_modo: KV[];
  cartoes_por_tipo: KV[];
  duelos: number;
  provas: number;
  passe_niveis: KV[];
  grind: {
    adocao: { dia: string; ativos: number; grinders: number }[];
    pct_geral: number;
    horas_hist: KV[];
    teto_dias: number;
    diorama?: {
      usuarios_grind: number;
      ocultaram: number;
      pilula: number;
      pip_usuarios: number;
      pip_aberturas: number;
      pip_seg_medio: number;
      expandiram: number;
      reduzidos: number;
    };
    proposito?: {
      baus_por_tier: KV[];
      baus_total: number;
      baus_pity: number;
      talento_usuarios: number;
      talento_pct: number;
      respecs: number;
      cosmeticos_equipados: number;
    };
    expedicao?: {
      usuarios: number;
      pct_dos_grinders: number;
      corridas: number;
      fase_final_hist: KV[];
      escolhas_continuar: number;
      escolhas_recuar: number;
      taxa_continuar: number;
      mortes: number;
      recuos: number;
    };
    jornada?: {
      fase_hist: KV[];
      modo_avancar: number;
      modo_farm: number;
      skills_usuarios: number;
      skills_compradas: number;
      skills_respecs: number;
      desafio_tentativas: number;
      regioes_conquistadas: KV[];
      conquistas_total: number;
    };
  } | null;
  casa: {
    estacao_hist: KV[];
    intensidade_hist: KV[];
    sessoes_total: number;
    usuarios: number;
    burnout_usuarios: number;
    burnout_taxa: number;
    foco_usuarios: number;
    foco_pct: number;
    stream_tipos: KV[];
    analises: number;
  } | null;
}

// Tipos de cerimônia (do EventBus do jogo) → nome legível em PT.
const NOME_CERIMONIA: Record<string, string> = {
  RANK_PROMOTED: "Promoção de elo",
  RANK_DEMOTED: "Queda de elo",
  PASS_LEVEL_UP: "Nível do passe",
  ACHIEVEMENT_UNLOCKED: "Conquista",
  FEATURE_UNLOCKED: "Novo recurso",
  STREAK_MILESTONE: "Marco de streak",
  ITEM_DROPPED: "Drop de item",
  GACHA_PULLED: "Puxada de gacha",
  MISSION_COMPLETED: "Missão concluída",
  RIVAL_DECLARED: "Rivalidade declarada",
  RIVAL_DEFEATED: "Rival superado",
  MENSAGEM: "Mensagem",
};

// Fallback: "ALGO_ASSIM" → "Algo assim" (pra tipos novos que ainda não mapeamos).
function humanizar(chave: string): string {
  const s = chave.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const nomeCerimonia = (t: string) => NOME_CERIMONIA[t] ?? humanizar(t);

const NOME_MODO: Record<string, string> = { soloq: "SoloQ", liga: "Liga", evento: "Evento", torneio: "Torneio" };
const nomeModo = (m: string) => NOME_MODO[m] ?? humanizar(m);

function corTaxa(taxa: number): string {
  if (taxa >= 80) return "text-rose-400";
  if (taxa >= 50) return "text-amber-400";
  return "text-zinc-300";
}

export default function AdminEngajamento() {
  const { dados, carregando, erro } = useAdmin<Eng>("engajamento");
  if (carregando) return <Carregando />;
  if (erro || !dados) return <Vazio msg={erro ? `Erro: ${erro}` : "Sem dados."} />;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-zinc-100">Engajamento</h1>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard rotulo="Duelos" valor={dados.duelos} />
        <KpiCard rotulo="Provas" valor={dados.provas} />
        <KpiCard rotulo="Cartões" valor={dados.cartoes_por_tipo.reduce((s, c) => s + Number(c.v), 0)} />
        <KpiCard rotulo="Partidas" valor={dados.partidas_por_modo.reduce((s, p) => s + Number(p.v), 0)} />
      </div>

      <Secao titulo="Taxa de skip por tipo de cerimônia" sub="Skip alto = a cerimônia atrapalha mais do que recompensa. Base: cerimonia_vista / cerimonia_pulada.">
        <AvisoDados>O evento <code>cerimonia_vista</code> é novo — a taxa só é confiável para o período depois que ele passou a ser emitido.</AvisoDados>
        {dados.skip_por_tipo.length === 0 ? (
          <Vazio msg="Nenhuma cerimônia registrada no período." />
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Vistas</th>
                  <th className="px-3 py-2 text-right">Puladas</th>
                  <th className="px-3 py-2 text-right">Taxa de skip</th>
                </tr>
              </thead>
              <tbody>
                {dados.skip_por_tipo.map((s) => (
                  <tr key={s.tipo} className="border-t border-zinc-800">
                    <td className="px-3 py-1.5 text-zinc-300">{nomeCerimonia(s.tipo)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">{Number(s.vista).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">{Number(s.pulada).toLocaleString("pt-BR")}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${corTaxa(Number(s.taxa))}`}>{Number(s.taxa)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Partidas por modo">
          <Painel>
            <BarChart dados={dados.partidas_por_modo.map((p) => ({ x: nomeModo(p.k), y: Number(p.v), cor: "#38bdf8" }))} altura={170} />
          </Painel>
        </Secao>
        <Secao titulo="Cartões compartilhados por tipo" sub="Uso da feature de compartilhamento.">
          <Painel>
            <BarChart dados={dados.cartoes_por_tipo.map((c) => ({ x: c.k, y: Number(c.v), cor: "#34d399" }))} altura={170} />
          </Painel>
        </Secao>
      </div>

      <Secao titulo="Distribuição de nível do passe" sub="Onde os jogadores estão no passe (nível 60 = completo).">
        <Painel>
          <BarChart dados={dados.passe_niveis.map((n) => ({ x: n.k, y: Number(n.v), cor: "#a78bfa" }))} altura={180} />
        </Painel>
      </Secao>

      <Secao
        titulo="Endgame — Grind de Normais"
        sub="Adoção da camada idle: % dos ativos do dia que usaram o grind e quanto do teto (3h) cada usuário-dia consumiu. É o que diz se a feature reteve ou virou ruído."
      >
        {!dados.grind ? (
          <Vazio msg="Sem dados do grind (rode a migration 016 e aguarde eventos grind_*)." />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <KpiCard rotulo="% ativos que usaram o grind" valor={Number(dados.grind.pct_geral)} formato={(n) => `${n}%`} />
              <KpiCard rotulo="Dias-usuário no teto (3h)" valor={Number(dados.grind.teto_dias)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Painel>
                <p className="mb-1 text-[11px] text-zinc-400">Ativos (azul) vs usaram grind (verde), por dia</p>
                <LineChart dados={dados.grind.adocao.map((a) => ({ x: a.dia.slice(5), y: Number(a.ativos) }))} cor="#38bdf8" altura={120} />
                <LineChart dados={dados.grind.adocao.map((a) => ({ x: a.dia.slice(5), y: Number(a.grinders) }))} cor="#34d399" altura={100} />
              </Painel>
              <Painel>
                <p className="mb-1 text-[11px] text-zinc-400">Horas de grind por usuário-dia (até o teto)</p>
                <BarChart dados={dados.grind.horas_hist.map((h) => ({ x: h.k, y: Number(h.v), cor: "#f59e0b" }))} altura={170} />
              </Painel>
            </div>
            {dados.grind.diorama && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] text-zinc-400">
                  Diorama (vitrine): quem rejeitou a cena (ocultou/pílula) é o sinal mais importante; PiP é o abraço máximo.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <KpiCard rotulo="Ocultaram o diorama" valor={Number(dados.grind.diorama.ocultaram)} />
                  <KpiCard rotulo="Preferiram pílula" valor={Number(dados.grind.diorama.pilula)} />
                  <KpiCard rotulo="Usaram PiP" valor={Number(dados.grind.diorama.pip_usuarios)} />
                  <KpiCard rotulo="PiP: média por sessão" valor={Number(dados.grind.diorama.pip_seg_medio)} formato={(n) => `${Math.round(n / 60)}min`} />
                </div>
              </div>
            )}
            {dados.grind.proposito && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] text-zinc-400">
                  Grind com Propósito: a distribuição de tiers deve bater com 84/15/1% (+pity); adoção da árvore mede o &ldquo;fecha o loop&rdquo;.
                </p>
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <KpiCard rotulo="Baús abertos" valor={Number(dados.grind.proposito.baus_total)} />
                  <KpiCard rotulo="Lendários por pity" valor={Number(dados.grind.proposito.baus_pity)} />
                  <KpiCard rotulo="% do grind com talento" valor={Number(dados.grind.proposito.talento_pct)} formato={(n) => `${n}%`} />
                  <KpiCard rotulo="Respecs" valor={Number(dados.grind.proposito.respecs)} />
                </div>
                <Painel>
                  <p className="mb-1 text-[11px] text-zinc-400">Distribuição real de tiers abertos (esperado: comum ~84% · raro ~15% · lendário ~1%)</p>
                  <BarChart
                    dados={dados.grind.proposito.baus_por_tier.map((t) => ({
                      x: t.k === "lendario" ? "Lendário" : t.k === "raro" ? "Raro" : "Comum",
                      y: Number(t.v),
                      cor: t.k === "lendario" ? "#ffd34d" : t.k === "raro" ? "#38bdf8" : "#71717a",
                    }))}
                    altura={150}
                  />
                </Painel>
              </div>
            )}
            {dados.grind.expedicao && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] text-zinc-400">
                  Expedição (modo ativo): a distribuição de fase-final é a curva de dificuldade REAL; a taxa de continuar mede se o dilema tem dente (perto de 100% = fácil demais; perto de 0% = assustador demais).
                </p>
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <KpiCard rotulo="% dos grinders na Expedição" valor={Number(dados.grind.expedicao.pct_dos_grinders)} formato={(n) => `${n}%`} />
                  <KpiCard rotulo="Corridas" valor={Number(dados.grind.expedicao.corridas)} />
                  <KpiCard rotulo="Taxa de continuar" valor={Number(dados.grind.expedicao.taxa_continuar)} formato={(n) => `${n}%`} />
                  <KpiCard rotulo="Mortes vs recuos" valor={Number(dados.grind.expedicao.mortes)} formato={(n) => `${n} / ${Number(dados.grind!.expedicao!.recuos)}`} />
                </div>
                <Painel>
                  <p className="mb-1 text-[11px] text-zinc-400">Distribuição da fase-final alcançada (a curva de dificuldade real — onde os jogadores param ou morrem)</p>
                  <BarChart
                    dados={dados.grind.expedicao.fase_final_hist.map((f) => ({ x: `F${f.k}`, y: Number(f.v), cor: "#f43f5e" }))}
                    altura={150}
                  />
                </Painel>
              </div>
            )}
            {dados.grind.jornada && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] text-zinc-400">
                  Jornada de Treino: a distribuição de fase mostra a PAREDE real dos jogadores; o funil do Desafio (tentativas → conquistas) mede se o boss está calibrado.
                </p>
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <KpiCard rotulo="Modo: avançar vs farm" valor={Number(dados.grind.jornada.modo_avancar)} formato={(n) => `${n} / ${Number(dados.grind!.jornada!.modo_farm)}`} />
                  <KpiCard rotulo="Usuários com skills" valor={Number(dados.grind.jornada.skills_usuarios)} />
                  <KpiCard rotulo="Tentativas de Desafio" valor={Number(dados.grind.jornada.desafio_tentativas)} />
                  <KpiCard rotulo="Regiões conquistadas" valor={Number(dados.grind.jornada.conquistas_total)} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Painel>
                    <p className="mb-1 text-[11px] text-zinc-400">Onde os jogadores estão (partidas por faixa de fase — a parede real)</p>
                    <BarChart dados={dados.grind.jornada.fase_hist.map((f) => ({ x: f.k, y: Number(f.v), cor: "#38bdf8" }))} altura={150} />
                  </Painel>
                  <Painel>
                    <p className="mb-1 text-[11px] text-zinc-400">Conquistas por gate (10/20/30/40 — o funil de regiões)</p>
                    <BarChart dados={dados.grind.jornada.regioes_conquistadas.map((r) => ({ x: `Boss ${r.k}`, y: Number(r.v), cor: "#ffd34d" }))} altura={150} />
                  </Painel>
                </div>
              </div>
            )}
          </>
        )}
      </Secao>

      <Secao
        titulo="Gaming House — Treino Profundo"
        sub="Uso por estação (estação morta aparece aqui), taxa de burnout (se alta, a fadiga está cruel — recalibrar) e adoção do Foco da Semana."
      >
        {!dados.casa ? (
          <Vazio msg="Sem dados da Gaming House (rode a migration 021 e aguarde eventos sessao_treino)." />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <KpiCard rotulo="Sessões de treino" valor={Number(dados.casa.sessoes_total)} />
              <KpiCard rotulo="Taxa de burnout" valor={Number(dados.casa.burnout_taxa)} formato={(n) => `${n}%`} />
              <KpiCard rotulo="Adoção do Foco" valor={Number(dados.casa.foco_pct)} formato={(n) => `${n}%`} />
              <KpiCard rotulo="Análises de adversário" valor={Number(dados.casa.analises)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Painel>
                <p className="mb-1 text-[11px] text-zinc-400">Sessões por estação (a morta é candidata a rework)</p>
                <BarChart dados={dados.casa.estacao_hist.map((e) => ({ x: nomeEstacao(e.k), y: Number(e.v), cor: "#34d399" }))} altura={170} />
              </Painel>
              <Painel>
                <p className="mb-1 text-[11px] text-zinc-400">Intensidades e tipos de stream</p>
                <BarChart
                  dados={[
                    ...dados.casa.intensidade_hist.map((i) => ({ x: humanizar(i.k), y: Number(i.v), cor: "#f59e0b" })),
                    ...dados.casa.stream_tipos.map((t) => ({ x: `📺 ${humanizar(t.k)}`, y: Number(t.v), cor: "#f43f5e" })),
                  ]}
                  altura={170}
                />
              </Painel>
            </div>
          </>
        )}
      </Secao>
    </div>
  );
}

const NOME_ESTACAO: Record<string, string> = {
  REPLAY_ROOM: "Replay",
  AIM_TRAINER: "Aim",
  CUSTOM_1V1: "1v1",
  SCRIM_SIM: "Scrim",
  CHAMPION_PRACTICE: "Campeão",
  ACADEMIA_SONO_TERAPIA: "Bem-estar",
  SALA_DE_STREAM: "Stream",
  ANALISE_ADVERSARIO: "Análise",
};
const nomeEstacao = (e: string) => NOME_ESTACAO[e] ?? humanizar(e);
