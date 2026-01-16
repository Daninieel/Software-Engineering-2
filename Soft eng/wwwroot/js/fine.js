let allFines = [];
let currentPage = 1;
const rowsPerPage = 10;
let selectedFine = null;
let isEditMode = false;

let fineTableBody, pageList, grandTotalDisplay;
let prevBtn, nextBtn, gotoInput;
let reportBtn, editFineBtn, btnEditToggle;

// Rename searchInput to be more specific
let fineSearchInput;
let filteredFines = [];

document.addEventListener('DOMContentLoaded', function () {
    fineTableBody = document.getElementById('fineTableBody');
    pageList = document.querySelector('.page-list');
    grandTotalDisplay = document.getElementById('grandTotalDisplay');

    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');
    gotoInput = document.querySelector('.goto-input');

    reportBtn = document.getElementById('openReportModal');
    editFineBtn = document.getElementById('editFineBtn');
    btnEditToggle = document.getElementById('btnEditToggle');
    
    // Setup search functionality
    setupFineSearch();

    if (prevBtn) prevBtn.addEventListener('click', e => { e.preventDefault(); changePage(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener('click', e => { e.preventDefault(); changePage(currentPage + 1); });
    if (gotoInput) gotoInput.addEventListener('change', function () { const pageNum = parseInt(this.value); if (!isNaN(pageNum)) changePage(pageNum); this.value = ''; });

    if (reportBtn) {
        reportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('.report-modal').style.display = 'flex';
        });
    }

    const pdfBtn = document.querySelector('.report-format-btn.pdf');
    const csvBtn = document.querySelector('.report-format-btn.csv');
    const closeReportBtn = document.querySelector('.close-report-modal');

    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            window.location.href = `/Home/GenerateReport?reportType=fine&format=pdf`;
            closeReportModal();
        });
    }

    if (csvBtn) {
        csvBtn.addEventListener('click', () => {
            window.location.href = `/Home/GenerateReport?reportType=fine&format=csv`;
            closeReportModal();
        });
    }

    if (closeReportBtn) closeReportBtn.addEventListener('click', closeReportModal);

    window.addEventListener('click', (e) => {
        const modal = document.querySelector('.report-modal');
        if (e.target === modal) closeReportModal();
    });

    if (editFineBtn) editFineBtn.addEventListener('click', () => { if (!selectedFine) { alert("Please select a fine row from the table first."); return; } openFineDetails(selectedFine); });
    if (btnEditToggle) btnEditToggle.addEventListener('click', handleEditToggle);

    loadFines();
});

// Refactor search setup to be more generic and reusable
function setupFineSearch() {
    const searchInputs = document.querySelectorAll('input[placeholder*="Search"], input[placeholder*="search"]');
    searchInputs.forEach(input => {
        input.addEventListener('keyup', function () {
            filterFines(this.value.toLowerCase());
        });
    });
}

// Generic filter function for fines
function filterFines(query) {
    if (!query) {
        filteredFines = [...allFines];
    } else {
        filteredFines = allFines.filter(fine => {
            const fineId = fine.fineID.toString().toLowerCase();
            const loanId = fine.loanID.toString().toLowerCase();
            const borrowerName = (fine.borrowerName || '').toLowerCase();
            
            return fineId.includes(query) || 
                   loanId.includes(query) || 
                   borrowerName.includes(query);
        });
    }
    
    currentPage = 1;
    calculateGrandTotal(filteredFines);
    changePage(1);
}

function closeReportModal() {
    document.querySelector('.report-modal').style.display = 'none';
}

async function loadFines() {
    try {
        if (fineTableBody) fineTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Loading...</td></tr>`;
        const response = await fetch('/Home/GetFines');
        if (!response.ok) throw new Error('Failed to fetch fines');

        const data = await response.json();
        if (data && data.length > 0) {
            allFines = data.sort((a, b) => a.fineID - b.fineID);
            filteredFines = [...allFines];
            calculateGrandTotal(filteredFines);
            changePage(1);
        } else {
            allFines = [];
            filteredFines = [];
            if (fineTableBody) fineTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No records found.</td></tr>`;
            if (grandTotalDisplay) grandTotalDisplay.textContent = "₱0.00";
            updatePaginationUI();
        }
    } catch (error) {
        console.error(error);
        if (fineTableBody) fineTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error loading data.</td></tr>`;
    }
}

function calculateGrandTotal(data) {
    if (grandTotalDisplay) {
        const total = data.reduce((sum, fine) => sum + (parseFloat(fine.fineAmount) || 0), 0);
        grandTotalDisplay.textContent = '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2 });
    }
}

function changePage(page) {
    const totalPages = Math.ceil(filteredFines.length / rowsPerPage);
    if (page < 1) page = 1;
    if (page > totalPages && totalPages > 0) page = totalPages;
    currentPage = page;
    renderTableRows();
    updatePaginationUI();
}

function renderTableRows() {
    if (!fineTableBody) return;
    fineTableBody.innerHTML = '';
    selectedFine = null;
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const itemsToShow = filteredFines.slice(start, end);
    if (itemsToShow.length === 0) {
        fineTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No records found.</td></tr>`;
        return;
    }
    itemsToShow.forEach(fine => createRow(fine));
}

