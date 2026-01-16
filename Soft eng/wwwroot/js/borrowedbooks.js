let currentBookData = null;
let isEditing = false;
let allBorrowedBooks = []; 
let currentPage = 1;
const rowsPerPage = 10;
let allFilteredBooks = [];


let issueBookBtn, issueBookModal, closeModalBtn, cancelBtn, issueBookForm;
let borrowedBooksTable, borrowDateInput, detailsModal, closeDetailsBtn, btnBack, btnEdit;
let pageList, gotoInput, prevBtn, nextBtn;

document.addEventListener('DOMContentLoaded', initializeBorrowedBooks);

function initializeBorrowedBooks() {
    issueBookBtn = document.getElementById('issueBookBtn');
    issueBookModal = document.getElementById('issueBookModal');
    if (issueBookModal) {
        closeModalBtn = issueBookModal.querySelector('.close-modal');
        cancelBtn = issueBookModal.querySelector('.btn-cancel');
    }
    issueBookForm = document.getElementById('issueBookForm');


    const tableElement = document.getElementById('borrowedBooksTable');
    if (tableElement) {
        borrowedBooksTable = tableElement.getElementsByTagName('tbody')[0];
    }

    borrowDateInput = document.getElementById('borrowDate');

    detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        closeDetailsBtn = detailsModal.querySelector('.close-details-modal');
    }
    btnBack = document.getElementById('btnBack');
    btnEdit = document.getElementById('btnEdit');

    pageList = document.querySelector('.page-list');
    gotoInput = document.querySelector('.goto-input');
    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');

    setupEventListeners();
    setupSearchListener();
    loadBorrowedBooks(); 
}

function setupSearchListener() {
    const searchInputs = document.querySelectorAll('input[placeholder*="Search"], input[placeholder*="search"]');
    searchInputs.forEach(input => {
        input.addEventListener('keyup', function () {
            filterBorrowedBooks(this.value.toLowerCase());
        });
    });
}

function filterBorrowedBooks(query) {
    if (!query) {
        allFilteredBooks = [...allBorrowedBooks];
    } else {
        allFilteredBooks = allBorrowedBooks.filter(book => {
            const loanId = book.loanID.toString().toLowerCase();
            const borrowerName = (book.borrowerName || '').toLowerCase();
            const bookTitle = (book.bookTitle || '').toLowerCase();
            const bookId = book.bookID.toString().toLowerCase();
            
            return loanId.includes(query) || 
                   borrowerName.includes(query) || 
                   bookTitle.includes(query) || 
                   bookId.includes(query);
        });
    }
    currentPage = 1;
    renderTableRows();
    updatePaginationUI();
}

function setupEventListeners() {

    if (issueBookBtn) issueBookBtn.addEventListener('click', openIssueBookModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeIssueBookModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeIssueBookModal);
    if (issueBookForm) issueBookForm.addEventListener('submit', handleIssueBookSubmit);

    if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', closeDetailsModal);
    if (btnBack) btnBack.addEventListener('click', closeDetailsModal);

    if (btnEdit) {
        btnEdit.addEventListener('click', handleEditClick);
    }

    window.onclick = function (event) {
        if (event.target === issueBookModal) closeIssueBookModal();
        if (event.target === detailsModal) closeDetailsModal();
    };

    setupAutocomplete();

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            changePage(currentPage - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            changePage(currentPage + 1);
        });
    }

    if (gotoInput) {
        gotoInput.addEventListener('change', function () {
            const pageNum = parseInt(this.value);
            if (!isNaN(pageNum)) {
                changePage(pageNum);
            }
            this.value = '';
        });
    }
}

