# CHANGELOG — Sprites Reais no Diorama + Conserto da PiP

## 🐛 Fase 0 — Crash da PiP: causa-raiz e conserto

**Causa-raiz (3 problemas combinados na implementação anterior):**
1. **Nó React movido entre documentos** — a `div` inteira do diorama (gerenciada pelo
   React, com o canvas dentro) era movida pro documento da janela PiP via
   `pipWindow.document.body.append(wrap)`. No re-render seguinte, o React mutava
   filhos de um nó que agora vivia em OUTRO documento — operações DOM
   cross-document quebram/travam o app.
2. **Cena recriada no meio da mudança** — o effect da cena tinha `pip` nas deps e o
   rAF ficava preso na janela capturada no setup → risco real de loop duplo/órfão
   em abre-fecha rápidos.
3. **Cópia de todos os stylesheets no clique** — o Tailwind inteiro (milhares de
   regras) era serializado em string pro `<head>` da PiP: jank pesado no main thread.

**Conserto (receita "canvas nunca se move"):**
- Abrir a PiP cria um **canvas NOVO no documento dela** (estilos inline mínimos —
  nenhum stylesheet copiado) e a cena só **troca o alvo de render**
  (`cena.definirCtx`). Nenhum nó muda de documento; o React nem percebe.
- **Loop com dono único**: cada frame agenda o próximo na janela onde o canvas vive
  (`janelaPip() ?? window`), com a janela usada guardada pra cancelar no lugar
  certo. `iniciar()` é idempotente (nunca dois loops); abrir 2× fecha a anterior.
- `pagehide` da PiP devolve o ctx pro canvas da página, religa o loop se visível e
  loga a duração; trocar de rota fecha a PiP limpa no cleanup do effect.
- **Guard rails**: toda a feature em try/catch com degradação limpa (fecha PiP,
  volta ao normal, telemetria `diorama_pip_erro`) — o jogo **nunca** congela.
- **Contagem de segundos**: guard único `grindVisivel() = visibilidadeEfetiva(abaVisível,
  pipAberta)` — função **pura testada** (só aba ✓ / só PiP ✓ / ambas = 1× ✓ /
  nenhuma = 0 ✓). Um acumulador, um guard: dupla contagem impossível por construção.
- A página mostra "⧉ CENA DESTACADA — TRAZER DE VOLTA" enquanto a PiP roda.

*Critérios de aceite manuais (10× abre/fecha, fechar pelo X e pelo botão, trocar de
rota): roteiro pro dono validar no Chrome/Edge — a lógica que causava o travamento
foi removida por inteiro.*

## 🖼️ Fase 1 — Pipeline de assets (`npm run sprites:build`)

- **Lib: sharp** (e não node-canvas): binários pré-compilados no Windows (zero
  toolchain), acesso raw RGBA rápido e `kernel: nearest` no resize — essencial pro
  pixel art não virar mingau.
- **Tolerância do flood-fill**: `TOLERANCIA_SAT = 26` (pixel de fundo =
  `max(R,G,B) − min(R,G,B) ≤ 26`, BFS a partir de TODAS as bordas; personagem
  colorido bloqueia a propagação). Validado com 22 sprites sintéticos imitando os
  brutos (degradê radial ~#888→preto + corpo colorido + acento neon + **buraco
  cinza interno**): fundo 100% removido, buraco interno **preservado** (teste de
  pixel no atlas). Se sobrar franja na arte real: subir pra ~30-34.
- **Suavização de borda**: alpha 140 na fronteira do recorte (8-conexo).
- **Baseline**: default = fundo do bbox (pés no chão). `BASELINE_OVERRIDES` no
  script pra poses caídas (fração da altura) — **nenhum override foi necessário nos
  sintéticos**; calibrar com a arte real no preview.
- **Altura-alvo H**: herói **34px @1x** (mesma altura visual do sprite programático
  — a leitura do strip de 72px não muda), minion **21px (0,62×H)**. Todos os frames
  do personagem escalados pela MESMA razão ancorada no frame de referência em pé
  (`heroi_idle_1` / `minion_azul_walking_1`) — sem "pulo" de escala.
