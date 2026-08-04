package com.learnx.controller;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import javax.servlet.http.Part;
import com.learnx.dao.CommunityDAO;
import com.learnx.dao.UserDAO;
import com.learnx.model.Post;
import com.learnx.model.User;

@WebServlet("/community")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 5, // 5MB
    maxFileSize = 1024 * 1024 * 50,      // 50MB
    maxRequestSize = 1024 * 1024 * 100   // 100MB
)
public class CommunityServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private CommunityDAO communityDAO;
    private UserDAO userDAO;

    @Override
    public void init() throws ServletException {
        communityDAO = new CommunityDAO();
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

        String action = request.getParameter("action");
        String idStr = request.getParameter("id");

        if ("view".equalsIgnoreCase(action) && idStr != null) {
            // View a specific subject community
            try {
                int communityId = Integer.parseInt(idStr);
                
                // Find community in list
                List<Map<String, Object>> communities = communityDAO.getCommunities();
                Map<String, Object> currentComm = null;
                for (Map<String, Object> c : communities) {
                    if ((int)c.get("id") == communityId) {
                        currentComm = c;
                        break;
                    }
                }
                
                if (currentComm == null) {
                    response.sendRedirect(request.getContextPath() + "/community");
                    return;
                }

                List<Map<String, Object>> posts = communityDAO.getCommunityPosts(communityId);
                request.setAttribute("community", currentComm);
                request.setAttribute("posts", posts);
                request.getRequestDispatcher("/views/community.jsp").forward(request, response);
            } catch (NumberFormatException e) {
                response.sendRedirect(request.getContextPath() + "/community");
            }
        } else {
            // List all communities & global feed
            List<Map<String, Object>> communities = communityDAO.getCommunities();
            List<Post> feedPosts = communityDAO.getFeedPosts();
            
            request.setAttribute("communities", communities);
            request.setAttribute("feedPosts", feedPosts);
            request.getRequestDispatcher("/views/home_feed.jsp").forward(request, response);
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

        if ("create_post".equalsIgnoreCase(action)) {
            handleCreatePost(request, response, user);
        } else if ("like".equalsIgnoreCase(action)) {
            handleLikePost(request, response, user);
        } else if ("comment".equalsIgnoreCase(action)) {
            handleCommentPost(request, response, user);
        } else if ("join".equalsIgnoreCase(action)) {
            handleJoinCommunity(request, response, user);
        } else if ("create_community_post".equalsIgnoreCase(action)) {
            handleCreateCommunityPost(request, response, user);
        } else {
            response.sendRedirect(request.getContextPath() + "/community");
        }
    }

    private void handleCreatePost(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String title = request.getParameter("title");
        String content = request.getParameter("content");
        String type = request.getParameter("type"); // text, note, video, project, announcement

        // Handle optional post attachment file upload
        String uploadPath = com.learnx.util.DBConnection.getUploadDir() + File.separator + "materials";
        File uploadDir = new File(uploadPath);
        if (!uploadDir.exists()) uploadDir.mkdirs();

        String fileWebPath = null;
        try {
            Part part = request.getPart("postFile");
            if (part != null && part.getSize() > 0) {
                String fileName = getFileName(part);
                String savedFileName = System.currentTimeMillis() + "_" + fileName;
                part.write(uploadPath + File.separator + savedFileName);
                fileWebPath = "/uploads/materials/" + savedFileName;
            }
        } catch (Exception e) {
            // Multipart upload optional
        }

        Post p = new Post();
        p.setUserId(user.getId());
        p.setTitle(title);
        p.setContent(content);
        p.setType(type);
        p.setFilePath(fileWebPath);

        if (communityDAO.createPost(p)) {
            // Update contribution score
            userDAO.updateStreakAndScore(user.getId(), 10, 0);
            user.setContributionScore(user.getContributionScore() + 10);
            request.getSession().setAttribute("user", user);
            
            response.sendRedirect(request.getContextPath() + "/community?msg=post_created");
        } else {
            response.sendRedirect(request.getContextPath() + "/community?error=post_failed");
        }
    }

    private void handleLikePost(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String postIdStr = request.getParameter("postId");
        try {
            int postId = Integer.parseInt(postIdStr);
            if (communityDAO.toggleLikePost(postId, user.getId())) {
                response.getWriter().write("success");
            } else {
                response.getWriter().write("error");
            }
        } catch (Exception e) {
            response.getWriter().write("invalid");
        }
    }

    private void handleCommentPost(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String postIdStr = request.getParameter("postId");
        String content = request.getParameter("commentText");
        
        try {
            int postId = Integer.parseInt(postIdStr);
            if (communityDAO.addComment(postId, user.getId(), content, null)) {
                // Award points
                userDAO.updateStreakAndScore(user.getId(), 2, 0);
                response.sendRedirect(request.getContextPath() + "/community?msg=comment_added");
            } else {
                response.sendRedirect(request.getContextPath() + "/community?error=comment_failed");
            }
        } catch (Exception e) {
            response.sendRedirect(request.getContextPath() + "/community");
        }
    }

    private void handleJoinCommunity(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String commIdStr = request.getParameter("communityId");
        try {
            int commId = Integer.parseInt(commIdStr);
            if (communityDAO.joinCommunity(user.getId(), commId)) {
                response.sendRedirect(request.getContextPath() + "/community?action=view&id=" + commId + "&msg=joined");
            } else {
                response.sendRedirect(request.getContextPath() + "/community?error=join_failed");
            }
        } catch (Exception e) {
            response.sendRedirect(request.getContextPath() + "/community");
        }
    }

    private void handleCreateCommunityPost(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String commIdStr = request.getParameter("communityId");
        String title = request.getParameter("title");
        String content = request.getParameter("content");
        String type = request.getParameter("type"); // post, question, poll, project

        try {
            int commId = Integer.parseInt(commIdStr);
            if (communityDAO.createCommunityPost(commId, user.getId(), title, content, type)) {
                userDAO.updateStreakAndScore(user.getId(), 5, 0);
                response.sendRedirect(request.getContextPath() + "/community?action=view&id=" + commId + "&msg=post_created");
            } else {
                response.sendRedirect(request.getContextPath() + "/community?action=view&id=" + commId + "&error=post_failed");
            }
        } catch (Exception e) {
            response.sendRedirect(request.getContextPath() + "/community");
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
