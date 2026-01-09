// borrowedbooks.js

// Global variables
let currentBookData = null;
let isEditing = false;

// DOM Elements (will be initialized on DOMContentLoaded)
let issueBookBtn;
let issueBookModal;
let closeModalBtn;
let cancelBtn;
let issueBookForm;
let borrowedBooksTable;
let borrowDateInput;
let detailsModal;
let closeDetailsBtn;
let btnBack;
let btnEdit;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeBorrowedBooks);

function initializeBorrowedBooks() {
    // Initialize DOM elements
    issueBookBtn = document.getElementById('issueBookBtn');
    issueBookModal = document.getElementById('issueBookModal');
    closeModalBtn = issueBookModal.querySelector('.close-modal');
    cancelBtn = issueBookModal.querySelector('.btn-cancel');
    issueBookForm = document.getElementById('issueBookForm');
    borrowedBooksTable = document.getElementById('borrowedBooksTable').getElementsByTagName('tbody')[0];
    borrowDateInput = document.getElementById('borrowDate');

    // Details Modal Elements
    detailsModal = document.getElementById('detailsModal');
    closeDetailsBtn = detailsModal.querySelector('.close-details-modal');
    btnBack = document.getElementById('btnBack');
    btnEdit = document.getElementById('btnEdit');

    // Event Listeners
    setupEventListeners();

    // Load initial data
    loadBorrowedBooks();
}

function setupEventListeners() {
    // Issue Book Modal
    issueBookBtn.addEventListener('click', openIssueBookModal);
    closeModalBtn.addEventListener('click', closeIssueBookModal);
    cancelBtn.addEventListener('click', closeIssueBookModal);
    issueBookForm.addEventListener('submit', handleIssueBookSubmit);

    // Details Modal
    closeDetailsBtn.addEventListener('click', closeDetailsModal);
    btnBack.addEventListener('click', closeDetailsModal);
    btnEdit.addEventListener('click', handleEditClick);

    // Event listeners for validation
    const overdueStatusSelect = document.getElementById('detailOverdueStatus');
    const fineAmountInput = document.getElementById('detailFineAmount');
    const dateReturnedInput = document.getElementById('detailDateReturned');
    const borrowDateInput = document.getElementById('detailBorrowDate');

    if (overdueStatusSelect) {
        overdueStatusSelect.addEventListener('change', handleOverdueStatusChange);
    }

    if (fineAmountInput) {
        fineAmountInput.addEventListener('input', handleFineAmountInput);
        fineAmountInput.addEventListener('blur', validateFineAmount);
    }

    if (dateReturnedInput && borrowDateInput) {
        dateReturnedInput.addEventListener('change', function () {
            validateDateReturned();
        });

        borrowDateInput.addEventListener('change', function () {
            // Update min date for date returned when borrow date changes
            if (this.value) {
                dateReturnedInput.min = this.value;
                validateDateReturned();
            }
        });
    }

    // Close modals when clicking outside
    issueBookModal.addEventListener('click', function (e) {
        if (e.target === issueBookModal) {
            closeIssueBookModal();
        }
    });

    detailsModal.addEventListener('click', function (e) {
        if (e.target === detailsModal) {
            closeDetailsModal();
        }
    });

    // Edit Issue Book button
    const editIssueBookBtn = document.getElementById('editIssueBookBtn');
    editIssueBookBtn.addEventListener('click', handleEditIssueBookClick);
}

// ================ Validation Functions ================

function handleOverdueStatusChange() {
    const overdueStatus = document.getElementById('detailOverdueStatus').value;
    const fineAmountInput = document.getElementById('detailFineAmount');

    if (overdueStatus === 'Yes' && isEditing) {
        // Enable fine amount input
        fineAmountInput.disabled = false;
        fineAmountInput.style.backgroundColor = '#fff';
        fineAmountInput.style.cursor = 'text';
        fineAmountInput.placeholder = 'Enter amount (0-1000)';
        fineAmountInput.value = ''; // Clear the default "-"
    } else {
        // Disable fine amount input
        fineAmountInput.disabled = true;
        fineAmountInput.style.backgroundColor = '#f5f5f5';
        fineAmountInput.style.cursor = 'not-allowed';
        fineAmountInput.placeholder = '-';

        // Reset to default value if not overdue
        if (overdueStatus === 'No' || overdueStatus === 'Select') {
            fineAmountInput.value = '-';
        }
    }

    // Clear any validation messages
    clearFineAmountValidation();
}

