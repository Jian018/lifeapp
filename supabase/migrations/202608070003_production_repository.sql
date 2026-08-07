-- Production repository functions for the hosted Supabase backend.
-- All functions are service-role only; public/anon retain SELECT access only.

-- Preserve a daily record's historical base target. Only carried/total values
-- are recalculated when an existing record is revisited.
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
  on conflict (task_definition_id, record_date) do update set
    carried_target = excluded.carried_target,
    total_target = public.daily_task_records.base_target + excluded.carried_target
  returning * into v_record;
  return v_record;
end;
$$;

create or replace function public.complete_daily_task(p_task_definition_id uuid, p_record_date date)
returns public.daily_task_records
language plpgsql security definer set search_path = public as $$
declare v_record public.daily_task_records%rowtype; v_timezone text;
begin
  select timezone into v_timezone from public.app_settings where singleton = true;
  if p_record_date > timezone(v_timezone, now())::date then raise exception 'Future tasks cannot be completed'; end if;
  v_record := public.ensure_daily_task_record(p_task_definition_id, p_record_date);
  if v_record.status = 'carried' then raise exception 'Revert carryover before completing'; end if;
  update public.daily_task_records set status = 'completed', completed_at = coalesce(completed_at, now()), carried_to_date = null where id = v_record.id returning * into v_record;
  perform public.sync_daily_exercise_reward(p_record_date);
  return v_record;
end;
$$;

create or replace function public.carry_daily_task(p_task_definition_id uuid, p_record_date date)
returns public.task_carryovers
language plpgsql security definer set search_path = public as $$
declare v_record public.daily_task_records%rowtype; v_carry public.task_carryovers%rowtype; v_timezone text;
begin
  select timezone into v_timezone from public.app_settings where singleton = true;
  if p_record_date > timezone(v_timezone, now())::date then raise exception 'Future tasks cannot be carried'; end if;
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

create or replace function public.adjust_lifecycle_score(p_category text, p_delta numeric, p_reason text)
returns public.lifecycle_adjustments
language plpgsql security definer set search_path = public as $$
declare v_adjustment public.lifecycle_adjustments%rowtype; v_timezone text;
begin
  select timezone into v_timezone from public.app_settings where singleton = true;
  insert into public.lifecycle_adjustments (category, delta, reason) values (p_category, p_delta, p_reason) returning * into v_adjustment;
  perform public.apply_lifecycle_effect('manual_adjustment', v_adjustment.id,
    case when p_category = 'explore_world' then p_delta else 0 end,
    case when p_category = 'relationship' then p_delta else 0 end,
    case when p_category = 'family' then p_delta else 0 end,
    timezone(v_timezone, now())::date, p_reason);
  return v_adjustment;
end;
$$;

create or replace function public.update_general_settings(
  p_website_name text, p_language text, p_timezone text
) returns public.app_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.app_settings%rowtype;
begin
  update public.app_settings set website_name = p_website_name, language = p_language, timezone = p_timezone where singleton = true returning * into v_settings;
  update public.system_settings set timezone = p_timezone where singleton = true;
  return v_settings;
end;
$$;

create or replace function public.update_timeline_settings(p_birth_date date, p_target_age integer)
returns public.system_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.system_settings%rowtype; v_target_date date;
begin
  v_target_date := (p_birth_date + make_interval(years => p_target_age))::date;
  update public.app_settings set target_age = p_target_age where singleton = true;
  update public.system_settings set birth_date = p_birth_date, target_date = v_target_date where singleton = true returning * into v_settings;
  return v_settings;
end;
$$;

create or replace function public.update_lifecycle_scores(
  p_explore_world_score numeric, p_relationship_score numeric, p_family_score numeric, p_reason text
) returns public.system_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.system_settings%rowtype;
begin
  select * into v_settings from public.system_settings where singleton = true for update;
  if v_settings.explore_world_score <> p_explore_world_score then
    perform public.adjust_lifecycle_score('explore_world', p_explore_world_score - v_settings.explore_world_score, p_reason);
  end if;
  select * into v_settings from public.system_settings where singleton = true;
  if v_settings.relationship_score <> p_relationship_score then
    perform public.adjust_lifecycle_score('relationship', p_relationship_score - v_settings.relationship_score, p_reason);
  end if;
  select * into v_settings from public.system_settings where singleton = true;
  if v_settings.family_score <> p_family_score then
    perform public.adjust_lifecycle_score('family', p_family_score - v_settings.family_score, p_reason);
  end if;
  select * into v_settings from public.system_settings where singleton = true;
  return v_settings;
