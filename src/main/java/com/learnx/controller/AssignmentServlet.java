package com.learnx.controller;

import java.io.File;
import java.io.IOException;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import javax.servlet.http.Part;
import com.learnx.dao.AssignmentDAO;
import com.learnx.dao.ClassroomDAO;
import com.learnx.model.Assignment;
import com.learnx.model.Submission;
import com.learnx.model.User;

@WebServlet("/assignment")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 2, // 2MB
    maxFileSize = 1024 * 1024 * 30,      // 30MB
    maxRequestSize = 1024 * 1024 * 60    // 60MB
)
public class AssignmentServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private AssignmentDAO assignmentDAO;
    private ClassroomDAO classroomDAO;

    @Override
    public void init() throws ServletException {
        assignmentDAO = new AssignmentDAO();
        classroomDAO = new ClassroomDAO();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String idStr = request.getParameter("id");
        if (idStr == null) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        try {
            int assignmentId = Integer.parseInt(idStr);
            Assignment assignment = assignmentDAO.getAssignmentById(assignmentId);
            if (assignment == null) {
                response.sendRedirect(request.getContextPath() + "/dashboard?error=assignment_not_found");
                return;
            }

            HttpSession session = request.getSession(false);
            User user = (session != null) ? (User) session.getAttribute("user") : null;
            
            if (user == null) {
                response.sendRedirect(request.getContextPath() + "/views/login.jsp");
                return;
            }

            request.setAttribute("assignment", assignment);
            request.setAttribute("classroom", classroomDAO.getClassroomById(assignment.getClassroomId()));

            if ("Faculty".equals(user.getRole()) || "Administrator".equals(user.getRole()) || "Teaching Assistant".equals(user.getRole())) {
                // Faculty reviews list of submissions
                request.setAttribute("submissions", assignmentDAO.getSubmissionsForAssignment(assignmentId));
                request.getRequestDispatcher("/views/evaluator_dashboard.jsp").forward(request, response);
            } else {
                // Student views details and their own submission status
                Submission submission = assignmentDAO.getSubmissionForStudent(assignmentId, user.getId());
                request.setAttribute("submission", submission);
                request.getRequestDispatcher("/views/assignment_detail.jsp").forward(request, response);
            }
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
        String action = request.getParameter("action");

        if ("create".equalsIgnoreCase(action)) {
            handleCreateAssignment(request, response, user);
        } else if ("submit".equalsIgnoreCase(action)) {
            handleStudentSubmit(request, response, user);
        } else {
            response.sendRedirect(request.getContextPath() + "/dashboard");
        }
    }

    private void handleCreateAssignment(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole()) && !"Teaching Assistant".equals(user.getRole())) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
            return;
        }

        String classIdStr = request.getParameter("classroomId");
        String title = request.getParameter("title");
        String description = request.getParameter("description");
        String deadlineStr = request.getParameter("deadline");
        String maxMarksStr = request.getParameter("maxMarks");
        String answerKey = request.getParameter("answerKey");
        String rubric = request.getParameter("rubric");

        // Handle question sheet file upload (optional)
        String uploadPath = getServletContext().getRealPath("") + File.separator + "uploads" + File.separator + "assignments";
        File uploadDir = new File(uploadPath);
        if (!uploadDir.exists()) uploadDir.mkdirs();

        String fileWebPath = "";
        Part part = request.getPart("assignmentFile");
        if (part != null && part.getSize() > 0) {
            String fileName = getFileName(part);
            String savedFileName = System.currentTimeMillis() + "_" + fileName;
            part.write(uploadPath + File.separator + savedFileName);
            fileWebPath = "/uploads/assignments/" + savedFileName;
        }

        try {
            int classroomId = Integer.parseInt(classIdStr);
            int maxMarks = Integer.parseInt(maxMarksStr);
            
            // Parse datetime-local from browser: yyyy-MM-dd'T'HH:mm
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm");
            java.util.Date parsedDate = sdf.parse(deadlineStr);
            Timestamp deadline = new Timestamp(parsedDate.getTime());

            Assignment a = new Assignment();
            a.setClassroomId(classroomId);
            a.setTitle(title);
            a.setDescription(description);
            a.setFilePath(fileWebPath);
            a.setAnswerKey(answerKey);
            a.setRubric(rubric);
            a.setMaxMarks(maxMarks);
            a.setDeadline(deadline);
            a.setCreatorId(user.getId());

            if (assignmentDAO.createAssignment(a)) {
                response.sendRedirect(request.getContextPath() + "/classroom?id=" + classroomId + "&msg=assignment_created");
            } else {
                response.sendRedirect(request.getContextPath() + "/classroom?id=" + classroomId + "&error=assignment_failed");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect(request.getContextPath() + "/dashboard?error=invalid_input");
        }
    }

    private void handleStudentSubmit(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String assignmentIdStr = request.getParameter("assignmentId");

        // Handle answer sheet file upload
        String uploadPath = getServletContext().getRealPath("") + File.separator + "uploads" + File.separator + "assignments";
        File uploadDir = new File(uploadPath);
        if (!uploadDir.exists()) uploadDir.mkdirs();

        String fileWebPath = "";
        Part part = request.getPart("submissionFile");
        if (part == null || part.getSize() == 0) {
            response.sendRedirect(request.getContextPath() + "/assignment?id=" + assignmentIdStr + "&error=missing_file");
            return;
        }

        String fileName = getFileName(part);
        String savedFileName = System.currentTimeMillis() + "_" + fileName;
        String fullSavePath = uploadPath + File.separator + savedFileName;
        part.write(fullSavePath);
        fileWebPath = "/uploads/assignments/" + savedFileName;

        try {
            int assignmentId = Integer.parseInt(assignmentIdStr);
            Submission s = new Submission();
            s.setAssignmentId(assignmentId);
            s.setStudentId(user.getId());
            s.setFilePath(fileWebPath);

            if (assignmentDAO.submitAssignment(s)) {
                // Trigger the AI evaluation in the background!
                // We redirect first and start a background thread to call the AI evaluation to keep UI highly responsive.
                int submissionId = s.getId();
                String webappRoot = getServletContext().getRealPath("");
                
                new Thread(() -> {
                    try {
                        // Call the AI Evaluator service logic
                        com.learnx.controller.AIEvaluatorServlet.runBackgroundEvaluation(submissionId, fullSavePath, webappRoot);
                    } catch (Exception e) {
                        System.err.println("Background AI Evaluation failed for submission " + submissionId);
                        e.printStackTrace();
                    }
                }).start();

                response.sendRedirect(request.getContextPath() + "/assignment?id=" + assignmentId + "&msg=submitted");
            } else {
                response.sendRedirect(request.getContextPath() + "/assignment?id=" + assignmentId + "&error=submit_failed");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect(request.getContextPath() + "/dashboard");
        }
    }

    private String getFileName(Part part) {
        String contentDisp = part.getHeader("content-disposition");
        String[] tokens = contentDisp.split(";");
        for (String token : tokens) {
            if (token.trim().startsWith("filename")) {
                return token.substring(token.indexOf("=") + 2, token.length() - 1);
            }
        }
        return "";
    }
}
