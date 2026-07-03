# CHANGELOG — Painel Admin (Carreira LoL)

Painel interno em `/admin`, acessível só pelo dono do jogo. Responde perguntas de
retenção/funil/economia e habilita suporte ao jogador + live-ops básico.

Definições das métricas: [`docs/admin-metricas.md`](docs/admin-metricas.md).

---

## Decisões de arquitetura (valem pra todas as fases)

- **Autorização (o limite real)**: papel `profiles.role='admin'`. Toda rota
  `app/api/admin/*` chama `requireAdmin(req)` → valida o **Bearer token** via
  service role (`auth.getUser`) e checa o papel em `profiles`. A decisão pura
  `autorizarAdmin(role)` é testada.
- **Middleware é só UX**: a auth é em **localStorage** (não cookie), então o
  middleware **não** consegue ler a sessão. Ele só bloqueia `/admin/:path+` por um
  marcador de cookie (`carreira_admin`) pra evitar flash de tela; **não é**
  fronteira de segurança. A decisão pura `decidirRotaAdmin` é testada.
- **Service role key**: só em `SUPABASE_SERVICE_ROLE_KEY` (server env). Nunca
  `NEXT_PUBLIC_`, nunca no bundle. Verificado por grep em `.next/static` a cada
  fase. Sem a key, o admin é **fail-closed** (503).
- **Agregação no Postgres**: funções `admin_*` `SECURITY DEFINER` +
  `revoke execute from public`. O Node nunca puxa a tabela de eventos inteira.
- **Auditoria**: toda ação administrativa grava em `admin_audit_log` com **motivo
  obrigatório**, na **mesma transação** da mutação (não dá pra mudar sem log).
- **Tempo**: UTC no banco, America/São_Paulo só na UI.
- **RLS do jogo intocada**: o painel lê com service role (que bypassa RLS) só
  depois do `requireAdmin`. As policies dos jogadores não mudaram.

---

## Fase 0 — Fundação (auth, auditoria, dados) · migration 010

- `profiles.role/banned_at/flagged_at` (jogador não altera — revoke update).
- `is_admin(uid)`, `admin_audit_log` (RLS sem policy de cliente), `app_config`
  (chaves públicas lidas pelo jogo com anon key; escrita só service role) com
  defaults **fail-open** (`feature_flags` tudo `true`, `mensagem_do_dia` inativa).
- Índice de telemetria pra funis + `admin_dau` (métrica de sanidade).
- Camada Node: `supabaseAdmin`, `adminAuth`, `adminRoute`, `adminHandler`,
  `adminClient`, `middleware`, kit de UI (`components/admin/ui`), contexto de
  período.

## Fase 1 — Visão Geral + Retenção · migration 011

- `admin_kpis`, `admin_dau_novos`, `admin_retencao_coortes` (D1/D3/D7/D14/D30 por
  semana de coorte), `admin_sessoes` (p50/p75/p90 via sessionização, gap 30 min),
  `admin_sessoes_hist`, `admin_sobrevivencia`.
- Evento `sessao_fim` best-effort pra refinar a cauda da sessão daqui pra frente.

## Fase 2 — Funis + abandono + ritual · migration 012

- `admin_funil_onboarding`, `admin_funil_progressao` (usuários distintos por
  passo), `admin_abandono` (churned 7+ dias por elo/semana/tela), `admin_ritual`
  (DAU vs puxada grátis, streaks, escudos).
- Evento `carreira_criada` no topo do funil.

## Fase 3 — Economia + Engajamento + anomalias · migration 013

- `admin_economia` (criado/destruído, por motivo, saldo, top 20), `admin_gacha`
  (observado vs esperado, pity no 5★), `admin_itens` (drops/reroll/desmonte),
  `admin_anomalias`, `admin_engajamento` (skip por cerimônia, uso de feature,
  nível de passe).
- Detector `classificarAnomalia` (delta = saldo − soma dos eventos) + testes.
- Eventos enriquecidos (best-effort, pequenos, documentados): `coinpoints
  {delta,motivo,saldo}`, `gacha_puxada.raridades[]`, `item_reroll`,
  `item_desmonte`, `cerimonia_vista {tipo}`.
- **Princípio**: preferimos **adicionar o evento que faltava** (pequeno e
  documentado) a inventar a métrica com dado ruim.

## Fase 4 — Ficha, integridade e live-ops · migration 014

- **Ficha de jogador** (`admin_buscar_jogador`, `admin_ficha`): busca por
  nick/e-mail/user_id; perfil + save/inventário/passe + duelos + provas + últimos
  100 eventos + flag de anomalia de saldo.
- **Ações auditadas** (todas exigem motivo, gravam no audit log na mesma
  transação): `admin_ajustar_coinpoints` (nunca UPDATE solto; o `ajustar_coinpoints`
  original só mexe no próprio `auth.uid()`, por isso a versão admin com alvo),
  `admin_set_flag`, `admin_set_ban`, `admin_invalidar_prova` (zera o score visível
  preservando o original em `detalhe`, reversível). Validação client-side
  `validarAcao` (testada) + recusa de motivo vazio na própria função SQL — defesa
  em profundidade.
- **Tela de auditoria**: log completo (quem, quando, alvo, motivo, detalhe).
- **Integridade do leaderboard**: `admin_prova_outliers` (z-score na semana),
  `admin_duelo_suspeitos` (≥10 jogos e ≥90% winrate). Botão de invalidar mora na
  ficha (auditado).
- **Live-Ops** (`admin_set_config`, auditado): editor de `feature_flags` (kill
  switches) e `mensagem_do_dia`.
  - No jogo: `liveopsStore` lê as chaves públicas com anon key; helper
    `featureLigada` é **fail-open** (só desliga com `false` explícito) — testado.
    `FeatureGate` protege gacha / duelo online / prova; `compartilharCartao` checa
    a flag `compartilhamento`. Desligar no painel reflete no jogo **sem deploy**.
  - `MensagemDoDia`: banner lido **uma vez por dia** (dispensa por assinatura
    data+conteúdo no localStorage).
  - **Ban**: `AuthGate` checa `profiles.banned_at` no login/sync e mostra
    `TelaBanido` (mensagem **neutra**); desbanir reverte.
- Doc de métricas: `docs/admin-metricas.md`.

### Checklist de segurança (Fase 4)

- [x] Não-admin bloqueado no **middleware** (`decidirRotaAdmin` testado) **e** na
      **API** (`autorizarAdmin` testado).
- [x] Toda ação administrativa exige motivo e grava no audit log (SQL recusa
      motivo vazio; `validarAcao` testado; auditoria atômica na função).
- [x] Kill switch é **fail-open** (`featureLigada` testado com config
      ausente/ilegível → ligado).
- [x] Service role key fora do bundle do cliente (grep em `.next/static`).

---

## TODO — rodada de monetização (quando CoinPoints valer dinheiro)

- **Validação autoritativa no servidor**: recalcular score de Prova e resultado de
  duelo a partir do seed via **Edge Function** (hoje são auto-reportados; o painel
  faz só triagem por z-score/winrate). Score/resultado deixam de ser confiáveis do
  cliente.
- **CoinPoints premium autoritativo**: remover qualquer caminho de crédito no
  cliente; toda concessão passa a ser server-side assinada. O detector de anomalia
  vira alarme, não só relatório.
- **Reconciliação**: job que compara saldo × ledger de eventos e trava contas com
  divergência alta pendente de revisão.
