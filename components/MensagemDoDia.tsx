"use client";

import { useEffect, useState } from "react";
import { useLiveOps } from "@/store/liveopsStore";
import { assinaturaBanner, bannerDoDia } from "@/lib/liveops";

// Banner de live-ops. Lido UMA VEZ POR DIA: quando o jogador dispensa, guardamos a
// assinatura (data + conteúdo) no localStorage; muda o conteúdo ou vira o dia → volta.
const CHAVE = "msgdia_dispensada";

export default function MensagemDoDia() {
  const config = useLiveOps((s) => s.config);
  const [dispensada, setDispensada] = useState("");

  const banner = bannerDoDia(config);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const assinatura = assinaturaBanner(banner, hoje);

  useEffect(() => {
    try {
      setDispensada(localStorage.getItem(CHAVE) ?? "");
    } catch {
      /* sem storage */
    }
  }, []);

  if (!banner || (assinatura && assinatura === dispensada)) return null;

  function fechar() {
    try {
      localStorage.setItem(CHAVE, assinatura);
    } catch {
      /* ignora */
    }
    setDispensada(assinatura);
  }

  const cor = banner.tipo === "aviso" ? "border-amber-600/50 bg-amber-900/30 text-amber-100" : "border-sky-600/50 bg-sky-900/30 text-sky-100";

  return (
    <div className={`flex items-start gap-3 border-b px-4 py-2 text-sm ${cor}`}>
      <span className="mt-0.5">{banner.tipo === "aviso" ? "⚠️" : "📣"}</span>
      <div className="flex-1">
        {banner.titulo && <p className="font-semibold">{banner.titulo}</p>}
        <p className="text-[13px] opacity-90">{banner.texto}</p>
      </div>
      <button onClick={fechar} aria-label="Fechar" className="shrink-0 rounded px-1.5 text-lg leading-none opacity-70 hover:opacity-100">×</button>
    </div>
  );
}
