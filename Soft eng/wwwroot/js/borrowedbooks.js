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

    // Handle Borrower Type change in Issue Book form
    const borrowerTypeSelect = document.getElementById('borrowerType');
    if (borrowerTypeSelect) {
        borrowerTypeSelect.addEventListener('change', function() {
            handleBorrowerTypeChange(this.value);
        });
    }

    window.onclick = function (event) {
        if (event.target === issueBookModal) closeIssueBookModal();
        if (event.target === detailsModal) closeDetailsModal();
    };

    setupAutocomplete();
    setupDateValidation();

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

function setupDateValidation() {
    const dueDateInput = document.getElementById('detailDueDate');
    const dateReturnedInput = document.getElementById('detailDateReturned');
    const borrowDateInput = document.getElementById('detailBorrowDate');

    // Helper function to check if date is Thursday
    const isThursday = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.getDay() === 4; // Thursday is 4
    };

    // Helper function to check if date is Friday, Saturday, or Sunday
    const isFridayToSunday = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const day = date.getDay();
        return day === 5 || day === 6 || day === 0; // Friday (5), Saturday (6), Sunday (0)
    };

    // Helper function to get day name
    const getDayName = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    };

    // Helper function to get next Thursday
    const getNextThursday = (fromDate) => {
        const date = new Date(fromDate + 'T00:00:00');
        const day = date.getDay();
        const daysUntilThursday = day <= 4 ? 4 - day : 11 - day;
        date.setDate(date.getDate() + daysUntilThursday);
        return date.toISOString().split('T')[0];
    };

    const today = new Date().toISOString().split('T')[0];

    // Validation for Due Date - must be Thursday and in future
    if (dueDateInput) {
        dueDateInput.addEventListener('change', function () {
            if (this.value) {
                // Check if date is in the past
                if (this.value < today) {
                    alert('Due Date cannot be in the past. Please select a current or future date.');
                    this.value = '';
                    return;
                }
                // Check if date is Thursday
                if (!isThursday(this.value)) {
                    const dayName = getDayName(this.value);
                    const nextThurs = getNextThursday(this.value);
                    alert(`Due Date must be on Thursday. You selected ${dayName}. The next available Thursday is ${nextThurs}.`);
                    this.value = '';
                }
            }
        });
    }

    // Validation for Date Returned - cannot be Friday, Saturday, or Sunday
    if (dateReturnedInput) {
        dateReturnedInput.min = today;
        dateReturnedInput.addEventListener('change', function () {
            if (this.value) {
                // Check if date is in the past
                if (this.value < today) {
                    alert('Date Returned cannot be in the past. Please select a current or future date.');
                    this.value = '';
                    return;
                }
                // Check if date is Friday, Saturday, or Sunday
                if (isFridayToSunday(this.value)) {
                    const dayName = getDayName(this.value);
                    alert(`Books cannot be returned on ${dayName}. Please select a date from Monday to Thursday.`);
                    this.value = '';
                }
            }
        });
    }

    // Validation for Date Borrowed - cannot be earlier than original borrowed date
    if (borrowDateInput) {
        borrowDateInput.addEventListener('change', function () {
            if (currentBookData && currentBookData.borrowDate) {
                const originalBorrowDate = currentBookData.borrowDate;
                if (this.value && this.value < originalBorrowDate) {
                    alert('Date Borrowed cannot be earlier than the original borrowed date (' + originalBorrowDate + '). Please select a current or future date.');
                    this.value = originalBorrowDate;
                }
            }
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
            // Filter out books that have been returned
            const unreturned = books.filter(book => 
                book.returnStatus !== 'Returned' && 
                (book.returnStatus === null || book.returnStatus === undefined || book.returnStatus === 'Unreturned' || book.returnStatus === 'Not Returned')
            );
            
            allBorrowedBooks = unreturned.sort((a, b) => b.loanID - a.loanID);
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

        // Check if overdue status is "Yes" to disable toggle
        const isOverdueYes = book.overdueStatus === 'Yes';
        const disabledAttr = isOverdueYes ? 'disabled' : '';
        const cursorStyle = isOverdueYes ? 'cursor: not-allowed; opacity: 0.6;' : 'cursor: pointer;';

        newRow.innerHTML = `
            <td>${book.loanID}</td>
            <td>${book.borrowerName}</td>
            <td>${book.bookTitle}</td>
            <td>${book.dueDate}</td>
            <td>${book.dateReturned || '-'}</td>
            <td>
                <button class="overdue-btn ${book.overdueStatus === 'Yes' ? 'overdue-yes' : 'overdue-no'}"
                        onclick="toggleOverdueStatus(${book.loanID}, this)"
                        ${disabledAttr}
                        style="${cursorStyle}">
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

    const borrowerName = document.getElementById('borrowerName').value.trim();
    const borrowerType = document.getElementById('borrowerType').value;
    const bookTitle = document.getElementById('bookTitle').value.trim();
    const borrowDate = document.getElementById('borrowDate').value;

    // Validation: Check if borrower name follows "LastName, FirstName" format
    if (!validateBorrowerNameFormat(borrowerName)) {
        alert('Please enter borrower name in the format: LastName, FirstName (e.g., Dela Cruz, Juan)');
        return;
    }

    const formData = new URLSearchParams({
        borrowerName: borrowerName,
        borrowerType: borrowerType,
        bookTitle: bookTitle,
        borrowDate: borrowDate
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

    // Set Loan ID and Borrower ID
    setText('detailLoanId', bookData.loanID);
    setText('detailBorrowerId', bookData.borrowerID || '-');
    setText('detailBookId', bookData.bookID || '-');
    
    setValue('detailBorrowerName', bookData.borrowerName);
    setValue('detailBookTitle', bookData.bookTitle);

    // Set Date Borrowed with original value and min constraint
    let borrowDateEl = document.getElementById('detailBorrowDate');
    if (borrowDateEl) {
        // Convert date format from MM/dd/yyyy to YYYY-MM-DD for date input
        const originalBorrowDate = bookData.borrowDate || bookData.dateBorrowed;
        const formattedBorrowDate = convertDateForInput(originalBorrowDate);
        borrowDateEl.value = formattedBorrowDate;
        borrowDateEl.min = formattedBorrowDate;
        // Store the original formatted date
        currentBookData.borrowDate = formattedBorrowDate;
    }

    // Set Due Date with original value
    const dueDateEl = document.getElementById('detailDueDate');
    if (dueDateEl) {
        const formattedDueDate = convertDateForInput(bookData.dueDate);
        dueDateEl.value = formattedDueDate;
    }

    // Set Date Returned with original value
    const dateReturnedEl = document.getElementById('detailDateReturned');
    if (dateReturnedEl) {
        const today = new Date().toISOString().split('T')[0];
        dateReturnedEl.min = today;
        const returnedVal = bookData.dateReturned === '-' ? '' : convertDateForInput(bookData.dateReturned);
        dateReturnedEl.value = returnedVal;
    }

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

    // Handle Teacher-specific restrictions
    handleTeacherRestrictions(bookData.borrowerType);

    setInputsEnabled(false);
    detailsModal.style.display = 'flex';
}

function closeDetailsModal() {
    detailsModal.style.display = 'none';
    isEditing = false;
    currentBookData = null;
}

function handleTeacherRestrictions(borrowerType) {
    // Hide/disable overdue status and fine amount for teachers
    const isTeacher = borrowerType && borrowerType.trim().toLowerCase() === 'teacher';
    
    const overdueStatusEl = document.getElementById('detailOverdueStatus');
    const fineAmountEl = document.getElementById('detailFineAmount');
    const overdueGroup = overdueStatusEl ? overdueStatusEl.closest('.detail-group') : null;
    const fineGroup = fineAmountEl ? fineAmountEl.closest('.detail-group') : null;

    if (isTeacher) {
        // Hide overdue status and fine amount for teachers
        if (overdueGroup) {
            overdueGroup.style.display = 'none';
        }
        if (fineGroup) {
            fineGroup.style.display = 'none';
        }
        
        // Disable overdue status field
        if (overdueStatusEl) {
            overdueStatusEl.disabled = true;
            overdueStatusEl.value = 'No';
        }
        
        // Set fine amount to '-'
        if (fineAmountEl) {
            fineAmountEl.disabled = true;
            fineAmountEl.value = '-';
        }
    } else {
        // Show for students
        if (overdueGroup) {
            overdueGroup.style.display = '';
        }
        if (fineGroup) {
            fineGroup.style.display = '';
        }
        
        // Enable fields
        if (overdueStatusEl) {
            overdueStatusEl.disabled = false;
        }
        if (fineAmountEl) {
            fineAmountEl.disabled = false;
        }
    }
}

function handleEditClick() {
    if (!isEditing) {
        isEditing = true;
        setInputsEnabled(true);
    } else {
        saveBookChanges();
    }
}

function setInputsEnabled(enabled) {
    const editableIds = [
        'detailBorrowerName', 'detailBookTitle', 'detailBorrowDate',
        'detailDateReturned', 'detailOverdueStatus', 'detailReturnStatus',
        'detailBookStatus', 'detailFineAmount'
    ];

    const borrowerType = currentBookData.borrowerType || 'Student';
    const isTeacher = borrowerType.trim().toLowerCase() === 'teacher';

    editableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // For teachers, don't enable overdue status or fine amount
            if (isTeacher && (id === 'detailOverdueStatus' || id === 'detailFineAmount')) {
                el.disabled = true;
            } else {
                el.disabled = !enabled;
            }
            el.style.backgroundColor = enabled && !(isTeacher && (id === 'detailOverdueStatus' || id === 'detailFineAmount')) ? '#fff' : '#e9ecef';
            el.style.border = enabled && !(isTeacher && (id === 'detailOverdueStatus' || id === 'detailFineAmount')) ? '1px solid #3498db' : '1px solid #ced4da';
        }
    });

    // Re-apply date validation when entering edit mode
    if (enabled) {
        setupDateValidation();
    }

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
    const returnStatus = document.getElementById('detailReturnStatus').value;
    const dateReturned = document.getElementById('detailDateReturned').value;
    const borrowerType = currentBookData.borrowerType || 'Student';

    // Validation: Check required fields
    if (!borrowerName || !bookTitle || !borrowDate) {
        alert("Please fill in all required fields.");
        return;
    }

    // Validation: If Return Status is "Not Returned", don't make any changes
    if (returnStatus === 'Not Returned' || !returnStatus) {
        alert("No changes will be made for 'Not Returned' status.");
        return;
    }

    // Validation: If Return Status is "Returned", Date Returned must be filled
    if (returnStatus === 'Returned' && !dateReturned) {
        alert("Please also select the date in Date Returned.");
        return;
    }

    // Validation: Teachers cannot have overdue or fines
    if (borrowerType.trim().toLowerCase() === 'teacher') {
        alert("Teachers are not subject to overdue fines. Please verify the borrower type.");
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
            bookStatus: bookStatus,
            returnStatus: returnStatus,
            dateReturned: dateReturned
        });

        const response = await fetch('/Home/UpdateBorrowedBook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const result = await response.json();

        if (result.success) {
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

function convertDateForInput(dateStr) {
    if (!dateStr || dateStr === '-') return '';
    const [month, day, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

window.toggleOverdueStatus = async function (loanId, button) {
    // Prevent toggle if already "Yes"
    const currentStatus = button.textContent.trim();
    if (currentStatus === 'Yes') {
        return; // Do nothing if already marked as overdue
    }

    const newStatus = 'Yes'; // Can only change from "No" to "Yes"

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

function handleBorrowerTypeChange(borrowerType) {
    // Display a message if Teacher is selected
    const isTeacher = borrowerType && borrowerType.trim().toLowerCase() === 'teacher';
    
    if (isTeacher) {
        const infoMsg = document.getElementById('teacherInfoMsg');
        if (!infoMsg) {
            // Create info message element if it doesn't exist
            const msgDiv = document.createElement('div');
            msgDiv.id = 'teacherInfoMsg';
            msgDiv.style.cssText = 'background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 12px 16px; margin-bottom: 15px; border-radius: 4px; color: #1565c0; font-size: 0.9rem;';
            msgDiv.textContent = 'ℹ️ Teachers are not subject to overdue status or fine amounts.';
            
            const formElement = document.getElementById('issueBookForm');
            if (formElement) {
                formElement.insertBefore(msgDiv, formElement.firstChild);
            }
        }
    } else {
        // Remove info message if Student is selected
        const infoMsg = document.getElementById('teacherInfoMsg');
        if (infoMsg) {
            infoMsg.remove();
        }
    }
}

function validateBorrowerNameFormat(borrowerName) {
    // Check if borrower name contains exactly one comma
    if (!borrowerName.includes(',')) {
        return false;
    }

    // Split by comma and check both parts
    const parts = borrowerName.split(',');
    if (parts.length !== 2) {
        return false;
    }

    // Check if both parts (last name and first name) are non-empty after trimming
    const lastName = parts[0].trim();
    const firstName = parts[1].trim();

    if (lastName.length === 0 || firstName.length === 0) {
        return false;
    }

    // Check if both parts contain only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(lastName) || !nameRegex.test(firstName)) {
        return false;
    }

    return true;
}