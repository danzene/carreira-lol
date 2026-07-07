"use client";

import { grindDisponivel } from "@/engine/grind";
import { useCareer } from "@/store/careerStore";
import DioramaGrind from "./DioramaGrind";
import { modoVisualGrind } from "./visual";

// 🎪 Dock do diorama no Dashboard: integrado ao layout (largura total do container,
// não flutuante). Nas demais telas o GrindWidget mostra a strip flutuante no rodapé.
export default function GrindDock() {
  const career = useCareer((s) => s.career);
  const resultado = useCareer((s) => s.grindResultado);
  if (!career || !grindDisponivel(career)) return null;
  if (career.opcoes?.ocultarGrind || modoVisualGrind(career.opcoes, false) === "pilula") return null;
  return (
    <section aria-label="Grind de Normais">
      <DioramaGrind resultado={resultado} />
    </section>
  );
}
