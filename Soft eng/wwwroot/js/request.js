let selectedRequest = null;
let allRequests = [];
let filteredRequests = [];

function openViewRequestModal(id, name, title, date, status, remarks) {
    document.getElementById("viewRequestID").innerText = id;
    document.getElementById("viewRequesterName").innerText = name;
    document.getElementById("viewRequestedTitle").innerText = title;
    document.getElementById("viewDateRequested").innerText = date;
    document.getElementById("viewStatus").innerText = status;
    document.getElementById("viewRemarks").value = remarks;
    document.getElementById("viewRequestModal").style.display = "block";
}

function closeViewRequestModal() {
    document.getElementById("viewRequestModal").style.display = "none";
}

function openEditRequest() {
    if (!selectedRequest) {
        alert("Please select a request first.");
        return;
    }

    document.getElementById("editRequestID").value = selectedRequest.id;
    document.getElementById("editRequesterName").value = selectedRequest.name;
    document.getElementById("editRequestedTitle").value = selectedRequest.title;
    document.getElementById("editDateRequested").value = selectedRequest.date;
    document.getElementById("editStatus").value = selectedRequest.status;
    document.getElementById("editRemarks").value = selectedRequest.remarks;

    document.getElementById("editRequestModal").style.display = "block";
}

function closeEditModal() {
    document.getElementById("editRequestModal").style.display = "none";
}

function initializeRequests() {
    const table = document.getElementById("requestsTable");
    if (table) {
        const rows = table.querySelectorAll("tbody tr.request-row");
        allRequests = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            allRequests.push({
                id: cells[0].textContent.trim(),
                name: cells[1].textContent.trim(),
                title: cells[2].textContent.trim(),
                date: cells[3].textContent.trim(),
                status: cells[4].textContent.trim(),
                remarks: cells[5].textContent.trim(),
                rowElement: row
            });
        });
        filteredRequests = [...allRequests];
    }
    setupRequestSearchListener();
}

function setupRequestSearchListener() {
    const searchInputs = document.querySelectorAll('input[placeholder*="Search"], input[placeholder*="search"]');
    searchInputs.forEach(input => {
        input.addEventListener('keyup', function () {
            filterRequests(this.value.toLowerCase());
        });
    });
}

function filterRequests(query) {
    if (!query) {
        filteredRequests = [...allRequests];
    } else {
        filteredRequests = allRequests.filter(req => {
            const id = req.id.toLowerCase();
            const name = req.name.toLowerCase();
            const title = req.title.toLowerCase();
            
            return id.includes(query) || 
                   name.includes(query) || 
                   title.includes(query);
        });
    }
    
    // Hide/show rows based on filter
    allRequests.forEach(req => {
        const isInFiltered = filteredRequests.some(f => f.id === req.id);
        req.rowElement.style.display = isInFiltered ? '' : 'none';
    });
}

document.addEventListener("DOMContentLoaded", function () {

    initializeRequests();

    const genReportBtn = document.getElementById("generateReportBtn");
    const reportModal = document.getElementById("reportModal");
    const closeReportBtn = document.getElementById("closeReportModal");

    if (genReportBtn) genReportBtn.onclick = () => reportModal.style.display = "block";
    if (closeReportBtn) closeReportBtn.onclick = () => reportModal.style.display = "none";

    const addRequestBtn = document.getElementById("addRequestBtn");
    const addRequestModal = document.getElementById("addRequestModal");
    const cancelRequestBtn = document.getElementById("cancelRequestBtn");

    if (addRequestBtn) addRequestBtn.onclick = () => addRequestModal.style.display = "block";
    if (cancelRequestBtn) cancelRequestBtn.onclick = () => addRequestModal.style.display = "none";

    window.onclick = function (event) {
        const rModal = document.getElementById("reportModal");
        const aModal = document.getElementById("addRequestModal");
        const vModal = document.getElementById("viewRequestModal");
        const eModal = document.getElementById("editRequestModal");

        if (event.target === rModal) rModal.style.display = "none";
        if (event.target === aModal) aModal.style.display = "none";
        if (event.target === vModal) vModal.style.display = "none";
        if (event.target === eModal) eModal.style.display = "none";
    };


    const tableBody = document.querySelector("#requestsTable tbody");

    if (tableBody) {
        tableBody.addEventListener("click", function (e) {
            const row = e.target.closest(".request-row");
            if (!row || e.target.closest("button")) return;

            document.querySelectorAll(".request-row").forEach(r =>
                r.classList.remove("selected")
            );
            row.classList.add("selected");

            selectedRequest = {
                id: row.dataset.id,
                name: row.dataset.name,
                title: row.dataset.title,
                date: row.dataset.date,
                status: row.dataset.status,
                remarks: row.dataset.remarks
            };
        });
    }


    const rowsPerPage = 10;
    const rows = Array.from(document.querySelectorAll("#requestsTable tbody tr"));
    const pageList = document.querySelector(".page-list");
    const gotoInput = document.querySelector(".goto-input");
    const navArrows = document.querySelectorAll(".nav-arrow");

    const prevBtn = navArrows[0];
    const nextBtn = navArrows[1];

    let currentPage = 1;
    const totalPages = Math.ceil(rows.length / rowsPerPage);

    function displayPage(page) {
        selectedRequest = null;
        document.querySelectorAll(".request-row").forEach(r =>
            r.classList.remove("selected")
        );

        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;

        rows.forEach(row => row.style.display = "none");

        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        rows.slice(start, end).forEach(row => row.style.display = "");

        updatePaginationUI();
    }

    function updatePaginationUI() {
        if (!pageList) return;
        pageList.innerHTML = "";

        let pagesToShow = [];

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
        } else {
            if (currentPage <= 4) {
                pagesToShow = [1, 2, 3, 4, 5, "...", totalPages];
            } else if (currentPage >= totalPages - 3) {
                pagesToShow = [
                    1, "...",
                    totalPages - 4,
                    totalPages - 3,
                    totalPages - 2,
                    totalPages - 1,
                    totalPages
                ];
            } else {
                pagesToShow = [
                    1, "...",
                    currentPage - 1,
                    currentPage,
                    currentPage + 1,
                    "...",
                    totalPages
                ];
            }
        }

        pagesToShow.forEach(p => {
            const li = document.createElement("li");

            if (p === "...") {
                li.innerHTML = `<span class="dots">...</span>`;
            } else {
                const a = document.createElement("a");
                a.href = "#";
                a.classList.add("page-link");
                a.textContent = p;
                if (p === currentPage) a.classList.add("active");

                a.addEventListener("click", e => {
                    e.preventDefault();
                    displayPage(p);
                });

                li.appendChild(a);
            }

            pageList.appendChild(li);
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", e => {
            e.preventDefault();
            if (currentPage > 1) displayPage(currentPage - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", e => {
            e.preventDefault();
            if (currentPage < totalPages) displayPage(currentPage + 1);
        });
    }

    if (gotoInput) {
        gotoInput.addEventListener("change", function () {
            const pageNum = parseInt(this.value);
            if (!isNaN(pageNum)) displayPage(pageNum);
            this.value = "";
        });
    }

    if (rows.length > 0) {
        displayPage(1);
    }
});
