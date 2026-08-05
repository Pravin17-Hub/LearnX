package com.learnx.controller;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import com.learnx.dao.ClassroomDAO;
import com.learnx.dao.CommunityDAO;
import com.learnx.dao.UserDAO;
import com.learnx.dao.AssignmentDAO;
import com.learnx.dao.QuizDAO;
import com.learnx.model.Classroom;
import com.learnx.model.Post;
import com.learnx.model.User;
import com.learnx.model.Assignment;
import com.learnx.model.Quiz;

@WebServlet("/dashboard")
public class DashboardServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private ClassroomDAO classroomDAO;
    private CommunityDAO communityDAO;
    private UserDAO userDAO;
    private AssignmentDAO assignmentDAO;
    private QuizDAO quizDAO;

    @Override
    public void init() throws ServletException {
        classroomDAO = new ClassroomDAO();
        communityDAO = new CommunityDAO();
        userDAO = new UserDAO();
        assignmentDAO = new AssignmentDAO();
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

        // Load classrooms
        List<Classroom> classrooms = classroomDAO.getClassroomsForUser(user.getId());
        
        // Load feed posts
        List<Post> feedPosts = communityDAO.getFeedPosts();
        
        // Load leaderboard
        List<User> leaderboard = userDAO.getLeaderboard();

        // Load pending assignments and quizzes across joined classrooms
        List<Assignment> pendingAssignments = new ArrayList<>();
        List<Quiz> activeQuizzes = new ArrayList<>();
        
        for (Classroom c : classrooms) {
            List<Assignment> classAssigns = assignmentDAO.getAssignmentsForClassroom(c.getId());
            if (classAssigns != null) {
                // Limit to next few upcoming
                pendingAssignments.addAll(classAssigns.subList(0, Math.min(classAssigns.size(), 3)));
            }
            List<Quiz> classQuizzes = quizDAO.getQuizzesForClassroom(c.getId());
            if (classQuizzes != null) {
                activeQuizzes.addAll(classQuizzes.subList(0, Math.min(classQuizzes.size(), 3)));
            }
        }

        request.setAttribute("classrooms", classrooms);
        request.setAttribute("feedPosts", feedPosts);
        request.setAttribute("leaderboard", leaderboard);
        request.setAttribute("pendingAssignments", pendingAssignments);
        request.setAttribute("activeQuizzes", activeQuizzes);

        request.getRequestDispatcher("/views/dashboard.jsp").forward(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        doGet(request, response);
    }
}
