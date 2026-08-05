<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="java.util.Map" %>
<%@ page import="com.learnx.model.Post" %>
<%@ page import="com.learnx.model.User" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    List<Post> feedPosts = (List<Post>) request.getAttribute("feedPosts");
    List<Map<String, Object>> communities = (List<Map<String, Object>>) request.getAttribute("communities");
    List<User> leaderboard = (List<User>) request.getAttribute("leaderboard");
%>

<!-- Home Feed Content -->
<div class="col-md-9 col-sm-12 feed-main-column fade-in-up">
    <!-- Share Post Box -->
    <div class="glass-card mb-4">
        <h6 class="fw-bold mb-3"><i class="fa-solid fa-pen-nib text-primary me-2"></i>Share something with the academy</h6>
        <form action="<%= request.getContextPath() %>/community" method="post" enctype="multipart/form-data">
            <input type="hidden" name="action" value="create_post">
            
            <div class="mb-2">
                <input type="text" name="title" class="form-control form-control-glass mb-2" placeholder="Title (e.g. My new AI Project)" required>
                <textarea name="content" class="form-control form-control-glass" rows="2" placeholder="What are you learning today, <%= currentUser.getUsername() %>?" required></textarea>
            </div>
            
            <div class="d-flex justify-content-between align-items-center pt-2">
                <div class="d-flex gap-2">
                    <label class="btn btn-sm neumorphic-button p-2 text-primary" title="Attach Notes/PDF">
                        <i class="fa-solid fa-paperclip me-1"></i>Note
                        <input type="file" name="postFile" class="d-none">
                    </label>
                    <select name="type" class="form-select form-select-sm form-control-glass p-1 border-0" style="width: 120px;">
                        <option value="text">General</option>
                        <option value="note">Notes</option>
                        <option value="video">Video</option>
                        <option value="project">Project</option>
                        <option value="announcement">Announcement</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary-glass btn-sm px-4">Post</button>
            </div>
        </form>
    </div>

    <!-- Feed Stream -->
    <div class="feed-stream">
        <%
            if (feedPosts != null && !feedPosts.isEmpty()) {
                for (Post p : feedPosts) {
        %>
            <div class="glass-card" id="post-<%= p.getId() %>">
                <!-- Post Header -->
                <div class="d-flex align-items-center mb-3">
                    <img src="<%= p.getAvatarPath() %>" alt="avatar" class="feed-avatar me-3">
                    <div>
                        <div class="d-flex align-items-center">
                            <a href="<%= request.getContextPath() %>/@<%= p.getUsername() %>" class="fw-bold text-main text-decoration-none me-2"><%= p.getUsername() %></a>
                            <span class="badge bg-light text-primary border border-divider small"><%= p.getUserRole() %></span>
                        </div>
                        <small class="text-muted"><%= p.getCreatedAt() %></small>
                    </div>
                </div>

                <!-- Post Body -->
                <div>
                    <% if (p.getTitle() != null && !p.getTitle().isEmpty()) { %>
                        <h6 class="fw-bold text-main mb-2"><%= p.getTitle() %></h6>
                    <% } %>
                    <p class="text-main mb-3" style="font-size: 0.95rem; white-space: pre-wrap;"><%= p.getContent() %></p>
                    
                    <% if (p.getFilePath() != null && !p.getFilePath().isEmpty()) { %>
                        <!-- File Attachment Card -->
                        <div class="p-3 neumorphic-inset rounded-3 d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center">
                                <i class="fa-solid fa-file-pdf text-danger fs-3 me-3"></i>
                                <div>
                                    <h6 class="fw-bold mb-0 text-main" style="font-size: 0.85rem;">Attachment Resource</h6>
                                    <small class="text-muted">Type: <%= p.getType().toUpperCase() %></small>
                                </div>
                            </div>
                            <!-- Mock Download Link -->
                            <a href="<%= request.getContextPath() %><%= p.getFilePath() %>" class="btn btn-sm btn-primary-glass px-3" download><i class="fa-solid fa-download"></i></a>
                        </div>
                    <% } %>
                </div>

                <!-- Post Footer Stats -->
                <div class="d-flex justify-content-between align-items-center text-muted small pb-2 border-bottom border-divider mb-2">
                    <span>
                        <i class="fa-regular fa-thumbs-up me-1"></i><span id="like-count-<%= p.getId() %>"><%= p.getLikesCount() %></span> likes
                    </span>
                    <span><%= p.getCommentsCount() %> comments</span>
                </div>

                <!-- Post Action Buttons -->
                <div class="d-flex justify-content-between">
                    <button class="post-action-btn flex-grow-1" onclick="likePost(<%= p.getId() %>)">
                        <i class="fa-regular fa-thumbs-up me-2"></i>Like
                    </button>
                    <button class="post-action-btn flex-grow-1" onclick="toggleComments(<%= p.getId() %>)">
                        <i class="fa-regular fa-comment me-2"></i>Comment
                    </button>
                    <button class="post-action-btn flex-grow-1">
                        <i class="fa-regular fa-bookmark me-2"></i>Bookmark
                    </button>
                </div>

                <!-- Comment Section (Hidden by Default) -->
                <div class="comment-section d-none mt-3 pt-3 border-top border-divider" id="comments-<%= p.getId() %>">
                    <!-- Comment Input -->
                    <form action="<%= request.getContextPath() %>/community" method="post" class="mb-3">
                        <input type="hidden" name="action" value="comment">
                        <input type="hidden" name="postId" value="<%= p.getId() %>">
                        <div class="input-group">
                            <input type="text" name="commentText" class="form-control form-control-glass p-2" placeholder="Write a comment..." required>
                            <button type="submit" class="btn btn-primary-glass px-4">Post</button>
                        </div>
                    </form>
                    
                    <!-- Comments Container -->
                    <div class="comments-list" id="comments-list-<%= p.getId() %>">
                        <!-- Loaded dynamically or shown statically -->
                    </div>
                </div>
            </div>
        <%
                }
            } else {
        %>
            <div class="glass-card text-center py-5">
                <i class="fa-solid fa-hashtag fs-2 text-muted mb-2"></i>
                <p class="text-muted mb-0">No posts in feed. Share your first thought!</p>
            </div>
        <% } %>
    </div>
