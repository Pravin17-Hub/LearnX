package com.learnx.controller;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import javax.servlet.http.Part;
import com.learnx.dao.ResourceDAO;
import com.learnx.model.Material;
import com.learnx.model.User;

@WebServlet("/resources")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 5, // 5MB
    maxFileSize = 1024 * 1024 * 100,     // 100MB
    maxRequestSize = 1024 * 1024 * 150   // 150MB
)
public class ResourceServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private ResourceDAO resourceDAO;

    @Override
    public void init() throws ServletException {
        resourceDAO = new ResourceDAO();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String action = request.getParameter("action");

        if ("download".equalsIgnoreCase(action)) {
            handleDownload(request, response);
        } else if ("search".equalsIgnoreCase(action)) {
            handleSearch(request, response);
        } else {
            // Default: List global files
            List<Material> materials = resourceDAO.getGlobalResources();
            request.setAttribute("materials", materials);
            request.getRequestDispatcher("/views/resource_center.jsp").forward(request, response);
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

        if ("upload".equalsIgnoreCase(action)) {
            handleUpload(request, response, user);
        } else {
            response.sendRedirect(request.getContextPath() + "/resources");
        }
    }

    private void handleUpload(HttpServletRequest request, HttpServletResponse response, User user)
            throws ServletException, IOException {
        String title = request.getParameter("title");
        String description = request.getParameter("description");
        String category = request.getParameter("category"); // Notes, Video, Syllabus, Project
        String topic = request.getParameter("topic");
        String difficulty = request.getParameter("difficulty");
        String classIdStr = request.getParameter("classroomId");

        // Handle multipart upload
        String uploadPath = getServletContext().getRealPath("") + File.separator + "uploads" + File.separator + "materials";
        File uploadDir = new File(uploadPath);
        if (!uploadDir.exists()) uploadDir.mkdirs();

        Part part = request.getPart("resourceFile");
        if (part == null || part.getSize() == 0) {
            response.sendRedirect(request.getContextPath() + "/resources?error=missing_file");
            return;
        }

        String fileName = getFileName(part);
        String savedFileName = System.currentTimeMillis() + "_" + fileName;
        part.write(uploadPath + File.separator + savedFileName);
        String fileWebPath = "/uploads/materials/" + savedFileName;

        // Get extension as fileType
        String fileType = "bin";
        int idx = fileName.lastIndexOf('.');
        if (idx > 0) fileType = fileName.substring(idx + 1).toLowerCase();

        Material m = new Material();
        m.setTitle(title);
        m.setDescription(description);
        m.setCategory(category);
        m.setTopic(topic);
        m.setDifficulty(difficulty);
        m.setFilePath(fileWebPath);
        m.setFileType(fileType);
        m.setUploaderId(user.getId());

        if (classIdStr != null && !classIdStr.trim().isEmpty()) {
            try {
                m.setClassroomId(Integer.parseInt(classIdStr.trim()));
            } catch (NumberFormatException e) {
                // Ignore, keep global
            }
        }

        if (resourceDAO.uploadMaterial(m)) {
            // Redirect back depending on where they came from
            if (m.getClassroomId() != null) {
                response.sendRedirect(request.getContextPath() + "/classroom?id=" + m.getClassroomId() + "&msg=resource_uploaded");
            } else {
                response.sendRedirect(request.getContextPath() + "/resources?msg=resource_uploaded");
            }
        } else {
            response.sendRedirect(request.getContextPath() + "/resources?error=upload_failed");
        }
    }

    private void handleDownload(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String idStr = request.getParameter("id");
        if (idStr == null) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing resource ID");
            return;
        }

        try {
            int materialId = Integer.parseInt(idStr);
            Material material = resourceDAO.getMaterialById(materialId);
            if (material == null) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND, "Resource not found");
                return;
            }

            // Update stats
            resourceDAO.incrementDownloads(materialId);

            // Locate file
            String relativePath = material.getFilePath();
            String fullPath = getServletContext().getRealPath("") + relativePath.replace("/", File.separator);
            File downloadFile = new File(fullPath);

            if (!downloadFile.exists()) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND, "Physical file not found on server disk");
                return;
            }

            // Set Content-Type
            String mimeType = getServletContext().getMimeType(fullPath);
            if (mimeType == null) {
                mimeType = "application/octet-stream";
            }
            response.setContentType(mimeType);
            response.setContentLength((int) downloadFile.length());

            // Force download header
            String headerKey = "Content-Disposition";
            String headerValue = String.format("attachment; filename=\"%s\"", downloadFile.getName().substring(downloadFile.getName().indexOf("_") + 1));
            response.setHeader(headerKey, headerValue);

            // Output stream
            try (FileInputStream inStream = new FileInputStream(downloadFile);
                 OutputStream outStream = response.getOutputStream()) {
                
                byte[] buffer = new byte[4096];
                int bytesRead = -1;
                while ((bytesRead = inStream.read(buffer)) != -1) {
                    outStream.write(buffer, 0, bytesRead);
                }
            }
        } catch (NumberFormatException e) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid ID format");
        }
    }

    private void handleSearch(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String query = request.getParameter("query");
        String category = request.getParameter("category");
        String difficulty = request.getParameter("difficulty");
        String topic = request.getParameter("topic");

        List<Material> results = resourceDAO.searchMaterials(query, category, difficulty, topic);
        request.setAttribute("materials", results);
        request.setAttribute("query", query);
        request.setAttribute("selectedCategory", category);
        request.setAttribute("selectedDifficulty", difficulty);
        request.setAttribute("selectedTopic", topic);

        request.getRequestDispatcher("/views/resource_center.jsp").forward(request, response);
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
