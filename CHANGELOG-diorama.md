# CHANGELOG — Diorama do Grind (a fazenda viva na tela)

O widget do Grind de Normais virou um **diorama animado permanente**: uma faixa
side-scroller no rodapé onde o seu jogador farma o tempo todo — waves de inimigos,
números de dano voando, moedas em arco pro contador, drops com glow e o clímax
contra o campeão adversário com o resultado **real** do engine. Inspirado no que
consagrou AFK Arena/Legend of Slime/Task Bar Hero — e no contra-exemplo do que
derrubou o Task Bar Hero (CPU alta minimizado).

## Arquitetura (Regra 1: encenação, nunca fonte de verdade)

- **Coreografia PURA** (`components/grind/diorama/coreografia.ts`, 6 testes):
  `coreografarCorpo` (waves em loop) e `coreografarDesfecho` (clímax + resultado)
  são funções determinísticas por seed derivada (`seedCoreografia`). O canvas só
  coreografa o que `resolverGrind` já decidiu — gold/drop/vitória são EXATAMENTE
  os do engine (testado beat a beat). Zero `Math.random` na camada visual.
- **Recompensas intocadas**: nenhuma constante de `data/grind.ts` de valor mudou
  nesta rodada — diff 100% apresentação.

## Escolhas de coreografia (documentação pedida)

- **Duração encenada**: a partida real acumula 8-10 min; o CORPO encenado tem
  ~45-60s (3-4 waves de 3-5 inimigos com golpes a cada 0,55-0,8s) e fica em
  **loop** até a partida fechar no engine; aí toca o **desfecho** (~8-12s: campeão
  adversário entra, 4-6 trocas, último golpe de quem venceu de verdade, faixa
  V/D, gold em arco, drop com glow) e um **respiro** de 3-5s (senta na base com 1
  de 3 emotes: café / alongar / teclado).
- **Derrota**: rápida e digna — o jogador cai, faixa curta, respawn no respiro.
- **Variedade**: inimigos por elo (Ferro=minions; Ouro+=lobo/golem; Platina+=
  dragão ocasional; **Barão diorama** na última partida antes do teto); 3 cenários
  por seed (lane dia / lane noite com vagalumes / margem do rio com brilho);
  micro-eventos raros (~6% gank desviado, ~6% pétalas/vagalumes ambiente);
  **pentakill encenado** só quando o KDA real foi ≥10/≤2.
- **Estados**: teto ⇒ dorme na fogueira (zzz + cenário escurece + countdown);
  pausado ⇒ banco de reservas; volta de aba ⇒ card de resumo dispensável.

## Orçamento de performance (Regra 3) — como foi cumprido

- **rAF capado a 30fps** com acumulador/frame-skip; **12fps + zero partículas** no
  modo economia (config 🍃, `prefers-reduced-motion` do sistema, ou bateria <20%
  descarregando via `navigator.getBattery` quando existe).
- **Aba oculta ⇒ `cancelAnimationFrame`**: zero render, zero timer de animação —
  só o heartbeat de 5s do grind (que já existia). Com PiP aberta, o loop roda NA
  janela PiP (rAF dela), não na aba principal.
- **Pré-render offscreen**: 4 camadas de parallax por cenário pintadas 1 vez;
  sprites pré-renderizados em mini-canvases no init (atlas → `drawImage`);
  pools pré-alocados (6 inimigos, 16 números, 24 moedas, 48 partículas) — zero
  alocação por frame.
- **Medição de CPU (roteiro manual — Regra 3 exige números):** abrir o jogo com o
  diorama rodando → `Shift+Esc` (gerenciador de tarefas do navegador) → anotar a
  CPU da aba em 4 estados: visível normal (meta ≤3-5%), visível economia (menor),
  aba oculta (meta ~0%), PiP aberta com aba oculta (meta ≤3-5% na janela PiP).
  *Status: roteiro pronto; medição de campo pendente de execução na máquina do
  dono — o design (cap+pools+pré-render+pausa total) foi construído pra essas
  metas.*

## Game feel (Fase 3 — os três pilares presentes)

- **Hit-stop**: 60-100ms de congelamento no impacto (crits e kills; efeitos
  continuam a 20% pra não parecer travada).
- **Screen-shake**: 2-3px/100ms só em kills grandes, resultado e pentakill.
- **Squash & stretch**: jogador estica no ataque, inimigo achata no hit, morte
  encolhe com fade.
- **Easing em tudo**: moedas em arco com gravidade fake → homing pro contador;
  números de dano com pop-in/fade-out; crossfade de 0,8s entre cenários (ease-out);
  faixa V/D com fade in/out.
