package com.learnx.controller;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import com.learnx.dao.ClassroomDAO;
import com.learnx.dao.AssignmentDAO;
import com.learnx.dao.ResourceDAO;
import com.learnx.dao.QuizDAO;
import com.learnx.model.Classroom;
import com.learnx.model.User;
import com.learnx.model.Assignment;
import com.learnx.model.Material;
import com.learnx.model.Quiz;

@WebServlet("/classroom")
public class ClassroomServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private ClassroomDAO classroomDAO;
    private AssignmentDAO assignmentDAO;
    private ResourceDAO resourceDAO;
    private QuizDAO quizDAO;

    @Override
    public void init() throws ServletException {
        classroomDAO = new ClassroomDAO();
        assignmentDAO = new AssignmentDAO();
        resourceDAO = new ResourceDAO();
        quizDAO = new QuizDAO();
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
            int classroomId = Integer.parseInt(idStr);
            Classroom classroom = classroomDAO.getClassroomById(classroomId);
            if (classroom == null) {
                response.sendRedirect(request.getContextPath() + "/dashboard?error=class_not_found");
                return;
            }

            // Load resources, assignments, members, attendance, and quizzes
            List<Assignment> assignments = assignmentDAO.getAssignmentsForClassroom(classroomId);
            List<Material> materials = resourceDAO.getMaterialsForClassroom(classroomId);
            List<User> members = classroomDAO.getMembersInClassroom(classroomId);
            List<Quiz> quizzes = quizDAO.getQuizzesForClassroom(classroomId);

            request.setAttribute("classroom", classroom);
            request.setAttribute("assignments", assignments);
            request.setAttribute("materials", materials);
            request.setAttribute("members", members);
            request.setAttribute("quizzes", quizzes);

            request.getRequestDispatcher("/views/classroom.jsp").forward(request, response);
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
            handleCreateClassroom(request, response, user);
        } else if ("join".equalsIgnoreCase(action)) {
            handleJoinClassroom(request, response, user);
        } else if ("attendance".equalsIgnoreCase(action)) {
            handleMarkAttendance(request, response, user);
        } else {
            response.sendRedirect(request.getContextPath() + "/dashboard");
        }
    }

    private void handleCreateClassroom(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole())) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
            return;
        }

        String name = request.getParameter("className");
        String description = request.getParameter("description");
        String subject = request.getParameter("subject");
        
        // Generate short unique join code
        String joinCode = UUID.randomUUID().toString().substring(0, 7).toUpperCase();
        
        // Generate QR code URL (using google charts API or similar open API)
        String qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + joinCode;

        Classroom c = new Classroom();
        c.setClassName(name);
        c.setDescription(description);
        c.setSubject(subject);
        c.setJoinCode(joinCode);
        c.setQrCodePath(qrCodeUrl);
        c.setCreatorId(user.getId());

        if (classroomDAO.createClassroom(c)) {
            response.sendRedirect(request.getContextPath() + "/classroom?id=" + c.getId());
        } else {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=create_failed");
        }
    }

    private void handleJoinClassroom(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String joinCode = request.getParameter("joinCode").trim().toUpperCase();
        
        Classroom target = classroomDAO.getClassroomByJoinCode(joinCode);
        if (target == null) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=invalid_code");
            return;
        }

        if (classroomDAO.joinClassroom(user.getId(), joinCode)) {
            response.sendRedirect(request.getContextPath() + "/classroom?id=" + target.getId());
        } else {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=join_failed");
        }
    }

    private void handleMarkAttendance(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String classIdStr = request.getParameter("classroomId");
        String status = request.getParameter("status"); // PRESENT, ABSENT, LATE
        String method = request.getParameter("method"); // MANUAL, QR, LOCATION
        
        String latStr = request.getParameter("latitude");
        String lngStr = request.getParameter("longitude");

        try {
            int classroomId = Integer.parseInt(classIdStr);
            Double lat = (latStr != null && !latStr.isEmpty()) ? Double.parseDouble(latStr) : null;
            Double lng = (lngStr != null && !lngStr.isEmpty()) ? Double.parseDouble(lngStr) : null;

            if (classroomDAO.markAttendance(classroomId, user.getId(), status, method, lat, lng)) {
                response.sendRedirect(request.getContextPath() + "/classroom?id=" + classroomId + "&msg=attendance_marked");
            } else {
                response.sendRedirect(request.getContextPath() + "/classroom?id=" + classroomId + "&error=attendance_failed");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect(request.getContextPath() + "/dashboard");
        }
    }
}
