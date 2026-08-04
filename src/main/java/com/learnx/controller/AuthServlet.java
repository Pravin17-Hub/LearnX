package com.learnx.controller;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.http.Part;
import com.learnx.dao.UserDAO;
import com.learnx.model.User;

@WebServlet("/auth")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 2, // 2MB
    maxFileSize = 1024 * 1024 * 10,      // 10MB
    maxRequestSize = 1024 * 1024 * 20    // 20MB
)
public class AuthServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private UserDAO userDAO;

    @Override
    public void init() throws ServletException {
        userDAO = new UserDAO();
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String action = request.getParameter("action");

        if ("login".equalsIgnoreCase(action)) {
            handleLogin(request, response);
        } else if ("register".equalsIgnoreCase(action)) {
            handleRegister(request, response);
        } else if ("forgot".equalsIgnoreCase(action)) {
            handleForgotPassword(request, response);
        } else if ("update_profile".equalsIgnoreCase(action)) {
            handleUpdateProfile(request, response);
        } else if ("mark_notifications_read".equalsIgnoreCase(action)) {
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("user") != null) {
                User u = (User) session.getAttribute("user");
                new com.learnx.dao.NotificationDAO().markAllAsRead(u.getId());
            }
        } else {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp");
        }
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String action = request.getParameter("action");
        
        if ("logout".equalsIgnoreCase(action)) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            response.sendRedirect(request.getContextPath() + "/views/login.jsp?msg=logged_out");
        } else {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp");
        }
    }

    private void handleLogin(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String identifier = request.getParameter("identifier"); // username or email
        String password = request.getParameter("password");
        
        User user = userDAO.authenticate(identifier, password);
        if (user != null) {
            HttpSession session = request.getSession(true);
            session.setAttribute("user", user);
            
            // Set session timeout to 30 minutes
            session.setMaxInactiveInterval(30 * 60); 
            
            // Increment learning streak on successful daily login
            userDAO.updateStreakAndScore(user.getId(), 5, 1);
            user.setLearningStreak(user.getLearningStreak() + 1);
            user.setContributionScore(user.getContributionScore() + 5);
            session.setAttribute("user", user);

            response.sendRedirect(request.getContextPath() + "/dashboard");
        } else {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp?error=invalid_credentials");
        }
    }

    private void handleRegister(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String name = request.getParameter("name");
        if (name != null) name = name.trim();
        String regNo = request.getParameter("regNo");
        if (regNo != null) regNo = regNo.trim();
        String username = request.getParameter("username").trim().toLowerCase();
        String email = request.getParameter("email").trim().toLowerCase();
        String password = request.getParameter("password");
        String role = request.getParameter("role");
        String institution = request.getParameter("institution");
        String department = request.getParameter("department");
        String bio = request.getParameter("bio");

        // Email validation
        if (email == null || !email.matches("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$")) {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp?error=invalid_email");
            return;
        }

        User u = new User();
        u.setName(name);
        u.setRegNo(regNo);
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(password); // will be hashed in DAO
        u.setRole(role);
        u.setInstitution(institution);
        u.setDepartment(department);
        u.setBio(bio);

        // Upload Profile Picture
        String avatarPath = "/assets/images/default-avatar.png";
        try {
            Part part = request.getPart("avatar_file");
            if (part != null && part.getSize() > 0) {
                String uploadPath = com.learnx.util.DBConnection.getUploadDir() + java.io.File.separator + "avatars";
                java.io.File uploadDir = new java.io.File(uploadPath);
                if (!uploadDir.exists()) uploadDir.mkdirs();
                
                String contentDisp = part.getHeader("content-disposition");
                String fileName = "";
                for (String content : contentDisp.split(";")) {
                    if (content.trim().startsWith("filename")) {
                        fileName = content.substring(content.indexOf("=") + 1).trim().replace("\"", "");
                    }
                }
                if (!fileName.isEmpty()) {
                    String savedFileName = System.currentTimeMillis() + "_" + fileName;
                    part.write(uploadPath + java.io.File.separator + savedFileName);
                    avatarPath = request.getContextPath() + "/uploads/avatars/" + savedFileName;
                }
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        u.setAvatarPath(avatarPath);

        if (userDAO.getUserByUsername(username) != null) {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp?error=username_taken");
            return;
        }

        if (userDAO.register(u)) {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp?success=registered");
        } else {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp?error=registration_failed");
        }
    }

    private void handleForgotPassword(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String email = request.getParameter("email");
        // Simple mock of Forgot Password / OTP Verification for demonstration
        response.sendRedirect(request.getContextPath() + "/views/login.jsp?success=otp_sent&email=" + email);
    }

    private void handleUpdateProfile(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            response.sendRedirect(request.getContextPath() + "/views/login.jsp");
            return;
        }

        User sessionUser = (User) session.getAttribute("user");
        String bio = request.getParameter("bio");
        String institution = request.getParameter("institution");
        String department = request.getParameter("department");
        String skills = request.getParameter("skills");
        String subjects = request.getParameter("subjects");

        // Handle profile image upload
        Part part = null;
        try {
            part = request.getPart("avatar_file");
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        
        if (part != null && part.getSize() > 0) {
            String uploadPath = com.learnx.util.DBConnection.getUploadDir() + java.io.File.separator + "avatars";
            java.io.File uploadDir = new java.io.File(uploadPath);
            if (!uploadDir.exists()) uploadDir.mkdirs();
            
            String contentDisp = part.getHeader("content-disposition");
            String fileName = "";
            for (String content : contentDisp.split(";")) {
                if (content.trim().startsWith("filename")) {
                    fileName = content.substring(content.indexOf("=") + 1).trim().replace("\"", "");
                }
            }
            if (!fileName.isEmpty()) {
                String savedFileName = System.currentTimeMillis() + "_" + fileName;
                part.write(uploadPath + java.io.File.separator + savedFileName);
                String fileWebPath = request.getContextPath() + "/uploads/avatars/" + savedFileName;
                sessionUser.setAvatarPath(fileWebPath);
            }
        }

        sessionUser.setBio(bio);
        sessionUser.setInstitution(institution);
        sessionUser.setDepartment(department);
        sessionUser.setSkills(skills);
        sessionUser.setSubjects(subjects);

        if (userDAO.updateProfile(sessionUser)) {
            session.setAttribute("user", sessionUser);
            response.sendRedirect(request.getContextPath() + "/@" + sessionUser.getUsername() + "?success=profile_updated");
        } else {
            response.sendRedirect(request.getContextPath() + "/@" + sessionUser.getUsername() + "?error=profile_failed");
        }
    }
}
