package com.learnx.model;

import java.sql.Timestamp;

public class Submission {
    private int id;
    private int assignmentId;
    private String assignmentTitle; // helper field
    private int studentId;
    private String studentName; // helper field
    private String filePath;
    private String ocrText;
    private Integer aiMarks;
    private Integer teacherMarks;
    private double confidenceScore;
    private String aiFeedback;
    private String strengths;
    private String weaknesses;
    private String missingConcepts;
    private String reviewStatus; // PENDING, APPROVED, REJECTED
    private Timestamp submittedAt;

    public Submission() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getAssignmentId() { return assignmentId; }
    public void setAssignmentId(int assignmentId) { this.assignmentId = assignmentId; }

    public String getAssignmentTitle() { return assignmentTitle; }
    public void setAssignmentTitle(String assignmentTitle) { this.assignmentTitle = assignmentTitle; }

    public int getStudentId() { return studentId; }
    public void setStudentId(int studentId) { this.studentId = studentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getOcrText() { return ocrText; }
    public void setOcrText(String ocrText) { this.ocrText = ocrText; }

    public Integer getAiMarks() { return aiMarks; }
    public void setAiMarks(Integer aiMarks) { this.aiMarks = aiMarks; }

    public Integer getTeacherMarks() { return teacherMarks; }
    public void setTeacherMarks(Integer teacherMarks) { this.teacherMarks = teacherMarks; }

    public double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(double confidenceScore) { this.confidenceScore = confidenceScore; }

    public String getAiFeedback() { return aiFeedback; }
    public void setAiFeedback(String aiFeedback) { this.aiFeedback = aiFeedback; }

    public String getStrengths() { return strengths; }
    public void setStrengths(String strengths) { this.strengths = strengths; }

    public String getWeaknesses() { return weaknesses; }
    public void setWeaknesses(String weaknesses) { this.weaknesses = weaknesses; }

    public String getMissingConcepts() { return missingConcepts; }
    public void setMissingConcepts(String missingConcepts) { this.missingConcepts = missingConcepts; }

    public String getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(String reviewStatus) { this.reviewStatus = reviewStatus; }

    public Timestamp getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Timestamp submittedAt) { this.submittedAt = submittedAt; }
}