async function loadBorrowedBooks() {
    try {
        showLoadingState();
        const response = await fetch('/Home/GetBorrowedBooks');
        if (!response.ok) throw new Error('Failed to load data');

        const books = await response.json();

        if (books && books.length > 0) {
            allBorrowedBooks = books.sort((a, b) => a.loanID - b.loanID);
            allFilteredBooks = [...allBorrowedBooks];

            changePage(1);
        } else {
            allBorrowedBooks = [];
            allFilteredBooks = [];
            borrowedBooksTable.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No borrowed books found.</td></tr>`;
            updatePaginationUI();
        }

    } catch (error) {
        console.error(error);
        borrowedBooksTable.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center; padding: 20px;">Error loading data: ${error.message}</td></tr>`;
    }
}

function changePage(page) {
    const totalPages = Math.ceil(allFilteredBooks.length / rowsPerPage);

    if (page < 1) page = 1;
    if (page > totalPages && totalPages > 0) page = totalPages;

    currentPage = page;
    renderTableRows();
    updatePaginationUI();
}

function renderTableRows() {
    borrowedBooksTable.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const booksToShow = allFilteredBooks.slice(start, end);

    if (booksToShow.length === 0) return;

    booksToShow.forEach(book => {
        const newRow = borrowedBooksTable.insertRow();
        newRow.dataset.loanId = book.loanID;
        newRow.dataset.bookData = JSON.stringify(book);

        newRow.innerHTML = `
            <td>${book.loanID}</td>
            <td>${book.borrowerName}</td>
            <td>${book.bookTitle}</td>
            <td>${book.dueDate}</td>
            <td>${book.dateReturned || '-'}</td>
            <td>
                <button class="overdue-btn ${book.overdueStatus === 'Yes' ? 'overdue-yes' : 'overdue-no'}"
                        onclick="toggleOverdueStatus(${book.loanID}, this)">
                    ${book.overdueStatus}
                </button>
            </td>
            <td>
                <button class="see-more-btn" onclick="showBookDetails(${book.loanID}, this)">
                    Select
                </button>
            </td>
        `;
    });
}

function updatePaginationUI() {
    if (!pageList) return;
    pageList.innerHTML = '';

    const totalPages = Math.ceil(allBorrowedBooks.length / rowsPerPage);
    if (totalPages === 0) return;

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
                changePage(p);
            });
            li.appendChild(a);
        }
        pageList.appendChild(li);
    });
}


function openIssueBookModal() {
    if (issueBookModal) {
        issueBookModal.style.display = 'flex';
        if (borrowDateInput) {
            const today = new Date().toISOString().split('T')[0];
            borrowDateInput.value = today;
        }
    }
}

function closeIssueBookModal() {
    if (issueBookModal) {
        issueBookModal.style.display = 'none';
        issueBookForm.reset();
    }
}

async function handleIssueBookSubmit(e) {
    e.preventDefault();
    const submitBtn = issueBookForm.querySelector('.btn-issue');

    const formData = new URLSearchParams({
        borrowerName: document.getElementById('borrowerName').value.trim(),
        borrowerType: document.getElementById('borrowerType').value,
        bookTitle: document.getElementById('bookTitle').value.trim(),
        borrowDate: document.getElementById('borrowDate').value
    });

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Issuing...';

        const response = await fetch('/Home/AddBorrowedBook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert('Book issued successfully!');
            closeIssueBookModal();
            loadBorrowedBooks(); 
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An unexpected server error occurred.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue';
    }
}


function showBookDetails(loanId, button) {
    const row = button.closest('tr');
    const bookData = JSON.parse(row.dataset.bookData);
    currentBookData = bookData;
    isEditing = false;

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setValue = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

    setText('detailLoanId', bookData.loanID);
    setValue('detailBorrowerName', bookData.borrowerName);
    setValue('detailBookTitle', bookData.bookTitle);

    let borrowDateEl = document.getElementById('detailBorrowDate');
    if (borrowDateEl) {
        borrowDateEl.value = bookData.borrowDate || bookData.dateBorrowed;
    }

    const returnedVal = bookData.dateReturned === '-' ? '' : formatDateForInput(bookData.dateReturned);
    setValue('detailDateReturned', returnedVal);
    setValue('detailOverdueStatus', bookData.overdueStatus);

    const statusSelect = document.getElementById('detailBookStatus');
    if (statusSelect) {
        if (bookData.returnStatus === 'Not Returned' || !bookData.returnStatus || bookData.bookStatus === 'Borrowed') {
            statusSelect.value = "";
        } else {
            statusSelect.value = bookData.bookStatus;
        }
    }

    const returnSelect = document.getElementById('detailReturnStatus');
    if (returnSelect) {
        if (bookData.returnStatus === 'Not Returned' || !bookData.returnStatus) {
            returnSelect.value = "";
        } else {
            returnSelect.value = bookData.returnStatus;
        }
    }

    setValue('detailFineAmount', bookData.fineAmount || '-');

    setInputsEnabled(false);
    detailsModal.style.display = 'flex';
}