function handleFineAmountInput() {
    const fineAmountInput = document.getElementById('detailFineAmount');
    let value = fineAmountInput.value;

    // Only allow numbers
    value = value.replace(/[^\d]/g, '');

    // Update the input value
    fineAmountInput.value = value;

    // Clear any previous validation messages
    clearFineAmountValidation();
}

function validateFineAmount() {
    const fineAmountInput = document.getElementById('detailFineAmount');
    const value = fineAmountInput.value;
    const overdueStatus = document.getElementById('detailOverdueStatus').value;

    // Only validate if overdue status is Yes and we're editing
    if (overdueStatus === 'Yes' && isEditing && value) {
        const numericValue = parseInt(value);

        if (isNaN(numericValue)) {
            showFineAmountError('Please enter a valid number');
            return false;
        }

        if (numericValue < 0) {
            showFineAmountError('Fine amount cannot be negative');
            return false;
        }

        if (numericValue > 1000) {
            showFineAmountError('Fine amount cannot exceed 1000');
            return false;
        }

        // If valid, show success style
        fineAmountInput.style.borderColor = '#2ecc71';
        fineAmountInput.style.boxShadow = '0 0 0 2px rgba(46, 204, 113, 0.2)';
        return true;
    }

    // Reset style if not validating
    fineAmountInput.style.borderColor = '#ddd';
    fineAmountInput.style.boxShadow = 'none';
    return true;
}

function showFineAmountError(message) {
    const fineAmountInput = document.getElementById('detailFineAmount');
    fineAmountInput.style.borderColor = '#e74c3c';
    fineAmountInput.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';

    // Remove any existing error message
    clearFineAmountValidation();

    // Add new error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    errorMessage.style.fontSize = '12px';
    errorMessage.style.color = '#e74c3c';
    errorMessage.style.marginTop = '5px';

    fineAmountInput.parentNode.insertBefore(errorMessage, fineAmountInput.nextElementSibling);
}

function clearFineAmountValidation() {
    const fineAmountInput = document.getElementById('detailFineAmount');
    const errorMessage = fineAmountInput.nextElementSibling;

    if (errorMessage && errorMessage.classList.contains('error-message')) {
        errorMessage.remove();
    }

    fineAmountInput.style.borderColor = '#ddd';
    fineAmountInput.style.boxShadow = 'none';
}

function validateDateReturned() {
    const dateReturnedInput = document.getElementById('detailDateReturned');
    const borrowDateInput = document.getElementById('detailBorrowDate');

    if (!dateReturnedInput.value || !borrowDateInput.value) {
        return true;
    }

    const returnDate = new Date(dateReturnedInput.value);
    const borrowDate = new Date(borrowDateInput.value);

    if (returnDate < borrowDate) {
        // Show error
        dateReturnedInput.style.borderColor = '#e74c3c';
        dateReturnedInput.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';

        // Show error message
        const errorMessage = dateReturnedInput.nextElementSibling;
        if (!errorMessage || !errorMessage.classList.contains('error-message')) {
            const newErrorMessage = document.createElement('div');
            newErrorMessage.className = 'error-message';
            newErrorMessage.textContent = 'Date returned cannot be before borrow date';
            newErrorMessage.style.fontSize = '12px';
            newErrorMessage.style.color = '#e74c3c';
            newErrorMessage.style.marginTop = '5px';

            dateReturnedInput.parentNode.insertBefore(newErrorMessage, dateReturnedInput.nextElementSibling);
        }

        return false;
    } else {
        // Clear error
        dateReturnedInput.style.borderColor = '#2ecc71';
        dateReturnedInput.style.boxShadow = '0 0 0 2px rgba(46, 204, 113, 0.2)';

        // Remove error message if exists
        const errorMessage = dateReturnedInput.nextElementSibling;
        if (errorMessage && errorMessage.classList.contains('error-message')) {
            errorMessage.remove();
        }

        return true;
    }
}

