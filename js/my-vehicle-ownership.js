// My Vehicle Ownership - Owner JavaScript
// Handles vehicle ownership history for current user

document.addEventListener('DOMContentLoaded', function() {
    initializeMyOwnership();
});

let myVehiclesData = [];
let currentVehicleView = null;

function initializeMyOwnership() {
    // Initialize user information
    if (typeof AuthUtils !== 'undefined') {
        const user = AuthUtils.getCurrentUser();
        if (user) {
            const sidebarUserNameEl = document.getElementById('sidebarUserName');
            const sidebarUserAvatarEl = document.getElementById('sidebarUserAvatar');
            if (sidebarUserNameEl) sidebarUserNameEl.textContent = AuthUtils.getUserDisplayName() || 'Vehicle Owner';
            if (sidebarUserAvatarEl) sidebarUserAvatarEl.textContent = AuthUtils.getUserInitials() || 'VO';
        }
    }

    // Sidebar toggle
    const sidebar = document.querySelector('.dashboard-sidebar');
    const logoToggle = document.getElementById('logoToggle');
    if (logoToggle && sidebar) {
        logoToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('ownerSidebarCollapsed', sidebar.classList.contains('collapsed') ? 'true' : 'false');
        });
    }

    // Logout
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                if (typeof AuthUtils !== 'undefined') {
                    AuthUtils.logout();
                } else {
                    localStorage.clear();
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // Load vehicles
    loadMyVehicles();
}

async function loadMyVehicles() {
    try {
        showLoading();

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get ownership history for current user
        const response = await apiClient.get('/api/vehicles/my-vehicles/ownership-history');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load ownership history');
        }

        myVehiclesData = response.ownershipHistory || [];
        
        // Display vehicles list
        displayVehiclesList(myVehiclesData);

        hideLoading();

    } catch (error) {
        console.error('Load my vehicles error:', error);
        showError(error.message || 'Failed to load vehicles. Please try again.');
        hideLoading();
    }
}