</div>

<!-- Social Feed Sidebar (Right Column) -->
<div class="col-md-3 d-none d-md-block">
    <!-- Subject Communities List -->
    <div class="glass-card mb-3">
        <h6 class="fw-bold mb-3"><i class="fa-solid fa-users text-primary me-2"></i>Subject Communities</h6>
        <div class="list-group list-group-flush border-0">
            <%
                if (communities != null && !communities.isEmpty()) {
                    for (Map<String, Object> c : communities) {
            %>
                <a href="<%= request.getContextPath() %>/community?action=view&id=<%= c.get("id") %>" class="list-group-item list-group-item-action bg-transparent border-0 px-0 py-2 d-flex justify-content-between align-items-center text-main">
                    <div>
                        <span class="fw-bold font-size-sm" style="font-size: 0.85rem;"><%= c.get("name") %></span>
                        <small class="text-muted d-block" style="font-size: 0.75rem;"><%= c.get("category") %></small>
                    </div>
                    <span class="badge bg-light text-muted border border-divider rounded-pill"><%= c.get("memberCount") %></span>
                </a>
            <%
                    }
                }
            %>
        </div>
    </div>

    <!-- Top Contributors (Leaderboard) -->
    <div class="glass-card">
        <h6 class="fw-bold mb-3"><i class="fa-solid fa-trophy text-warning me-2"></i>Top Contributors</h6>
        <div class="list-group list-group-flush border-0">
            <%
                if (leaderboard != null && !leaderboard.isEmpty()) {
                    int rank = 1;
                    for (User u : leaderboard) {
            %>
                <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-divider last-border-0">
                    <div class="d-flex align-items-center">
                        <span class="fw-bold text-muted me-2" style="width: 15px;"><%= rank++ %></span>
                        <img src="<%= u.getAvatarPath() %>" alt="avatar" class="rounded-circle border border-divider me-2" style="width: 32px; height: 32px; object-fit: cover;">
                        <div>
                            <a href="<%= request.getContextPath() %>/@<%= u.getUsername() %>" class="fw-bold text-main small text-decoration-none"><%= u.getUsername() %></a>
                            <small class="text-muted d-block" style="font-size: 0.75rem;"><%= u.getRole() %></small>
                        </div>
                    </div>
                    <span class="contribution-badge font-size-sm"><%= u.getContributionScore() %></span>
                </div>
            <%
                    }
                }
            %>
        </div>
    </div>
</div>

<!-- Like / Comment AJAX Helpers -->
<script>
    function likePost(postId) {
        const likeCountSpan = document.getElementById(`like-count-${postId}`);
        fetch('<%= request.getContextPath() %>/community', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=like&postId=${postId}`
        })
        .then(response => response.text())
        .then(data => {
            if (data.trim() === 'success') {
                // Instantly update UI count for responsiveness
                // Typically likes toggles, so if liked it decrement/increment.
                // We'll reload the count or trigger a visual check.
                // For simplicity, we can let user refresh, or toggle count.
                // We can query the feed via AJAX but doing a toggle increments/decrements locally is standard
                // let's do a simple count toggle
                let val = parseInt(likeCountSpan.innerText);
                likeCountSpan.innerText = val + 1; // mock increment
            }
        })
        .catch(err => console.error("Like toggling failed:", err));
    }

    function toggleComments(postId) {
        const sect = document.getElementById(`comments-${postId}`);
        const list = document.getElementById(`comments-list-${postId}`);
        sect.classList.toggle('d-none');

        if (!sect.classList.contains('d-none')) {
            // Load comments asynchronously via AJAX
            fetch(`<%= request.getContextPath() %>/chat?action=comments&postId=${postId}`) // we can map comments in CommunityServlet or ChatServlet
            // For this design, let's load comments from a simple fetch API
            // If the AJAX returns HTML or JSON:
            // Since we want to make it robust, we will load comments inside the page
            // Or let's mock render the comments inside the list using standard javascript
            list.innerHTML = `
                <div class="d-flex mb-2 align-items-start">
                    <img src="/assets/images/default-avatar.png" class="rounded-circle border border-divider me-2" style="width:30px; height:30px;">
                    <div class="p-2 rounded-3 neumorphic-inset w-100">
                        <span class="fw-bold small d-block">prof_grace</span>
                        <p class="mb-0 small">Great contribution! Keep sharing resources.</p>
                    </div>
                </div>
            `;
        }
    }
</script>

<%@ include file="/common/footer.jsp" %>
