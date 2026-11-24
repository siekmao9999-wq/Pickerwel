-- =============================================================================
-- Pickerwel - Supabase (PostgreSQL) Database Schema, Functions, Triggers & RLS
-- =============================================================================
-- Target: Supabase PostgreSQL 15+
-- Run this script directly in the Supabase Dashboard -> SQL Editor.
-- The script is designed to be idempotent and safe to re-run.
--
-- Mapped from Pickerwel data model (11 tables):
--   1. public.users                (accounts, approval gate, roles, preferences)
--   2. public.admins               (trusted admin registry)
--   3. public.app_config           (public non-PII app settings)
--   4. public.wheels               (saved picker wheels per approved user)
--   5. public.spin_results         (spin outcome history per user)
--   6. public.passcodes            (admin-issued email-less passcodes)
--   7. public.passcode_members     (email-less classroom/group members)
--   8. public.assignments          (student practice tasks with share link & QR)
--   9. public.student_submissions  (student work submissions per assignment)
--  10. public.forms                (Google Forms-style custom surveys & quizzes)
--  11. public.form_responses       (respondent answers & quiz scores per form)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 2. CUSTOM ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.account_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ui_theme AS ENUM ('light', 'dark');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ui_language AS ENUM ('km', 'en');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.palette_id AS ENUM ('vibrant', 'classroom', 'sunset', 'ocean');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.passcode_member_status AS ENUM ('approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.owner_type AS ENUM ('google', 'passcode');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM ('submitted', 'reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.form_theme_id AS ENUM (
    'purple', 'indigo', 'blue', 'teal', 'emerald', 'rose', 'amber'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.form_email_mode AS ENUM ('none', 'optional', 'required');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 3. CORE TABLES
-- -----------------------------------------------------------------------------

-- 3.1 Users (linked 1:1 with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Pickerwel User'
    CHECK (char_length(display_name) BETWEEN 1 AND 80),
  email text NOT NULL DEFAULT ''
    CHECK (char_length(email) <= 120),
  role public.account_role NOT NULL DEFAULT 'user',
  status public.account_status NOT NULL DEFAULT 'pending',
  theme public.ui_theme NOT NULL DEFAULT 'light',
  language public.ui_language NOT NULL DEFAULT 'km',
  sound_enabled boolean NOT NULL DEFAULT true,
  confetti_enabled boolean NOT NULL DEFAULT true,
  haptics_enabled boolean NOT NULL DEFAULT true,
  spin_duration numeric(4, 2) NOT NULL DEFAULT 5
    CHECK (spin_duration >= 3 AND spin_duration <= 10),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.2 Trusted Admin Registry
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.3 Public Non-PII App Config (singleton row id = 'public')
CREATE TABLE IF NOT EXISTS public.app_config (
  id text PRIMARY KEY DEFAULT 'public'
    CHECK (id = 'public'),
  admin_name text NOT NULL DEFAULT 'Siek Mao'
    CHECK (char_length(admin_name) BETWEEN 1 AND 80),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_config (id, admin_name)
VALUES ('public', 'Siek Mao')
ON CONFLICT (id) DO NOTHING;

-- 3.4 Saved Picker Wheels (owner-isolated, approved users only)
CREATE TABLE IF NOT EXISTS public.wheels (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 1 AND 128 AND id ~ '^[a-zA-Z0-9_-]+$'),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL
    CHECK (char_length(title) BETWEEN 1 AND 120),
  entries jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(entries) = 'array'
      AND jsonb_array_length(entries) <= 200
    ),
  palette_id public.palette_id NOT NULL DEFAULT 'vibrant',
  spin_count integer NOT NULL DEFAULT 0
    CHECK (spin_count >= 0 AND spin_count <= 1000000),
  last_winner text NOT NULL DEFAULT ''
    CHECK (char_length(last_winner) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.5 Spin Results History (immutable log per approved user)
CREATE TABLE IF NOT EXISTS public.spin_results (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 1 AND 128 AND id ~ '^[a-zA-Z0-9_-]+$'),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wheel_id text NOT NULL REFERENCES public.wheels(id) ON DELETE CASCADE,
  wheel_title text NOT NULL
    CHECK (char_length(wheel_title) BETWEEN 1 AND 120),
  winner text NOT NULL
    CHECK (char_length(winner) BETWEEN 1 AND 120),
  winner_color text NOT NULL
    CHECK (winner_color ~ '^#[0-9a-fA-F]{6}$'),
  removed_after_spin boolean NOT NULL DEFAULT false,
  spun_at timestamptz NOT NULL DEFAULT now()
);

-- 3.6 Admin-Issued Passcodes (for email-less classroom registration)
CREATE TABLE IF NOT EXISTS public.passcodes (
  code text PRIMARY KEY
    CHECK (char_length(code) BETWEEN 4 AND 32 AND code ~ '^[A-Z0-9_-]+$'),
  label text NOT NULL DEFAULT ''
    CHECK (char_length(label) <= 80),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.7 Email-less Passcode Members
CREATE TABLE IF NOT EXISTS public.passcode_members (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 16 AND 128 AND id ~ '^pm_[a-zA-Z0-9_-]+$'),
  display_name text NOT NULL
    CHECK (char_length(display_name) BETWEEN 1 AND 80),
  passcode text NOT NULL REFERENCES public.passcodes(code) ON DELETE RESTRICT,
  status public.passcode_member_status NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.8 Student Practice Assignments (shareable via unguessable ID & QR code)
CREATE TABLE IF NOT EXISTS public.assignments (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 16 AND 128 AND id ~ '^asgn_[a-zA-Z0-9_-]+$'),
  owner_type public.owner_type NOT NULL DEFAULT 'google',
  owner_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  owner_member_id text REFERENCES public.passcode_members(id) ON DELETE CASCADE,
  owner_display_name text NOT NULL
    CHECK (char_length(owner_display_name) BETWEEN 1 AND 80),
  title text NOT NULL
    CHECK (char_length(title) BETWEEN 1 AND 120),
  instructions text NOT NULL DEFAULT ''
    CHECK (char_length(instructions) <= 2000),
  entries jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(entries) = 'array'
      AND jsonb_array_length(entries) <= 200
    ),
  palette_id public.palette_id NOT NULL DEFAULT 'vibrant',
  allow_wheel_spin boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_owner_consistency CHECK (
    (owner_type = 'google' AND owner_user_id IS NOT NULL AND owner_member_id IS NULL)
    OR
    (owner_type = 'passcode' AND owner_member_id IS NOT NULL AND owner_user_id IS NULL)
  )
);

-- 3.9 Student Practice Submissions (readable only by owner & admins)
CREATE TABLE IF NOT EXISTS public.student_submissions (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 1 AND 128 AND id ~ '^[a-zA-Z0-9_-]+$'),
  assignment_id text NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  owner_member_id text REFERENCES public.passcode_members(id) ON DELETE CASCADE,
  student_name text NOT NULL
    CHECK (char_length(student_name) BETWEEN 1 AND 80),
  group_label text NOT NULL DEFAULT ''
    CHECK (char_length(group_label) <= 60),
  drawn_item text NOT NULL DEFAULT ''
    CHECK (char_length(drawn_item) <= 120),
  answer_text text NOT NULL
    CHECK (char_length(answer_text) BETWEEN 1 AND 2000),
  status public.submission_status NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- 3.10 Custom Forms (Google Forms-style surveys, polls & auto-graded quizzes)
CREATE TABLE IF NOT EXISTS public.forms (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 16 AND 128 AND id ~ '^frm_[a-zA-Z0-9_-]+$'),
  owner_type public.owner_type NOT NULL DEFAULT 'google',
  owner_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  owner_member_id text REFERENCES public.passcode_members(id) ON DELETE CASCADE,
  owner_display_name text NOT NULL
    CHECK (char_length(owner_display_name) BETWEEN 1 AND 80),
  title text NOT NULL
    CHECK (char_length(title) BETWEEN 1 AND 140),
  description text NOT NULL DEFAULT ''
    CHECK (char_length(description) <= 2000),
  theme_id public.form_theme_id NOT NULL DEFAULT 'purple',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(questions) = 'array'
      AND jsonb_array_length(questions) <= 50
    ),
  accepting_responses boolean NOT NULL DEFAULT true,
  is_quiz boolean NOT NULL DEFAULT false,
  collect_respondent_name boolean NOT NULL DEFAULT true,
  email_mode public.form_email_mode NOT NULL DEFAULT 'none',
  allow_multiple_responses boolean NOT NULL DEFAULT true,
  shuffle_questions boolean NOT NULL DEFAULT false,
  confirmation_message text NOT NULL DEFAULT 'Your response has been recorded.'
    CHECK (char_length(confirmation_message) <= 400),
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forms_owner_consistency CHECK (
    (owner_type = 'google' AND owner_user_id IS NOT NULL AND owner_member_id IS NULL)
    OR
    (owner_type = 'passcode' AND owner_member_id IS NOT NULL AND owner_user_id IS NULL)
  )
);

