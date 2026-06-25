"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AnimacaoGacha, { type CartaRevelada } from "@/components/AnimacaoGacha";
import {
  GACHA,
  LENDAS,
  RARIDADE_HOLO,
  defSub,
  imagemCarta,
  infoRaridade,
  modeloLenda,
} from "@/data/gacha";
import { construirBanco } from "@/engine/champions";
import { efeitoLendas, sinergiasAtivas, type ResultadoPuxada } from "@/engine/gacha";
import type { ChampionDef } from "@/engine/types";
import { buscarCampeoes, type Campeao } from "@/lib/ddragon";
import { useCareer } from "@/store/careerStore";

export default function GachaPage() {
  const router = useRouter();
  const career = useCareer((s) => s.career);
  const recarregar = useCareer((s) => s.recarregarAtual);
  const puxarGacha = useCareer((s) => s.puxarGacha);
  const ganharCampeao = useCareer((s) => s.ganharCampeao);
  const equiparLenda = useCareer((s) => s.equiparLenda);
  const [anim, setAnim] = useState<CartaRevelada[] | null>(null);
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);

  useEffect(() => {
    if (!career && !recarregar()) router.replace("/");
  }, [career, recarregar, router]);

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

  // Limiares de raridade dos campeões (relativos à força do banco — robusto à escala).
  const { t4, t5 } = useMemo(() => {
    if (banco.length === 0) return { t4: 56, t5: 62 };
    const f = banco.map((b) => b.forcaMetaBase).sort((a, b) => a - b);
    const q = (p: number) => f[Math.floor(p * (f.length - 1))];
    return { t4: q(0.6), t5: q(0.9) };
  }, [banco]);
  const raridadeCampeao = (forca: number): number => (forca >= t5 ? 5 : forca >= t4 ? 4 : 3);

  if (!career) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-suave">Carregando…</main>;
  }

  const ps = career.scoutPontos ?? 0;
  const possuidas = new Map((career.lendas ?? []).map((l) => [l.id, l]));
  const equipadas = career.lendasEquipadas ?? [];
  const pool = career.player.pool;
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

  function cartaLenda(r: ResultadoPuxada): CartaRevelada {
    const modelo = modeloLenda(r.id);
    const info = infoRaridade(r.raridade);
    return {
      raridade: r.raridade,
      cor: info.cor,
      cartaImg: imagemCarta(r.id),
      nome: modelo?.nome ?? r.id,
      subtitulo: r.novo ? modelo?.titulo : `${modelo?.titulo ?? ""} · Nv.${r.nivel}`,
      badge: r.novo ? "NOVA" : `Nv.${r.nivel}`,
      substats: r.substats.map((s) => ({ rotulo: defSub(s.chave)?.rotulo ?? s.chave, valor: s.valor })),
      holo: r.raridade >= RARIDADE_HOLO,
      mitica: r.raridade === 6,
    };
  }

  function puxar(qtd: number) {
    const r = puxarGacha(qtd);
    if (r) setAnim(r.map(cartaLenda));
  }

  function puxarCampeao() {
    if (banco.length === 0 || ps < GACHA.custoCampeao) return;
    // campeões mais fortes (meta) são mais raros de cair.
    const maxF = Math.max(...banco.map((b) => b.forcaMetaBase));
    const pesos = banco.map((b) => Math.max(1, maxF - b.forcaMetaBase + 4));
    const total = pesos.reduce((a, b) => a + b, 0);
    let x = Math.random() * total;
    let escolhido = banco[0];
    for (let i = 0; i < banco.length; i++) {
      x -= pesos[i];
      if (x <= 0) {
        escolhido = banco[i];
        break;
      }
    }
    const res = ganharCampeao(escolhido.id);
    if (!res) return;
    const camp = campMap.get(escolhido.id);
    const rar = raridadeCampeao(escolhido.forcaMetaBase);
    setAnim([
      {
        raridade: rar,
        cor: infoRaridade(rar).cor,
        icone: camp?.icone,
        nome: camp?.nome ?? escolhido.nome,
        subtitulo: `Maestria ${res.pontos}/100`,
        badge: res.novo ? "NOVO" : "+MAESTRIA",
      },
    ]);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xs text-ciano">CARREIRA BOOSTER</h1>
          <p className="mt-1 text-[10px] text-suave">
            🪙 {ps} CoinPoints · pity 5★ {career.pity ?? 0}/{GACHA.pity5}
          </p>
        </div>
        <Link href="/dashboard" className="border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:text-texto">
          Voltar
        </Link>
      </header>

      {/* ---- Puxar Lendas ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-rosa">CARTAS DE LENDA</h2>
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
      </section>

      {/* ---- Puxar Campeão ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-amber-300">CARTAS DE CAMPEÃO</h2>
        <button
          type="button"
          disabled={ps < GACHA.custoCampeao || banco.length === 0}
          onClick={puxarCampeao}
          className="border-2 border-amber-300 bg-amber-300/10 py-3 font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo disabled:opacity-40"
        >
          {banco.length === 0 ? "CARREGANDO CAMPEÕES…" : (
            <>
              PUXAR CAMPEÃO <span className="text-[8px]">({GACHA.custoCampeao})</span>
            </>
          )}
        </button>
        <p className="text-[9px] text-suave">
          Cada campeão entra na sua pool e ganha maestria. Repetido sobe a maestria — meta fortes são mais raros.
        </p>
      </section>

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

      {/* ---- Coleção de Lendas ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">COLEÇÃO DE LENDAS</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LENDAS.map((l) => {
            const tem = possuidas.get(l.id);
            const eq = equipadas.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                disabled={!tem}
                onClick={() => equiparLenda(l.id)}
                className={`overflow-hidden border-2 text-left transition ${eq ? "border-ciano ring-2 ring-ciano" : "border-borda"} ${tem && l.raridade === 6 ? "carta-mitica" : ""}`}
              >
                <div className="relative">
                  {tem ? (
                    <>
                      <img src={imagemCarta(l.id)} alt={l.nome} loading="lazy" className="img-hd block aspect-[2/3] w-full" />
                      {l.raridade >= RARIDADE_HOLO && <div className="holo-sheen" />}
                    </>
                  ) : (
                    <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-1 bg-fundo">
                      <span className="font-pixel text-2xl text-borda">?</span>
                      <span className="font-pixel text-[8px] text-suave">{"★".repeat(l.raridade)}</span>
                    </div>
                  )}
                  {eq && <span className="absolute right-1 top-1 bg-ciano px-1 text-[7px] font-bold text-fundo">EQUIP</span>}
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
      </section>

      {/* ---- Coleção de Campeões (pool) ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] text-suave">
          MEUS CAMPEÕES ({pool.length})
        </h2>
        {pool.length === 0 ? (
          <p className="text-[11px] text-suave">Puxe cartas de campeão pra montar sua pool.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {[...pool]
              .sort((a, b) => b.pontos - a.pontos)
              .map((m) => {
                const camp = campMap.get(m.championId);
                return (
                  <div key={m.championId} className="overflow-hidden border-2 border-borda bg-painel">
                    {camp ? (
                      <img src={camp.icone} alt="" className="block aspect-square w-full" />
                    ) : (
                      <div className="aspect-square w-full bg-fundo" />
                    )}
                    <div className="p-1">
                      <p className="truncate text-[9px] text-texto">{camp?.nome ?? m.championId}</p>
                      <div className="mt-0.5 h-1 w-full bg-fundo">
                        <div className="h-full bg-ciano" style={{ width: `${m.pontos}%` }} />
                      </div>
                      <p className="mt-0.5 text-[7px] text-suave">Maestria {m.pontos}/100</p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {anim && <AnimacaoGacha cartas={anim} onFechar={() => setAnim(null)} />}
    </main>
  );
}
