-- Ejecutar en Supabase Dashboard > SQL Editor

create table tareas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  completed boolean default false not null,
  date date,
  created_at timestamptz default now() not null
);

alter table tareas enable row level security;

create policy "Users manage their own tasks"
  on tareas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
