package com.learnx.model;

import java.sql.Timestamp;
import java.util.List;

public class Quiz {
    private int id;
    private int classroomId;
    private String title;
    private String description;
    private int durationMinutes;
    private boolean shuffleQuestions;
    private boolean negativeMarking;
    private int maxMarks;
    private int creatorId;
    private String creatorName; // helper field
    private Timestamp createdAt;
    private List<QuizQuestion> questions; // helper field
    private boolean isPublic; // public test flag
    private String type; // QUIZ or EXAM

    public Quiz() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public boolean isPublic() { return isPublic; }
    public void setPublic(boolean isPublic) { this.isPublic = isPublic; }

    public int getClassroomId() { return classroomId; }
    public void setClassroomId(int classroomId) { this.classroomId = classroomId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public boolean isShuffleQuestions() { return shuffleQuestions; }
    public void setShuffleQuestions(boolean shuffleQuestions) { this.shuffleQuestions = shuffleQuestions; }

    public boolean isNegativeMarking() { return negativeMarking; }
    public void setNegativeMarking(boolean negativeMarking) { this.negativeMarking = negativeMarking; }

    public int getMaxMarks() { return maxMarks; }
    public void setMaxMarks(int maxMarks) { this.maxMarks = maxMarks; }

    public int getCreatorId() { return creatorId; }
    public void setCreatorId(int creatorId) { this.creatorId = creatorId; }

    public String getCreatorName() { return creatorName; }
    public void setCreatorName(String creatorName) { this.creatorName = creatorName; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public List<QuizQuestion> getQuestions() { return questions; }
    public void setQuestions(List<QuizQuestion> questions) { this.questions = questions; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}
