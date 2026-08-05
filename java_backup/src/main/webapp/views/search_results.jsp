<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="java.util.Map" %>
<%@ page import="com.learnx.model.User" %>
<%@ page import="com.learnx.model.Material" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    String searchPattern = (String) request.getAttribute("query");
    List<User> matchedUsers = (List<User>) request.getAttribute("matchedUsers");
    List<Material> matchedMaterials = (List<Material>) request.getAttribute("matchedMaterials");
    List<Map<String, Object>> matchedCommunities = (List<Map<String, Object>>) request.getAttribute("matchedCommunities");
    
    int totalResults = (matchedUsers != null ? matchedUsers.size() : 0) 
                     + (matchedMaterials != null ? matchedMaterials.size() : 0)
                     + (matchedCommunities != null ? matchedCommunities.size() : 0);
%>

<!-- Search Results Panel -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <!-- Search Title Banner -->
    <div class="glass-container p-4 mb-4 text-white overflow-hidden" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);">
        <span class="badge bg-primary-glass text-primary px-3 py-1.5 mb-2 font-size-xs text-uppercase fw-bold"><i class="fa-solid fa-magnifying-glass me-2"></i>Search Center</span>
        <h3 class="fw-bold mb-1 text-main">Search Results</h3>
        <p class="text-muted mb-0">Found <span class="text-primary fw-bold"><%= totalResults %></span> items matching "<span class="text-white fw-semibold"><%= searchPattern %></span>"</p>
    </div>

    <!-- Search Tabs Navigation -->
    <div class="glass-card mb-4 p-2">
        <ul class="nav nav-pills nav-fill gap-2" id="searchTabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active rounded-3 py-2.5 fw-bold" id="users-tab" data-bs-toggle="tab" data-bs-target="#users-pane" type="button" role="tab" aria-controls="users-pane" aria-selected="true">
                    <i class="fa-solid fa-users me-2"></i>Students & Faculty (<%= matchedUsers != null ? matchedUsers.size() : 0 %>)
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link rounded-3 py-2.5 fw-bold" id="materials-tab" data-bs-toggle="tab" data-bs-target="#materials-pane" type="button" role="tab" aria-controls="materials-pane" aria-selected="false">
                    <i class="fa-regular fa-folder-open me-2"></i>Library Resources (<%= matchedMaterials != null ? matchedMaterials.size() : 0 %>)
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link rounded-3 py-2.5 fw-bold" id="communities-tab" data-bs-toggle="tab" data-bs-target="#communities-pane" type="button" role="tab" aria-controls="communities-pane" aria-selected="false">
                    <i class="fa-solid fa-users-viewfinder me-2"></i>Communities (<%= matchedCommunities != null ? matchedCommunities.size() : 0 %>)
                </button>
            </li>
        </ul>
    </div>

    <!-- Tabs Panes Content -->
    <div class="tab-content" id="searchTabsContent">
        <!-- 1. USERS PANE -->
        <div class="tab-pane fade show active" id="users-pane" role="tabpanel" aria-labelledby="users-tab">
            <div class="row">
                <%
                    if (matchedUsers != null && !matchedUsers.isEmpty()) {
                        for (User u : matchedUsers) {
                            String roleBadgeClass = "bg-primary-glass text-primary";
                            if ("Faculty".equals(u.getRole())) {
                                roleBadgeClass = "bg-info-glass text-info";
                            } else if ("Teaching Assistant".equals(u.getRole())) {
                                roleBadgeClass = "bg-warning-glass text-warning";
                            } else if ("Administrator".equals(u.getRole())) {
                                roleBadgeClass = "bg-danger-glass text-danger";
                            }
                %>
                    <div class="col-md-6 mb-4">
                        <div class="glass-card overflow-hidden h-100 card-hover d-flex flex-column justify-content-between">
                            <div>
                                <!-- User Top Cover -->
                                <div class="position-relative" style="height: 60px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));">
                                    <span class="badge <%= roleBadgeClass %> border-0 position-absolute end-0 top-0 m-3 px-2.5 py-1 font-size-xs rounded-pill"><%= u.getRole() %></span>
                                </div>
                                
                                <!-- Profile Snapshot -->
                                <div class="px-4 pb-3" style="margin-top: -30px;">
                                    <div class="d-flex align-items-end gap-3 mb-2">
                                        <img src="<%= u.getAvatarPath() %>" alt="Avatar" class="rounded-circle border border-3 border-glass shadow-sm" style="width: 65px; height: 65px; object-fit: cover; background: var(--bg-glass);">
                                        <div class="mb-1">
                                            <h5 class="fw-bold mb-0 text-main">@<%= u.getUsername() %></h5>
                                            <small class="text-muted"><%= u.getInstitution() %></small>
                                        </div>
                                    </div>
                                    
                                    <p class="text-muted font-size-sm mt-3 mb-3 text-truncate-2"><%= (u.getBio() != null && !u.getBio().isEmpty()) ? u.getBio() : "No bio added yet." %></p>
                                    
                                    <!-- User Stats Grid -->
                                    <div class="row g-2 text-center mt-2 border-top border-divider pt-3">
                                        <div class="col-4">
                                            <span class="fw-bold text-main d-block font-size-sm"><%= u.getFollowerCount() %></span>
                                            <small class="text-muted font-size-xs">Followers</small>
                                        </div>
                                        <div class="col-4">
                                            <span class="fw-bold text-main d-block font-size-sm"><%= u.getContributionScore() %></span>
                                            <small class="text-muted font-size-xs">Reputation</small>
                                        </div>
                                        <div class="col-4">
                                            <span class="fw-bold text-danger d-block font-size-sm">🔥 <%= u.getLearningStreak() %>d</span>
                                            <small class="text-muted font-size-xs">Streak</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="px-4 pb-4 mt-2">
                                <a href="<%= request.getContextPath() %>/@<%= u.getUsername() %>" class="btn btn-primary-glass w-100 rounded-pill py-2 font-size-sm">
                                    <i class="fa-solid fa-arrow-right-to-bracket me-2"></i>View Profile
                                </a>
                            </div>
                        </div>
                    </div>
                <%
                        }
                    } else {
                %>
                    <div class="col-12 text-center py-5">
                        <div class="p-4 rounded-4 glass-card d-inline-block">
                            <i class="fa-solid fa-users-slash text-muted fs-1 mb-3"></i>
                            <h5 class="fw-bold text-main mb-1">No Profiles Found</h5>
                            <p class="text-muted small mb-0">We couldn't find any students or faculty matching your search terms.</p>
                        </div>
                    </div>
                <% } %>
            </div>
        </div>

        <!-- 2. MATERIALS PANE -->
        <div class="tab-pane fade" id="materials-pane" role="tabpanel" aria-labelledby="materials-tab">
            <div class="row">
                <%
                    if (matchedMaterials != null && !matchedMaterials.isEmpty()) {
                        for (Material m : matchedMaterials) {
                            String badgeClass = "bg-success-subtle text-success";
                            if ("Intermediate".equalsIgnoreCase(m.getDifficulty())) {
                                badgeClass = "bg-warning-subtle text-warning";
                            } else if ("Advanced".equalsIgnoreCase(m.getDifficulty())) {
                                badgeClass = "bg-danger-subtle text-danger";
                            }

                            String iconClass = "fa-file-lines text-secondary";
                            String ft = m.getFileType().toLowerCase();
                            if ("pdf".equals(ft)) {
                                iconClass = "fa-file-pdf text-danger";
                            } else if ("docx".equals(ft) || "doc".equals(ft)) {
                                iconClass = "fa-file-word text-primary";
                            } else if ("zip".equals(ft) || "rar".equals(ft)) {
                                iconClass = "fa-file-zipper text-warning";
                            } else if ("mp4".equals(ft) || "avi".equals(ft) || "mkv".equals(ft)) {
                                iconClass = "fa-file-video text-info";
                            }
                %>
                    <div class="col-md-6 mb-4">
                        <div class="glass-card h-100 d-flex flex-column justify-content-between p-4 card-hover">
                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="badge bg-primary-subtle text-primary border-0 rounded-pill px-2.5 py-1 font-size-xs"><%= m.getCategory() %></span>
                                    <span class="badge <%= badgeClass %> border-0 rounded-pill px-2.5 py-1 font-size-xs"><%= m.getDifficulty() %></span>
                                </div>

                                <div class="d-flex align-items-start gap-3 mb-2">
                                    <div class="p-2.5 bg-light rounded-3 shadow-sm">
                                        <i class="fa-solid <%= iconClass %> fs-4"></i>
                                    </div>
                                    <div>
                                        <h5 class="fw-bold text-main mb-1"><%= m.getTitle() %></h5>
                                        <small class="text-accent small d-block"><i class="fa-solid fa-hashtag me-1"></i>Topic: <%= m.getTopic() %></small>
                                    </div>
                                </div>

                                <p class="text-muted font-size-sm mt-3 mb-4 text-truncate-2"><%= m.getDescription() %></p>
                            </div>

                            <div class="d-flex justify-content-between align-items-center border-top border-divider pt-3">
                                <span class="font-size-xs text-muted">Shared by <a href="<%= request.getContextPath() %>/@<%= m.getUploaderName() %>" class="text-decoration-none fw-bold text-main">@<%= m.getUploaderName() %></a></span>
                                <a href="<%= request.getContextPath() %>/resources?action=download&id=<%= m.getId() %>" class="btn btn-sm btn-primary-glass px-3 rounded-pill">
                                    <i class="fa-solid fa-download me-1"></i>Download
                                </a>
                            </div>
                        </div>
                    </div>
                <%
                        }
                    } else {
                %>
                    <div class="col-12 text-center py-5">
                        <div class="p-4 rounded-4 glass-card d-inline-block">
                            <i class="fa-regular fa-folder-open text-muted fs-1 mb-3"></i>
                            <h5 class="fw-bold text-main mb-1">No Resources Found</h5>
                            <p class="text-muted small mb-0">No documents or guides match your search terms.</p>
                        </div>
                    </div>
                <% } %>
            </div>
        </div>

        <!-- 3. COMMUNITIES PANE -->
        <div class="tab-pane fade" id="communities-pane" role="tabpanel" aria-labelledby="communities-tab">
            <div class="row">
                <%
                    if (matchedCommunities != null && !matchedCommunities.isEmpty()) {
                        for (Map<String, Object> c : matchedCommunities) {
                %>
                    <div class="col-md-6 mb-4">
                        <div class="glass-card h-100 d-flex flex-column justify-content-between p-4 card-hover">
                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="badge bg-secondary-glass text-accent border-0 rounded-pill px-2.5 py-1 font-size-xs"><%= c.get("category") %></span>
                                    <small class="text-muted"><%= c.get("memberCount") %> Members</small>
                                </div>
                                <h5 class="fw-bold text-main mb-2"><i class="fa-solid fa-people-group me-2 text-primary"></i><%= c.get("name") %> Community</h5>
                                <p class="text-muted font-size-sm mb-4 text-truncate-2"><%= c.get("description") %></p>
                            </div>
                            <div class="d-flex justify-content-between align-items-center border-top border-divider pt-3">
                                <small class="text-muted">Moderator: <b><%= c.get("moderatorName") != null ? "@" + c.get("moderatorName") : "System" %></b></small>
                                <a href="<%= request.getContextPath() %>/community" class="btn btn-sm btn-primary-glass px-3 rounded-pill">
                                    <i class="fa-solid fa-arrow-right-to-bracket me-1"></i>Enter Room
                                </a>
                            </div>
                        </div>
                    </div>
                <%
                        }
                    } else {
                %>
                    <div class="col-12 text-center py-5">
                        <div class="p-4 rounded-4 glass-card d-inline-block">
                            <i class="fa-solid fa-users-viewfinder text-muted fs-1 mb-3"></i>
                            <h5 class="fw-bold text-main mb-1">No Communities Found</h5>
                            <p class="text-muted small mb-0">No subject communities match your search terms.</p>
                        </div>
                    </div>
                <% } %>
            </div>
        </div>
    </div>
</div>

<%@ include file="/common/footer.jsp" %>
