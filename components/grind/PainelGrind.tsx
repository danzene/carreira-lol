"use client";

import { useState } from "react";
import { COLECAO_GRIND, TALENTOS, defTalento, type RamoTalento } from "@/data/grindProposito";
import type { EstadoGrind } from "@/engine/grind";
import { bloqueioTalento, custoTalento, modsGrind } from "@/engine/grindProposito";
import { tocarSom } from "@/lib/som";
import { useCareer } from "@/store/careerStore";

// 🎯 Abas do painel expandido do grind: RESUMO (partidas do dia), TALENTOS (árvore
// 3×5), COLEÇÃO (cosméticos). Estilo pixel coerente; comprar/equipar tem micro-juice
// e o efeito aparece na cena na hora (o store atualiza o save → os efeitos da cena
// re-sincronizam via os useEffect do DioramaGrind).

type Aba = "resumo" | "talentos" | "colecao";
const RAMOS: { id: RamoTalento; nome: string; emoji: string }[] = [
  { id: "combate", nome: "Combate", emoji: "⚔️" },
  { id: "fortuna", nome: "Fortuna", emoji: "💰" },
  { id: "sorte", nome: "Sorte", emoji: "🍀" },
];

export default function PainelGrind({ g, resumo }: { g: EstadoGrind; resumo: React.ReactNode }) {
  const [aba, setAba] = useState<Aba>("resumo");
  const comprar = useCareer((s) => s.comprarTalento);
  const respec = useCareer((s) => s.respecTalentos);
  const equipar = useCareer((s) => s.equiparCosmetico);
  const [confirmarRespec, setConfirmarRespec] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const mods = modsGrind(g.talentos);
  const colecaoX = g.cosmeticos.length;

  return (
    <div>
      {/* abas */}
      <div className="mb-2 flex gap-1 border-b border-borda">
        {(["resumo", "talentos", "colecao"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`px-2 py-1 font-pixel text-[8px] transition ${aba === a ? "border-b-2 border-ciano text-ciano" : "text-suave hover:text-texto"}`}
          >
            {a === "resumo" ? "RESUMO" : a === "talentos" ? "TALENTOS" : `COLEÇÃO ${colecaoX}/${COLECAO_GRIND.length}`}
          </button>
        ))}
        <span className="ml-auto self-center font-pixel text-[9px] text-[#b9c2d0]" title="Sucata — moeda exclusiva do grind">
          🔩 {g.sucata}
        </span>
      </div>

      {aba === "resumo" && resumo}

      {/* ⚔️💰🍀 ÁRVORE DE TALENTOS */}
      {aba === "talentos" && (
        <div>
          <div className="grid grid-cols-3 gap-1.5">
            {RAMOS.map((ramo) => (
              <div key={ramo.id} className="flex flex-col gap-1">
                <p className="text-center font-pixel text-[8px] text-suave">
                  {ramo.emoji} {ramo.nome.toUpperCase()}
                </p>
                {TALENTOS.filter((t) => t.ramo === ramo.id).map((t) => {
                  const nivel = g.talentos[t.id] ?? 0;
                  const bloqueio = bloqueioTalento(g.talentos, g.sucata, t.id);
                  const custo = nivel < t.nivelMax ? custoTalento(t, nivel) : 0;
                  const valorProx = valorEfeito(t.id, nivel + 1);
                  const maxed = nivel >= t.nivelMax;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={bloqueio !== null}
                      onClick={() => {
                        if (comprar(t.id)) {
                          tocarSom("moeda", 0.5);
                          setFlash(t.id);
                          setTimeout(() => setFlash((f) => (f === t.id ? null : f)), 400);
                        }
                      }}
                      title={t.desc.replace("{v}", valorProx)}
                      className={`flex flex-col items-start gap-0.5 border-2 p-1 text-left transition ${
                        maxed ? "border-amber-300/60 bg-amber-300/5" : bloqueio === "prereq" ? "border-borda/50 opacity-40" : "border-borda hover:border-ciano"
                      } ${flash === t.id ? "!border-ciano bg-ciano/15" : ""}`}
                    >
                      <span className="flex w-full items-center justify-between text-[10px]">
                        <span className="truncate text-texto">{t.nome}</span>
                        <span className="ml-1 shrink-0 font-pixel text-[8px] text-suave">
                          {nivel}/{t.nivelMax}
                        </span>
                      </span>
                      <span className="text-[9px] text-emerald-400">{t.desc.replace("{v}", valorProx)}</span>
                      <span className={`font-pixel text-[8px] ${bloqueio === "sucata" ? "text-rosa" : maxed ? "text-amber-300" : "text-[#b9c2d0]"}`}>
                        {maxed ? "MÁX" : bloqueio === "prereq" ? "🔒 requer o de cima" : `🔩 ${custo}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-suave">
            <span title="Velocidade encena mais partidas dentro do teto; ouro/sucata rendem mais por partida.">
              vel. {(1 - mods.duracaoMult) > 0 ? `+${Math.round((1 - mods.duracaoMult) * 100)}%` : "—"} · ouro +{Math.round((mods.goldMult - 1) * 100)}% · sucata +{Math.round((mods.sucataMult - 1) * 100)}%
            </span>
            {confirmarRespec ? (
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => { respec(); setConfirmarRespec(false); }} className="border border-rosa px-1.5 font-pixel text-[8px] text-rosa hover:bg-rosa hover:text-fundo">
                  CONFIRMAR
                </button>
                <button type="button" onClick={() => setConfirmarRespec(false)} className="text-[10px] text-suave hover:text-texto">
                  cancelar
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmarRespec(true)} className="text-[10px] text-suave underline-offset-2 hover:text-texto hover:underline" title="Devolve toda a Sucata investida (grátis)">
                ♻ respec grátis
              </button>
            )}
          </div>
        </div>
      )}

      {/* 🎨 COLEÇÃO DO GRIND */}
      {aba === "colecao" && (
        <div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {COLECAO_GRIND.map((cosm) => {
              const tem = g.cosmeticos.includes(cosm.id);
              const equipadoAqui = g.equipado[cosm.tipo] === cosm.id;
              return (
                <button
                  key={cosm.id}
                  type="button"
                  disabled={!tem}
                  onClick={() => equipar(cosm.tipo, equipadoAqui ? undefined : cosm.id)}
                  title={tem ? `${cosm.nome} — ${equipadoAqui ? "clique pra tirar" : "equipar"}` : "??? — cai de baú Lendário"}
                  className={`flex flex-col items-center gap-0.5 border-2 p-1.5 transition ${
                    !tem ? "border-borda/50 bg-fundo/40 opacity-60" : equipadoAqui ? "border-ciano bg-ciano/10" : "border-borda hover:border-suave"
                  }`}
                >
                  <span className="text-lg" style={tem ? { color: cosm.cor } : undefined}>
                    {tem ? cosm.emoji : "🔒"}
                  </span>
                  <span className={`text-center text-[9px] leading-tight ${tem ? "text-texto" : "text-suave"}`}>{tem ? cosm.nome : "???"}</span>
                  {equipadoAqui && <span className="font-pixel text-[7px] text-ciano">EQUIPADO</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-suave">
            Cosméticos (skin, trilha da espada, pet) caem só de <span className="text-amber-300">baú Lendário</span> — puro visual, 1 de cada equipado.
          </p>
        </div>
      )}
    </div>
  );
}

// Rótulo do valor no PRÓXIMO nível (pra descrição "+X%") — deriva da definição do nó.
function valorEfeito(id: string, nivelProx: number): string {
  const t = defTalento(id);
  if (!t) return "";
  const n = Math.min(t.nivelMax, nivelProx);
  const e = t.efeito;
  if (id === "escolha") return "";
  if (e.duracao) return `${Math.round(e.duracao * n * 100)}%`;
  if (e.gold) return `${Math.round(e.gold * n * 100)}%`;
  if (e.sucata) return `${Math.round(e.sucata * n * 100)}%`;
  if (e.barra) return `${Math.round(e.barra * n * 100)}%`;
  if (e.golpeDuplo) return `${Math.round(e.golpeDuplo * n * 100)}%`;
  if (e.raro) return `${Math.round(e.raro * n * 100)}%`;
  if (e.pity) return `${e.pity * n}`;
  if (e.encenacao) return `${Math.round(e.encenacao * n * 100)}%`;
  return "";
}
