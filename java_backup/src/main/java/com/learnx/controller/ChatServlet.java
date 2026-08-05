package com.learnx.controller;

import java.io.IOException;
import java.io.File;
import java.util.List;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import javax.servlet.http.Part;
import com.google.gson.Gson;
import com.learnx.dao.MessageDAO;
import com.learnx.dao.UserDAO;
import com.learnx.model.Message;
import com.learnx.model.User;

@WebServlet("/chat")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 2, // 2MB
    maxFileSize = 1024 * 1024 * 10,      // 10MB
    maxRequestSize = 1024 * 1024 * 50    // 50MB
)
public class ChatServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private MessageDAO messageDAO;
    private UserDAO userDAO;
    private Gson gson;

    @Override
    public void init() throws ServletException {
        messageDAO = new MessageDAO();
        userDAO = new UserDAO();
        gson = new Gson();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        User user = (User) session.getAttribute("user");
        String action = request.getParameter("action");

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        if ("history".equalsIgnoreCase(action)) {
            String partnerIdStr = request.getParameter("partnerId");
            if (partnerIdStr != null) {
                try {
                    int partnerId = Integer.parseInt(partnerIdStr);
                    List<Message> history = messageDAO.getChatHistory(user.getId(), partnerId);
                    response.getWriter().write(gson.toJson(history));
                } catch (NumberFormatException e) {
                    response.sendError(HttpServletResponse.SC_BAD_REQUEST);
                }
            } else {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST);
            }
        } else if ("recent".equalsIgnoreCase(action)) {
            List<Message> recents = messageDAO.getRecentChats(user.getId());
            response.getWriter().write(gson.toJson(recents));
        } else if ("unread".equalsIgnoreCase(action)) {
            java.util.Map<Integer, Integer> unreadCounts = messageDAO.getUnreadCounts(user.getId());
            response.getWriter().write(gson.toJson(unreadCounts));
        } else {
            // Render HTML view for chat page
            request.setAttribute("recentChats", messageDAO.getRecentChats(user.getId()));
            request.setAttribute("leaderboard", userDAO.getLeaderboard()); // load contacts from leaderboard
            request.setAttribute("contactList", userDAO.getAllUsers());
            request.getRequestDispatcher("/views/chat.jsp").forward(request, response);
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        User user = (User) session.getAttribute("user");
        String receiverIdStr = request.getParameter("receiverId");
        String content = request.getParameter("content");
        String filePath = null;

        // Check for multipart file upload
        try {
            String contentType = request.getContentType();
            if (contentType != null && contentType.toLowerCase().contains("multipart/form-data")) {
                Part filePart = request.getPart("file");
                if (filePart != null && filePart.getSize() > 0) {
                    String submittedFileName = filePart.getSubmittedFileName();
                    if (submittedFileName != null && !submittedFileName.isEmpty()) {
                        String uploadPath = com.learnx.util.DBConnection.getUploadDir() + File.separator + "chat";
                        File uploadDir = new File(uploadPath);
                        if (!uploadDir.exists()) uploadDir.mkdirs();

                        String uniqueName = System.currentTimeMillis() + "_" + submittedFileName;
                        filePart.write(uploadPath + File.separator + uniqueName);
                        filePath = request.getContextPath() + "/uploads/chat/" + uniqueName;

                        if (content == null || content.trim().isEmpty()) {
                            String lowerName = submittedFileName.toLowerCase();
                            if (lowerName.endsWith(".webm") || lowerName.endsWith(".wav") || lowerName.endsWith(".mp3") || lowerName.endsWith(".ogg") || lowerName.endsWith(".m4a")) {
                                content = "🎤 Voice Message";
                            } else {
                                content = "📄 Shared Attachment: " + submittedFileName;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("File upload failed in ChatServlet: " + e.getMessage());
            e.printStackTrace();
        }

        if (filePath == null) {
            filePath = request.getParameter("filePath");
        }

        try {
            int receiverId = Integer.parseInt(receiverIdStr);
            Message msg = new Message();
            msg.setSenderId(user.getId());
            msg.setReceiverId(receiverId);
            msg.setContent(content);
            msg.setFilePath(filePath);

            response.setContentType("application/json");
            if (messageDAO.sendMessage(msg)) {
                com.learnx.websocket.ChatWebSocket.notifyNewMessage(msg);
                response.getWriter().write(gson.toJson(msg));
            } else {
                response.getWriter().write("{\"error\":\"Failed to send message\"}");
            }
        } catch (NumberFormatException e) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST);
        }
    }
}
