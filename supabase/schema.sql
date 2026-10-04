-- Run in Supabase → SQL Editor. Safe to re-run.

create table if not exists sensor_logs (
  id bigint generated always as identity primary key,
  tma double precision,
  moisture double precision,
  ultrasonic double precision,
  risk_index double precision,
  created_at timestamptz not null default now()
);

-- Kolom ultrasonic menampung D (jarak ultrasonic cm) untuk skor W.
alter table sensor_logs add column if not exists ultrasonic double precision;

alter table sensor_logs enable row level security;
drop policy if exists "anon insert" on sensor_logs;
create policy "anon insert" on sensor_logs for insert to anon with check (true);
drop policy if exists "anon read" on sensor_logs;
create policy "anon read" on sensor_logs for select to anon using (true);
