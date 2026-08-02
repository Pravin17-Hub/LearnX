<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="java.util.Map" %>
<%@ page import="com.learnx.model.User" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    Map<String, Object> community = (Map<String, Object>) request.getAttribute("community");
    List<Map<String, Object>> posts = (List<Map<String, Object>>) request.getAttribute("posts");
%>

<!-- Subject Community Detail Panel -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <!-- Back to Hub -->
    <a href="<%= request.getContextPath() %>/community" class="btn btn-sm btn-light bg-transparent text-muted mb-3 border-divider">
        <i class="fa-solid fa-arrow-left me-1"></i>Back to Hub
    </a>

    <!-- Community Banner -->
    <div class="glass-container p-4 mb-4 text-white d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.85), rgba(79, 70, 229, 0.85)); border-radius: 20px;">
        <div>
            <span class="badge bg-white text-accent mb-2"><%= community.get("category") %></span>
            <h3 class="fw-bold mb-1" style="font-family: 'Poppins', sans-serif;"><%= community.get("name") %> Community</h3>
            <p class="mb-0 text-white-50"><%= community.get("description") %></p>
        </div>
        <div class="text-end">
            <span class="badge bg-white text-dark p-2 mb-2 rounded-3"><i class="fa-solid fa-users me-1 text-primary"></i><%= community.get("memberCount") %> scholars</span>
            <!-- Join Button Form -->
            <form action="<%= request.getContextPath() %>/community" method="post">
                <input type="hidden" name="action" value="join">
                <input type="hidden" name="communityId" value="<%= community.get("id") %>">
                <button type="submit" class="btn btn-sm btn-light text-primary fw-bold w-100 rounded-pill px-3 mt-1">Join Community</button>
            </form>
        </div>
    </div>

    <div class="row">
        <!-- Pinned Topics & Info (Left Column) -->
        <div class="col-md-4 mb-3">
            <div class="glass-card mb-3">
                <h6 class="fw-bold mb-2">Community Info</h6>
                <small class="text-muted d-block mb-1">Moderator: <b><%= community.get("moderatorName") != null ? community.get("moderatorName") : "System" %></b></small>
                <small class="text-muted d-block">Created on: <b><%= community.get("createdAt") %></b></small>
            </div>

            <!-- Pinned Rules -->
            <div class="glass-card">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-circle-exclamation text-primary me-2"></i>Community Guidelines</h6>
                <ol class="small text-muted ps-3 mb-0">
                    <li class="mb-2">Keep posts strictly academic.</li>
                    <li class="mb-2">Tag code snippets cleanly using syntax tools.</li>
                    <li class="mb-2">Be helpful and welcome new learners.</li>
                </ol>
            </div>
        </div>

        <!-- Community Feed & Share (Right Column) -->
        <div class="col-md-8 mb-3">
            <!-- Share Post Box -->
            <div class="glass-card mb-4">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-pen-nib text-primary me-2"></i>Share with <%= community.get("name") %> scholars</h6>
                <form action="<%= request.getContextPath() %>/community" method="post">
                    <input type="hidden" name="action" value="create_community_post">
                    <input type="hidden" name="communityId" value="<%= community.get("id") %>">

                    <div class="mb-2">
                        <input type="text" name="title" class="form-control form-control-glass mb-2" placeholder="Title (e.g. Question on thread-safety)" required>
                        <textarea name="content" class="form-control form-control-glass" rows="2" placeholder="Start a discussion, ask a question, or share projects..." required></textarea>
                    </div>

                    <div class="d-flex justify-content-between align-items-center pt-2">
                        <select name="type" class="form-select form-select-sm form-control-glass p-1 border-0" style="width: 130px;">
                            <option value="post">General Post</option>
                            <option value="question">Question</option>
                            <option value="poll">Poll</option>
                            <option value="project">Project Demo</option>
                        </select>
                        <button type="submit" class="btn btn-primary-glass btn-sm px-4">Post</button>
                    </div>
                </form>
            </div>

            <!-- Community Posts Feed -->
            <div class="community-posts">
                <%
                    if (posts != null && !posts.isEmpty()) {
                        for (Map<String, Object> p : posts) {
                %>
                    <div class="glass-card mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center">
                                <img src="<%= p.get("avatarPath") %>" alt="avatar" class="feed-avatar me-3">
                                <div>
                                    <div class="d-flex align-items-center">
                                        <a href="<%= request.getContextPath() %>/@<%= p.get("username") %>" class="fw-bold text-main small text-decoration-none me-2"><%= p.get("username") %></a>
                                        <span class="badge bg-light text-primary border border-divider small"><%= p.get("userRole") %></span>
                                    </div>
                                    <small class="text-muted"><%= p.get("createdAt") %></small>
                                </div>
                            </div>
                            <span class="badge bg-light text-muted border border-divider"><%= p.get("type").toString().toUpperCase() %></span>
                        </div>

                        <h6 class="fw-bold text-main mb-2"><%= p.get("title") %></h6>
                        <p class="text-muted small mb-3"><%= p.get("content") %></p>

                        <div class="d-flex gap-4 border-top border-divider pt-2 mt-2 text-muted small">
                            <span><i class="fa-regular fa-thumbs-up me-1"></i><%= p.get("likes") %> Likes</span>
                            <span><i class="fa-regular fa-comment me-1"></i><%= p.get("comments") %> Comments</span>
                        </div>
                    </div>
                <%
                        }
                    } else {
                %>
                    <div class="glass-card text-center py-5">
                        <i class="fa-solid fa-hashtag fs-2 text-muted mb-2"></i>
                        <p class="text-muted mb-0">No posts in this community yet. Be the first to share something!</p>
                    </div>
                <% } %>
            </div>
        </div>
    </div>
</div>

<%@ include file="/common/footer.jsp" %>
