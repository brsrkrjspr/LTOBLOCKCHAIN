// Bank Dashboard JavaScript

(function() {
    'use strict';

    // Mock data
    const mockCollateral = [
        {
            tokenId: 'TOKEN-001',
            vehicle: 'Toyota Camry 2022',
            owner: 'John Buyer',
            loanAmount: 500000,
            status: 'active',
            dateFiled: '2024-01-15'
        }
    ];

    const mockFinancingApplications = [
        {
            id: 'FIN-001',
            applicant: 'John Buyer',
            vehicle: 'Honda Civic 2024',
            loanAmount: 800000,
            date: '2024-03-01',
            status: 'pending'
        },
        {
            id: 'FIN-002',
            applicant: 'Jane Seller',
            vehicle: 'Toyota Corolla 2023',
            loanAmount: 600000,
            date: '2024-02-15',
            status: 'approved'
        }
    ];

    const mockLiens = [
        {
            tokenId: 'TOKEN-001',
            vehicle: 'Toyota Camry 2022',
            lienHolder: 'Bank ABC',
            lienAmount: 500000,
            dateFiled: '2024-01-15',
            status: 'active'
        }
    ];

    // Initialize dashboard
    function initDashboard() {
        loadUserInfo();
        loadCollateral();
        loadFinancingApplications();
        loadLiens();
    }

    // Load user information
    function loadUserInfo() {
        const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userName = userData.name || 'Bank Manager';
        const userRole = userData.role || 'bank';
        
        document.getElementById('userName').textContent = userName;
        document.getElementById('userRole').textContent = 'Bank & Financing Institution';
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

    // Show financing tab
    window.showFinancingTab = function(tab) {
        document.querySelectorAll('.financing-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('#financing-section .tab-content').forEach(content => content.classList.remove('active'));
        
        const tabMap = {
            'pending': { btn: 0, content: 'pending-financing-tab' },
            'approved': { btn: 1, content: 'approved-financing-tab' },
            'rejected': { btn: 2, content: 'rejected-financing-tab' }
        };
        
        if (tabMap[tab]) {
            document.querySelectorAll('.financing-tabs .tab-btn')[tabMap[tab].btn].classList.add('active');
            document.getElementById(tabMap[tab].content).classList.add('active');
        }
        
        loadFinancingApplications();
    };

    // Check ownership
    window.checkOwnership = function(event) {
        event.preventDefault();
        const tokenId = document.getElementById('ownershipTokenId').value.trim();
        
        if (!tokenId) {
            alert('Please enter a Token ID, VIN, or License Plate');
            return;
        }
        
        const resultDiv = document.getElementById('ownershipResult');
        resultDiv.style.display = 'block';
        
        // Simulate ownership check
        setTimeout(() => {
            const hasLien = mockLiens.some(l => l.tokenId === tokenId);
            
            resultDiv.className = hasLien ? 'ownership-result has-lien' : 'ownership-result verified';
            resultDiv.innerHTML = `
                <h4>${hasLien ? '⚠️ Ownership with Lien' : '✅ Ownership Verified'}</h4>
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
                    ${hasLien ? `
                    <div class="detail-item">
                        <span class="detail-label">Lien Status</span>
                        <span class="detail-value"><span class="lien-badge active">Active Lien</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Lien Amount</span>
                        <span class="detail-value">₱500,000</span>
                    </div>
                    ` : ''}
                </div>
            `;
        }, 1000);
    };

    // Load collateral
    function loadCollateral() {
        const total = mockCollateral.length;
        const active = mockCollateral.filter(c => c.status === 'active').length;
        const released = mockCollateral.filter(c => c.status === 'released').length;
        
        document.getElementById('totalCollateral').textContent = total;
        document.getElementById('activeCollateral').textContent = active;
        document.getElementById('releasedCollateral').textContent = released;
        
        const tableBody = document.getElementById('collateralTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (mockCollateral.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No collateral records</td></tr>';
            return;
        }
        
        mockCollateral.forEach(collateral => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${collateral.vehicle}</td>
                <td>${collateral.tokenId}</td>
                <td>${collateral.owner}</td>
                <td>₱${collateral.loanAmount.toLocaleString()}</td>
                <td><span class="application-status ${collateral.status}">${collateral.status}</span></td>
                <td>
                    <button class="btn-primary btn-sm" onclick="viewCollateralDetails('${collateral.tokenId}')">View</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Load financing applications
    function loadFinancingApplications() {
        const pending = mockFinancingApplications.filter(a => a.status === 'pending');
        const approved = mockFinancingApplications.filter(a => a.status === 'approved');
        const rejected = mockFinancingApplications.filter(a => a.status === 'rejected');
        
        loadFinancingTable('pendingFinancingTableBody', pending);
        loadFinancingTable('approvedFinancingTableBody', approved);
        loadFinancingTable('rejectedFinancingTableBody', rejected);
    }

    function loadFinancingTable(tableId, applications) {
        const tableBody = document.getElementById(tableId);
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (applications.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No applications</td></tr>';
            return;
        }
        
        applications.forEach(app => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.id}</td>
                <td>${app.applicant}</td>
                <td>${app.vehicle}</td>
                <td>₱${app.loanAmount.toLocaleString()}</td>
                <td>${app.date}</td>
                ${app.status === 'pending' ? `
                <td>
                    <button class="btn-primary btn-sm" onclick="viewFinancingApplication('${app.id}')">Review</button>
                </td>
                ` : app.status === 'approved' ? `
                <td><span class="application-status approved">Approved</span></td>
                ` : `
                <td><span class="application-status rejected">Rejected</span></td>
                `}
            `;
            tableBody.appendChild(row);
        });
    }

    // View financing application
    window.viewFinancingApplication = function(appId) {
        const app = mockFinancingApplications.find(a => a.id === appId);
        if (!app) return;
        
        const modal = document.getElementById('financingApplicationModal');
        const content = document.getElementById('financingApplicationContent');
        
        content.innerHTML = `
            <div class="application-details">
                <div class="detail-section">
                    <h4>💰 Financing Application</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Application ID</span>
                            <span class="detail-value">${app.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Applicant</span>
                            <span class="detail-value">${app.applicant}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Vehicle</span>
                            <span class="detail-value">${app.vehicle}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Loan Amount</span>
                            <span class="detail-value">₱${app.loanAmount.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Application Date</span>
                            <span class="detail-value">${app.date}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value"><span class="application-status ${app.status}">${app.status}</span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        window.currentApplicationId = appId;
    };

    // Approve financing
    window.approveFinancing = function() {
        const appId = window.currentApplicationId;
        const app = mockFinancingApplications.find(a => a.id === appId);
        if (!app) return;
        
        showNotification('Approving financing application...', 'info');
        
        setTimeout(() => {
            app.status = 'approved';
            showNotification('Financing application approved', 'success');
            closeModal('financingApplicationModal');
            loadFinancingApplications();
        }, 1500);
    };

    // Reject financing
    window.rejectFinancing = function() {
        const appId = window.currentApplicationId;
        const app = mockFinancingApplications.find(a => a.id === appId);
        if (!app) return;
        
        if (confirm('Are you sure you want to reject this financing application?')) {
            showNotification('Rejecting financing application...', 'info');
            
            setTimeout(() => {
                app.status = 'rejected';
                showNotification('Financing application rejected', 'success');
                closeModal('financingApplicationModal');
                loadFinancingApplications();
            }, 1500);
        }
    };

    // Load liens
    function loadLiens() {
        const total = mockLiens.length;
        const active = mockLiens.filter(l => l.status === 'active').length;
        const satisfied = mockLiens.filter(l => l.status === 'satisfied').length;
        
        document.getElementById('totalLiens').textContent = total;
        document.getElementById('activeLiens').textContent = active;
        document.getElementById('satisfiedLiens').textContent = satisfied;
        
        const tableBody = document.getElementById('liensTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (mockLiens.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No liens recorded</td></tr>';
            return;
        }
        
        mockLiens.forEach(lien => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${lien.vehicle}</td>
                <td>${lien.tokenId}</td>
                <td>${lien.lienHolder}</td>
                <td>₱${lien.lienAmount.toLocaleString()}</td>
                <td>${lien.dateFiled}</td>
                <td><span class="lien-badge ${lien.status}">${lien.status}</span></td>
                <td>
                    <button class="btn-primary btn-sm" onclick="viewLienDetails('${lien.tokenId}')">View</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // View lien details
    window.viewLienDetails = function(tokenId) {
        const lien = mockLiens.find(l => l.tokenId === tokenId);
        if (!lien) return;
        
        const modal = document.getElementById('lienDetailsModal');
        const content = document.getElementById('lienDetailsContent');
        
        content.innerHTML = `
            <div class="application-details">
                <div class="detail-section">
                    <h4>📋 Lien Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Token ID</span>
                            <span class="detail-value">${lien.tokenId}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Vehicle</span>
                            <span class="detail-value">${lien.vehicle}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Lien Holder</span>
                            <span class="detail-value">${lien.lienHolder}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Lien Amount</span>
                            <span class="detail-value">₱${lien.lienAmount.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Date Filed</span>
                            <span class="detail-value">${lien.dateFiled}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value"><span class="lien-badge ${lien.status}">${lien.status}</span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        window.currentLienTokenId = tokenId;
    };

    // Release lien
    window.releaseLien = function() {
        const tokenId = window.currentLienTokenId;
        const lien = mockLiens.find(l => l.tokenId === tokenId);
        if (!lien) return;
        
        if (confirm('Are you sure you want to release this lien?')) {
            showNotification('Releasing lien...', 'info');
            
            setTimeout(() => {
                lien.status = 'satisfied';
                showNotification('Lien released successfully', 'success');
                closeModal('lienDetailsModal');
                loadLiens();
            }, 1500);
        }
    };

    // Refresh functions
    window.refreshCollateral = function() {
        showNotification('Refreshing collateral...', 'info');
        setTimeout(() => {
            loadCollateral();
            showNotification('Collateral refreshed', 'success');
        }, 1000);
    };

    window.refreshLiens = function() {
        showNotification('Refreshing liens...', 'info');
        setTimeout(() => {
            loadLiens();
            showNotification('Liens refreshed', 'success');
        }, 1000);
    };

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

