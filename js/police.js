// Police Dashboard JavaScript

(function() {
    'use strict';

    // Mock data
    const mockStolenVehicles = [
        {
            tokenId: 'TOKEN-001',
            vehicle: 'Toyota Camry 2022',
            dateReported: '2024-01-15',
            location: 'Manila',
            status: 'active'
        }
    ];

    // Initialize dashboard
    function initDashboard() {
        loadUserInfo();
        loadStolenVehicles();
    }

    // Load user information
    function loadUserInfo() {
        const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userName = userData.name || 'Officer Smith';
        const userRole = userData.role || 'police';
        
        document.getElementById('userName').textContent = userName;
        document.getElementById('userRole').textContent = 'Police & Law Enforcement';
        document.getElementById('userAvatar').textContent = userName.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    // Show section
    window.showSection = function(sectionId) {
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });
        
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const section = document.getElementById(sectionId + '-section');
        if (section) {
            section.classList.add('active');
        }
        
        const link = document.querySelector(`[onclick*="${sectionId}"]`);
        if (link) {
            link.classList.add('active');
        }
    };

    // Show report tab
    window.showReportTab = function(tab) {
        document.querySelectorAll('.reports-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('#reports-section .tab-content').forEach(content => content.classList.remove('active'));
        
        const tabMap = {
            'stolen': { btn: 0, content: 'stolen-report-tab' },
            'accident': { btn: 1, content: 'accident-report-tab' },
            'violation': { btn: 2, content: 'violation-report-tab' }
        };
        
        if (tabMap[tab]) {
            document.querySelectorAll('.reports-tabs .tab-btn')[tabMap[tab].btn].classList.add('active');
            document.getElementById(tabMap[tab].content).classList.add('active');
        }
    };

    // Verify ownership
    window.verifyOwnership = function(event) {
        event.preventDefault();
        const tokenId = document.getElementById('verifyTokenId').value.trim();
        
        if (!tokenId) {
            alert('Please enter a Token ID, VIN, or License Plate');
            return;
        }
        
        const resultDiv = document.getElementById('ownershipResult');
        resultDiv.style.display = 'block';
        
        // Simulate verification
        setTimeout(() => {
            resultDiv.className = 'ownership-result verified';
            resultDiv.innerHTML = `
                <h4>✅ Ownership Verified</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Token ID</span>
                        <span class="detail-value">${tokenId}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Owner</span>
                        <span class="detail-value">John Buyer</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Vehicle</span>
                        <span class="detail-value">Toyota Camry 2022</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">License Plate</span>
                        <span class="detail-value">ABC-1234</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">Valid</span>
                    </div>
                </div>
            `;
        }, 1000);
    };

    // Submit stolen report
    window.submitStolenReport = function(event) {
        event.preventDefault();
        
        const reportData = {
            tokenId: document.getElementById('stolenTokenId').value,
            date: document.getElementById('stolenDate').value,
            location: document.getElementById('stolenLocation').value,
            description: document.getElementById('stolenDescription').value
        };
        
        showNotification('Submitting stolen vehicle report...', 'info');
        
        setTimeout(() => {
            // Add to stolen vehicles list
            mockStolenVehicles.push({
                tokenId: reportData.tokenId,
                vehicle: 'Vehicle ' + reportData.tokenId,
                dateReported: reportData.date,
                location: reportData.location,
                status: 'active'
            });
            
            showConfirmationModal('Stolen Vehicle Report', `
                <p>Report submitted successfully.</p>
                <div class="detail-section">
                    <h4>Report Details</h4>
                    <p><strong>Token ID:</strong> ${reportData.tokenId}</p>
                    <p><strong>Date:</strong> ${reportData.date}</p>
                    <p><strong>Location:</strong> ${reportData.location}</p>
                </div>
            `);
            
            event.target.reset();
            loadStolenVehicles();
        }, 1500);
    };

    // Submit accident report
    window.submitAccidentReport = function(event) {
        event.preventDefault();
        
        const reportData = {
            tokenId: document.getElementById('accidentTokenId').value,
            date: document.getElementById('accidentDate').value,
            location: document.getElementById('accidentLocation').value,
            severity: document.getElementById('accidentSeverity').value,
            description: document.getElementById('accidentDescription').value
        };
        
        showNotification('Submitting accident report...', 'info');
        
        setTimeout(() => {
            showConfirmationModal('Accident Report', `
                <p>Accident report submitted successfully.</p>
                <div class="detail-section">
                    <h4>Report Details</h4>
                    <p><strong>Token ID:</strong> ${reportData.tokenId}</p>
                    <p><strong>Date:</strong> ${reportData.date}</p>
                    <p><strong>Location:</strong> ${reportData.location}</p>
                    <p><strong>Severity:</strong> ${reportData.severity}</p>
                </div>
            `);
            
            event.target.reset();
        }, 1500);
    };

    // Submit violation report
    window.submitViolationReport = function(event) {
        event.preventDefault();
        
        const reportData = {
            tokenId: document.getElementById('violationTokenId').value,
            type: document.getElementById('violationType').value,
            date: document.getElementById('violationDate').value,
            location: document.getElementById('violationLocation').value,
            description: document.getElementById('violationDescription').value
        };
        
        showNotification('Submitting violation report...', 'info');
        
        setTimeout(() => {
            showConfirmationModal('Violation Report', `
                <p>Violation report submitted successfully.</p>
                <div class="detail-section">
                    <h4>Report Details</h4>
                    <p><strong>Token ID:</strong> ${reportData.tokenId}</p>
                    <p><strong>Type:</strong> ${reportData.type}</p>
                    <p><strong>Date:</strong> ${reportData.date}</p>
                    <p><strong>Location:</strong> ${reportData.location}</p>
                </div>
            `);
            
            event.target.reset();
        }, 1500);
    };

    // View vehicle history
    window.viewVehicleHistory = function(event) {
        event.preventDefault();
        const tokenId = document.getElementById('historyTokenId').value.trim();
        
        if (!tokenId) {
            alert('Please enter a Token ID, VIN, or License Plate');
            return;
        }
        
        const resultDiv = document.getElementById('historyResult');
        resultDiv.style.display = 'block';
        
        // Simulate history retrieval
        setTimeout(() => {
            resultDiv.innerHTML = `
                <h4>Vehicle History</h4>
                <div class="history-timeline">
                    <div class="history-item">
                        <div class="history-icon">🚗</div>
                        <div class="history-content">
                            <h4>Vehicle Registered</h4>
                            <p>Vehicle was registered on the blockchain</p>
                            <small>2022-01-15</small>
                        </div>
                    </div>
                    <div class="history-item">
                        <div class="history-icon">💰</div>
                        <div class="history-content">
                            <h4>Ownership Transfer</h4>
                            <p>Vehicle ownership transferred to John Buyer</p>
                            <small>2022-01-20</small>
                        </div>
                    </div>
                    <div class="history-item">
                        <div class="history-icon">✅</div>
                        <div class="history-content">
                            <h4>Insurance Verified</h4>
                            <p>Vehicle insurance verified and updated</p>
                            <small>2022-02-01</small>
                        </div>
                    </div>
                </div>
            `;
        }, 1000);
    };

    // Load stolen vehicles
    function loadStolenVehicles() {
        const tableBody = document.getElementById('stolenVehiclesTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (mockStolenVehicles.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No stolen vehicles reported</td></tr>';
            return;
        }
        
        mockStolenVehicles.forEach(vehicle => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vehicle.vehicle}</td>
                <td>${vehicle.tokenId}</td>
                <td>${vehicle.dateReported}</td>
                <td>${vehicle.location}</td>
                <td><span class="stolen-vehicle-badge">${vehicle.status}</span></td>
                <td>
                    <button class="btn-primary btn-sm" onclick="viewVehicleDetails('${vehicle.tokenId}')">View</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // View vehicle details
    window.viewVehicleDetails = function(tokenId) {
        const modal = document.getElementById('vehicleDetailsModal');
        const content = document.getElementById('vehicleDetailsContent');
        
        content.innerHTML = `
            <div class="application-details">
                <div class="detail-section">
                    <h4>🚗 Vehicle Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Token ID</span>
                            <span class="detail-value">${tokenId}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Vehicle</span>
                            <span class="detail-value">Toyota Camry 2022</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Owner</span>
                            <span class="detail-value">John Buyer</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">License Plate</span>
                            <span class="detail-value">ABC-1234</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    };

    // Refresh stolen vehicles
    window.refreshStolenVehicles = function() {
        showNotification('Refreshing stolen vehicles database...', 'info');
        setTimeout(() => {
            loadStolenVehicles();
            showNotification('Database refreshed', 'success');
        }, 1000);
    };

    // Show confirmation modal
    function showConfirmationModal(title, content) {
        const modal = document.getElementById('reportConfirmationModal');
        const modalContent = document.getElementById('reportConfirmationContent');
        
        modalContent.innerHTML = content;
        modal.style.display = 'flex';
    }

    // Close modal
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };

    // Handle logout
    window.handleLogout = function() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            window.location.href = 'login-signup.html';
        }
    };

    // Notification function
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `auth-notification auth-notification-${type}`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.style.minWidth = '300px';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Close modal on outside click
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
        initDashboard();
    }

})();