- **Atlas**: shelf packing (≤1024px de largura), `diorama@{1x,2x}.png` +
  `diorama.json {x,y,w,h,anchorX,baselineY}` por resolução. **Idempotente**
  (hash idêntico em 2 execuções — verificado). Nome com vírgula normalizado
  (`..._atk_2,png.png` ✓). `_ref` ignorado. Pasta vazia = mensagem e exit 0.
- **Preview**: `assets/sprites-preview.html` (fora do build) com todas as animações
  em loop sobre fundo escuro.

## 🎬 Fase 2 — Integração (arte = progressive enhancement)

- Loader único por sessão; **404 do JSON = fallback silencioso** (arte ainda não
  publicada — estado ATUAL do repo); **qualquer outra falha** dispara
  `diorama_assets_fallback` (canário: se aparecer em produção, deploy quebrado).
- **Resolução**: a cena desenha num backing store lógico de 480×96 ampliado por CSS
  (estética pixel intencional) → **@1x sempre**; o @2x fica pronto pra um futuro
  canvas retina. Documentado aqui como decisão.
- **Mapeamento estados→frames** (timings da missão): idle 600ms · run 4f/110ms ·
  attack **windup 130ms → strike (hit-stop existente) → recovery** · hit com flash
  branco 60ms (frame pré-tingido no load — barato) · derrota_1→derrota_2 (fica) ·
  vitória 1→2↔3 em loop · **sentado/dormindo = derrota_2 + zzz/café/teclado por
  código POR CIMA**, com slots `heroi_sentado`/`heroi_dormindo` já mapeados.
- **Minion azul**: walking 3f/110ms · **atk_1→atk_2 quando o contra-golpe da
  coreografia dispara** (campo novo `atkT`) · morte = frame `hit` + fade +
  partículas existentes.
- **Campeão adversário** do desfecho: herói espelhado (`scale(-1,1)`) com tinta rosa.
- **Flip**: herói já olha pra direita e minion pra esquerda — zero espelhamento no
  caminho comum.
- Squash & stretch, screen-shake, sombra elíptica (ancorada no `baselineY` do JSON)
  e partículas: aplicados como transform/overlay no draw — o game feel não mudou.
- **Decisão documentada**: camps/dragão/**Barão programáticos continuam** até a arte
  chegar (a silhueta deles já lê bem); minion caster/canhão/boss são slots.

## 📊 CPU e aquário (roteiro — depende de máquina real)

A arte via atlas + `drawImage` custa ≤ que os ~30 fillRect/sprite programáticos
(1 blit por entidade). Nada mudou no cap de 30fps/12fps, pooling, pré-render nem na
pausa total com aba oculta. **Roteiro de medição (4 estados)**: `Shift+Esc` →
CPU da aba em visível normal (meta ≤3-5%), economia, oculta (~0%), PiP aberta.
Teste do aquário (60s) repetir com a arte real quando os PNGs chegarem —
sons/brilhos já passaram pelo passe da rodada anterior.

## 📦 Slots aguardando arte (como adicionar: 1 linha)

Soltar a pasta em `assets/sprites-raw/` + rodar `npm run sprites:build` (e, pra
personagem novo, 1 entrada em `ALTURA_ALVO`/`FRAME_REF` no script):

| Slot | Frames esperados | Status |
|---|---|---|
| `heroi_sentado` / `heroi_dormindo` | 1-2 frames cada (emotes de respiro/teto) | mapeados; placeholder = derrota_2 + overlay |
| `minion_caster` / `minion_canhao` | walking/atk/hit | cena usa só o melee por enquanto |
| `boss` (Barão/camps) | idle/atk/hit/morte | programático atual segue no ar |

## Estado desta rodada

- PiP consertada pela raiz (Fase 0) · pipeline pronto e validado com sintéticos
  (Fase 1) · integração com fallback ativa (Fase 2) — **o repo ainda não tem os 22
  PNGs reais**: quando o dono soltá-los em `assets/sprites-raw/` e rodar
  `npm run sprites:build`, o atlas gerado em `public/sprites/` deve ser commitado e
  a arte liga sozinha (sem deploy de código).
- 231 testes + build verdes.
