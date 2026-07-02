"use client";

import Link from "next/link";
import { chaveDia, diaDoCiclo, escudoDisponivel, podeColetarDiaria, puxadaGratisDisponivel, recompensaDoDia, DIAS_CICLO } from "@/engine/diario";
import { energiaAgora } from "@/engine/tempo";
import { tocarSom } from "@/lib/som";
import { useCareer } from "@/store/careerStore";
import { usePasse } from "@/store/passeStore";

// 📅 Daily Hub: overlay de boas-vindas na PRIMEIRA abertura do dia. Resumo de energia,
// missões diárias, streak (calendário de 7 dias + escudo) e recompensa pra coletar.
// Fechável em 1 clique — nunca irritante.

export default function DailyHub() {
  const dailyHub = useCareer((s) => s.dailyHub);
  const career = useCareer((s) => s.career);
  const coletar = useCareer((s) => s.coletarDiaria);
  const fechar = useCareer((s) => s.limparDailyHub);
  const passe = usePasse((s) => s.passe);

  if (!dailyHub || !career) return null;

  const agora = Date.now();
  const hoje = chaveDia(agora);
  const energia = Math.round(energiaAgora(career, agora));
  const dia = diaDoCiclo(dailyHub.streak);
  const podeColetar = podeColetarDiaria(career, hoje);
  const recompensa = recompensaDoDia(dailyHub.streak);
  const temEscudo = escudoDisponivel(career.diario, hoje);
  const puxadaGratis = puxadaGratisDisponivel(career, hoje);
  const diarias = passe?.diarias ?? [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4" onClick={fechar} role="dialog" aria-label="Resumo do dia">
      <div
        className="flex max-h-[90vh] w-full max-w-sm flex-col gap-3 overflow-y-auto border-2 border-ciano bg-fundo p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 className="font-pixel text-sm text-ciano">
            {dailyHub.evento === "primeiro" ? "BEM-VINDO!" : dailyHub.evento === "zerou" ? "DE VOLTA!" : "BOM TE VER DE NOVO!"}
          </h2>
          {dailyHub.evento === "escudo" && (
            <p className="mt-1 text-[11px] text-amber-300">🛡️ Seu escudo salvou o streak!</p>
          )}
        </div>

        {/* streak: calendário de 7 dias */}
        <div className="border-2 border-borda bg-painel p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-pixel text-[11px] text-texto">🔥 {dailyHub.streak} dia{dailyHub.streak > 1 ? "s" : ""}</span>
            <span className="text-[10px] text-suave">{temEscudo ? "🛡️ escudo pronto" : "🛡️ escudo usado"}</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: DIAS_CICLO }, (_, i) => {
              const d = i + 1;
              const r = recompensaDoDia(d);
              const passado = d < dia;
              const atual = d === dia;
              return (
                <div
                  key={d}
                  className={`flex flex-col items-center gap-0.5 border-2 py-1.5 text-center ${
                    atual ? "border-ciano bg-ciano/15" : passado ? "border-emerald-500/50 opacity-70" : "border-borda"
                  }`}
                >
                  <span className="text-[9px] text-suave">D{d}</span>
                  <span className="text-[11px]">{passado ? "✓" : r.tipo === "item" ? "🎒" : r.tipo === "energia" ? "⚡" : "💰"}</span>
                </div>
              );
            })}
          </div>
          {podeColetar ? (
            <button
              type="button"
              onClick={() => {
                if (coletar()) tocarSom("moeda");
              }}
              className="mt-2 w-full border-2 border-amber-300 bg-amber-300/10 py-2 font-pixel text-[10px] text-amber-300 transition hover:bg-amber-300 hover:text-fundo"
            >
              🎁 COLETAR · {recompensa.rotulo}
            </button>
          ) : (
            <p className="mt-2 text-center font-pixel text-[9px] text-emerald-400">✓ recompensa de hoje coletada</p>
          )}
        </div>

        {/* energia + missões do dia */}
        <div className="flex items-center justify-between border-2 border-borda bg-painel px-3 py-2 text-[11px]">
          <span className="text-suave">Energia</span>
          <span className="text-texto">⚡ {energia}/100</span>
        </div>

        {diarias.length > 0 && (
          <div className="border-2 border-borda bg-painel p-3">
            <p className="mb-2 font-pixel text-[10px] text-suave">MISSÕES DE HOJE</p>
            <div className="flex flex-col gap-1">
              {diarias.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-[11px]">
                  <span className={m.concluida ? "text-emerald-400 line-through" : "text-texto"}>{m.texto}</span>
                  <span className="text-suave">
                    {m.progresso}/{m.alvo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {puxadaGratis && (
          <Link
            href="/gacha"
            onClick={fechar}
            className="border-2 border-rosa bg-rosa/10 py-2 text-center font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
          >
            🎁 PUXADA GRÁTIS disponível no Booster!
          </Link>
        )}

        <button
          type="button"
          onClick={fechar}
          className="w-full border-2 border-ciano py-2 font-pixel text-[11px] text-ciano transition hover:bg-ciano hover:text-fundo"
        >
          JOGAR ▸
        </button>
      </div>
    </div>
  );
}
