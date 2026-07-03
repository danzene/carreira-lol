"use client";

import { useEffect, useMemo, useState } from "react";
import { construirBanco } from "@/engine/champions";
import { aplicarPatch } from "@/engine/patch";
import {
  aplicarEscolha,
  atribuirRotas,
  disponivel,
  draftCompleto,
  escolhaIA,
  forcaComp,
  iniciarDraft,
  passoAtual,
  vocePica,
  type EstadoDraft,
  type ModoDraft,
} from "@/engine/draft";
import { criarRng } from "@/engine/rng";
import { counterComp, counterLanes, type MatchupRota, type PickRota } from "@/engine/counters";
import { proibidosProva, type ProvaSemanal } from "@/engine/prova";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import type { ChampionDef, Role } from "@/engine/types";

export interface LutadorInfo {
  championId: string;
  icone?: string;
  rota: Role;
}

export interface JogarInfo {
  championId: string;
  forcaMetaCampeao: number;
  comp: number;
  compInimigo: number;
  icone?: string;
  timeAzul: LutadorInfo[];
  timeVermelho: LutadorInfo[];
  counterLane: number; // matchup da SUA rota (-2..+2)
  counterComp: number; // counter total da comp (-10..+10)
}

export default function DraftBoard({
  comfort,
  maestria = {},
  reputacao,
  rota,
  patch = 1,
  proibidos = [],
  modo = "soloq",
  prova,
  onJogar,
}: {
  comfort: string[];
  maestria?: Record<string, number>;
  reputacao: number;
  rota: Role;
  patch?: number;
  proibidos?: string[];
  modo?: ModoDraft; // soloq = picks variados (gente real); competitivo = meta-slave
  prova?: ProvaSemanal; // Prova Semanal: modificadores filtram o banco (todos os lados)
  onJogar: (info: JogarInfo) => void;
}) {
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [estado, setEstado] = useState<EstadoDraft>(() => iniciarDraft());
  const [busca, setBusca] = useState("");
  const [pendente, setPendente] = useState<string | null>(null); // pick aguardando escolha de ROTA (flex)
  // RNG seedado por draft (borda) — cada partida tem um "lobby" diferente
  const [rng] = useState(() => criarRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0));

  useEffect(() => {
    buscarCampeoes()
      .then((cs) => {
        setCampeoes(cs);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, []);

  const banco = useMemo(() => {
    let b = aplicarPatch(construirBanco(campeoes), patch);
    if (proibidos.length) b = b.filter((c) => !proibidos.includes(c.id));
    if (prova) {
      // regras da Prova Semanal valem pro lobby INTEIRO (você e a IA)
      const pool = Object.entries(maestria).map(([championId, pontos]) => ({ championId, pontos }));
      const bloqueados = new Set(proibidosProva(prova, pool, b));
      const filtrado = b.filter((c) => !bloqueados.has(c.id));
      if (filtrado.length >= 20) b = filtrado; // garante campeões suficientes pro draft
    }
    return b;
  }, [campeoes, patch, proibidos, prova, maestria]);
  const campMap = useMemo(() => {
    const m: Record<string, Campeao> = {};
    for (const c of campeoes) m[c.id] = c;
    return m;
  }, [campeoes]);
  const defMap = useMemo(() => {
    const m: Record<string, ChampionDef> = {};
    for (const d of banco) m[d.id] = d;
    return m;
  }, [banco]);

  const passo = passoAtual(estado);
  const fim = draftCompleto(estado);
  const seuTurno = passo?.time === "azul" && vocePica(estado, reputacao);

  // auto-avanço (inimigo ou coach)
  useEffect(() => {
    if (banco.length === 0 || fim || seuTurno || !passo) return;
    const comfortDoTime = passo.time === "azul" ? comfort : [];
    const t = setTimeout(() => {
      // seu coach draft "sério" mesmo em soloq quando pega os seus picks (conforto)
      const modoDoPasso = passo.time === "azul" && comfortDoTime.length > 0 ? "competitivo" : modo;
      const escolha = escolhaIA(estado, banco, comfortDoTime, modoDoPasso, rng);
      if (escolha) setEstado((e) => aplicarEscolha(e, escolha));
    }, 650);
    return () => clearTimeout(t);
  }, [estado, banco, fim, seuTurno, passo, comfort, modo, rng]);

  const fc = useMemo(() => (fim ? forcaComp(estado, banco) : null), [fim, estado, banco]);

  // matchups de counter por rota (só quando o draft fecha)
  const matchups = useMemo<MatchupRota[] | null>(() => {
    if (!fim) return null;
    const paraPicks = (ids: string[], fixas: Partial<Record<Role, string>>): PickRota[] =>
      atribuirRotas(ids, defMap, fixas)
        .filter((s): s is { role: Role; id: string } => s.id !== null)
        .map((s) => ({ championId: s.id, rota: s.role }));
    return counterLanes(paraPicks(estado.picks.azul, estado.rotas.azul), paraPicks(estado.picks.vermelho, estado.rotas.vermelho), banco);
  }, [fim, estado, defMap, banco]);
  const seuChamp = useMemo(() => {
    if (!fim) return null;
    const r = atribuirRotas(estado.picks.azul, defMap, estado.rotas.azul).find((s) => s.role === rota)?.id;
    return r ?? estado.picks.azul[0] ?? null;
  }, [fim, estado, defMap, rota]);

  const disponiveis = useMemo(
    () =>
      banco.filter(
        (c) => disponivel(estado, c.id) && c.nome.toLowerCase().includes(busca.trim().toLowerCase()),
      ),
    [banco, estado, busca],
  );

  function escolher(id: string) {
    if (!seuTurno || !disponivel(estado, id)) return;
    // PICK seu: pergunta a ROTA (flex pick — Yasuo ADC? pode). Ban aplica direto.
    if (passo?.fase === "pick") setPendente(id);
    else setEstado((e) => aplicarEscolha(e, id));
  }

  function confirmarPick(rotaEscolhida?: Role) {
    if (!pendente) return;
    setEstado((e) => aplicarEscolha(e, pendente, rotaEscolhida));
    setPendente(null);
  }

  function jogar() {
    if (!fc) return;
    const rolesAzul = atribuirRotas(estado.picks.azul, defMap, estado.rotas.azul);
    const rolesVerm = atribuirRotas(estado.picks.vermelho, defMap, estado.rotas.vermelho);
    const lanes = matchups ?? [];
    const minhaLane = lanes.find((l) => l.rota === rota)?.delta ?? 0;
    const lut = (role: Role, id: string | null): LutadorInfo => ({
      championId: id ?? "",
      icone: id ? campMap[id]?.icone : undefined,
      rota: role,
    });
    const seu = rolesAzul.find((s) => s.role === rota)?.id ?? estado.picks.azul[0] ?? "";
    onJogar({
      championId: seu,
      forcaMetaCampeao: defMap[seu]?.forcaMetaBase ?? 50,
      comp: fc.azul,
      compInimigo: fc.vermelho,
      icone: campMap[seu]?.icone,
      timeAzul: rolesAzul.map((s) => lut(s.role, s.id)),
      timeVermelho: rolesVerm.map((s) => lut(s.role, s.id)),
      counterLane: minhaLane,
      counterComp: counterComp(lanes),
    });
  }

  if (carregando) return <p className="py-8 text-center text-sm text-suave">Carregando campeões…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-2 border-borda bg-painel px-4 py-2">
        <span className="font-pixel text-[11px] text-suave">
          {fim ? "FIM" : passo?.fase === "ban" ? "BANIMENTO" : "ESCOLHA"}
        </span>
        <span className={`font-pixel text-[11px] ${seuTurno ? "text-ciano" : "text-suave"}`}>
          {fim ? "DRAFT COMPLETO" : seuTurno ? "SUA VEZ" : passo?.time === "azul" ? "COACH" : "INIMIGO"}
        </span>
        <span className="font-pixel text-[10px] text-borda">{Math.min(estado.passo + 1, 20)}/20</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Coluna
          nome="SEU TIME"
          cor="text-ciano"
          bans={estado.bans.azul}
          picks={estado.picks.azul}
          campMap={campMap}
          defMap={defMap}
          comfort={comfort}
          ativo={!fim && passo?.time === "azul"}
          fase={passo?.fase}
          fixas={estado.rotas.azul}
        />
        <Coluna
          nome="INIMIGO"
          cor="text-rosa"
          bans={estado.bans.vermelho}
          picks={estado.picks.vermelho}
          campMap={campMap}
          defMap={defMap}
          comfort={[]}
          ativo={!fim && passo?.time === "vermelho"}
          fase={passo?.fase}
        />
      </div>

      {fim && fc && (
        <div className="border-2 border-rosa bg-painel p-4">
          <h2 className="mb-3 font-pixel text-[11px] text-suave">FORÇA DE COMP</h2>
          <Barra nome="Seu time" valor={fc.azul} cor="from-ciano to-ciano" />
          <Barra nome="Inimigo" valor={fc.vermelho} cor="from-rosa to-rosa" />
          <p className="mt-3 text-center text-xs text-texto">
            {fc.azul > fc.vermelho
              ? "Vantagem de draft pro SEU time! 🟦"
              : fc.azul < fc.vermelho
                ? "O inimigo saiu melhor no draft. 🟥"
                : "Draft equilibrado."}
          </p>
          {seuChamp && (
            <p className="mt-2 text-center text-[11px] text-suave">
              Você joga de <span className="text-texto">{campMap[seuChamp]?.nome ?? seuChamp}</span> · Maestria{" "}
              <span className="text-ciano">{Math.round(maestria[seuChamp] ?? 0)}</span>
              {(maestria[seuChamp] ?? 0) >= 60 ? " 🔥 domínio alto, força extra" : (maestria[seuChamp] ?? 0) === 0 ? " (campeão novo)" : ""}
            </p>
          )}

          {/* matchups de counter por rota (classe vs classe, estilo LoL) */}
          {matchups && (
            <div className="mt-3 border-t-2 border-borda pt-3">
              <h3 className="mb-2 font-pixel text-[10px] text-suave">MATCHUPS · COUNTERS</h3>
              <div className="grid grid-cols-5 gap-1">
                {matchups.map((mu) => {
                  const sua = mu.rota === rota;
                  const cor = mu.delta > 0 ? "text-emerald-400" : mu.delta < 0 ? "text-rosa" : "text-suave";
                  return (
                    <div
                      key={mu.rota}
                      className={`flex flex-col items-center gap-0.5 border-2 py-1.5 ${sua ? "border-ciano bg-ciano/10" : "border-borda"}`}
                      title={`${ROTULO_ROLE[mu.rota]}: ${mu.delta > 0 ? "vantagem sua" : mu.delta < 0 ? "você é counterado" : "neutro"}`}
                    >
                      <span className="font-pixel text-[9px] text-suave">{ROTULO_ROLE[mu.rota]}</span>
                      <span className={`font-pixel text-[11px] ${cor}`}>
                        {mu.delta > 0 ? `↑${mu.delta}` : mu.delta < 0 ? `↓${Math.abs(mu.delta)}` : "•"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const minha = matchups.find((l) => l.rota === rota)?.delta ?? 0;
                const total = counterComp(matchups);
                return (
                  <p className="mt-2 text-center text-[11px]">
                    <span className={minha > 0 ? "text-emerald-400" : minha < 0 ? "text-rosa" : "text-suave"}>
                      {minha > 0 ? "⚔ Você COUNTERA sua lane!" : minha < 0 ? "⚠ Você está sendo counterado na lane" : "Sua lane está neutra"}
                    </span>
                    <span className="text-suave"> · comp {total > 0 ? `+${total}` : total} </span>
                  </p>
                );
              })()}
            </div>
          )}
          <button
            type="button"
            onClick={jogar}
            className="mt-4 w-full border-2 border-ciano bg-ciano/10 py-3 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo"
          >
            ▶ JOGAR PARTIDA
          </button>
        </div>
      )}

      {!fim && (
        <div className="flex flex-col gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar campeão…"
            className="border-2 border-borda bg-painel px-3 py-2 text-sm text-texto placeholder:text-suave focus:border-rosa focus:outline-none"
          />
          <div
            className={`grid max-h-[38vh] grid-cols-4 gap-2 overflow-y-auto border-2 border-borda bg-fundo/40 p-2 sm:grid-cols-6 ${
              seuTurno ? "" : "pointer-events-none opacity-50"
            }`}
          >
            {disponiveis.map((c) => {
              const cam = campMap[c.id];
              const conf = comfort.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => escolher(c.id)}
                  title={c.nome}
                  className={`flex flex-col items-center gap-1 border-2 p-1 transition ${
                    conf ? "border-ciano" : "border-transparent hover:border-borda"
                  }`}
                >
                  {cam ? (
                    <img src={cam.icone} alt={c.nome} width={40} height={40} className="h-10 w-10" />
                  ) : (
                    <div className="h-10 w-10 bg-borda" />
                  )}
                  <span className="w-full truncate text-center text-[10px] text-suave">{c.nome}</span>
                  {conf && (maestria[c.id] ?? 0) > 0 && (
                    <span className="font-pixel text-[9px] text-ciano">M{Math.round(maestria[c.id])}</span>
                  )}
                </button>
              );
            })}
          </div>
          {seuTurno && (
            <p className="text-center text-[11px] text-ciano">
              {passo?.fase === "ban" ? "Escolha um campeão para BANIR" : "Escolha seu campeão (★ = sua pool)"}
            </p>
          )}
        </div>
      )}

      {/* FLEX PICK: escolher a rota do campeão (Yasuo ADC? pode!) */}
      {pendente && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4" onClick={() => setPendente(null)}>
          <div className="w-full max-w-xs border-2 border-ciano bg-fundo p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-2">
              {campMap[pendente] && <img src={campMap[pendente].icone} alt="" className="h-10 w-10 border-2 border-ciano" />}
              <div>
                <p className="font-pixel text-[11px] text-texto">{campMap[pendente]?.nome ?? pendente}</p>
                <p className="text-[10px] text-suave">Vai jogar em qual rota?</p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              {TODAS_ROTAS.map((r) => {
                const ocupadaPor = estado.rotas.azul[r];
                const natural = defMap[pendente]?.rolesValidas.includes(r);
                const sua = r === rota;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={!!ocupadaPor}
                    onClick={() => confirmarPick(r)}
                    className={`flex items-center justify-between border-2 px-3 py-2 text-left transition disabled:opacity-40 ${
                      sua ? "border-ciano bg-ciano/10 hover:bg-ciano/20" : "border-borda bg-painel hover:border-suave"
                    }`}
                  >
                    <span className="font-pixel text-[10px] text-texto">
                      {ROTULO_ROLE[r]}
                      {sua && <span className="ml-2 text-ciano">★ VOCÊ JOGA</span>}
                    </span>
                    <span className="text-[10px] text-suave">
                      {ocupadaPor ? `ocupada (${campMap[ocupadaPor]?.nome ?? ocupadaPor})` : natural ? "rota natural" : "fora de rota 😈"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => confirmarPick(undefined)}
                className="border-2 border-borda py-2 font-pixel text-[9px] text-suave transition hover:text-texto"
                title="Deixa o coach decidir a melhor rota"
              >
                🤖 AUTO
              </button>
              <button
                type="button"
                onClick={() => setPendente(null)}
                className="border-2 border-borda py-2 font-pixel text-[9px] text-suave transition hover:text-rosa"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ROTULO_ROLE: Record<Role, string> = { TOP: "TOP", JUNGLE: "JG", MID: "MID", ADC: "ADC", SUPPORT: "SUP" };
const TODAS_ROTAS: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

function Coluna({
  nome,
  cor,
  bans,
  picks,
  campMap,
  defMap,
  comfort,
  ativo,
  fase,
  fixas = {},
}: {
  nome: string;
  cor: string;
  bans: string[];
  picks: string[];
  campMap: Record<string, Campeao>;
  defMap: Record<string, ChampionDef>;
  comfort: string[];
  ativo: boolean;
  fase?: "ban" | "pick";
  fixas?: Partial<Record<Role, string>>;
}) {
  return (
    <div className={`border-2 bg-painel p-3 ${ativo ? "border-rosa" : "border-borda"}`}>
      <p className={`mb-2 font-pixel text-[11px] ${cor}`}>{nome}</p>

      <div className="mb-3 flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const id = bans[i];
          const cam = id ? campMap[id] : undefined;
          const aceso = ativo && fase === "ban" && i === bans.length;
          return (
            <div key={i} className={`h-6 w-6 border bg-fundo ${aceso ? "border-rosa" : "border-borda"}`}>
              {cam && <img src={cam.icone} alt="" width={24} height={24} className="h-full w-full opacity-40 grayscale" />}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        {atribuirRotas(picks, defMap, fixas).map(({ role, id }) => {
          const cam = id ? campMap[id] : undefined;
          const conf = id ? comfort.includes(id) : false;
          return (
            <div
              key={role}
              className={`flex items-center gap-2 border-2 border-borda p-1 ${conf ? "bg-ciano/5" : "bg-fundo/40"}`}
            >
              <span className="w-7 shrink-0 text-center font-pixel text-[9px] text-borda">{ROTULO_ROLE[role]}</span>
              {cam ? (
                <img src={cam.icone} alt="" width={28} height={28} className="h-7 w-7" />
              ) : (
                <div className="h-7 w-7 bg-borda/40" />
              )}
              <span className="truncate text-[11px] text-suave">{cam?.nome ?? ""}</span>
              {conf && <span className="ml-auto text-[10px] text-ciano">★</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Barra({ nome, valor, cor }: { nome: string; valor: number; cor: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-20 shrink-0 text-[12px] text-suave">{nome}</span>
      <div className="h-3 flex-1 border-2 border-borda bg-fundo">
        <div className={`h-full bg-gradient-to-r ${cor}`} style={{ width: `${valor}%` }} />
      </div>
      <span className="w-7 text-right font-pixel text-[10px] text-texto">{valor}</span>
    </div>
  );
}
