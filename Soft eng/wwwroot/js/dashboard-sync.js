/**
 * Dashboard Auto-Sync
 * Keeps the dashboard in sync with borrowed books changes
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard sync when on Dashboard or AdminDashboard page
    const isDashboardPage = window.location.href.includes('Dashboard') || 
                           window.location.href.includes('AdminDashboard');
    
    if (isDashboardPage) {
        initializeDashboardSync();
    }
});

function initializeDashboardSync() {
    // Refresh dashboard every 10 seconds
    setInterval(refreshDashboardData, 10000);
    
    // Also refresh when the page becomes visible (user switches tabs)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            refreshDashboardData();
        }
    });
    
    // Listen for messages from other tabs/windows
    window.addEventListener('storage', function(e) {
        if (e.key === 'dashboard-refresh-trigger') {
            refreshDashboardData();
        }
    });
}

async function refreshDashboardData() {
    try {
        const response = await fetch('/Home/GetDashboardData');
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Update all stats
        updateStatBox('Total Books', data.totalBooks);
        updateStatBox('Borrowed Books', data.totalBorrowed);
        updateStatBox('Returned Books', data.totalReturned);
        updateStatBox('Overdue Books', data.totalOverdue);
        updateStatBox('Missing Books', data.totalMissing);
        updateStatBox('Damaged Books', data.totalDamaged);
        updateStatBox('Total Fine', '?' + data.totalFine);
        
        // Update Overdue History table
        updateOverdueHistoryTable(data.overdueList);
        
        // Update Recent Borrowed Books table
        updateRecentBooksTable(data.recentList);
        
    } catch (error) {
        console.error('Failed to refresh dashboard:', error);
    }
}

function updateStatBox(label, value) {
    const statBoxes = document.querySelectorAll('.stat-box');
    const totalBox = document.querySelector('.total-books-box');
    
    // Check total books box first
    if (totalBox) {
        const labelEl = totalBox.querySelector('.total-books-label');
        if (labelEl && labelEl.textContent.trim() === label) {
            const valueEl = totalBox.querySelector('.total-books-value');
            if (valueEl && valueEl.textContent !== String(value)) {
                valueEl.textContent = String(value);
                highlightUpdate(valueEl);
            }
            return;
        }
    }
    
    // Check stat boxes
    statBoxes.forEach(box => {
        const labelEl = box.querySelector('.stat-label');
        if (labelEl && labelEl.textContent.trim() === label) {
            const valueEl = box.querySelector('.stat-value');
            if (valueEl && valueEl.textContent !== String(value)) {
                valueEl.textContent = String(value);
                highlightUpdate(valueEl);
            }
        }
    });
}

function updateOverdueHistoryTable(overdueList) {
    const table = document.querySelector('table');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // Check if this is the Overdue History table (has 5 columns)
    const headerRow = table.querySelector('thead tr');
    const headerCells = headerRow ? headerRow.querySelectorAll('th') : [];
    if (headerCells.length !== 5) return;
    
    // Check if first table (Overdue History)
    const firstTable = document.querySelectorAll('.table-card')[0];
    if (!firstTable || !firstTable.querySelector('table')?.contains(table)) return;
    
    // Generate new HTML
    let html = '';
    if (overdueList && overdueList.length > 0) {
        overdueList.forEach(item => {
            html += `
                <tr>
                    <td>${item.userID}</td>
                    <td>${item.name}</td>
                    <td>${item.dateBorrowed}</td>
                    <td>?${item.fine}</td>
                    <td style="color: #e74c3c; font-weight: 600;">Overdue</td>
                </tr>
            `;
        });
    } else {
        html = '<tr><td colspan="5" class="no-data">No overdue records</td></tr>';
    }
    
    tbody.innerHTML = html;
}

function updateRecentBooksTable(recentList) {
    const tables = document.querySelectorAll('.table-card table');
    if (tables.length < 2) return;
    
    const secondTableBody = tables[1].querySelector('tbody');
    if (!secondTableBody) return;
    
    // Generate new HTML
    let html = '';
    if (recentList && recentList.length > 0) {
        recentList.forEach(item => {
            html += `<tr><td>${item.title}</td></tr>`;
        });
    } else {
        html = '<tr><td class="no-data">No recent borrowed books</td></tr>';
    }
    
    secondTableBody.innerHTML = html;
}

function highlightUpdate(element) {
    // Add a subtle flash animation to show the update
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = '#ffffcc';
    setTimeout(() => {
        element.style.backgroundColor = '';
        element.style.transition = '';
    }, 500);
}

// Trigger refresh when overdue status is updated from borrowed books
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'overdue-updated') {
        refreshDashboardData();
    }
});

// Make refresh function globally available for manual triggers
window.refreshDashboardData = refreshDashboardData;