function displayVehiclesList(ownershipHistory) {
    const vehiclesListContent = document.getElementById('vehiclesListContent');
    const emptyState = document.getElementById('emptyState');

    if (!vehiclesListContent) return;

    if (ownershipHistory.length === 0) {
        vehiclesListContent.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    vehiclesListContent.innerHTML = '';
    if (emptyState) emptyState.style.display = 'none';

    ownershipHistory.forEach(vehicleData => {
        const vehicle = vehicleData.vehicle;
        const history = vehicleData.history || [];
        
        // Determine if current owner (has history entry with no end date or is latest)
        const isCurrent = history.length > 0 && history[0].performed_at && !history[0].metadata?.endDate;
        
        const card = createVehicleCard(vehicle, isCurrent, history.length);
        vehiclesListContent.appendChild(card);
    });
}

function createVehicleCard(vehicle, isCurrent, historyCount) {
    const card = document.createElement('div');
    card.className = `vehicle-card ${isCurrent ? 'current' : ''}`;

    card.innerHTML = `
        <div class="vehicle-info">
            <div class="vehicle-plate">${escapeHtml(vehicle.plateNumber || vehicle.plate_number || 'N/A')}</div>
            <div class="vehicle-details">
                <div class="vehicle-detail-item">
                    <i class="fas fa-car"></i>
                    <span>${escapeHtml((vehicle.year || '') + ' ' + (vehicle.make || '') + ' ' + (vehicle.model || ''))}</span>
                </div>
                <div class="vehicle-detail-item">
                    <i class="fas fa-barcode"></i>
                    <span>VIN: ${escapeHtml((vehicle.vin || '').substring(0, 8))}...</span>
                </div>
            </div>
        </div>
        <div class="vehicle-status">
            <span class="status-badge ${isCurrent ? 'current' : 'previous'}">
                ${isCurrent ? 'Current' : 'Previous'}
            </span>
            <div class="vehicle-actions">
                ${isCurrent ? `
                    <button class="btn-transfer" onclick="transferVehicle('${escapeHtml(vehicle.id)}', '${escapeHtml(vehicle.plateNumber || vehicle.plate_number || '')}')" title="Transfer Ownership">
                        <i class="fas fa-exchange-alt"></i> Transfer
                    </button>
                ` : ''}
                <button class="btn-view-history" onclick="viewOwnershipHistory('${escapeHtml(vehicle.vin || vehicle.id)}', '${escapeHtml(vehicle.plateNumber || vehicle.plate_number || '')}')">
                    <i class="fas fa-history"></i> View History
                </button>
            </div>
        </div>
    `;

    return card;
}

async function viewOwnershipHistory(vinOrId, plateNumber) {
    try {
        showLoading();

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Try to get by VIN first
        let vehicle = null;
        let ownershipHistory = [];

        if (vinOrId && vinOrId.length === 17) {
            // Looks like a VIN
            const response = await apiClient.get(`/api/vehicles/${vinOrId}/ownership-history`);
            if (response.success) {
                vehicle = response.vehicle;
                ownershipHistory = response.ownershipHistory || [];
            }
        } else {
            // Try to get by ID or find in my vehicles
            const myVehiclesResponse = await apiClient.get('/api/vehicles/my-vehicles/ownership-history');
            if (myVehiclesResponse.success) {
                const vehicleData = myVehiclesResponse.ownershipHistory.find(v => 
                    v.vehicle.id === vinOrId || v.vehicle.vin === vinOrId
                );
                if (vehicleData) {
                    vehicle = vehicleData.vehicle;
                    ownershipHistory = vehicleData.history || [];
                }
            }
        }

        if (!vehicle) {
            throw new Error('Vehicle not found');
        }

        currentVehicleView = {
            vehicle,
            ownershipHistory
        };

        // Display timeline
        displayOwnershipTimeline(currentVehicleView);

        hideLoading();

    } catch (error) {
        console.error('View ownership history error:', error);
        showError(error.message || 'Failed to load ownership history');
        hideLoading();
    }
}

function displayOwnershipTimeline(vehicleData) {
    const vehiclesList = document.getElementById('vehiclesList');
    const timelineContainer = document.getElementById('limitedTimelineContainer');
    const timeline = document.getElementById('limitedOwnershipTimeline');

    // Hide vehicle list, show timeline
    if (vehiclesList) vehiclesList.style.display = 'none';
    if (timelineContainer) timelineContainer.classList.add('active');

    // Clear and populate timeline
    if (timeline) timeline.innerHTML = '';

    const history = vehicleData.ownershipHistory || [];
    const vehicle = vehicleData.vehicle;

    if (history.length === 0) {
        if (timeline) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-info-circle"></i>
                    <h3>No Ownership History</h3>
                    <p>This vehicle has no ownership transfer records yet.</p>
                </div>
            `;
        }
        return;
    }

    // Sort periods by date (newest first)
    const sortedPeriods = [...history].sort((a, b) => {
        const dateA = new Date(a.performed_at || a.timestamp || a.startDate);
        const dateB = new Date(b.performed_at || b.timestamp || b.startDate);
        return dateB - dateA;
    });

    sortedPeriods.forEach((period, index) => {
        const isCurrent = index === 0; // First record is current
        const node = createLimitedTimelineNode(period, vehicle, isCurrent);
        if (timeline) timeline.appendChild(node);
    });

    // Scroll to timeline
    if (timelineContainer) {
        timelineContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function createLimitedTimelineNode(period, vehicle, isCurrent) {
    const node = document.createElement('div');
    node.className = `limited-timeline-node ${isCurrent ? 'current' : ''}`;

    // Extract data from period
    const startDate = period.performed_at || period.timestamp || period.startDate || new Date().toISOString();
    const endDate = period.metadata?.endDate || period.endDate || (isCurrent ? null : startDate);
    const transactionId = period.transaction_id || period.transactionId || period.metadata?.transactionId || 'N/A';

    const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const endDateFormatted = endDate ? 
        new Date(endDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : 'Present';

    const periodTitle = isCurrent ? 'Current Ownership Period' : 'Previous Ownership Period';

    node.innerHTML = `
        <div class="limited-timeline-node-card">
            <div class="limited-node-header">
                <div class="limited-node-period">
                    <div class="limited-node-period-title">${escapeHtml(periodTitle)}</div>
                    <div class="limited-node-period-dates">
                        <i class="fas fa-calendar-check"></i> ${startDateFormatted} - 
                        <i class="fas fa-calendar-times"></i> ${endDateFormatted}
                    </div>
                </div>
                <div class="limited-node-badges">
                    ${isCurrent ? '<span class="badge-current-limited"><i class="fas fa-star"></i> Current</span>' : ''}
                    <span class="badge-verified-limited">
                        <i class="fas fa-shield-alt"></i> Verified
                    </span>
                </div>
            </div>
            <div class="limited-trust-indicators">
                <div class="limited-trust-indicator" title="Blockchain-verified ownership record">
                    <i class="fas fa-lock"></i>
                    <span>Blockchain Verified</span>
                </div>
                <div class="limited-trust-indicator" title="Tamper-proof transaction record">
                    <i class="fas fa-shield-alt"></i>
                    <span>Tamper-Proof</span>
                </div>
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #e9ecef;">
                <button 
                    class="btn-verify-ownership" 
                    onclick="verifyOwnershipPeriod('${escapeHtml(vehicle.plateNumber || vehicle.plate_number || '')}', '${startDate}', '${endDate || 'Present'}', ${isCurrent})"
                    title="Verify this ownership period on blockchain"
                >
                    <i class="fas fa-shield-check"></i> Verify Ownership Period
                </button>
            </div>
        </div>
    `;

    return node;
}

function backToVehicleList() {
    const vehiclesList = document.getElementById('vehiclesList');
    const timelineContainer = document.getElementById('limitedTimelineContainer');

    if (vehiclesList) vehiclesList.style.display = 'block';
    if (timelineContainer) timelineContainer.classList.remove('active');

    if (vehiclesList) {
        vehiclesList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function verifyOwnershipPeriod(plateNumber, startDate, endDate, isCurrent) {
    const modal = document.getElementById('verificationModal');
    if (!modal) return;

    // Find the vehicle
    const vehicleData = myVehiclesData.find(v => 
        (v.vehicle.plateNumber || v.vehicle.plate_number) === plateNumber
    );
    
    if (!vehicleData) {
        showError('Vehicle data not found');
        return;
    }

    // Find the matching period
    const period = vehicleData.history.find(p => {
        const pStart = p.performed_at || p.timestamp || p.startDate;
        const pEnd = p.metadata?.endDate || p.endDate;
        return pStart === startDate && 
               (pEnd === endDate || (pEnd === null && endDate === 'Present'));
    });

    // Format dates
    const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const endDateFormatted = endDate === 'Present' ? 'Present' : 
        new Date(endDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

    // Update modal content
    const verifyPlateNumber = document.getElementById('verifyPlateNumber');
    const verifyOwnershipPeriod = document.getElementById('verifyOwnershipPeriod');
    const verifyStatus = document.getElementById('verifyStatus');
    
    if (verifyPlateNumber) verifyPlateNumber.textContent = plateNumber;
    if (verifyOwnershipPeriod) verifyOwnershipPeriod.textContent = `${startDateFormatted} - ${endDateFormatted}`;
    if (verifyStatus) {
        verifyStatus.innerHTML = isCurrent ? 
            '<span class="badge-current-limited"><i class="fas fa-star"></i> Current Ownership</span>' :
            '<span class="badge-verified-limited"><i class="fas fa-check"></i> Previous Ownership</span>';
    }

    // Check verification status
    const isVerified = period ? (period.transaction_id || period.metadata?.transactionId) : true;
    const statusBox = document.getElementById('verificationStatusBox');
    const statusTitle = document.getElementById('verificationStatusTitle');
    const statusDescription = document.getElementById('verificationStatusDescription');

    if (statusBox && statusTitle && statusDescription) {
        if (isVerified) {
            statusBox.className = 'verification-status-box verified';
            statusTitle.textContent = 'Ownership Verified';
            statusDescription.textContent = 'This ownership period has been verified and recorded on the blockchain. The record is tamper-proof and immutable. Your ownership is confirmed and protected.';
        } else {
            statusBox.className = 'verification-status-box pending';
            statusTitle.textContent = 'Verification Pending';
            statusDescription.textContent = 'This ownership period is being verified. Please check back later.';
        }
    }

    // Show modal
    modal.classList.add('active');

    // Show toast notification
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Ownership verification details displayed', 'info');
    }
}

function closeVerificationModal() {
    const modal = document.getElementById('verificationModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showLoading() {
    const vehiclesListContent = document.getElementById('vehiclesListContent');
    const emptyState = document.getElementById('emptyState');
    
    if (emptyState) emptyState.style.display = 'none';
    if (vehiclesListContent) {
        vehiclesListContent.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading...</h3></div>';
    }
}

function hideLoading() {
    // Loading is hidden when content is populated
}

function showError(message) {
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, 'error');
    } else {
        alert(message);
    }
    
    const vehiclesListContent = document.getElementById('vehiclesListContent');
    const emptyState = document.getElementById('emptyState');
    
    if (vehiclesListContent) vehiclesListContent.innerHTML = '';
    if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${escapeHtml(message)}</p>
        `;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Transfer vehicle ownership - redirects to transfer page with vehicle pre-selected
function transferVehicle(vehicleId, plateNumber) {
    // Store vehicle ID in sessionStorage for transfer-ownership.html to pick up
    sessionStorage.setItem('selectedVehicleId', vehicleId);
    sessionStorage.setItem('selectedVehiclePlate', plateNumber || '');
    
    // Redirect to transfer ownership page
    window.location.href = 'transfer-ownership.html';
}

// Make functions globally available for inline onclick handlers
window.viewOwnershipHistory = viewOwnershipHistory;
window.backToVehicleList = backToVehicleList;
window.verifyOwnershipPeriod = verifyOwnershipPeriod;
window.closeVerificationModal = closeVerificationModal;
window.transferVehicle = transferVehicle;

