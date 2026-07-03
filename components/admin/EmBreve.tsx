export default function EmBreve({ secao }: { secao: string }) {
  return (
    <div className="rounded border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
      <p className="text-zinc-300">{secao}</p>
      <p className="mt-1 text-xs">Em construção nesta rodada do painel.</p>
    </div>
  );
}
