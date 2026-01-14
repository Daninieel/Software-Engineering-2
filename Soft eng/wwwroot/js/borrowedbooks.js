// borrowedbooks.js

// Global variables
let currentBookData = null;
let isEditing = false;

// DOM Elements
let issueBookBtn, issueBookModal, closeModalBtn, cancelBtn, issueBookForm;
let borrowedBooksTable, borrowDateInput, detailsModal, closeDetailsBtn, btnBack, btnEdit;

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

    setupEventListeners();
    loadBorrowedBooks();
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
}

async function loadBorrowedBooks() {
    try {
        showLoadingState();
        const response = await fetch('/Home/GetBorrowedBooks');
        if (!response.ok) throw new Error('Failed to load data');

        const books = await response.json();
        borrowedBooksTable.innerHTML = '';

        if (books && books.length > 0) {
            books.forEach(book => {
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
        } else {
            borrowedBooksTable.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No borrowed books found.</td></tr>`;
        }
    } catch (error) {
        console.error(error);
        borrowedBooksTable.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center; padding: 20px;">Error loading data: ${error.message}</td></tr>`;
    }
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

// === THIS FUNCTION HANDLES THE PLACEHOLDER LOGIC ===
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

    // --- UPDATED LOGIC FOR BOOK STATUS PLACEHOLDER ---
    // If the book is not yet returned (active loan), we force the "Select" placeholder (value = "")
    // regardless of whether the DB says "Good" or "Borrowed".
    const statusSelect = document.getElementById('detailBookStatus');
    if (statusSelect) {
        if (bookData.returnStatus === 'Not Returned' || !bookData.returnStatus || bookData.bookStatus === 'Borrowed') {
            statusSelect.value = ""; // Forces the "Select" placeholder to appear
        } else {
            statusSelect.value = bookData.bookStatus;
        }
    }

    // --- LOGIC FOR RETURN STATUS PLACEHOLDER ---
    const returnSelect = document.getElementById('detailReturnStatus');
    if (returnSelect) {
        if (bookData.returnStatus === 'Not Returned' || !bookData.returnStatus) {
            returnSelect.value = ""; // Forces the "Select" placeholder to appear
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
        'detailBorrowerName',
        'detailBookTitle',
        'detailBorrowDate',
        'detailDateReturned',
        'detailOverdueStatus',
        'detailReturnStatus',
        'detailBookStatus',
        'detailFineAmount'
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
            button.textContent = newStatus;
            button.className = `overdue-btn ${newStatus === 'Yes' ? 'overdue-yes' : 'overdue-no'}`;
            loadBorrowedBooks();
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