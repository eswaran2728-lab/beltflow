-- Run this in Supabase SQL Editor

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('admin', 'coach', 'parent', 'student')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  child_name text,
  assigned_class text,
  assigned_class_ids text[],
  child_student_ids text[],
  student_id text,
  created_at timestamp with time zone default now()
);

-- Allow anyone to insert their own profile on signup
alter table profiles enable row level security;

create policy "Anyone can insert profile" on profiles
  for insert with check (true);

create policy "Users can read own profile" on profiles
  for select using (auth.uid() = auth_user_id);

create policy "Admin can read all profiles" on profiles
  for select using (true);

create policy "Admin can update all profiles" on profiles
  for update using (true);
