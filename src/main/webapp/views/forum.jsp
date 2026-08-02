<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="java.util.Map" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    List<Map<String, Object>> threads = (List<Map<String, Object>>) request.getAttribute("threads");
    String className = (String) request.getAttribute("className");
%>

<!-- Forum Threaded Workspace -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <!-- Header -->
    <div class="glass-card mb-4">
        <h4 class="fw-bold mb-1"><i class="fa-solid fa-comments text-primary me-2"></i>Discussion Forum</h4>
        <p class="text-muted small mb-0">Ask questions, share references, and help fellow scholars in this classroom channel.</p>
    </div>

    <div class="row">
        <!-- Forum Feed (Left Column) -->
        <div class="col-md-8 mb-3">
            <!-- Create Thread Box -->
            <div class="glass-card mb-4">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-pen-nib text-primary me-2"></i>Start a new discussion thread</h6>
                <form action="<%= request.getContextPath() %>/community" method="post">
                    <input type="hidden" name="action" value="create_thread">
                    
                    <div class="mb-2">
                        <input type="text" name="title" class="form-control form-control-glass mb-2" placeholder="Subject / Query Title" required>
                        <textarea name="content" class="form-control form-control-glass" rows="3" placeholder="Explain your query clearly. You can choose to post anonymously below." required></textarea>
                    </div>

                    <div class="d-flex justify-content-between align-items-center pt-2">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" name="anonymous" value="true" id="anonCheck">
                            <label class="form-check-label text-muted small" for="anonCheck">Post Anonymously</label>
                        </div>
                        <button type="submit" class="btn btn-primary-glass px-4 btn-sm">Create Thread</button>
                    </div>
                </form>
            </div>

            <!-- Threads list -->
            <div class="forum-threads">
                <%
                    if (threads != null && !threads.isEmpty()) {
                        for (Map<String, Object> t : threads) {
                %>
                    <div class="glass-card">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="d-flex align-items-center">
                                <img src="<%= t.get("avatarPath") %>" alt="avatar" class="feed-avatar me-2" style="width: 32px; height: 32px;">
                                <div>
                                    <span class="fw-bold text-main small"><%= t.get("username") %></span>
                                    <small class="text-muted d-block" style="font-size: 0.75rem;"><%= t.get("createdAt") %></small>
                                </div>
                            </div>
                            <div>
                                <% if ((boolean)t.get("isPinned")) { %>
                                    <span class="badge bg-danger p-1.5"><i class="fa-solid fa-thumbtack me-1"></i>Pinned</span>
                                <% } %>
                                <% if ((boolean)t.get("isSolved")) { %>
                                    <span class="badge bg-success p-1.5"><i class="fa-solid fa-check me-1"></i>Solved</span>
                                <% } %>
                            </div>
                        </div>

                        <h6 class="fw-bold text-main mb-2"><%= t.get("title") %></h6>
                        <p class="text-muted small mb-3"><%= t.get("content") %></p>

                        <div class="border-top border-divider pt-2 mt-2 d-flex justify-content-between align-items-center text-muted small">
                            <span><i class="fa-regular fa-comment me-1"></i>Comments / Replies</span>
                            <a href="<%= request.getContextPath() %>/forum?action=thread&id=<%= t.get("id") %>" class="btn btn-sm btn-outline-primary border-0 p-1 px-3">Join Discussion <i class="fa-solid fa-chevron-right ms-1"></i></a>
                        </div>
                    </div>
                <%
                        }
                    } else {
                %>
                    <!-- Seed Thread Mock -->
                    <div class="glass-card">
                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <div class="d-flex align-items-center">
                                <img src="<%= request.getContextPath() %>/assets/images/default-avatar.png" alt="avatar" class="feed-avatar me-2" style="width: 32px; height: 32px;">
                                <div>
                                    <span class="fw-bold text-main small">student_john</span>
                                    <small class="text-muted d-block" style="font-size: 0.75rem;">2 hours ago</small>
                                </div>
                            </div>
                            <span class="badge bg-success p-1.5"><i class="fa-solid fa-check me-1"></i>Solved</span>
                        </div>

                        <h6 class="fw-bold text-main mb-2">Clarification on Uniform Cost Search vs A*</h6>
                        <p class="text-muted small mb-3">Can someone explain when Uniform Cost Search is equivalent to A* search? Is it when the heuristic is h(n) = 0?</p>

                        <div class="border-top border-divider pt-2 mt-2 d-flex justify-content-between align-items-center text-muted small">
                            <span><i class="fa-regular fa-comment-dots me-1"></i>1 Accepted Solution</span>
                            <a href="#" class="btn btn-sm btn-outline-primary border-0 p-1 px-3">Open Thread <i class="fa-solid fa-chevron-right ms-1"></i></a>
                        </div>
                    </div>
                <% } %>
            </div>
        </div>

        <!-- Sidebar Widgets (Right Column) -->
        <div class="col-md-4 mb-3">
            <div class="glass-card mb-3">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-fire text-danger me-2"></i>Trending Queries</h6>
                <ul class="list-unstyled small text-muted ps-0 mb-0">
                    <li class="mb-2"><a href="#" class="text-decoration-none text-muted">A* Admissibility Proof</a></li>
                    <li class="mb-2"><a href="#" class="text-decoration-none text-muted">Handling Multi-threading in Servlets</a></li>
                    <li class="mb-0"><a href="#" class="text-decoration-none text-muted">JDBC Connection Leaks</a></li>
                </ul>
            </div>
        </div>
    </div>
</div>

<%@ include file="/common/footer.jsp" %>
