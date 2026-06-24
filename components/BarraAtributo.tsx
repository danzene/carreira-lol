export default function BarraAtributo({
  nome,
  valor,
  esconder = false,
}: {
  nome: string;
  valor: number;
  esconder?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-suave sm:w-32">{nome}</span>
      <div className="h-3 flex-1 border-2 border-borda bg-fundo">
        {esconder ? (
          <div className="h-full w-full bg-borda/50" />
        ) : (
          <div className="h-full bg-gradient-to-r from-rosa to-ciano" style={{ width: `${valor}%` }} />
        )}
      </div>
      <span className="w-7 shrink-0 text-right font-pixel text-[10px] text-texto">{esconder ? "?" : Math.round(valor)}</span>
    </div>
  );
}
