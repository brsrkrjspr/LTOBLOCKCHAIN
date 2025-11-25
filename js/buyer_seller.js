// Buyer/Seller Dashboard JavaScript

(function() {
    'use strict';

    // Mock data for demonstration
    const mockVehicles = [
        {
            tokenId: 'TOKEN-001',
            vin: '1HGBH41JXMN109186',
            make: 'Toyota',
            model: 'Camry',
            year: 2022,
            color: 'Blue',
            licensePlate: 'ABC-1234',
            purchaseDate: '2022-01-15'
        },
        {
            tokenId: 'TOKEN-002',
            vin: '5YJSA1E11HF123456',
            make: 'Honda',
            model: 'Civic',
            year: 2021,
            color: 'Red',
            licensePlate: 'XYZ-5678',
            purchaseDate: '2021-06-20'
        }
    ];

    const mockRenewals = [
        {
            vehicle: 'Toyota Camry (ABC-1234)',
            type: 'Insurance',
            dueDate: '2024-12-31',
            status: 'warning',
            daysRemaining: 45
        },
        {
            vehicle: 'Honda Civic (XYZ-5678)',
            type: 'Registration',
            dueDate: '2024-11-15',
            status: 'urgent',
            daysRemaining: 20
        }
    ];

    // Initialize dashboard
    function initDashboard() {
        loadUserInfo();
        loadVehicles();
        loadRenewals();
    }

    // Load user information
    function loadUserInfo() {
        const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userName = userData.name || 'John Buyer';
        const userRole = userData.role || 'buyer_seller';
        
        document.getElementById('userName').textContent = userName;
        document.getElementById('userRole').textContent = 'Car Buyer/Seller';
        document.getElementById('userAvatar').textContent = userName.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    // Show section
    window.showSection = function(sectionId) {
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from all sidebar links
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Show selected section
        const section = document.getElementById(sectionId + '-section');
        if (section) {
            section.classList.add('active');
        }
        
        // Activate corresponding sidebar link
        const link = document.querySelector(`[onclick*="${sectionId}"]`);
        if (link) {
            link.classList.add('active');
        }
    };

    // Load vehicles
    function loadVehicles() {
        const vehiclesGrid = document.getElementById('vehiclesGrid');
        if (!vehiclesGrid) return;
        
        vehiclesGrid.innerHTML = '';
        
        if (mockVehicles.length === 0) {
            vehiclesGrid.innerHTML = '<p>No vehicles found. You can purchase vehicles using the Buy/Sell section.</p>';
            return;
        }
        
        mockVehicles.forEach(vehicle => {
            const vehicleCard = createVehicleCard(vehicle);
            vehiclesGrid.appendChild(vehicleCard);
        });
    }

    // Create vehicle card
    function createVehicleCard(vehicle) {
        const card = document.createElement('div');
        card.className = 'vehicle-card';
        card.innerHTML = `
            <div class="vehicle-card-header">
                <h3>${vehicle.make} ${vehicle.model}</h3>
                <span class="token-badge">${vehicle.tokenId}</span>
            </div>
            <div class="vehicle-details">
                <div class="vehicle-detail-item">
                    <span class="vehicle-detail-label">Year:</span>
                    <span class="vehicle-detail-value">${vehicle.year}</span>
                </div>
                <div class="vehicle-detail-item">
                    <span class="vehicle-detail-label">Color:</span>
                    <span class="vehicle-detail-value">${vehicle.color}</span>
                </div>
                <div class="vehicle-detail-item">
                    <span class="vehicle-detail-label">License Plate:</span>
                    <span class="vehicle-detail-value">${vehicle.licensePlate}</span>
                </div>
                <div class="vehicle-detail-item">
                    <span class="vehicle-detail-label">VIN:</span>
                    <span class="vehicle-detail-value">${vehicle.vin}</span>
                </div>
            </div>
            <div class="vehicle-actions">
                <button class="btn-primary btn-sm" onclick="viewVehicleDetails('${vehicle.tokenId}')">View Details</button>
            </div>
        `;
        return card;
    }

    // View vehicle details
    window.viewVehicleDetails = function(tokenId) {
        const vehicle = mockVehicles.find(v => v.tokenId === tokenId);
        if (!vehicle) {
            alert('Vehicle not found');
            return;
        }
        
        const modal = document.getElementById('vehicleDetailsModal');
        const content = document.getElementById('vehicleDetailsContent');
        
        content.innerHTML = `
            <div class="application-details">
                <div class="detail-section">
                    <h4>🚗 Vehicle Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Token ID</span>
                            <span class="detail-value">${vehicle.tokenId}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">VIN</span>
                            <span class="detail-value">${vehicle.vin}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Make</span>
                            <span class="detail-value">${vehicle.make}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Model</span>
                            <span class="detail-value">${vehicle.model}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Year</span>
                            <span class="detail-value">${vehicle.year}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Color</span>
                            <span class="detail-value">${vehicle.color}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">License Plate</span>
                            <span class="detail-value">${vehicle.licensePlate}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Purchase Date</span>
                            <span class="detail-value">${vehicle.purchaseDate}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    };

    // Close modal
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };

    // Show buy/sell tab
    window.showBuySellTab = function(tab) {
        document.querySelectorAll('.buy-sell-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('#buy-sell-section .tab-content').forEach(content => content.classList.remove('active'));
        
        if (tab === 'buy') {
            document.querySelector('.buy-sell-tabs .tab-btn:first-child').classList.add('active');
            document.getElementById('buy-tab').classList.add('active');
        } else {
            document.querySelector('.buy-sell-tabs .tab-btn:last-child').classList.add('active');
            document.getElementById('sell-tab').classList.add('active');
            loadSellVehicles();
        }
    };

    // Load vehicles for sale
    function loadSellVehicles() {
        const sellList = document.getElementById('sellVehicleList');
        if (!sellList) return;
        
        sellList.innerHTML = '';
        
        mockVehicles.forEach(vehicle => {
            const item = document.createElement('div');
            item.className = 'sell-vehicle-item';
            item.innerHTML = `
                <div>
                    <strong>${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})</strong>
                    <p>Token ID: ${vehicle.tokenId}</p>
                </div>
                <button class="btn-primary" onclick="initiateSale('${vehicle.tokenId}')">Sell Vehicle</button>
            `;
            sellList.appendChild(item);
        });
    }

    // Initiate purchase
    window.initiatePurchase = function() {
        const tokenId = document.getElementById('tokenIdInput').value.trim();
        if (!tokenId) {
            alert('Please enter a Token ID or scan QR code');
            return;
        }
        
        // Simulate blockchain transfer
        showNotification('Processing purchase...', 'info');
        
        setTimeout(() => {
            showNotification('Purchase successful! Vehicle token transferred to your account.', 'success');
            document.getElementById('tokenIdInput').value = '';
            loadVehicles();
        }, 2000);
    };

    // Initiate sale
    window.initiateSale = function(tokenId) {
        const vehicle = mockVehicles.find(v => v.tokenId === tokenId);
        if (!vehicle) return;
        
        const modal = document.getElementById('transferModal');
        const content = document.getElementById('transferModalContent');
        
        content.innerHTML = `
            <p>Are you sure you want to sell this vehicle?</p>
            <div class="detail-section">
                <h4>Vehicle Details</h4>
                <p><strong>Vehicle:</strong> ${vehicle.make} ${vehicle.model}</p>
                <p><strong>Token ID:</strong> ${vehicle.tokenId}</p>
                <p><strong>License Plate:</strong> ${vehicle.licensePlate}</p>
            </div>
            <div class="form-group">
                <label for="buyerAddress">Buyer Wallet Address</label>
                <input type="text" id="buyerAddress" placeholder="Enter buyer's wallet address" required>
            </div>
        `;
        
        modal.style.display = 'flex';
        window.currentTransferTokenId = tokenId;
    };

    // Confirm transfer
    window.confirmTransfer = function() {
        const buyerAddress = document.getElementById('buyerAddress').value.trim();
        if (!buyerAddress) {
            alert('Please enter buyer wallet address');
            return;
        }
        
        // Simulate blockchain transfer
        showNotification('Processing transfer...', 'info');
        
        setTimeout(() => {
            const tokenId = window.currentTransferTokenId;
            const index = mockVehicles.findIndex(v => v.tokenId === tokenId);
            if (index > -1) {
                mockVehicles.splice(index, 1);
            }
            
            showNotification('Transfer successful! Vehicle token has been transferred.', 'success');
            closeModal('transferModal');
            loadVehicles();
            loadSellVehicles();
        }, 2000);
    };

    // Verify vehicle
    window.verifyVehicle = function(event) {
        event.preventDefault();
        const tokenId = document.getElementById('verifyTokenId').value.trim();
        
        if (!tokenId) {
            alert('Please enter a Token ID or VIN');
            return;
        }
        
        const resultDiv = document.getElementById('verificationResult');
        resultDiv.style.display = 'block';
        
        // Simulate verification
        setTimeout(() => {
            const vehicle = mockVehicles.find(v => v.tokenId === tokenId || v.vin === tokenId);
            
            if (vehicle) {
                resultDiv.className = 'verification-result success';
                resultDiv.innerHTML = `
                    <h4>✅ Vehicle Verified</h4>
                    <p><strong>Token ID:</strong> ${vehicle.tokenId}</p>
                    <p><strong>Vehicle:</strong> ${vehicle.make} ${vehicle.model} ${vehicle.year}</p>
                    <p><strong>Owner:</strong> Verified (You own this vehicle)</p>
                    <p><strong>Status:</strong> Valid and registered</p>
                `;
            } else {
                resultDiv.className = 'verification-result error';
                resultDiv.innerHTML = `
                    <h4>❌ Vehicle Not Found</h4>
                    <p>The vehicle with Token ID or VIN "${tokenId}" was not found in your account.</p>
                `;
            }
        }, 1000);
    };

    // Load renewals
    function loadRenewals() {
        const renewalsList = document.getElementById('renewalsList');
        if (!renewalsList) return;
        
        renewalsList.innerHTML = '';
        
        mockRenewals.forEach(renewal => {
            const item = document.createElement('div');
            item.className = `renewal-item ${renewal.status}`;
            item.innerHTML = `
                <div class="renewal-info">
                    <h4>${renewal.type} Renewal</h4>
                    <p>${renewal.vehicle}</p>
                </div>
                <div class="renewal-date">
                    <strong>${renewal.daysRemaining} days</strong>
                    <small>Due: ${renewal.dueDate}</small>
                </div>
            `;
            renewalsList.appendChild(item);
        });
    }

    // Refresh vehicles
    window.refreshVehicles = function() {
        showNotification('Refreshing vehicles...', 'info');
        setTimeout(() => {
            loadVehicles();
            showNotification('Vehicles refreshed', 'success');
        }, 1000);
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

