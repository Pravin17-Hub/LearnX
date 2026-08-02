<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.User" %>
<%@ page import="com.learnx.model.Material" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    User profileUser = (User) request.getAttribute("profileUser");
    boolean isFollowing = (boolean) request.getAttribute("isFollowing");
    List<Material> uploadedResources = (List<Material>) request.getAttribute("uploadedResources");
    
    boolean isOwnProfile = (currentUser != null && currentUser.getId() == profileUser.getId());
%>

<!-- Profile Container -->
<div class="<%= (currentUser != null) ? "col-md-9 col-sm-12" : "col-12" %> fade-in-up">
    <!-- Profile Card (Translucent Modern Layout) -->
    <div class="glass-container overflow-hidden mb-4 p-4">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-4">
            <div class="d-flex align-items-center gap-4">
                <img src="<%= (profileUser.getAvatarPath() != null && !profileUser.getAvatarPath().isEmpty()) ? profileUser.getAvatarPath() : request.getContextPath() + "/assets/img/default-avatar.png" %>" alt="Avatar" class="rounded-circle border border-4 border-glass shadow-lg" style="width: 110px; height: 110px; object-fit: cover; background: var(--bg-glass);">
                <div>
                    <div class="d-flex align-items-center gap-2.5 mb-1.5 flex-wrap">
                        <h3 class="fw-bold mb-0 text-main"><%= (profileUser.getName() != null && !profileUser.getName().isEmpty()) ? profileUser.getName() : "@" + profileUser.getUsername() %></h3>
                        <% if (profileUser.getName() != null && !profileUser.getName().isEmpty()) { %>
                            <span class="text-muted small">(@<%= profileUser.getUsername() %>)</span>
                        <% } %>
                        <span class="badge bg-primary-glass text-primary px-3.5 py-1.5 font-size-xs rounded-pill text-uppercase fw-bold"><%= profileUser.getRole() %></span>
                    </div>
                    <p class="text-muted mb-0"><i class="fa-solid fa-building-columns me-2"></i><%= profileUser.getInstitution() %> • <%= profileUser.getDepartment() %></p>
                </div>
            </div>
            
            <div>
                <% if (isOwnProfile) { %>
                    <button class="btn btn-primary-glass rounded-pill px-4" data-bs-toggle="modal" data-bs-target="#editProfileModal">
                        <i class="fa-solid fa-pen me-2"></i>Edit Profile
                    </button>
                <% } else if (currentUser != null) { %>
                    <button class="btn <%= isFollowing ? "btn-secondary" : "btn-primary-glass" %> rounded-pill px-4" id="followBtn" onclick="toggleFollow(<%= profileUser.getId() %>)">
                        <i class="fa-solid <%= isFollowing ? "fa-user-check" : "fa-user-plus" %> me-2"></i>
                        <span id="followBtnText"><%= isFollowing ? "Following" : "Follow" %></span>
                    </button>
                <% } %>
            </div>
        </div>
        
        <!-- Stats and Bio Grid -->
        <div class="border-top border-divider mt-4 pt-4">
            <p class="text-main mb-4 lead font-size-sm" style="font-style: italic;"><%= (profileUser.getBio() != null && !profileUser.getBio().isEmpty()) ? profileUser.getBio() : "No bio added yet." %></p>
            
            <div class="row g-3 text-center text-md-start">
                <div class="col-4">
                    <span class="d-block font-size-xs text-muted mb-1">Followers</span>
                    <span class="fw-bold text-main fs-4" id="followersCount"><%= profileUser.getFollowerCount() %></span>
                </div>
                <div class="col-4">
                    <span class="d-block font-size-xs text-muted mb-1">Following</span>
                    <span class="fw-bold text-main fs-4"><%= profileUser.getFollowingCount() %></span>
                </div>
                <div class="col-4">
                    <span class="d-block font-size-xs text-muted mb-1">Reputation</span>
                    <span class="fw-bold text-main fs-4"><%= profileUser.getContributionScore() %> pts</span>
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <!-- Sidebar Profile info -->
        <div class="col-md-4 mb-3">
            <!-- Skills & Subjects -->
            <div class="glass-card mb-3">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-code text-primary me-2"></i>Skills & Subjects</h6>
                
                <div class="mb-3">
                    <small class="text-muted d-block mb-2 font-size-sm">Core Skills</small>
                    <div class="d-flex gap-1.5 flex-wrap">
                        <% 
                            if (profileUser.getSkills() != null && !profileUser.getSkills().isEmpty()) {
                                for (String s : profileUser.getSkills().split(",")) {
                        %>
                            <span class="badge bg-light text-dark border border-divider mb-1"><%= s.trim() %></span>
                        <% 
                                }
                            } else {
                        %>
                            <span class="text-muted small">No skills listed.</span>
                        <% } %>
                    </div>
                </div>

                <div>
                    <small class="text-muted d-block mb-2 font-size-sm">Active Subjects</small>
                    <div class="d-flex gap-1.5 flex-wrap">
                        <% 
                            if (profileUser.getSubjects() != null && !profileUser.getSubjects().isEmpty()) {
                                for (String s : profileUser.getSubjects().split(",")) {
                        %>
                            <span class="badge bg-primary-subtle text-primary border-0 mb-1"><%= s.trim() %></span>
                        <% 
                                }
                            } else {
                        %>
                            <span class="text-muted small">No subjects listed.</span>
                        <% } %>
                    </div>
                </div>
            </div>

            <!-- Activity Timeline -->
            <div class="glass-card">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-timeline text-primary me-2"></i>Activity Timeline</h6>
                <div class="activity-timeline">
                    <div class="timeline-item">
                        <small class="text-muted d-block">Today</small>
                        <span class="small text-main">Logged in and accessed the dashboard.</span>
                    </div>
                    <div class="timeline-item">
                        <small class="text-muted d-block">2 days ago</small>
                        <span class="small text-main">Uploaded guide in <b>Introduction to AI</b>.</span>
                    </div>
                    <div class="timeline-item">
                        <small class="text-muted d-block">1 week ago</small>
                        <span class="small text-main">Joined the <b>Java</b> subject community.</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Uploaded Notes/Resources -->
        <div class="col-md-8 mb-3">
            <div class="glass-container p-4">
                <h5 class="fw-bold mb-4"><i class="fa-regular fa-folder-open text-primary me-2"></i>Shared Resources & Contributions</h5>
                
                <div class="row">
                    <%
                        if (uploadedResources != null && !uploadedResources.isEmpty()) {
                            for (Material m : uploadedResources) {
                    %>
                        <div class="col-12 mb-3">
                            <div class="p-3 neumorphic-inset rounded-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="d-flex align-items-center gap-2 mb-1">
                                        <span class="badge bg-secondary p-1.5 small"><%= m.getFileType().toUpperCase() %></span>
                                        <h6 class="fw-bold mb-0 text-main"><%= m.getTitle() %></h6>
                                    </div>
                                    <p class="text-muted small mb-1"><%= m.getDescription() %></p>
                                    <small class="text-muted">Topic: <%= m.getTopic() %> | Difficulty: <%= m.getDifficulty() %></small>
                                </div>
                                <div class="text-end">
                                    <span class="small text-muted d-block mb-1"><i class="fa-regular fa-eye me-1"></i><%= m.getViews() %> | <i class="fa-solid fa-download me-1"></i><%= m.getDownloads() %></span>
                                    <a href="<%= request.getContextPath() %>/resources?action=download&id=<%= m.getId() %>" class="btn btn-sm btn-primary-glass p-1 px-3"><i class="fa-solid fa-download"></i></a>
                                </div>
                            </div>
                        </div>
                    <%
                            }
                        } else {
                    %>
                        <div class="col-12 text-center py-4">
                            <p class="text-muted mb-0">No resources uploaded yet.</p>
                        </div>
                    <% } %>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ==========================================
      MODALS
