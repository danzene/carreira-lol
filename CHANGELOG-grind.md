# CHANGELOG — Grind de Normais (camada idle)

Enquanto a aba está aberta e **visível**, o seu jogador entra em fila de normais
sozinho, num widget compacto no canto da tela. Renda passiva **com teto** que
alimenta as **bordas** da progressão ($ pequeno, maestria, drop Comum) — a
energia/stamina continua sendo o coração do jogo.

Inspiração: o fenômeno "Task Bar Hero" — copiamos o que funcionou (ganho só com
a aba aberta, presença discreta, resultados pingando) e evitamos o que deu errado
lá (CPU alta minimizado; progressão automática ligada a valor real → onda de
cheaters).

---

## Constantes escolhidas (`data/grind.ts`)

| Constante | Valor | Razão vs jogo ativo |
|---|---|---|
| Duração de 1 normal | 8–10 min de tempo ativo (sorteado por seed) | ~20 normais num dia de teto |
| **Teto diário** | **3h** (`tetoSegundosDia`, constante única) | reset junto com a virada de dia local (`chaveDia`) |
| $ por vitória | $2 | **8%** dos $25 da soloq ativa |
| $ por derrota | $0 (derrota só dá maestria) | mantém a razão econômica **constante e imune ao winrate** |
| Maestria V / D | +0.4 / +0.15 | **10%** dos +4/+1.5 da partida ativa |
| Chance de drop | 7% por vitória | vs 25% da vitória ativa |
| Raridade do drop | **SEMPRE Comum (1)** | cap inviolável via `gerarItemGrind` |
| Força do inimigo | 47–53 (~neutro) | normal é casual: sem dificuldade de elo |

**Conflito prompt × código real (Regra 10):** o prompt pedia drops "Comum/Incomum",
mas o jogo **não tem** tier "Incomum" — a escala é Comum(1)/Raro(2)/Épico/Lendário/
Mítico. Como a Regra 1 proíbe "Rara ou acima" e a raridade 2 se chama literalmente
"Raro", o cap ficou na **Comum**. Buffar depois é fácil; nerfar gera revolta.

## Simulação econômica (4 semanas, teste automatizado)

Cenário: jogador médio (atributos 50, maestria 50) deixa o grind **no teto todos
os dias por 28 dias**, vs o mesmo jogador jogando **12 soloq ativas/dia** (baseline
conservador: só bônus de vitória e maestria — sem salário, stream ou drops, que
deixariam o ativo ainda maior e a razão menor).

| | Grind no teto | Jogo ativo | Razão |
|---|---|---|---|
| Partidas | 546 | 336 | — |
| `$` | $514 | $4.175 | **12,3%** ✅ |
| Maestria | 146,2 | 921,5 | **15,9%** ✅ |

Critério da rodada (≤ ~15-20%) atendido com folga. O teste
(`engine/grind.test.ts` · "ECONOMIA: 4 semanas…") trava essas razões pra sempre:
qualquer mudança de constante que estoure 20% quebra o CI.

## Arquitetura (Regras 4-7 na prática)

- **Engine puro** (`engine/grind.ts`): `resolverGrind(snapshot, segundosAtivos,
  seedDia)` decide TODAS as partidas do dia em lote, deterministicamente
  (mulberry32; seed nasce na borda). Resultado pela **mesma matemática de combate**
  (`simularPartida` com contexto neutro; `lpDelta` nunca exposto) — nenhum segundo
  sistema. A UI só encena.
- **Tempo**: `Date.now` **não mede progresso** — só gera seed e chave do dia
  (mesmo padrão do ritual diário). O progresso é um acumulador de **segundos de
  heartbeat** que só conta com `document.visibilityState === 'visible'` (tick de
  5s, 1 intervalo único). Zero ganho offline/aba oculta — mexer no relógio do PC
  não rende nada.
- **Idempotência**: checkpoint `partidasAplicadas` no save; reprocessar o mesmo
  lote não duplica recompensa (teste explícito). Suspensão agressiva de mobile
  não corrompe: o estado persistido é (dia, seed, segundos, checkpoint) e o
  reprocessamento é determinístico a partir dele.
- **CPU ~0 em segundo plano**: aba oculta ⇒ o tick sai no guard na primeira linha
  (sem acumular, sem resolver, sem `set`, sem render); sem canvas; sem rAF; sem
  animação contínua (só transições CSS pontuais + flash de 0,9s em vitória).
  *Teste manual (roteiro):* abrir o jogo com grind ativo → trocar de aba por 5min
  → Task Manager do navegador: a aba deve ficar ~0% CPU; ao voltar, o placar
  congelado retoma e o resumo aparece. Verificação de campo pendente de rodar em
  máquina real do dono (o design garante; o roteiro confirma).
