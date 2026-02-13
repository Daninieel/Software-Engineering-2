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

document.addEventListener('DOMContentLoaded', function () {
    // Get searchQuery parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('searchQuery');

    if (searchQuery) {
        // Find the search input on the page
        const searchInput = document.querySelector('.search-filter input');

        if (searchInput) {
            // Set the search query value
            searchInput.value = searchQuery;

            // Trigger input event to activate search/filter
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));

            // Optional: Focus the input
            searchInput.focus();
        }
    }
});