package com.learnx.dao;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import com.learnx.model.Message;
import com.learnx.util.DBConnection;

public class MessageDAO {

    public boolean sendMessage(Message msg) {
        String query = "INSERT INTO private_messages (sender_id, receiver_id, content, file_path) VALUES (?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)) {
            
            ps.setInt(1, msg.getSenderId());
            ps.setInt(2, msg.getReceiverId());
            ps.setString(3, msg.getContent());
            ps.setString(4, msg.getFilePath());
            
            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        msg.setId(rs.getInt(1));
                    }
                }
                
                // Add notification
                try {
                    String senderName = "Someone";
                    String userQuery = "SELECT username, name FROM users WHERE id = ?";
                    try (PreparedStatement psUser = conn.prepareStatement(userQuery)) {
                        psUser.setInt(1, msg.getSenderId());
                        try (ResultSet rsUser = psUser.executeQuery()) {
                            if (rsUser.next()) {
                                String n = rsUser.getString("name");
                                senderName = (n != null && !n.isEmpty()) ? n : rsUser.getString("username");
                            }
                        }
                    }
                    new NotificationDAO().addNotification(msg.getReceiverId(), "New Message from " + senderName, msg.getContent().length() > 50 ? msg.getContent().substring(0, 47) + "..." : msg.getContent(), "CHAT", msg.getSenderId());
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
                
                return true;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public java.util.Map<Integer, Integer> getUnreadCounts(int userId) {
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        String query = "SELECT sender_id, COUNT(*) as count FROM private_messages WHERE receiver_id = ? AND read_receipt = FALSE GROUP BY sender_id";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getInt("sender_id"), rs.getInt("count"));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return map;
    }

    public List<Message> getChatHistory(int senderId, int receiverId) {
        List<Message> list = new ArrayList<>();
        String query = "SELECT * FROM (" +
                       "  SELECT pm.*, u1.username as sender_name, u2.username as receiver_name FROM private_messages pm " +
                       "  JOIN users u1 ON pm.sender_id = u1.id " +
                       "  JOIN users u2 ON pm.receiver_id = u2.id " +
                       "  WHERE (pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?) " +
                       "  ORDER BY pm.created_at DESC LIMIT 100" +
                       ") sub ORDER BY sub.created_at ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, senderId);
            ps.setInt(2, receiverId);
            ps.setInt(3, receiverId);
            ps.setInt(4, senderId);
            
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapMessage(rs));
                }
            }
            
            // Mark loaded messages as read if the recipient is loading them
            String updateQuery = "UPDATE private_messages SET read_receipt = TRUE WHERE sender_id = ? AND receiver_id = ? AND read_receipt = FALSE";
            try (PreparedStatement psUpd = conn.prepareStatement(updateQuery)) {
                psUpd.setInt(1, receiverId);
                psUpd.setInt(2, senderId);
                psUpd.executeUpdate();
            }
            
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Message> getRecentChats(int userId) {
        List<Message> list = new ArrayList<>();
        // Select last message for each unique chat partner
        String query = "SELECT pm.*, u1.username as sender_name, u2.username as receiver_name FROM private_messages pm " +
                       "JOIN users u1 ON pm.sender_id = u1.id " +
                       "JOIN users u2 ON pm.receiver_id = u2.id " +
                       "WHERE pm.id IN ( " +
                       "  SELECT MAX(id) FROM private_messages " +
                       "  WHERE sender_id = ? OR receiver_id = ? " +
                       "  GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id) " +
                       ") " +
                       "ORDER BY pm.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, userId);
            ps.setInt(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapMessage(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    private Message mapMessage(ResultSet rs) throws SQLException {
        Message m = new Message();
        m.setId(rs.getInt("id"));
        m.setSenderId(rs.getInt("sender_id"));
        m.setSenderName(rs.getString("sender_name"));
        m.setReceiverId(rs.getInt("receiver_id"));
        m.setReceiverName(rs.getString("receiver_name"));
        m.setContent(rs.getString("content"));
        m.setFilePath(rs.getString("file_path"));
        m.setReadReceipt(rs.getBoolean("read_receipt"));
        m.setCreatedAt(rs.getTimestamp("created_at"));
        return m;
    }
}
