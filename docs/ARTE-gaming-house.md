# ARTE — Gaming House (encomenda pra IA de imagem)

Lista completa de imagens/animações pra substituir os desenhos programáticos da tela
🏠 GAMING HOUSE (`/casa`) por arte de verdade, **no MESMO estilo dos sprites do idle**
(a pasta "Personagem carreira lol" — o herói e os minions que já vivem no diorama).

## Como usar
Cole o **PROMPT-MESTRE** (abaixo) no início de toda conversa com a IA de imagem, e
depois peça um asset por vez com os prompts individuais. Gere tudo na mesma sessão/
estilo pra manter consistência. Os PNGs entram no pipeline existente
(`npm run sprites:build` — ele apara, normaliza a escala e monta o atlas), então
**pode gerar grande** (ex.: 512-1024px): o importante é o ESTILO, não o tamanho.

---

## PROMPT-MESTRE (colar primeiro, sempre)

```
Pixel art game asset for a 2D side-view idle game about an esports pro player.
STYLE RULES (apply to every image in this session):
- Clean retro pixel art, chunky readable pixels, NO anti-aliasing, NO blur, no outlines thinner than 1px.
- Dark 1px outline around every sprite (near-black #0b0617).
- Strict side-view (profile), like a side-scroller diorama.
- Dark cozy night-time palette on TRANSPARENT background (PNG): deep purple-navy shadows (#141026, #1c1533),
  accent colors: cyan #19e6e0, hot pink #ff2d7e, gold #ffd34d, purple #9a6bff, soft lavender #9a90c0, warm skin #e8c39e.
- Light source: soft cool light from upper-left, plus small local light sources (monitor glow, lamps) tinting nearby pixels.
- Proportions: cute chibi esports player, roughly 2.5 heads tall, big head, small body — consistent with a 34px-tall in-game sprite (draw at 8-16x scale, e.g. 512px tall, keeping chunky pixel look).
- For ANIMATIONS: deliver 2 frames side by side (frame A | frame B), same canvas size, subtle motion between frames (idle-game loop at ~3fps).
- No text, no watermark, no background unless explicitly asked.
```

---

## GRUPO A — Cenário da casa (fundo, 1 imagem grande)

A cena tem proporção **480×120** (@1x). Gerar em **1920×480** (4×), side-view, uma
sala corrida (como casa de boneca vista de lado). O chão ocupa os ~18px de baixo (@1x).

**A1 — Fundo da Gaming House (sem estações, sem personagem):**
```
Wide interior background of an esports GAMING HOUSE at night, side-view cutaway (dollhouse view), 1920x480.
Left-to-right: an empty living room wall with dark purple wallpaper (#141026), wooden dark floor with plank lines,
a large window in the center showing a starry night sky with a crescent moon, a framed esports poster with a gold trophy icon,
a cozy purple couch in the middle of the room, small rug, a few cables on the floor, LED strip along the ceiling (subtle cyan glow),
tiny plants, shelf with figurines. Leave clear empty floor space across the whole scene for stations to be placed later.
Moody, cozy, dark — monitor-lit esports vibe. Transparent = none (this one is a full opaque background).
```

## GRUPO B — As 8 estações (props isolados, PNG transparente)

Cada estação em **2 versões**: `idle` (desligada/apagada) e `ativa` (2 frames, com
brilho/movimento — é a que toca enquanto o herói treina). Altura de referência: a
mesa/objeto tem ~26-40px @1x (gerar ~512px, mesma escala do herói).

**B1 — 📋 Quadro Tático (ANALISE_ADVERSARIO):**
```
A tactical whiteboard on a stand, esports draft plan: tiny colored magnets (pink X's and cyan O's), arrows drawn in marker,
a small desk with a laptop and sticky notes. ACTIVE version (2 frames): the laptop screen glows and one magnet blinks.
```

**B2 — 📼 Sala de Replay (REPLAY_ROOM):**
```
A desk with ONE big monitor showing a paused game replay (cyan-tinted screen with a tiny map sketch),
headphones on a hook, a notebook with pen. ACTIVE (2 frames): screen flickers between two replay frames, monitor glow on the desk.
```

**B3 — 🖥️ Simulador de Scrim (SCRIM_SIM):**
```
A row of THREE small monitors on one long desk (like a mini LAN setup), each screen a different purple-tinted game scene,
tangled cables, a team flag on the wall behind. ACTIVE (2 frames): screens alternate brightness like a busy scrim, purple glow.
```

