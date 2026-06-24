// 🧪 Auto Patch — meta muda a cada N semanas (buffs/nerfs fictícios na força/meta).
// NUNCA altera rotas (rolesValidas), só forcaMetaBase.

export const PATCH = {
  semanasPorPatch: 2, // um patch novo a cada 2 semanas
  qtdBuffs: 7, // quantos campeões são buffados por patch
  qtdNerfs: 7, // quantos são nerfados
  buffMin: 6,
  buffMax: 16,
  nerfMin: 6,
  nerfMax: 16,
  metaMin: 25, // limites da forcaMetaBase após o patch
  metaMax: 90,
} as const;
