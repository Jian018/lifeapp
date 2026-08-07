-- Upgrade an existing v1 database to the final ENERGIZED settings model.
-- ENERGIZED is intentionally not stored; clients calculate and clamp the sum.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'system_settings' and column_name = 'world_score'
  ) then
    alter table public.system_settings rename column world_score to explore_world_score;
  end if;
end $$;
alter table public.system_settings alter column explore_world_score set default 33;
alter table public.system_settings alter column relationship_score set default 33;
alter table public.system_settings alter column family_score set default 33;

alter table public.lifecycle_adjustments drop constraint if exists lifecycle_adjustments_category_check;
update public.lifecycle_adjustments set category = 'explore_world' where category = 'world';
alter table public.lifecycle_adjustments add constraint lifecycle_adjustments_category_check
  check (category in ('explore_world', 'relationship', 'family'));

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  website_name text not null default 'My Life System',
  language text not null default 'en' check (language in ('en', 'zh')),
  timezone text not null default 'Asia/Singapore',
  target_age integer not null default 60 check (target_age between 1 and 120),
  exercise_world_delta numeric(6,2) not null default 1,
  exercise_relationship_delta numeric(6,2) not null default 1,
  exercise_family_delta numeric(6,2) not null default 1,
  dessert_world_delta numeric(6,2) not null default -1,
  dessert_relationship_delta numeric(6,2) not null default -1,
  dessert_family_delta numeric(6,2) not null default -1,
  smoking_world_delta numeric(6,2) not null default -1,
  smoking_relationship_delta numeric(6,2) not null default -1,
  smoking_family_delta numeric(6,2) not null default -1,
  default_meal_type text not null default 'auto' check (default_meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'auto')),
  ai_food_analysis_enabled boolean not null default true,
  require_ai_confirmation boolean not null default true,
  default_landing_page text not null default '/' check (default_landing_page in ('/', '/tasks', '/lifecycle', '/calories')),
  desktop_sidebar_mode text not null default 'expanded' check (desktop_sidebar_mode in ('expanded', 'compact')),
  mobile_date_range integer not null default 7 check (mobile_date_range in (5, 7)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (singleton) values (true) on conflict (singleton) do nothing;
create trigger app_settings_updated before update on public.app_settings for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
create policy "public read app settings" on public.app_settings for select to anon, authenticated using (true);
revoke all on public.app_settings from public, anon, authenticated;
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;

-- Existing installations created by v1 started at 50/50/50. Rebase the
-- untouched singleton to the final initial state without changing any ledger.
update public.system_settings set
  explore_world_score = 33,
  relationship_score = 33,
  family_score = 33,
  updated_at = now()
where explore_world_score = 50 and relationship_score = 50 and family_score = 50
  and not exists (select 1 from public.lifecycle_effects where not is_reverted);

comment on table public.app_settings is 'Singleton app behavior settings. ADMIN_PIN and ENERGIZED are never stored here.';

create or replace function public.apply_configured_lifecycle_effect(
  p_rule text, p_source_type text, p_source_id uuid, p_effect_date date, p_reason text
) returns public.lifecycle_effects
language plpgsql security definer set search_path = public as $$
declare v_settings public.app_settings%rowtype;
declare v_world numeric; v_relationship numeric; v_family numeric;
begin
  select * into v_settings from public.app_settings where singleton = true;
  if p_rule = 'exercise' then
    v_world := v_settings.exercise_world_delta; v_relationship := v_settings.exercise_relationship_delta; v_family := v_settings.exercise_family_delta;
  elsif p_rule = 'dessert' then
    v_world := v_settings.dessert_world_delta; v_relationship := v_settings.dessert_relationship_delta; v_family := v_settings.dessert_family_delta;
  elsif p_rule = 'smoking' then
    v_world := v_settings.smoking_world_delta; v_relationship := v_settings.smoking_relationship_delta; v_family := v_settings.smoking_family_delta;
  else raise exception 'Unknown lifecycle rule';
  end if;
  return public.apply_lifecycle_effect(p_source_type, p_source_id, v_world, v_relationship, v_family, p_effect_date, p_reason);
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
    perform public.apply_configured_lifecycle_effect('exercise', 'daily_exercise', v_source_id, p_record_date, 'Completed every active movement task');
  else
    perform public.revert_lifecycle_effect('daily_exercise', v_source_id);
  end if;
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
  if v_entry.is_dessert then perform public.apply_configured_lifecycle_effect('dessert', 'dessert', v_entry.id, v_entry.entry_date, 'Dessert: ' || v_entry.meal_name); end if;
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
    perform public.apply_configured_lifecycle_effect('dessert', 'dessert', v_after.id, v_after.entry_date, 'Dessert: ' || v_after.meal_name);
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
  perform public.apply_configured_lifecycle_effect('smoking', 'smoking', v_entry.id, v_entry.entry_date, 'Smoking record');
  return v_entry;
end;
$$;

-- Settings-safe reset keeps all business history and writes auditable manual effects.
create or replace function public.reset_lifecycle_scores()
returns public.system_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.system_settings%rowtype;
begin
  select * into v_settings from public.system_settings where singleton = true for update;
  if v_settings.explore_world_score <> 33 then perform public.adjust_lifecycle_score('explore_world', 33 - v_settings.explore_world_score, 'Lifecycle reset to 33 / 33 / 33'); end if;
  if v_settings.relationship_score <> 33 then perform public.adjust_lifecycle_score('relationship', 33 - v_settings.relationship_score, 'Lifecycle reset to 33 / 33 / 33'); end if;
  if v_settings.family_score <> 33 then perform public.adjust_lifecycle_score('family', 33 - v_settings.family_score, 'Lifecycle reset to 33 / 33 / 33'); end if;
  select * into v_settings from public.system_settings where singleton = true;
  return v_settings;
end;
$$;

revoke execute on function public.apply_configured_lifecycle_effect(text, text, uuid, date, text) from public, anon, authenticated;
revoke execute on function public.reset_lifecycle_scores() from public, anon, authenticated;
grant execute on function public.apply_configured_lifecycle_effect(text, text, uuid, date, text) to service_role;
grant execute on function public.reset_lifecycle_scores() to service_role;
