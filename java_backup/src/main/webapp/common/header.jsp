<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="com.learnx.model.User" %>
<%@ page import="com.learnx.model.Notification" %>
<%@ page import="com.learnx.dao.NotificationDAO" %>
<%@ page import="java.util.List" %>
<%
    User currentUser = (session != null) ? (User) session.getAttribute("user") : null;
    List<Notification> headerNotifications = null;
    boolean hasUnreadNotifications = false;
    if (currentUser != null) {
        headerNotifications = new NotificationDAO().getNotificationsByUserId(currentUser.getId());
        if (headerNotifications != null) {
            for (Notification n : headerNotifications) {
                if (!n.isRead()) {
                    hasUnreadNotifications = true;
                    break;
                }
            }
        }
    }
%>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LearnX – AI-Powered Collaborative Learning Platform</title>
    
    <!-- Local Bootstrap 5 CSS -->
    <link href="<%= request.getContextPath() %>/assets/lib/bootstrap/bootstrap.min.css" rel="stylesheet">
    <!-- Local Font Awesome -->
    <link href="<%= request.getContextPath() %>/assets/lib/fontawesome/all.min.css" rel="stylesheet">
    <!-- AOS Animation -->
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <!-- Custom Style -->
    <link href="<%= request.getContextPath() %>/assets/css/index.css?v=2" rel="stylesheet">
    
    <script>
        // Init theme immediately before body renders to avoid flashing
        (function() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
        })();
    </script>
</head>
<body>

