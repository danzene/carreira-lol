# Painel Admin — definições de métricas

Referência única do que cada número no painel significa. Se a UI e este doc
divergirem, **este doc é a intenção** — corrija a UI.

## Convenções gerais

- **Fuso**: tudo é gravado em **UTC** no banco. A conversão para
  **America/São_Paulo** acontece **só na UI** (`fmtData`/`fmtDataHora`).
- **"Dia"**: dia-calendário **UTC** (`created_at::date`). Um jogador está "ativo
  no dia" se emitiu **≥1 evento de telemetria** naquele dia.
- **Período** (7/14/30 dias, "tudo"): filtro global no topo do painel. `dias=0`
  significa "sem filtro de data".
- **Fonte**: quase tudo vem de `telemetria_eventos` (append-only, sem PII além do
  `user_id`). Saldo/estado vêm das tabelas de conta (`profiles`, `battle_pass`…).
- **Agregação**: 100% em funções SQL (`admin_*`), `SECURITY DEFINER`, com
  `revoke execute … from public` — só a service role chama, e só depois do
  `requireAdmin()`. **Nada** puxa a tabela inteira pro Node.

## Sessão

- **Sessionização**: eventos do mesmo `user_id` são agrupados em sessões; um gap
  de **≥ 30 min** entre eventos abre uma sessão nova (window function
  `lag(created_at)`).
- **Duração da sessão** = último − primeiro evento da sessão. Sessão de 1 evento
  tem duração 0. Percentis **p50/p75/p90** por período.
- Ressalva: como a duração é derivada de eventos, ela **subestima** o tempo até o
  primeiro/depois do último evento. Há um evento `sessao_fim` best-effort pra
  refinar a cauda daqui pra frente.

## Coorte / retenção

- **Coorte semanal**: jogadores agrupados pela **semana UTC do primeiro evento**
  (proxy de "primeiro acesso").
- **DN (D1/D3/D7/D14/D30)** = % da coorte que teve **≥1 evento** no dia N *após* o
  primeiro (janela do dia-calendário). Coortes jovens demais pra ter completado a
  janela aparecem vazias (não como 0%).
- **Curva de sobrevivência**: % da coorte ainda ativa em cada semana desde o
  início.

## Funil

- Cada etapa conta **usuários distintos** que atingiram aquele passo (não
  eventos). Conversão exibida é relativa ao **topo** e à **etapa anterior**.
- **Onboarding**: Cadastro → Criou jogador → 1ª partida → 1ª vitória → 1º drop →
  1ª puxada → Voltou no D1.
- **Progressão longa**: Criou → Semana 2 → Booster → Itens → Passe → Nível 10 →
  Passe completo (60) → Online → 1º duelo → 1ª Prova.
- **Ponto de abandono**: entre os "churned" (7+ dias sem evento), onde estava o
  **último** evento — por elo, por semana de vida e por tela.

## Economia

- **Fonte da economia**: evento `coinpoints {delta, motivo, saldo}` emitido no
  `ajustar_coinpoints` (best-effort). `delta>0` = **fonte**; `delta<0` = **sink**.
- **Criado/destruído por dia**: soma de deltas positivos e negativos.
- **Distribuição de saldo**: histograma de `profiles.coinpoints` (faixas
  0 / <200 / 200–1k / 1k–5k / 5k+).
- **Gacha — observado vs esperado**: `raridade_obs` conta **cada carta** puxada
  (evento `gacha_puxada.raridades[]`); a coluna "esperado" vem de `RARIDADES` em
  `data/gacha`. O **pity** distorce o topo pra cima — divergência lá é normal.
- **Pity no 5★**: histograma do `pity` no momento em que saiu um 5★.
- **Anomalia de economia** (`admin_anomalias` + `classificarAnomalia`): compara
  `saldo` com a **soma dos deltas** registrados. `delta = saldo − soma_eventos`;
  severidade **ok ≤100 < baixa ≤500 < media ≤2000 < alta**. É **triagem** — há
  falsos positivos (telemetria é best-effort). Validação autoritativa fica pra
  Edge Function na monetização.

## Engajamento

- **Taxa de skip por cerimônia** = `cerimonia_pulada / cerimonia_vista` por tipo.
  `cerimonia_vista` é evento **novo** — a taxa só é confiável a partir da sua
  emissão.
- **Partidas por modo**, **cartões compartilhados por tipo**, **duelos**,
  **provas**: contagens de eventos no período.
- **Nível do passe**: distribuição de `least(60, floor(pp/100)+1)` sobre
  `battle_pass`.

## Ficha de jogador

- Busca por **nick** (ilike), **e-mail** (auth.users, ilike) ou **user_id**.
- Ficha: perfil + resumo de save/inventário + nível de passe + duelos (10 mais
  recentes) + provas + **últimos 100 eventos** de telemetria + flag de anomalia de
  saldo.

## Integridade do leaderboard

- **Prova — outliers**: **z-score** do score dentro da **semana**
  (`(score − média) / desvio_padrão`). z ≥ 3 é destacado. É triagem; a validação
  definitiva recalcula do seed por Edge Function (monetização).
- **Duelos — winrates impossíveis**: contas com **≥10 jogos** e **≥90%** de
  vitória. Duelo é determinístico, mas o desafiante **escolhe** quem enfrentar.

## Segurança (resumo — detalhe no CHANGELOG-admin)

- Papel `profiles.role='admin'`. `requireAdmin()` (Bearer token → papel) é o
  **único** limite real; o middleware é só UX (não lê a sessão do localStorage).
- Service role key vive **só** em `SUPABASE_SERVICE_ROLE_KEY` (server-side), nunca
  `NEXT_PUBLIC`, nunca no bundle do cliente.
- **Toda** ação administrativa grava em `admin_audit_log` com **motivo**
  obrigatório, na **mesma transação** da mutação.
- Saldo de outra conta só muda via `admin_ajustar_coinpoints` (nunca UPDATE
  solto). Ban seta `profiles.banned_at`; o jogo checa no login/sync e mostra tela
  neutra. Flags de live-ops são lidas em **fail-open** (falha = ligado).
