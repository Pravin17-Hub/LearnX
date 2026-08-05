package com.learnx.dao;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.learnx.model.Post;
import com.learnx.util.DBConnection;

public class CommunityDAO {

    // ==========================================
    // SOCIAL FEED METHODS
    // ==========================================

    public boolean createPost(Post post) {
        String query = "INSERT INTO feed_posts (user_id, title, content, type, file_path) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)) {
            
            ps.setInt(1, post.getUserId());
            ps.setString(2, post.getTitle());
            ps.setString(3, post.getContent());
            ps.setString(4, post.getType());
            ps.setString(5, post.getFilePath());
            
            int affected = ps.executeUpdate();
            if (affected > 0) {
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        post.setId(rs.getInt(1));
                    }
                }
                return true;
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Post> getFeedPosts() {
        List<Post> list = new ArrayList<>();
        String query = "SELECT p.*, u.username, u.role as user_role, u.avatar_path FROM feed_posts p " +
                       "JOIN users u ON p.user_id = u.id " +
                       "ORDER BY p.created_at DESC LIMIT 30";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {
            
            while (rs.next()) {
                list.add(mapPost(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean toggleLikePost(int postId, int userId) {
        String checkQuery = "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?";
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement psCheck = conn.prepareStatement(checkQuery)) {
                psCheck.setInt(1, postId);
                psCheck.setInt(2, userId);
                
                try (ResultSet rs = psCheck.executeQuery()) {
                    if (rs.next()) {
                        // Already liked, so UNLIKE
                        String delQuery = "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?";
                        String decQuery = "UPDATE feed_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?";
                        try (PreparedStatement psDel = conn.prepareStatement(delQuery);
                             PreparedStatement psDec = conn.prepareStatement(decQuery)) {
                            psDel.setInt(1, postId);
                            psDel.setInt(2, userId);
                            psDel.executeUpdate();
                            
                            psDec.setInt(1, postId);
                            psDec.executeUpdate();
                        }
                    } else {
                        // Not liked, so LIKE
                        String insQuery = "INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)";
                        String incQuery = "UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = ?";
                        try (PreparedStatement psIns = conn.prepareStatement(insQuery);
                             PreparedStatement psInc = conn.prepareStatement(incQuery)) {
                            psIns.setInt(1, postId);
                            psIns.setInt(2, userId);
                            psIns.executeUpdate();
                            
                            psInc.setInt(1, postId);
                            psInc.executeUpdate();
                        }
                    }
                }
                conn.commit();
                return true;
            } catch (SQLException e) {
                conn.rollback();
                e.printStackTrace();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Map<String, Object>> getCommentsForPost(int postId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT c.*, u.username, u.avatar_path FROM post_comments c " +
                       "JOIN users u ON c.user_id = u.id " +
                       "WHERE c.post_id = ? ORDER BY c.created_at ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, postId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("postId", rs.getInt("post_id"));
                    map.put("userId", rs.getInt("user_id"));
                    map.put("username", rs.getString("username"));
                    map.put("avatarPath", DBConnection.resolveAvatarPath(rs.getString("avatar_path")));
                    map.put("content", rs.getString("content"));
                    map.put("parentCommentId", rs.getObject("parent_comment_id"));
                    map.put("createdAt", rs.getTimestamp("created_at"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean addComment(int postId, int userId, String content, Integer parentCommentId) {
        String insertQuery = "INSERT INTO post_comments (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)";
        String updateQuery = "UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = ?";
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement psIns = conn.prepareStatement(insertQuery);
                 PreparedStatement psUpd = conn.prepareStatement(updateQuery)) {
                
                psIns.setInt(1, postId);
                psIns.setInt(2, userId);
                psIns.setString(3, content);
                if (parentCommentId != null) psIns.setInt(4, parentCommentId);
                else psIns.setNull(4, Types.INTEGER);
                
                psIns.executeUpdate();
                
                psUpd.setInt(1, postId);
                psUpd.executeUpdate();
                
                conn.commit();
                return true;
            } catch (SQLException e) {
                conn.rollback();
                e.printStackTrace();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // ==========================================
    // SUBJECT COMMUNITIES
    // ==========================================

    public List<Map<String, Object>> getCommunities() {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT sc.*, u.username as moderator_name FROM subject_communities sc " +
                       "LEFT JOIN users u ON sc.moderator_id = u.id ORDER BY sc.member_count DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {
            
            while (rs.next()) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", rs.getInt("id"));
                map.put("name", rs.getString("name"));
                map.put("description", rs.getString("description"));
                map.put("category", rs.getString("category"));
                map.put("memberCount", rs.getInt("member_count"));
                map.put("moderatorId", rs.getInt("moderator_id"));
                map.put("moderatorName", rs.getString("moderator_name"));
                map.put("createdAt", rs.getTimestamp("created_at"));
                list.add(map);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Map<String, Object>> searchCommunities(String searchStr) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT sc.*, u.username as moderator_name FROM subject_communities sc " +
                       "LEFT JOIN users u ON sc.moderator_id = u.id " +
                       "WHERE sc.name LIKE ? OR sc.description LIKE ? OR sc.category LIKE ? " +
                       "ORDER BY sc.member_count DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            String seek = "%" + searchStr.trim() + "%";
            ps.setString(1, seek);
            ps.setString(2, seek);
            ps.setString(3, seek);
            
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("name", rs.getString("name"));
                    map.put("description", rs.getString("description"));
                    map.put("category", rs.getString("category"));
                    map.put("memberCount", rs.getInt("member_count"));
                    map.put("moderatorId", rs.getInt("moderator_id"));
                    map.put("moderatorName", rs.getString("moderator_name"));
                    map.put("createdAt", rs.getTimestamp("created_at"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean joinCommunity(int userId, int communityId) {
        String checkQuery = "SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement psCheck = conn.prepareStatement(checkQuery)) {
            
            psCheck.setInt(1, communityId);
            psCheck.setInt(2, userId);
            try (ResultSet rs = psCheck.executeQuery()) {
                if (rs.next()) return true; // Already joined
            }
            
            // Join
            String joinQuery = "INSERT INTO community_members (community_id, user_id) VALUES (?, ?)";
            String incQuery = "UPDATE subject_communities SET member_count = member_count + 1 WHERE id = ?";
            
            conn.setAutoCommit(false);
            try (PreparedStatement psJoin = conn.prepareStatement(joinQuery);
                 PreparedStatement psInc = conn.prepareStatement(incQuery)) {
                
                psJoin.setInt(1, communityId);
                psJoin.setInt(2, userId);
                psJoin.executeUpdate();
                
                psInc.setInt(1, communityId);
                psInc.executeUpdate();
                
                conn.commit();
                return true;
            } catch (SQLException e) {
                conn.rollback();
                e.printStackTrace();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Map<String, Object>> getCommunityPosts(int communityId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT cp.*, u.username, u.avatar_path, u.role FROM community_posts cp " +
                       "JOIN users u ON cp.user_id = u.id " +
                       "WHERE cp.community_id = ? ORDER BY cp.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, communityId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("communityId", rs.getInt("community_id"));
                    map.put("userId", rs.getInt("user_id"));
                    map.put("username", rs.getString("username"));
                    map.put("avatarPath", DBConnection.resolveAvatarPath(rs.getString("avatar_path")));
                    map.put("userRole", rs.getString("role"));
                    map.put("title", rs.getString("title"));
                    map.put("content", rs.getString("content"));
                    map.put("type", rs.getString("type"));
                    map.put("likes", rs.getInt("likes"));
                    map.put("comments", rs.getInt("comments"));
                    map.put("createdAt", rs.getTimestamp("created_at"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean createCommunityPost(int communityId, int userId, String title, String content, String type) {
        String query = "INSERT INTO community_posts (community_id, user_id, title, content, type) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, communityId);
            ps.setInt(2, userId);
            ps.setString(3, title);
            ps.setString(4, content);
            ps.setString(5, type);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    // ==========================================
    // DISCUSSION FORUMS (CLASSROOM CHANNELS)
    // ==========================================

    public boolean createForumThread(int classroomId, int userId, String title, String content, boolean isAnonymous) {
        String query = "INSERT INTO discussion_threads (classroom_id, user_id, title, content, is_anonymous) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            ps.setInt(2, userId);
            ps.setString(3, title);
            ps.setString(4, content);
            ps.setBoolean(5, isAnonymous);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public List<Map<String, Object>> getForumThreads(int classroomId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT t.*, u.username, u.avatar_path FROM discussion_threads t " +
                       "JOIN users u ON t.user_id = u.id " +
                       "WHERE t.classroom_id = ? ORDER BY t.is_pinned DESC, t.created_at DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, classroomId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("classroomId", rs.getInt("classroom_id"));
                    map.put("userId", rs.getInt("user_id"));
                    map.put("username", rs.getBoolean("is_anonymous") ? "Anonymous Scholar" : rs.getString("username"));
                    map.put("avatarPath", DBConnection.resolveAvatarPath(rs.getBoolean("is_anonymous") ? "/assets/images/default-avatar.png" : rs.getString("avatar_path")));
                    map.put("title", rs.getString("title"));
                    map.put("content", rs.getString("content"));
                    map.put("isPinned", rs.getBoolean("is_pinned"));
                    map.put("isSolved", rs.getBoolean("is_solved"));
                    map.put("isAnonymous", rs.getBoolean("is_anonymous"));
                    map.put("createdAt", rs.getTimestamp("created_at"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<Map<String, Object>> getForumReplies(int threadId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String query = "SELECT r.*, u.username, u.avatar_path FROM discussion_replies r " +
                       "JOIN users u ON r.user_id = u.id " +
                       "WHERE r.thread_id = ? ORDER BY r.is_accepted_answer DESC, r.created_at ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, threadId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("threadId", rs.getInt("thread_id"));
                    map.put("userId", rs.getInt("user_id"));
                    map.put("username", rs.getString("username"));
                    map.put("avatarPath", DBConnection.resolveAvatarPath(rs.getString("avatar_path")));
                    map.put("content", rs.getString("content"));
                    map.put("parentReplyId", rs.getObject("parent_reply_id"));
                    map.put("isAcceptedAnswer", rs.getBoolean("is_accepted_answer"));
                    map.put("createdAt", rs.getTimestamp("created_at"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public boolean addForumReply(int threadId, int userId, String content, Integer parentReplyId) {
        String query = "INSERT INTO discussion_replies (thread_id, user_id, content, parent_reply_id) VALUES (?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, threadId);
            ps.setInt(2, userId);
            ps.setString(3, content);
            if (parentReplyId != null) ps.setInt(4, parentReplyId);
            else ps.setNull(4, Types.INTEGER);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean markThreadSolved(int threadId) {
        String query = "UPDATE discussion_threads SET is_solved = TRUE WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, threadId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    private Post mapPost(ResultSet rs) throws SQLException {
        Post p = new Post();
        p.setId(rs.getInt("id"));
        p.setUserId(rs.getInt("user_id"));
        p.setUsername(rs.getString("username"));
        p.setUserRole(rs.getString("user_role"));
        p.setAvatarPath(DBConnection.resolveAvatarPath(rs.getString("avatar_path")));
        p.setTitle(rs.getString("title"));
        p.setContent(rs.getString("content"));
        p.setType(rs.getString("type"));
        p.setFilePath(rs.getString("file_path"));
        p.setLikesCount(rs.getInt("likes_count"));
        p.setCommentsCount(rs.getInt("comments_count"));
        p.setCreatedAt(rs.getTimestamp("created_at"));
        return p;
    }
}