========================================== -->

<% if (isOwnProfile) { %>
<!-- Edit Profile Modal -->
<div class="modal fade" id="editProfileModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-container border-0 p-4">
            <h5 class="fw-bold mb-3"><i class="fa-solid fa-user-pen me-2 text-primary"></i>Edit Public Profile</h5>
            <form action="<%= request.getContextPath() %>/auth" method="post" enctype="multipart/form-data">
                <input type="hidden" name="action" value="update_profile">
                
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Institution</label>
                        <input type="text" name="institution" class="form-control form-control-glass" value="<%= profileUser.getInstitution() %>" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Department</label>
                        <input type="text" name="department" class="form-control form-control-glass" value="<%= profileUser.getDepartment() %>" required>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label text-muted small fw-semibold">Professional Bio</label>
                    <textarea name="bio" class="form-control form-control-glass" rows="2" required><%= profileUser.getBio() %></textarea>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-4">
                        <label class="form-label text-muted small fw-semibold">Skills (Comma-separated)</label>
                        <input type="text" name="skills" class="form-control form-control-glass" value="<%= profileUser.getSkills() != null ? profileUser.getSkills() : "" %>" placeholder="Java, Python, Algorithms">
                    </div>
                    <div class="col-md-6 mb-4">
                        <label class="form-label text-muted small fw-semibold">Subjects (Comma-separated)</label>
                        <input type="text" name="subjects" class="form-control form-control-glass" value="<%= profileUser.getSubjects() != null ? profileUser.getSubjects() : "" %>" placeholder="AI, Machine Learning">
                    </div>
                </div>

                <div class="mb-4">
                    <label class="form-label text-muted small fw-semibold">Upload Profile Picture (Avatar)</label>
                    <input type="file" name="avatar_file" class="form-control form-control-glass" accept="image/*">
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass">Save Changes</button>
                </div>
            </form>
        </div>
    </div>
</div>
<% } %>

<!-- Follow Script -->
<script>
    function toggleFollow(userId) {
        const btn = document.getElementById('followBtn');
        const textSpan = document.getElementById('followBtnText');
        const countSpan = document.getElementById('followersCount');
        const isFollowing = btn.classList.contains('btn-secondary');

        const action = isFollowing ? 'unfollow' : 'follow';

        fetch('<%= request.getContextPath() %>/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=' + action + '&targetId=' + userId
        })
        .then(response => response.text())
        .then(data => {
            if (data.trim() === 'followed') {
                btn.className = 'btn btn-secondary rounded-pill px-4';
                btn.innerHTML = '<i class="fa-solid fa-user-check me-2"></i><span id="followBtnText">Following</span>';
                countSpan.innerText = parseInt(countSpan.innerText) + 1;
            } else if (data.trim() === 'unfollowed') {
                btn.className = 'btn btn-primary-glass rounded-pill px-4';
                btn.innerHTML = '<i class="fa-solid fa-user-plus me-2"></i><span id="followBtnText">Follow</span>';
                countSpan.innerText = Math.max(0, parseInt(countSpan.innerText) - 1);
            }
        })
        .catch(err => console.error("Follow toggling failed:", err));
    }
</script>

<%@ include file="/common/footer.jsp" %>
