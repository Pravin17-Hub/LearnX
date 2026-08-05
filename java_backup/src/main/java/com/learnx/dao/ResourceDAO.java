package com.learnx.dao;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import com.learnx.model.Material;
import com.learnx.util.DBConnection;

public class ResourceDAO {

    public boolean uploadMaterial(Material material) {
        String query = "INSERT INTO materials (classroom_id, title, description, file_path, file_type, category, topic, difficulty, uploader_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)) {
            
            if (material.getClassroomId() != null) ps.setInt(1, material.getClassroomId());
            else ps.setNull(1, Types.INTEGER);
            
            ps.setString(2, material.getTitle());
            ps.setString(3, material.getDescription());
            ps.setString(4, material.getFilePath());
            ps.setString(5, material.getFileType());
            ps.setString(6, material.getCategory());
            ps.setString(7, material.getTopic());
            ps.setString(8, material.getDifficulty());
            ps.setInt(9, material.getUploaderId());
            
            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        material.setId(rs.getInt(1));
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public Material getMaterialById(int id) {
        String query = "SELECT m.*, u.username as uploader_name FROM materials m JOIN users u ON m.uploader_id = u.id WHERE m.id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapMaterial(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public boolean incrementDownloads(int id) {
        String query = "UPDATE materials SET downloads = downloads + 1 WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean incrementViews(int id) {
        String query = "UPDATE materials SET views = views + 1 WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean incrementLikes(int id) {
        String query = "UPDATE materials SET likes = likes + 1 WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Material> getMaterialsForClassroom(int classroomId) {
        List<Material> list = new ArrayList<>();
        String query = "SELECT m.*, u.username as uploader_name FROM materials m JOIN users u ON m.uploader_id = u.id WHERE m.classroom_id = ? ORDER BY m.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapMaterial(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Material> getGlobalResources() {
        List<Material> list = new ArrayList<>();
        String query = "SELECT m.*, u.username as uploader_name FROM materials m JOIN users u ON m.uploader_id = u.id ORDER BY m.views DESC, m.downloads DESC LIMIT 20";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {
            
            while (rs.next()) {
                list.add(mapMaterial(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Material> searchMaterials(String searchStr, String category, String difficulty, String topic) {
        List<Material> list = new ArrayList<>();
        StringBuilder query = new StringBuilder("SELECT m.*, u.username as uploader_name FROM materials m JOIN users u ON m.uploader_id = u.id WHERE 1=1 ");
        
        if (searchStr != null && !searchStr.trim().isEmpty()) {
            query.append("AND (m.title LIKE ? OR m.description LIKE ?) ");
        }
        if (category != null && !category.equals("All") && !category.trim().isEmpty()) {
            query.append("AND m.category = ? ");
        }
        if (difficulty != null && !difficulty.equals("All") && !difficulty.trim().isEmpty()) {
            query.append("AND m.difficulty = ? ");
        }
        if (topic != null && !topic.equals("All") && !topic.trim().isEmpty()) {
            query.append("AND m.topic LIKE ? ");
        }
        query.append("ORDER BY m.created_at DESC");
        
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query.toString())) {
            
            int paramIndex = 1;
            if (searchStr != null && !searchStr.trim().isEmpty()) {
                String seek = "%" + searchStr.trim() + "%";
                ps.setString(paramIndex++, seek);
                ps.setString(paramIndex++, seek);
            }
            if (category != null && !category.equals("All") && !category.trim().isEmpty()) {
                ps.setString(paramIndex++, category.trim());
            }
            if (difficulty != null && !difficulty.equals("All") && !difficulty.trim().isEmpty()) {
                ps.setString(paramIndex++, difficulty.trim());
            }
            if (topic != null && !topic.equals("All") && !topic.trim().isEmpty()) {
                ps.setString(paramIndex++, "%" + topic.trim() + "%");
            }
            
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapMaterial(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    private Material mapMaterial(ResultSet rs) throws SQLException {
        Material m = new Material();
        m.setId(rs.getInt("id"));
        
        int classId = rs.getInt("classroom_id");
        m.setClassroomId(rs.wasNull() ? null : classId);
        
        m.setTitle(rs.getString("title"));
        m.setDescription(rs.getString("description"));
        m.setFilePath(rs.getString("file_path"));
        m.setFileType(rs.getString("file_type"));
        m.setCategory(rs.getString("category"));
        m.setTopic(rs.getString("topic"));
        m.setDifficulty(rs.getString("difficulty"));
        m.setUploaderId(rs.getInt("uploader_id"));
        m.setUploaderName(rs.getString("uploader_name"));
        m.setDownloads(rs.getInt("downloads"));
        m.setViews(rs.getInt("views"));
        m.setLikes(rs.getInt("likes"));
        m.setCreatedAt(rs.getTimestamp("created_at"));
        return m;
    }
}
