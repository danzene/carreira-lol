"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COUNTERS } from "@/engine/counters";
import { construirBanco } from "@/engine/champions";
import type { ChampionDef, Classe } from "@/engine/types";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";

// ⚖️ Aba COUNTERS: quem countera quem (classe vs classe) + os campeões de cada
// classe — pra planejar o draft sabendo o matchup da sua lane.

const INFO_CLASSE: Record<Classe, { nome: string; emoji: string; cor: string; dica: string }> = {
  ASSASSINO: { nome: "Assassino", emoji: "🗡️", cor: "#ff2d7e", dica: "explode a backline" },
  MAGO: { nome: "Mago", emoji: "🔮", cor: "#9a6bff", dica: "poke e dano em área" },
  ATIRADOR: { nome: "Atirador", emoji: "🏹", cor: "#ffd34d", dica: "DPS contínuo" },
  TANK: { nome: "Tanque", emoji: "🛡️", cor: "#19e6e0", dica: "aguenta e engaja" },
  LUTADOR: { nome: "Lutador", emoji: "⚔️", cor: "#e8762b", dica: "duela e persegue" },
  SUPORTE: { nome: "Suporte", emoji: "💠", cor: "#2fd66e", dica: "peel e escudos" },
};

const CLASSES: Classe[] = ["ASSASSINO", "MAGO", "ATIRADOR", "TANK", "LUTADOR", "SUPORTE"];

// quem me countera = classes que me têm na lista delas
function counteradoPor(classe: Classe): Classe[] {
  return CLASSES.filter((c) => COUNTERS[c].includes(classe));
}

export default function CountersPage() {
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);
  const [classeAberta, setClasseAberta] = useState<Classe | null>(null);

  useEffect(() => {
    let vivo = true;
    buscarCampeoes()
      .then((cs) => vivo && setCampeoes(cs))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const campMap = useMemo(() => new Map(campeoes.map((c) => [c.id, c])), [campeoes]);
  const banco = useMemo<ChampionDef[]>(() => (campeoes.length ? construirBanco(campeoes) : []), [campeoes]);
  const porClasse = useMemo(() => {
    const m = new Map<Classe, ChampionDef[]>();
    for (const cl of CLASSES) m.set(cl, []);
    for (const c of banco) for (const cl of c.classes) m.get(cl)?.push(c);
    for (const cl of CLASSES) m.get(cl)!.sort((a, b) => b.forcaMetaBase - a.forcaMetaBase);
    return m;
  }, [banco]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">⚖️ COUNTERS</h1>
          <p className="mt-1 text-[11px] text-suave">Quem countera quem — planeje o draft pela sua lane</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* como funciona */}
      <div className="border-2 border-borda bg-painel p-3 text-[11px] leading-relaxed text-suave">
        No fim do draft, cada rota compara as <span className="text-texto">classes</span> do seu pick com o pick inimigo:
        counterar dá <span className="text-emerald-400">até +2 na lane</span> (você brilha) e ser counterado dá{" "}
        <span className="text-rosa">até −2</span> (nota/KDA sofrem). A soma das 5 rotas (
        <span className="text-texto">±10</span>) pesa na chance de vitória do time.
      </div>

      {/* matriz de classes */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[11px] text-suave">CLASSE vs CLASSE</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CLASSES.map((cl) => {
            const info = INFO_CLASSE[cl];
            const forte = COUNTERS[cl];
            const fraco = counteradoPor(cl);
            const aberta = classeAberta === cl;
            const champs = porClasse.get(cl) ?? [];
            return (
              <button
                key={cl}
                type="button"
                onClick={() => setClasseAberta(aberta ? null : cl)}
                className={`border-2 p-3 text-left transition ${aberta ? "bg-painel" : "bg-painel/50 hover:bg-painel"}`}
                style={{ borderColor: aberta ? info.cor : "#2a2150" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{info.emoji}</span>
                  <span className="font-pixel text-[12px]" style={{ color: info.cor }}>
                    {info.nome.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-suave">· {info.dica}</span>
                </div>
                <p className="mt-2 text-[11px]">
                  <span className="text-emerald-400">✓ countera:</span>{" "}
                  <span className="text-texto">{forte.map((f) => `${INFO_CLASSE[f].emoji} ${INFO_CLASSE[f].nome}`).join(" · ")}</span>
                </p>
                <p className="mt-1 text-[11px]">
                  <span className="text-rosa">✗ fraco contra:</span>{" "}
                  <span className="text-texto">
                    {fraco.length > 0 ? fraco.map((f) => `${INFO_CLASSE[f].emoji} ${INFO_CLASSE[f].nome}`).join(" · ") : "—"}
                  </span>
                </p>

                {/* campeões da classe (expande) */}
                {aberta && champs.length > 0 && (
                  <div className="mt-3 border-t-2 border-borda pt-2">
                    <p className="mb-1.5 font-pixel text-[9px] text-suave">CAMPEÕES ({champs.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {champs.slice(0, 24).map((c) => {
                        const cam = campMap.get(c.id);
                        return cam ? (
                          <img
                            key={c.id}
                            src={cam.icone}
                            alt={cam.nome}
                            title={`${cam.nome} · ${c.classes.map((x) => INFO_CLASSE[x].nome).join("/")}`}
                            className="h-8 w-8 border border-borda"
                          />
                        ) : null;
                      })}
                      {champs.length > 24 && <span className="self-center text-[10px] text-suave">+{champs.length - 24}</span>}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-center text-[9px] text-suave/70">{aberta ? "▲ fechar" : "▼ ver campeões"}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="border-2 border-borda bg-painel/40 p-3 text-center text-[11px] text-suave">
        💡 Dica: no draft, olhe o pick inimigo da <span className="text-texto">sua rota</span> e escolha uma classe que o
        countere — o painel MATCHUPS mostra o resultado antes de jogar.
      </div>
    </main>
  );
}
