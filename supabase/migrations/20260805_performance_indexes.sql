-- Performance Optimization Indexes for LearnX (1000+ Concurrent Users)

-- Feed Posts Optimization
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);

-- Post Likes & Comments Optimization
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_comment_id);

-- Community Optimization
CREATE INDEX IF NOT EXISTS idx_community_posts_comm_id ON community_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);

-- Classroom Discussion Forums Optimization
CREATE INDEX IF NOT EXISTS idx_disc_threads_class_id ON discussion_threads(classroom_id);
CREATE INDEX IF NOT EXISTS idx_disc_threads_created_at ON discussion_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disc_replies_thread_id ON discussion_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_disc_replies_parent_id ON discussion_replies(parent_reply_id);

-- Course Materials & Assignments Optimization
CREATE INDEX IF NOT EXISTS idx_assignments_classroom_id ON assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_classroom_id ON quizzes(classroom_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);

-- Quiz Attempts & Attendance Records Optimization
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance_records(classroom_id, date);

-- Private Messaging & Notifications Optimization
CREATE INDEX IF NOT EXISTS idx_private_msg_sender_receiver ON private_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_private_msg_created_at ON private_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Gamification & User Activity Optimization
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
