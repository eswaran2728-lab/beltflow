-- BeltFlow database schema (reference copy)
-- This has already been applied to the live Supabase project as migration
-- `beltflow_schema_rls_realtime`. Keep this file in sync with future migrations.
--
-- Security model:
--   * profiles are created ONLY by the on_auth_user_created trigger (server-side).
--   * Every new signup starts as status='pending' and must be approved by an admin.
--   * The academy owner's email is auto-approved as admin on first signup.
--   * All tables enforce Row Level Security:
--       - admin/coach (staff): full read/write on academy data
--       - parent/student: read-only access to their own linked student's data
--       - parents may additionally submit cash payments (pending approval) for their child
--   * Realtime is enabled on all tables via the supabase_realtime publication.

-- ---------- Role helper functions (security definer to avoid RLS recursion) ----------
create or replace function public.current_user_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from profiles
  where auth_user_id = auth.uid() and status = 'approved'
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.current_user_role() = 'admin'; $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.current_user_role() in ('admin','coach'); $$;

create or replace function public.can_view_student(sid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'approved'
      and (p.student_id = sid::text or sid::text = any(coalesce(p.child_student_ids, '{}')))
  );
$$;

-- ---------- Profiles ----------
-- create table profiles (
--   id uuid primary key default gen_random_uuid(),
--   auth_user_id uuid references auth.users(id) on delete cascade,
--   full_name text not null,
--   email text not null,
--   phone text,
--   role text not null check (role in ('admin', 'coach', 'parent', 'student')),
--   status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
--   child_name text,
--   assigned_class text,
--   assigned_class_ids text[],
--   child_student_ids text[],
--   student_id text,
--   created_at timestamptz default now()
-- );

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = auth_user_id);
create policy "profiles_select_admin" on profiles
  for select using (public.is_admin());
create policy "profiles_update_admin" on profiles
  for update using (public.is_admin()) with check (public.is_admin());
create policy "profiles_delete_admin" on profiles
  for delete using (public.is_admin());
-- No INSERT policy: profiles are created by the trigger below.

-- ---------- Server-side profile creation on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));
begin
  if v_role not in ('coach','parent','student') then
    v_role := 'student';
  end if;

  if lower(new.email) = 'eswaran2728@gmail.com' then
    insert into public.profiles (auth_user_id, full_name, email, role, status)
    values (new.id, v_name, new.email, 'admin', 'approved');
  else
    insert into public.profiles (auth_user_id, full_name, email, phone, role, status, child_name, assigned_class)
    values (new.id, v_name, new.email,
            nullif(new.raw_user_meta_data->>'phone', ''),
            v_role, 'pending',
            nullif(new.raw_user_meta_data->>'child_name', ''),
            nullif(new.raw_user_meta_data->>'assigned_class', ''));
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The trigger runs as its owner; clients must not be able to call it via RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- Business tables ----------
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  schedule text,
  coach_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  age integer,
  ic_number text,
  parent_name text,
  parent_phone text,
  emergency_contact text,
  belt_rank text not null default 'White',
  join_date date default current_date,
  status text not null default 'Active' check (status in ('Active','Inactive','At Risk')),
  branch text,
  class_group text,
  class_id uuid references classes(id) on delete set null,
  missed_classes integer not null default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  date date not null,
  present boolean not null default true,
  notes text,
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique (student_id, class_id, date)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  student_name text not null,
  amount numeric(10,2) not null,
  month text not null,
  status text not null check (status in ('Paid','Unpaid','Overdue','Pending Cash Approval','Rejected')),
  method text not null default 'Cash' check (method in ('FPX','Cash')),
  paid_date date,
  receipt_number text,
  approved_by text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists grading_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  location text,
  examiner text,
  student_ids uuid[] not null default '{}',
  status text not null default 'Upcoming' check (status in ('Upcoming','Completed')),
  created_at timestamptz default now()
);

create table if not exists grading_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references grading_events(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  student_name text not null,
  current_belt text not null,
  target_belt text not null,
  result text not null default 'Pending' check (result in ('Pass','Fail','Pending')),
  examiner text,
  date date,
  notes text,
  created_at timestamptz default now(),
  unique (event_id, student_id)
);

create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Foundation',
  description text,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists student_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  skill_name text not null,
  progress text not null default 'Not Started' check (progress in ('Not Started','Learning','Good','Mastered')),
  updated_at timestamptz default now(),
  notes text,
  unique (student_id, skill_id)
);