function closeDetailsModal() {
    detailsModal.style.display = 'none';
    isEditing = false;
    currentBookData = null;
}

async function handleEditClick() {
    if (!isEditing) {
        isEditing = true;
        setInputsEnabled(true);
    } else {
        await saveBookChanges();
    }
}

function setInputsEnabled(enabled) {
    const editableIds = [
        'detailBorrowerName', 'detailBookTitle', 'detailBorrowDate',
        'detailDateReturned', 'detailOverdueStatus', 'detailReturnStatus',
        'detailBookStatus', 'detailFineAmount'
    ];

    editableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !enabled;
            el.style.backgroundColor = enabled ? '#fff' : '#e9ecef';
            el.style.border = enabled ? '1px solid #3498db' : '1px solid #ced4da';
        }
    });

    if (btnEdit) {
        btnEdit.textContent = enabled ? 'Save' : 'Edit';
        btnEdit.className = enabled ? 'btn-save' : 'btn-edit';
    }

    if (btnBack) {
        btnBack.textContent = enabled ? 'Cancel' : 'Back';
    }
}

async function saveBookChanges() {
    const loanId = document.getElementById('detailLoanId').textContent;
    const borrowerName = document.getElementById('detailBorrowerName').value.trim();
    const bookTitle = document.getElementById('detailBookTitle').value.trim();
    const borrowDate = document.getElementById('detailBorrowDate').value;
    const bookStatus = document.getElementById('detailBookStatus').value;

    if (!borrowerName || !bookTitle || !borrowDate) {
        alert("Please fill in all required fields.");
        return;
    }

    try {
        btnEdit.disabled = true;
        btnEdit.textContent = 'Saving...';

        const params = new URLSearchParams({
            loanId: loanId,
            borrowerName: borrowerName,
            bookTitle: bookTitle,
            borrowDate: borrowDate,
            bookStatus: bookStatus
        });

        const response = await fetch('/Home/UpdateBorrowedBook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const result = await response.json();

        if (result.success) {
            const newOverdue = document.getElementById('detailOverdueStatus').value;
            if (newOverdue) await updateOverdueStatus(loanId, newOverdue);

            const newDateReturned = document.getElementById('detailDateReturned').value;
            if (newDateReturned) await updateDateReturned(loanId, newDateReturned);

            alert('Changes saved successfully!');

            isEditing = false;
            setInputsEnabled(false);
            closeDetailsModal();
            loadBorrowedBooks(); 
        } else {
            alert('Error updating book: ' + result.error);
        }

    } catch (error) {
        console.error(error);
        alert('Failed to save changes.');
    } finally {
        btnEdit.disabled = false;
        if (isEditing) btnEdit.textContent = 'Save';
    }
}

function showLoadingState() {
    if (borrowedBooksTable) {
        borrowedBooksTable.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
    }
}

function formatDateForInput(dateStr) {
    if (!dateStr || dateStr === '-') return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

window.toggleOverdueStatus = async function (loanId, button) {
    const currentStatus = button.textContent.trim();
    const newStatus = currentStatus === 'Yes' ? 'No' : 'Yes';

    try {
        const response = await fetch('/Home/UpdateOverdueStatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ loanId: loanId, status: newStatus })
        });

        const result = await response.json();
        if (result.success) {
            const bookIndex = allBorrowedBooks.findIndex(b => b.loanID === loanId);
            if (bookIndex > -1) {
                allBorrowedBooks[bookIndex].overdueStatus = newStatus;
            }
            renderTableRows();
        } else {
            alert('Error updating status: ' + result.error);
        }
    } catch (e) {
        console.error(e);
    }
};

window.showBookDetails = showBookDetails;

async function updateOverdueStatus(loanId, status) {
    return fetch('/Home/UpdateOverdueStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ loanId: loanId, status: status })
    });
}

async function updateDateReturned(loanId, dateReturned) {
    return fetch('/Home/UpdateDateReturned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ loanId: loanId, dateReturned: dateReturned })
    });
}

function setupAutocomplete() {
    const borrowerInput = document.getElementById('borrowerName');
    if (borrowerInput) {
        borrowerInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value;
        }, 300));
    }
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}