function createRow(fine) {
    const row = document.createElement('tr');
    row.dataset.id = fine.fineID;
    const datePaid = fine.datePaid ? new Date(fine.datePaid).toLocaleDateString() : '-';
    const amount = parseFloat(fine.fineAmount).toFixed(2);
    const statusClass = fine.paymentStatus === 'Paid' ? 'status-paid' : 'status-unpaid';
    row.innerHTML = `
        <td>${fine.fineID}</td>
        <td>${fine.loanID}</td>
        <td>${fine.borrowerName || 'Unknown'}</td>
        <td><span class="status-badge ${statusClass}">${fine.paymentStatus}</span></td>
        <td>₱${amount}</td>
        <td>${datePaid}</td>
    `;
    row.addEventListener('click', function () {
        document.querySelectorAll('#fineTableBody tr').forEach(r => r.classList.remove('selected-row'));
        this.classList.add('selected-row');
        selectedFine = fine;
    });
    fineTableBody.appendChild(row);
}

function updatePaginationUI() {
    if (!pageList) return;
    pageList.innerHTML = '';
    const totalPages = Math.ceil(filteredFines.length / rowsPerPage);
    if (totalPages === 0) return;
    let pagesToShow = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pagesToShow.push(i); }
    else if (currentPage <= 4) pagesToShow = [1, 2, 3, 4, 5, '...', totalPages];
    else if (currentPage >= totalPages - 3) pagesToShow = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    else pagesToShow = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];

    pagesToShow.forEach(p => {
        const li = document.createElement('li');
        if (p === '...') li.innerHTML = `<span class="dots">...</span>`;
        else {
            const a = document.createElement('a');
            a.href = "#";
            a.classList.add('page-link');
            a.textContent = p;
            if (p === currentPage) a.classList.add('active');
            a.addEventListener('click', e => { e.preventDefault(); changePage(p); });
            li.appendChild(a);
        }
        pageList.appendChild(li);
    });
}

function openFineDetails(fine) {
    isEditMode = false;
    const btn = document.getElementById('btnEditToggle');
    if (btn) { btn.innerText = 'Edit'; btn.className = 'btn btn-blue'; }
    document.getElementById('detailFineID').value = fine.fineID;
    document.getElementById('detailBorrowerName').value = fine.borrowerName;
    document.getElementById('detailLoanID').value = fine.loanID;
    document.getElementById('detailPaymentStatus').value = fine.paymentStatus;
    document.getElementById('detailFineAmount').value = fine.fineAmount ?? 0;
    if (fine.datePaid && fine.datePaid !== "-") {
        const dateParts = fine.datePaid.split('/');
        if (dateParts.length === 3) document.getElementById('detailDatePaid').value = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
        else { const d = new Date(fine.datePaid); if (!isNaN(d)) document.getElementById('detailDatePaid').value = d.toISOString().split('T')[0]; }
    } else document.getElementById('detailDatePaid').value = '';
    setInputsDisabled(true);
    document.getElementById('fineDetailsModal').style.display = 'flex';
}

function handleEditToggle() {
    const btn = document.getElementById('btnEditToggle');
    if (!isEditMode) { isEditMode = true; btn.innerText = 'Save'; btn.className = 'btn btn-green'; setInputsDisabled(false); }
    else saveFineChanges();
}

function setInputsDisabled(disabled) {
    ['detailPaymentStatus', 'detailFineAmount', 'detailDatePaid'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = disabled; });
}

function saveFineChanges() {
    const formData = new URLSearchParams();
    formData.append('FineID', document.getElementById('detailFineID').value);
    formData.append('PaymentStatus', document.getElementById('detailPaymentStatus').value);
    formData.append('FineAmount', document.getElementById('detailFineAmount').value);
    formData.append('totalFineAmount', document.getElementById('detailFineAmount').value);
    formData.append('DatePaid', document.getElementById('detailDatePaid').value);

    fetch('/Home/EditFine', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData })
        .then(res => res.json())
        .then(data => { if (data.success) { alert("Update Successful!"); closeFineModal(); loadFines(); } else alert("Error: " + data.error); })
        .catch(err => { console.error(err); alert("Failed to update fine."); });
}

function closeFineModal() { document.getElementById('fineDetailsModal').style.display = 'none'; isEditMode = false; }

window.closeFineModal = closeFineModal;