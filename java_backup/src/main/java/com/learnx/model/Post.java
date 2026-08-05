package com.learnx.model;

import java.sql.Timestamp;

public class Post {
    private int id;
    private int userId;
    private String username;    // helper field
    private String userRole;    // helper field
    private String avatarPath;  // helper field
    private String title;
    private String content;
    private String type;        // text, note, video, assignment, project, announcement
    private String filePath;
    private int likesCount;
    private int commentsCount;
    private Timestamp createdAt;

    public Post() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }

    public String getAvatarPath() { return com.learnx.util.DBConnection.resolveAvatarPath(avatarPath); }
    public void setAvatarPath(String avatarPath) { this.avatarPath = avatarPath; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public int getLikesCount() { return likesCount; }
    public void setLikesCount(int likesCount) { this.likesCount = likesCount; }

    public int getCommentsCount() { return commentsCount; }
    public void setCommentsCount(int commentsCount) { this.commentsCount = commentsCount; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
