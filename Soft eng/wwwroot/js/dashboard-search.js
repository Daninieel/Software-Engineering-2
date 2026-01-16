document.addEventListener('DOMContentLoaded', function() {
    setupDashboardSearch();
});

function setupDashboardSearch() {
    const searchInputs = document.querySelectorAll('input[placeholder*="Search"], input[placeholder*="search"]');
    
    searchInputs.forEach(input => {
        // Only add to inputs in search-filter containers on Dashboard
        if (input.closest('.dashboard-header') || input.closest('.search-filter-container')) {
            input.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    performDashboardSearch(this.value);
                }
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
    
    // Redirect to SearchBooks with query parameter
    const searchUrl = `/Home/SearchBooks?query=${encodeURIComponent(query)}&fromAdmin=${isAdmin}`;
    window.location.href = searchUrl;
}
