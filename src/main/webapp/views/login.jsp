<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LearnX – AI-Powered Collaborative Learning Platform</title>
    <!-- Local Bootstrap 5 CSS -->
    <link href="<%= request.getContextPath() %>/assets/lib/bootstrap/bootstrap.min.css" rel="stylesheet">
    <!-- Local Font Awesome -->
    <link href="<%= request.getContextPath() %>/assets/lib/fontawesome/all.min.css" rel="stylesheet">
    <!-- Custom Style -->
    <link href="<%= request.getContextPath() %>/assets/css/index.css" rel="stylesheet">
    
    <style>
        body {
            background: radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.05) 0%, rgba(79, 70, 229, 0.05) 90.1%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-card {
            max-width: 500px;
            width: 90%;
            border-radius: 24px;
            padding: 2.5rem;
        }
        .form-control-glass {
            background: rgba(255, 255, 255, 0.4);
            border: 1px solid var(--card-border);
            border-radius: 12px;
            padding: 0.75rem 1rem;
            color: var(--text-main);
            transition: all 0.3s ease;
        }
        .form-control-glass:focus {
            background: rgba(255, 255, 255, 0.8);
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        [data-theme="dark"] .form-control-glass {
            background: rgba(15, 23, 42, 0.4);
        }
        [data-theme="dark"] .form-control-glass:focus {
            background: rgba(15, 23, 42, 0.8);
        }
        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-weight: 600;
            padding-bottom: 8px;
            border-bottom: 2px solid transparent;
            transition: all 0.3s ease;
        }
        .tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
        }
    </style>
</head>
<body>

