# Sprites brutos do Diorama (entrada do pipeline)

Solte aqui as pastas de personagens com os PNGs gerados por IA (RGBA, fundo cinza
em degradê, personagem colorido com acentos neon) e rode:

```
npm run sprites:build
```

O pipeline (`scripts/build-sprites.mjs`) remove o fundo por flood-fill das bordas,
suaviza a borda, apara, normaliza a escala por personagem e empacota tudo em
`public/sprites/diorama@{1x,2x}.png` + `diorama.json` (commitáveis). QA visual:
abra `assets/sprites-preview.html` num servidor local.

## Estrutura esperada

```
heroi/heroi_ref.png            (referência — ignorada)
heroi/heroi_idle_{1,2}.png
heroi/heroi_run_{1,2,3,4}.png
heroi/heroi_atk_{1,2,3}.png
heroi/heroi_hit_1.png
heroi/heroi_derrota_{1,2}.png
heroi/heroi_vitoria_{1,2,3}.png
minion_azul/minion_azul_walking_{1,2,3}.png
minion_azul/minion_azul_atk_{1,2}.png
minion_azul/minion_azul_hit.png
```

## Personagem novo (caster, canhão, boss…)

1 linha: criar a pasta com os frames + adicionar a altura-alvo em `ALTURA_ALVO` e o
frame de referência em `FRAME_REF` no script → `npm run sprites:build`.

Poses caídas/sentadas com pé fora do fundo do bbox: ajustar `BASELINE_OVERRIDES`
no script (fração da altura; documentado lá).
