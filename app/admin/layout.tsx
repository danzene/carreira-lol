"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchAdmin } from "@/lib/adminClient";
import { OPCOES_PERIODO, PeriodoProvider, usePeriodo } from "@/components/admin/PeriodoContext";

// Marcador de UX pro middleware (a segurança real é o requireAdmin no servidor).
function setMarcador(on: boolean) {
  document.cookie = `carreira_admin=${on ? "1" : ""}; path=/; max-age=${on ? 43200 : 0}; samesite=lax`;
}

const SECOES = [
  { href: "/admin", rotulo: "Visão Geral", icone: "📊" },
  { href: "/admin/retencao", rotulo: "Retenção", icone: "📈" },
  { href: "/admin/funis", rotulo: "Funis", icone: "🕳️" },
  { href: "/admin/economia", rotulo: "Economia", icone: "🪙" },
  { href: "/admin/engajamento", rotulo: "Engajamento", icone: "🎮" },
  { href: "/admin/jogadores", rotulo: "Jogadores", icone: "👤" },
  { href: "/admin/integridade", rotulo: "Integridade", icone: "🛡️" },
  { href: "/admin/liveops", rotulo: "Live-Ops", icone: "🎛️" },
  { href: "/admin/auditoria", rotulo: "Auditoria", icone: "📜" },
];

function BarraPeriodo() {
  const { dias, setDias } = usePeriodo();
  return (
    <div className="flex items-center gap-1">
      {OPCOES_PERIODO.map((o) => (
        <button
          key={o.dias}
          onClick={() => setDias(o.dias)}
          className={`rounded px-2 py-1 text-xs ${dias === o.dias ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<"carregando" | "ok" | "negado">("carregando");
  const [nick, setNick] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetchAdmin<{ admin: boolean; nick: string | null }>("me")
      .then((r) => {
        if (!vivo) return;
        if (r.admin) {
          setMarcador(true);
          setNick(r.nick);
          setEstado("ok");
        } else {
          setMarcador(false);
          setEstado("negado");
        }
      })
      .catch(() => {
        if (!vivo) return;
        setMarcador(false);
        setEstado("negado");
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (estado === "negado") router.replace("/");
  }, [estado, router]);

  if (estado !== "ok") {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">{estado === "carregando" ? "Verificando acesso…" : "Acesso negado."}</div>;
  }

  return (
    <PeriodoProvider>
      <div className="flex min-h-screen bg-zinc-950 text-zinc-200">
        {/* sidebar */}
        <aside className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-900/40 p-3">
          <p className="mb-4 px-2 text-sm font-bold text-sky-400">⚙ ADMIN</p>
          <nav className="flex flex-col gap-0.5">
            {SECOES.map((s) => {
              const ativo = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`rounded px-2 py-1.5 text-xs ${ativo ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}
                >
                  <span className="mr-2">{s.icone}</span>
                  {s.rotulo}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* conteúdo */}
        <div className="flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-5 py-2.5 backdrop-blur">
            <span className="text-xs text-zinc-500">
              Carreira LoL · painel interno {nick && <span className="text-zinc-400">· {nick}</span>}
            </span>
            <div className="flex items-center gap-3">
              <BarraPeriodo />
              <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300">
                ← voltar ao jogo
              </Link>
            </div>
          </header>
          <main className="mx-auto max-w-5xl p-5">{children}</main>
        </div>
      </div>
    </PeriodoProvider>
  );
}
