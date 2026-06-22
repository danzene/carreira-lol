export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-6 text-center">
      {/* brilho de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-destaque/20 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-destaque2">
          Modo Carreira · Esports
        </span>
        <h1 className="bg-gradient-to-r from-destaque via-fuchsia-400 to-destaque2 bg-clip-text text-6xl font-black tracking-tight text-transparent sm:text-7xl">
          Carreira LoL
        </h1>
        <p className="max-w-md text-balance text-sm text-zinc-400 sm:text-base">
          Comece do zero na soloq, evolua seus atributos, ganhe reputação e suba
          até o Tier 1 — rumo ao MSI e ao Worlds.
        </p>
      </div>

      <button
        type="button"
        className="relative rounded-xl bg-destaque px-8 py-3 text-base font-semibold text-white shadow-lg shadow-destaque/30 transition hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-destaque2 focus:ring-offset-2 focus:ring-offset-fundo"
      >
        Nova Carreira
      </button>

      <p className="relative text-xs text-zinc-600">Fase 0 — base do projeto</p>
    </main>
  );
}
