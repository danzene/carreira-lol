"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import PainelSemana from "@/components/PainelSemana";
import HistoricoPartidas from "@/components/HistoricoPartidas";
import ResumoSemanaModal from "@/components/ResumoSemanaModal";
import DailyHub from "@/components/DailyHub";
import RecapSemanal from "@/components/RecapSemanal";
import { timeDe } from "@/data/times";
import { proximoConfrontoJogador } from "@/engine/liga";
import { versaoPatch } from "@/engine/patch";
import type { CareerState } from "@/engine/types";
import { useCareer } from "@/store/careerStore";
import { useProfile } from "@/store/profileStore";
import { useInventory } from "@/store/inventoryStore";
import { usePasse } from "@/store/passeStore";
import { nivelDoPasse } from "@/engine/passe";
import { getBadges } from "@/engine/badges";
import { chaveDia } from "@/engine/diario";
import { defUnlock, featureLiberada, type FeatureId } from "@/engine/unlocks";

export default function DashboardPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const sincronizarLiga = useCareer((s) => s.sincronizarLiga);
  const ultimoResumo = useCareer((s) => s.ultimoResumo);
  const limparResumo = useCareer((s) => s.limparResumo);
  const recapSemanal = useCareer((s) => s.recapSemanal);
  const limparRecap = useCareer((s) => s.limparRecap);
  const registrarLogin = useCareer((s) => s.registrarLogin);
  const sair = useCareer((s) => s.sair);
  const coinpoints = useProfile((s) => s.perfil?.coinpoints ?? 0);
  const novosItens = useInventory((s) => s.novos);
  const passe = usePasse((s) => s.passe);
  const badges = getBadges(career, passe, novosItens, chaveDia(Date.now()));

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  useEffect(() => {
    sincronizarLiga();
  }, [sincronizarLiga]);

  // primeira abertura do dia → registra o streak e abre o Daily Hub
  useEffect(() => {
    if (career) registrarLogin();
  }, [career, registrarLogin]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-pixel text-sm text-ciano">DASHBOARD</h1>
        <button
          type="button"
          onClick={() => {
            sair();
            router.push("/");
          }}
          className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto"
        >
          Trocar carreira
        </button>
      </header>

      <PainelSemana career={career} />

      <PlayerCard career={career} />

      <HistoricoPartidas partidas={career.historicoPartidas} />

      <LigaBanner career={career} />

      {career.torneioAtual && (
        <CardNav
          href="/torneio"
          icone="🌍"
          titulo={career.torneioAtual.nome.toUpperCase()}
          sub={career.torneioAtual.bracket.fase === "ENCERRADA" ? "veja o resultado" : "partida internacional te esperando"}
          cor="ambar"
        />
      )}

      {career.eventoAtual && (
        <CardNav href="/draft?evento=1" icone="⭐" titulo={`EVENTO: ${career.eventoAtual.nome}`} sub="desafio especial disponível" cor="ambar" />
      )}

      <CardNav href="/patch" icone="🧪" titulo={`PATCH ${versaoPatch(career.patchVigente)}`} sub="ver mudanças do meta" cor="neutro" />

      {featureLiberada(career, "booster") ? (
        <CardNav
          href="/gacha"
          icone="🎰"
          titulo="CARREIRA BOOSTER"
          sub={`🪙 ${coinpoints} CoinPoints${badges.booster ? " · puxada grátis hoje!" : ""}`}
          cor="rosa"
          ponto={badges.booster}
        />
      ) : (
        <Cadeado id="booster" />
      )}

      {featureLiberada(career, "passe") ? (
        <CardNav
          href="/passe"
          icone="🎟️"
          titulo="PASSE DE BATALHA"
          sub={passe ? `nível ${nivelDoPasse(passe.pp)} de 60` : "missões e recompensas"}
          cor="ambar"
          contagem={badges.passe}
        />
      ) : (
        <Cadeado id="passe" />
      )}

      {featureLiberada(career, "online") ? (
        <CardNav href="/online" icone="⚔️" titulo="ONLINE · DUELO 1v1" sub="enfrente players reais" cor="ciano" />
      ) : (
        <Cadeado id="online" />
      )}

      <div className="grid grid-cols-2 gap-2">
        {featureLiberada(career, "loja") ? (
          <Link
            href="/loja"
            className="border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[11px] text-ciano transition hover:border-ciano"
          >
            💰 LOJA
          </Link>
        ) : (
          <Cadeado id="loja" compacto />
        )}
        <Link
          href="/propostas"
          className={`border-2 px-2 py-3 text-center font-pixel text-[11px] transition ${
            career.inbox.length > 0
              ? "border-ciano bg-ciano/10 text-ciano"
              : "border-borda bg-painel text-ciano hover:border-ciano"
          }`}
        >
          📨 {career.inbox.length > 0 ? `(${career.inbox.length})` : "INBOX"}
        </Link>
        <Link
          href="/campeoes"
          className="border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[11px] text-ciano transition hover:border-ciano"
        >
          📋 TIER
        </Link>
        <Link
          href="/counters"
          className="border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[11px] text-ciano transition hover:border-ciano"
        >
          ⚖️ COUNTERS
        </Link>
        <Link
          href="/hall"
          className="border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[11px] text-ciano transition hover:border-ciano"
        >
          🏛️ HALL
        </Link>
        {featureLiberada(career, "itens") ? (
          <Link
            href="/inventario"
            className="relative border-2 border-borda bg-painel px-2 py-3 text-center font-pixel text-[11px] text-ciano transition hover:border-ciano"
          >
            🎒 INVENTÁRIO
            {badges.inventario > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] animate-pulse place-items-center border-2 border-fundo bg-rosa px-1 font-pixel text-[10px] text-fundo">
                {badges.inventario}
              </span>
            )}
          </Link>
        ) : (
          <Cadeado id="itens" compacto />
        )}
      </div>

      <p className="text-center font-pixel text-[10px] text-borda">CARREIRA LoL · v1.0 🏁</p>
      <p className="text-center text-xs">
        <Link href="/" className="text-ciano hover:underline">
          Início
        </Link>
      </p>

      {/* ordem: recap "wrapped" primeiro → depois o resumo da semana → Daily Hub por cima de tudo */}
      {recapSemanal ? (
        <RecapSemanal recap={recapSemanal} onFechar={limparRecap} />
      ) : (
        ultimoResumo && <ResumoSemanaModal resumo={ultimoResumo} onFechar={limparResumo} />
      )}
      <DailyHub />
    </main>
  );
}

