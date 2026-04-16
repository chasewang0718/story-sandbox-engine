-- Scope event logs per narrative branch (timeline).

alter table public.event_logs
  add column if not exists timeline_label text not null default 'mainline';

create index if not exists event_logs_timeline_id_idx
  on public.event_logs (timeline_label, id desc);
