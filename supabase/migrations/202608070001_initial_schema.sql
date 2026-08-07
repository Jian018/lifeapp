-- My Life System — initial Supabase schema
-- Public reads are allowed; browser writes are denied. All mutations must use
-- the service role after the Next.js server validates the management session.

create extension if not exists pgcrypto;

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  birth_date date not null default date '2003-01-08',
  target_date date not null default date '2063-01-08',
  timezone text not null default 'Asia/Singapore',
  explore_world_score numeric(6,2) not null default 33 check (explore_world_score between 0 and 100),
  relationship_score numeric(6,2) not null default 33 check (relationship_score between 0 and 100),
  family_score numeric(6,2) not null default 33 check (family_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_date > birth_date)
);

create table public.task_definitions (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  name text not null,
  unit text not null,
  base_target numeric(10,2) not null check (base_target > 0),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_task_records (
  id uuid primary key default gen_random_uuid(),
  task_definition_id uuid not null references public.task_definitions(id) on delete restrict,
  record_date date not null,
  base_target numeric(10,2) not null check (base_target >= 0),
  carried_target numeric(10,2) not null default 0 check (carried_target >= 0),
  total_target numeric(10,2) not null check (total_target >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'carried')),
  completed_at timestamptz,
  carried_to_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_definition_id, record_date),
  check (total_target = base_target + carried_target),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed'),
  check ((status = 'carried' and carried_to_date is not null) or status <> 'carried')
);

create table public.task_carryovers (
  id uuid primary key default gen_random_uuid(),
  task_definition_id uuid not null references public.task_definitions(id) on delete restrict,
  source_record_id uuid not null unique references public.daily_task_records(id) on delete restrict,
  source_date date not null,
  target_date date not null,
  amount numeric(10,2) not null check (amount > 0),
  is_reverted boolean not null default false,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  check (target_date = source_date + 1),
  check ((is_reverted and reverted_at is not null) or not is_reverted)
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  entry_time time not null,
  meal_name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'unknown')),
  confirmed_calories integer not null check (confirmed_calories between 0 and 30000),
  ai_estimated_calories integer check (ai_estimated_calories between 0 and 30000),
  minimum_calories integer check (minimum_calories between 0 and 30000),
  maximum_calories integer check (maximum_calories between 0 and 30000),
  food_items jsonb not null default '[]'::jsonb,
  is_dessert boolean not null default false,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(food_items) = 'array'),
  check (jsonb_typeof(assumptions) = 'array'),
  check (minimum_calories is null or maximum_calories is null or minimum_calories <= maximum_calories)
);

create table public.smoking_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  entry_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lifecycle_effects (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('daily_exercise', 'dessert', 'smoking', 'manual_adjustment')),
  source_id uuid not null,
  world_delta numeric(6,2) not null default 0,
  relationship_delta numeric(6,2) not null default 0,
  family_delta numeric(6,2) not null default 0,
  effect_date date not null,
  reason text not null,
  is_reverted boolean not null default false,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  check ((is_reverted and reverted_at is not null) or not is_reverted)
);

create unique index uq_lifecycle_effects_active_source
  on public.lifecycle_effects (source_type, source_id)
  where is_reverted = false;

create table public.lifecycle_adjustments (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('explore_world', 'relationship', 'family')),
  delta numeric(6,2) not null check (delta between -100 and 100 and delta <> 0),
  reason text not null check (char_length(trim(reason)) >= 3),
  created_at timestamptz not null default now()
);

