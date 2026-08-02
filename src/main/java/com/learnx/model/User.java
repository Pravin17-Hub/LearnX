package com.learnx.model;

import java.sql.Timestamp;

public class User {
    private int id;
    private String regNo;
    private String name;
    private String username;
    private String email;
    private String passwordHash;
    private String role;
    private String bio;
    private String institution;
    private String department;
    private String skills;
    private String subjects;
    private String avatarPath;
    private String coverPath;
    private int followerCount;
    private int followingCount;
    private int contributionScore;
    private int learningStreak;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    // Constructors
    public User() {}

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRegNo() { return regNo; }
    public void setRegNo(String regNo) { this.regNo = regNo; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getInstitution() { return institution; }
    public void setInstitution(String institution) { this.institution = institution; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getSkills() { return skills; }
    public void setSkills(String skills) { this.skills = skills; }

    public String getSubjects() { return subjects; }
    public void setSubjects(String subjects) { this.subjects = subjects; }

    public String getAvatarPath() { return com.learnx.util.DBConnection.resolveAvatarPath(avatarPath); }
    public void setAvatarPath(String avatarPath) { this.avatarPath = avatarPath; }

    public String getCoverPath() { return coverPath; }
    public void setCoverPath(String coverPath) { this.coverPath = coverPath; }

    public int getFollowerCount() { return followerCount; }
    public void setFollowerCount(int followerCount) { this.followerCount = followerCount; }

    public int getFollowingCount() { return followingCount; }
    public void setFollowingCount(int followingCount) { this.followingCount = followingCount; }

    public int getContributionScore() { return contributionScore; }
    public void setContributionScore(int contributionScore) { this.contributionScore = contributionScore; }

    public int getLearningStreak() { return learningStreak; }
    public void setLearningStreak(int learningStreak) { this.learningStreak = learningStreak; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}
