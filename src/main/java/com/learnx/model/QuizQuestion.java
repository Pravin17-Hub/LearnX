package com.learnx.model;

public class QuizQuestion {
    private int id;
    private int quizId;
    private String questionText;
    private String questionType; // MCQ, TRUE_FALSE, MULTIPLE_ANSWER, ESSAY, CODING
    private String optionsJson; // JSON representation of choices
    private String correctAnswerJson; // JSON representation of correct answer keys
    private int points;
    private int negativePoints;

    public QuizQuestion() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getQuizId() { return quizId; }
    public void setQuizId(int quizId) { this.quizId = quizId; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public String getQuestionType() { return questionType; }
    public void setQuestionType(String questionType) { this.questionType = questionType; }

    public String getOptionsJson() { return optionsJson; }
    public void setOptionsJson(String optionsJson) { this.optionsJson = optionsJson; }

    public String getCorrectAnswerJson() { return correctAnswerJson; }
    public void setCorrectAnswerJson(String correctAnswerJson) { this.correctAnswerJson = correctAnswerJson; }

    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }

    public int getNegativePoints() { return negativePoints; }
    public void setNegativePoints(int negativePoints) { this.negativePoints = negativePoints; }
}
