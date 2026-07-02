import Link from "next/link";
import TierList from "@/components/TierList";

export default function CampeoesPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-pixel text-sm text-ciano">TIER LIST</h1>
        <Link
          href="/dashboard"
          className="border-2 border-borda px-3 py-1.5 text-[11px] text-suave transition hover:text-texto"
        >
          Voltar
        </Link>
      </header>
      <p className="text-xs text-suave">
        A meta muda a cada patch (Auto Patch). <span className="text-ciano">▲</span> buffado /{" "}
        <span className="text-rosa">▼</span> nerfado neste patch. Toque num campeão para ver o perfil.
      </p>
      <TierList />
    </main>
  );
}
