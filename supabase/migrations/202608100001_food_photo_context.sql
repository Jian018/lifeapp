-- Additive migration: existing food records are retained and receive safe defaults.
alter table public.food_entries
  add column if not exists photo_description text not null default '',
  add column if not exists quantity integer not null default 1 check (quantity between 1 and 1000);

create or replace function public.create_food_entry(
  p_entry_date date, p_entry_time time, p_meal_name text, p_meal_type text,
  p_confirmed_calories integer, p_ai_estimated_calories integer, p_minimum_calories integer,
  p_maximum_calories integer, p_food_items jsonb, p_is_dessert boolean,
  p_confidence text, p_assumptions jsonb, p_photo_description text default '', p_quantity integer default 1
) returns public.food_entries
language plpgsql security definer set search_path = public as $$
declare v_entry public.food_entries%rowtype;
begin
  insert into public.food_entries (entry_date, entry_time, meal_name, meal_type, confirmed_calories, ai_estimated_calories, minimum_calories, maximum_calories, food_items, is_dessert, confidence, assumptions, photo_description, quantity)
  values (p_entry_date, p_entry_time, p_meal_name, p_meal_type, p_confirmed_calories, p_ai_estimated_calories, p_minimum_calories, p_maximum_calories, coalesce(p_food_items, '[]'), p_is_dessert, p_confidence, coalesce(p_assumptions, '[]'), coalesce(p_photo_description, ''), coalesce(p_quantity, 1)) returning * into v_entry;
  if v_entry.is_dessert then perform public.apply_lifecycle_effect('dessert', v_entry.id, -1, -1, -1, v_entry.entry_date, 'Dessert: ' || v_entry.meal_name); end if;
  return v_entry;
end;
$$;

create or replace function public.update_food_entry(
  p_id uuid, p_entry_date date, p_entry_time time, p_meal_name text, p_meal_type text,
  p_confirmed_calories integer, p_ai_estimated_calories integer, p_minimum_calories integer,
  p_maximum_calories integer, p_food_items jsonb, p_is_dessert boolean,
  p_confidence text, p_assumptions jsonb, p_photo_description text default '', p_quantity integer default 1
) returns public.food_entries
language plpgsql security definer set search_path = public as $$
declare v_before public.food_entries%rowtype; v_after public.food_entries%rowtype;
begin
  select * into v_before from public.food_entries where id = p_id for update;
  if not found then raise exception 'Food entry not found'; end if;
  update public.food_entries set entry_date = p_entry_date, entry_time = p_entry_time, meal_name = p_meal_name, meal_type = p_meal_type, confirmed_calories = p_confirmed_calories, ai_estimated_calories = p_ai_estimated_calories, minimum_calories = p_minimum_calories, maximum_calories = p_maximum_calories, food_items = coalesce(p_food_items, '[]'), is_dessert = p_is_dessert, confidence = p_confidence, assumptions = coalesce(p_assumptions, '[]'), photo_description = coalesce(p_photo_description, ''), quantity = coalesce(p_quantity, 1)
  where id = p_id returning * into v_after;
  if not v_before.is_dessert and v_after.is_dessert then perform public.apply_lifecycle_effect('dessert', v_after.id, -1, -1, -1, v_after.entry_date, 'Dessert: ' || v_after.meal_name);
  elsif v_before.is_dessert and not v_after.is_dessert then perform public.revert_lifecycle_effect('dessert', v_after.id); end if;
  return v_after;
end;
$$;

revoke execute on function public.create_food_entry(date, time, text, text, integer, integer, integer, integer, jsonb, boolean, text, jsonb, text, integer) from public, anon, authenticated;
revoke execute on function public.update_food_entry(uuid, date, time, text, text, integer, integer, integer, integer, jsonb, boolean, text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.create_food_entry(date, time, text, text, integer, integer, integer, integer, jsonb, boolean, text, jsonb, text, integer) to service_role;
grant execute on function public.update_food_entry(uuid, date, time, text, text, integer, integer, integer, integer, jsonb, boolean, text, jsonb, text, integer) to service_role;
