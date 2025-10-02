// Insurance Verifier Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeInsuranceVerifierDashboard();
});

function initializeInsuranceVerifierDashboard() {
    // Initialize dashboard functionality
    updateInsuranceStats();
    initializeTaskManagement();
    initializeSummaryUpdates();
    
    // Set up auto-refresh
    setInterval(updateInsuranceStats, 60000); // Update every minute
}

function updateInsuranceStats() {
    // Simulate real-time updates for insurance verifier stats
    const stats = {
        assignedTasks: Math.floor(Math.random() * 5) + 10,
        completedToday: Math.floor(Math.random() * 5) + 15,
        thisWeek: Math.floor(Math.random() * 10) + 90,
        accuracyRate: (95 + Math.random() * 4).toFixed(1) + '%'
    };
    
    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    if (statCards.length >= 4) {
        statCards[0].textContent = stats.assignedTasks;
        statCards[1].textContent = stats.completedToday;
        statCards[2].textContent = stats.thisWeek;
        statCards[3].textContent = stats.accuracyRate;
    }
}

function initializeTaskManagement() {
    // Add event listeners for insurance task actions
    const taskTable = document.querySelector('.table tbody');
    if (taskTable) {
        taskTable.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-primary')) {
                handleInsuranceApprove(e);
            } else if (e.target.classList.contains('btn-danger')) {
                handleInsuranceReject(e);
            } else if (e.target.classList.contains('btn-secondary')) {
                handleInsuranceReview(e);
            }
        });
    }
}

function handleInsuranceApprove(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const vehicleInfo = row.querySelector('.vehicle-info strong').textContent;
    
    if (confirm(`Approve insurance verification for ${vehicleInfo} (${appId})?`)) {
        showNotification('Insurance verification approved successfully!', 'success');
        
        // Update row status
        row.style.backgroundColor = '#f0f9ff';
        row.querySelector('.btn-primary').textContent = 'Approved';
        row.querySelector('.btn-primary').classList.remove('btn-primary');
        row.querySelector('.btn-primary').classList.add('btn-success');
        row.querySelector('.btn-primary').disabled = true;
        
        // Update summary
        updateSummaryStats('approved');
    }
}

function handleInsuranceReject(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const vehicleInfo = row.querySelector('.vehicle-info strong').textContent;
    
    const reason = prompt(`Please provide reason for rejecting insurance verification for ${vehicleInfo} (${appId}):`);
    if (reason && reason.trim()) {
        showNotification(`Insurance verification rejected: ${reason}`, 'warning');
        
        // Update row status
        row.style.backgroundColor = '#fef2f2';
        row.querySelector('.btn-danger').textContent = 'Rejected';
        row.querySelector('.btn-danger').classList.remove('btn-danger');
        row.querySelector('.btn-danger').classList.add('btn-warning');
        row.querySelector('.btn-danger').disabled = true;
        
        // Update summary
        updateSummaryStats('rejected');
    }
}

function handleInsuranceReview(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    
    showNotification(`Opening insurance documents for review (${appId})...`, 'info');
    
    // In a real app, this would open document viewer with insurance-specific documents
    setTimeout(() => {
        window.location.href = 'document-viewer.html?app=' + appId + '&type=insurance';
    }, 1000);
}

function initializeSummaryUpdates() {
    // Initialize summary statistics
    updateSummaryStats();
}

function updateSummaryStats(action = null) {
    const summaryItems = document.querySelectorAll('.summary-item .summary-number');
    if (summaryItems.length >= 4) {
        // Update approved today
        if (action === 'approved') {
            const currentApproved = parseInt(summaryItems[0].textContent);
            summaryItems[0].textContent = currentApproved + 1;
        }
        
        // Update rejected
        if (action === 'rejected') {
            const currentRejected = parseInt(summaryItems[2].textContent);
            summaryItems[2].textContent = currentRejected + 1;
        }
        
        // Update pending review
        if (action === 'approved' || action === 'rejected') {
            const currentPending = parseInt(summaryItems[1].textContent);
            if (currentPending > 0) {
                summaryItems[1].textContent = currentPending - 1;
            }
        }
        
        // Update total coverage (simulate)
        const currentCoverage = summaryItems[3].textContent;
        const coverageValue = parseFloat(currentCoverage.replace('₱', '').replace('M', ''));
        const newCoverage = (coverageValue + Math.random() * 0.1).toFixed(2);
        summaryItems[3].textContent = `₱${newCoverage}M`;
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 4000);
}

// Export functions
window.InsuranceVerifierDashboard = {
    updateInsuranceStats,
    handleInsuranceApprove,
    handleInsuranceReject,
    handleInsuranceReview,
    updateSummaryStats,
    showNotification
};
