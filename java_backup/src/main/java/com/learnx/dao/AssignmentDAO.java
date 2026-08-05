package com.learnx.dao;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import com.learnx.model.Assignment;
import com.learnx.model.Submission;
import com.learnx.util.DBConnection;

public class AssignmentDAO {

    public boolean createAssignment(Assignment assignment) {
        String query = "INSERT INTO assignments (classroom_id, title, description, file_path, answer_key, rubric, max_marks, deadline, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)) {
            
            ps.setInt(1, assignment.getClassroomId());
            ps.setString(2, assignment.getTitle());
            ps.setString(3, assignment.getDescription());
            ps.setString(4, assignment.getFilePath());
            ps.setString(5, assignment.getAnswerKey());
            ps.setString(6, assignment.getRubric());
            ps.setInt(7, assignment.getMaxMarks());
            ps.setTimestamp(8, assignment.getDeadline());
            ps.setInt(9, assignment.getCreatorId());
            
            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        assignment.setId(rs.getInt(1));
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public Assignment getAssignmentById(int id) {
        String query = "SELECT a.*, u.username as creator_name FROM assignments a JOIN users u ON a.creator_id = u.id WHERE a.id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapAssignment(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public List<Assignment> getAssignmentsForClassroom(int classroomId) {
        List<Assignment> list = new ArrayList<>();
        String query = "SELECT a.*, u.username as creator_name FROM assignments a JOIN users u ON a.creator_id = u.id WHERE a.classroom_id = ? ORDER BY a.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapAssignment(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean submitAssignment(Submission submission) {
        // Delete previous submission if exists to support version history/attempts
        String deleteQuery = "DELETE FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?";
        String insertQuery = "INSERT INTO assignment_submissions (assignment_id, student_id, file_path, review_status) VALUES (?, ?, ?, 'PENDING')";
        
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement psDel = conn.prepareStatement(deleteQuery);
                 PreparedStatement psIns = conn.prepareStatement(insertQuery, Statement.RETURN_GENERATED_KEYS)) {
                
                psDel.setInt(1, submission.getAssignmentId());
                psDel.setInt(2, submission.getStudentId());
                psDel.executeUpdate();
                
                psIns.setInt(1, submission.getAssignmentId());
                psIns.setInt(2, submission.getStudentId());
                psIns.setString(3, submission.getFilePath());
                
                int affected = psIns.executeUpdate();
                if (affected > 0) {
                    try (ResultSet rs = psIns.getGeneratedKeys()) {
                        if (rs.next()) {
                            submission.setId(rs.getInt(1));
                        }
                    }
                    conn.commit();
                    return true;
                }
                conn.rollback();
            } catch (SQLException e) {
                conn.rollback();
                e.printStackTrace();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public Submission getSubmissionById(int id) {
        String query = "SELECT s.*, u.username as student_name, a.title as assignment_title FROM assignment_submissions s " +
                       "JOIN users u ON s.student_id = u.id " +
                       "JOIN assignments a ON s.assignment_id = a.id " +
                       "WHERE s.id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapSubmission(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public Submission getSubmissionForStudent(int assignmentId, int studentId) {
        String query = "SELECT s.*, u.username as student_name, a.title as assignment_title FROM assignment_submissions s " +
                       "JOIN users u ON s.student_id = u.id " +
                       "JOIN assignments a ON s.assignment_id = a.id " +
                       "WHERE s.assignment_id = ? AND s.student_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, assignmentId);
            ps.setInt(2, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapSubmission(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public List<Submission> getSubmissionsForAssignment(int assignmentId) {
        List<Submission> list = new ArrayList<>();
        String query = "SELECT s.*, u.username as student_name, a.title as assignment_title FROM assignment_submissions s " +
                       "JOIN users u ON s.student_id = u.id " +
                       "JOIN assignments a ON s.assignment_id = a.id " +
                       "WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, assignmentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapSubmission(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean updateAISubmissionDraft(int submissionId, int aiMarks, double confidence, String ocrText, 
                                           String feedback, String strengths, String weaknesses, String missingConcepts) {
        String query = "UPDATE assignment_submissions SET ai_marks = ?, confidence_score = ?, ocr_text = ?, " +
                       "ai_feedback = ?, strengths = ?, weaknesses = ?, missing_concepts = ?, review_status = 'PENDING' WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, aiMarks);
            ps.setDouble(2, confidence);
            ps.setString(3, ocrText);
            ps.setString(4, feedback);
            ps.setString(5, strengths);
            ps.setString(6, weaknesses);
            ps.setString(7, missingConcepts);
            ps.setInt(8, submissionId);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean publishTeacherMarks(int submissionId, int teacherMarks, String status) {
        String query = "UPDATE assignment_submissions SET teacher_marks = ?, review_status = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, teacherMarks);
            ps.setString(2, status); // APPROVED, REJECTED
            ps.setInt(3, submissionId);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    private Assignment mapAssignment(ResultSet rs) throws SQLException {
        Assignment a = new Assignment();
        a.setId(rs.getInt("id"));
        a.setClassroomId(rs.getInt("classroom_id"));
        a.setTitle(rs.getString("title"));
        a.setDescription(rs.getString("description"));
        a.setFilePath(rs.getString("file_path"));
        a.setAnswerKey(rs.getString("answer_key"));
        a.setRubric(rs.getString("rubric"));
        a.setMaxMarks(rs.getInt("max_marks"));
        a.setDeadline(rs.getTimestamp("deadline"));
        a.setCreatorId(rs.getInt("creator_id"));
        a.setCreatorName(rs.getString("creator_name"));
        a.setCreatedAt(rs.getTimestamp("created_at"));
        return a;
    }

    private Submission mapSubmission(ResultSet rs) throws SQLException {
        Submission s = new Submission();
        s.setId(rs.getInt("id"));
        s.setAssignmentId(rs.getInt("assignment_id"));
        s.setAssignmentTitle(rs.getString("assignment_title"));
        s.setStudentId(rs.getInt("student_id"));
        s.setStudentName(rs.getString("student_name"));
        s.setFilePath(rs.getString("file_path"));
        s.setOcrText(rs.getString("ocr_text"));
        
        int aiM = rs.getInt("ai_marks");
        s.setAiMarks(rs.wasNull() ? null : aiM);
        
        int teachM = rs.getInt("teacher_marks");
        s.setTeacherMarks(rs.wasNull() ? null : teachM);
        
        s.setConfidenceScore(rs.getDouble("confidence_score"));
        s.setAiFeedback(rs.getString("ai_feedback"));
        s.setStrengths(rs.getString("strengths"));
        s.setWeaknesses(rs.getString("weaknesses"));
        s.setMissingConcepts(rs.getString("missing_concepts"));
        s.setReviewStatus(rs.getString("review_status"));
        s.setSubmittedAt(rs.getTimestamp("submitted_at"));
        return s;
    }
}
