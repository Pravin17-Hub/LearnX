<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.User" %>
<%@ page import="com.learnx.model.Material" %>
<%@ page import="com.learnx.model.Classroom" %>
<%@ page import="com.learnx.dao.ClassroomDAO" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    List<Material> materials = (List<Material>) request.getAttribute("materials");
    ClassroomDAO classroomDAO = new ClassroomDAO();
    List<Classroom> myClassrooms = null;
    if (currentUser != null) {
        myClassrooms = classroomDAO.getClassroomsForUser(currentUser.getId());
    }
%>

<!-- Resource Center Dashboard -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <!-- Header Hero Banner -->
    <div class="glass-container p-4 mb-4 text-white overflow-hidden position-relative" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);">
        <div class="row align-items-center">
            <div class="col-md-8">
                <span class="badge bg-primary-glass text-primary px-3 py-2 mb-2 font-size-xs text-uppercase fw-bold" style="letter-spacing: 1px;"><i class="fa-solid fa-cloud-arrow-up me-2"></i>Global Knowledge Hub</span>
                <h2 class="fw-bold mb-2 text-main">Academic Resource Center</h2>
                <p class="text-muted mb-0">Browse crowd-sourced lecture notes, course materials, video lectures, and project templates. Contribute your own to earn academic reputation points!</p>
            </div>
            <div class="col-md-4 text-md-end mt-3 mt-md-0">
                <% if (currentUser != null) { %>
                    <button class="btn btn-primary-glass px-4 py-2.5 rounded-pill shadow" data-bs-toggle="modal" data-bs-target="#uploadResourceModal">
                        <i class="fa-solid fa-plus me-2"></i>Share Resource
                    </button>
                <% } else { %>
                    <a href="<%= request.getContextPath() %>/views/login.jsp" class="btn btn-primary-glass px-4 py-2.5 rounded-pill shadow">
                        <i class="fa-solid fa-right-to-bracket me-2"></i>Login to Share
                    </a>
                <% } %>
            </div>
        </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="glass-card mb-4 p-3">
        <div class="row g-3">
            <div class="col-md-5">
                <div class="input-group">
                    <span class="input-group-text bg-transparent border-0 pe-0 text-muted"><i class="fa-solid fa-magnifying-glass"></i></span>
                    <input type="text" id="searchInput" class="form-control form-control-glass border-0" placeholder="Search by title, topic, or keyword..." onkeyup="filterResources()">
                </div>
            </div>
            <div class="col-md-3">
                <select id="categoryFilter" class="form-select form-control-glass border-0 text-muted" onchange="filterResources()">
                    <option value="All">All Categories</option>
                    <option value="Notes">Lecture Notes</option>
                    <option value="Video">Video Guides</option>
                    <option value="Syllabus">Curriculum / Syllabus</option>
                    <option value="Project">Project Repositories</option>
                </select>
            </div>
            <div class="col-md-2">
                <select id="difficultyFilter" class="form-select form-control-glass border-0 text-muted" onchange="filterResources()">
                    <option value="All">All Difficulty</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                </select>
            </div>
            <div class="col-md-2 d-grid">
                <button class="btn btn-light bg-transparent border border-divider text-muted rounded-3" onclick="resetFilters()">
                    Reset
                </button>
            </div>
        </div>
    </div>

    <!-- Resources Grid -->
    <div class="row" id="resourcesContainer">
        <%
            if (materials != null && !materials.isEmpty()) {
                for (Material m : materials) {
                    String badgeClass = "bg-success-subtle text-success";
                    if ("Intermediate".equalsIgnoreCase(m.getDifficulty())) {
                        badgeClass = "bg-warning-subtle text-warning";
                    } else if ("Advanced".equalsIgnoreCase(m.getDifficulty())) {
                        badgeClass = "bg-danger-subtle text-danger";
                    }

                    // Choose file icon based on extension
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
                    } else if ("png".equals(ft) || "jpg".equals(ft) || "jpeg".equals(ft)) {
                        iconClass = "fa-file-image text-success";
                    }
        %>
            <div class="col-md-6 mb-4 resource-item" 
                 data-title="<%= m.getTitle().toLowerCase() %>" 
                 data-topic="<%= m.getTopic().toLowerCase() %>"
                 data-category="<%= m.getCategory() %>"
                 data-difficulty="<%= m.getDifficulty() %>">
                <div class="glass-card h-100 d-flex flex-column justify-content-between p-4 card-hover">
                    <div>
                        <!-- Category Badge and Options -->
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge bg-primary-subtle text-primary border-0 rounded-pill px-2.5 py-1 font-size-xs"><%= m.getCategory() %></span>
                            <span class="badge <%= badgeClass %> border-0 rounded-pill px-2.5 py-1 font-size-xs"><%= m.getDifficulty() %></span>
                        </div>

                        <!-- Title and Icon -->
                        <div class="d-flex align-items-start gap-3 mb-2">
                            <div class="p-2.5 bg-light rounded-3 shadow-sm">
                                <i class="fa-solid <%= iconClass %> fs-4"></i>
                            </div>
                            <div>
                                <h5 class="fw-bold text-main mb-1"><%= m.getTitle() %></h5>
                                <small class="text-accent small d-block"><i class="fa-solid fa-hashtag me-1"></i>Topic: <%= m.getTopic() %></small>
                            </div>
                        </div>

                        <!-- Description -->
                        <p class="text-muted font-size-sm mt-3 mb-4"><%= m.getDescription() %></p>
                    </div>

                    <div>
                        <!-- Author Metadata -->
                        <div class="d-flex justify-content-between align-items-center border-top border-divider pt-3">
                            <div class="d-flex align-items-center gap-2">
                                <i class="fa-regular fa-user text-muted"></i>
                                <span class="font-size-xs text-muted">
                                    Shared by 
                                    <a href="<%= request.getContextPath() %>/@<%= m.getUploaderName() %>" class="text-decoration-none fw-bold text-main">
                                        @<%= m.getUploaderName() %>
                                    </a>
                                </span>
                            </div>
                            <div class="d-flex gap-2">
                                <a href="<%= request.getContextPath() %>/resources?action=download&id=<%= m.getId() %>" class="btn btn-sm btn-primary-glass px-3 rounded-pill" title="Download Resource">
                                    <i class="fa-solid fa-download me-1"></i><%= m.getDownloads() %>
                                </a>
                            </div>
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
                    <i class="fa-solid fa-folder-open text-muted fs-1 mb-3"></i>
                    <h5 class="fw-bold text-main mb-1">Library is Empty</h5>
                    <p class="text-muted small mb-0">Be the first to share study guides, syllabus documents, or templates!</p>
                </div>
            </div>
        <% } %>
    </div>
