<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.Classroom" %>
<%@ page import="com.learnx.model.User" %>
<%@ page import="com.learnx.model.Assignment" %>
<%@ page import="com.learnx.model.Quiz" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<!-- Main Dashboard Workspace -->
<div class="<%= (currentUser != null) ? "col-md-9 col-sm-12" : "col-12" %> fade-in-up">
    <!-- Quick Welcome Header -->
    <div class="glass-card d-flex justify-content-between align-items-center mb-4">
        <div>
            <h4 class="fw-bold mb-1" style="font-family: 'Poppins', sans-serif;">
                Welcome back, <%= currentUser.getUsername() %>!
            </h4>
            <p class="text-muted mb-0" style="font-size: 0.9rem;">
                Here is a summary of your academic ecosystem today.
            </p>
        </div>
        <div>
            <% if ("Faculty".equals(currentUser.getRole()) || "Administrator".equals(currentUser.getRole())) { %>
                <button class="btn btn-primary-glass" data-bs-toggle="modal" data-bs-target="#createClassModal">
                    <i class="fa-solid fa-plus me-2"></i>Create Classroom
                </button>
            <% } else { %>
                <button class="btn btn-primary-glass" data-bs-toggle="modal" data-bs-target="#joinClassModal">
                    <i class="fa-solid fa-arrow-right-to-bracket me-2"></i>Join Classroom
                </button>
            <% } %>
        </div>
    </div>


    <!-- Classrooms Grid -->
    <div class="mb-5">
        <h5 class="fw-bold mb-3"><i class="fa-solid fa-book-bookmark text-primary me-2"></i>My Classrooms</h5>
        <div class="row">
            <% 
                List<Classroom> classrooms = (List<Classroom>) request.getAttribute("classrooms");
                if (classrooms != null && !classrooms.isEmpty()) {
                    for (Classroom c : classrooms) {
            %>
                <div class="col-md-4 col-sm-6 mb-3">
                    <div class="glass-card h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="badge role-badge"><%= c.getSubject() %></span>
                                <small class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem;">Code: <%= c.getJoinCode() %></small>
                            </div>
                            <h6 class="fw-bold mb-2"><%= c.getClassName() %></h6>
                            <p class="text-muted mb-3 text-truncate-2" style="font-size: 0.8rem; height: 36px; overflow: hidden;"><%= c.getDescription() %></p>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-divider">
                            <span class="small text-muted"><i class="fa-regular fa-user me-1"></i><%= c.getCreatorName() %></span>
                            <a href="<%= request.getContextPath() %>/classroom?id=<%= c.getId() %>" class="btn btn-sm btn-primary-glass">Enter</a>
                        </div>
                    </div>
                </div>
            <% 
                    }
                } else {
            %>
                <div class="col-12 text-center py-4">
                    <div class="glass-card text-muted">
                        <i class="fa-solid fa-cubes fs-2 mb-2 text-muted"></i>
                        <p class="mb-0">You are not registered in any classrooms yet.</p>
                    </div>
                </div>
            <% } %>
        </div>
    </div>

    <!-- Upcoming Tasks & Quizzes -->
    <div class="row">
        <!-- Assignments -->
        <div class="col-md-6 mb-3">
            <div class="glass-container p-4 h-100">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-contract text-primary me-2"></i>Active Assignments</h5>
                <%
                    List<Assignment> pending = (List<Assignment>) request.getAttribute("pendingAssignments");
                    if (pending != null && !pending.isEmpty()) {
                        for (Assignment a : pending) {
                %>
                    <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-divider">
                        <div>
                            <h6 class="fw-bold mb-0" style="font-size: 0.9rem;"><%= a.getTitle() %></h6>
                            <small class="text-danger">Deadline: <%= a.getDeadline() %></small>
                        </div>
                        <a href="<%= request.getContextPath() %>/assignment?id=<%= a.getId() %>" class="btn btn-sm btn-outline-primary border-0"><i class="fa-solid fa-chevron-right"></i></a>
                    </div>
                <%
                        }
                    } else {
                %>
                    <p class="text-muted small">No upcoming deadlines.</p>
                <% } %>
            </div>
        </div>

        <!-- Quizzes -->
        <div class="col-md-6 mb-3">
            <div class="glass-container p-4 h-100">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-question text-accent me-2"></i>Quizzes & Exams</h5>
                <%
                    List<Quiz> quizzes = (List<Quiz>) request.getAttribute("activeQuizzes");
                    if (quizzes != null && !quizzes.isEmpty()) {
                        for (Quiz q : quizzes) {
                %>
                    <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-divider">
                        <div>
                            <h6 class="fw-bold mb-0" style="font-size: 0.9rem;"><%= q.getTitle() %></h6>
                            <small class="text-muted">Duration: <%= q.getDurationMinutes() %> min | Max Score: <%= q.getMaxMarks() %></small>
                        </div>
                        <a href="<%= request.getContextPath() %>/quiz?action=view&id=<%= q.getId() %>" class="btn btn-sm btn-outline-primary border-0"><i class="fa-solid fa-chevron-right"></i></a>
                    </div>
                <%
                        }
                    } else {
                %>
                    <p class="text-muted small">No active quizzes.</p>
                <% } %>
            </div>
        </div>
    </div>
</div>

<!-- ==========================================
      MODALS
========================================== -->

<!-- Create Class Modal -->
<div class="modal fade" id="createClassModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-container border-0 p-4">
            <h5 class="fw-bold mb-3"><i class="fa-solid fa-chalkboard-user me-2 text-primary"></i>Create New Classroom</h5>
            <form action="<%= request.getContextPath() %>/classroom" method="post">
                <input type="hidden" name="action" value="create">
                
                <div class="mb-3">
                    <label class="form-label text-muted small fw-semibold">Classroom Name</label>
                    <input type="text" name="className" class="form-control form-control-glass" placeholder="e.g. Advanced Compiler Design" required>
                </div>
                <div class="mb-3">
                    <label class="form-label text-muted small fw-semibold">Subject / Field</label>
                    <input type="text" name="subject" class="form-control form-control-glass" placeholder="e.g. CS, AI, Math" required>
                </div>
                <div class="mb-4">
                    <label class="form-label text-muted small fw-semibold">Description</label>
                    <textarea name="description" class="form-control form-control-glass" rows="3" placeholder="Brief outline of the course syllabus..."></textarea>
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass">Create</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Join Class Modal -->
<div class="modal fade" id="joinClassModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-container border-0 p-4">
            <h5 class="fw-bold mb-3"><i class="fa-solid fa-arrow-right-to-bracket me-2 text-primary"></i>Join Classroom</h5>
            <form action="<%= request.getContextPath() %>/classroom" method="post">
                <input type="hidden" name="action" value="join">
                
                <div class="mb-4">
                    <label class="form-label text-muted small fw-semibold">Classroom Join Code</label>
                    <input type="text" name="joinCode" class="form-control form-control-glass text-center fs-4 fw-bold" placeholder="e.g. ART4569" style="letter-spacing: 2px;" required>
                    <small class="text-muted d-block mt-2">Ask your instructor for the 7-character code or scan their QR code.</small>
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass">Join</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Analytics Chart removed -->

<%@ include file="/common/footer.jsp" %>
