// Emission Verifier Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeVerifierDashboard();
});

function initializeVerifierDashboard() {
    // Initialize dashboard functionality
    updateVerifierStats();
    initializeTaskManagement();
    initializeEmissionReports();
    
    // Set up auto-refresh
    setInterval(updateVerifierStats, 60000); // Update every minute
}

function updateVerifierStats() {
    // Simulate real-time updates for emission verifier stats
    const stats = {
        assignedTasks: Math.floor(Math.random() * 3) + 6,
        completedToday: Math.floor(Math.random() * 5) + 12,
        thisWeek: Math.floor(Math.random() * 8) + 88,
        accuracyRate: (98 + Math.random() * 1).toFixed(1) + '%'
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
    // Add event listeners for emission task actions
    const taskTable = document.querySelector('.table tbody');
    if (taskTable) {
        taskTable.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-primary')) {
                handleEmissionApprove(e);
            } else if (e.target.classList.contains('btn-danger')) {
                handleEmissionReject(e);
            } else if (e.target.classList.contains('btn-secondary')) {
                handleEmissionReview(e);
            }
        });
    }
}

function handleEmissionApprove(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const vehicleInfo = row.querySelector('.vehicle-info strong').textContent;
    const emissionTest = row.querySelector('td:nth-child(3)').textContent;
    
    if (confirm(`Approve emission test for ${vehicleInfo} (${appId})? Test result: ${emissionTest}`)) {
        showNotification('Emission test approved successfully!', 'success');
        
        // Update row status
        row.style.backgroundColor = '#f0f9ff';
        row.querySelector('.btn-primary').textContent = 'Approved';
        row.querySelector('.btn-primary').classList.remove('btn-primary');
        row.querySelector('.btn-primary').classList.add('btn-success');
        row.querySelector('.btn-primary').disabled = true;
        
        // Update status badge
        const statusBadge = row.querySelector('.status-badge');
        statusBadge.textContent = 'Approved';
        statusBadge.className = 'status-badge status-approved';
        
        // Update stats
        updateTaskStats('approved');
    }
}

function handleEmissionReject(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const vehicleInfo = row.querySelector('.vehicle-info strong').textContent;
    const emissionTest = row.querySelector('td:nth-child(3)').textContent;
    
    const reason = prompt(`Please provide reason for rejecting emission test for ${vehicleInfo} (${appId}):`);
    if (reason && reason.trim()) {
        showNotification(`Emission test rejected: ${reason}`, 'warning');
        
        // Update row status
        row.style.backgroundColor = '#fef2f2';
        row.querySelector('.btn-danger').textContent = 'Rejected';
        row.querySelector('.btn-danger').classList.remove('btn-danger');
        row.querySelector('.btn-danger').classList.add('btn-warning');
        row.querySelector('.btn-danger').disabled = true;
        
        // Update status badge
        const statusBadge = row.querySelector('.status-badge');
        statusBadge.textContent = 'Rejected';
        statusBadge.className = 'status-badge status-rejected';
        
        // Update stats
        updateTaskStats('rejected');
    }
}

function handleEmissionReview(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const emissionTest = row.querySelector('td:nth-child(3)').textContent;
    
    showNotification(`Opening emission test documents for review (${appId})...`, 'info');
    
    // In a real app, this would open document viewer with emission-specific documents
    setTimeout(() => {
        window.location.href = 'document-viewer.html?app=' + appId + '&type=emission';
    }, 1000);
}

function initializeEmissionReports() {
    // Initialize emission report generation
    const reportButton = document.querySelector('.dashboard-card:nth-child(2) .btn-secondary');
    if (reportButton) {
        reportButton.addEventListener('click', handleGenerateReport);
    }
}

function handleGenerateReport() {
    showNotification('Generating emission compliance report...', 'info');
    
    // Simulate report generation
    setTimeout(() => {
        showNotification('Emission compliance report generated successfully!', 'success');
        
        // In a real app, this would download the report or show it in a modal
        showReportModal();
    }, 2000);
}

function showReportModal() {
    // Create modal for emission report
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Emission Compliance Report</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="report-summary">
                    <div class="report-item">
                        <span class="report-label">Total Tests Reviewed:</span>
                        <span class="report-value">127</span>
                    </div>
                    <div class="report-item">
                        <span class="report-label">Passed Tests:</span>
                        <span class="report-value">118 (92.9%)</span>
                    </div>
                    <div class="report-item">
                        <span class="report-label">Failed Tests:</span>
                        <span class="report-value">9 (7.1%)</span>
                    </div>
                    <div class="report-item">
                        <span class="report-label">Average CO2 Level:</span>
                        <span class="report-value">2.1 g/km</span>
                    </div>
                </div>
                <div class="report-actions">
                    <button class="btn-primary" onclick="downloadReport()">Download PDF</button>
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function downloadReport() {
    showNotification('Downloading emission compliance report...', 'info');
    
    // Simulate download
    setTimeout(() => {
        showNotification('Report downloaded successfully!', 'success');
    }, 1500);
}

function updateTaskStats(action) {
    // Update task statistics based on action
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    if (statCards.length >= 3) {
        if (action === 'approved' || action === 'rejected') {
            // Decrease assigned tasks
            const assignedTasks = parseInt(statCards[0].textContent);
            if (assignedTasks > 0) {
                statCards[0].textContent = assignedTasks - 1;
            }
            
            // Increase completed today
            const completedToday = parseInt(statCards[1].textContent);
            statCards[1].textContent = completedToday + 1;
        }
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

// Export functions for potential external use
window.VerifierDashboard = {
    updateVerifierStats,
    handleEmissionApprove,
    handleEmissionReject,
    handleEmissionReview,
    handleGenerateReport,
    updateTaskStats,
    showNotification
};