create index idx_daily_task_records_date on public.daily_task_records(record_date);
create index idx_task_carryovers_target on public.task_carryovers(target_date, task_definition_id) where is_reverted = false;
create index idx_food_entries_date on public.food_entries(entry_date, entry_time);
create index idx_smoking_entries_date on public.smoking_entries(entry_date, entry_time);
create index idx_lifecycle_effects_date on public.lifecycle_effects(effect_date, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger system_settings_updated before update on public.system_settings for each row execute function public.set_updated_at();
create trigger task_definitions_updated before update on public.task_definitions for each row execute function public.set_updated_at();
create trigger daily_task_records_updated before update on public.daily_task_records for each row execute function public.set_updated_at();
create trigger food_entries_updated before update on public.food_entries for each row execute function public.set_updated_at();
create trigger smoking_entries_updated before update on public.smoking_entries for each row execute function public.set_updated_at();

insert into public.system_settings (singleton) values (true) on conflict (singleton) do nothing;
insert into public.task_definitions (task_key, name, unit, base_target, display_order) values
  ('running', 'Running', 'minutes', 15, 1),
  ('push_up', 'Push-up', 'reps', 20, 2),
  ('sit_up', 'Sit-up', 'reps', 20, 3),
  ('plank', 'Plank', 'seconds', 3, 4)
on conflict (task_key) do nothing;

-- Apply an idempotent lifecycle effect and record the actual clamped delta.
create or replace function public.apply_lifecycle_effect(
  p_source_type text, p_source_id uuid, p_world_delta numeric,
  p_relationship_delta numeric, p_family_delta numeric,
  p_effect_date date, p_reason text
) returns public.lifecycle_effects
language plpgsql security definer set search_path = public as $$
declare
  v_settings public.system_settings%rowtype;
  v_effect public.lifecycle_effects%rowtype;
  v_world numeric;
  v_relationship numeric;
  v_family numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source_type || ':' || p_source_id::text, 0));
  select * into v_effect from public.lifecycle_effects where source_type = p_source_type and source_id = p_source_id and not is_reverted limit 1;
  if found then return v_effect; end if;

  select * into v_settings from public.system_settings where singleton = true for update;
  v_world := greatest(0, least(100, v_settings.explore_world_score + p_world_delta)) - v_settings.explore_world_score;
  v_relationship := greatest(0, least(100, v_settings.relationship_score + p_relationship_delta)) - v_settings.relationship_score;
  v_family := greatest(0, least(100, v_settings.family_score + p_family_delta)) - v_settings.family_score;

  update public.system_settings set
    explore_world_score = explore_world_score + v_world,
    relationship_score = relationship_score + v_relationship,
    family_score = family_score + v_family
  where singleton = true;

  insert into public.lifecycle_effects (source_type, source_id, world_delta, relationship_delta, family_delta, effect_date, reason)
  values (p_source_type, p_source_id, v_world, v_relationship, v_family, p_effect_date, p_reason)
  returning * into v_effect;
  return v_effect;
end;
$$;

create or replace function public.revert_lifecycle_effect(p_source_type text, p_source_id uuid)
returns public.lifecycle_effects
language plpgsql security definer set search_path = public as $$
declare v_effect public.lifecycle_effects%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source_type || ':' || p_source_id::text, 0));
  select * into v_effect from public.lifecycle_effects where source_type = p_source_type and source_id = p_source_id and not is_reverted for update;
  if not found then return null; end if;
  update public.system_settings set
    explore_world_score = greatest(0, least(100, explore_world_score - v_effect.world_delta)),
    relationship_score = greatest(0, least(100, relationship_score - v_effect.relationship_delta)),
    family_score = greatest(0, least(100, family_score - v_effect.family_delta))
  where singleton = true;
  update public.lifecycle_effects set is_reverted = true, reverted_at = now() where id = v_effect.id returning * into v_effect;
  return v_effect;
end;
$$;

