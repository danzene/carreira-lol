import { GRIND } from "@/data/grind";
import type { OpcoesCarreira } from "@/engine/types";

// 🎛️ Decisão PURA do modo visual do grind (testada): diorama animado por padrão;
// pílula quando o jogador prefere (config), quando a strip foi recolhida na sessão,
// ou quando o KILL SWITCH VISUAL global está desligado (rollback de apresentação em
// 1 deploy, sem tocar no grind em si nem em nenhum save).
export function modoVisualGrind(
  opcoes: OpcoesCarreira | undefined,
  minimizado: boolean,
  dioramaHabilitado: boolean = GRIND.dioramaHabilitado,
): "diorama" | "pilula" {
  if (!dioramaHabilitado) return "pilula";
  if (opcoes?.grindPilula === true) return "pilula";
  if (minimizado) return "pilula";
  return "diorama";
}
