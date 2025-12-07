-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Store the entire course structure as JSONB
  -- This includes lessons, questions, coding exercises, etc.
  course_data JSONB NOT NULL
);

-- Create index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at DESC);

-- Create index on course_data for JSON queries (optional, but can be useful)
CREATE INDEX IF NOT EXISTS idx_courses_data ON courses USING GIN (course_data);

-- Enable Row Level Security (RLS)
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for service role (server-side)
-- In production, you might want more restrictive policies
CREATE POLICY "Allow all operations for service role"
  ON courses
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policy to allow public read access (for client-side)
CREATE POLICY "Allow public read access"
  ON courses
  FOR SELECT
  USING (true);
