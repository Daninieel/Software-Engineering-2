document.addEventListener('DOMContentLoaded', function () {
    // Hamburger menu
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (hamburger && sidebar) {
        hamburger.addEventListener('click', function () {
            sidebar.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('active');
            if (hamburger) hamburger.classList.remove('active');
        });
    }

    // Book Management Dropdown (works for both Admin and Librarian)
    const dropdownBtn = document.getElementById('bookManagementBtnLib') || document.getElementById('bookManagementBtnAdmin');
    const dropdownMenu = document.getElementById('bookManagementSubmenuLib') || document.getElementById('bookManagementSubmenuAdmin');

    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
            dropdownBtn.classList.toggle('active');
        };
    }
});