// ================ Utility Functions ================

function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
}

function formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

function parseDate(dateStr) {
    if (!dateStr || dateStr === '-') return null;
    const parts = dateStr.split('/');
    return new Date(parts[2], parts[0] - 1, parts[1]);
}

// ================ Load Books Functions ================

async function loadBorrowedBooks() {
    try {
        const response = await fetch('/Home/GetBorrowedBooks');
        if (!response.ok) {
            throw new Error('Failed to load borrowed books. Status: ' + response.status);
        }
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
                    <td>${book.dateReturned}</td>
                    <td>
                        <button class="overdue-btn ${book.overdueStatus === 'Yes' ? 'overdue-yes' : 'overdue-no'}"
                                onclick="toggleOverdueStatus(${book.loanID}, this)">
                            ${book.overdueStatus}
                        </button>
                    </td>
                    <td>
                        <button class="see-more-btn" onclick="showBookDetails(${book.loanID}, this)">
                            See More
                        </button>
                    </td>
                `;
            });
        } else {
            // Show empty table message
            const emptyRow = borrowedBooksTable.insertRow();
            emptyRow.innerHTML = `
                <td colspan="7" style="text-align: center; padding: 40px; color: #999; font-style: italic;">
                    No borrowed books found. Click "Issue Book" to add one.
                </td>
            `;
        }
    } catch (error) {
        console.error('Error loading borrowed books:', error);
        borrowedBooksTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #e74c3c;">
                    Error loading borrowed books: ${error.message}
                </td>
            </tr>
        `;
    }
}

// ================ Issue Book Modal Functions ================

function openIssueBookModal() {
    issueBookModal.style.display = 'flex';
    // Set today's date as default in the borrow date field
    const today = new Date();
    borrowDateInput.value = formatDateForInput(today);
    // Set min date to today (can't borrow for past dates)
    borrowDateInput.min = formatDateForInput(today);
    // Set max date to 1 year from now
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    borrowDateInput.max = formatDateForInput(maxDate);
}

function closeIssueBookModal() {
    issueBookModal.style.display = 'none';
    issueBookForm.reset();
}

async function handleIssueBookSubmit(e) {
    e.preventDefault();

    // Get form values
    const borrowerName = document.getElementById('borrowerName').value.trim();
    const bookTitle = document.getElementById('bookTitle').value.trim();
    const borrowDateStr = document.getElementById('borrowDate').value;

    // Validate inputs
    if (!borrowerName) {
        alert('Please enter borrower name');
        return;
    }

    if (!bookTitle) {
        alert('Please enter book title');
        return;
    }

    if (!borrowDateStr) {
        alert('Please select borrow date');
        return;
    }

    try {
        // Send data to server
        const response = await fetch('/Home/AddBorrowedBook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                borrowerName: borrowerName,
                bookTitle: bookTitle,
                borrowDate: borrowDateStr
            })
        });

        if (!response.ok) {
            throw new Error('Failed to issue book. Status: ' + response.status);
        }

        const result = await response.json();

        if (result.success) {
            // Close modal and reset form
            closeIssueBookModal();

            // Reload the table
            await loadBorrowedBooks();

            // Show success message
            alert('Book issued successfully!\nLoan ID: ' + result.loanId + '\nDue Date: ' + result.dueDate);
        } else {
            alert('Error issuing book: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while issuing the book: ' + error.message);
    }
}

// ================ Details Modal Functions ================

