
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
            const currentRows = Array.from(document.querySelectorAll('.book-row'));

            if (filterType === 'all') {
                currentRows.forEach(row => row.style.display = '');
            }
            else if (filterType === 'status') {
                currentRows.forEach(row => {
                    const rowStatus = row.getAttribute('data-status');
                    row.style.display = (rowStatus === filterValue) ? '' : 'none';
                });
            }
            else if (filterType === 'source') {
                currentRows.forEach(row => {
                    const rowSource = row.getAttribute('data-source');
                    row.style.display = (rowSource === filterValue) ? '' : 'none';
                });
            }
            else if (filterType === 'sort') {
                currentRows.sort((a, b) => {
                    let cellA = a.querySelector(`.${filterValue}-cell`)?.innerText.toLowerCase().trim() || "";
                    let cellB = b.querySelector(`.${filterValue}-cell`)?.innerText.toLowerCase().trim() || "";

                    if (!isNaN(cellA) && !isNaN(cellB) && cellA !== "" && cellB !== "") {
                        return parseFloat(cellA) - parseFloat(cellB);
                    }
                    return cellA.localeCompare(cellB);
                });
                currentRows.forEach(row => tableBody.appendChild(row));
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

    tableBody.addEventListener('click', function (e) {
        const row = e.target.closest('.book-row');
        if (!row) return;
        if (e.target.closest('a') || e.target.closest('button')) return;

        document.querySelectorAll('.book-row').forEach(r => r.classList.remove('selected-row'));

        row.classList.add('selected-row');

        const radio = row.querySelector('input[name="selectedBook"]');
        if (radio) {
            radio.checked = true;
        }
    });

    const editBtn = document.getElementById('adminEditBtn') || document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', function () {
            const selected = document.querySelector('input[name="selectedBook"]:checked');
            const isAdmin = !!document.getElementById('adminEditBtn') || window.location.pathname.toLowerCase().includes("admin");

            if (selected) {
                window.location.href = `/Home/EditBook?id=${selected.value}&fromAdmin=${isAdmin}`;
            } else {
                alert("Please select a book to edit.");
            }
        });
    }

    const rowsPerPage = 10;
    let rows = Array.from(tableBody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        const idA = parseInt(a.cells[0].innerText.trim()) || 0;
        const idB = parseInt(b.cells[0].innerText.trim()) || 0;
        return idB - idA;
    });

    rows.forEach(row => tableBody.appendChild(row));
  }
    }

    const pageList = document.querySelector('.page-list');
    const gotoInput = document.querySelector('.goto-input');
    const navArrows = document.querySelectorAll('.nav-arrow');
    const prevBtn = navArrows[0];
    const nextBtn = navArrows[1];

    let currentPage = 1;
    const totalPages = Math.ceil(rows.length / rowsPerPage);

    function displayPage(page) {
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;

        rows.forEach(row => row.style.display = 'none');

        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        rows.slice(start, end).forEach(row => row.style.display = '');

        updatePaginationUI();
    }

    function updatePaginationUI() {
        if (!pageList) return;
        pageList.innerHTML = '';

        let pagesToShow = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
        } else {
            if (currentPage <= 4) {
                pagesToShow = [1, 2, 3, 4, 5, '...', totalPages];
            } else if (currentPage >= totalPages - 3) {
                pagesToShow = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                pagesToShow = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
            }
        }

        pagesToShow.forEach(p => {
            const li = document.createElement('li');
            if (p === '...') {
                li.innerHTML = `<span class="dots">...</span>`;
            } else {
                const a = document.createElement('a');
                a.href = "#";
                a.classList.add('page-link');
                a.textContent = p;
                if (p === currentPage) a.classList.add('active');

                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    displayPage(p);
                });
                li.appendChild(a);
            }
            pageList.appendChild(li);
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) displayPage(currentPage - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage < totalPages) displayPage(currentPage + 1);
        });
    }

    if (gotoInput) {
        gotoInput.addEventListener('change', function () {
            const pageNum = parseInt(this.value);
            if (!isNaN(pageNum)) displayPage(pageNum);
            this.value = '';
        });
    }

    if (rows.length > 0) {
        displayPage(1);
    }
});