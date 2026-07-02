"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { construirBanco } from "@/engine/champions";
import { alteracoesDoPatch, versaoPatch, type AlteracaoPatch } from "@/engine/patch";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import { useCareer } from "@/store/careerStore";

export default function PatchPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregarAtual = useCareer((s) => s.recarregarAtual);
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!career && !recarregarAtual()) router.replace("/");
  }, [career, recarregarAtual, router]);

  useEffect(() => {
    buscarCampeoes()
      .then((cs) => {
        setCampeoes(cs);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, []);

  const patch = career?.patchVigente ?? 1;
  const campMap = useMemo(() => {
    const m: Record<string, Campeao> = {};
    for (const c of campeoes) m[c.id] = c;
    return m;
  }, [campeoes]);
  const alts = useMemo(() => alteracoesDoPatch(construirBanco(campeoes), patch), [campeoes, patch]);

  const buffs = alts.filter((a) => a.tipo === "buff").sort((a, b) => b.delta - a.delta);
  const nerfs = alts.filter((a) => a.tipo === "nerf").sort((a, b) => a.delta - b.delta);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">PATCH {versaoPatch(patch)}</h1>
          <p className="mt-1 text-[11px] text-suave">Notas fictícias · a meta muda a cada 2 semanas</p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {carregando ? (
        <p className="py-8 text-center text-sm text-suave">Carregando campeões…</p>
      ) : alts.length === 0 ? (
        <p className="border-2 border-borda bg-painel p-5 text-center text-sm text-suave">
          Meta inicial — nenhuma alteração ainda. Avance 2 semanas para o primeiro patch mudar o jogo.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <Secao titulo="🔼 BUFFS" cor="text-ciano" alts={buffs} campMap={campMap} />
          <Secao titulo="🔽 NERFS" cor="text-rosa" alts={nerfs} campMap={campMap} />
        </div>
      )}

      <p className="text-center text-[11px] text-suave">
        Veja como ficou a{" "}
        <Link href="/campeoes" className="text-ciano hover:underline">
          tier list
        </Link>
        .
      </p>
    </main>
  );
}

function Secao({
  titulo,
  cor,
  alts,
  campMap,
}: {
  titulo: string;
  cor: string;
  alts: AlteracaoPatch[];
  campMap: Record<string, Campeao>;
}) {
  return (
    <div className="border-2 border-borda bg-painel p-4">
      <h2 className={`mb-3 font-pixel text-[11px] ${cor}`}>{titulo}</h2>
      <div className="flex flex-col gap-2">
        {alts.map((a) => {
          const cam = campMap[a.championId];
          return (
            <div key={a.championId} className="flex items-center gap-3 border-2 border-borda bg-fundo/40 p-2">
              {cam ? (
                <img src={cam.icone} alt="" width={32} height={32} className="h-8 w-8 border border-borda" />
              ) : (
                <div className="h-8 w-8 bg-borda" />
              )}
              <span className="flex-1 truncate text-sm text-texto">{cam?.nome ?? a.nome}</span>
              <span className={`font-pixel text-[11px] ${a.delta > 0 ? "text-ciano" : "text-rosa"}`}>
                {a.delta > 0 ? `+${a.delta}` : a.delta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
