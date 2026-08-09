-- Registrations used to capture "class / branch" as free text on coaches only,
-- which linked to nothing. Capture real branch/class ids for every role instead.
--
-- This matters because branch scoping already works through
--   coach -> class_coaches -> enrollments -> student
-- and the only missing piece was that registration never populated it.

alter table public.profiles
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists class_id  uuid references public.classes(id)  on delete set null;

create index if not exists profiles_branch_id_idx on public.profiles(branch_id);
create index if not exists profiles_class_id_idx  on public.profiles(class_id);

-- Signup metadata is client-supplied, so a malformed uuid must not abort the
-- auth trigger and block registration entirely.
create or replace function public.safe_uuid(t text)
returns uuid
language plpgsql
immutable
as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- The signup form runs logged out, and branches/classes are only readable by
-- an approved user. Expose just the picker fields (no address, phone, or
-- monthly_fee_override) rather than opening those tables to anon.
create or replace function public.signup_options()
returns table (kind text, id uuid, name text, branch_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  with academy as (select id from academies order by created_at limit 1)
  select 'branch'::text, b.id, b.name, null::uuid
  from branches b where b.academy_id = (select id from academy)
  union all
  select 'class'::text, c.id, c.name, c.branch_id
  from classes c where c.academy_id = (select id from academy)
  order by 1, 3;
$$;

revoke all on function public.signup_options() from public;
grant execute on function public.signup_options() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role    text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_name    text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));
  v_lang    text := coalesce(nullif(new.raw_user_meta_data->>'preferred_language', ''), 'en');
  v_academy uuid := (select id from academies order by created_at limit 1);
  v_branch  uuid;
  v_class   uuid;
  v_label   text;
begin
  if v_role not in ('coach','parent','student') then v_role := 'student'; end if;
  if v_lang not in ('en','ms','ta') then v_lang := 'en'; end if;

  -- Resolve against real rows in this academy; anything that does not match is
  -- dropped rather than trusted.
  select b.id into v_branch
  from branches b
  where b.id = public.safe_uuid(new.raw_user_meta_data->>'branch_id')
    and b.academy_id = v_academy;

  -- A class is only accepted if it sits in the chosen branch, so the pair can
  -- never disagree.
  select c.id into v_class
  from classes c
  where c.id = public.safe_uuid(new.raw_user_meta_data->>'class_id')
    and c.academy_id = v_academy
    and (v_branch is null or c.branch_id = v_branch);

  -- Picking only a class still implies its branch.
  if v_branch is null and v_class is not null then
    select c.branch_id into v_branch from classes c where c.id = v_class;
  end if;

  -- Keep the legacy free-text column readable for anyone still displaying it.
  select trim(both ' - ' from
           coalesce((select name from branches where id = v_branch), '') || ' - ' ||
           coalesce((select name from classes  where id = v_class),  ''))
    into v_label;

  if lower(new.email) = 'eswaran2728@gmail.com' then
    insert into public.profiles (auth_user_id, academy_id, full_name, email, role, status, preferred_language)
    values (new.id, v_academy, v_name, new.email, 'admin', 'approved', v_lang);
  else
    insert into public.profiles (auth_user_id, academy_id, full_name, email, phone, role, status,
                                 child_name, assigned_class, branch_id, class_id, preferred_language)
    values (new.id, v_academy, v_name, new.email,
            nullif(new.raw_user_meta_data->>'phone', ''),
            v_role, 'pending',
            nullif(new.raw_user_meta_data->>'child_name', ''),
            nullif(v_label, ''),
            v_branch, v_class,
            v_lang);
  end if;
  return new;
end $$;
