"use client";

import { defSub } from "@/data/gacha";
import { defAfixo, type Item } from "@/data/itens";
import { efeitoLendas, sinergiasAtivas } from "@/engine/gacha";
import { efeitoItens } from "@/engine/itens";
import type { CareerState } from "@/engine/types";

const ROXO = "#9a6bff";

// Painel dos efeitos aplicados na partida: lendas equipadas (Carreira Booster) + itens RPG + sets.
export default function EfeitosLendas({
  career,
  itens = [],
  titulo = "EFEITOS EM CAMPO",
}: {
  career: CareerState;
  itens?: Item[];
  titulo?: string;
}) {
  // ---- lendas ----
  const ef = efeitoLendas(career);
  const lendaLinhas: string[] = [];
  (Object.entries(ef.atributos) as [string, number][]).forEach(([k, v]) => {
    if (v) lendaLinhas.push(`${defSub(k)?.rotulo ?? k} +${v}`);
  });
  if (ef.xpMult > 1) lendaLinhas.push(`XP +${Math.round((ef.xpMult - 1) * 100)}%`);
  if (ef.dinheiroMult > 1) lendaLinhas.push(`Salário +${Math.round((ef.dinheiroMult - 1) * 100)}%`);
  if (ef.reducaoDecaimento > 0) lendaLinhas.push(`Anti-decaimento ${Math.round(ef.reducaoDecaimento * 100)}%`);
  if (ef.bonusComp > 0) lendaLinhas.push(`Draft +${ef.bonusComp}`);
  const sinergias = sinergiasAtivas(career);
  const nL = (career.lendasEquipadas ?? []).length;

  // ---- itens ----
  const efi = efeitoItens(itens);
  const itemLinhas: string[] = [];
  (Object.entries(efi.atributos) as [string, number][]).forEach(([k, v]) => {
    if (v) itemLinhas.push(`${defAfixo(k)?.rotulo ?? k} +${v}`);
  });
  if (efi.xpMult > 1) itemLinhas.push(`XP +${Math.round((efi.xpMult - 1) * 100)}%`);
  if (efi.dinheiroMult > 1) itemLinhas.push(`Salário +${Math.round((efi.dinheiroMult - 1) * 100)}%`);
  if (efi.energiaMult > 1) itemLinhas.push(`Energia +${Math.round((efi.energiaMult - 1) * 100)}%`);
  if (efi.maestriaMult > 1) itemLinhas.push(`Maestria +${Math.round((efi.maestriaMult - 1) * 100)}%`);
  if (efi.bonusComp > 0) itemLinhas.push(`Draft +${efi.bonusComp}`);

  const temLendas = lendaLinhas.length > 0 || sinergias.length > 0;
  const temItens = itemLinhas.length > 0 || efi.sets.length > 0;
  const vazio = !temLendas && !temItens;

  return (
    <div className={`border-2 p-3 ${vazio ? "border-borda bg-painel/60" : "border-ciano/40 bg-ciano/5"}`}>
      <h2 className={`mb-2 font-pixel text-[10px] ${vazio ? "text-suave" : "text-ciano"}`}>✨ {titulo}</h2>

      {vazio ? (
        <p className="text-[11px] text-suave">
          Nada equipado ainda. Equipe lendas no <span className="text-rosa">Carreira Booster</span> e itens no{" "}
          <span className="text-rosa">Inventário</span> pra ganhar bônus na partida.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {temLendas && (
            <div>
              <p className="mb-1 font-pixel text-[10px] text-suave">LENDAS ({nL}/3)</p>
              <div className="flex flex-wrap gap-1">
                {lendaLinhas.map((t) => (
                  <span key={t} className="border border-ciano/40 bg-ciano/10 px-2 py-0.5 text-[11px] text-ciano">
                    {t}
                  </span>
                ))}
                {sinergias.map((t) => (
                  <span key={t} className="border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-300">
                    ✦ {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {temItens && (
            <div>
              <p className="mb-1 font-pixel text-[10px] text-suave">ITENS ({itens.length})</p>
              <div className="flex flex-wrap gap-1">
                {itemLinhas.map((t) => (
                  <span
                    key={t}
                    className="border px-2 py-0.5 text-[11px]"
                    style={{ color: ROXO, borderColor: "rgba(154,107,255,0.4)", background: "rgba(154,107,255,0.1)" }}
                  >
                    {t}
                  </span>
                ))}
                {efi.sets.map((s) => (
                  <span key={s.id} className="border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-300">
                    ⚙ {s.nome} ({s.pecas})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
