-- Effective-life and activity calorie tracking upgrade.
-- Existing daily_task_records retain their stored base_target values.

alter table public.app_settings
  add column if not exists body_weight_kg numeric null check (body_weight_kg between 25 and 350),
  add column if not exists activity_ai_enabled boolean not null default true,
  add column if not exists default_calories_view text not null default 'today'
    check (default_calories_view in ('today', 'week', 'month'));

update public.task_definitions
set base_target = 30, unit = 'seconds', updated_at = now()
where task_key = 'plank' and base_target = 3;

create table if not exists public.activity_entries (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  activity_time time not null,
  activity_name text not null check (char_length(activity_name) between 1 and 120),
  duration_minutes numeric not null check (duration_minutes > 0 and duration_minutes <= 1440),
  intensity text not null check (intensity in ('light', 'moderate', 'vigorous', 'unknown')),
  confirmed_calories_burned numeric not null check (confirmed_calories_burned >= 0 and confirmed_calories_burned <= 20000),
  ai_estimated_calories_burned numeric null check (ai_estimated_calories_burned between 0 and 20000),
  minimum_calories_burned numeric null check (minimum_calories_burned between 0 and 20000),
  maximum_calories_burned numeric null check (maximum_calories_burned between 0 and 20000),
  confidence text null check (confidence in ('low', 'medium', 'high')),
  assumptions jsonb not null default '[]'::jsonb check (jsonb_typeof(assumptions) = 'array'),
  source text not null check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists activity_entries_updated on public.activity_entries;
create trigger activity_entries_updated before update on public.activity_entries
for each row execute function public.set_updated_at();

alter table public.activity_entries enable row level security;
drop policy if exists "public read activity entries" on public.activity_entries;
create policy "public read activity entries" on public.activity_entries for select to anon, authenticated using (true);
revoke all on public.activity_entries from public, anon, authenticated;
grant select on public.activity_entries to anon, authenticated;
grant all on public.activity_entries to service_role;

create or replace function public.create_activity_entry(
  p_activity_date date,
  p_activity_time time,
  p_activity_name text,
  p_duration_minutes numeric,
  p_intensity text,
  p_confirmed_calories_burned numeric,
  p_ai_estimated_calories_burned numeric,
  p_minimum_calories_burned numeric,
  p_maximum_calories_burned numeric,
  p_confidence text,
  p_assumptions jsonb,
  p_source text
) returns public.activity_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.activity_entries%rowtype;
begin
  insert into public.activity_entries (
    activity_date, activity_time, activity_name, duration_minutes, intensity,
    confirmed_calories_burned, ai_estimated_calories_burned,
    minimum_calories_burned, maximum_calories_burned,
    confidence, assumptions, source
  ) values (
    p_activity_date, p_activity_time, p_activity_name, p_duration_minutes, p_intensity,
    p_confirmed_calories_burned, p_ai_estimated_calories_burned,
    p_minimum_calories_burned, p_maximum_calories_burned,
    p_confidence, coalesce(p_assumptions, '[]'::jsonb), p_source
  ) returning * into v_entry;
  return v_entry;
end;
$$;

create or replace function public.update_activity_entry(
  p_id uuid,
  p_activity_date date,
  p_activity_time time,
  p_activity_name text,
  p_duration_minutes numeric,
  p_confirmed_calories_burned numeric
) returns public.activity_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.activity_entries%rowtype;
begin
  update public.activity_entries set
    activity_date = p_activity_date,
    activity_time = p_activity_time,
    activity_name = p_activity_name,
    duration_minutes = p_duration_minutes,
    confirmed_calories_burned = p_confirmed_calories_burned
  where id = p_id returning * into v_entry;
  if not found then raise exception 'Activity entry not found'; end if;
  return v_entry;
end;
$$;

create or replace function public.delete_activity_entry(p_id uuid)
returns public.activity_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.activity_entries%rowtype;
begin
  delete from public.activity_entries where id = p_id returning * into v_entry;
  if not found then raise exception 'Activity entry not found'; end if;
  return v_entry;
end;
$$;

drop function if exists public.update_calorie_settings(text, boolean, boolean);
create or replace function public.update_calorie_settings(
  p_default_meal_type text,
  p_ai_enabled boolean,
  p_activity_ai_enabled boolean,
  p_body_weight_kg numeric,
  p_default_calories_view text,
  p_require_confirmation boolean
) returns public.app_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.app_settings%rowtype;
begin
  update public.app_settings set
    default_meal_type = p_default_meal_type,
    ai_food_analysis_enabled = p_ai_enabled,
    activity_ai_enabled = p_activity_ai_enabled,
    body_weight_kg = p_body_weight_kg,
    default_calories_view = p_default_calories_view,
    require_ai_confirmation = p_require_confirmation
  where singleton = true returning * into v_settings;
  return v_settings;
end;
$$;

create or replace function public.reset_entire_system()
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('my-life-system:reset', 0));
  delete from public.task_carryovers;
  delete from public.daily_task_records;
  delete from public.activity_entries;
  delete from public.lifecycle_effects;
  delete from public.lifecycle_adjustments;
  delete from public.food_entries;
  delete from public.smoking_entries;
  delete from public.admin_pin_attempts;
  delete from public.task_definitions;

  update public.system_settings set birth_date = date '2003-01-08', target_date = date '2063-01-08', timezone = 'Asia/Singapore',
    explore_world_score = 33, relationship_score = 33, family_score = 33 where singleton = true;
  update public.app_settings set website_name = 'My Life System', language = 'en', timezone = 'Asia/Singapore', target_age = 60,
    exercise_world_delta = 1, exercise_relationship_delta = 1, exercise_family_delta = 1,
    dessert_world_delta = -1, dessert_relationship_delta = -1, dessert_family_delta = -1,
    smoking_world_delta = -1, smoking_relationship_delta = -1, smoking_family_delta = -1,
    default_meal_type = 'auto', ai_food_analysis_enabled = true, activity_ai_enabled = true,
    body_weight_kg = null, default_calories_view = 'today', require_ai_confirmation = true,
    default_landing_page = '/', desktop_sidebar_mode = 'expanded', mobile_date_range = 7
  where singleton = true;
  insert into public.task_definitions (task_key, name, unit, base_target, display_order) values
    ('running', 'Running', 'minutes', 15, 1),
    ('push_up', 'Push-up', 'reps', 20, 2),
    ('sit_up', 'Sit-up', 'reps', 20, 3),
    ('plank', 'Plank', 'seconds', 30, 4);
end;
$$;

revoke execute on function public.create_activity_entry(date, time, text, numeric, text, numeric, numeric, numeric, numeric, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.update_activity_entry(uuid, date, time, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.delete_activity_entry(uuid) from public, anon, authenticated;
revoke execute on function public.update_calorie_settings(text, boolean, boolean, numeric, text, boolean) from public, anon, authenticated;
revoke execute on function public.reset_entire_system() from public, anon, authenticated;
grant execute on function public.create_activity_entry(date, time, text, numeric, text, numeric, numeric, numeric, numeric, text, jsonb, text) to service_role;
grant execute on function public.update_activity_entry(uuid, date, time, text, numeric, numeric) to service_role;
grant execute on function public.delete_activity_entry(uuid) to service_role;
grant execute on function public.update_calorie_settings(text, boolean, boolean, numeric, text, boolean) to service_role;
grant execute on function public.reset_entire_system() to service_role;
