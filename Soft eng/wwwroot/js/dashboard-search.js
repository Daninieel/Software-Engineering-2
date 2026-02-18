document.addEventListener('DOMContentLoaded', function () {
    setupDashboardSearch();
});

function setupDashboardSearch() {
    const searchInputs = document.querySelectorAll('input[placeholder*="Search"], input[placeholder*="search"]');

    searchInputs.forEach(input => {
        // Only add to inputs in search-filter containers on Dashboard
        if (input.closest('.dashboard-header') || input.closest('.search-filter-container')) {
            // Enter key handler
            input.addEventListener('keypress', function (event) {
                if (event.key === 'Enter') {
                    performDashboardSearch(this.value);
                }
            });

            // Autocomplete selection handler
            input.addEventListener('suggestionSelected', function (event) {
                performDashboardSearch(event.detail.suggestion);
            });
        }
    });
}

function performDashboardSearch(query) {
    if (!query || query.trim() === '') {
        alert('Please enter a search query');
        return;
    }

    // Determine if this is admin or regular page
    const isAdmin = window.location.pathname.toLowerCase().includes('admin') ||
        document.querySelector('.sidebar.admin') !== null;

    // Redirect to GlobalSearch instead of SearchBooks
    const searchUrl = `/Dashboard/GlobalSearch?query=${encodeURIComponent(query)}&fromAdmin=${isAdmin}`;
    window.location.href = searchUrl;
}

// Keep the existing page transition code
$(document).ready(function () {
    $('a:not([target="_blank"]):not([href^="#"]):not([data-no-transition])').on('click', function (e) {
        var href = $(this).attr('href');
        if (href && !href.startsWith('http') && href !== '#' && !href.startsWith('javascript')) {
            e.preventDefault();
            $('.page-content').css({
                'opacity': '0',
                'transform': 'translateY(-10px)',
                'transition': 'all 0.25s ease-in'
            });
            setTimeout(function () {
                window.location.href = href;
            }, 250);
        }
    });
});