<div class="glass-container login-card text-center fade-in-up">
    <!-- Brand Info -->
    <h3 class="fw-bold mb-1 text-primary" style="font-family: 'Poppins', sans-serif;">
        <i class="fa-solid fa-graduation-cap me-2 text-primary"></i>LearnX
    </h3>
    <p class="text-muted mb-4" style="font-size: 0.9rem;">Enterprise Collaborative Learning Ecosystem</p>

    <!-- Error/Success Alerts -->
    <% if (request.getParameter("error") != null) { %>
        <div class="alert alert-danger border-0 rounded-3 text-start p-2.5" style="font-size: 0.85rem;" role="alert">
            <i class="fa-solid fa-triangle-exclamation me-2"></i>
            <% if ("invalid_credentials".equals(request.getParameter("error"))) { %>
                Invalid email/username or password.
            <% } else if ("username_taken".equals(request.getParameter("error"))) { %>
                Username is already taken. Please choose a different username.
            <% } else if ("invalid_email".equals(request.getParameter("error"))) { %>
                Please enter a valid email address.
            <% } else { %>
                An error occurred. Please try again.
            <% } %>
        </div>
    <% } %>

    <% if (request.getParameter("success") != null) { %>
        <div class="alert alert-success border-0 rounded-3 text-start p-2.5" style="font-size: 0.85rem;" role="alert">
            <i class="fa-solid fa-circle-check me-2"></i>
            <% if ("registered".equals(request.getParameter("success"))) { %>
                Registration successful! You can now log in.
            <% } else if ("otp_sent".equals(request.getParameter("success"))) { %>
                OTP sent successfully to <%= request.getParameter("email") %>. (Mock verified)
            <% } %>
        </div>
    <% } %>

    <!-- Tabs Toggle -->
    <div class="d-flex justify-content-center mb-4">
        <button class="tab-btn active me-4" id="loginTab" onclick="switchForm('login')">Sign In</button>
        <button class="tab-btn" id="registerTab" onclick="switchForm('register')">Register</button>
    </div>

    <!-- Login Form -->
    <form id="loginForm" action="<%= request.getContextPath() %>/auth" method="post">
        <input type="hidden" name="action" value="login">
        
        <div class="mb-3 text-start">
            <label class="form-label text-muted small fw-semibold">Username or Email</label>
            <input type="text" name="identifier" class="form-control form-control-glass" placeholder="e.g. john_doe" required>
        </div>
        
        <div class="mb-4 text-start">
            <label class="form-label text-muted small fw-semibold">Password</label>
            <input type="password" name="password" class="form-control form-control-glass" placeholder="••••••••" required>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-4">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="rememberMe" name="remember">
                <label class="form-check-label text-muted small" for="rememberMe">Remember Me</label>
            </div>
            <a href="#" class="text-primary small text-decoration-none" onclick="switchForm('forgot')">Forgot Password?</a>
        </div>

        <button type="submit" class="btn btn-primary-glass w-100 py-2.5">Sign In</button>
    </form>

    <!-- Register Form -->
    <form id="registerForm" action="<%= request.getContextPath() %>/auth" method="post" enctype="multipart/form-data" class="d-none">
        <input type="hidden" name="action" value="register">
        
        <div class="row g-2 mb-3">
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Full Name</label>
                <input type="text" name="name" class="form-control form-control-glass" placeholder="John Doe" required>
            </div>
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Register Number</label>
                <input type="text" name="regNo" class="form-control form-control-glass" placeholder="e.g. 2026CS101" required>
            </div>
        </div>

        <div class="row g-2 mb-3">
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Username</label>
                <input type="text" name="username" class="form-control form-control-glass" placeholder="student_john" required>
            </div>
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Role</label>
                <select name="role" class="form-select form-control-glass" required>
                    <option value="Student">Student</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Teaching Assistant">Teaching Assistant</option>
                    <option value="Mentor">Mentor</option>
                </select>
            </div>
        </div>

        <div class="row g-2 mb-3">
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Email Address</label>
                <input type="email" name="email" class="form-control form-control-glass" placeholder="john.doe@mit.edu" pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" required>
            </div>
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Profile Picture</label>
                <input type="file" name="avatar_file" class="form-control form-control-glass" accept="image/*">
            </div>
        </div>

        <div class="mb-3 text-start">
            <label class="form-label text-muted small fw-semibold">Password</label>
            <input type="password" name="password" class="form-control form-control-glass" placeholder="Minimum 6 characters" required>
        </div>

        <div class="row g-2 mb-4">
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Institution</label>
                <input type="text" name="institution" class="form-control form-control-glass" placeholder="e.g. MIT">
            </div>
            <div class="col-6 text-start">
                <label class="form-label text-muted small fw-semibold">Department</label>
                <input type="text" name="department" class="form-control form-control-glass" placeholder="e.g. CS">
            </div>
        </div>

        <button type="submit" class="btn btn-primary-glass w-100 py-2.5">Create Account</button>
    </form>

    <!-- Forgot Password Form -->
    <form id="forgotForm" action="<%= request.getContextPath() %>/auth" method="post" class="d-none text-start">
        <input type="hidden" name="action" value="forgot">
        <p class="text-muted mb-4 small">Enter your email address to receive an OTP verification code.</p>
        
        <div class="mb-4">
            <label class="form-label text-muted small fw-semibold">Email Address</label>
            <input type="email" name="email" class="form-control form-control-glass" placeholder="john.doe@mit.edu" required>
        </div>

        <button type="submit" class="btn btn-primary-glass w-100 py-2.5 mb-3">Send OTP</button>
        <a href="#" class="text-muted small text-decoration-none d-block text-center" onclick="switchForm('login')"><i class="fa-solid fa-arrow-left me-1"></i>Back to Sign In</a>
    </form>

</div>

<script>
    function switchForm(formName) {
        // Forms
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotForm = document.getElementById('forgotForm');
        
        // Tabs
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');

        // Hide all
        loginForm.classList.add('d-none');
        registerForm.classList.add('d-none');
        forgotForm.classList.add('d-none');
        
        loginTab.classList.remove('active');
        registerTab.classList.remove('active');

        if (formName === 'login') {
            loginForm.classList.remove('d-none');
            loginTab.classList.add('active');
        } else if (formName === 'register') {
            registerForm.classList.remove('d-none');
            registerTab.classList.add('active');
        } else if (formName === 'forgot') {
            forgotForm.classList.remove('d-none');
        }
    }
</script>

</body>
</html>