create table if not exists instructor_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  coach_id uuid references profiles(id) on delete set null,
  coach_name text not null,
  note text not null,
  date date not null default current_date,
  is_private boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer text,
  venue text,
  date date,
  registration_deadline date,
  status text not null default 'Draft' check (status in ('Draft','Open Registration','Registration Closed','Completed','Cancelled')),
  notes text,
  categories jsonb not null default '[]',
  created_at timestamptz default now()
);

create table if not exists tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  student_name text not null,
  age_group text,
  category text not null,
  branch text,
  coach_name text,
  status text not null default 'Registered' check (status in ('Registered','Confirmed','Withdrawn','Completed')),
  remarks text,
  created_at timestamptz default now()
);

create table if not exists tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  student_name text not null,
  category text not null,
  medal text not null default 'No Medal' check (medal in ('Gold','Silver','Bronze','Participation','No Medal')),
  points integer not null default 0,
  position integer,
  notes text,
  created_at timestamptz default now()
);

create table if not exists academy_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  martial_art_style text not null default 'Silambam',
  phone text,
  email text,
  address text,
  monthly_fee numeric(10,2) not null default 80,
  updated_at timestamptz default now()
);

-- ---------- Row Level Security ----------
alter table branches enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table payments enable row level security;
alter table grading_events enable row level security;
alter table grading_records enable row level security;
alter table skills enable row level security;
alter table student_skills enable row level security;
alter table instructor_notes enable row level security;
alter table tournaments enable row level security;
alter table tournament_registrations enable row level security;
alter table tournament_results enable row level security;
alter table academy_settings enable row level security;

create policy "branches_select" on branches for select using (public.current_user_role() is not null);
create policy "branches_write" on branches for all using (public.is_admin()) with check (public.is_admin());

create policy "classes_select" on classes for select using (public.current_user_role() is not null);
create policy "classes_write" on classes for all using (public.is_admin()) with check (public.is_admin());

create policy "skills_select" on skills for select using (public.current_user_role() is not null);
create policy "skills_write" on skills for all using (public.is_staff()) with check (public.is_staff());

create policy "settings_select" on academy_settings for select using (public.current_user_role() is not null);
create policy "settings_write" on academy_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "grading_events_select" on grading_events for select using (public.current_user_role() is not null);
create policy "grading_events_write" on grading_events for all using (public.is_staff()) with check (public.is_staff());

create policy "tournaments_select" on tournaments for select using (public.current_user_role() is not null);
create policy "tournaments_write" on tournaments for all using (public.is_staff()) with check (public.is_staff());

create policy "students_select" on students for select
  using (public.is_staff() or public.can_view_student(id));
create policy "students_write" on students for all
  using (public.is_staff()) with check (public.is_staff());

create policy "attendance_select" on attendance for select
  using (public.is_staff() or public.can_view_student(student_id));
create policy "attendance_write" on attendance for all
  using (public.is_staff()) with check (public.is_staff());

create policy "payments_select" on payments for select
  using (public.is_staff() or public.can_view_student(student_id));
create policy "payments_write" on payments for all
  using (public.is_staff()) with check (public.is_staff());
create policy "payments_insert_parent_cash" on payments for insert
  with check (
    public.can_view_student(student_id)
    and status = 'Pending Cash Approval'
    and method = 'Cash'
  );

create policy "grading_records_select" on grading_records for select
  using (public.is_staff() or public.can_view_student(student_id));
create policy "grading_records_write" on grading_records for all
  using (public.is_staff()) with check (public.is_staff());

create policy "student_skills_select" on student_skills for select
  using (public.is_staff() or public.can_view_student(student_id));
create policy "student_skills_write" on student_skills for all
  using (public.is_staff()) with check (public.is_staff());

create policy "notes_select_staff" on instructor_notes for select using (public.is_staff());
create policy "notes_select_own_public" on instructor_notes for select
  using (public.can_view_student(student_id) and is_private = false);
create policy "notes_write" on instructor_notes for all
  using (public.is_staff()) with check (public.is_staff());

create policy "t_regs_select" on tournament_registrations for select
  using (public.is_staff() or public.can_view_student(student_id));
create policy "t_regs_write" on tournament_registrations for all
  using (public.is_staff()) with check (public.is_staff());

create policy "t_results_select" on tournament_results for select
  using (public.current_user_role() is not null);
create policy "t_results_write" on tournament_results for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- Realtime ----------
alter publication supabase_realtime add table students, attendance, payments,
  grading_events, grading_records, skills, student_skills, instructor_notes,
  tournaments, tournament_registrations, tournament_results, branches, classes,
  academy_settings, profiles;
