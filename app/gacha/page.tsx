"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnimacaoGacha from "@/components/AnimacaoGacha";
import RetratoLenda from "@/components/RetratoLenda";
import { GACHA, LENDAS, defSub, infoRaridade } from "@/data/gacha";
import { efeitoLendas, sinergiasAtivas, type ResultadoPuxada } from "@/engine/gacha";
import { useCareer } from "@/store/careerStore";

export default function GachaPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregar = useCareer((s) => s.recarregarAtual);
  const puxarGacha = useCareer((s) => s.puxarGacha);
  const equiparLenda = useCareer((s) => s.equiparLenda);
  const [anim, setAnim] = useState<ResultadoPuxada[] | null>(null);

  useEffect(() => {
    if (!career && !recarregar()) router.replace("/");
  }, [career, recarregar, router]);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const ps = career.scoutPontos ?? 0;
  const possuidas = new Map((career.lendas ?? []).map((l) => [l.id, l]));
  const equipadas = career.lendasEquipadas ?? [];
  const ef = efeitoLendas(career);

  const linhasEf: string[] = [];
  (Object.entries(ef.atributos) as [string, number][]).forEach(([k, v]) => {
    if (v) linhasEf.push(`${defSub(k)?.rotulo ?? k} +${v}`);
  });
  if (ef.xpMult > 1) linhasEf.push(`XP +${Math.round((ef.xpMult - 1) * 100)}%`);
  if (ef.dinheiroMult > 1) linhasEf.push(`Salário +${Math.round((ef.dinheiroMult - 1) * 100)}%`);
  if (ef.reducaoDecaimento > 0) linhasEf.push(`Anti-decaimento ${Math.round(ef.reducaoDecaimento * 100)}%`);
  if (ef.bonusComp > 0) linhasEf.push(`Draft +${ef.bonusComp}`);
  const sinergias = sinergiasAtivas(career);

  function puxar(qtd: number) {
    const r = puxarGacha(qtd);
    if (r) setAnim(r);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-ciano">SCOUT GACHA</h1>
          <p className="mt-1 text-[10px] text-suave">
            ⭐ {ps} Pontos de Scout · pity 5★ {career.pity ?? 0}/{GACHA.pity5}
          </p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={ps < GACHA.custo1}
          onClick={() => puxar(1)}
          className="border-2 border-ciano bg-ciano/10 py-3 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo disabled:opacity-40"
        >
          PUXAR 1× <span className="text-[8px]">({GACHA.custo1})</span>
        </button>
        <button
          type="button"
          disabled={ps < GACHA.custo10}
          onClick={() => puxar(10)}
          className="border-2 border-rosa bg-rosa/10 py-3 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo disabled:opacity-40"
        >
          PUXAR 10× <span className="text-[8px]">({GACHA.custo10})</span>
        </button>
      </div>

      <div className="border-2 border-borda bg-painel p-3">
        <h2 className="mb-2 font-pixel text-[10px] text-suave">
          EFEITOS EQUIPADOS ({equipadas.length}/{GACHA.slots})
        </h2>
        {linhasEf.length === 0 ? (
          <p className="text-[11px] text-suave">Nenhuma lenda equipada. Toque numa carta que você tem pra equipar.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {linhasEf.map((t) => (
              <span key={t} className="border border-ciano/40 bg-ciano/10 px-2 py-0.5 text-[10px] text-ciano">
                {t}
              </span>
            ))}
          </div>
        )}
        {sinergias.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t-2 border-borda pt-2">
            {sinergias.map((t) => (
              <span key={t} className="border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-300">
                ✦ {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LENDAS.map((l) => {
          const tem = possuidas.get(l.id);
          const eq = equipadas.includes(l.id);
          const info = infoRaridade(l.raridade);
          return (
            <button
              key={l.id}
              type="button"
              disabled={!tem}
              onClick={() => equiparLenda(l.id)}
              style={{ borderColor: tem ? info.cor : "#2a2150" }}
              className={`overflow-hidden border-2 text-left transition ${tem ? "" : "opacity-50"} ${eq ? "ring-2 ring-ciano" : ""} ${tem && l.raridade === 6 ? "carta-mitica" : ""}`}
            >
              <div className="relative">
                {tem ? (
                  <RetratoLenda tema={l.tema} cor={info.cor} paleta={l.paleta} className="block aspect-[8/9] w-full" />
                ) : (
                  <div className="flex aspect-[8/9] w-full items-center justify-center bg-fundo font-pixel text-xl text-borda">
                    ?
                  </div>
                )}
                <span
                  className="absolute left-1 top-1 font-pixel text-[8px]"
                  style={{ color: tem ? info.cor : "#9a90c0" }}
                >
                  {"★".repeat(l.raridade)}
                </span>
                {eq && (
                  <span className="absolute right-1 top-1 bg-ciano px-1 text-[7px] font-bold text-fundo">EQUIP</span>
                )}
              </div>
              <div className="bg-painel p-1.5">
                <p className="truncate text-[11px] text-texto">{tem ? l.nome : "???"}</p>
                {tem && (
                  <>
                    <p className="text-[8px] text-suave">
                      {l.estilo} · Nv.{tem.nivel}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {tem.substats.map((s, j) => (
                        <span key={j} className="border border-borda px-0.5 text-[7px] text-suave">
                          {defSub(s.chave)?.rotulo ?? s.chave}+{s.valor}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {anim && <AnimacaoGacha resultados={anim} onFechar={() => setAnim(null)} />}
    </main>
  );
}
