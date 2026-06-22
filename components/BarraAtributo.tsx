export default function BarraAtributo({ nome, valor }: { nome: string; valor: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-zinc-400 sm:w-32 sm:text-sm">{nome}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-borda">
        <div
          className="h-full rounded-full bg-gradient-to-r from-destaque to-destaque2"
          style={{ width: `${valor}%` }}
        />
      </div>
      <span className="w-7 shrink-0 text-right text-sm font-semibold text-zinc-200">{valor}</span>
    </div>
  );
}