// Card de NAVEGAÇÃO: ícone grande à esquerda, título, subtítulo de contexto e badge.
// (Ação principal = JOGAR, no PainelSemana; aqui é navegação — hierarquia distinta.)
const CORES_CARD = {
  rosa: "border-rosa bg-rosa/10",
  ciano: "border-ciano bg-ciano/10",
  ambar: "border-amber-300 bg-amber-300/10",
  neutro: "border-borda bg-painel hover:border-ciano",
} as const;
const TITULO_CARD = { rosa: "text-rosa", ciano: "text-ciano", ambar: "text-amber-300", neutro: "text-ciano" } as const;

function CardNav({
  href,
  icone,
  titulo,
  sub,
  cor,
  contagem = 0,
  ponto = false,
}: {
  href: string;
  icone: string;
  titulo: string;
  sub: string;
  cor: keyof typeof CORES_CARD;
  contagem?: number;
  ponto?: boolean;
}) {
  return (
    <Link href={href} className={`relative flex items-center gap-3 border-2 px-4 py-3 transition hover:brightness-125 ${CORES_CARD[cor]}`}>
      <span className="text-2xl">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-pixel text-[11px] ${TITULO_CARD[cor]}`}>{titulo}</span>
        <span className="block truncate text-[11px] text-suave">{sub}</span>
      </span>
      <span className="font-pixel text-[10px] text-suave">▸</span>
      {contagem > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] animate-pulse place-items-center border-2 border-fundo bg-rosa px-1 font-pixel text-[10px] text-fundo">
          {contagem}
        </span>
      )}
      {ponto && contagem === 0 && <span className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 animate-pulse border-2 border-fundo bg-rosa" />}
    </Link>
  );
}

// Feature ainda bloqueada: banner com cadeado + condição de destravar.
function Cadeado({ id, compacto = false }: { id: FeatureId; compacto?: boolean }) {
  const u = defUnlock(id);
  return (
    <div className={`border-2 border-borda bg-painel/40 text-center opacity-75 ${compacto ? "px-2 py-3" : "px-4 py-3"}`}>
      <p className="font-pixel text-[11px] text-suave">🔒 {u.nome.toUpperCase()}</p>
      <p className="mt-1 text-[10px] text-suave">{u.condicao}</p>
    </div>
  );
}

function LigaBanner({ career }: { career: CareerState }) {
  const liga = career.liga;
  const adv = proximoConfrontoJogador(liga);
  let texto: string;
  if (!career.contratoAtual) texto = "sem time — veja as propostas";
  else if (!liga) texto = "—";
  else if (liga.fase === "ENCERRADA") texto = "temporada encerrada · veja o resultado";
  else if (adv) texto = `próx: vs ${timeDe(adv)?.nome ?? adv}`;
  else texto = liga.fase === "PLAYOFFS" ? "playoffs em disputa!" : "temporada em andamento";
  const destaque = !!adv || liga?.fase === "ENCERRADA";
  return <CardNav href="/liga" icone="🏆" titulo="LIGA" sub={texto} cor={destaque ? "rosa" : "neutro"} />;
}
