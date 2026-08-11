-- Add scheduled start and end times to quizzes table
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
