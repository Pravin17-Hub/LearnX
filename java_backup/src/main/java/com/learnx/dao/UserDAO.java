package com.learnx.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import com.learnx.model.User;
import com.learnx.util.DBConnection;
import com.learnx.util.PasswordHasher;

public class UserDAO {
    
    public User authenticate(String identifier, String password) {
        String query = "SELECT * FROM users WHERE username = ? OR email = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setString(1, identifier);
            ps.setString(2, identifier);
            
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String storedHash = rs.getString("password_hash");
                    if (PasswordHasher.checkPassword(password, storedHash)) {
                        return mapUser(rs);
                    }
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public boolean register(User user) {
        String query = "INSERT INTO users (reg_no, name, username, email, password_hash, role, bio, institution, department, skills, subjects, avatar_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setString(1, user.getRegNo());
            ps.setString(2, user.getName());
            ps.setString(3, user.getUsername());
            ps.setString(4, user.getEmail());
            ps.setString(5, PasswordHasher.hashPassword(user.getPasswordHash()));
            ps.setString(6, user.getRole());
            ps.setString(7, user.getBio());
            ps.setString(8, user.getInstitution());
            ps.setString(9, user.getDepartment());
            ps.setString(10, user.getSkills());
            ps.setString(11, user.getSubjects());
            ps.setString(12, user.getAvatarPath() != null ? user.getAvatarPath() : "/assets/images/default-avatar.png");
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public User getUserById(int id) {
        String query = "SELECT * FROM users WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapUser(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public User getUserByUsername(String username) {
        String query = "SELECT * FROM users WHERE username = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapUser(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public boolean updateProfile(User user) {
        String query = "UPDATE users SET bio = ?, institution = ?, department = ?, skills = ?, subjects = ?, avatar_path = ?, cover_path = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setString(1, user.getBio());
            ps.setString(2, user.getInstitution());
            ps.setString(3, user.getDepartment());
            ps.setString(4, user.getSkills());
            ps.setString(5, user.getSubjects());
            ps.setString(6, user.getAvatarPath());
            ps.setString(7, user.getCoverPath());
            ps.setInt(8, user.getId());
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean updateStreakAndScore(int userId, int scoreDelta, int streakDelta) {
        String query = "UPDATE users SET contribution_score = contribution_score + ?, learning_streak = learning_streak + ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, scoreDelta);
            ps.setInt(2, streakDelta);
            ps.setInt(3, userId);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean isFollowing(int followerId, int followedId) {
        String query = "SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            ps.setInt(1, followerId);
            ps.setInt(2, followedId);
            
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    public boolean follow(int followerId, int followedId) {
        if (isFollowing(followerId, followedId)) return false;
        
        String insertQuery = "INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)";
        String updateFollower = "UPDATE users SET following_count = following_count + 1 WHERE id = ?";
        String updateFollowed = "UPDATE users SET follower_count = follower_count + 1 WHERE id = ?";
        
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement psInsert = conn.prepareStatement(insertQuery);
                 PreparedStatement psFollower = conn.prepareStatement(updateFollower);
                 PreparedStatement psFollowed = conn.prepareStatement(updateFollowed)) {
                
                psInsert.setInt(1, followerId);
                psInsert.setInt(2, followedId);
                psInsert.executeUpdate();
                
                psFollower.setInt(1, followerId);
                psFollower.executeUpdate();
                
                psFollowed.setInt(1, followedId);
                psFollowed.executeUpdate();
                
                conn.commit();
                try {
                    User follower = getUserById(followerId);
                    String followerName = (follower != null) ? follower.getUsername() : "Someone";
                    new NotificationDAO().addNotification(followedId, "New Follower", followerName + " started following you.", "FOLLOW", followerId);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
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

    public boolean unfollow(int followerId, int followedId) {
        if (!isFollowing(followerId, followedId)) return false;
        
        String deleteQuery = "DELETE FROM follows WHERE follower_id = ? AND followed_id = ?";
        String updateFollower = "UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = ?";
        String updateFollowed = "UPDATE users SET follower_count = GREATEST(0, follower_count - 1) WHERE id = ?";
        
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement psDelete = conn.prepareStatement(deleteQuery);
                 PreparedStatement psFollower = conn.prepareStatement(updateFollower);
                 PreparedStatement psFollowed = conn.prepareStatement(updateFollowed)) {
                
                psDelete.setInt(1, followerId);
                psDelete.setInt(2, followedId);
                psDelete.executeUpdate();
                
                psFollower.setInt(1, followerId);
                psFollower.executeUpdate();
                
                psFollowed.setInt(1, followedId);
                psFollowed.executeUpdate();
                
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

    public List<User> getLeaderboard() {
        List<User> list = new ArrayList<>();
        String query = "SELECT * FROM users ORDER BY contribution_score DESC LIMIT 10";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {
            
            while (rs.next()) {
                list.add(mapUser(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<User> searchUsers(String searchStr) {
        List<User> list = new ArrayList<>();
        String query = "SELECT * FROM users WHERE username LIKE ? OR bio LIKE ? OR institution LIKE ? OR department LIKE ? OR role LIKE ? ORDER BY contribution_score DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query)) {
            
            String seek = "%" + searchStr.trim() + "%";
            ps.setString(1, seek);
            ps.setString(2, seek);
            ps.setString(3, seek);
            ps.setString(4, seek);
            ps.setString(5, seek);
            
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapUser(rs));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public List<User> getAllUsers() {
        List<User> list = new ArrayList<>();
        String query = "SELECT * FROM users ORDER BY username ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapUser(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    private User mapUser(ResultSet rs) throws SQLException {
        User u = new User();
        u.setId(rs.getInt("id"));
        u.setRegNo(rs.getString("reg_no"));
        u.setName(rs.getString("name"));
        u.setUsername(rs.getString("username"));
        u.setEmail(rs.getString("email"));
        u.setRole(rs.getString("role"));
        u.setBio(rs.getString("bio"));
        u.setInstitution(rs.getString("institution"));
        u.setDepartment(rs.getString("department"));
        u.setSkills(rs.getString("skills"));
        u.setSubjects(rs.getString("subjects"));
        u.setAvatarPath(rs.getString("avatar_path"));
        u.setCoverPath(rs.getString("cover_path"));
        u.setFollowerCount(rs.getInt("follower_count"));
        u.setFollowingCount(rs.getInt("following_count"));
        u.setContributionScore(rs.getInt("contribution_score"));
        u.setLearningStreak(rs.getInt("learning_streak"));
        u.setCreatedAt(rs.getTimestamp("created_at"));
        u.setUpdatedAt(rs.getTimestamp("updated_at"));
        return u;
    }
}
