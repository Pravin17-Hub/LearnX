package com.learnx.dao;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.learnx.model.Classroom;
import com.learnx.model.User;
import com.learnx.util.DBConnection;

public class ClassroomDAO {

    public boolean createClassroom(Classroom classroom) {
        String query = "INSERT INTO classrooms (class_name, description, subject, join_code, qr_code_path, creator_id) VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)) {
            
            ps.setString(1, classroom.getClassName());
            ps.setString(2, classroom.getDescription());
            ps.setString(3, classroom.getSubject());
            ps.setString(4, classroom.getJoinCode());
            ps.setString(5, classroom.getQrCodePath());
            ps.setInt(6, classroom.getCreatorId());
            
            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        classroom.setId(rs.getInt(1));
                        
                        // Auto-add creator to classroom members as Faculty/creator
                        String joinQuery = "INSERT INTO classroom_members (classroom_id, user_id, role_in_class) VALUES (?, ?, ?)";
                        try (PreparedStatement psMember = conn.prepareStatement(joinQuery)) {
                            psMember.setInt(1, classroom.getId());
                            psMember.setInt(2, classroom.getCreatorId());
                            psMember.setString(3, "Faculty");
                            psMember.executeUpdate();
                        }
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public Classroom getClassroomById(int id) {
        String query = "SELECT c.*, u.username as creator_name FROM classrooms c JOIN users u ON c.creator_id = u.id WHERE c.id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapClassroom(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public Classroom getClassroomByJoinCode(String joinCode) {
        String query = "SELECT c.*, u.username as creator_name FROM classrooms c JOIN users u ON c.creator_id = u.id WHERE c.join_code = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setString(1, joinCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapClassroom(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public boolean joinClassroom(int userId, String joinCode) {
        Classroom target = getClassroomByJoinCode(joinCode);
        if (target == null) return false;
        
        // Check if already in class
        String checkQuery = "SELECT 1 FROM classroom_members WHERE classroom_id = ? AND user_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement psCheck = conn.prepareStatement(checkQuery)) {
            
            psCheck.setInt(1, target.getId());
            psCheck.setInt(2, userId);
            try (ResultSet rs = psCheck.executeQuery()) {
                if (rs.next()) {
                    return true; // Already joined
                }
            }
            
            // Get user role to set role_in_class
            String roleQuery = "SELECT role FROM users WHERE id = ?";
            String classRole = "Student";
            try (PreparedStatement psRole = conn.prepareStatement(roleQuery)) {
                psRole.setInt(1, userId);
                try (ResultSet rsRole = psRole.executeQuery()) {
                    if (rsRole.next()) {
                        classRole = rsRole.getString("role");
                    }
                }
            }
            
            // Insert membership
            String joinQuery = "INSERT INTO classroom_members (classroom_id, user_id, role_in_class) VALUES (?, ?, ?)";
            try (PreparedStatement psJoin = conn.prepareStatement(joinQuery)) {
                psJoin.setInt(1, target.getId());
                psJoin.setInt(2, userId);
                psJoin.setString(3, classRole);
                return psJoin.executeUpdate() > 0;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Classroom> getClassroomsForUser(int userId) {
        List<Classroom> list = new ArrayList<>();
        String query = "SELECT c.*, u.username as creator_name FROM classrooms c " +
                       "JOIN classroom_members cm ON c.id = cm.classroom_id " +
                       "JOIN users u ON c.creator_id = u.id " +
                       "WHERE cm.user_id = ? " +
                       "ORDER BY c.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapClassroom(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<User> getMembersInClassroom(int classroomId) {
        List<User> list = new ArrayList<>();
        String query = "SELECT u.* FROM users u " +
                       "JOIN classroom_members cm ON u.id = cm.user_id " +
                       "WHERE cm.classroom_id = ? " +
                       "ORDER BY u.role, u.username";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    User u = new User();
                    u.setId(rs.getInt("id"));
                    u.setUsername(rs.getString("username"));
                    u.setEmail(rs.getString("email"));
                    u.setRole(rs.getString("role"));
                    u.setBio(rs.getString("bio"));
                    u.setAvatarPath(rs.getString("avatar_path"));
                    list.add(u);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean markAttendance(int classroomId, int studentId, String status, String method, Double lat, Double lng) {
        String query = "INSERT INTO attendance_records (classroom_id, student_id, date, status, method, latitude, longitude) " +
                       "VALUES (?, ?, CURRENT_DATE, ?, ?, ?, ?) " +
                       "ON DUPLICATE KEY UPDATE status = ?, method = ?, latitude = ?, longitude = ?, marked_at = CURRENT_TIMESTAMP";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            ps.setInt(2, studentId);
            ps.setString(3, status);
            ps.setString(4, method);
            if (lat != null) ps.setDouble(5, lat); else ps.setNull(5, Types.DECIMAL);
            if (lng != null) ps.setDouble(6, lng); else ps.setNull(6, Types.DECIMAL);
            
            // Updates
            ps.setString(7, status);
            ps.setString(8, method);
            if (lat != null) ps.setDouble(9, lat); else ps.setNull(9, Types.DECIMAL);
            if (lng != null) ps.setDouble(10, lng); else ps.setNull(10, Types.DECIMAL);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public Map<String, Integer> getAttendanceAnalytics(int classroomId, int studentId) {
        Map<String, Integer> map = new HashMap<>();
        map.put("PRESENT", 0);
        map.put("ABSENT", 0);
        map.put("LATE", 0);
        
        String query = "SELECT status, COUNT(*) as count FROM attendance_records WHERE classroom_id = ? AND student_id = ? GROUP BY status";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            ps.setInt(2, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getString("status"), rs.getInt("count"));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return map;
    }

    public Map<String, Integer> getClassroomDailyAttendance(int classroomId) {
        Map<String, Integer> map = new HashMap<>();
        map.put("PRESENT", 0);
        map.put("ABSENT", 0);
        map.put("LATE", 0);
        
        String query = "SELECT status, COUNT(*) as count FROM attendance_records WHERE classroom_id = ? AND date = CURRENT_DATE GROUP BY status";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getString("status"), rs.getInt("count"));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return map;
    }

    private Classroom mapClassroom(ResultSet rs) throws SQLException {
        Classroom c = new Classroom();
        c.setId(rs.getInt("id"));
        c.setClassName(rs.getString("class_name"));
        c.setDescription(rs.getString("description"));
        c.setSubject(rs.getString("subject"));
        c.setJoinCode(rs.getString("join_code"));
        c.setQrCodePath(rs.getString("qr_code_path"));
        c.setCreatorId(rs.getInt("creator_id"));
        c.setCreatorName(rs.getString("creator_name"));
        c.setCreatedAt(rs.getTimestamp("created_at"));
        return c;
    }
}
