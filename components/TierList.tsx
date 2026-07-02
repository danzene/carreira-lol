"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ROTAS } from "@/data/config";
import { construirBanco } from "@/engine/champions";
import { alteracoesDoPatch, aplicarPatch, versaoPatch } from "@/engine/patch";
import type { ChampionDef, Role } from "@/engine/types";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import { useCareer } from "@/store/careerStore";
import IconeRota from "./IconeRota";

const TIERS: { nome: string; cor: string }[] = [
  { nome: "S", cor: "text-rosa" },
  { nome: "A", cor: "text-ciano" },
  { nome: "B", cor: "text-texto" },
  { nome: "C", cor: "text-suave" },
  { nome: "D", cor: "text-borda" },
];

// Tier RELATIVO à rota: o melhor da rota é S, independente do valor absoluto da meta.
function tierPorRank(i: number, total: number): string {
  if (total <= 0) return "D";
  const p = i / total;
  if (p < 0.08) return "S";
  if (p < 0.25) return "A";
  if (p < 0.5) return "B";
  if (p < 0.78) return "C";
  return "D";
}

export default function TierList() {
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rota, setRota] = useState<Role>("MID");
  const [sel, setSel] = useState<ChampionDef | null>(null);

  // Garante a carreira carregada (senão o patch cairia no fallback e a tier list não mudaria).
  useEffect(() => {
    if (!career) recarregarAtual();
  }, [career, recarregarAtual]);

  useEffect(() => {
    buscarCampeoes()
      .then((cs) => {
        setCampeoes(cs);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, []);

  const patch = career?.patchVigente ?? 1;
  const base = useMemo(() => construirBanco(campeoes), [campeoes]);
  const banco = useMemo(() => aplicarPatch(base, patch), [base, patch]);
  const mudancas = useMemo(() => {
    const m: Record<string, "buff" | "nerf"> = {};
    for (const a of alteracoesDoPatch(base, patch)) m[a.championId] = a.tipo;
    return m;
  }, [base, patch]);
  const campMap = useMemo(() => {
    const m: Record<string, Campeao> = {};
    for (const c of campeoes) m[c.id] = c;
    return m;
  }, [campeoes]);

  const daRota = useMemo(
    () => banco.filter((c) => c.rolesValidas.includes(rota)).sort((a, b) => b.forcaMetaBase - a.forcaMetaBase),
    [banco, rota],
  );
  const porTier = useMemo(() => {
    const g: Record<string, ChampionDef[]> = { S: [], A: [], B: [], C: [], D: [] };
    daRota.forEach((c, i) => g[tierPorRank(i, daRota.length)].push(c));
    return g;
  }, [daRota]);

  if (carregando) return <p className="py-8 text-center text-sm text-suave">Carregando campeões…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/patch" className="text-center font-pixel text-[10px] text-ciano hover:underline">
        META · PATCH {versaoPatch(patch)} · ver notas
      </Link>
      <div className="grid grid-cols-5 gap-2">
        {ROTAS.map((r) => (
          <button
            key={r.chave}
            type="button"
            onClick={() => setRota(r.chave)}
            className={`flex flex-col items-center gap-1 border-2 p-2 transition ${
              rota === r.chave ? "border-rosa bg-rosa/10 text-texto" : "border-borda text-suave hover:border-suave"
            }`}
          >
            <IconeRota rota={r.chave} className="h-5 w-5" />
            <span className="text-[11px]">{r.nome}</span>
          </button>
        ))}
      </div>

      {TIERS.map((t) => {
        const champs = porTier[t.nome];
        if (champs.length === 0) return null;
        return (
          <div key={t.nome} className="border-2 border-borda bg-painel p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className={`font-pixel text-sm ${t.cor}`}>{t.nome}</span>
              <span className="text-[11px] text-suave">({champs.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {champs.map((c) => {
                const cam = campMap[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSel(c)}
                    title={`${c.nome} · ${c.forcaMetaBase}`}
                    className="flex w-12 flex-col items-center gap-1"
                  >
                    <span className="relative">
                      {cam ? (
                        <img src={cam.icone} alt={c.nome} width={40} height={40} className="h-10 w-10 border-2 border-borda hover:border-ciano" />
                      ) : (
                        <span className="block h-10 w-10 border-2 border-borda bg-borda" />
                      )}
                      {mudancas[c.id] && (
                        <span
                          className={`absolute -right-1 -top-1 border border-fundo px-0.5 text-[10px] font-bold leading-none ${
                            mudancas[c.id] === "buff" ? "bg-ciano text-fundo" : "bg-rosa text-fundo"
                          }`}
                        >
                          {mudancas[c.id] === "buff" ? "▲" : "▼"}
                        </span>
                      )}
                    </span>
                    <span className="w-full truncate text-center text-[10px] text-suave">{c.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {sel && <ChampDetail champ={sel} icone={campMap[sel.id]?.icone} onClose={() => setSel(null)} />}
    </div>
  );
}

function ChampDetail({ champ, icone, onClose }: { champ: ChampionDef; icone?: string; onClose: () => void }) {
  const linhas: [string, number][] = [
    ["Dano", champ.perfil.dano],
    ["Resistência", champ.perfil.resistencia],
    ["CC", champ.perfil.cc],
    ["Mobilidade", champ.perfil.mobilidade],
    ["Sustain", champ.perfil.sustain],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fundo/80 p-4" onClick={onClose}>
      <div className="w-full max-w-sm border-2 border-rosa bg-painel p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {icone && <img src={icone} alt="" width={48} height={48} className="h-12 w-12 border-2 border-borda" />}
          <div className="min-w-0">
            <p className="font-pixel text-xs text-texto">{champ.nome}</p>
            <p className="text-[11px] text-suave">{champ.classes.join(" · ")}</p>
          </div>
          <span className="ml-auto font-pixel text-sm text-ciano">{champ.forcaMetaBase}</span>
        </div>

        <p className="mt-3 text-[11px] text-suave">Rotas: {champ.rolesValidas.join(", ")}</p>

        <div className="mt-3 flex flex-col gap-2">
          {linhas.map(([nome, v]) => (
            <div key={nome} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[12px] text-suave">{nome}</span>
              <div className="h-2 flex-1 border border-borda bg-fundo">
                <div className="h-full bg-gradient-to-r from-rosa to-ciano" style={{ width: `${v}%` }} />
              </div>
              <span className="w-7 text-right font-pixel text-[10px] text-texto">{v}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full border-2 border-borda py-2 text-[11px] text-suave transition hover:text-texto"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