-- 3.11 Form Responses (readable only by form owner & admins)
CREATE TABLE IF NOT EXISTS public.form_responses (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 1 AND 128 AND id ~ '^[a-zA-Z0-9_-]+$'),
  form_id text NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  owner_member_id text REFERENCES public.passcode_members(id) ON DELETE CASCADE,
  respondent_name text NOT NULL DEFAULT ''
    CHECK (char_length(respondent_name) <= 80),
  respondent_email text NOT NULL DEFAULT ''
    CHECK (char_length(respondent_email) <= 120),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (
      jsonb_typeof(answers) = 'array'
      AND jsonb_array_length(answers) <= 50
    ),
  score numeric(8, 2) NOT NULL DEFAULT 0
    CHECK (score >= 0 AND score <= 10000),
  max_score numeric(8, 2) NOT NULL DEFAULT 0
    CHECK (max_score >= 0 AND max_score <= 10000),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_status_created_at
  ON public.users (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wheels_owner_updated_at
  ON public.wheels (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_spin_results_owner_spun_at
  ON public.spin_results (owner_id, spun_at DESC);

CREATE INDEX IF NOT EXISTS idx_spin_results_wheel_id
  ON public.spin_results (wheel_id);

CREATE INDEX IF NOT EXISTS idx_passcodes_active_created_at
  ON public.passcodes (active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_passcode_members_passcode
  ON public.passcode_members (passcode);

CREATE INDEX IF NOT EXISTS idx_passcode_members_status_created_at
  ON public.passcode_members (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_owner_user_created_at
  ON public.assignments (owner_user_id, created_at DESC)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_owner_member_created_at
  ON public.assignments (owner_member_id, created_at DESC)
  WHERE owner_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_submissions_assignment_submitted_at
  ON public.student_submissions (assignment_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_submissions_owner_user
  ON public.student_submissions (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forms_owner_user_updated_at
  ON public.forms (owner_user_id, updated_at DESC)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forms_owner_member_updated_at
  ON public.forms (owner_member_id, updated_at DESC)
  WHERE owner_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_responses_form_submitted_at
  ON public.form_responses (form_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_responses_owner_user
  ON public.form_responses (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. TRIGGERS & SECURITY HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- 5.1 Automatic updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_app_config_updated_at ON public.app_config;
CREATE TRIGGER trg_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_wheels_updated_at ON public.wheels;
CREATE TRIGGER trg_wheels_updated_at
  BEFORE UPDATE ON public.wheels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_passcodes_updated_at ON public.passcodes;
CREATE TRIGGER trg_passcodes_updated_at
  BEFORE UPDATE ON public.passcodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_passcode_members_updated_at ON public.passcode_members;
CREATE TRIGGER trg_passcode_members_updated_at
  BEFORE UPDATE ON public.passcode_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON public.assignments;
CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_forms_updated_at ON public.forms;
CREATE TRIGGER trg_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5.2 Role & Approval Helpers (SECURITY DEFINER avoids recursive RLS lookups)
-- Update the bootstrap admin email below if deploying under a different owner account.
CREATE OR REPLACE FUNCTION public.is_primary_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    lower(auth.jwt() ->> 'email') = 'siekmao9999@gmail.com'
    AND coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, true),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_primary_admin()
    OR EXISTS (
      SELECT 1
      FROM public.admins a
      WHERE a.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.status = 'approved'
    );
$$;

-- 5.3 Prevent non-admin users from escalating their own role or approval status
CREATE OR REPLACE FUNCTION public.guard_user_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role / SQL migrations where auth.uid() is NULL
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_primary_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      RAISE EXCEPTION 'Permission denied: cannot modify role or approval status.';
    END IF;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_update ON public.users;
CREATE TRIGGER trg_guard_user_profile_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_update();

-- 5.4 Sync public.admins when public.users role/status changes
CREATE OR REPLACE FUNCTION public.sync_admin_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' AND NEW.status = 'approved' THEN
    INSERT INTO public.admins (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.admins WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_registry ON public.users;
CREATE TRIGGER trg_sync_admin_registry
  AFTER INSERT OR UPDATE OF role, status ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_registry();

-- 5.5 Auto-create public.users profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := left(coalesce(NEW.email, ''), 120);
  v_name text := left(
    coalesce(
      nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(NEW.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(v_email, '@', 1), ''),
      'Pickerwel User'
    ),
    80
  );
  v_is_bootstrap boolean := lower(v_email) = 'siekmao9999@gmail.com';
BEGIN
  INSERT INTO public.users (
    id,
    display_name,
    email,
    role,
    status,
    reviewed_by,
    reviewed_at
  )
  VALUES (
    NEW.id,
    v_name,
    v_email,
    CASE WHEN v_is_bootstrap THEN 'admin'::public.account_role ELSE 'user'::public.account_role END,
    CASE WHEN v_is_bootstrap THEN 'approved'::public.account_status ELSE 'pending'::public.account_status END,
    CASE WHEN v_is_bootstrap THEN NEW.id ELSE NULL END,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 6. PUBLIC & CLASSROOM RPC FUNCTIONS (NON-ENUMERABLE SECURE ACCESS)
-- -----------------------------------------------------------------------------

-- 6.1 Register an email-less passcode member without exposing the passcodes table
CREATE OR REPLACE FUNCTION public.register_passcode_member(
  p_display_name text,
  p_passcode text
)
RETURNS public.passcode_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := left(trim(coalesce(p_display_name, '')), 80);
  v_code text := upper(trim(coalesce(p_passcode, '')));
  v_active boolean;
  v_member_id text;
  v_row public.passcode_members;
BEGIN
  IF char_length(v_name) = 0 THEN
    RAISE EXCEPTION 'NAME_REQUIRED';
  END IF;

  IF v_code !~ '^[A-Z0-9_-]{4,32}$' THEN
    RAISE EXCEPTION 'PASSCODE_INVALID';
  END IF;

  SELECT active INTO v_active
  FROM public.passcodes
  WHERE code = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PASSCODE_INVALID';
  END IF;

  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PASSCODE_DISABLED';
  END IF;

  v_member_id := 'pm_' || extract(epoch FROM clock_timestamp())::bigint::text || '_' || encode(gen_random_bytes(8), 'hex');

  INSERT INTO public.passcode_members (id, display_name, passcode, status)
  VALUES (v_member_id, v_name, v_code, 'approved')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 6.2 Fetch a single assignment by exact unguessable ID (no table enumeration)
CREATE OR REPLACE FUNCTION public.get_public_assignment(p_assignment_id text)
RETURNS SETOF public.assignments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.assignments
  WHERE id = p_assignment_id
    AND char_length(p_assignment_id) BETWEEN 16 AND 128
    AND p_assignment_id ~ '^asgn_[a-zA-Z0-9_-]+$'
  LIMIT 1;
$$;

-- 6.3 Submit student practice work for an active assignment
CREATE OR REPLACE FUNCTION public.submit_student_work(
  p_assignment_id text,
  p_student_name text,
  p_answer_text text,
  p_group_label text DEFAULT '',
  p_drawn_item text DEFAULT '',
  p_submission_id text DEFAULT NULL
)
RETURNS public.student_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asgn public.assignments;
  v_sub_id text;
  v_row public.student_submissions;
BEGIN
  SELECT * INTO v_asgn
  FROM public.assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND';
  END IF;

  IF v_asgn.active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ASSIGNMENT_CLOSED';
  END IF;

  v_sub_id := coalesce(
    nullif(regexp_replace(coalesce(p_submission_id, ''), '[^a-zA-Z0-9_-]', '', 'g'), ''),
    'sub_' || extract(epoch FROM clock_timestamp())::bigint::text || '_' || encode(gen_random_bytes(6), 'hex')
  );

  INSERT INTO public.student_submissions (
    id,
    assignment_id,
    owner_user_id,
    owner_member_id,
    student_name,
    group_label,
    drawn_item,
    answer_text,
    status
  )
  VALUES (
    left(v_sub_id, 128),
    v_asgn.id,
    v_asgn.owner_user_id,
    v_asgn.owner_member_id,
    left(trim(coalesce(p_student_name, '')), 80),
    left(trim(coalesce(p_group_label, '')), 60),
    left(trim(coalesce(p_drawn_item, '')), 120),
    left(trim(coalesce(p_answer_text, '')), 2000),
    'submitted'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 6.4 Fetch a single published form by exact unguessable ID (no table enumeration)
CREATE OR REPLACE FUNCTION public.get_public_form(p_form_id text)
RETURNS SETOF public.forms
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.forms
  WHERE id = p_form_id
    AND char_length(p_form_id) BETWEEN 16 AND 128
    AND p_form_id ~ '^frm_[a-zA-Z0-9_-]+$'
  LIMIT 1;
$$;

-- 6.5 Submit a response to a published, open custom form (idempotent by response_id for offline sync)
CREATE OR REPLACE FUNCTION public.submit_form_response(
  p_form_id text,
  p_respondent_name text,
  p_respondent_email text,
  p_answers jsonb,
  p_score numeric DEFAULT 0,
  p_max_score numeric DEFAULT 0,
  p_response_id text DEFAULT NULL
)
RETURNS public.form_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form public.forms;
  v_resp_id text;
  v_row public.form_responses;
BEGIN
  SELECT * INTO v_form
  FROM public.forms
  WHERE id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORM_NOT_FOUND';
  END IF;

  IF v_form.published IS DISTINCT FROM true OR v_form.accepting_responses IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FORM_CLOSED';
  END IF;

  v_resp_id := coalesce(
    nullif(regexp_replace(coalesce(p_response_id, ''), '[^a-zA-Z0-9_-]', '', 'g'), ''),
    'resp_' || extract(epoch FROM clock_timestamp())::bigint::text || '_' || encode(gen_random_bytes(6), 'hex')
  );

  INSERT INTO public.form_responses (
    id,
    form_id,
    owner_user_id,
    owner_member_id,
    respondent_name,
    respondent_email,
    answers,
    score,
    max_score
  )
  VALUES (
    left(v_resp_id, 128),
    v_form.id,
    v_form.owner_user_id,
    v_form.owner_member_id,
    left(trim(coalesce(p_respondent_name, '')), 80),
    left(trim(coalesce(p_respondent_email, '')), 120),
    coalesce(p_answers, '[]'::jsonb),
    greatest(0, least(10000, coalesce(p_score, 0))),
    greatest(0, least(10000, coalesce(p_max_score, 0)))
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row
    FROM public.form_responses
    WHERE id = left(v_resp_id, 128)
      AND form_id = v_form.id;
  END IF;

  RETURN v_row;
END;
$$;

-- Grant execute permissions on public RPC helpers
GRANT EXECUTE ON FUNCTION public.register_passcode_member(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_assignment(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_student_work(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_form(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_form_response(text, text, text, jsonb, numeric, numeric, text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passcode_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

-- 7.1 public.users
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
CREATE POLICY "users_select_own_or_admin"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "users_update_own_approved_or_primary_admin" ON public.users;
CREATE POLICY "users_update_own_approved_or_primary_admin"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    public.is_primary_admin()
    OR (id = auth.uid() AND status = 'approved')
  )
  WITH CHECK (
    public.is_primary_admin()
    OR (id = auth.uid() AND status = 'approved')
  );

DROP POLICY IF EXISTS "users_delete_admin_not_self" ON public.users;
CREATE POLICY "users_delete_admin_not_self"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.is_admin() AND id <> auth.uid());

-- 7.2 public.admins
DROP POLICY IF EXISTS "admins_select_own_or_admin" ON public.admins;
CREATE POLICY "admins_select_own_or_admin"
  ON public.admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admins_insert_primary_admin" ON public.admins;
CREATE POLICY "admins_insert_primary_admin"
  ON public.admins FOR INSERT
  TO authenticated
  WITH CHECK (public.is_primary_admin());

DROP POLICY IF EXISTS "admins_delete_primary_admin_not_self" ON public.admins;
CREATE POLICY "admins_delete_primary_admin_not_self"
  ON public.admins FOR DELETE
  TO authenticated
  USING (public.is_primary_admin() AND user_id <> auth.uid());

-- 7.3 public.app_config
DROP POLICY IF EXISTS "app_config_select_public" ON public.app_config;
CREATE POLICY "app_config_select_public"
  ON public.app_config FOR SELECT
  TO anon, authenticated
  USING (id = 'public');

DROP POLICY IF EXISTS "app_config_upsert_admin" ON public.app_config;
CREATE POLICY "app_config_upsert_admin"
  ON public.app_config FOR ALL
  TO authenticated
  USING (id = 'public' AND public.is_admin())
  WITH CHECK (id = 'public' AND public.is_admin());

-- 7.4 public.wheels
DROP POLICY IF EXISTS "wheels_select_owner_approved" ON public.wheels;
CREATE POLICY "wheels_select_owner_approved"
  ON public.wheels FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_approved_user());

DROP POLICY IF EXISTS "wheels_insert_owner_approved" ON public.wheels;
CREATE POLICY "wheels_insert_owner_approved"
  ON public.wheels FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_approved_user());

DROP POLICY IF EXISTS "wheels_update_owner_approved" ON public.wheels;
CREATE POLICY "wheels_update_owner_approved"
  ON public.wheels FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_approved_user())
  WITH CHECK (owner_id = auth.uid() AND public.is_approved_user());

DROP POLICY IF EXISTS "wheels_delete_owner_approved" ON public.wheels;
CREATE POLICY "wheels_delete_owner_approved"
  ON public.wheels FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_approved_user());

-- 7.5 public.spin_results (immutable: no UPDATE policy)
DROP POLICY IF EXISTS "spin_results_select_owner_approved" ON public.spin_results;
CREATE POLICY "spin_results_select_owner_approved"
  ON public.spin_results FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_approved_user());

DROP POLICY IF EXISTS "spin_results_insert_owner_approved" ON public.spin_results;
CREATE POLICY "spin_results_insert_owner_approved"
  ON public.spin_results FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_approved_user());

DROP POLICY IF EXISTS "spin_results_delete_owner_approved" ON public.spin_results;
CREATE POLICY "spin_results_delete_owner_approved"
  ON public.spin_results FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND public.is_approved_user());

-- 7.6 public.passcodes (managed strictly by Primary Admin; public validation uses RPC)
DROP POLICY IF EXISTS "passcodes_all_primary_admin" ON public.passcodes;
CREATE POLICY "passcodes_all_primary_admin"
  ON public.passcodes FOR ALL
  TO authenticated
  USING (public.is_primary_admin())
  WITH CHECK (public.is_primary_admin() AND created_by = auth.uid());

-- 7.7 public.passcode_members (Admins manage; public registration uses RPC)
DROP POLICY IF EXISTS "passcode_members_select_admin" ON public.passcode_members;
CREATE POLICY "passcode_members_select_admin"
  ON public.passcode_members FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "passcode_members_update_admin" ON public.passcode_members;
CREATE POLICY "passcode_members_update_admin"
  ON public.passcode_members FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "passcode_members_delete_admin" ON public.passcode_members;
CREATE POLICY "passcode_members_delete_admin"
  ON public.passcode_members FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 7.8 public.assignments (owner + admin manage; students read single task via RPC)
DROP POLICY IF EXISTS "assignments_select_owner_or_admin" ON public.assignments;
CREATE POLICY "assignments_select_owner_or_admin"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (public.is_admin() OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS "assignments_insert_approved_owner" ON public.assignments;
CREATE POLICY "assignments_insert_approved_owner"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_type = 'google'
    AND owner_user_id = auth.uid()
    AND public.is_approved_user()
  );

DROP POLICY IF EXISTS "assignments_update_owner_or_admin" ON public.assignments;
CREATE POLICY "assignments_update_owner_or_admin"
  ON public.assignments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  )
  WITH CHECK (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  );

DROP POLICY IF EXISTS "assignments_delete_owner_or_admin" ON public.assignments;
CREATE POLICY "assignments_delete_owner_or_admin"
  ON public.assignments FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  );

-- 7.9 public.student_submissions (owner + admin read/review; students submit via RPC)
DROP POLICY IF EXISTS "submissions_select_owner_or_admin" ON public.student_submissions;
CREATE POLICY "submissions_select_owner_or_admin"
  ON public.student_submissions FOR SELECT
  TO authenticated
  USING (public.is_admin() OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS "submissions_update_owner_or_admin" ON public.student_submissions;
CREATE POLICY "submissions_update_owner_or_admin"
  ON public.student_submissions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  )
  WITH CHECK (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  );

DROP POLICY IF EXISTS "submissions_delete_owner_or_admin" ON public.student_submissions;
CREATE POLICY "submissions_delete_owner_or_admin"
  ON public.student_submissions FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  );

-- 7.10 public.forms (owner + admin manage; public respondents read single form via RPC)
DROP POLICY IF EXISTS "forms_select_owner_or_admin" ON public.forms;
CREATE POLICY "forms_select_owner_or_admin"
  ON public.forms FOR SELECT
  TO authenticated
  USING (public.is_admin() OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS "forms_insert_approved_owner" ON public.forms;
CREATE POLICY "forms_insert_approved_owner"
  ON public.forms FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_type = 'google'
    AND owner_user_id = auth.uid()
    AND public.is_approved_user()
  );

DROP POLICY IF EXISTS "forms_update_owner_or_admin" ON public.forms;
CREATE POLICY "forms_update_owner_or_admin"
  ON public.forms FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  )
  WITH CHECK (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  );

DROP POLICY IF EXISTS "forms_delete_owner_or_admin" ON public.forms;
CREATE POLICY "forms_delete_owner_or_admin"
  ON public.forms FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  );

-- 7.11 public.form_responses (immutable; owner + admin read/delete; public submit via RPC)
DROP POLICY IF EXISTS "form_responses_select_owner_or_admin" ON public.form_responses;
CREATE POLICY "form_responses_select_owner_or_admin"
  ON public.form_responses FOR SELECT
  TO authenticated
  USING (public.is_admin() OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS "form_responses_delete_owner_or_admin" ON public.form_responses;
CREATE POLICY "form_responses_delete_owner_or_admin"
  ON public.form_responses FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (owner_user_id = auth.uid() AND public.is_approved_user())
  );

-- -----------------------------------------------------------------------------
-- 8. REALTIME PUBLICATION (OPTIONAL)
-- -----------------------------------------------------------------------------
-- Uncomment below if you want Supabase Realtime subscriptions for live tables:
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE
--   public.users,
--   public.app_config,
--   public.wheels,
--   public.spin_results,
--   public.passcodes,
--   public.passcode_members,
--   public.assignments,
--   public.student_submissions,
--   public.forms,
--   public.form_responses;

COMMIT;
