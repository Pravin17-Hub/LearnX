package com.learnx.controller;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.learnx.dao.QuizDAO;
import com.learnx.dao.UserDAO;
import com.learnx.model.Quiz;
import com.learnx.model.QuizQuestion;
import com.learnx.model.User;

@WebServlet("/quiz")
public class QuizServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private QuizDAO quizDAO;
    private UserDAO userDAO;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        quizDAO = new QuizDAO();
        userDAO = new UserDAO();
        gson = new Gson();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        User user = (session != null) ? (User) session.getAttribute("user") : null;
        
        String action = request.getParameter("action");
        String idStr = request.getParameter("id");

        if ("delete".equalsIgnoreCase(action)) {
            if (user == null || (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole()))) {
                response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
                return;
            }
            if (idStr != null) {
                try {
                    int quizId = Integer.parseInt(idStr);
                    quizDAO.deleteQuiz(quizId);
                    String classId = request.getParameter("classroomId");
                    if (classId != null && !classId.isEmpty()) {
                        response.sendRedirect(request.getContextPath() + "/classroom?id=" + classId + "&msg=quiz_deleted");
                        return;
                    }
                } catch (NumberFormatException e) {
                    e.printStackTrace();
                }
            }
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        if ("attempt_result".equalsIgnoreCase(action)) {
            String attemptIdStr = request.getParameter("attemptId");
            if (attemptIdStr != null) {
                try {
                    int attemptId = Integer.parseInt(attemptIdStr);
                    Map<String, Object> attempt = quizDAO.getQuizAttemptById(attemptId);
                    if (attempt != null) {
                        request.setAttribute("attempt", attempt);
                        request.getRequestDispatcher("/views/quiz_result.jsp").forward(request, response);
                        return;
                    }
                } catch (NumberFormatException e) {
                    e.printStackTrace();
                }
            }
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        // Standard actions: view or play
        if (idStr != null) {
            try {
                int quizId = Integer.parseInt(idStr);
                Quiz quiz = quizDAO.getQuizById(quizId);
                if (quiz == null) {
                    response.sendRedirect(request.getContextPath() + "/dashboard");
                    return;
                }

                // If the test is not public, require authentication
                if (!quiz.isPublic() && user == null) {
                    response.sendRedirect(request.getContextPath() + "/views/login.jsp");
                    return;
                }

                if ("view".equalsIgnoreCase(action)) {
                    boolean attempted = false;
                    if (user != null) {
                        attempted = quizDAO.hasStudentAttemptedQuiz(quizId, user.getId());
                    }
                    List<Map<String, Object>> leaderboard = quizDAO.getQuizLeaderboard(quizId);

                    request.setAttribute("quiz", quiz);
                    request.setAttribute("attempted", attempted);
                    request.setAttribute("leaderboard", leaderboard);
                    request.getRequestDispatcher("/views/quiz.jsp").forward(request, response);
                } else if ("play".equalsIgnoreCase(action)) {
                    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                    response.setHeader("Pragma", "no-cache");
                    response.setDateHeader("Expires", 0);
                    // Restrict attempt count: One person can attempt a test only once.
                    if (user != null) {
                        if (quizDAO.hasStudentAttemptedQuiz(quizId, user.getId())) {
                            response.sendRedirect(request.getContextPath() + "/quiz?action=view&id=" + quizId + "&error=already_played");
                            return;
                        }
                    } else {
                        HttpSession httpSession = request.getSession(false);
                        if (httpSession != null) {
                            @SuppressWarnings("unchecked")
                            List<Integer> guestAttempts = (List<Integer>) httpSession.getAttribute("guestAttempts");
                            if (guestAttempts != null && guestAttempts.contains(quizId)) {
                                response.sendRedirect(request.getContextPath() + "/quiz?action=view&id=" + quizId + "&error=already_played");
                                return;
                            }
                        }
                    }

                    List<QuizQuestion> questions = quiz.getQuestions();
                    if (quiz.isShuffleQuestions()) {
                        Collections.shuffle(questions);
                    }

                    // Put quiz and questions in session
                    HttpSession httpSession = request.getSession(true);
                    httpSession.setAttribute("activeQuiz", quiz);
                    httpSession.setAttribute("quizQuestions", questions);
                    httpSession.setAttribute("quizStartTime", System.currentTimeMillis());

                    request.setAttribute("quiz", quiz);
                    request.setAttribute("questions", questions);
                    request.getRequestDispatcher("/views/quiz_play.jsp").forward(request, response);
                } else {
                    response.sendRedirect(request.getContextPath() + "/dashboard");
                }
            } catch (NumberFormatException e) {
                response.sendRedirect(request.getContextPath() + "/dashboard");
            }
        } else {
            // Fetch list of public tests
            List<Quiz> publicQuizzes = quizDAO.getPublicQuizzes();
            request.setAttribute("publicQuizzes", publicQuizzes);
            request.getRequestDispatcher("/views/public_tests.jsp").forward(request, response);
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        String action = request.getParameter("action");
        
        // If submitting a public quiz, allow guest submissions
        boolean isPublicSubmit = false;
        if (session != null && "submit".equalsIgnoreCase(action)) {
            Quiz activeQuiz = (Quiz) session.getAttribute("activeQuiz");
            if (activeQuiz != null && activeQuiz.isPublic()) {
                isPublicSubmit = true;
            }
        }

        if (session == null || (session.getAttribute("user") == null && !isPublicSubmit)) {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp");
            return;
        }

        User user = (session != null) ? (User) session.getAttribute("user") : null;

        if ("create".equalsIgnoreCase(action)) {
            handleCreateQuiz(request, response, user);
        } else if ("submit".equalsIgnoreCase(action)) {
            handleQuizSubmission(request, response, user);
        } else if ("edit".equalsIgnoreCase(action)) {
            handleEditQuiz(request, response, user);
        } else {
            response.sendRedirect(request.getContextPath() + "/dashboard");
        }
    }

    private void handleCreateQuiz(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole())) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
            return;
        }

        String classIdStr = request.getParameter("classroomId");
        String title = request.getParameter("title");
        String description = request.getParameter("description");
        String durationStr = request.getParameter("duration");
        String shuffleStr = request.getParameter("shuffle");
        String negativeStr = request.getParameter("negativeMarking");
        String isPublicStr = request.getParameter("isPublic");
        String type = request.getParameter("type");

        try {
            int classroomId = (classIdStr != null && !classIdStr.trim().isEmpty() && !"null".equals(classIdStr)) ? Integer.parseInt(classIdStr) : 0;
            int duration = Integer.parseInt(durationStr);
            boolean shuffle = "true".equals(shuffleStr);
            boolean negative = "true".equals(negativeStr);
            boolean isPublic = "true".equals(isPublicStr);

            Quiz q = new Quiz();
            q.setClassroomId(classroomId);
            q.setTitle(title);
            q.setDescription(description);
            q.setDurationMinutes(duration);
            q.setShuffleQuestions(shuffle);
            q.setNegativeMarking(negative);
            q.setPublic(isPublic);
            q.setType(type != null ? type : "QUIZ");

            // Collect questions from request
            String[] questionsText = request.getParameterValues("questions[]");
            String[] questionTypes = request.getParameterValues("types[]");
            String[] points = request.getParameterValues("points[]");
            String[] negativePoints = request.getParameterValues("negative_points[]");

            System.out.println("DEBUG: handleCreateQuiz - questionsText length: " + (questionsText != null ? questionsText.length : 0));
            if (questionsText != null) {
                for (int i = 0; i < questionsText.length; i++) {
                    String qType = (questionTypes != null && i < questionTypes.length) ? questionTypes[i] : "null";
                    System.out.println("  Q" + i + ": text='" + questionsText[i] + "', type='" + qType + "'");
                }
            }

            int totalMaxMarks = 0;
            List<QuizQuestion> qList = new ArrayList<>();

            if (questionsText != null) {
                for (int i = 0; i < questionsText.length; i++) {
                    QuizQuestion qq = new QuizQuestion();
                    qq.setQuestionText(questionsText[i]);
                    qq.setQuestionType(questionTypes[i].toUpperCase());
                    qq.setPoints(Integer.parseInt(points[i]));
                    qq.setNegativePoints(negative ? Integer.parseInt(negativePoints[i]) : 0);
                    totalMaxMarks += qq.getPoints();

                    // Parse Options & Answers for MCQ question
                    if ("MCQ".equalsIgnoreCase(questionTypes[i])) {
                        String[] options = request.getParameterValues("options_q" + i + "[]");
                        String[] answers = request.getParameterValues("answers_q" + i + "[]");
                        
                        if (options != null) {
                            qq.setOptionsJson(gson.toJson(options));
                        }
                        if (answers != null) {
                            List<Integer> ansList = new ArrayList<>();
                            for (String a : answers) {
                                ansList.add(Integer.parseInt(a));
                            }
                            qq.setCorrectAnswerJson(gson.toJson(ansList));
                        }
                    } else {
                        String theoryAns = request.getParameter("theory_answer_q" + i);
                        qq.setOptionsJson("[]");
                        if (theoryAns != null) {
                            qq.setCorrectAnswerJson(theoryAns.trim());
                        } else {
                            qq.setCorrectAnswerJson("");
                        }
                    }
                    qList.add(qq);
                }
            }

            q.setMaxMarks(totalMaxMarks > 0 ? totalMaxMarks : 50);
            q.setCreatorId(user.getId());

            if (quizDAO.createQuiz(q)) {
                for (QuizQuestion qq : qList) {
                    qq.setQuizId(q.getId());
                    quizDAO.addQuizQuestion(qq);
                }
                if (classroomId > 0) {
                    response.sendRedirect(request.getContextPath() + "/classroom?id=" + classroomId + "&msg=quiz_created");
                } else {
                    response.sendRedirect(request.getContextPath() + "/quiz?msg=quiz_created");
                }
            } else {
                if (classroomId > 0) {
                    response.sendRedirect(request.getContextPath() + "/classroom?id=" + classroomId + "&error=quiz_failed");
                } else {
                    response.sendRedirect(request.getContextPath() + "/quiz?error=quiz_failed");
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect(request.getContextPath() + "/dashboard?error=invalid_quiz");
        }
    }

    private void handleQuizSubmission(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        Quiz activeQuiz = (Quiz) session.getAttribute("activeQuiz");
        @SuppressWarnings("unchecked")
        List<QuizQuestion> questions = (List<QuizQuestion>) session.getAttribute("quizQuestions");
        Long startTime = (Long) session.getAttribute("quizStartTime");

        if (activeQuiz == null || questions == null) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        session.removeAttribute("activeQuiz");
        session.removeAttribute("quizQuestions");
        session.removeAttribute("quizStartTime");

        long timeElapsedSec = 0;
        if (startTime != null) {
            timeElapsedSec = (System.currentTimeMillis() - startTime) / 1000;
        }
        boolean autoSaved = timeElapsedSec > (activeQuiz.getDurationMinutes() * 60 + 30);

        int finalScore = 0;
        JsonObject answersMap = new JsonObject();
        JsonObject feedbackMap = new JsonObject();

        for (QuizQuestion q : questions) {
            String paramName = "answer_" + q.getId();
            String ans = request.getParameter(paramName);
            if (ans == null) ans = "";
            ans = ans.trim();

            answersMap.addProperty(String.valueOf(q.getId()), ans);

            JsonObject questionFeedback = new JsonObject();
            questionFeedback.addProperty("questionText", q.getQuestionText());
            questionFeedback.addProperty("questionType", q.getQuestionType());
            questionFeedback.addProperty("studentAnswer", ans);
            questionFeedback.addProperty("maxMarks", q.getPoints());

            if ("MCQ".equalsIgnoreCase(q.getQuestionType())) {
                if (!ans.isEmpty()) {
                    try {
                        int selected = Integer.parseInt(ans);
                        JsonArray corrects = gson.fromJson(q.getCorrectAnswerJson(), JsonArray.class);
                        int correctIdx = corrects.get(0).getAsInt();

                        if (selected == correctIdx) {
                            finalScore += q.getPoints();
                            questionFeedback.addProperty("score", q.getPoints());
                            questionFeedback.addProperty("feedback", "Correct answer! Maximum marks awarded.");
                            questionFeedback.addProperty("correct", true);
                        } else {
                            int penalty = activeQuiz.isNegativeMarking() ? q.getNegativePoints() : 0;
                            finalScore -= penalty;
                            questionFeedback.addProperty("score", -penalty);
                            questionFeedback.addProperty("feedback", "Incorrect answer. Correct option was index " + correctIdx + ".");
                            questionFeedback.addProperty("correct", false);
                        }
                    } catch (Exception ex) {
                        questionFeedback.addProperty("score", 0);
                        questionFeedback.addProperty("feedback", "Error grading answer index format.");
                    }
                } else {
                    questionFeedback.addProperty("score", 0);
                    questionFeedback.addProperty("feedback", "No answer selected.");
                }
            } else {
                // Theory or Analytical question: call AI Evaluator!
                if (!ans.isEmpty()) {
                    try {
                        String refAnswer = q.getCorrectAnswerJson();
                        if (refAnswer == null || refAnswer.trim().isEmpty() || "[]".equals(refAnswer)) {
                            refAnswer = "Coherent explanation matching general academic guidelines.";
                        }

                        JsonObject aiResponse = com.learnx.util.OpenAIClient.evaluateSubmission(
                            q.getQuestionText(),
                            refAnswer,
                            "Evaluate grammar, academic depth, step-by-step logic, and factual correctness.",
                            q.getPoints(),
                            ans
                        );

                        int pointsAwarded = aiResponse.get("score").getAsInt();
                        finalScore += pointsAwarded;

                        questionFeedback.add("ai_response", aiResponse);
                        questionFeedback.addProperty("score", pointsAwarded);
                        questionFeedback.addProperty("feedback", aiResponse.get("feedback").getAsString());
                    } catch (Exception ex) {
                        ex.printStackTrace();
                        int fallback = Math.max(1, q.getPoints() / 2);
                        finalScore += fallback;
                        questionFeedback.addProperty("score", fallback);
                        questionFeedback.addProperty("feedback", "Fallback: AI evaluation timed out. Awarded participation points.");
                    }
                } else {
                    questionFeedback.addProperty("score", 0);
                    questionFeedback.addProperty("feedback", "No answer submitted.");
                }
            }
            feedbackMap.add(String.valueOf(q.getId()), questionFeedback);
        }

        if (finalScore < 0) finalScore = 0;

        String guestName = request.getParameter("guestName");
        Integer studentId = (user != null) ? user.getId() : null;

        int attemptId = quizDAO.submitExtendedQuizAttempt(
            activeQuiz.getId(),
            studentId,
            guestName,
            finalScore,
            activeQuiz.getMaxMarks(),
            gson.toJson(answersMap),
            gson.toJson(feedbackMap),
            autoSaved
        );

        if (user != null) {
            userDAO.updateStreakAndScore(user.getId(), finalScore + 5, 0);
            user.setContributionScore(user.getContributionScore() + finalScore + 5);
            session.setAttribute("user", user);
        } else {
            // Track guest attempt to restrict re-taking public test
            @SuppressWarnings("unchecked")
            List<Integer> guestAttempts = (List<Integer>) session.getAttribute("guestAttempts");
            if (guestAttempts == null) {
                guestAttempts = new ArrayList<>();
            }
            guestAttempts.add(activeQuiz.getId());
            session.setAttribute("guestAttempts", guestAttempts);
        }

        if (attemptId > 0) {
            response.sendRedirect(request.getContextPath() + "/quiz?action=attempt_result&attemptId=" + attemptId);
        } else {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=quiz_submission_failed");
        }
    }

    private void handleEditQuiz(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole())) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
            return;
        }

        String idStr = request.getParameter("id");
        if (idStr == null || idStr.isEmpty()) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        try {
            int quizId = Integer.parseInt(idStr);
            Quiz q = quizDAO.getQuizById(quizId);
            if (q == null) {
                response.sendRedirect(request.getContextPath() + "/dashboard");
                return;
            }

            if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole()) && user.getId() != q.getCreatorId()) {
                response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
                return;
            }

            String title = request.getParameter("title");
            String description = request.getParameter("description");
            int duration = Integer.parseInt(request.getParameter("duration"));
            int maxMarks = Integer.parseInt(request.getParameter("maxMarks"));
            boolean shuffle = "true".equals(request.getParameter("shuffle"));
            boolean negative = "true".equals(request.getParameter("negativeMarking"));

            q.setTitle(title);
            q.setDescription(description);
            q.setDurationMinutes(duration);
            q.setMaxMarks(maxMarks);
            q.setShuffleQuestions(shuffle);
            q.setNegativeMarking(negative);

            if (quizDAO.updateQuiz(q)) {
                response.sendRedirect(request.getContextPath() + "/quiz?action=view&id=" + quizId + "&msg=quiz_updated");
            } else {
                response.sendRedirect(request.getContextPath() + "/quiz?action=view&id=" + quizId + "&error=quiz_update_failed");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect(request.getContextPath() + "/dashboard?error=invalid_edit");
        }
    }
}
