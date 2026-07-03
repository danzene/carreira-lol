# Rodada "Mundo Vivo & Endgame" — CHANGELOG

A rodada anterior resolveu o "sentir bem"; esta resolve o **"ter por que voltar no mês 2"**:
telemetria, mundo que reage (feed), objetivo semanal (Prova), temporadas no duelo,
viralidade (cartão) e proteção anti-tilt. **Sem monetização nesta rodada.**

## Fase 0 — Telemetria + débitos técnicos

- **Telemetria** (`lib/telemetria.ts` + migration `005`): fila em memória, flush em lote
  (20 eventos / 30s / visibilitychange), fire-and-forget com **falha silenciosa** e cap
  de fila. RLS **insert-only** — o cliente nunca lê (nem as próprias linhas).
  Eventos: `sessao_inicio`, `streak_dia`, `partida_fim` (4 modos), `drop_item`,
  `gacha_puxada` (pity/grátis), `cerimonia_pulada` (fechou em <1,5s), `passe_nivel`,
  `duelo_fim`, `tela_visitada` (throttle 30s), `feature_desbloqueada`,
  `entrevista_respondida`, `prova_fim`, `cartao_compartilhado`.
  **5 queries prontas** em `docs/telemetria.md` (retenção D1/D7, funil de unlock, onde
  as sessões morrem por elo, taxa de skip de cerimônia, uso da puxada diária).
- **Débito 1 quitado**: sorteio de campeão do Booster saiu da página (`Math.random`)
  pro engine seedado (`sortearCampeaoBooster`) com teste de distribuição.
- **Débito 2 quitado**: periféricos antigos REMOVIDOS. **Decisão de conversão:
  reembolso integral em $** — nível N custou `200N + 125N(N−1)`; a migração
  (`normalizarCareer`) credita e zera `equipamentos`. Idempotente, testado.

## Fase 1 — Feed vivo + entrevista pós-jogo

- `engine/feed.ts` (puro): `gerarPostsFeed(estado, fatos, seed)` determinístico.
  **6 arquétipos** com voz própria: analista (frio), torcedor (CAPS), hater
  (zoeiro, **nunca cruel**), veículo de notícia, meme account e o **RIVAL em pessoa**
  (handle derivado do time). Templates pt-BR com placeholders e 2-3 variações.
- Gatilhos: título, promoção (+80 LP na semana — aproximação documentada), stomp
  (nota 8,5+), sequências, campeão-problema (3+ derrotas no mesmo campeão), rival
  provoca, drop mítico, semana sólida (fallback). **Volume: 2-5 posts/semana, 0 em
  semana morta.** Likes fake por seed escalando com relevância.
- UI: tela `/feed`, badge de não-vistos, top 2 posts no recap ("O MUNDO REAGIU").
- **Entrevista** (máx. 1/semana; gatilhos: título internacional, campeão da liga,
  vitória sobre rival): humilde (+2 rep, +5 moral) / confiante (+4 rep) /
  **provocadora** (+5 rep e ACENDE rivalidade). A fala vira post com aspas.

## Fase 2 — Prova Semanal

- `engine/prova.ts` (puro): prova derivada da **semana ISO real** — mesma prova e
  mesma seed em qualquer cliente. Reset segunda 00:00 **no fuso do cliente**
  (aceitável nesta versão; validação server-side futura usará UTC).
- **10 modificadores** honrados pelo engine (testados): Especialistas (M20+),
  Monoclasse, Setup Cru, Sem Cartas, Xadrez (counters ×2), Espelho, Rei do KDA,
  Chefões, Comp Cega, Nota de Ouro. Regras valem pro **lobby inteiro** (IA inclusa).
- 3 partidas **laterais** (sem energia, sem elo/liga), score agregado puro,
  4ª partida bloqueada, semana nova reabre.
- Servidor (`006`): `prova_semanal_scores` UNIQUE(user_id, semana), RLS escreve o
  próprio / lê todos. **Score auto-reportado** — `detalhe` guarda seed + mods +
  resultados + resumo **pra revalidação futura por Edge Function** (comentado).
- Recompensas SEM CoinPoints: item garantido (sorte alta) + título "Prova Semanal
  S{n}"; **top 10% da semana anterior** ganha "Lenda da Prova S{n}" (checagem
  client-side com dados públicos; concessão validada = TODO).