<nav class="navbar navbar-expand-lg navbar-glass">
    <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center" href="<%= request.getContextPath() %>/dashboard">
            <span class="fs-4 fw-bold text-primary" style="font-family: 'Poppins', sans-serif;">
                <i class="fa-solid fa-graduation-cap me-2 text-primary"></i>LearnX
            </span>
        </a>
        
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent">
            <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarContent">
            <% if (currentUser != null) { %>
                <!-- Top Navigation Links -->
                <ul class="navbar-nav me-auto mb-2 mb-lg-0 fs-6">
                    <li class="nav-item">
                        <a class="nav-link text-main px-3 fw-semibold" href="<%= request.getContextPath() %>/community">
                            <i class="fa-solid fa-house-laptop me-1.5 text-primary"></i>Feed
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link text-main px-3 fw-semibold" href="<%= request.getContextPath() %>/dashboard">
                            <i class="fa-solid fa-chalkboard-user me-1.5 text-secondary"></i>Classrooms
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link text-main px-3 fw-semibold" href="<%= request.getContextPath() %>/resources">
                            <i class="fa-regular fa-folder-open me-1.5 text-warning"></i>Library
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link text-main px-3 fw-semibold" href="<%= request.getContextPath() %>/quiz">
                            <i class="fa-solid fa-file-signature me-1.5 text-danger"></i>Tests
                        </a>
                    </li>
                </ul>

                <!-- Global Search -->
                <form class="d-flex mx-auto col-lg-4 my-2 my-lg-0" action="<%= request.getContextPath() %>/search" method="get">
                    <div class="input-group neumorphic-inset w-100 p-1">
                        <span class="input-group-text bg-transparent border-0 text-muted"><i class="fa-solid fa-magnifying-glass"></i></span>
                        <input class="form-control bg-transparent border-0 shadow-none text-main" type="search" name="query" placeholder="Global search..." aria-label="Search">
                    </div>
                </form>
            <% } %>

            <ul class="navbar-nav ms-auto align-items-center">
                <!-- Theme Switcher -->
                <li class="nav-item me-3">
                    <button class="btn bg-transparent text-main border-0 shadow-none" id="themeToggleBtn" onclick="toggleTheme()" title="Toggle Dark/Light Mode">
                        <i class="fa-solid fa-moon fs-5" id="themeIcon"></i>
                    </button>
                </li>
                
                <% if (currentUser != null) { %>
                    <!-- Notifications -->
                    <li class="nav-item dropdown me-3">
                        <a class="nav-link text-main position-relative" href="#" id="notificationDropdown" role="button" data-bs-toggle="dropdown" onclick="markAllNotificationsRead()">
                            <i class="fa-regular fa-bell fs-5"></i>
                            <% if (hasUnreadNotifications) { %>
                            <span id="notificationBadge" class="position-absolute top-1 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
                                <span class="visually-hidden">New alerts</span>
                            </span>
                            <% } %>
                        </a>
                        <div class="dropdown-menu dropdown-menu-end glass-container p-3 border-0" style="width: 290px;">
                            <h6 class="fw-bold mb-2">Notifications</h6>
                            <hr class="dropdown-divider">
                            <div class="py-1 overflow-y-auto" style="max-height: 250px;">
                                <%
                                    if (headerNotifications != null && !headerNotifications.isEmpty()) {
                                        for (Notification n : headerNotifications) {
                                            String iconClass = "fa-solid fa-bell text-warning";
                                            if ("FOLLOW".equalsIgnoreCase(n.getType())) {
                                                iconClass = "fa-solid fa-user-plus text-success";
                                            } else if ("CHAT".equalsIgnoreCase(n.getType())) {
                                                iconClass = "fa-solid fa-comments text-info";
                                            } else if ("ASSIGNMENT".equalsIgnoreCase(n.getType()) || "QUIZ".equalsIgnoreCase(n.getType()) || "EXAM".equalsIgnoreCase(n.getType())) {
                                                iconClass = "fa-solid fa-file-signature text-primary";
                                            }
                                %>
                                    <div class="d-flex mb-2.5 pb-2.5 border-bottom border-divider last-border-0">
                                        <div class="me-2.5" style="font-size: 1.1rem;"><i class="<%= iconClass %>"></i></div>
                                        <div>
                                            <p class="mb-0 text-main font-size-sm fw-semibold" style="font-size: 0.82rem; line-height: 1.25;"><%= n.getTitle() %></p>
                                            <p class="mb-0 text-muted" style="font-size: 0.75rem;"><%= n.getMessage() %></p>
                                        </div>
                                    </div>
                                <%
                                        }
                                    } else {
                                %>
                                    <p class="text-muted text-center py-3 mb-0 small">No notifications yet.</p>
                                <% } %>
                            </div>
                        </div>
                    </li>
                    
                    <!-- Direct Message Quick Link -->
                    <li class="nav-item me-3">
                        <a class="nav-link text-main" href="<%= request.getContextPath() %>/chat" title="Private Chats">
                            <i class="fa-regular fa-comment-dots fs-5"></i>
                        </a>
                    </li>

                    <!-- User Profile Dropdown -->
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle d-flex align-items-center text-main" href="#" id="profileDropdown" role="button" data-bs-toggle="dropdown">
                            <img src="<%= currentUser.getAvatarPath() %>" alt="avatar" class="rounded-circle border border-2 border-primary" style="width: 34px; height: 34px; object-fit: cover;">
                            <span class="ms-2 d-none d-lg-inline"><%= (currentUser.getName() != null && !currentUser.getName().isEmpty()) ? currentUser.getName() : currentUser.getUsername() %></span>
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end glass-container border-0 mt-2 p-2" aria-labelledby="profileDropdown">
                            <li>
                                <a class="dropdown-item rounded-2 text-main" href="<%= request.getContextPath() %>/@<%= currentUser.getUsername() %>">
                                    <i class="fa-regular fa-user me-2"></i>My Profile
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item rounded-2 text-main" href="<%= request.getContextPath() %>/dashboard">
                                    <i class="fa-solid fa-chalkboard-user me-2"></i>Classrooms
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item rounded-2 text-main" href="<%= request.getContextPath() %>/resources">
                                    <i class="fa-regular fa-folder-open me-2"></i>Resources
                                </a>
                            </li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <a class="dropdown-item rounded-2 text-danger" href="<%= request.getContextPath() %>/auth?action=logout">
                                    <i class="fa-solid fa-arrow-right-from-bracket me-2"></i>Log Out
                                </a>
                            </li>
                        </ul>
                    </li>
                <% } else { %>
                    <li class="nav-item">
                        <a class="btn btn-primary-glass" href="<%= request.getContextPath() %>/views/login.jsp">Get Started</a>
                    </li>
                <% } %>
            </ul>
        </div>
    </div>
</nav>

<script>
function markAllNotificationsRead() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.remove();
    }
    fetch('<%= request.getContextPath() %>/auth', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=mark_notifications_read'
    }).catch(err => console.error("Error marking notifications read:", err));
}
</script>

<div class="container py-4">
    <div class="row">
