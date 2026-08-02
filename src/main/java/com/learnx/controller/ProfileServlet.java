package com.learnx.controller;

import java.io.IOException;
import java.util.List;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import com.learnx.dao.UserDAO;
import com.learnx.dao.ResourceDAO;
import com.learnx.model.Material;
import com.learnx.model.User;

@WebServlet(urlPatterns = {"/profile", "/@*"})
public class ProfileServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private UserDAO userDAO;
    private ResourceDAO resourceDAO;

    @Override
    public void init() throws ServletException {
        userDAO = new UserDAO();
        resourceDAO = new ResourceDAO();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        User sessionUser = (session != null) ? (User) session.getAttribute("user") : null;

        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        String path = uri.substring(contextPath.length());
        
        String username = null;
        if (path.startsWith("/@")) {
            username = path.substring(2); // Extract 'username' from '/@username'
        } else {
            username = request.getParameter("username");
        }

        if (username == null || username.trim().isEmpty()) {
            if (sessionUser != null) {
                username = sessionUser.getUsername();
            } else {
                response.sendRedirect(request.getContextPath() + "/views/login.jsp");
                return;
            }
        }

        User profileUser = userDAO.getUserByUsername(username);
        if (profileUser == null) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=user_not_found");
            return;
        }

        // Check if current user is following this profile
        boolean isFollowing = false;
        if (sessionUser != null && sessionUser.getId() != profileUser.getId()) {
            isFollowing = userDAO.isFollowing(sessionUser.getId(), profileUser.getId());
        }

        // Load academic assets uploaded by the user
        List<Material> uploadedResources = resourceDAO.searchMaterials("", "All", "All", "");
        // Filter by uploader
        uploadedResources.removeIf(m -> m.getUploaderId() != profileUser.getId());

        request.setAttribute("profileUser", profileUser);
        request.setAttribute("isFollowing", isFollowing);
        request.setAttribute("uploadedResources", uploadedResources);
        request.getRequestDispatcher("/views/profile.jsp").forward(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            System.out.println("[ProfileServlet] POST Unauthenticated access attempt");
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        User sessionUser = (User) session.getAttribute("user");
        String action = request.getParameter("action");
        String targetIdStr = request.getParameter("targetId");
        System.out.println("[ProfileServlet] POST request: action=" + action + ", targetId=" + targetIdStr + ", sessionUser=" + sessionUser.getUsername() + " (id=" + sessionUser.getId() + ")");

        if (targetIdStr != null) {
            try {
                int targetId = Integer.parseInt(targetIdStr);
                if ("follow".equalsIgnoreCase(action)) {
                    boolean success = userDAO.follow(sessionUser.getId(), targetId);
                    System.out.println("[ProfileServlet] follow success=" + success);
                    if (success) {
                        // Refresh session user following count
                        sessionUser.setFollowingCount(sessionUser.getFollowingCount() + 1);
                        session.setAttribute("user", sessionUser);
                        response.getWriter().write("followed");
                    } else {
                        response.getWriter().write("error");
                    }
                } else if ("unfollow".equalsIgnoreCase(action)) {
                    boolean success = userDAO.unfollow(sessionUser.getId(), targetId);
                    System.out.println("[ProfileServlet] unfollow success=" + success);
                    if (success) {
                        sessionUser.setFollowingCount(Math.max(0, sessionUser.getFollowingCount() - 1));
                        session.setAttribute("user", sessionUser);
                        response.getWriter().write("unfollowed");
                    } else {
                        response.getWriter().write("error");
                    }
                }
            } catch (NumberFormatException e) {
                System.out.println("[ProfileServlet] targetId number format exception: " + targetIdStr);
                response.getWriter().write("invalid");
            }
        }
    }
}