## Fase 3 — Temporadas do duelo

- `engine/temporadaDuelo.ts` (puro): temporada = **ciclos de 3 semanas** a partir de
  época fixa UTC (05/01/2026) — todos os clientes concordam.
- **Soft reset**: `novo = 1000 + (antigo − 1000) × 0,5`, **lazy e idempotente** (só
  quando `temporada_rating < atual`; pular várias temporadas aplica **1x** — decisão
  documentada). Rating **elo-lite** (base ±20, ajuste por diferença de poder,
  teto 32 / piso 8), auto-reportado como o resto do duelo.
- Fim de temporada: **título exclusivo por tier final** ("T2: Ouro no Duelo" — nunca
  volta) + cerimônia mostrando o ajuste. Tiers: Bronze → Prata (1040) → Ouro (1120)
  → Diamante (1250) → Lenda (1400). Hall ganha seção "TÍTULOS DE ÉPOCA".
- Migration `007`: `rating`/`temporada_rating` em `duel_snapshots`, `temporada` em
  `duelos`. Histórico/replay seguem funcionando entre temporadas.

## Fase 4 — Cartão compartilhável + Anti-tilt

- **Cartão** (`lib/cartao.ts`): PNG **1200×630** desenhado em canvas offscreen —
  gradiente escuro, estrelinhas pixel (seed fixa), moldura dupla na **cor do elo**,
  emoji do marco, destaque com glow, nick+elo e URL no rodapé. **Web Share API com
  arquivo** (mobile) → fallback **download + texto no clipboard**. Botões em:
  promoção de elo, drop mítico ("FLEXAR O DROP"), recap semanal, Prova concluída e
  títulos no Hall. Telemetria `cartao_compartilhado`.
- **Auditoria anti-tilt** (números medidos por `engine/antiTilt.test.ts`):
  - A moral **não** entra no cálculo da partida → não há espiral via moral.
  - A espiral **estatística** existe: em 150 corridas × 25 partidas (Prata IV),
    ocorreram **44 sequências de 5+ derrotas** sem compensação.
  - **Pity de derrota** implementado (`pityDerrota`): +1,2 de vantagem oculta por
    derrota consecutiva, **teto 6**, zera ao vencer (deriva do streak). Invisível
    na UI. Resultado: **44 → 26 sequências (redução de 41%)**.
- **Sessão mental com moral <40**: metade do custo (75) e +15 de moral extra.
- **Mensagem humana**: 1 toast por sequência (exatamente na 3ª derrota seguida):
  "Dia difícil? Um treino leve ou um descanso podem virar o jogo. 💜" — sem bronca.

## Decisões & adaptações (regra 9)

- Conversão dos periféricos: **reembolso integral em $** (fórmula acima).
- Soft reset: **0,5 de retenção da distância à base**, 1 aplicação por virada.
- "Promoção" no feed detectada por **+80 LP líquidos na semana** (aproximação — o
  estado não guarda o elo do início da semana).
- Gacha não passa pelo CeremonyManager (o `AnimacaoGacha` já era a cerimônia).
- Ranking do duelo passou de W/L all-time para **rating da temporada**.
- `Math.random` remanescente é só de duas categorias LEGÍTIMAS: geração de **seed na
  borda** (`Date.now() ^ Math.random()`, padrão do repo) e **partículas cosméticas de
  canvas** pré-existentes (explosões/shake — nenhuma decide resultado de jogo). Toda
  decisão de jogo é seedada.

## TODOs pra rodada de monetização

1. **Validação da Prova por Edge Function** (o `detalhe` já carrega tudo) + concessão
   server-side do título de topo.
2. **Premium do passe server-authoritative** (coluna própria, liberada pós-pagamento).
3. **RNG de gacha/itens/passe em Edge Functions** (pré-PvP valendo moeda).
4. **Rating do duelo validado no servidor** (hoje auto-reportado).
5. Recompensas em CoinPoints (streak/prova/temporada) via `ajustar_coinpoints`.
6. Badge de desafio de duelo recebido (precisa de subscription no servidor).

## Migrations pra rodar no SQL Editor (nesta ordem)

`005_telemetria.sql` → `006_prova.sql` → `007_duelo_temporadas.sql`
