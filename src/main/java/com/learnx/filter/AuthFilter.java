package com.learnx.filter;

import java.io.IOException;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import com.learnx.model.User;

@WebFilter("/*")
public class AuthFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {}

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        HttpSession session = httpRequest.getSession(false);
        
        String path = httpRequest.getRequestURI().substring(httpRequest.getContextPath().length());
        
        // Allowed paths without login
        boolean isStaticAsset = path.startsWith("/assets/") || path.startsWith("/uploads/");
        boolean isAuthEndpoint = path.equals("/auth") || path.equals("/profile") || path.equals("/views/login.jsp") || path.equals("/index.jsp") || path.equals("/");
        
        // Intercept vanity profile URL (/@username) and forward
        if (path.startsWith("/@")) {
            String username = path.substring(2);
            httpRequest.getRequestDispatcher("/profile?username=" + username).forward(request, response);
            return;
        }
        
        User user = (session != null) ? (User) session.getAttribute("user") : null;
        
        if (user != null || isStaticAsset || isAuthEndpoint) {
            // Check Role-Based access control for specific endpoints
            if (path.startsWith("/admin") && (user == null || !"Administrator".equals(user.getRole()))) {
                httpResponse.sendError(HttpServletResponse.SC_FORBIDDEN, "Unauthorized Access to Admin Panel");
                return;
            }
            chain.doFilter(request, response);
        } else {
            // Redirect to login page
            httpResponse.sendRedirect(httpRequest.getContextPath() + "/views/login.jsp");
        }
    }

    @Override
    public void destroy() {}
}
