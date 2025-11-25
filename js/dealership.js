// Dealership Dashboard JavaScript

(function() {
    'use strict';

    // Mock data
    const mockVehicles = [
        {
            tokenId: 'DEALER-001',
            vin: '1HGBH41JXMN109186',
            make: 'Toyota',
            model: 'Camry',
            year: 2024,
            color: 'Blue',
            licensePlate: 'NEW-001',
            status: 'available',
            mintDate: '2024-01-15'
        },
        {
            tokenId: 'DEALER-002',
            vin: '5YJSA1E11HF123456',
            make: 'Honda',
            model: 'Civic',
            year: 2024,
            color: 'Red',
            licensePlate: 'NEW-002',
            status: 'sold',
            mintDate: '2024-02-20',
            soldDate: '2024-03-10'
        }
    ];

    const mockSales = [
        {
            date: '2024-03-10',
            vehicle: 'Honda Civic 2024',
            buyer: 'John Buyer',
            tokenId: 'DEALER-002',
            status: 'completed'
        }
    ];

    // Initialize dashboard
    function initDashboard() {
        loadUserInfo();
        loadVehicles();
        loadSales();
        loadInventory();
    }

    // Load user information
    function loadUserInfo() {
        const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userName = userData.name || 'Auto Dealership';
        const userRole = userData.role || 'dealership';
        
        document.getElementById('userName').textContent = userName;
        document.getElementById('userRole').textContent = 'Car Dealership';
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

    // Mint vehicle token
    window.mintVehicleToken = function(event) {
        event.preventDefault();
        
        const vehicleData = {
            vin: document.getElementById('vin').value,
            make: document.getElementById('make').value,
            model: document.getElementById('model').value,
            year: parseInt(document.getElementById('year').value),
            color: document.getElementById('color').value,
            licensePlate: document.getElementById('licensePlate').value,
            description: document.getElementById('vehicleDescription').value,
            status: 'available',
            mintDate: new Date().toISOString().split('T')[0]
        };
        
        // Generate token ID
        const tokenId = 'DEALER-' + String(mockVehicles.length + 1).padStart(3, '0');
        vehicleData.tokenId = tokenId;
        
        // Simulate blockchain minting
        showNotification('Minting vehicle token on blockchain...', 'info');
        
        setTimeout(() => {
            mockVehicles.push(vehicleData);
            
            // Show confirmation modal
            const modal = document.getElementById('mintConfirmationModal');
            const content = document.getElementById('mintConfirmationContent');
            
            content.innerHTML = `
                <div class="application-details">
                    <div class="detail-section">
                        <h4>✅ Token Minted Successfully</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Token ID</span>
                                <span class="detail-value">${tokenId}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Vehicle</span>
                                <span class="detail-value">${vehicleData.make} ${vehicleData.model} ${vehicleData.year}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">VIN</span>
                                <span class="detail-value">${vehicleData.vin}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">License Plate</span>
                                <span class="detail-value">${vehicleData.licensePlate}</span>
                            </div>
                        </div>
                        <p style="margin-top: 1rem; color: #6c757d;">The vehicle token has been successfully minted and added to the blockchain.</p>
                    </div>
                </div>
            `;
            
            modal.style.display = 'flex';
            
            // Reset form
            event.target.reset();
            
            // Refresh data
            loadVehicles();
            loadInventory();
        }, 2000);
    };

    // Load vehicles
    function loadVehicles() {
        const vehiclesGrid = document.getElementById('vehiclesGrid');
        if (!vehiclesGrid) return;
        
        vehiclesGrid.innerHTML = '';
        
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
                    <span class="vehicle-detail-label">Status:</span>
                    <span class="vehicle-detail-value">
                        <span class="inventory-status ${vehicle.status}">${vehicle.status}</span>
                    </span>
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
                            <span class="detail-label">Status</span>
                            <span class="detail-value">
                                <span class="inventory-status ${vehicle.status}">${vehicle.status}</span>
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Mint Date</span>
                            <span class="detail-value">${vehicle.mintDate}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        window.currentEditTokenId = tokenId;
    };

    // Edit vehicle
    window.editVehicle = function() {
        const tokenId = window.currentEditTokenId;
        const vehicle = mockVehicles.find(v => v.tokenId === tokenId);
        if (!vehicle) return;
        
        const modal = document.getElementById('editVehicleModal');
        const content = document.getElementById('editVehicleContent');
        
        content.innerHTML = `
            <form onsubmit="saveVehicleChanges(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label>Make</label>
                        <input type="text" id="editMake" value="${vehicle.make}" required>
                    </div>
                    <div class="form-group">
                        <label>Model</label>
                        <input type="text" id="editModel" value="${vehicle.model}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Year</label>
                        <input type="number" id="editYear" value="${vehicle.year}" required>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="text" id="editColor" value="${vehicle.color}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="editStatus" required>
                        <option value="available" ${vehicle.status === 'available' ? 'selected' : ''}>Available</option>
                        <option value="sold" ${vehicle.status === 'sold' ? 'selected' : ''}>Sold</option>
                        <option value="pending" ${vehicle.status === 'pending' ? 'selected' : ''}>Pending</option>
                    </select>
                </div>
            </form>
        `;
        
        closeModal('vehicleDetailsModal');
        modal.style.display = 'flex';
    };

    // Save vehicle changes
    window.saveVehicleChanges = function(event) {
        if (event) event.preventDefault();
        
        const tokenId = window.currentEditTokenId;
        const vehicle = mockVehicles.find(v => v.tokenId === tokenId);
        if (!vehicle) return;
        
        vehicle.make = document.getElementById('editMake').value;
        vehicle.model = document.getElementById('editModel').value;
        vehicle.year = parseInt(document.getElementById('editYear').value);
        vehicle.color = document.getElementById('editColor').value;
        vehicle.status = document.getElementById('editStatus').value;
        
        showNotification('Vehicle details updated successfully', 'success');
        closeModal('editVehicleModal');
        loadVehicles();
        loadInventory();
    };

    // Load sales
    function loadSales() {
        const tableBody = document.getElementById('salesTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (mockSales.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No sales history</td></tr>';
            return;
        }
        
        mockSales.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sale.date}</td>
                <td>${sale.vehicle}</td>
                <td>${sale.buyer}</td>
                <td>${sale.tokenId}</td>
                <td><span class="status-badge status-approved">${sale.status}</span></td>
                <td>
                    <button class="btn-primary btn-sm" onclick="viewSaleDetails('${sale.tokenId}')">View</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Filter sales
    window.filterSales = function() {
        const filter = document.getElementById('salesFilter').value;
        // In a real app, this would filter the sales data
        loadSales();
    };

    // Load inventory
    function loadInventory() {
        const total = mockVehicles.length;
        const available = mockVehicles.filter(v => v.status === 'available').length;
        const sold = mockVehicles.filter(v => v.status === 'sold').length;
        
        document.getElementById('totalVehicles').textContent = total;
        document.getElementById('availableVehicles').textContent = available;
        document.getElementById('soldVehicles').textContent = sold;
        
        const inventoryList = document.getElementById('inventoryList');
        if (!inventoryList) return;
        
        inventoryList.innerHTML = '';
        
        mockVehicles.forEach(vehicle => {
            const item = document.createElement('div');
            item.className = 'inventory-item';
            item.innerHTML = `
                <div class="inventory-info">
                    <h4>${vehicle.make} ${vehicle.model} ${vehicle.year}</h4>
                    <p>Token ID: ${vehicle.tokenId} | License: ${vehicle.licensePlate}</p>
                </div>
                <span class="inventory-status ${vehicle.status}">${vehicle.status}</span>
            `;
            inventoryList.appendChild(item);
        });
    }

    // Refresh functions
    window.refreshVehicles = function() {
        showNotification('Refreshing vehicles...', 'info');
        setTimeout(() => {
            loadVehicles();
            showNotification('Vehicles refreshed', 'success');
        }, 1000);
    };

    window.refreshInventory = function() {
        showNotification('Refreshing inventory...', 'info');
        setTimeout(() => {
            loadInventory();
            showNotification('Inventory refreshed', 'success');
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