**B4 — 🎯 Aim Trainer (AIM_TRAINER):**
```
A wall-mounted target board (white/pink concentric circles) plus a small desk with mouse and mousepad only (no keyboard),
scattered practice darts/marks on the wall. ACTIVE (2 frames): a pink hit-marker flashes on a different spot of the target each frame.
```

**B5 — ⚔️ Custom 1v1 (CUSTOM_1V1):**
```
TWO small desks facing each other (dueling setup), two monitors back to back, gold accent lighting,
a small "VS" pennant hanging between them. ACTIVE (2 frames): both screens flash alternately gold/dark, like a duel trading hits.
```

**B6 — 🧙 Treino de Campeão (CHAMPION_PRACTICE):**
```
A training corner with a green banner showing a star emblem, a practice dummy wearing a wizard hat,
a desk with a monitor showing a champion select screen (green-tinted). ACTIVE (2 frames): the dummy wobbles and the star emblem sparkles.
```

**B7 — 🔴 Sala de Stream (SALA_DE_STREAM):**
```
A streamer setup: desk with monitor, big microphone on an arm, ring light, webcam on top, an "ON AIR" sign board above (dark/off in idle),
energy drink can, RGB keyboard glow. ACTIVE (2 frames): the ON AIR sign lit bright red and blinking, chat scrolling on the monitor (tiny colored lines), red glow spilling on the desk.
```

**B8 — 🛏️ Bem-estar (ACADEMIA_SONO_TERAPIA) — 3 sub-props no mesmo canto:**
```
(a) A small home gym corner: dumbbell rack + a bench with a barbell, soft blue lighting.
(b) A cozy single bed with blue blanket and a light-blue pillow, small night lamp.
(c) A therapy armchair with a soft lamp and a small plant.
Deliver as ONE composed corner (gym + bed + armchair side by side) in idle, PLUS a 2-frame ACTIVE version of each sub-prop:
gym = barbell mid-lift sparkle; bed = blanket rising/falling with "z" ; armchair = lamp glow pulsing.
```

**B9 — Sofá central (estado de BURNOUT):**
```
A worn cozy purple couch (the burnout couch), slightly bigger than the others, with a blanket half falling off,
game controller abandoned on the floor, dim mood. (Static, 1 frame — the hero sits on it when burned out.)
```

## GRUPO C — Animações NOVAS do herói (mesmo personagem dos sprites existentes!)

⚠️ CRÍTICO — em TODA mensagem deste grupo: **anexe 1-2 PNGs** da pasta
"Personagem carreira lol" (ex.: o de correr e o de idle) junto com o prompt. Todos os
prompts abaixo já dizem "use the attached character reference".

**C1 — Sentado digitando** (usada em replay/scrim/stream/1v1):
```
Use the attached character reference: SAME hero, same face, same hair, same outfit and colors.
The hero sitting on a gamer chair in strict side-view profile, typing on a keyboard at a desk (chair + hero only, NO desk in the image).
2 frames side by side, same canvas: frame A = hands on keyboard, relaxed; frame B = hands slightly raised mid-typing, head tilted a bit forward.
Transparent background.
```

**C2 — Mirando** (aim trainer):
```
Use the attached character reference: SAME hero, same colors.
The hero standing in side-view profile, one arm extended forward holding a computer mouse like aiming at a target, focused expression.
2 frames side by side: frame A = arm level; frame B = quick flick, arm slightly higher, tiny motion lines.
Transparent background.
```

**C3 — Levantando peso** (academia):
```
Use the attached character reference: SAME hero, same colors.
The hero in side-view profile lifting a small barbell with both hands, cheeks slightly red from effort.
2 frames side by side: frame A = barbell at chest height, knees bent; frame B = barbell lifted overhead, body stretched.
Transparent background.
```

**C4 — Dormindo** (sono):
```
Use the attached character reference: SAME hero, same colors.
The hero lying down asleep in side-view profile, under a blue blanket, eyes closed, peaceful (hero + blanket only, NO bed in the image).
2 frames side by side: frame A = blanket low, mouth closed; frame B = blanket slightly risen (breathing), tiny "z" above the head.
Transparent background.
```

