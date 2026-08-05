-- PostgreSQL schema translation for Supabase (LearnX)

-- Create helper function for automatically updating the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    reg_no VARCHAR(50),
    name VARCHAR(100),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Administrator', 'Faculty', 'Student', 'Teaching Assistant', 'Research Scholar', 'Mentor')),
    bio TEXT,
    institution VARCHAR(150),
    department VARCHAR(100),
    skills TEXT, -- Comma-separated list or JSON
    subjects TEXT, -- Comma-separated list
    avatar_path VARCHAR(255) DEFAULT '/assets/images/default-avatar.png',
    cover_path VARCHAR(255) DEFAULT '/assets/images/default-cover.jpg',
    follower_count INT DEFAULT 0,
    following_count INT DEFAULT 0,
    contribution_score INT DEFAULT 0,
    learning_streak INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add update trigger for users
CREATE TRIGGER update_users_modtime 
BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 2. Follows Table
CREATE TABLE IF NOT EXISTS follows (
    follower_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, followed_id)
);

-- 3. Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
    id SERIAL PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    join_code VARCHAR(10) NOT NULL UNIQUE,
    qr_code_path VARCHAR(255),
    creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Classroom Members Table
CREATE TABLE IF NOT EXISTS classroom_members (
    classroom_id INT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    role_in_class VARCHAR(50) DEFAULT 'Student',
    PRIMARY KEY (classroom_id, user_id)
);

-- 5. Materials/Resources Table
CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    classroom_id INT REFERENCES classrooms(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL, -- Notes, Video, Syllabus, Assignment Sheet, Project
    topic VARCHAR(100),
    difficulty VARCHAR(50) DEFAULT 'Intermediate' CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downloads INT DEFAULT 0,
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Social Feed Posts Table
CREATE TABLE IF NOT EXISTS feed_posts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'note', 'video', 'assignment', 'project', 'announcement')),
    file_path VARCHAR(255),
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Post Likes Table
CREATE TABLE IF NOT EXISTS post_likes (
    post_id INT NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- 8. Post Comments Table
CREATE TABLE IF NOT EXISTS post_comments (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id INT REFERENCES post_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Subject Communities Table
CREATE TABLE IF NOT EXISTS subject_communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    member_count INT DEFAULT 0,
    moderator_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Community Members Table
CREATE TABLE IF NOT EXISTS community_members (
    community_id INT NOT NULL REFERENCES subject_communities(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

-- 11. Community Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    id SERIAL PRIMARY KEY,
    community_id INT NOT NULL REFERENCES subject_communities(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'post' CHECK (type IN ('post', 'question', 'poll', 'project')),
    likes INT DEFAULT 0,
    comments INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Classroom Discussion Forums Table
CREATE TABLE IF NOT EXISTS discussion_threads (
    id SERIAL PRIMARY KEY,
    classroom_id INT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_solved BOOLEAN DEFAULT FALSE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Forum Replies Table
CREATE TABLE IF NOT EXISTS discussion_replies (
    id SERIAL PRIMARY KEY,
    thread_id INT NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_reply_id INT REFERENCES discussion_replies(id) ON DELETE CASCADE,
    is_accepted_answer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    classroom_id INT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    file_path VARCHAR(255),
    answer_key TEXT,
    rubric TEXT,
    max_marks INT NOT NULL DEFAULT 100,
    deadline TIMESTAMPTZ NOT NULL,
    creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Assignment Submissions (OCR + AI EVALUATION SYSTEM)
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    ocr_text TEXT,
    ai_marks INT,
    teacher_marks INT,
    confidence_score DECIMAL(5, 2),
    ai_feedback TEXT,
    strengths TEXT,
    weaknesses TEXT,
    missing_concepts TEXT,
    review_status VARCHAR(50) DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Quiz Table
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    classroom_id INT REFERENCES classrooms(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    shuffle_questions BOOLEAN DEFAULT TRUE,
    negative_marking BOOLEAN DEFAULT FALSE,
    max_marks INT NOT NULL DEFAULT 50,
    creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    type VARCHAR(20) DEFAULT 'QUIZ',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Quiz Questions Table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    options_json TEXT, -- JSON array of option strings
    correct_answer_json TEXT, -- JSON array of correct option index/answers
    points INT NOT NULL DEFAULT 1,
    negative_points INT DEFAULT 0
);

-- 18. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id INT REFERENCES users(id) ON DELETE CASCADE,
    guest_name VARCHAR(100),
    score INT NOT NULL,
    max_score INT DEFAULT 0,
    answers_json TEXT,
    ai_feedback TEXT,
    violation_reason VARCHAR(255),
    start_time TIMESTAMPTZ DEFAULT NOW(),
    submit_time TIMESTAMPTZ DEFAULT NOW(),
    auto_saved BOOLEAN DEFAULT FALSE
);

-- 19. Attendance Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    classroom_id INT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
    method VARCHAR(20) NOT NULL DEFAULT 'MANUAL' CHECK (method IN ('MANUAL', 'QR', 'LOCATION')),
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6),
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (classroom_id, student_id, date)
);

-- 20. Direct Messaging Table
CREATE TABLE IF NOT EXISTS private_messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    file_path VARCHAR(255),
    read_receipt BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- FOLLOW, COMMENT, LIKE, ASSIGNMENT, QUIZ, CHAT, ANNOUNCEMENT
    is_read BOOLEAN DEFAULT FALSE,
    reference_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- STREAK, TOP_CONTRIBUTOR, QUIZ_CHAMPION, FACULTY_CHOICE, COMMUNITY_HELPER, PERFECT_ATTENDANCE
    description VARCHAR(255) NOT NULL,
    awarded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('RESOURCE', 'VIDEO', 'NOTE', 'COMMUNITY', 'ASSIGNMENT')),
    item_id INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance optimization
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_classrooms_join_code ON classrooms(join_code);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_topic ON materials(topic);
CREATE INDEX idx_subject_comm_name ON subject_communities(name);
CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON assignment_submissions(student_id);

-- Seed Initial System Administrator
INSERT INTO users (username, email, password_hash, role, bio, institution, department, skills, subjects, follower_count, following_count, contribution_score, learning_streak) 
VALUES (
    'admin', 
    'admin@learnx.edu', 
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', -- SHA-256 hash for 'admin' password
    'Administrator', 
    'System Administrator of LearnX', 
    'LearnX Global', 
    'Administration', 
    'Database, Server Management, Administration', 
    'General', 
    0, 0, 100, 5
) ON CONFLICT (username) DO NOTHING;

-- Seed default subject communities
INSERT INTO subject_communities (name, description, category, member_count) 
VALUES 
('Java', 'A community dedicated to Java development, Servlet, JSP, Spring, and JDBC ecosystem.', 'Computer Science', 0),
('Python', 'Community for Python scripting, Web frameworks, and automation scripts.', 'Computer Science', 0),
('AI', 'Explore Machine Learning, Deep Learning, NLP, and Computer Vision.', 'Artificial Intelligence', 0),
('Cyber Security', 'Discussions on cryptography, penetration testing, networks and systems security.', 'Computer Science', 0)
ON CONFLICT (name) DO NOTHING;
