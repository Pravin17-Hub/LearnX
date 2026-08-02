package com.learnx.dao;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.learnx.model.Quiz;
import com.learnx.model.QuizQuestion;
import com.learnx.util.DBConnection;

public class QuizDAO {

    public boolean createQuiz(Quiz quiz) {
        String query = "INSERT INTO quizzes (classroom_id, title, description, duration_minutes, shuffle_questions, negative_marking, max_marks, creator_id, is_public, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)) {
            
            if (quiz.getClassroomId() > 0) {
                ps.setInt(1, quiz.getClassroomId());
            } else {
                ps.setNull(1, Types.INTEGER);
            }
            ps.setString(2, quiz.getTitle());
            ps.setString(3, quiz.getDescription());
            ps.setInt(4, quiz.getDurationMinutes());
            ps.setBoolean(5, quiz.isShuffleQuestions());
            ps.setBoolean(6, quiz.isNegativeMarking());
            ps.setInt(7, quiz.getMaxMarks());
            ps.setInt(8, quiz.getCreatorId());
            ps.setBoolean(9, quiz.isPublic());
            ps.setString(10, quiz.getType() != null ? quiz.getType() : "QUIZ");
            
            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        quiz.setId(rs.getInt(1));
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean addQuizQuestion(QuizQuestion q) {
        String query = "INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, correct_answer_json, points, negative_points) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, q.getQuizId());
            ps.setString(2, q.getQuestionText());
            ps.setString(3, q.getQuestionType());
            ps.setString(4, q.getOptionsJson());
            ps.setString(5, q.getCorrectAnswerJson());
            ps.setInt(6, q.getPoints());
            ps.setInt(7, q.getNegativePoints());
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public Quiz getQuizById(int id) {
        String query = "SELECT q.*, u.username as creator_name FROM quizzes q JOIN users u ON q.creator_id = u.id WHERE q.id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Quiz quiz = mapQuiz(rs);
                    quiz.setQuestions(getQuestionsForQuiz(id));
                    return quiz;
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public List<Quiz> getQuizzesForClassroom(int classroomId) {
        List<Quiz> list = new ArrayList<>();
        String query = "SELECT q.*, u.username as creator_name FROM quizzes q JOIN users u ON q.creator_id = u.id WHERE q.classroom_id = ? ORDER BY q.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapQuiz(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<QuizQuestion> getQuestionsForQuiz(int quizId) {
        List<QuizQuestion> list = new ArrayList<>();
        String query = "SELECT * FROM quiz_questions WHERE quiz_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, quizId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapQuestion(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean submitQuizAttempt(int quizId, int studentId, int score, boolean autoSaved) {
        String query = "INSERT INTO quiz_attempts (quiz_id, student_id, score, auto_saved, submit_time) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, quizId);
            ps.setInt(2, studentId);
            ps.setInt(3, score);
            ps.setBoolean(4, autoSaved);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean hasStudentAttemptedQuiz(int quizId, int studentId) {
        String query = "SELECT 1 FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, quizId);
            ps.setInt(2, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Map<String, Object>> getQuizLeaderboard(int quizId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT qa.*, u.username, u.avatar_path FROM quiz_attempts qa " +
                       "JOIN users u ON qa.student_id = u.id " +
                       "WHERE qa.quiz_id = ? ORDER BY qa.score DESC, qa.submit_time ASC LIMIT 10";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, quizId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("studentName", rs.getString("username"));
                    map.put("avatarPath", DBConnection.resolveAvatarPath(rs.getString("avatar_path")));
                    map.put("score", rs.getInt("score"));
                    map.put("submitTime", rs.getTimestamp("submit_time"));
                    map.put("autoSaved", rs.getBoolean("auto_saved"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    private Quiz mapQuiz(ResultSet rs) throws SQLException {
        Quiz q = new Quiz();
        q.setId(rs.getInt("id"));
        q.setClassroomId(rs.getInt("classroom_id"));
        q.setTitle(rs.getString("title"));
        q.setDescription(rs.getString("description"));
        q.setDurationMinutes(rs.getInt("duration_minutes"));
        q.setShuffleQuestions(rs.getBoolean("shuffle_questions"));
        q.setNegativeMarking(rs.getBoolean("negative_marking"));
        q.setMaxMarks(rs.getInt("max_marks"));
        q.setCreatorId(rs.getInt("creator_id"));
        q.setCreatorName(rs.getString("creator_name"));
        q.setCreatedAt(rs.getTimestamp("created_at"));
        q.setPublic(rs.getBoolean("is_public"));
        q.setType(rs.getString("type"));
        return q;
    }

    private QuizQuestion mapQuestion(ResultSet rs) throws SQLException {
        QuizQuestion q = new QuizQuestion();
        q.setId(rs.getInt("id"));
        q.setQuizId(rs.getInt("quiz_id"));
        q.setQuestionText(rs.getString("question_text"));
        q.setQuestionType(rs.getString("question_type"));
        q.setOptionsJson(rs.getString("options_json"));
        q.setCorrectAnswerJson(rs.getString("correct_answer_json"));
        q.setPoints(rs.getInt("points"));
        q.setNegativePoints(rs.getInt("negative_points"));
        return q;
    }

    public List<Quiz> getPublicQuizzes() {
        List<Quiz> list = new ArrayList<>();
        String query = "SELECT q.*, u.username as creator_name FROM quizzes q JOIN users u ON q.creator_id = u.id WHERE q.is_public = 1 ORDER BY q.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {
            
            while (rs.next()) {
                list.add(mapQuiz(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public int submitExtendedQuizAttempt(int quizId, Integer studentId, String guestName, int score, int maxScore, String answersJson, String aiFeedback, boolean autoSaved, String violationReason) {
        String query = "INSERT INTO quiz_attempts (quiz_id, student_id, guest_name, score, max_score, answers_json, ai_feedback, auto_saved, violation_reason, submit_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)) {
            
            ps.setInt(1, quizId);
            if (studentId != null && studentId > 0) {
                ps.setInt(2, studentId);
            } else {
                ps.setNull(2, java.sql.Types.INTEGER);
            }
            if (guestName != null && !guestName.trim().isEmpty()) {
                ps.setString(3, guestName);
            } else {
                ps.setNull(3, java.sql.Types.VARCHAR);
            }
            ps.setInt(4, score);
            ps.setInt(5, maxScore);
            ps.setString(6, answersJson);
            ps.setString(7, aiFeedback);
            ps.setBoolean(8, autoSaved);
            if (violationReason != null && !violationReason.trim().isEmpty()) {
                ps.setString(9, violationReason);
            } else {
                ps.setNull(9, java.sql.Types.VARCHAR);
            }
            
            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        return rs.getInt(1); // Return attempt ID
                    }
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return -1;
    }

    public Map<String, Object> getQuizAttemptById(int attemptId) {
        String query = "SELECT qa.*, u.username as student_name, q.title as quiz_title, q.max_marks as quiz_max_marks FROM quiz_attempts qa " +
                       "JOIN quizzes q ON qa.quiz_id = q.id " +
                       "LEFT JOIN users u ON qa.student_id = u.id " +
                       "WHERE qa.id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, attemptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("quizId", rs.getInt("quiz_id"));
                    map.put("quizTitle", rs.getString("quiz_title"));
                    map.put("studentId", rs.getInt("student_id"));
                    map.put("studentName", rs.getString("student_name"));
                    map.put("guestName", rs.getString("guest_name"));
                    map.put("score", rs.getInt("score"));
                    map.put("maxScore", rs.getInt("max_score"));
                    map.put("quizMaxMarks", rs.getInt("quiz_max_marks"));
                    map.put("answersJson", rs.getString("answers_json"));
                    map.put("aiFeedback", rs.getString("ai_feedback"));
                    map.put("submitTime", rs.getTimestamp("submit_time"));
                    map.put("autoSaved", rs.getBoolean("auto_saved"));
                    map.put("violationReason", rs.getString("violation_reason"));
                    return map;
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public boolean deleteQuiz(int quizId) {
        String deleteAttempts = "DELETE FROM quiz_attempts WHERE quiz_id = ?";
        String deleteQuestions = "DELETE FROM quiz_questions WHERE quiz_id = ?";
        String deleteQuiz = "DELETE FROM quizzes WHERE id = ?";
        
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement ps = conn.prepareStatement(deleteAttempts)) {
                    ps.setInt(1, quizId);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = conn.prepareStatement(deleteQuestions)) {
                    ps.setInt(1, quizId);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = conn.prepareStatement(deleteQuiz)) {
                    ps.setInt(1, quizId);
                    ps.executeUpdate();
                }
                conn.commit();
                return true;
            } catch (SQLException ex) {
                conn.rollback();
                ex.printStackTrace();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Map<String, Object>> getQuizAttemptsForExport(int quizId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT qa.*, u.username, u.name, u.reg_no FROM quiz_attempts qa " +
                       "LEFT JOIN users u ON qa.student_id = u.id " +
                       "WHERE qa.quiz_id = ? ORDER BY qa.score DESC, qa.submit_time ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, quizId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    String studentName = rs.getString("name");
                    String username = rs.getString("username");
                    String guestName = rs.getString("guest_name");
                    String name = (studentName != null && !studentName.isEmpty()) ? studentName : ((username != null && !username.isEmpty()) ? "@" + username : guestName);
                    if (name == null || name.isEmpty()) {
                        name = "Guest Scholar";
                    }
                    map.put("name", name);
                    map.put("reg_no", rs.getString("reg_no"));
                    map.put("score", rs.getInt("score"));
                    map.put("max_score", rs.getInt("max_score"));
                    map.put("submit_time", rs.getTimestamp("submit_time"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Map<String, Object>> getAllQuizAttempts(int quizId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT qa.*, u.username, u.name, u.reg_no FROM quiz_attempts qa " +
                       "LEFT JOIN users u ON qa.student_id = u.id " +
                       "WHERE qa.quiz_id = ? ORDER BY qa.submit_time DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, quizId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    String studentName = rs.getString("name");
                    String username = rs.getString("username");
                    String guestName = rs.getString("guest_name");
                    String name = (studentName != null && !studentName.isEmpty()) ? studentName : ((username != null && !username.isEmpty()) ? "@" + username : guestName);
                    if (name == null || name.isEmpty()) {
                        name = "Guest Scholar";
                    }
                    map.put("id", rs.getInt("id"));
                    map.put("name", name);
                    map.put("reg_no", rs.getString("reg_no"));
                    map.put("score", rs.getInt("score"));
                    map.put("max_score", rs.getInt("max_score"));
                    map.put("submit_time", rs.getTimestamp("submit_time"));
                    map.put("autoSaved", rs.getBoolean("auto_saved"));
                    map.put("violationReason", rs.getString("violation_reason"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean deleteQuizAttempt(int attemptId) {
        String query = "DELETE FROM quiz_attempts WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, attemptId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean updateQuiz(Quiz quiz) {
        String query = "UPDATE quizzes SET title = ?, description = ?, duration_minutes = ?, shuffle_questions = ?, negative_marking = ?, max_marks = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setString(1, quiz.getTitle());
            ps.setString(2, quiz.getDescription());
            ps.setInt(3, quiz.getDurationMinutes());
            ps.setBoolean(4, quiz.isShuffleQuestions());
            ps.setBoolean(5, quiz.isNegativeMarking());
            ps.setInt(6, quiz.getMaxMarks());
            ps.setInt(7, quiz.getId());
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }
}
