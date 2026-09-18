

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin', 'teacher', 'student', 'le_tan', 'academic_admin', 'finance', 'advisor', 'parent')),
  is_active INTEGER NOT NULL DEFAULT 1,
  phone TEXT,
  linked_student_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_student_id TEXT REFERENCES users(id);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'super_admin', 'teacher', 'student', 'le_tan', 'academic_admin', 'finance', 'advisor', 'parent'));

CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  academic_year_id TEXT REFERENCES academic_years(id),
  name TEXT NOT NULL,
  type TEXT,
  start_date TEXT,
  end_date TEXT,
  registration_open TEXT,
  registration_close TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  category TEXT NOT NULL,
  thumbnail TEXT,
  price INTEGER,
  level TEXT,
  tags_json TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tags_json TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_status_check CHECK (status IN ('draft', 'pending', 'published', 'rejected'));

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT,
  lesson_order INTEGER NOT NULL,
  duration TEXT NOT NULL
);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS lesson_order INTEGER;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS duration TEXT;

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled', 'pending_payment')),
  enrolled_at TEXT NOT NULL,
  completed_at TEXT
);

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS completed_at TEXT;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check CHECK (status IN ('active', 'completed', 'cancelled', 'pending_payment'));

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT
);

ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS completed_at TEXT;

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id),
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL,
  time_limit INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single', 'multiple', 'text')),
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS options_json TEXT DEFAULT '[]';

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  answers_json TEXT NOT NULL,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS answers_json TEXT;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS passed INTEGER DEFAULT 0;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS started_at TEXT;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS submitted_at TEXT;

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  deadline TEXT NOT NULL,
  max_score INTEGER NOT NULL
);

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS deadline TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_score INTEGER;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_url TEXT;

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  score INTEGER,
  feedback TEXT,
  submitted_at TEXT NOT NULL,
  graded_at TEXT
);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS graded_at TEXT;

CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tuition_fees (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  semester_id TEXT,
  amount INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'partial', 'paid')),
  paid_amount INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  receipt_code TEXT
);

ALTER TABLE tuition_fees ADD COLUMN IF NOT EXISTS paid_at TEXT;
ALTER TABLE tuition_fees ADD COLUMN IF NOT EXISTS receipt_code TEXT;
ALTER TABLE tuition_fees DROP CONSTRAINT IF EXISTS tuition_fees_status_check;
ALTER TABLE tuition_fees ADD CONSTRAINT tuition_fees_status_check CHECK (status IN ('unpaid', 'partial', 'paid'));

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  semester_id TEXT,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  topic TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note TEXT
);

CREATE TABLE IF NOT EXISTS academic_warnings (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