function showBookDetails(loanId, button) {
    const row = button.closest('tr');
    const bookData = JSON.parse(row.dataset.bookData);
    currentBookData = bookData;
    currentBookData.rowElement = row;
    isEditing = false;

    // Populate modal with book data
    document.getElementById('detailLoanId').textContent = bookData.loanID;
    document.getElementById('detailBorrowerName').value = bookData.borrowerName;
    document.getElementById('detailBookTitle').value = bookData.bookTitle;
    document.getElementById('detailDueDate').value = formatDateForInput(parseDate(bookData.dueDate));

    // Set date returned
    const dateReturned = bookData.dateReturned === '-' ? '' : formatDateForInput(parseDate(bookData.dateReturned));
    document.getElementById('detailDateReturned').value = dateReturned;

    // Set overdue status
    const overdueStatus = bookData.overdueStatus || 'No';
    document.getElementById('detailOverdueStatus').value = overdueStatus;

    // Set book status (default to "Good" if not set)
    document.getElementById('detailBookStatus').value = 'Good';

    // Set return status based on date returned
    const returnStatus = bookData.dateReturned === '-' ? 'Unreturned' : 'Returned';
    document.getElementById('detailReturnStatus').value = returnStatus;

    // Set fine amount (default to "-")
    document.getElementById('detailFineAmount').value = '-';

    // Set borrow date - try to fetch it from the book data
    if (bookData.borrowDate) {
        document.getElementById('detailBorrowDate').value = formatDateForInput(parseDate(bookData.borrowDate));
    } else {
        // Calculate from due date (7 days before due date)
        const dueDate = parseDate(bookData.dueDate);
        if (dueDate) {
            const borrowDate = new Date(dueDate);
            borrowDate.setDate(borrowDate.getDate() - 7); // Assume borrowed 1 week before due
            document.getElementById('detailBorrowDate').value = formatDateForInput(borrowDate);
        } else {
            document.getElementById('detailBorrowDate').value = formatDateForInput(new Date());
        }
    }

    // Set min date for date returned
    const borrowDateInput = document.getElementById('detailBorrowDate');
    const dateReturnedInput = document.getElementById('detailDateReturned');
    if (borrowDateInput.value) {
        dateReturnedInput.min = borrowDateInput.value;
    }

    // Apply overdue status effects
    handleOverdueStatusChange();

    // Disable inputs initially
    setInputsEnabled(false);

    // Clear any validation messages
    clearAllValidationMessages();

    // Show modal
    detailsModal.style.display = 'flex';
}

function setInputsEnabled(enabled) {
    const inputs = detailsModal.querySelectorAll('.detail-input, .detail-select');
    inputs.forEach(input => {
        input.disabled = !enabled;
        if (enabled) {
            input.style.backgroundColor = '#fff';
            input.style.cursor = 'text';
        } else {
            input.style.backgroundColor = '#f8f9fa';
            input.style.cursor = 'not-allowed';
        }
    });

    // Special handling for fine amount based on overdue status
    const overdueStatus = document.getElementById('detailOverdueStatus').value;
    const fineAmountInput = document.getElementById('detailFineAmount');

    if (enabled && overdueStatus === 'Yes') {
        fineAmountInput.disabled = false;
        fineAmountInput.style.backgroundColor = '#fff';
        fineAmountInput.style.cursor = 'text';
        fineAmountInput.placeholder = 'Enter amount (0-1000)';
    } else {
        fineAmountInput.disabled = true;
        fineAmountInput.style.backgroundColor = '#f5f5f5';
        fineAmountInput.style.cursor = 'not-allowed';
        fineAmountInput.placeholder = '-';
    }

    // Update button text and style
    const btnEdit = document.getElementById('btnEdit');
    if (enabled) {
        btnEdit.textContent = 'Save';
        btnEdit.className = 'btn-save';
    } else {
        btnEdit.textContent = 'Edit';
        btnEdit.className = 'btn-edit';
    }
}

function closeDetailsModal() {
    detailsModal.style.display = 'none';
    isEditing = false;
    setInputsEnabled(false);

    // Clear all validation messages
    clearAllValidationMessages();

    // Reset border colors
    const inputs = detailsModal.querySelectorAll('.detail-input');
    inputs.forEach(input => {
        input.style.borderColor = '#ddd';
        input.style.boxShadow = 'none';
    });

    currentBookData = null;
}

