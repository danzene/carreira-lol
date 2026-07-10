"use client";

import { useState } from "react";
import { COLECAO_GRIND, TALENTOS, defTalento, type RamoTalento } from "@/data/grindProposito";
import { SKILLS, defSkill } from "@/data/skills";
import type { EstadoGrind } from "@/engine/grind";
import { bloqueioTalento, custoTalento, modsGrind } from "@/engine/grindProposito";
import { bloqueioSkill, custoSkill, modsSkills } from "@/engine/skills";
import { tocarSom } from "@/lib/som";
import { useCareer } from "@/store/careerStore";

// 🎯 Abas do painel expandido do grind: RESUMO (partidas do dia), TALENTOS (árvore
// 3×5), SKILLS (golpes especiais + 3 slots), COLEÇÃO (cosméticos). Estilo pixel
// coerente; comprar/equipar tem micro-juice e o efeito aparece na cena na hora.

type Aba = "resumo" | "talentos" | "skills" | "colecao";
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
  const comprarSk = useCareer((s) => s.comprarSkill);
  const equiparSk = useCareer((s) => s.equiparSkill);
  const respecSk = useCareer((s) => s.respecSkills);
  const [confirmarRespec, setConfirmarRespec] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [slotAtivo, setSlotAtivo] = useState<number | null>(null); // slot aguardando escolha de skill

  const mods = modsGrind(g.talentos);
  const colecaoX = g.cosmeticos.length;
  const msk = modsSkills(g.skills, g.skillSlots);

  return (
    <div>
      {/* abas */}
      <div className="mb-2 flex gap-1 border-b border-borda">
        {(["resumo", "talentos", "skills", "colecao"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`px-2 py-1 font-pixel text-[8px] transition ${aba === a ? "border-b-2 border-ciano text-ciano" : "text-suave hover:text-texto"}`}
          >
            {a === "resumo" ? "RESUMO" : a === "talentos" ? "TALENTOS" : a === "skills" ? "SKILLS" : `COLEÇÃO ${colecaoX}/${COLECAO_GRIND.length}`}
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

      {/* ⚡ SKILLS DE TREINO — 3 slots; só equipada aplica efeito */}
      {aba === "skills" && (
        <div>
          {/* slots */}
          <div className="mb-2 flex items-center gap-1.5">
            <span className="font-pixel text-[8px] text-suave">SLOTS:</span>
            {g.skillSlots.map((id, idx) => {
              const s = id ? defSkill(id) : undefined;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSlotAtivo(slotAtivo === idx ? null : idx)}
                  title={s ? `${s.nome} — clique e escolha outra (ou esvazie)` : "Slot vazio — clique e escolha uma skill"}
                  className={`flex h-9 w-9 items-center justify-center border-2 text-base transition ${
                    slotAtivo === idx ? "border-ciano bg-ciano/15" : s ? "border-amber-300/60 bg-amber-300/5" : "border-dashed border-borda"
                  }`}
                  style={s ? { color: s.cor } : undefined}
                >
                  {s ? s.emoji : "+"}
                </button>
              );
            })}
            {slotAtivo !== null && g.skillSlots[slotAtivo] && (
              <button
                type="button"
                onClick={() => {
                  equiparSk(slotAtivo, null);
                  setSlotAtivo(null);
                }}
                className="border border-borda px-1.5 py-0.5 font-pixel text-[8px] text-suave hover:text-texto"
              >
                esvaziar
              </button>
            )}
            <span className="ml-auto text-[9px] text-suave" title="Somas das skills EQUIPADAS">
              ⚡ poder +{Math.round(msk.poder)} · 🛡 −{Math.round(msk.escudo * 100)}%
            </span>
          </div>

          {/* lista de skills */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SKILLS.map((s) => {
              const nivel = g.skills[s.id] ?? 0;
              const bloqueio = bloqueioSkill(g.skills, g.sucata, s.id);
              const custo = nivel < s.nivelMax ? custoSkill(s, nivel) : 0;
              const equipada = g.skillSlots.includes(s.id);
              const escolhendo = slotAtivo !== null && nivel >= 1;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (slotAtivo !== null) {
                      if (nivel >= 1) {
                        equiparSk(slotAtivo, s.id);
                        setSlotAtivo(null);
                        tocarSom("tick", 0.5);
                      }
                      return;
                    }
                    if (comprarSk(s.id)) {
                      tocarSom("moeda", 0.5);
                      setFlash(s.id);
                      setTimeout(() => setFlash((f) => (f === s.id ? null : f)), 400);
                    }
                  }}
                  title={slotAtivo !== null ? (nivel >= 1 ? `Equipar ${s.nome} no slot` : "Compre 1 nível antes de equipar") : s.desc.replace("{v}", valorSkill(s.id, nivel + 1)).replace("{v2}", valorSkill2(s.id, nivel + 1))}
                  className={`flex flex-col items-start gap-0.5 border-2 p-1 text-left transition ${
                    escolhendo ? "border-ciano/70 bg-ciano/5" : nivel >= s.nivelMax ? "border-amber-300/60 bg-amber-300/5" : "border-borda hover:border-ciano"
                  } ${flash === s.id ? "!border-ciano bg-ciano/15" : ""}`}
                >
                  <span className="flex w-full items-center justify-between text-[10px]">
                    <span className="truncate text-texto">
                      <span style={{ color: s.cor }}>{s.emoji}</span> {s.nome}
                      {equipada && <span className="ml-1 font-pixel text-[7px] text-amber-300">EQ</span>}
                    </span>
                    <span className="ml-1 shrink-0 font-pixel text-[8px] text-suave">
                      {nivel}/{s.nivelMax}
                    </span>
                  </span>
                  <span className="text-[9px] text-emerald-400">{s.desc.replace("{v}", valorSkill(s.id, nivel + 1)).replace("{v2}", valorSkill2(s.id, nivel + 1))}</span>
                  <span className={`font-pixel text-[8px] ${bloqueio === "sucata" ? "text-rosa" : nivel >= s.nivelMax ? "text-amber-300" : "text-[#b9c2d0]"}`}>
                    {nivel >= s.nivelMax ? "MÁX" : `🔩 ${custo}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-suave">
            <span>golpes automáticos na cena · poder vale na Jornada; escudo/cura/HP valem no Desafio</span>
            <button
              type="button"
              onClick={() => respecSk()}
              className="text-[10px] text-suave underline-offset-2 hover:text-texto hover:underline"
              title="Devolve toda a Sucata investida em skills (grátis) e esvazia os slots"
            >
              ♻ respec grátis
            </button>
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

// Rótulos dos valores de skill no PRÓXIMO nível ({v} = principal, {v2} = secundário).
function valorSkill(id: string, nivelProx: number): string {
  const s = defSkill(id);
  if (!s) return "";
  const n = Math.min(s.nivelMax, nivelProx);
  const e = s.efeito;
  if (e.poder) return `${Math.round(e.poder * n * 10) / 10}`;
  if (e.escudo) return `${Math.round(e.escudo * n * 100)}%`;
  if (e.cura) return `${Math.round(e.cura * n * 1000) / 10}%`;
  if (e.hp) return `${e.hp * n}`;
  return "";
}
function valorSkill2(id: string, nivelProx: number): string {
  const s = defSkill(id);
  if (!s) return "";
  const n = Math.min(s.nivelMax, nivelProx);
  const e = s.efeito;
  if (e.poder && e.hp) return `${e.hp * n}`;
  if (e.poder && e.escudo) return `${Math.round(e.escudo * n * 100)}%`;
  return "";
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
