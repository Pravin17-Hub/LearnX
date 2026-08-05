package com.learnx.controller;

import java.io.IOException;
import java.io.InputStream;
import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;
import com.learnx.util.OpenAIClient;

@WebServlet("/ocr")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 2, // 2MB
    maxFileSize = 1024 * 1024 * 10,      // 10MB
    maxRequestSize = 1024 * 1024 * 20    // 20MB
)
public class OCRServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        response.setContentType("text/plain;charset=UTF-8");
        
        try {
            Part part = request.getPart("file");
            if (part == null || part.getSize() == 0) {
                response.getWriter().write("Error: No file uploaded");
                return;
            }

            // Parse file extension
            String contentDisp = part.getHeader("content-disposition");
            String fileName = "";
            for (String content : contentDisp.split(";")) {
                if (content.trim().startsWith("filename")) {
                    fileName = content.substring(content.indexOf("=") + 1).trim().replace("\"", "");
                }
            }

            String fileType = "png";
            int idx = fileName.lastIndexOf('.');
            if (idx > 0) {
                fileType = fileName.substring(idx + 1).toLowerCase();
            }

            // Read file bytes
            InputStream is = part.getInputStream();
            byte[] imageBytes = is.readAllBytes();
            is.close();

            // Run OCR
            String transcribedText = OpenAIClient.performImageOCR(imageBytes, fileType);
            
            if (transcribedText != null) {
                response.getWriter().write(transcribedText.trim());
            } else {
                response.getWriter().write("Error: OCR returned empty result");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.getWriter().write("Error running OCR: " + e.getMessage());
        }
    }
}