- **Paleta**: a do jogo (dark + neon pink/cyan), rim light ciano no sprite do
  jogador, retrato real do campeão (Data Dragon) com moldura ouro.

## Teste do aquário (60s) — o que foi identificado e consertado

Passe de revisão sobre o loop completo (itens encontrados por análise do ciclo;
o replay de 60s ao vivo fica no roteiro manual junto com a medição de CPU):

1. **Metralhadora de bipes**: cada kill + cada moeda chegando tocava um som →
   cooldown por som (kill 600ms, moeda 900ms = 1 bipe por leva) + auto-silêncio
   após 4min sem interação (só drop/fim de partida tocam).
2. **Brilho pulsante do drop irritava**: pulso reduzido de 12Hz → 6Hz e amplitude
   menor.
3. **Corte seco entre cenários**: crossfade de 0,8s adicionado.
4. **Previsibilidade**: durações/composições/pausas todas sorteadas por seed
   (nenhuma wave é idêntica à anterior); micro-eventos raros dão o "será que
   hoje tem?".
5. **Nada pisca continuamente**: única animação persistente é o bob de 1px do
   idle e o scroll do parallax (só enquanto corre).

## Presença e PiP

- **Dashboard**: dock integrado ao layout (largura total, sob o painel da semana).
- **Demais telas**: strip flutuante no rodapé (max-w do container do jogo),
  recolhível pra pílula (botão ▁). **Pílula** segue existindo como preferência
  (config "USAR PÍLULA") — o padrão é a cena.
- **Picture-in-Picture** (Document PiP; Chrome/Edge desktop — botão some sem
  suporte): move o DOM do diorama pra janela sempre-visível; estilos copiados;
  rAF na janela PiP. **Contagem de segundos**: guard único
  `grindVisivel() = aba visível OU PiP aberta` — um só acumulador, dupla contagem
  impossível por construção. Telemetria de abertura + duração no fechamento.
- **Título da aba** com placar (já existia) + **favicon dinâmico** 32px com V/D.
- **Onboarding**: 1 balão na primeira sessão + cerimônia de unlock reescrita.
- **Mobile 380px**: strip ~76px de altura (sprites e placar legíveis), HUD
  expandido abre como painel colado na base (bottom sheet), sem cobrir navegação.

## Configurações (persistidas no save) e kill switch

- Painel de som do HUD (⚙ único): OCULTAR GRIND (já existia), **USAR
  PÍLULA/DIORAMA**, **REDUZIR ANIMAÇÕES**, **volume do diorama** (slider, default
  45% do global; mute global manda em tudo).
- **Kill switch visual separado** (`GRIND.dioramaHabilitado`): volta a pílula pra
  todo mundo em 1 deploy sem desligar o grind nem tocar em save — decisão pura
  `modoVisualGrind` testada.

## Telemetria + admin

Eventos: `diorama_expandido`, `diorama_pip_aberto`, `diorama_pip_fechado
{segundos}`, `diorama_ocultado` (o sinal de rejeição mais importante),
`diorama_pilula`, `diorama_reduzido {motivo: bateria|config}`. Painel admin
(Engajamento → Endgame, migration 017): ocultaram / preferiram pílula / usuários
PiP / duração média de PiP.

## Ideias que ficaram pra depois

- **Skins do diorama** (cenários/molduras/emotes exclusivos) como recompensa
  cosmética — candidata natural da rodada de monetização (valor real exigirá a
  validação server-side já anotada em CHANGELOG-grind).
- Boss sazonal no diorama (ex.: Barão de inverno) via live-ops `app_config`.
- Espectadores raros na cena (torcida mini) reagindo a pentakill.

## Checklist final

- [x] 229 testes + build verdes; zero regra de jogo no canvas; coreografia determinística (testes)
- [x] Recompensas intocadas (diff é só apresentação)
- [x] 30fps cap + pooling + pré-render; aba oculta = zero render
- [ ] CPU medida em máquina real (roteiro acima — pendente de execução manual do dono)
- [x] prefers-reduced-motion + modo economia (config e bateria)
- [x] Hit-stop, squash&stretch, moedas em arco, números de dano, glow, easing
- [x] 3 cenários, inimigos por elo, 3 emotes, micro-eventos raros por seed
- [x] Derrota rápida e não punitiva; teto = cena dormindo com countdown
- [x] PiP com contagem correta (guard único); botão some sem suporte
- [x] Resumo de retorno dispensável em 1 clique
- [x] Mobile 380px; som com auto-silêncio + mute global
- [x] Aquário: passe de revisão executado e iterado (5 itens acima)
- [x] Telemetria + admin; kill switch visual testado