end;
$$;

create or replace function public.update_lifecycle_rules(p_settings jsonb)
returns public.app_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.app_settings%rowtype;
begin
  update public.app_settings set
    exercise_world_delta = (p_settings->>'exerciseWorldDelta')::numeric,
    exercise_relationship_delta = (p_settings->>'exerciseRelationshipDelta')::numeric,
    exercise_family_delta = (p_settings->>'exerciseFamilyDelta')::numeric,
    dessert_world_delta = (p_settings->>'dessertWorldDelta')::numeric,
    dessert_relationship_delta = (p_settings->>'dessertRelationshipDelta')::numeric,
    dessert_family_delta = (p_settings->>'dessertFamilyDelta')::numeric,
    smoking_world_delta = (p_settings->>'smokingWorldDelta')::numeric,
    smoking_relationship_delta = (p_settings->>'smokingRelationshipDelta')::numeric,
    smoking_family_delta = (p_settings->>'smokingFamilyDelta')::numeric
  where singleton = true returning * into v_settings;
  return v_settings;
end;
$$;

create or replace function public.update_calorie_settings(p_default_meal_type text, p_ai_enabled boolean, p_require_confirmation boolean)
returns public.app_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.app_settings%rowtype;
begin
  update public.app_settings set default_meal_type = p_default_meal_type, ai_food_analysis_enabled = p_ai_enabled, require_ai_confirmation = p_require_confirmation
  where singleton = true returning * into v_settings;
  return v_settings;
end;
$$;

create or replace function public.update_display_settings(p_landing_page text, p_sidebar_mode text, p_mobile_date_range integer)
returns public.app_settings
language plpgsql security definer set search_path = public as $$
declare v_settings public.app_settings%rowtype;
begin
  update public.app_settings set default_landing_page = p_landing_page, desktop_sidebar_mode = p_sidebar_mode, mobile_date_range = p_mobile_date_range
  where singleton = true returning * into v_settings;
  return v_settings;
end;
$$;

create or replace function public.update_task_definitions(p_tasks jsonb)
returns setof public.task_definitions
language plpgsql security definer set search_path = public as $$
declare v_task jsonb;
begin
  for v_task in select * from jsonb_array_elements(p_tasks) loop
    update public.task_definitions set
      name = v_task->>'name',
      unit = v_task->>'unit',
      base_target = (v_task->>'baseTarget')::numeric,
      display_order = (v_task->>'displayOrder')::integer,
      is_active = (v_task->>'isActive')::boolean
    where id = (v_task->>'id')::uuid;
  end loop;
  return query select * from public.task_definitions order by display_order;
end;
$$;

create or replace function public.reset_entire_system()
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('my-life-system:reset', 0));
  delete from public.task_carryovers;
  delete from public.daily_task_records;
  delete from public.lifecycle_effects;
  delete from public.lifecycle_adjustments;
  delete from public.food_entries;
  delete from public.smoking_entries;
  delete from public.task_definitions;

  update public.system_settings set birth_date = date '2003-01-08', target_date = date '2063-01-08', timezone = 'Asia/Singapore',
    explore_world_score = 33, relationship_score = 33, family_score = 33 where singleton = true;
  update public.app_settings set website_name = 'My Life System', language = 'en', timezone = 'Asia/Singapore', target_age = 60,
    exercise_world_delta = 1, exercise_relationship_delta = 1, exercise_family_delta = 1,
    dessert_world_delta = -1, dessert_relationship_delta = -1, dessert_family_delta = -1,
    smoking_world_delta = -1, smoking_relationship_delta = -1, smoking_family_delta = -1,
    default_meal_type = 'auto', ai_food_analysis_enabled = true, require_ai_confirmation = true,
    default_landing_page = '/', desktop_sidebar_mode = 'expanded', mobile_date_range = 7
  where singleton = true;
  insert into public.task_definitions (task_key, name, unit, base_target, display_order) values
    ('running', 'Running', 'minutes', 15, 1),
    ('push_up', 'Push-up', 'reps', 20, 2),
    ('sit_up', 'Sit-up', 'reps', 20, 3),
    ('plank', 'Plank', 'seconds', 3, 4);
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
