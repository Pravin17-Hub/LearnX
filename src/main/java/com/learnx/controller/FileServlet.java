package com.learnx.controller;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.learnx.util.DBConnection;

@WebServlet("/uploads/*")
public class FileServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        // Retrieve the request path info (e.g., "/chat/123_file.png")
        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        // Decode the URL encoded file name
        String decodedPathInfo = URLDecoder.decode(pathInfo, StandardCharsets.UTF_8.name());

        // Centralized storage folder
        String uploadDir = DBConnection.getUploadDir();
        File file = new File(uploadDir, decodedPathInfo);

        // Security check: Prevent Directory Traversal attack
        String canonicalDest = file.getCanonicalPath();
        String canonicalBase = new File(uploadDir).getCanonicalPath();
        if (!canonicalDest.startsWith(canonicalBase)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }

        // Resolve to actual physical path if virtualized (e.g., Kaspersky sandbox)
        String resolvedPath = com.learnx.util.PythonBridge.resolveActualFilePath(canonicalDest);
        file = new File(resolvedPath);

        // Check if the file exists and is not a directory
        if (!file.exists() || file.isDirectory()) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        // Detect content type
        String contentType = getServletContext().getMimeType(file.getName());
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        response.setContentType(contentType);
        response.setContentLengthLong(file.length());

        // Stream the file to the response
        try (FileInputStream in = new FileInputStream(file);
             OutputStream out = response.getOutputStream()) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
        }
    }
}
