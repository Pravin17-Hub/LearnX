<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="com.learnx.model.User" %>
<%
    User sidebarUser = (session != null) ? (User) session.getAttribute("user") : null;
%>
<% if (sidebarUser != null) { %>
<div class="col-md-3 d-none d-md-block left-navigation-sidebar">
    <div class="sidebar-glass">
        <!-- User Contribution Snapshot -->
        <div class="text-center mb-4 pb-3 border-bottom">
            <img src="<%= sidebarUser.getAvatarPath() %>" alt="Avatar" class="rounded-circle border border-3 border-primary mb-2" style="width: 70px; height: 70px; object-fit: cover;">
            <h5 class="fw-bold mb-1"><%= sidebarUser.getUsername() %></h5>
            <span class="role-badge"><%= sidebarUser.getRole() %></span>
            
            <div class="row mt-3 g-2">
                <div class="col-12">
                    <div class="p-2 neumorphic-inset">
                        <small class="text-muted d-block" style="font-size: 0.7rem; text-transform: uppercase; font-weight: bold;">Reputation Score</small>
                        <span class="fw-bold text-primary"><%= sidebarUser.getContributionScore() %></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Navigation Links -->
        <div class="list-group list-group-flush border-0">
            <a href="<%= request.getContextPath() %>/community" class="list-group-item list-group-item-action bg-transparent border-0 py-2.5 px-3 rounded-3 text-main mb-1 d-flex align-items-center">
                <i class="fa-solid fa-house-laptop me-3 text-primary fs-5"></i>Home Feed
            </a>
            <a href="<%= request.getContextPath() %>/dashboard" class="list-group-item list-group-item-action bg-transparent border-0 py-2.5 px-3 rounded-3 text-main mb-1 d-flex align-items-center">
                <i class="fa-solid fa-chalkboard-user me-3 text-secondary fs-5"></i>Classrooms
            </a>
            <a href="<%= request.getContextPath() %>/community" class="list-group-item list-group-item-action bg-transparent border-0 py-2.5 px-3 rounded-3 text-main mb-1 d-flex align-items-center">
                <i class="fa-solid fa-users me-3 text-accent fs-5"></i>Subject Communities
            </a>
            <a href="<%= request.getContextPath() %>/chat" class="list-group-item list-group-item-action bg-transparent border-0 py-2.5 px-3 rounded-3 text-main mb-1 d-flex align-items-center">
                <i class="fa-solid fa-comments me-3 text-success fs-5"></i>Private Chats
            </a>
            <a href="<%= request.getContextPath() %>/resources" class="list-group-item list-group-item-action bg-transparent border-0 py-2.5 px-3 rounded-3 text-main mb-1 d-flex align-items-center">
                <i class="fa-regular fa-folder-open me-3 text-warning fs-5"></i>Global Library
            </a>
            <a href="<%= request.getContextPath() %>/quiz" class="list-group-item list-group-item-action bg-transparent border-0 py-2.5 px-3 rounded-3 text-main mb-1 d-flex align-items-center">
                <i class="fa-solid fa-file-signature me-3 text-danger fs-5"></i>Public Tests
            </a>
            <a href="<%= request.getContextPath() %>/@<%= sidebarUser.getUsername() %>" class="list-group-item list-group-item-action bg-transparent border-0 py-2.5 px-3 rounded-3 text-main mb-1 d-flex align-items-center">
                <i class="fa-regular fa-id-card me-3 text-info fs-5"></i>Academic Profile
            </a>
        </div>
    </div>
</div>
<% } %>
