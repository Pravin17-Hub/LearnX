-- Database creation script for LearnX
CREATE DATABASE IF NOT EXISTS learnx_db;
USE learnx_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reg_no VARCHAR(50),
    name VARCHAR(100),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Administrator', 'Faculty', 'Student', 'Teaching Assistant', 'Research Scholar', 'Mentor') NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- 2. Follows Table (Social network relations)
CREATE TABLE IF NOT EXISTS follows (
    follower_id INT NOT NULL,
    followed_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    join_code VARCHAR(10) NOT NULL UNIQUE,
    qr_code_path VARCHAR(255),
    creator_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_join_code (join_code)
) ENGINE=InnoDB;

-- 4. Classroom Members Table
CREATE TABLE IF NOT EXISTS classroom_members (
    classroom_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role_in_class VARCHAR(50) DEFAULT 'Student',
    PRIMARY KEY (classroom_id, user_id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Materials/Resources Table
CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT, -- NULL if uploaded directly to global directory or subject community
    title VARCHAR(150) NOT NULL,
    description TEXT,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- pdf, docx, mp4, zip, etc.
    category VARCHAR(50) NOT NULL, -- Notes, Video, Syllabus, Assignment Sheet, Project
    topic VARCHAR(100),
    difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Intermediate',
    uploader_id INT NOT NULL,
    downloads INT DEFAULT 0,
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL,
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_category (category),
    INDEX idx_topic (topic)
) ENGINE=InnoDB;

-- 6. Social Feed Posts Table
CREATE TABLE IF NOT EXISTS feed_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200),
    content TEXT NOT NULL,
    type ENUM('text', 'note', 'video', 'assignment', 'project', 'announcement') DEFAULT 'text',
    file_path VARCHAR(255), -- If post has a resource attachment
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Post Likes Table
CREATE TABLE IF NOT EXISTS post_likes (
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Post Comments Table
CREATE TABLE IF NOT EXISTS post_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Subject Communities Table
CREATE TABLE IF NOT EXISTS subject_communities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    member_count INT DEFAULT 0,
    moderator_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_community_name (name)
) ENGINE=InnoDB;

-- 10. Community Members Table
CREATE TABLE IF NOT EXISTS community_members (
    community_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (community_id, user_id),
    FOREIGN KEY (community_id) REFERENCES subject_communities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Community Posts Table (LinkedIn/Reddit like post inside a subject community)
CREATE TABLE IF NOT EXISTS community_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type ENUM('post', 'question', 'poll', 'project') DEFAULT 'post',
    likes INT DEFAULT 0,
    comments INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_id) REFERENCES subject_communities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Classroom Discussion Forums Table (Threaded Forum)
CREATE TABLE IF NOT EXISTS discussion_threads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_solved BOOLEAN DEFAULT FALSE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 13. Forum Replies Table
CREATE TABLE IF NOT EXISTS discussion_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    thread_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    parent_reply_id INT DEFAULT NULL,
    is_accepted_answer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES discussion_threads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id) REFERENCES discussion_replies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 14. Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    file_path VARCHAR(255), -- Link to assignment file
    answer_key TEXT, -- Ideal answers for AI comparison
    rubric TEXT, -- AI marking rubric
    max_marks INT NOT NULL DEFAULT 100,
    deadline DATETIME NOT NULL,
    creator_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Assignment Submissions (OCR + AI EVALUATION SYSTEM)
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL, -- Student's uploaded file (PDF, Image, etc.)
    ocr_text LONGTEXT, -- Extracted text
    ai_marks INT,
    teacher_marks INT,
    confidence_score DECIMAL(5, 2), -- 0.00 to 100.00
    ai_feedback TEXT,
    strengths TEXT,
    weaknesses TEXT,
    missing_concepts TEXT,
    review_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_submission_assignment (assignment_id),
    INDEX idx_submission_student (student_id)
) ENGINE=InnoDB;

-- 16. Quiz Table
CREATE TABLE IF NOT EXISTS quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    shuffle_questions BOOLEAN DEFAULT TRUE,
    negative_marking BOOLEAN DEFAULT FALSE,
    max_marks INT NOT NULL DEFAULT 50,
    creator_id INT NOT NULL,
    is_public TINYINT(1) DEFAULT 0,
    type VARCHAR(20) DEFAULT 'QUIZ',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 17. Quiz Questions Table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    options_json TEXT, -- JSON array of option strings e.g. ["A", "B", "C", "D"]
    correct_answer_json TEXT, -- JSON array of correct option index or answers
    points INT NOT NULL DEFAULT 1,
    negative_points INT DEFAULT 0,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 18. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    student_id INT NULL,
    guest_name VARCHAR(100) NULL,
    score INT NOT NULL,
    max_score INT DEFAULT 0,
    answers_json TEXT NULL,
    ai_feedback TEXT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    auto_saved BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 19. Attendance Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('PRESENT', 'ABSENT', 'LATE') NOT NULL DEFAULT 'PRESENT',
    method ENUM('MANUAL', 'QR', 'LOCATION') NOT NULL DEFAULT 'MANUAL',
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6),
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_attendance (classroom_id, student_id, date)
) ENGINE=InnoDB;

-- 20. Direct Messaging Table
CREATE TABLE IF NOT EXISTS private_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT,
    file_path VARCHAR(255),
    read_receipt BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 21. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- FOLLOW, COMMENT, LIKE, ASSIGNMENT, QUIZ, CHAT, ANNOUNCEMENT
    is_read BOOLEAN DEFAULT FALSE,
    reference_id INT, -- ID of the related item (e.g. post_id, classroom_id)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 22. Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL, -- STREAK, TOP_CONTRIBUTOR, QUIZ_CHAMPION, FACULTY_CHOICE, COMMUNITY_HELPER, PERFECT_ATTENDANCE
    description VARCHAR(255) NOT NULL,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 23. Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('RESOURCE', 'VIDEO', 'NOTE', 'COMMUNITY', 'ASSIGNMENT') NOT NULL,
    item_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ==========================================
-- SEED SAMPLE DATA
-- ==========================================

-- Seed Users (System Administrator only)
INSERT INTO users (username, email, password_hash, role, bio, institution, department, skills, subjects, follower_count, following_count, contribution_score, learning_streak) VALUES
('admin', 'admin@learnx.edu', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Administrator', 'System Administrator of LearnX', 'LearnX Global', 'Administration', 'Database, Server Management, Administration', 'General', 0, 0, 100, 5);

-- Seed Subject Communities (System communities with admin moderator)
INSERT INTO subject_communities (name, description, category, member_count, moderator_id) VALUES
('Java', 'A community dedicated to Java development, Servlet, JSP, Spring, and JDBC ecosystem.', 'Computer Science', 0, 1),
('Python', 'Community for Python scripting, Web frameworks, and automation scripts.', 'Computer Science', 0, 1),
('AI', 'Explore Machine Learning, Deep Learning, NLP, and Computer Vision.', 'Artificial Intelligence', 0, 1),
('Cyber Security', 'Discussions on cryptography, penetration testing, networks and systems security.', 'Computer Science', 0, 1);
