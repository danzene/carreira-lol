-- Telemetria mínima: enxergar onde os jogadores param. Sem PII além do user_id.
-- O cliente SÓ INSERE as próprias linhas — nunca lê (nem as suas): análise é pelo SQL Editor.

create table if not exists public.telemetria_eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  evento text not null,
  props jsonb not null default '{}'::jsonb,
  client_ts timestamptz,
  created_at timestamptz not null default now()
);

alter table public.telemetria_eventos enable row level security;

-- só INSERT (nenhum select/update/delete pro cliente)
grant insert on public.telemetria_eventos to authenticated;

drop policy if exists "telemetria: inserir o proprio" on public.telemetria_eventos;
create policy "telemetria: inserir o proprio" on public.telemetria_eventos
  for insert to authenticated with check (auth.uid() = user_id);

create index if not exists telemetria_evento_idx on public.telemetria_eventos (evento, created_at);
create index if not exists telemetria_user_idx on public.telemetria_eventos (user_id, created_at);
