document.addEventListener('DOMContentLoaded', function () {
    const filterBtn = document.querySelector('.filter-btn, .btn-filter');
    const filterOptionsContainer = document.querySelector('.filter-options');
    const tableBody = document.querySelector('#inventoryTable tbody');
    const searchInput = document.getElementById('searchInput');

    if (filterBtn && filterOptionsContainer) {
        filterBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            filterOptionsContainer.classList.toggle('show');
        });

        document.addEventListener('click', function () {
            filterOptionsContainer.classList.remove('show');
        });
    }

    document.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', function () {
            const filterType = this.getAttribute('data-filter');
            const filterValue = this.getAttribute('data-value');
            const rows = Array.from(document.querySelectorAll('.book-row'));

            if (filterType === 'all') {
                rows.forEach(row => row.style.display = '');
            }
            else if (filterType === 'status') {
                rows.forEach(row => {
                    const rowStatus = row.getAttribute('data-status');
                    row.style.display = (rowStatus === filterValue) ? '' : 'none';
                });
            }
            else if (filterType === 'source') {
                rows.forEach(row => {
                    const rowSource = row.getAttribute('data-source');
                    row.style.display = (rowSource === filterValue) ? '' : 'none';
                });
            }
            else if (filterType === 'sort') {
                rows.sort((a, b) => {
                    let cellA = a.querySelector(`.${filterValue}-cell`)?.innerText.toLowerCase().trim() || "";
                    let cellB = b.querySelector(`.${filterValue}-cell`)?.innerText.toLowerCase().trim() || "";

                    if (!isNaN(cellA) && !isNaN(cellB) && cellA !== "" && cellB !== "") {
                        return parseFloat(cellA) - parseFloat(cellB);
                    }
                    return cellA.localeCompare(cellB);
                });
                rows.forEach(row => tableBody.appendChild(row));
            }

            if (filterOptionsContainer) {
                filterOptionsContainer.classList.remove('show');
            }
        });
    });

    if (searchInput) {
        searchInput.addEventListener('keyup', function () {
            const query = this.value.toLowerCase();
            document.querySelectorAll('.book-row').forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    const editBtn = document.getElementById('adminEditBtn') || document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', function () {
            const selected = document.querySelector('input[name="selectedBook"]:checked');
            const isAdmin = window.location.pathname.toLowerCase().includes("admin");

            if (selected) {
                window.location.href = `/Home/EditBook?id=${selected.value}&fromAdmin=${isAdmin}`;
            } else {
                alert("Please select a book to edit.");
            }
        });
    }
});