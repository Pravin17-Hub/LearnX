<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="java.util.Map" %>
<%@ page import="com.learnx.model.Quiz" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    Quiz quiz = (Quiz) request.getAttribute("quiz");
    boolean attempted = (request.getAttribute("attempted") != null) ? (boolean) request.getAttribute("attempted") : false;
    List<Map<String, Object>> leaderboard = (List<Map<String, Object>>) request.getAttribute("leaderboard");
%>

<!-- Quiz Detail View -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <!-- Back Link -->
    <% if (quiz.getClassroomId() > 0) { %>
        <a href="<%= request.getContextPath() %>/classroom?id=<%= quiz.getClassroomId() %>" class="btn btn-sm btn-light bg-transparent text-muted mb-3 border-divider">
            <i class="fa-solid fa-arrow-left me-1"></i>Back to Classroom
        </a>
    <% } else { %>
        <a href="<%= request.getContextPath() %>/quiz" class="btn btn-sm btn-light bg-transparent text-muted mb-3 border-divider">
            <i class="fa-solid fa-arrow-left me-1"></i>Back to Public Tests
        </a>
    <% } %>

    <% boolean showLeaderboard = currentUser != null && !"Student".equals(currentUser.getRole()); %>
    <div class="row">
        <!-- Rules & Start -->
        <div class="<%= showLeaderboard ? "col-md-7" : "col-md-12" %> mb-3">
            <div class="glass-container p-4 h-100 text-center d-flex flex-column justify-content-between">
                <div>
                    <span class="badge bg-primary-glass text-primary px-3 py-1 mb-2 text-uppercase fw-bold font-size-xs">Test Module</span>
                    <h3 class="fw-bold text-main mb-2"><%= quiz.getTitle() %></h3>
                    <p class="text-muted small mb-3"><%= (quiz.getDescription() != null && !quiz.getDescription().isEmpty()) ? quiz.getDescription() : "No description provided." %></p>
                    
                    <button class="btn btn-xs btn-outline-primary rounded-pill px-3 mb-4 font-size-xs fw-semibold" onclick="copyTestLink()">
                        <i class="fa-solid fa-share-nodes me-1.5"></i>Copy Test Share Link
                    </button>
                    <% 
                        boolean canEdit = currentUser != null && 
                            ("Faculty".equals(currentUser.getRole()) || "Administrator".equals(currentUser.getRole()) || currentUser.getId() == quiz.getCreatorId());
                        if (canEdit) { 
                    %>
                        <button class="btn btn-xs btn-outline-secondary rounded-pill px-3 mb-4 font-size-xs fw-semibold" data-bs-toggle="modal" data-bs-target="#editQuizModal">
                            <i class="fa-solid fa-pen-to-square me-1.5"></i>Edit Test Settings
                        </button>
                    <% } %>
                    
                    <div class="row g-3 justify-content-center mb-4">
                        <div class="col-5">
                            <div class="p-3 neumorphic-inset rounded-4">
                                <small class="text-muted d-block small">Duration</small>
                                <span class="fw-bold fs-4 text-primary"><%= quiz.getDurationMinutes() %> min</span>
                            </div>
                        </div>
                        <div class="col-5">
                            <div class="p-3 neumorphic-inset rounded-4">
                                <small class="text-muted d-block small">Total Marks</small>
                                <span class="fw-bold fs-4 text-primary"><%= quiz.getMaxMarks() %> m</span>
                            </div>
                        </div>
                    </div>

                    <% if (quiz.isNegativeMarking()) { %>
                        <div class="alert alert-warning border-0 rounded-4 text-start p-3 d-flex align-items-center mb-4" role="alert" style="font-size: 0.85rem;">
                            <i class="fa-solid fa-circle-info fs-4 me-3 text-warning"></i>
                            <div>
                                <h6 class="fw-bold mb-0 text-warning-emphasis">Negative Marking Enabled</h6>
                                <p class="mb-0 text-muted">Incorrect answers will result in a deduction of points. Guessing is discouraged!</p>
                            </div>
                        </div>
                    <% } %>
                </div>

                <div class="pt-3">
                    <% if (currentUser == null) { %>
                        <!-- Guest User play -->
                        <form action="<%= request.getContextPath() %>/quiz" method="get" id="guestPlayForm">
                            <input type="hidden" name="action" value="play">
                            <input type="hidden" name="id" value="<%= quiz.getId() %>">
                            <div class="mb-3 text-start">
                                <label class="form-label text-muted small fw-semibold">Enter Guest Name to Begin</label>
                                <input type="text" name="guestName" class="form-control form-control-glass p-2.5 font-size-sm text-main" placeholder="e.g. Guest Scholar" required>
                            </div>
                            <button type="submit" class="btn btn-primary-glass w-100 py-3 fs-5 rounded-4">
                                <i class="fa-solid fa-play me-2"></i>Begin Public Attempt
                            </button>
                        </form>
                    <% } else { %>
                        <% if (attempted) { %>
                            <div class="alert alert-success border-0 rounded-4 p-3 mb-0">
                                <h6 class="fw-bold mb-1"><i class="fa-solid fa-circle-check me-2"></i>Attempt Completed</h6>
                                <p class="mb-0 small text-muted">You have already submitted this quiz. Review your score on the leaderboard.</p>
                            </div>
                        <% } else { %>
                            <a href="<%= request.getContextPath() %>/quiz?action=play&id=<%= quiz.getId() %>" class="btn btn-primary-glass w-100 py-3 fs-5 rounded-4">
                                <i class="fa-solid fa-play me-2"></i>Begin Attempt
                            </a>
                        <% } %>
                    <% } %>
                </div>
            </div>
        </div>

        <% if (showLeaderboard) { %>
        <!-- Leaderboard -->
        <div class="col-md-5 mb-3">
            <div class="glass-card h-100">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-trophy text-warning me-2"></i>Test Leaderboard</h5>
                <div class="list-group list-group-flush border-0">
                    <%
                        if (leaderboard != null && !leaderboard.isEmpty()) {
                            int rank = 1;
                            for (Map<String, Object> entry : leaderboard) {
                                String av = (String) entry.get("avatarPath");
                                if (av == null || av.isEmpty()) {
                                    av = request.getContextPath() + "/assets/img/default-avatar.png";
                                }
                    %>
                        <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-divider last-border-0">
                            <div class="d-flex align-items-center">
                                <span class="fw-bold text-muted me-2"><%= rank++ %></span>
                                <img src="<%= av %>" alt="avatar" class="rounded-circle border border-divider me-2" style="width: 32px; height: 32px; object-fit: cover;">
                                <div>
                                    <span class="fw-bold text-main small"><%= entry.get("studentName") %></span>
                                    <small class="text-muted d-block" style="font-size: 0.7rem;"><%= entry.get("submitTime") %></small>
                                </div>
                            </div>
                            <span class="badge bg-primary p-2 rounded-3"><%= entry.get("score") %> points</span>
                        </div>
                    <%
                            }
                        } else {
                    %>
                        <div class="text-center py-4 text-muted small">
                            <p class="mb-0">No submissions yet. Be the first to attempt!</p>
                        </div>
                    <% } %>
                </div>
            </div>
        </div>
        <% } %>
    </div>
