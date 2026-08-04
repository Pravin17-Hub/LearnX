package com.learnx.controller;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import com.google.gson.JsonObject;
import com.learnx.dao.AssignmentDAO;
import com.learnx.dao.UserDAO;
import com.learnx.model.Assignment;
import com.learnx.model.Submission;
import com.learnx.model.User;
import com.learnx.util.OpenAIClient;
import com.learnx.util.PythonBridge;

@WebServlet("/evaluator")
public class AIEvaluatorServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private AssignmentDAO assignmentDAO;
    private UserDAO userDAO;

    @Override
    public void init() throws ServletException {
        assignmentDAO = new AssignmentDAO();
        userDAO = new UserDAO();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp");
            return;
        }

        User user = (User) session.getAttribute("user");
        if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole()) && !"Teaching Assistant".equals(user.getRole())) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
            return;
        }

        String submissionIdStr = request.getParameter("submissionId");
        if (submissionIdStr == null) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        try {
            int submissionId = Integer.parseInt(submissionIdStr);
            Submission submission = assignmentDAO.getSubmissionById(submissionId);
            if (submission == null) {
                response.sendRedirect(request.getContextPath() + "/dashboard?error=submission_not_found");
                return;
            }

            Assignment assignment = assignmentDAO.getAssignmentById(submission.getAssignmentId());
            request.setAttribute("submission", submission);
            request.setAttribute("assignment", assignment);
            
            request.getRequestDispatcher("/views/evaluator_dashboard.jsp").forward(request, response);
        } catch (NumberFormatException e) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp");
            return;
        }

        User user = (User) session.getAttribute("user");
        if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole()) && !"Teaching Assistant".equals(user.getRole())) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
            return;
        }

        String action = request.getParameter("action");
        String submissionIdStr = request.getParameter("submissionId");

        try {
            int submissionId = Integer.parseInt(submissionIdStr);
            Submission sub = assignmentDAO.getSubmissionById(submissionId);
            if (sub == null) {
                response.sendRedirect(request.getContextPath() + "/dashboard?error=not_found");
                return;
            }

            if ("approve".equalsIgnoreCase(action)) {
                // Teacher approves the AI suggested marks
                int teacherMarks = sub.getAiMarks() != null ? sub.getAiMarks() : 0;
                String finalMarksStr = request.getParameter("teacherMarks");
                if (finalMarksStr != null && !finalMarksStr.trim().isEmpty()) {
                    teacherMarks = Integer.parseInt(finalMarksStr.trim());
                }
                
                if (assignmentDAO.publishTeacherMarks(submissionId, teacherMarks, "APPROVED")) {
                    // Update student contribution score for completion
                    userDAO.updateStreakAndScore(sub.getStudentId(), 20, 0);
                    response.sendRedirect(request.getContextPath() + "/assignment?id=" + sub.getAssignmentId() + "&msg=graded");
                } else {
                    response.sendRedirect(request.getContextPath() + "/evaluator?submissionId=" + submissionId + "&error=failed");
                }
            } else if ("reevaluate".equalsIgnoreCase(action)) {
                // Trigger background evaluation thread
                String webappRoot = getServletContext().getRealPath("");
                String subPath = sub.getFilePath();
                if (subPath.startsWith("/uploads")) {
                    subPath = subPath.substring(8);
                } else if (subPath.startsWith("uploads")) {
                    subPath = subPath.substring(7);
                }
                if (!subPath.startsWith("/") && !subPath.startsWith("\\")) {
                    subPath = File.separator + subPath;
                }
                String fullFilePath = com.learnx.util.DBConnection.getUploadDir() + subPath.replace("/", File.separator);
                
                com.learnx.util.BackgroundTaskManager.runAsync(() -> {
                    try {
                        runBackgroundEvaluation(submissionId, fullFilePath, webappRoot);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });

                response.sendRedirect(request.getContextPath() + "/assignment?id=" + sub.getAssignmentId() + "&msg=reevaluating");
            } else {
                response.sendRedirect(request.getContextPath() + "/dashboard");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect(request.getContextPath() + "/dashboard?error=invalid");
        }
    }

    public static void runBackgroundEvaluation(int submissionId, String fullFilePath, String webappRoot) {
        AssignmentDAO aDAO = new AssignmentDAO();
        try {
            Submission sub = aDAO.getSubmissionById(submissionId);
            if (sub == null) return;

            Assignment assign = aDAO.getAssignmentById(sub.getAssignmentId());
            if (assign == null) return;

            String fileType = "";
            int idx = fullFilePath.lastIndexOf('.');
            if (idx > 0) {
                fileType = fullFilePath.substring(idx + 1).toLowerCase();
            }

            String extractedText = "";
            
            // 1. Text extraction phase
            if (fileType.equals("jpg") || fileType.equals("jpeg") || fileType.equals("png")) {
                // Image - run Multimodal OCR using OpenAI Chat API directly
                byte[] imageBytes = Files.readAllBytes(Paths.get(fullFilePath));
                extractedText = OpenAIClient.performImageOCR(imageBytes, fileType);
            } else {
                // PDF or DOCX - execute local Python subprocess parser
                extractedText = PythonBridge.extractText(fullFilePath, webappRoot);
                
                if (extractedText != null && extractedText.contains("[MULTIMODAL_IMAGE_OCR]")) {
                    // Python detected a image/scanned document, fallback to multimodal OCR
                    byte[] imageBytes = Files.readAllBytes(Paths.get(fullFilePath));
                    extractedText = OpenAIClient.performImageOCR(imageBytes, fileType);
                }
            }

            if (extractedText == null || extractedText.trim().isEmpty() || extractedText.startsWith("ERROR")) {
                aDAO.updateAISubmissionDraft(
                    submissionId, 
                    0, 
                    0.0, 
                    extractedText != null ? extractedText : "Empty text", 
                    "AI Grading failed: Document text extraction returned an error.", 
                    "N/A", 
                    "System could not extract text from document.", 
                    "N/A"
                );
                return;
            }

            // 2. OpenAI GPT Rubric grading phase
            JsonObject gptGrade = OpenAIClient.evaluateSubmission(
                assign.getTitle() + "\n" + assign.getDescription(),
                assign.getAnswerKey(),
                assign.getRubric(),
                assign.getMaxMarks(),
                extractedText
            );

            int score = gptGrade.get("score").getAsInt();
            double confidence = gptGrade.get("confidence").getAsDouble();
            String feedback = gptGrade.get("feedback").getAsString();
            String strengths = gptGrade.get("strengths").getAsString();
            String weaknesses = gptGrade.get("weaknesses").getAsString();
            String missing = gptGrade.get("missing_concepts").getAsString();

            // 3. Save drafts
            aDAO.updateAISubmissionDraft(submissionId, score, confidence, extractedText, feedback, strengths, weaknesses, missing);

        } catch (Exception e) {
            e.printStackTrace();
            aDAO.updateAISubmissionDraft(
                submissionId, 
                0, 
                0.0, 
                "Error occurred during background processing", 
                "AI Grading failed: " + e.getMessage(), 
                "N/A", 
                "An unexpected exception was encountered.", 
                "N/A"
            );
        }
    }
}