- **Persistência parcimoniosa**: o save grava quando algo material muda (partida
  nova, virada de dia, toggle) ou a cada 60s de acúmulo — o heartbeat não spama o
  cloud sync (perda máxima ao fechar a aba: <60s de grind).

## Decisões de UX

- Widget **colapsado** = placar do dia (`3V 1D`) + mini-barra do teto; pontinhos
  de badge quando há resumo pendente (ciano) ou teto atingido (âmbar, "missão
  cumprida"). **Expandido** = partida ao vivo encenada (adversário procedural com
  nick BR de fila), últimas 8 normais (campeão/W-L/KDA/ganhos), total do dia,
  tempo até o teto e toggle LIGAR/PAUSAR. Mobile (≤640px): pílula → bottom sheet.
- **Título da aba** vira `⚔️ 3V 1D · Grind ativo` enquanto roda (congela com a aba
  oculta — correto, o heartbeat pausou); restaura ao pausar/desligar.
- Micro-celebração **leve**: flash na borda + som curto (`moeda` na vitória,
  `tier2` no drop), **sem cerimônia fullscreen** — grind é ambiente, não evento.
  Respeita o mute global (via `tocarSom`).
- **Unlock** na semana 2 (junto de Stream/Loja), com a cerimônia `FEATURE_UNLOCKED`
  reusada e a descrição explicando o teto em 1 frase.
- Ao atingir o teto o jogador "cansa" (😴) com a mensagem de quando volta.
- **Ocultar widget**: no painel de som do HUD (⚙ único lugar de config) e no rodapé
  do widget — o grind **continua acumulando** se estiver ligado.
- Derrota não paga $ (mostra a maestria ganha no lugar) — decisão de calibração
  documentada acima.

## Integração com o mundo (Fase 2)

- **Feed**: `grind_maratona` (5+ vitórias seguidas), `grind_bagre` (5+ derrotas,
  zoeira leve) e `grind_farm` (drop). Relevância baixa e **máximo 1 post de grind
  por semana**; com notícia de verdade na semana, o grind nunca é o post top
  (testado).
- **Recap semanal**: card "Grind de Normais" com partidas/W-L/$/maestria da semana.
- **Hall**: recordes "normais jogadas" e "maior sequência de vitórias em normais".
- **Telemetria**: `grind_ligado/pausado/partida{vitoria,campeao,idx}/teto_atingido/
  resumo_visto`. **Admin** (Engajamento → seção Endgame, migration 016): % dos
  ativos do dia que usaram o grind + distribuição de horas até o teto por
  usuário-dia.

## Kill switch

`GRIND.habilitado` em `data/grind.ts` — `false` desliga widget + heartbeat em
**1 deploy**, sem tocar em nenhum save (gate único `grindDisponivel`, testado).
Se a telemetria mostrar que o grind canibalizou o loop principal, é 1 linha.

## TODO — rodada de monetização (validação server-side)

O estado foi **desenhado pra revalidação futura**: `{seedDia, segundosHoje,
partidasAplicadas}` permitem recomputar `resolverGrind` no servidor e comparar
com o que o cliente aplicou. Enquanto as recompensas forem locais e de baixo
valor ($ de loja, maestria, item Comum), validação server-side é
desproporcional. **Antes de o grind tocar em QUALQUER valor real (CoinPoints,
passe, ranking):**

1. Seed do dia emitida/assinada pelo servidor (não mais `Date.now ^ random` na borda).
2. Heartbeat com atestado server-side (ex.: token por sessão + rate limit) — o
   acumulador local passa a ser só cache.
3. Edge Function recomputa o lote e credita a diferença de forma autoritativa
   (mesmo padrão planejado pra Prova Semanal/duelo).
4. Lembrete histórico (também comentado em `engine/grind.ts`): o Task Bar Hero
   levou dezenas de milhares de cheaters por ligar progressão automática a valor
   real. O nosso grind só cruza essa linha depois de RNG/validação no servidor.

## Checklist final (Definição de Pronto)

- [x] `npm test` (221) e `npm run build` verdes
- [x] Regra 1 testada: nunca PDL/CoinPoints/passe/energia/cargas/Raros+/Lendas/pity
- [x] Teto diário + reset + idempotência (testes)
- [x] Zero `Math.random`/`Date.now` como progresso; determinismo testado
- [x] Aba oculta ⇒ zero render/anim; roteiro de CPU documentado acima
- [x] Save antigo migra sem crash (teste); suspensão mobile segura por design (estado determinístico)
- [x] Simulação 4 semanas: 12,3% ($) e 15,9% (maestria) ≤ 20%
- [x] Kill switch testado; ocultar widget funciona (grind segue acumulando)
- [x] Telemetria + admin (adoção e horas até o teto)
- [x] Mobile 380px: pílula + bottom sheet