</div>

<script>
    function copyTestLink() {
        const testUrl = window.location.origin + '<%= request.getContextPath() %>/quiz?action=view&id=' + <%= quiz.getId() %>;
        navigator.clipboard.writeText(testUrl).then(() => {
            alert('Test share link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }
</script>

<% if (currentUser != null && ("Faculty".equals(currentUser.getRole()) || "Administrator".equals(currentUser.getRole()) || currentUser.getId() == quiz.getCreatorId())) { %>
<!-- Edit Quiz Modal -->
<div class="modal fade" id="editQuizModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-container border-0 p-4">
            <h5 class="fw-bold mb-3 text-start"><i class="fa-solid fa-pen-to-square me-2 text-primary"></i>Edit Test Settings</h5>
            <form action="<%= request.getContextPath() %>/quiz" method="post">
                <input type="hidden" name="action" value="edit">
                <input type="hidden" name="id" value="<%= quiz.getId() %>">
                
                <div class="mb-3 text-start">
                    <label class="form-label text-muted small fw-semibold">Test Title</label>
                    <input type="text" name="title" class="form-control form-control-glass" value="<%= quiz.getTitle() %>" required>
                </div>
                <div class="mb-3 text-start">
                    <label class="form-label text-muted small fw-semibold">Description</label>
                    <textarea name="description" class="form-control form-control-glass" rows="2"><%= quiz.getDescription() != null ? quiz.getDescription() : "" %></textarea>
                </div>
                <div class="row text-start mb-3">
                    <div class="col-6">
                        <label class="form-label text-muted small fw-semibold">Duration (minutes)</label>
                        <input type="number" name="duration" class="form-control form-control-glass" value="<%= quiz.getDurationMinutes() %>" required min="1">
                    </div>
                    <div class="col-6">
                        <label class="form-label text-muted small fw-semibold">Max Marks</label>
                        <input type="number" name="maxMarks" class="form-control form-control-glass" value="<%= quiz.getMaxMarks() %>" required min="1">
                    </div>
                </div>
                <div class="row text-start mb-4">
                    <div class="col-6">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="editShuffle" name="shuffle" value="true" <%= quiz.isShuffleQuestions() ? "checked" : "" %>>
                            <label class="form-check-label text-muted small" for="editShuffle">Shuffle Questions</label>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="editNegative" name="negativeMarking" value="true" <%= quiz.isNegativeMarking() ? "checked" : "" %>>
                            <label class="form-check-label text-muted small" for="editNegative">Negative Marking</label>
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass">Save Settings</button>
                </div>
            </form>
        </div>
    </div>
</div>
<% } %>

<%@ include file="/common/footer.jsp" %>