**C5 — Na poltrona / terapia:**
```
Use the attached character reference: SAME hero, same colors.
The hero sitting relaxed in side-view profile holding a warm mug with both hands, calm smile (hero only, NO armchair in the image).
2 frames side by side: frame A = mug at chest, steam wisp; frame B = sipping from the mug, eyes closed happy.
Transparent background.
```

**C6 — Exausto no sofá (BURNOUT):**
```
Use the attached character reference: SAME hero, same colors.
The hero slumped in side-view profile as if sunk into a couch: dark circles under the eyes, messy hair, arms fallen,
a game controller dropped near his hand (hero + controller only, NO couch in the image).
2 frames side by side: frame A = head drooping; frame B = head drops lower with a small sigh cloud.
Transparent background.
```

**C7 — Anotando no quadro (análise):**
```
Use the attached character reference: SAME hero, same colors.
The hero standing in side-view profile writing with a marker on an invisible board in front of him, thinking hard
(hero + marker only, NO whiteboard in the image).
2 frames side by side: frame A = arm up writing high; frame B = arm mid-height writing, other hand on chin.
Transparent background.
```

**C8 — Comemorando treino (fim de sessão — opcional):**
```
Use the attached character reference: SAME hero, same colors.
The hero in side-view profile doing a small casual fist pump with a happy grin.
2 frames side by side: frame A = fist up, one eye winking; frame B = relaxed pose, two tiny gold stars near the head.
Transparent background.
```

## GRUPO D — Efeitos e overlays (PNG transparente, pequenos)

**D1 — Fagulhas de treino (o jogo tinge na cor de cada estação — gerar em BRANCO):**
```
Tiny pixel art particle sprite sheet on transparent background: 6 small separate particles in a row, PURE WHITE only —
a spark, a plus sign, a 4-point star, a small diamond, a dot cluster, a tiny burst. Each particle max 8x8 pixels (draw at 8x scale).
Chunky pixels, no anti-aliasing, no outline, no colors other than white.
```

**D2 — "Zzz" do sono/fadiga:**
```
Pixel art "Z" letters for a sleeping effect, transparent background: three separate Z's in a row, small / medium / large,
soft lavender color #9a90c0, chunky pixels with 1px dark outline, no anti-aliasing.
```

**D3 — Plaquinha ON AIR acesa:**
```
Pixel art "ON AIR" sign, lit bright red (#ff4d4d) with warm glow pixels around it, dark frame, side-view flat front,
transparent background, chunky pixels, readable at small size. Deliver 2 frames side by side: lit / slightly dimmer (for blinking).
```

**D4 — Brilhos de moral alta:**
```
Tiny pixel art sprite sheet, transparent background: 3 separate small sprites in a row — a gold heart, a gold music note,
a gold sparkle star (#ffd34d), each with 1px dark outline, max 10x10 pixels each (draw at 8x scale), chunky pixels.
```

**D5 — Vinheta de burnout (overlay):**
```
A 1920x480 overlay image (no transparency needed at edges): dark blue-purple radial vignette — fully transparent in the center,
gradually darkening to heavy #050312 at the edges and corners. Smooth but with a subtle pixel-dither texture in the gradient.
PNG with alpha.
```

**D6 — Luz quente de moral alta (overlay):**
```
A 1920x480 overlay image, PNG with alpha: soft warm golden light (#ffd34d at very low opacity) spilling diagonally
from the upper area like cozy ceiling LEDs, strongest at top-center, fading to fully transparent at the bottom.
Subtle pixel-dither texture in the gradient.
```

## Regras de consistência (repetir se a IA derrapar)
1. Mesma paleta em tudo (cores do prompt-mestre) — nada de cores novas saturadas.
2. Mesmo herói do jogo (anexar referência nos prompts do Grupo C).
3. Side-view SEMPRE (nada de 3/4 nem isométrico).
4. 2 frames por animação, mesmo canvas, movimento sutil.
5. Contorno escuro 1px; sem anti-aliasing; fundo transparente (exceto A1).
6. Luz local: telas iluminam ciano/roxo, ON AIR ilumina vermelho, academia/cama azul.

## Integração (pra rodada de código depois da arte)
Os PNGs entram em `Personagem carreira lol/` (ou pasta nova `casa/`) e o
`build-sprites.mjs` ganha os slots novos (mesmo processo dos 22 originais: flood-fill,
trim, baseline, altura-alvo — herói 34px @1x; estações ~28-40px). A `cenaCasa.ts` troca
os desenhos programáticos por `drawImage` do atlas, mantendo o fallback atual.