function clearAllValidationMessages() {
    const errorMessages = detailsModal.querySelectorAll('.error-message');
    errorMessages.forEach(msg => msg.remove());
}

async function handleEditClick() {
    if (!isEditing) {
        // Enable editing mode
        isEditing = true;
        setInputsEnabled(true);
    } else {
        // Save changes
        if (!validateDetailsForm()) {
            return;
        }

        try {
            const updatedData = {
                loanId: currentBookData.loanID,
                borrowerName: document.getElementById('detailBorrowerName').value.trim(),
                bookTitle: document.getElementById('detailBookTitle').value.trim(),
                borrowDate: document.getElementById('detailBorrowDate').value,
                dueDate: document.getElementById('detailDueDate').value,
                dateReturned: document.getElementById('detailDateReturned').value,
                overdueStatus: document.getElementById('detailOverdueStatus').value,
                returnStatus: document.getElementById('detailReturnStatus').value
            };

            // Prepare data for sending (excluding fine amount since we're not saving it to DB)
            const formData = new URLSearchParams();
            formData.append('loanId', updatedData.loanId);
            formData.append('borrowerName', updatedData.borrowerName);
            formData.append('bookTitle', updatedData.bookTitle);
            formData.append('borrowDate', updatedData.borrowDate);
            formData.append('dueDate', updatedData.dueDate);
            formData.append('dateReturned', updatedData.dateReturned || '');
            formData.append('overdueStatus', updatedData.overdueStatus);

            // Update book details (excluding fine amount)
            const response = await fetch('/Home/UpdateBorrowedBook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    loanId: updatedData.loanId,
                    borrowerName: updatedData.borrowerName,
                    bookTitle: updatedData.bookTitle,
                    borrowDate: updatedData.borrowDate
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update book. Status: ' + response.status);
            }

            const result = await response.json();

            if (result.success) {
                // Update overdue status if changed
                if (updatedData.overdueStatus !== currentBookData.overdueStatus) {
                    await updateOverdueStatus(updatedData.loanId, updatedData.overdueStatus);
                }

                // Update date returned if provided
                if (updatedData.dateReturned) {
                    await updateDateReturned(updatedData.loanId, updatedData.dateReturned);
                }

                // Reload the table
                await loadBorrowedBooks();

                // Show success message
                alert('Book details updated successfully!');

                // Exit editing mode
                isEditing = false;
                setInputsEnabled(false);

                // Close modal after successful save
                setTimeout(() => {
                    closeDetailsModal();
                }, 500);
            } else {
                alert('Error updating book: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while updating the book: ' + error.message);
        }
    }
}

function validateDetailsForm() {
    // Clear all previous error messages
    clearAllValidationMessages();

    // Reset border colors
    const inputs = detailsModal.querySelectorAll('.detail-input');
    inputs.forEach(input => {
        input.style.borderColor = '#ddd';
        input.style.boxShadow = 'none';
    });

    // Get form values
    const borrowerName = document.getElementById('detailBorrowerName').value.trim();
    const bookTitle = document.getElementById('detailBookTitle').value.trim();
    const borrowDate = document.getElementById('detailBorrowDate').value;
    const dueDate = document.getElementById('detailDueDate').value;
    const dateReturned = document.getElementById('detailDateReturned').value;
    const overdueStatus = document.getElementById('detailOverdueStatus').value;
    const bookStatus = document.getElementById('detailBookStatus').value;
    const returnStatus = document.getElementById('detailReturnStatus').value;
    const fineAmount = document.getElementById('detailFineAmount').value;

    let isValid = true;

    // Basic validation
    if (!borrowerName) {
        showValidationError('detailBorrowerName', 'Borrower name is required');
        isValid = false;
    }

    if (!bookTitle) {
        showValidationError('detailBookTitle', 'Book title is required');
        isValid = false;
    }

    if (!borrowDate) {
        showValidationError('detailBorrowDate', 'Borrow date is required');
        isValid = false;
    }

    if (!dueDate) {
        showValidationError('detailDueDate', 'Due date is required');
        isValid = false;
    }

    // Date validation
    const borrowDateObj = new Date(borrowDate);
    const dueDateObj = new Date(dueDate);

    if (dueDateObj < borrowDateObj) {
        showValidationError('detailDueDate', 'Due date cannot be earlier than borrow date');
        isValid = false;
    }

    // Validate date returned
    if (dateReturned) {
        const returnDateObj = new Date(dateReturned);
        if (returnDateObj < borrowDateObj) {
            showValidationError('detailDateReturned', 'Date returned cannot be before borrow date');
            isValid = false;
        }
    }

    // Status validation
    if (overdueStatus === 'Select') {
        showValidationError('detailOverdueStatus', 'Please select overdue status');
        isValid = false;
    }

    if (bookStatus === 'Select') {
        showValidationError('detailBookStatus', 'Please select book status');
        isValid = false;
    }

    if (returnStatus === 'Select') {
        showValidationError('detailReturnStatus', 'Please select return status');
        isValid = false;
    }

    // Fine amount validation ONLY if overdue status is Yes
    if (overdueStatus === 'Yes') {
        if (!fineAmount || fineAmount === '-') {
            showValidationError('detailFineAmount', 'Fine amount is required for overdue books');
            isValid = false;
        } else {
            const numericFineAmount = parseInt(fineAmount);
            if (isNaN(numericFineAmount) || numericFineAmount < 0) {
                showValidationError('detailFineAmount', 'Fine amount must be a positive number');
                isValid = false;
            } else if (numericFineAmount > 1000) {
                showValidationError('detailFineAmount', 'Fine amount cannot exceed 1000');
                isValid = false;
            }
        }
    }

    return isValid;
}

function showValidationError(fieldId, message) {
    const field = document.getElementById(fieldId);
    field.style.borderColor = '#e74c3c';
    field.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';

    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    errorMessage.style.fontSize = '12px';
    errorMessage.style.color = '#e74c3c';
    errorMessage.style.marginTop = '5px';

    field.parentNode.insertBefore(errorMessage, field.nextElementSibling);
}

// ================ Other Functions ================

function handleEditIssueBookClick() {
    const rows = borrowedBooksTable.rows;
    if (rows.length === 0 || (rows.length === 1 && rows[0].cells[0].colSpan === 7)) {
        alert('No books to edit. Please issue a book first.');
        return;
    }
    alert('Use the "See More" button to edit individual books.');
}

// Global functions (accessible from onclick attributes)
window.toggleOverdueStatus = async function (loanId, button) {
    const newStatus = button.textContent === 'No' ? 'Yes' : 'No';

    try {
        const response = await fetch('/Home/UpdateOverdueStatus', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                loanId: loanId,
                status: newStatus
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update status. Status: ' + response.status);
        }

        const result = await response.json();

        if (result.success) {
            button.textContent = newStatus;
            button.className = newStatus === 'Yes' ? 'overdue-btn overdue-yes' : 'overdue-btn overdue-no';

            // Update the data in the row
            const row = button.closest('tr');
            if (row) {
                const bookData = JSON.parse(row.dataset.bookData);
                bookData.overdueStatus = newStatus;
                row.dataset.bookData = JSON.stringify(bookData);
            }
        } else {
            alert('Error updating status');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while updating status: ' + error.message);
    }
};

window.showBookDetails = showBookDetails;

// Helper function to update date returned
async function updateDateReturned(loanId, dateReturned) {
    try {
        const response = await fetch('/Home/UpdateDateReturned', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                loanId: loanId,
                dateReturned: dateReturned
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update date returned. Status: ' + response.status);
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating date returned:', error);
        return { success: false, error: error.message };
    }
}

// Helper function to update overdue status
async function updateOverdueStatus(loanId, status) {
    try {
        const response = await fetch('/Home/UpdateOverdueStatus', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                loanId: loanId,
                status: status
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update status. Status: ' + response.status);
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating overdue status:', error);
        return { success: false, error: error.message };
    }
}