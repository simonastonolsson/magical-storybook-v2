-- Stores each user's trained LoRA models so they persist across sessions/devices.
create table if not exists public.user_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_path text not null,
  model_name text not null,
  trigger_word text not null,
  char_desc text,
  reference_image_url text,
  created_at timestamptz not null default now()
);

create index if not exists user_models_user_id_idx on public.user_models (user_id);

alter table public.user_models enable row level security;

create policy "Users can view their own models"
  on public.user_models for select
  using (auth.uid() = user_id);

create policy "Users can insert their own models"
  on public.user_models for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own models"
  on public.user_models for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own models"
  on public.user_models for delete
  using (auth.uid() = user_id);
