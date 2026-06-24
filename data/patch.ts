// 🧪 Auto Patch — meta muda a cada N semanas (buffs/nerfs fictícios na força/meta).
// NUNCA altera rotas (rolesValidas), só forcaMetaBase.

export const PATCH = {
  semanasPorPatch: 2, // um patch novo a cada 2 semanas
  porRotaBuff: 2, // campeões fracos buffados POR ROTA a cada patch (garante mudança em toda rota)
  porRotaNerf: 2, // campeões fortes nerfados POR ROTA a cada patch
  buffMin: 6,
  buffMax: 16,
  nerfMin: 6,
  nerfMax: 16,
  ancora: 0.15, // reversão leve à força real (Oracle's Elixir) a cada patch
  metaMin: 25, // limites da forcaMetaBase após o patch
  metaMax: 90,
} as const;
