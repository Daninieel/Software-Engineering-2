document.addEventListener('DOMContentLoaded', function () {

    // --- Helper function to setup a dropdown ---
    function setupDropdown(btnId, submenuId) {
        const btn = document.getElementById(btnId);
        const submenu = document.getElementById(submenuId);

        if (btn && submenu) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                // Toggle visibility
                submenu.classList.toggle('show');
                // Toggle arrow rotation
                btn.classList.toggle('active');
            });
        }
    }



    // Initialize Admin Dropdown
    setupDropdown('bookManagementBtnAdmin', 'bookManagementSubmenuAdmin');

    // Initialize Librarian Dropdown
    setupDropdown('bookManagementBtnLib', 'bookManagementSubmenuLib');

    // ... existing filter dropdown code ...
});
document.addEventListener('DOMContentLoaded', function () {
    // Support multiple filter dropdowns on the page and ensure visual toggle works even if CSS is missing
    // Initialize each .filter-dropdown on the page
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        const filterBtn = dropdown.querySelector('.filter-btn');
        const filterOptions = dropdown.querySelector('.filter-options');

        if (!filterBtn || !filterOptions) return;

        // ensure options are initially hidden
        filterOptions.style.display = 'none';

        // Toggle this dropdown
        filterBtn.addEventListener('click', function(e) {
            e.stopPropagation();

            // Close other open dropdowns
            document.querySelectorAll('.filter-dropdown .filter-options').forEach(opt => {
                if (opt !== filterOptions) {
                    opt.classList.remove('show');
                    opt.style.display = 'none';
                }
            });

            const isShown = filterOptions.classList.toggle('show');
            filterOptions.style.display = isShown ? 'block' : 'none';
        });

        // Handle option selection for this dropdown
        const options = filterOptions.querySelectorAll('.filter-option');
        options.forEach(option => {
            option.addEventListener('click', function() {
                // If button has both btn-filter and filter-btn classes keep btn-filter style
                filterBtn.textContent = this.textContent;
                filterOptions.classList.remove('show');
                filterOptions.style.display = 'none';

                // Add filter logic here if needed
                console.log('Selected Filter:', this.textContent);
            });
        });
    });

    // Close all dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        document.querySelectorAll('.filter-dropdown .filter-options.show').forEach(opt => {
            if (!opt.contains(e.target)) {
                opt.classList.remove('show');
                opt.style.display = 'none';
            }
        });
    });
});

