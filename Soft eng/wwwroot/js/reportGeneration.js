// Report Format Selection Modal
const reportModal = document.getElementById('reportModal');
const reportFormatBtns = document.querySelectorAll('.report-format-btn');
const closeReportModalBtn = document.getElementById('closeReportModal');
let currentReportType = null;

// Open report modal when Generate Report button is clicked
document.addEventListener('DOMContentLoaded', function() {
    const generateReportBtns = document.querySelectorAll('.btn-green');
    
    generateReportBtns.forEach(btn => {
        if (btn.textContent.includes('Generate Report')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Determine which report type based on current page
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

// Format selection buttons
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

// Close modal button
if (closeReportModalBtn) {
    closeReportModalBtn.addEventListener('click', function() {
        if (reportModal) {
            reportModal.style.display = 'none';
        }
    });
}

// Close modal when clicking outside
if (reportModal) {
    window.addEventListener('click', function(event) {
        if (event.target === reportModal) {
            reportModal.style.display = 'none';
        }
    });
}

// Generate Report function
function generateReport(reportType, format) {
    const url = `/Home/GenerateReport?reportType=${reportType}&format=${format}`;
    window.location.href = url;
    
    // Close modal
    if (reportModal) {
        reportModal.style.display = 'none';
    }
}
