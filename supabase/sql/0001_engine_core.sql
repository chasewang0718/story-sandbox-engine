create extension if not exists "pgcrypto";

create table if not exists public.world_states (
  id uuid primary key default gen_random_uuid(),
  timeline_label text not null default 'mainline',
  tick integer not null,
  world_state jsonb not null,
  created_at timestamptz not null default now(),
  unique (timeline_label, tick)
);

create index if not exists world_states_timeline_tick_idx
  on public.world_states (timeline_label, tick desc);

create table if not exists public.event_logs (
  id bigserial primary key,
  tick integer not null,
  event_type text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists event_logs_tick_idx
  on public.event_logs (tick desc);
