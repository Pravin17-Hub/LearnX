package com.learnx.model;

import java.sql.Timestamp;

public class Assignment {
    private int id;
    private int classroomId;
    private String title;
    private String description;
    private String filePath;
    private String answerKey;
    private String rubric;
    private int maxMarks;
    private Timestamp deadline;
    private int creatorId;
    private String creatorName; // helper field
    private Timestamp createdAt;

    public Assignment() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getClassroomId() { return classroomId; }
    public void setClassroomId(int classroomId) { this.classroomId = classroomId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getAnswerKey() { return answerKey; }
    public void setAnswerKey(String answerKey) { this.answerKey = answerKey; }

    public String getRubric() { return rubric; }
    public void setRubric(String rubric) { this.rubric = rubric; }

    public int getMaxMarks() { return maxMarks; }
    public void setMaxMarks(int maxMarks) { this.maxMarks = maxMarks; }

    public Timestamp getDeadline() { return deadline; }
    public void setDeadline(Timestamp deadline) { this.deadline = deadline; }

    public int getCreatorId() { return creatorId; }
    public void setCreatorId(int creatorId) { this.creatorId = creatorId; }

    public String getCreatorName() { return creatorName; }
    public void setCreatorName(String creatorName) { this.creatorName = creatorName; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
