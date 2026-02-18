
const reportModal = document.getElementById('reportModal');
const reportFormatBtns = document.querySelectorAll('.report-format-btn');
const closeReportModalBtn = document.getElementById('closeReportModal');
let currentReportType = null;

document.addEventListener('DOMContentLoaded', function() {
    const generateReportBtns = document.querySelectorAll('.btn-green');
    
    generateReportBtns.forEach(btn => {
        if (btn.textContent.includes('Generate Report')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
               
                const pageTitle = document.querySelector('h2')?.textContent.trim();
                
                if (pageTitle.includes('Borrowed')) {
                    currentReportType = 'borrowedbooks';
                } else if (pageTitle.includes('Fine')) {
                    currentReportType = 'fine';
                } else if (pageTitle.includes('Requested')) {
                    currentReportType = 'requestedbooks';
                }
                
                if (currentReportType && reportModal) {
                    reportModal.style.display = 'flex';
                }
            });
        }
    });
});

if (reportFormatBtns.length > 0) {
    reportFormatBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            
            if (currentReportType && format) {
                generateReport(currentReportType, format);
            }
        });
    });
}

if (closeReportModalBtn) {
    closeReportModalBtn.addEventListener('click', function() {
        if (reportModal) {
            reportModal.style.display = 'none';
        }
    });
}

if (reportModal) {
    window.addEventListener('click', function(event) {
        if (event.target === reportModal) {
            reportModal.style.display = 'none';
        }
    });
}

function generateReport(reportType, format) {
    const url = `/Report/GenerateReport?reportType=${reportType}&format=${format}`;
    window.location.href = url;
    
    if (reportModal) {
        reportModal.style.display = 'none';
    }
}
