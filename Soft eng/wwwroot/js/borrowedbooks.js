// borrowedbooks.js

// Global variables
let currentBookData = null;
let isEditing = false;

// DOM Elements
let issueBookBtn, issueBookModal, closeModalBtn, cancelBtn, issueBookForm;
let borrowedBooksTable, borrowDateInput, detailsModal, closeDetailsBtn, btnBack, btnEdit;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeBorrowedBooks);

function initializeBorrowedBooks() {
    // Initialize common DOM elements
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

    // Details Modal Elements
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
    // Issue Book Modal Listeners
    if (issueBookBtn) issueBookBtn.addEventListener('click', openIssueBookModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeIssueBookModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeIssueBookModal);
    if (issueBookForm) issueBookForm.addEventListener('submit', handleIssueBookSubmit);

    // Details Modal Listeners
    if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', closeDetailsModal);
    if (btnBack) btnBack.addEventListener('click', closeDetailsModal);

    // Edit/Save Button Listener
    if (btnEdit) {
        btnEdit.addEventListener('click', handleEditClick);
    }

    // Close modals when clicking outside
    window.onclick = function (event) {
        if (event.target === issueBookModal) closeIssueBookModal();
        if (event.target === detailsModal) closeDetailsModal();
    };

    // Initialize autocomplete (if endpoints exist)
    setupAutocomplete();
}

// ================ Load Data ================

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

// ================ Issue Book Functions ================

function openIssueBookModal() {
    if (issueBookModal) {
        issueBookModal.style.display = 'flex';
        // Set default date to today
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
            loadBorrowedBooks(); // Refresh the table
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

// ================ Details & Editing Functions ================

function showBookDetails(loanId, button) {
    const row = button.closest('tr');
    const bookData = JSON.parse(row.dataset.bookData);
    currentBookData = bookData;
    isEditing = false;

    // 1. Populate Read-Only Fields (Divs)
    document.getElementById('detailLoanId').textContent = bookData.loanID;
    document.getElementById('detailBorrowerId').textContent = bookData.borrowerID;
    document.getElementById('detailBookId').textContent = bookData.bookID;

    // 2. Populate Editable Inputs
    document.getElementById('detailBorrowerName').value = bookData.borrowerName;
    document.getElementById('detailBookTitle').value = bookData.bookTitle;

    document.getElementById('detailDateBorrowed').value = bookData.borrowDate || bookData.dateBorrowed;

    const returnedVal = bookData.dateReturned === '-' ? '' : formatDateForInput(bookData.dateReturned);
    document.getElementById('detailDateReturned').value = returnedVal;

    // 3. Populate Selects
    document.getElementById('detailOverdueStatus').value = bookData.overdueStatus;
    document.getElementById('detailReturnStatus').value = bookData.returnStatus;

    // Set Book Status
    const statusSelect = document.getElementById('detailBookStatus');
    if (statusSelect) {
        // Default to 'Borrowed' if empty or match DB
        statusSelect.value = bookData.bookStatus || 'Borrowed';
    }

    // Reset UI state
    setInputsEnabled(false);

    // Show Modal
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
        'detailDateBorrowed',
        'detailDateReturned',
        'detailOverdueStatus',
        'detailReturnStatus',
        'detailBookStatus' // Added to enabled list
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
        btnBack.textContent = enabled ? 'Cancel' : 'Close';
    }
}

async function saveBookChanges() {
    const loanId = document.getElementById('detailLoanId').textContent;
    const borrowerName = document.getElementById('detailBorrowerName').value.trim();
    const bookTitle = document.getElementById('detailBookTitle').value.trim();
    const borrowDate = document.getElementById('detailDateBorrowed').value;
    const bookStatus = document.getElementById('detailBookStatus').value; // Get Status

    if (!borrowerName || !bookTitle || !borrowDate) {
        alert("Please fill in all required fields (Name, Title, Date Borrowed).");
        return;
    }

    try {
        btnEdit.disabled = true;
        btnEdit.textContent = 'Saving...';

        // 1. Update Basic Info & Book Status
        const params = new URLSearchParams({
            loanId: loanId,
            borrowerName: borrowerName,
            bookTitle: bookTitle,
            borrowDate: borrowDate,
            bookStatus: bookStatus // Send Status
        });

        const response = await fetch('/Home/UpdateBorrowedBook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const result = await response.json();

        if (result.success) {
            const newOverdue = document.getElementById('detailOverdueStatus').value;
            await updateOverdueStatus(loanId, newOverdue);

            const newDateReturned = document.getElementById('detailDateReturned').value;
            await updateDateReturned(loanId, newDateReturned);

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
        alert('Failed to save changes. Check console for details.');
    } finally {
        btnEdit.disabled = false;
        if (isEditing) btnEdit.textContent = 'Save';
    }
}

// ================ Helper Functions ================

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
            if (query.length < 2) return;
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