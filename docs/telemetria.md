# Telemetria — eventos e queries

Rodar a migration `supabase/migrations/005_telemetria.sql` no SQL Editor. O cliente **só
insere** (RLS); toda análise é feita aqui, no SQL Editor do Supabase.

## Eventos instrumentados

| evento | props | onde dispara |
|---|---|---|
| `sessao_inicio` | `semana, temporada, elo, streak` | 1x por carregamento, no dashboard |
| `streak_dia` | `streak, evento` (primeiro/continuou/escudo/zerou) | login diário novo |
| `partida_fim` | `modo` (soloq/liga/evento/torneio), `vitoria, nota, elo` | toda partida aplicada |
| `drop_item` | `raridade, iLvl` | drop de item |
| `gacha_puxada` | `qtd, melhor, pity, gratis` | puxada no Booster |
| `cerimonia_pulada` | `tipo` | fechou cerimônia em <1,5s (juice cansando) |
| `passe_nivel` | `nivel` | level up do passe |
| `duelo_fim` | `venceu, poderRival` | duelo online |
| `tela_visitada` | `rota` | navegação (throttle 30s/rota) |
| `feature_desbloqueada` | `feature` | unlock progressivo |

## Queries prontas

### 1. Retenção D1/D7 aproximada (por coorte de primeiro dia)
```sql
with primeiro as (
  select user_id, min(created_at::date) as d0
  from telemetria_eventos where evento = 'sessao_inicio' group by user_id
)
select
  p.d0,
  count(distinct p.user_id) as jogadores,
  count(distinct case when t.created_at::date = p.d0 + 1 then t.user_id end) as d1,
  count(distinct case when t.created_at::date = p.d0 + 7 then t.user_id end) as d7
from primeiro p
left join telemetria_eventos t on t.user_id = p.user_id and t.evento = 'sessao_inicio'
group by p.d0 order by p.d0 desc;
```

### 2. Funil de unlock (quantos chegam em cada feature)
```sql
select props->>'feature' as feature, count(distinct user_id) as jogadores
from telemetria_eventos where evento = 'feature_desbloqueada'
group by 1 order by 2 desc;
```

### 3. Onde as sessões morrem (último elo visto por jogador inativo há 3+ dias)
```sql
with ultima as (
  select distinct on (user_id) user_id, props->>'elo' as elo, created_at
  from telemetria_eventos where evento = 'partida_fim'
  order by user_id, created_at desc
)
select elo, count(*) as jogadores_parados
from ultima where created_at < now() - interval '3 days'
group by elo order by 2 desc;
```

### 4. Taxa de skip de cerimônia por tipo (juice cansando?)
```sql
select props->>'tipo' as tipo, count(*) as puladas, count(distinct user_id) as jogadores
from telemetria_eventos where evento = 'cerimonia_pulada'
group by 1 order by 2 desc;
```

### 5. Uso da puxada diária grátis (hábito formado?)
```sql
select created_at::date as dia,
  count(*) filter (where (props->>'gratis')::boolean) as gratis,
  count(*) filter (where not (props->>'gratis')::boolean) as pagas
from telemetria_eventos where evento = 'gacha_puxada'
group by 1 order by 1 desc;
```
