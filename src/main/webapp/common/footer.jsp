    </div> <!-- Row End -->
</div> <!-- Container End -->

<footer class="footer mt-auto py-3 bg-transparent text-center border-top border-divider" style="position: relative; z-index: 10;">
    <div class="container">
        <span class="text-muted" style="font-size: 0.85rem;">&copy; 2026 LearnX Platform. Built for Premium Academic Collaboration.</span>
    </div>
</footer>

<!-- Local Bootstrap 5 Bundle (includes Popper) -->
<script src="<%= request.getContextPath() %>/assets/lib/bootstrap/bootstrap.bundle.min.js"></script>
<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<!-- AOS Animation -->
<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>

<script>
    // Initialize animations
    AOS.init({
        duration: 800,
        once: true
    });

    // Theme Switcher Javascript Logic
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', targetTheme);
        localStorage.setItem('theme', targetTheme);
        updateThemeIcon(targetTheme);
    }

    function updateThemeIcon(theme) {
        const icon = document.getElementById('themeIcon');
        if (icon) {
            if (theme === 'dark') {
                icon.className = 'fa-solid fa-sun fs-5';
            } else {
                icon.className = 'fa-solid fa-moon fs-5';
            }
        }
    }

    // Init theme icon state on load
    document.addEventListener('DOMContentLoaded', () => {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        updateThemeIcon(theme);
    });
</script>
</body>
</html>
