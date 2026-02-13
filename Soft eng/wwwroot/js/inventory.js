document.addEventListener('DOMContentLoaded', function () {
    const tableBody = document.querySelector('#inventoryTable tbody');
    const allRows = Array.from(tableBody.querySelectorAll('.book-row'));
    let filteredRows = [...allRows];
    const rowsPerPage = 10;
    let currentPage = 1;

    const searchInput = document.getElementById('searchInput');
    const filterBtn = document.querySelector('.filter-btn') || document.querySelector('.btn-filter');
    const filterOptionsContainer = document.querySelector('.filter-options');
    const pageList = document.querySelector('.page-list');
    const gotoInput = document.querySelector('.goto-input');
    const navArrows = document.querySelectorAll('.nav-arrow');
    const prevBtn = navArrows[0];
    const nextBtn = navArrows[1];
    const editBtn = document.getElementById('adminEditBtn') || document.getElementById('editBtn');

    if (filterBtn && filterOptionsContainer) {
        filterBtn.addEventListener('click', e => {
            e.stopPropagation();
            filterOptionsContainer.classList.toggle('show');
        });
        document.addEventListener('click', () => filterOptionsContainer.classList.remove('show'));
    }

    document.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', function () {
            const filterType = this.getAttribute('data-filter');
            const filterValue = this.getAttribute('data-value');

            if (filterType === 'sort') {
                filteredRows.sort((a, b) => {
                    let cellA = a.querySelector(`.${filterValue}-cell`)?.innerText.toLowerCase().trim() || "";
                    let cellB = b.querySelector(`.${filterValue}-cell`)?.innerText.toLowerCase().trim() || "";
                    if (!isNaN(cellA) && !isNaN(cellB) && cellA !== "" && cellB !== "") {
                        return parseFloat(cellA) - parseFloat(cellB);
                    }
                    return cellA.localeCompare(cellB);
                });
            } else if (filterType === 'all') {
                filteredRows = [...allRows];
            } else if (filterType === 'status') {
                filteredRows = allRows.filter(row => row.getAttribute('data-status') === filterValue);
            } else if (filterType === 'source') {
                filteredRows = allRows.filter(row => row.getAttribute('data-source') === filterValue);
            }

            displayPage(1);
            if (filterOptionsContainer) filterOptionsContainer.classList.remove('show');
        });
    });

    if (searchInput) {
        searchInput.addEventListener('keyup', function () {
            const query = this.value.toLowerCase();
            filteredRows = allRows.filter(row => row.innerText.toLowerCase().includes(query));
            displayPage(1);
        });
    }

    tableBody.addEventListener('click', function (e) {
        const row = e.target.closest('.book-row');
        if (!row) return;
        if (e.target.closest('a') || e.target.closest('button')) return;

        tableBody.querySelectorAll('.book-row').forEach(r => r.classList.remove('selected-row'));
        row.classList.add('selected-row');

        const radio = row.querySelector('input[name="selectedBook"]');
        if (radio) radio.checked = true;
    });

    if (editBtn) {
        editBtn.addEventListener('click', function () {
            const selected = document.querySelector('input[name="selectedBook"]:checked');
            const isAdmin = !!document.getElementById('adminEditBtn') || window.location.pathname.toLowerCase().includes("admin");

            if (selected) {
                const baseUrl = window.editBookUrl || "/Home/EditBook";
                window.location.href = `${baseUrl}?id=${selected.value}&fromAdmin=${isAdmin}`;
            } else {
                alert("Please select a book to edit.");
            }
        });
    }

    function displayPage(page) {
        const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;

        allRows.forEach(row => row.style.display = 'none');
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        filteredRows.slice(start, end).forEach(row => row.style.display = '');

        updatePaginationUI(totalPages);
    }

    function updatePaginationUI(totalPages) {
        if (!pageList) return;
        pageList.innerHTML = '';
        let pagesToShow = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
        } else {
            if (currentPage <= 4) pagesToShow = [1, 2, 3, 4, 5, '...', totalPages];
            else if (currentPage >= totalPages - 3) pagesToShow = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            else pagesToShow = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
        }

        pagesToShow.forEach(p => {
            const li = document.createElement('li');
            if (p === '...') li.innerHTML = `<span class="dots">...</span>`;
            else {
                const a = document.createElement('a');
                a.href = "#";
                a.classList.add('page-link');
                a.textContent = p;
                if (p === currentPage) a.classList.add('active');
                a.addEventListener('click', e => {
                    e.preventDefault();
                    displayPage(p);
                });
                li.appendChild(a);
            }
            pageList.appendChild(li);
        });
    }

    if (prevBtn) prevBtn.addEventListener('click', e => { e.preventDefault(); if (currentPage > 1) displayPage(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener('click', e => { e.preventDefault(); if (currentPage < Math.ceil(filteredRows.length / rowsPerPage)) displayPage(currentPage + 1); });
    if (gotoInput) gotoInput.addEventListener('change', function () { const pageNum = parseInt(this.value); if (!isNaN(pageNum)) displayPage(pageNum); this.value = ''; });

    if (allRows.length > 0) displayPage(1);
});