</div>

<!-- ==========================================
      UPLOAD RESOURCE MODAL
========================================== -->
<% if (currentUser != null) { %>
<div class="modal fade" id="uploadResourceModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-container border-0 p-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold mb-0 text-main"><i class="fa-solid fa-cloud-arrow-up me-2 text-primary"></i>Share Study Material</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            
            <form action="<%= request.getContextPath() %>/resources" method="post" enctype="multipart/form-data">
                <input type="hidden" name="action" value="upload">
                
                <div class="row">
                    <div class="col-md-8 mb-3">
                        <label class="form-label text-muted small fw-semibold">Resource Title</label>
                        <input type="text" name="title" class="form-control form-control-glass" placeholder="e.g. Introduction to Dynamic Programming" required>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label text-muted small fw-semibold">Category</label>
                        <select name="category" class="form-select form-control-glass" required>
                            <option value="Notes">Lecture Notes</option>
                            <option value="Video">Video Guide</option>
                            <option value="Syllabus">Curriculum / Syllabus</option>
                            <option value="Project">Project Repo</option>
                        </select>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label text-muted small fw-semibold">Short Description</label>
                    <textarea name="description" class="form-control form-control-glass" rows="2" placeholder="Briefly describe what this study material covers..." required></textarea>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Subject / Topic Tag</label>
                        <input type="text" name="topic" class="form-control form-control-glass" placeholder="e.g. Data Structures, Web Technology" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Difficulty Level</label>
                        <select name="difficulty" class="form-select form-control-glass" required>
                            <option value="Beginner">Beginner (Foundation)</option>
                            <option value="Intermediate">Intermediate (Intermediate)</option>
                            <option value="Advanced">Advanced (Advanced / Specialized)</option>
                        </select>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Link to Classroom (Optional)</label>
                        <select name="classroomId" class="form-select form-control-glass">
                            <option value="">None (Global Library Only)</option>
                            <%
                                if (myClassrooms != null && !myClassrooms.isEmpty()) {
                                    for (Classroom c : myClassrooms) {
                            %>
                                <option value="<%= c.getId() %>"><%= c.getClassName() %> (<%= c.getSubject() %>)</option>
                            <%
                                    }
                                }
                            %>
                        </select>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Select File</label>
                        <input type="file" name="resourceFile" class="form-control form-control-glass" required>
                    </div>
                </div>

                <!-- Gamification Note -->
                <div class="p-3 rounded-4 bg-primary-glass border border-primary-subtle mb-4">
                    <div class="d-flex gap-2">
                        <i class="fa-solid fa-circle-info text-primary mt-0.5"></i>
                        <div>
                            <span class="fw-bold d-block text-main font-size-sm">LearnX Contribution Mechanics</span>
                            <small class="text-muted font-size-xs">Every resource you upload grants you **+15 contribution points** instantly and secures your daily learning streak. Verified/high-download assets multiply points!</small>
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass px-4">Upload and Share</button>
                </div>
            </form>
        </div>
    </div>
</div>
<% } %>

<!-- JavaScript Filters -->
<script>
    function filterResources() {
        const query = document.getElementById('searchInput').value.toLowerCase().trim();
        const category = document.getElementById('categoryFilter').value;
        const difficulty = document.getElementById('difficultyFilter').value;
        
        const items = document.querySelectorAll('.resource-item');
        
        items.forEach(item => {
            const title = item.getAttribute('data-title');
            const topic = item.getAttribute('data-topic');
            const itemCat = item.getAttribute('data-category');
            const itemDiff = item.getAttribute('data-difficulty');
            
            const matchSearch = title.includes(query) || topic.includes(query);
            const matchCategory = (category === 'All') || (itemCat === category);
            const matchDifficulty = (difficulty === 'All') || (itemDiff === difficulty);
            
            if (matchSearch && matchCategory && matchDifficulty) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    function resetFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('categoryFilter').value = 'All';
        document.getElementById('difficultyFilter').value = 'All';
        filterResources();
    }
</script>

<%@ include file="/common/footer.jsp" %>
