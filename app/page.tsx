export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="font-pixel text-[10px] tracking-[0.3em] text-ciano">MODO CARREIRA · ESPORTS</span>

        <h1
          className="font-pixel text-3xl leading-[1.6] text-rosa sm:text-5xl sm:leading-[1.6]"
          style={{ textShadow: "3px 3px 0 #0b0617, 6px 6px 0 rgba(25,230,224,0.35)" }}
        >
          CARREIRA
          <br />
          <span className="text-ciano">LoL</span>
        </h1>

        <p className="max-w-xs text-sm leading-relaxed text-suave">
          Do zero na soloq ao Mundial. Crie seu pro player e construa uma lenda.
        </p>
      </div>

      <button
        type="button"
        className="font-pixel border-2 border-rosa bg-rosa/10 px-6 py-4 text-[10px] text-rosa shadow-[4px_4px_0_#0b0617] transition hover:bg-rosa hover:text-fundo focus:outline-none focus:ring-2 focus:ring-ciano"
      >
        ▶ NOVA CARREIRA
      </button>

      <p className="font-pixel text-[8px] text-borda">FASE 0 · BASE PIXEL ART</p>
    </main>
  );
}
