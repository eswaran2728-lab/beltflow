-- BeltFlow Supabase Schema
-- Run this in Supabase SQL editor to set up the database

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'parent', 'student')),
  academy_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academies
CREATE TABLE academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  martial_art_style TEXT DEFAULT 'Silambam',
  phone TEXT,
  email TEXT,
  address TEXT,
  subscription_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id),
  plan TEXT NOT NULL CHECK (plan IN ('Free Trial', 'Starter', 'Academy', 'Association')),
  status TEXT NOT NULL CHECK (status IN ('Trial', 'Active', 'Past Due', 'Suspended', 'Cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_amount DECIMAL(10,2) NOT NULL,
  student_limit INTEGER NOT NULL,
  features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id),
  subscription_id UUID REFERENCES subscriptions(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Unpaid', 'Overdue')),
  due_date DATE NOT NULL,
  paid_date DATE,
  period TEXT NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branches
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  schedule TEXT,
  coach_id UUID REFERENCES profiles(id),
  belt_levels JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id),
  full_name TEXT NOT NULL,
  age INTEGER,
  ic_number TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  emergency_contact TEXT,
  belt_rank TEXT DEFAULT 'White',
  join_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'At Risk')),
  branch TEXT,
  class_group TEXT,
  missed_classes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parent-Student relationships
CREATE TABLE parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES profiles(id),
  student_id UUID REFERENCES students(id),
  relationship TEXT DEFAULT 'Parent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instructors
CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  academy_id UUID REFERENCES academies(id),
  title TEXT,
  bio TEXT,
  assigned_classes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  date DATE NOT NULL,
  present BOOLEAN DEFAULT TRUE,
  notes TEXT,
  marked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  student_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Unpaid', 'Overdue', 'Pending Cash Approval', 'Rejected')),
  method TEXT DEFAULT 'Cash' CHECK (method IN ('FPX', 'Cash')),
  paid_date DATE,
  receipt_number TEXT,
  approved_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grading Events
CREATE TABLE grading_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT,
  examiner TEXT,
  students JSONB,
  status TEXT DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grading Results
CREATE TABLE grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES grading_events(id),
  student_id UUID REFERENCES students(id),
  student_name TEXT NOT NULL,
  current_belt TEXT NOT NULL,
  target_belt TEXT NOT NULL,
  result TEXT DEFAULT 'Pending' CHECK (result IN ('Pass', 'Fail', 'Pending')),
  examiner TEXT,
  date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skills
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student Skills (progress tracking)
CREATE TABLE student_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  skill_id UUID REFERENCES skills(id),
  skill_name TEXT NOT NULL,
  progress TEXT DEFAULT 'Not Started' CHECK (progress IN ('Not Started', 'Learning', 'Good', 'Mastered')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Instructor Notes
CREATE TABLE instructor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  coach_id UUID REFERENCES profiles(id),
  coach_name TEXT NOT NULL,
  note TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Settings
CREATE TABLE academy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id) UNIQUE,
  monthly_fee DECIMAL(10,2) DEFAULT 80,
  belt_levels JSONB,
  martial_art_style TEXT DEFAULT 'Silambam',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES academies(id),
  name TEXT NOT NULL,
  organizer TEXT NOT NULL,
  venue TEXT,
  date DATE NOT NULL,
  registration_deadline DATE,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Open Registration', 'Registration Closed', 'Completed', 'Cancelled')),
  notes TEXT,
  coach_ids JSONB,
  categories JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament Categories
CREATE TABLE tournament_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id),
  name TEXT NOT NULL,
  age_group TEXT,
  description TEXT,
  max_participants INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament Registrations
CREATE TABLE tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id),
  student_id UUID REFERENCES students(id),
  student_name TEXT NOT NULL,
  age_group TEXT,
  category TEXT NOT NULL,
  branch TEXT,
  coach_id UUID REFERENCES profiles(id),
  coach_name TEXT,
  status TEXT DEFAULT 'Registered' CHECK (status IN ('Registered', 'Confirmed', 'Withdrawn', 'Completed')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament Results
CREATE TABLE tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES tournament_registrations(id),
  tournament_id UUID REFERENCES tournaments(id),
  student_id UUID REFERENCES students(id),
  student_name TEXT NOT NULL,
  category TEXT NOT NULL,
  medal TEXT DEFAULT 'No Medal' CHECK (medal IN ('Gold', 'Silver', 'Bronze', 'Participation', 'No Medal')),
  points INTEGER DEFAULT 0,
  position INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Athlete Achievements
CREATE TABLE athlete_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  tournament_id UUID REFERENCES tournaments(id),
  tournament_name TEXT NOT NULL,
  category TEXT NOT NULL,
  medal TEXT NOT NULL,
  date DATE,
  points INTEGER DEFAULT 0,
  badge TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Example: Admins can see all data in their academy
-- TODO: Add full RLS policies per role (admin/coach/parent/student)
