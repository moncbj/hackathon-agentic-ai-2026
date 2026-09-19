-- EduPath Initial Schema Migration (SPEC-000 §4)
-- Contains exactly the 16 required tables

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. skills
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. role_skills
CREATE TABLE IF NOT EXISTS role_skills (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  required_level int NOT NULL CHECK (required_level >= 0 AND required_level <= 4),
  weight int NOT NULL CHECK (weight >= 1 AND weight <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, skill_id)
);

-- 4. skill_prerequisites
CREATE TABLE IF NOT EXISTS skill_prerequisites (
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  prerequisite_skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, prerequisite_skill_id),
  CHECK (skill_id <> prerequisite_skill_id)
);

-- 5. resources
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('course', 'video', 'article', 'docs', 'project', 'practice')),
  level_min int NOT NULL CHECK (level_min >= 0 AND level_min <= 4),
  level_max int NOT NULL CHECK (level_max >= 0 AND level_max <= 4),
  language text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (level_min <= level_max),
  UNIQUE (skill_id, url)
);

-- 6. learners
CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  background text NOT NULL DEFAULT '',
  weekly_hours int NOT NULL DEFAULT 0 CHECK (weekly_hours >= 0),
  extra_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. tutor_styles
CREATE TABLE IF NOT EXISTS tutor_styles (
  learner_id uuid PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'es',
  tone text NOT NULL DEFAULT 'cercano' CHECK (tone IN ('formal', 'cercano', 'motivador')),
  detail_level text NOT NULL DEFAULT 'equilibrado' CHECK (detail_level IN ('resumido', 'equilibrado', 'profundo')),
  use_analogies boolean NOT NULL DEFAULT true,
  free_instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. learner_skills
CREATE TABLE IF NOT EXISTS learner_skills (
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 4),
  verification text NOT NULL DEFAULT 'self_reported' CHECK (verification IN ('self_reported', 'verified')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('locked', 'available', 'in_progress', 'acquired', 'struggling')),
  progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  consecutive_failures int NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, skill_id)
);

-- 9. objectives
CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  description text NOT NULL,
  mastery_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_level int NOT NULL CHECK (target_level >= 0 AND target_level <= 4),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'dropped')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. journeys
CREATE TABLE IF NOT EXISTS journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_current boolean NOT NULL DEFAULT true,
  reason text NOT NULL DEFAULT 'initial' CHECK (reason IN ('initial', 'assessment', 'skipped_activities', 'profile_change')),
  summary text NOT NULL DEFAULT '',
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. activities
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  week int NOT NULL CHECK (week >= 1),
  type text NOT NULL CHECK (type IN ('resource', 'practice', 'project')),
  title text NOT NULL,
  mission text NOT NULL,
  instructions text NOT NULL,
  success_criteria text NOT NULL,
  resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
  estimated_minutes int NOT NULL CHECK (estimated_minutes >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. assessments
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('verification', 'progress')),
  target_level int NOT NULL CHECK (target_level >= 0 AND target_level <= 4),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score numeric(4, 2) CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  measured_level int CHECK (measured_level IS NULL OR (measured_level >= 0 AND measured_level <= 4)),
  passed boolean,
  feedback jsonb,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'graded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz
);

-- 13. gap_analyses
CREATE TABLE IF NOT EXISTS gap_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14. reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  narrative jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 15. notebooks
CREATE TABLE IF NOT EXISTS notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 16. notebook_skills
CREATE TABLE IF NOT EXISTS notebook_skills (
  notebook_id uuid NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notebook_id, skill_id)
);
