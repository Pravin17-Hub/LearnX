package com.learnx.controller;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import com.learnx.dao.QuizDAO;
import com.learnx.model.Quiz;
import com.learnx.model.User;

@WebServlet("/quiz_export")
public class QuizExportServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private QuizDAO quizDAO;

    @Override
    public void init() throws ServletException {
        quizDAO = new QuizDAO();
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
        if (!"Faculty".equals(user.getRole()) && !"Administrator".equals(user.getRole())) {
            response.sendRedirect(request.getContextPath() + "/dashboard?error=unauthorized");
            return;
        }

        String quizIdStr = request.getParameter("quizId");
        if (quizIdStr == null || quizIdStr.trim().isEmpty()) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
            return;
        }

        try {
            int quizId = Integer.parseInt(quizIdStr);
            Quiz quiz = quizDAO.getQuizById(quizId);
            if (quiz == null) {
                response.sendRedirect(request.getContextPath() + "/dashboard?error=quiz_not_found");
                return;
            }

            List<Map<String, Object>> attempts = quizDAO.getQuizAttemptsForExport(quizId);

            String safeTitle = quiz.getTitle().replaceAll("[^a-zA-Z0-9-_]", "_");
            
            response.setContentType("text/csv");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + safeTitle + "_results.csv\"");
            response.setCharacterEncoding("UTF-8");

            PrintWriter writer = response.getWriter();
            writer.println("Sl No,Register Number,Name,Marks");

            int slNo = 1;
            for (Map<String, Object> attempt : attempts) {
                String regNo = (String) attempt.get("reg_no");
                String name = (String) attempt.get("name");
                int score = (int) attempt.get("score");

                if (regNo == null || regNo.isEmpty()) {
                    regNo = "GUEST";
                } else {
                    regNo = regNo.replace("\"", "\"\"");
                    if (regNo.contains(",")) {
                        regNo = "\"" + regNo + "\"";
                    }
                }

                if (name == null || name.isEmpty()) {
                    name = "Guest Scholar";
                } else {
                    name = name.replace("\"", "\"\"");
                    if (name.contains(",")) {
                        name = "\"" + name + "\"";
                    }
                }

                writer.println(slNo++ + "," + regNo + "," + name + "," + score);
            }
            writer.flush();
            writer.close();

        } catch (NumberFormatException e) {
            response.sendRedirect(request.getContextPath() + "/dashboard");
        }
    }
}
