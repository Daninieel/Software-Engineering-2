let allArchivedBooks = [];
let allFilteredBooks = [];
let currentPage = 1;
const rowsPerPage = 10;
let selectedArchiveId = null;

document.addEventListener('DOMContentLoaded', function () {
    loadArchivedBooks();
    setupSearch();
    setupPagination();
    setupGenerateReportButton();
});

async function loadArchivedBooks() {
    try {
        const response = await fetch('/Home/GetArchivedBooks');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        allArchivedBooks = data.sort((a, b) => b.archiveID - a.archiveID);
        allFilteredBooks = [...data];
        changePage(1);
    } catch (err) {
        console.error('Error loading archived books:', err);
        document.getElementById('archivedTableBody').innerHTML =
            `<tr><td colspan="8" style="text-align:center; color:red;">Error loading data: ${err.message}</td></tr>`;
    }
}

function setupSearch() {
    document.getElementById('searchInput').addEventListener('keyup', function () {
        const query = this.value.toLowerCase();
        allFilteredBooks = query
            ? allArchivedBooks.filter(b =>
                (b.bookTitle || '').toLowerCase().includes(query) ||
                (b.author || '').toLowerCase().includes(query) ||
                (b.archiveReason || '').toLowerCase().includes(query) ||
                b.bookID.toString().includes(query))
            : [...allArchivedBooks];
        changePage(1);
    });
}

// NEW: Setup Generate Report Button
function setupGenerateReportButton() {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportModal = document.getElementById('reportModal');
    const closeReportModal = document.getElementById('closeReportModal');

    if (generateReportBtn && reportModal) {
        generateReportBtn.addEventListener('click', function () {
            reportModal.style.display = 'flex';
        });

        if (closeReportModal) {
            closeReportModal.addEventListener('click', function () {
                reportModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', function (e) {
            if (e.target === reportModal) {
                reportModal.style.display = 'none';
            }
        });

        // Handle format button clicks
        const formatButtons = document.querySelectorAll('.report-format-btn');
        formatButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                const format = this.getAttribute('data-format');
                generateReport(format);
            });
        });
    }
}

// NEW: Generate Report Function
function generateReport(format) {
    const reportType = 'archivedbooks'; // You'll need to add this endpoint in your controller
    const url = `/Home/GenerateReport?reportType=${reportType}&format=${format}`;

    // Close the modal
    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.style.display = 'none';
    }

    // Open the report in a new window/tab or trigger download
    window.open(url, '_blank');
}

// Get styling based on archive reason
function getReasonStyle(reason) {
    const styles = {
        'Damaged': { bg: '#fde8e8', color: '#e74c3c' },
        'Missing': { bg: '#fff3cd', color: '#d4a017' },
        'Lost': { bg: '#f8d7da', color: '#721c24' },
        'Obsolete': { bg: '#d1ecf1', color: '#0c5460' }
    };
    return styles[reason] || { bg: '#e2e3e5', color: '#383d41' };
}

function renderTable() {
    const tbody = document.getElementById('archivedTableBody');
    const start = (currentPage - 1) * rowsPerPage;
    const slice = allFilteredBooks.slice(start, start + rowsPerPage);

    if (slice.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">No archived books found.</td></tr>`;
        return;
    }

    tbody.innerHTML = slice.map(b => {
        const style = getReasonStyle(b.archiveReason);
        return `
        <tr>
            <td>${b.archiveID}</td>
            <td>${b.bookID}</td>
            <td class="title-cell" title="${b.bookTitle || 'Untitled'}">${b.bookTitle || 'Untitled'}</td>
            <td class="author-cell" title="${b.author || 'Unknown'}">${b.author || 'Unknown'}</td>
            <td>${b.shelfLocation || '-'}</td>
            <td>
                <span style="
                    display:inline-block; padding:4px 12px;
                    border-radius:20px; font-size:0.8rem; font-weight:600;
                    background-color:${style.bg};
                    color:${style.color};">
                    ${b.archiveReason}
                </span>
            </td>
            <td>${b.dateArchived}</td>
            <td>
                <button class="btn-see-more" onclick="openRestoreModal(${b.archiveID})">
                    Restore
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

function changePage(page) {
    const total = Math.ceil(allFilteredBooks.length / rowsPerPage);
    if (page < 1) page = 1;
    if (page > total && total > 0) page = total;
    if (total === 0) page = 1;
    currentPage = page;
    renderTable();
    updatePagination(total);
}

function updatePagination(totalPages) {
    const pageList = document.querySelector('.page-list');
    if (!pageList) return;
    pageList.innerHTML = '';

    if (totalPages === 0) {
        return;
    }

    let pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 4) {
        pages = [1, 2, 3, 4, 5, '...', totalPages];
    } else if (currentPage >= totalPages - 3) {
        pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
        pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }

    pages.forEach(p => {
        const li = document.createElement('li');
        if (p === '...') {
            li.innerHTML = `<span class="dots">...</span>`;
        } else {
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'page-link' + (p === currentPage ? ' active' : '');
            a.textContent = p;
            a.addEventListener('click', e => { e.preventDefault(); changePage(p); });
            li.appendChild(a);
        }
        pageList.appendChild(li);
    });
}

function setupPagination() {
    document.getElementById('prevBtn').addEventListener('click', e => {
        e.preventDefault();
        changePage(currentPage - 1);
    });
    document.getElementById('nextBtn').addEventListener('click', e => {
        e.preventDefault();
        changePage(currentPage + 1);
    });
    document.querySelector('.goto-input').addEventListener('change', function () {
        const p = parseInt(this.value);
        const maxPages = Math.ceil(allFilteredBooks.length / rowsPerPage);
        if (!isNaN(p) && p >= 1 && p <= maxPages) {
            changePage(p);
        } else if (!isNaN(p)) {
            alert(`Please enter a page number between 1 and ${maxPages}`);
        }
        this.value = '';
    });
}

function openRestoreModal(archiveId) {
    selectedArchiveId = archiveId;
    document.getElementById('restoreModal').style.display = 'flex';
}

function closeRestoreModal() {
    document.getElementById('restoreModal').style.display = 'none';
    selectedArchiveId = null;
}

async function confirmRestore() {
    if (!selectedArchiveId) return;
    try {
        const response = await fetch('/Home/RestoreArchivedBook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ archiveId: selectedArchiveId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            closeRestoreModal();
            await loadArchivedBooks();
            alert('Book restored successfully!');
        } else {
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Restore error:', err);
        alert('Failed to restore book: ' + err.message);
    }
}

document.getElementById('restoreModal').addEventListener('click', function (e) {
    if (e.target === this) closeRestoreModal();
});