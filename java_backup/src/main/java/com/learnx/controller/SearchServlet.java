package com.learnx.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.learnx.dao.UserDAO;
import com.learnx.dao.ResourceDAO;
import com.learnx.dao.CommunityDAO;
import com.learnx.model.User;
import com.learnx.model.Material;

@WebServlet("/search")
public class SearchServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;
    private UserDAO userDAO;
    private ResourceDAO resourceDAO;
    private CommunityDAO communityDAO;

    @Override
    public void init() throws ServletException {
        userDAO = new UserDAO();
        resourceDAO = new ResourceDAO();
        communityDAO = new CommunityDAO();
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String query = request.getParameter("query");
        if (query == null) query = "";
        query = query.trim();

        List<User> matchedUsers = userDAO.searchUsers(query);
        List<Material> matchedMaterials = resourceDAO.searchMaterials(query, "All", "All", "");
        List<Map<String, Object>> matchedCommunities = communityDAO.searchCommunities(query);

        request.setAttribute("query", query);
        request.setAttribute("matchedUsers", matchedUsers);
        request.setAttribute("matchedMaterials", matchedMaterials);
        request.setAttribute("matchedCommunities", matchedCommunities);

        request.getRequestDispatcher("/views/search_results.jsp").forward(request, response);
    }
}