create or replace function public.sync_daily_exercise_reward(p_record_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_source_id uuid := md5(p_record_date::text || ':daily_exercise')::uuid;
declare v_all_complete boolean;
begin
  select count(*) > 0 and bool_and(coalesce(r.status = 'completed', false)) into v_all_complete
  from public.task_definitions d left join public.daily_task_records r
    on r.task_definition_id = d.id and r.record_date = p_record_date
  where d.is_active;
  if v_all_complete then
    perform public.apply_lifecycle_effect('daily_exercise', v_source_id, 1, 1, 1, p_record_date, 'Completed every active movement task');
  else
    perform public.revert_lifecycle_effect('daily_exercise', v_source_id);
  end if;
end;
$$;

create or replace function public.ensure_daily_task_record(p_task_definition_id uuid, p_record_date date)
returns public.daily_task_records
language plpgsql security definer set search_path = public as $$
declare v_definition public.task_definitions%rowtype; v_carried numeric; v_record public.daily_task_records%rowtype;
begin
  select * into v_definition from public.task_definitions where id = p_task_definition_id and is_active for update;
  if not found then raise exception 'Task not found'; end if;
  select coalesce(sum(amount), 0) into v_carried from public.task_carryovers where task_definition_id = p_task_definition_id and target_date = p_record_date and not is_reverted;
  insert into public.daily_task_records (task_definition_id, record_date, base_target, carried_target, total_target)
  values (p_task_definition_id, p_record_date, v_definition.base_target, v_carried, v_definition.base_target + v_carried)
  on conflict (task_definition_id, record_date) do update set base_target = excluded.base_target, carried_target = excluded.carried_target, total_target = excluded.total_target
  returning * into v_record;
  return v_record;
end;
$$;

create or replace function public.complete_daily_task(p_task_definition_id uuid, p_record_date date)
returns public.daily_task_records
language plpgsql security definer set search_path = public as $$
declare v_record public.daily_task_records%rowtype;
begin
  if p_record_date > (now() at time zone 'Asia/Singapore')::date then raise exception 'Future tasks cannot be completed'; end if;
  v_record := public.ensure_daily_task_record(p_task_definition_id, p_record_date);
  if v_record.status = 'carried' then raise exception 'Revert carryover before completing'; end if;
  update public.daily_task_records set status = 'completed', completed_at = coalesce(completed_at, now()), carried_to_date = null where id = v_record.id returning * into v_record;
  perform public.sync_daily_exercise_reward(p_record_date);
  return v_record;
end;
$$;

create or replace function public.uncomplete_daily_task(p_task_definition_id uuid, p_record_date date)
returns public.daily_task_records
language plpgsql security definer set search_path = public as $$
declare v_record public.daily_task_records%rowtype;
begin
  select * into v_record from public.daily_task_records where task_definition_id = p_task_definition_id and record_date = p_record_date for update;
  if not found or v_record.status <> 'completed' then raise exception 'Task is not completed'; end if;
  update public.daily_task_records set status = 'pending', completed_at = null where id = v_record.id returning * into v_record;
  perform public.sync_daily_exercise_reward(p_record_date);
  return v_record;
end;
$$;

create or replace function public.carry_daily_task(p_task_definition_id uuid, p_record_date date)
returns public.task_carryovers
language plpgsql security definer set search_path = public as $$
declare v_record public.daily_task_records%rowtype; v_carry public.task_carryovers%rowtype;
begin
  if p_record_date > (now() at time zone 'Asia/Singapore')::date then raise exception 'Future tasks cannot be carried'; end if;
  v_record := public.ensure_daily_task_record(p_task_definition_id, p_record_date);
  if v_record.status = 'completed' then raise exception 'Completed tasks cannot be carried'; end if;
  if exists (select 1 from public.task_carryovers where source_record_id = v_record.id and not is_reverted) then raise exception 'Task already carried'; end if;
  insert into public.task_carryovers (task_definition_id, source_record_id, source_date, target_date, amount)
  values (p_task_definition_id, v_record.id, p_record_date, p_record_date + 1, v_record.total_target) returning * into v_carry;
  update public.daily_task_records set status = 'carried', completed_at = null, carried_to_date = p_record_date + 1 where id = v_record.id;
  perform public.sync_daily_exercise_reward(p_record_date);
  return v_carry;
end;
$$;

create or replace function public.revert_daily_task_carry(p_task_definition_id uuid, p_record_date date)
returns public.daily_task_records
language plpgsql security definer set search_path = public as $$
declare v_record public.daily_task_records%rowtype;
begin
  select * into v_record from public.daily_task_records where task_definition_id = p_task_definition_id and record_date = p_record_date for update;
  if not found or v_record.status <> 'carried' then raise exception 'No active carryover found'; end if;
  update public.task_carryovers set is_reverted = true, reverted_at = now() where source_record_id = v_record.id and not is_reverted;
  update public.daily_task_records set status = 'pending', carried_to_date = null where id = v_record.id returning * into v_record;
  return v_record;
end;
$$;

create or replace function public.create_food_entry(
  p_entry_date date, p_entry_time time, p_meal_name text, p_meal_type text,
  p_confirmed_calories integer, p_ai_estimated_calories integer, p_minimum_calories integer,
  p_maximum_calories integer, p_food_items jsonb, p_is_dessert boolean,
  p_confidence text, p_assumptions jsonb
) returns public.food_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.food_entries%rowtype;
begin
  insert into public.food_entries (entry_date, entry_time, meal_name, meal_type, confirmed_calories, ai_estimated_calories, minimum_calories, maximum_calories, food_items, is_dessert, confidence, assumptions)
  values (p_entry_date, p_entry_time, p_meal_name, p_meal_type, p_confirmed_calories, p_ai_estimated_calories, p_minimum_calories, p_maximum_calories, coalesce(p_food_items, '[]'), p_is_dessert, p_confidence, coalesce(p_assumptions, '[]')) returning * into v_entry;
  if v_entry.is_dessert then perform public.apply_lifecycle_effect('dessert', v_entry.id, -1, -1, -1, v_entry.entry_date, 'Dessert: ' || v_entry.meal_name); end if;
  return v_entry;
end;
$$;

create or replace function public.delete_food_entry(p_id uuid)
returns public.food_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.food_entries%rowtype;
begin
  select * into v_entry from public.food_entries where id = p_id for update;
  if not found then raise exception 'Food entry not found'; end if;
  if v_entry.is_dessert then perform public.revert_lifecycle_effect('dessert', v_entry.id); end if;
  delete from public.food_entries where id = p_id;
  return v_entry;
end;
$$;

create or replace function public.update_food_entry(
  p_id uuid, p_entry_date date, p_entry_time time, p_meal_name text, p_meal_type text,
  p_confirmed_calories integer, p_ai_estimated_calories integer, p_minimum_calories integer,
  p_maximum_calories integer, p_food_items jsonb, p_is_dessert boolean,
  p_confidence text, p_assumptions jsonb
) returns public.food_entries
language plpgsql security definer set search_path = public as $$
declare v_before public.food_entries%rowtype; v_after public.food_entries%rowtype;
begin
  select * into v_before from public.food_entries where id = p_id for update;
  if not found then raise exception 'Food entry not found'; end if;
  update public.food_entries set entry_date = p_entry_date, entry_time = p_entry_time,
    meal_name = p_meal_name, meal_type = p_meal_type, confirmed_calories = p_confirmed_calories,
    ai_estimated_calories = p_ai_estimated_calories, minimum_calories = p_minimum_calories,
    maximum_calories = p_maximum_calories, food_items = coalesce(p_food_items, '[]'),
    is_dessert = p_is_dessert, confidence = p_confidence, assumptions = coalesce(p_assumptions, '[]')
  where id = p_id returning * into v_after;
  if not v_before.is_dessert and v_after.is_dessert then
    perform public.apply_lifecycle_effect('dessert', v_after.id, -1, -1, -1, v_after.entry_date, 'Dessert: ' || v_after.meal_name);
  elsif v_before.is_dessert and not v_after.is_dessert then
    perform public.revert_lifecycle_effect('dessert', v_after.id);
  end if;
  return v_after;
end;
$$;

create or replace function public.create_smoking_entry(p_id uuid, p_entry_date date, p_entry_time time)
returns public.smoking_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.smoking_entries%rowtype;
begin
  insert into public.smoking_entries (id, entry_date, entry_time) values (p_id, p_entry_date, p_entry_time)
  on conflict (id) do update set id = excluded.id returning * into v_entry;
  perform public.apply_lifecycle_effect('smoking', v_entry.id, -1, -1, -1, v_entry.entry_date, 'Smoking record');
  return v_entry;
end;
$$;

create or replace function public.delete_smoking_entry(p_id uuid)
returns public.smoking_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.smoking_entries%rowtype;
begin
  select * into v_entry from public.smoking_entries where id = p_id for update;
  if not found then raise exception 'Smoking entry not found'; end if;
  perform public.revert_lifecycle_effect('smoking', v_entry.id);
  delete from public.smoking_entries where id = p_id;
  return v_entry;
end;
$$;

create or replace function public.adjust_lifecycle_score(p_category text, p_delta numeric, p_reason text)
returns public.lifecycle_adjustments
language plpgsql security definer set search_path = public as $$
declare v_adjustment public.lifecycle_adjustments%rowtype;
begin
  insert into public.lifecycle_adjustments (category, delta, reason) values (p_category, p_delta, p_reason) returning * into v_adjustment;
  perform public.apply_lifecycle_effect('manual_adjustment', v_adjustment.id,
    case when p_category = 'explore_world' then p_delta else 0 end,
    case when p_category = 'relationship' then p_delta else 0 end,
    case when p_category = 'family' then p_delta else 0 end,
    (now() at time zone 'Asia/Singapore')::date, p_reason);
  return v_adjustment;
end;
$$;

-- RLS: public reads only. No INSERT/UPDATE/DELETE policy is created for anon.
alter table public.system_settings enable row level security;
alter table public.task_definitions enable row level security;
alter table public.daily_task_records enable row level security;
alter table public.task_carryovers enable row level security;
alter table public.food_entries enable row level security;
alter table public.smoking_entries enable row level security;
alter table public.lifecycle_effects enable row level security;
alter table public.lifecycle_adjustments enable row level security;

create policy "public read system settings" on public.system_settings for select to anon, authenticated using (true);
create policy "public read task definitions" on public.task_definitions for select to anon, authenticated using (true);
create policy "public read task records" on public.daily_task_records for select to anon, authenticated using (true);
create policy "public read carryovers" on public.task_carryovers for select to anon, authenticated using (true);
create policy "public read food entries" on public.food_entries for select to anon, authenticated using (true);
create policy "public read smoking entries" on public.smoking_entries for select to anon, authenticated using (true);
create policy "public read lifecycle effects" on public.lifecycle_effects for select to anon, authenticated using (true);
create policy "public read lifecycle adjustments" on public.lifecycle_adjustments for select to anon, authenticated using (true);

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant select on public.system_settings, public.task_definitions, public.daily_task_records, public.task_carryovers,
  public.food_entries, public.smoking_entries, public.lifecycle_effects, public.lifecycle_adjustments to anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

comment on table public.food_entries is 'Text and numeric meal data only. Food images must never be stored.';
