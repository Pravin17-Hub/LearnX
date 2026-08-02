<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.Quiz" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    List<Quiz> publicQuizzes = (List<Quiz>) request.getAttribute("publicQuizzes");
%>

<!-- Public Tests Panel -->
<div class="<%= (currentUser != null) ? "col-md-9 col-sm-12" : "col-12" %> fade-in-up">
    <!-- Center Banner -->
    <div class="glass-container p-4 mb-4 text-white overflow-hidden" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);">
        <span class="badge bg-primary-glass text-primary px-3 py-1.5 mb-2 font-size-xs text-uppercase fw-bold"><i class="fa-solid fa-graduation-cap me-2"></i>Global Test Center</span>
        <h3 class="fw-bold mb-1 text-main">Public Academic Tests</h3>
        <p class="text-muted mb-0">Take combined evaluations, solve questions, and receive detailed AI grading and strengths/weaknesses reports instantly.</p>
    </div>

    <!-- Tests Grid -->
    <div class="row">
        <%
            if (publicQuizzes != null && !publicQuizzes.isEmpty()) {
                for (Quiz q : publicQuizzes) {
        %>
            <div class="col-md-6 mb-4">
                <div class="glass-card h-100 d-flex flex-column justify-content-between p-4 card-hover">
                    <div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge bg-success-glass text-success border-0 rounded-pill px-2.5 py-1 font-size-xs"><i class="fa-solid fa-clock me-1"></i><%= q.getDurationMinutes() %> Minutes</span>
                            <small class="text-muted fw-semibold"><%= q.getMaxMarks() %> Marks</small>
                        </div>

                        <h5 class="fw-bold text-main mb-2"><i class="fa-solid fa-clipboard-list text-primary me-2"></i><%= q.getTitle() %></h5>
                        <p class="text-muted font-size-sm mb-4 text-truncate-2"><%= (q.getDescription() != null && !q.getDescription().isEmpty()) ? q.getDescription() : "Comprehensive test covering subject principles." %></p>
                    </div>

                    <div class="d-flex align-items-center justify-content-between border-top border-divider pt-3 mt-3">
                        <small class="text-muted font-size-xs">Created by <b>@<%= q.getCreatorName() != null ? q.getCreatorName() : "Faculty" %></b></small>
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-secondary p-2 rounded-circle" onclick="copyPublicTestLink(<%= q.getId() %>)" title="Copy Test Link">
                                <i class="fa-solid fa-share-nodes"></i>
                            </button>
                            <a href="<%= request.getContextPath() %>/quiz?action=view&id=<%= q.getId() %>" class="btn btn-sm btn-primary-glass px-3 rounded-pill">
                                <i class="fa-solid fa-play me-1"></i>Begin
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        <%
                }
            } else {
        %>
            <div class="col-12 text-center py-5">
                <div class="p-4 rounded-4 glass-card d-inline-block">
                    <i class="fa-solid fa-clipboard-question text-muted fs-1 mb-3"></i>
                    <h5 class="fw-bold text-main mb-1">No Public Tests</h5>
                    <p class="text-muted small mb-0">No public evaluations have been shared yet. Check back soon!</p>
                </div>
            </div>
        <% } %>
    </div>
</div>

<script>
    function copyPublicTestLink(qId) {
        const testUrl = window.location.origin + '<%= request.getContextPath() %>/quiz?action=view&id=' + qId;
        navigator.clipboard.writeText(testUrl).then(() => {
            alert('Test share link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy test link: ', err);
        });
    }
</script>

<%@ include file="/common/footer.jsp" %>
