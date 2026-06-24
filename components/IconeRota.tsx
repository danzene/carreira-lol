import type { Role } from "@/engine/types";

// Ícones de posição estilo LoL (no minimapa em diamante): TOP = canto sup-esq,
// MID = diagonal, ADC = canto inf-dir, JUNGLE = mato, SUPORTE = cruz (utility).
export default function IconeRota({ rota, className }: { rota: Role; className?: string }) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {rota === "TOP" && <path {...p} d="M5 19 L5 5 L19 5" />}
      {rota === "MID" && <path {...p} d="M5 19 L19 5" />}
      {rota === "ADC" && <path {...p} d="M5 19 L19 19 L19 5" />}
      {rota === "JUNGLE" && (
        <>
          <path {...p} d="M12 20 C 11 14 12 9 12 4" />
          <path {...p} d="M12 18 C 10 14 8 12 6 10" />
          <path {...p} d="M12 18 C 14 14 16 12 18 10" />
        </>
      )}
      {rota === "SUPPORT" && <path {...p} d="M12 6 L12 18 M6 12 L18 12" />}
    </svg>
  );
}
