document.addEventListener('DOMContentLoaded', function() {
    const filterBtn = document.getElementById('filterBtn');
    const filterOptions = document.getElementById('filterOptions');

    if (filterBtn && filterOptions) {
        // Toggle dropdown
        filterBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            filterOptions.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!filterBtn.contains(e.target) && !filterOptions.contains(e.target)) {
                filterOptions.classList.remove('show');
            }
        });

        // Handle filter option selection
        const options = filterOptions.querySelectorAll('.filter-option');
        options.forEach(option => {
            option.addEventListener('click', function() {
                filterBtn.textContent = this.textContent;
                filterOptions.classList.remove('show');
                
                // Logic for filtering can be added here
                console.log("Selected Filter:", this.textContent);
            });
        });
    }
});