"use client";

import { GRIND } from "@/data/grind";
import { grindDisponivel } from "@/engine/grind";
import { useCareer } from "@/store/careerStore";
import DioramaGrind from "./DioramaGrind";

// 🎪 Dock do diorama no Dashboard: integrado ao layout (largura total do container,
// não flutuante). Nas demais telas o GrindWidget mostra a strip flutuante no rodapé.
export default function GrindDock() {
  const career = useCareer((s) => s.career);
  const resultado = useCareer((s) => s.grindResultado);
  if (!career || !grindDisponivel(career)) return null;
  if (career.opcoes?.ocultarGrind || career.opcoes?.grindPilula || !GRIND.dioramaHabilitado) return null;
  return (
    <section aria-label="Grind de Normais">
      <DioramaGrind resultado={resultado} />
    </section>
  );
}
