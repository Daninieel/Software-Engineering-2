let selectedFine = null;
let isEditMode = false;
let allFines = []; 

document.addEventListener('DOMContentLoaded', () => {
    const reportBtn = document.getElementById('openReportModal');

    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            const reportType = "fine";

            window.location.href = `/Home/GenerateReport?reportType=${reportType}&format=${format}`;
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadFineData();

    document.getElementById('editFineBtn').addEventListener('click', () => {
        if (!selectedFine) {
            alert("Please select a fine row from the table first.");
            return;
        }
        openFineDetails(selectedFine);
    });

    document.getElementById('btnEditToggle').addEventListener('click', handleEditToggle);

    const searchInput = document.querySelector('.search-filter input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtered = allFines.filter(f =>
                (f.fineID?.toString().toLowerCase().includes(query)) ||
                (f.loanID?.toString().toLowerCase().includes(query)) ||
                (f.borrowerName?.toLowerCase().includes(query)) ||
                (f.paymentStatus?.toLowerCase().includes(query))
            );
            renderFineTable(filtered);
        });
    }
});
function loadFineData() {
    fetch('/Home/GetFines')
        .then(res => res.json())
        .then(data => {
            allFines = data;        
            renderFineTable(data);  
        })
        .catch(err => console.error("Error loading fines:", err));
}

function renderFineTable(data) {
    const tbody = document.getElementById('fineTableBody');
    const totalDisplay = document.getElementById('grandTotalDisplay');

    if (!tbody) return;

    tbody.innerHTML = '';
    selectedFine = null;

    let grandTotal = 0;

    data.forEach(fine => {
        const fineAmount = fine.fineAmount ?? 0;
        grandTotal += fineAmount;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${fine.fineID}</td>
            <td>${fine.loanID}</td>
            <td>${fine.borrowerName}</td>
            <td>
                <span class="status-${fine.paymentStatus.toLowerCase()}">
                    ${fine.paymentStatus}
                </span>
            </td>
            <td>₱${fineAmount.toFixed(2)}</td>
            <td>${fine.datePaid || '-'}</td>
        `;

        tr.addEventListener('click', () => {
            document.querySelectorAll('#fineTableBody tr').forEach(r => r.classList.remove('selected-row'));
            tr.classList.add('selected-row');
            selectedFine = fine;
        });

        tbody.appendChild(tr);
    });

    if (totalDisplay) {
        totalDisplay.innerText = `₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

function openFineDetails(fine) {
    isEditMode = false;
    const btn = document.getElementById('btnEditToggle');
    btn.innerText = 'Edit';
    btn.className = 'btn btn-blue';

    document.getElementById('detailFineID').value = fine.fineID;
    document.getElementById('detailBorrowerName').value = fine.borrowerName;
    document.getElementById('detailLoanID').value = fine.loanID;
    document.getElementById('detailPaymentStatus').value = fine.paymentStatus;
    document.getElementById('detailFineAmount').value = fine.fineAmount ?? 0;

    if (fine.datePaid && fine.datePaid !== "-") {
        const dateParts = fine.datePaid.split('/');
        if (dateParts.length === 3) {
            document.getElementById('detailDatePaid').value =
                `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
        }
    } else {
        document.getElementById('detailDatePaid').value = '';
    }

    setInputsDisabled(true);
    document.getElementById('fineDetailsModal').style.display = 'flex';
}

function handleEditToggle() {
    const btn = document.getElementById('btnEditToggle');
    if (!isEditMode) {
        isEditMode = true;
        btn.innerText = 'Save';
        btn.className = 'btn btn-green';
        setInputsDisabled(false);
    } else {
        saveFineChanges();
    }
}
function setInputsDisabled(disabled) {
    ['detailPaymentStatus', 'detailFineAmount', 'detailDatePaid'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
    });
}

function saveFineChanges() {
    const formData = new URLSearchParams();
    formData.append('FineID', document.getElementById('detailFineID').value);
    formData.append('PaymentStatus', document.getElementById('detailPaymentStatus').value);
    formData.append('FineAmount', document.getElementById('detailFineAmount').value);
    formData.append('totalFineAmount', document.getElementById('detailFineAmount').value);
    formData.append('DatePaid', document.getElementById('detailDatePaid').value);

    fetch('/Home/EditFine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Update Successful!");
                closeFineModal();
                loadFineData();
            } else {
                alert("Error: " + data.error);
            }
        });
}

function closeFineModal() {
    document.getElementById('fineDetailsModal').style.display = 'none';
    isEditMode = false;
}
