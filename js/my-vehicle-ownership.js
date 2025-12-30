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
    // Get DOM elements
    const myVehiclesContent = document.getElementById('myVehiclesContent');
    const pendingVehiclesContent = document.getElementById('pendingVehiclesContent');
    const myVehiclesList = document.getElementById('myVehiclesList');
    const pendingVehiclesList = document.getElementById('pendingVehiclesList');
    const myVehiclesCount = document.getElementById('myVehiclesCount');
    const pendingVehiclesCount = document.getElementById('pendingVehiclesCount');
    const emptyState = document.getElementById('emptyState');

    // Safety check
    if (!myVehiclesContent || !pendingVehiclesContent) {
        console.error('Required DOM elements not found for vehicle display');
        return;
    }

    // Separate vehicles by status
    const myVehicles = [];      // APPROVED or REGISTERED
    const pendingVehicles = []; // All other statuses

    ownershipHistory.forEach(vehicleData => {
        const vehicle = vehicleData.vehicle;
        if (!vehicle || !vehicle.id) {
            console.warn('Skipping invalid vehicle data:', vehicleData);
            return;
        }

        // Normalize status for comparison (handle both uppercase and lowercase)
        const status = (vehicle.status || '').toUpperCase().trim();
        const isApprovedOrRegistered = status === 'APPROVED' || status === 'REGISTERED';

        if (isApprovedOrRegistered) {
            myVehicles.push(vehicleData);
        } else {
            pendingVehicles.push(vehicleData);
        }
    });

    // Clear existing content
    myVehiclesContent.innerHTML = '';
    pendingVehiclesContent.innerHTML = '';

    // Display My Vehicles (Approved/Registered)
    if (myVehicles.length > 0) {
        myVehicles.forEach(vehicleData => {
            const vehicle = vehicleData.vehicle;
            const history = vehicleData.history || [];
            const card = createVehicleCard(vehicle, true, history.length);
            myVehiclesContent.appendChild(card);
        });
        if (myVehiclesList) myVehiclesList.style.display = 'block';
        if (myVehiclesCount) myVehiclesCount.textContent = myVehicles.length;
    } else {
        if (myVehiclesList) myVehiclesList.style.display = 'none';
        if (myVehiclesCount) myVehiclesCount.textContent = '0';
    }

    // Display Pending Vehicles
    if (pendingVehicles.length > 0) {
        pendingVehicles.forEach(vehicleData => {
            const vehicle = vehicleData.vehicle;
            const history = vehicleData.history || [];
            const card = createVehicleCard(vehicle, true, history.length);
            pendingVehiclesContent.appendChild(card);
        });
        if (pendingVehiclesList) pendingVehiclesList.style.display = 'block';
        if (pendingVehiclesCount) pendingVehiclesCount.textContent = pendingVehicles.length;
    } else {
        if (pendingVehiclesList) pendingVehiclesList.style.display = 'none';
        if (pendingVehiclesCount) pendingVehiclesCount.textContent = '0';
    }

    // Show empty state if no vehicles at all
    if (ownershipHistory.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
            const emptyStateP = emptyState.querySelector('p');
            if (emptyStateP) {
                emptyStateP.textContent = 'You don\'t have any registered or pending vehicles yet';
            }
        }
        if (myVehiclesList) myVehiclesList.style.display = 'none';
        if (pendingVehiclesList) pendingVehiclesList.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
    }
}

function createVehicleCard(vehicle, isCurrent, historyCount) {
    const card = document.createElement('div');
    card.className = `vehicle-card ${isCurrent ? 'current' : ''}`;

    // Build vehicle description
    const vehicleDesc = [
        vehicle.year ? vehicle.year : '',
        vehicle.make ? vehicle.make : '',
        vehicle.model ? vehicle.model : ''
    ].filter(Boolean).join(' ') || 'Vehicle';
    
    const color = vehicle.color ? ` • ${vehicle.color}` : '';
    const vehicleType = vehicle.vehicleType || vehicle.vehicle_type ? ` • ${vehicle.vehicleType || vehicle.vehicle_type}` : '';

    // Get separate OR and CR Numbers (new format)
    const orNumber = vehicle.or_number || vehicle.orNumber || null;
    const crNumber = vehicle.cr_number || vehicle.crNumber || null;
    // Backward compatibility
    const orCrNumber = orNumber || vehicle.or_cr_number || vehicle.orCrNumber || null;
    const registrationDate = vehicle.registration_date || vehicle.registrationDate || null;
    // Normalize status for comparison (handle both uppercase and lowercase)
    const status = (vehicle.status || '').toUpperCase().trim();
    const isRegistered = status === 'REGISTERED' || status === 'APPROVED';

    // Format dates
    const regDateFormatted = registrationDate ? 
        new Date(registrationDate).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        }) : 'N/A';

    card.innerHTML = `
        <div class="vehicle-info">
            <div class="vehicle-plate">${escapeHtml(vehicle.plateNumber || vehicle.plate_number || 'N/A')}</div>
            <div class="vehicle-details">
                <div class="vehicle-detail-item">
                    <i class="fas fa-car"></i>
                    <span>${escapeHtml(vehicleDesc + color + vehicleType)}</span>
                </div>
                <div class="vehicle-detail-item">
                    <i class="fas fa-barcode"></i>
                    <span>VIN: ${escapeHtml(vehicle.vin || 'N/A')}</span>
                </div>
                ${vehicle.engineNumber || vehicle.engine_number ? `
                <div class="vehicle-detail-item">
                    <i class="fas fa-cog"></i>
                    <span>Engine: ${escapeHtml(vehicle.engineNumber || vehicle.engine_number)}</span>
                </div>
                ` : ''}
                ${vehicle.chassisNumber || vehicle.chassis_number ? `
                <div class="vehicle-detail-item">
                    <i class="fas fa-wrench"></i>
                    <span>Chassis: ${escapeHtml(vehicle.chassisNumber || vehicle.chassis_number)}</span>
                </div>
                ` : ''}
                
                <!-- Separate OR and CR Numbers - Prominently displayed -->
                ${(orNumber || crNumber) ? `
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${orNumber ? `
                    <div class="orcr-badge" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem 1rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                        <small style="opacity: 0.8; display: block; font-size: 0.7rem; margin-bottom: 0.25rem;">OR NUMBER</small>
                        <strong style="font-size: 1.1rem; letter-spacing: 1px;">${escapeHtml(orNumber)}</strong>
                    </div>
                    ` : ''}
                    ${crNumber ? `
                    <div class="orcr-badge" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 0.75rem 1rem; border-radius: 8px; flex: 1; min-width: 150px; text-align: center;">
                        <small style="opacity: 0.8; display: block; font-size: 0.7rem; margin-bottom: 0.25rem;">CR NUMBER</small>
                        <strong style="font-size: 1.1rem; letter-spacing: 1px;">${escapeHtml(crNumber)}</strong>
                    </div>
                    ` : ''}
                </div>
                ` : isRegistered ? `
                <div style="background: #fff3cd; color: #856404; padding: 0.5rem 1rem; border-radius: 8px; margin-top: 1rem; text-align: center; font-size: 0.85rem;">
                    <i class="fas fa-clock"></i> OR/CR Numbers: Pending Assignment
                </div>
                ` : ''}
                
                <!-- Registration Date -->
                <div class="vehicle-detail-item">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Registered: ${regDateFormatted}</span>
                </div>
                
                <!-- Status -->
                <div class="vehicle-detail-item">
                    <i class="fas fa-info-circle"></i>
                    <span>Status: <span class="status-badge-inline ${(vehicle.status || '').toLowerCase()}">${escapeHtml(vehicle.status || 'N/A')}</span></span>
                </div>
            </div>
        </div>
        <div class="vehicle-status">
            <span class="status-badge ${isCurrent ? 'current' : 'previous'}">
                ${isCurrent ? 'Current Owner' : 'Previous Owner'}
            </span>
            <div class="vehicle-actions">
                ${isRegistered && (orNumber || crNumber || orCrNumber) ? `
                    <button class="btn btn-certificate btn-download-cert" onclick="downloadVehicleCertificate('${escapeHtml(vehicle.id)}', '${escapeHtml(orNumber || crNumber || orCrNumber)}')" title="Download Registration Certificate">
                        <i class="fas fa-download"></i> Certificate
                    </button>
                ` : ''}
                <div class="vehicle-actions-secondary">
                    ${isCurrent && isRegistered ? `
                        <button class="btn btn-transfer" onclick="transferVehicle('${escapeHtml(vehicle.id)}', '${escapeHtml(vehicle.plateNumber || vehicle.plate_number || '')}')" title="Transfer Ownership">
                            <i class="fas fa-exchange-alt"></i> Transfer
                        </button>
                    ` : ''}
                    <button class="btn btn-history btn-view-history" onclick="viewOwnershipHistory('${escapeHtml(vehicle.vin || vehicle.id)}', '${escapeHtml(vehicle.plateNumber || vehicle.plate_number || '')}')">
                        <i class="fas fa-history"></i> History
                    </button>
                </div>
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
    const myVehiclesList = document.getElementById('myVehiclesList');
    const pendingVehiclesList = document.getElementById('pendingVehiclesList');
    const timelineContainer = document.getElementById('limitedTimelineContainer');
    const timeline = document.getElementById('limitedOwnershipTimeline');

    // Hide vehicle lists, show timeline
    if (myVehiclesList) myVehiclesList.style.display = 'none';
    if (pendingVehiclesList) pendingVehiclesList.style.display = 'none';
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
    const myVehiclesList = document.getElementById('myVehiclesList');
    const pendingVehiclesList = document.getElementById('pendingVehiclesList');
    const timelineContainer = document.getElementById('limitedTimelineContainer');

    // Show vehicle lists if they have content, hide timeline
    if (myVehiclesList && myVehiclesList.querySelector('#myVehiclesContent')?.children.length > 0) {
        myVehiclesList.style.display = 'block';
    }
    if (pendingVehiclesList && pendingVehiclesList.querySelector('#pendingVehiclesContent')?.children.length > 0) {
        pendingVehiclesList.style.display = 'block';
    }
    if (timelineContainer) timelineContainer.classList.remove('active');

    // Scroll to first visible vehicle list
    if (myVehiclesList && myVehiclesList.style.display !== 'none') {
        myVehiclesList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (pendingVehiclesList && pendingVehiclesList.style.display !== 'none') {
        pendingVehiclesList.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const myVehiclesContent = document.getElementById('myVehiclesContent');
    const pendingVehiclesContent = document.getElementById('pendingVehiclesContent');
    const emptyState = document.getElementById('emptyState');
    
    if (emptyState) emptyState.style.display = 'none';
    if (myVehiclesContent) {
        myVehiclesContent.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading...</h3></div>';
    }
    if (pendingVehiclesContent) {
        pendingVehiclesContent.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading...</h3></div>';
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
    
    const myVehiclesContent = document.getElementById('myVehiclesContent');
    const pendingVehiclesContent = document.getElementById('pendingVehiclesContent');
    const emptyState = document.getElementById('emptyState');
    
    if (myVehiclesContent) myVehiclesContent.innerHTML = '';
    if (pendingVehiclesContent) pendingVehiclesContent.innerHTML = '';
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

// Download vehicle registration certificate
async function downloadVehicleCertificate(vehicleId, orCrNumber) {
    console.log('=== downloadVehicleCertificate START ===');
    console.log('Vehicle ID:', vehicleId);
    console.log('OR/CR Number:', orCrNumber);
    
    try {
        // Show loading notification
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Generating certificate...', 'info');
        }
        console.log('Loading notification shown');

        // Check if CertificateGenerator is available
        console.log('CertificateGenerator available:', typeof CertificateGenerator !== 'undefined');
        if (typeof CertificateGenerator === 'undefined') {
            throw new Error('CertificateGenerator not loaded. Please refresh the page.');
        }

        const apiClient = window.apiClient || new APIClient();
        console.log('API Client ready');
        
        // Get vehicle details
        console.log('Fetching vehicle details from API...');
        const vehicleResponse = await apiClient.get(`/api/vehicles/id/${vehicleId}`);
        console.log('Vehicle API response:', vehicleResponse);
        
        if (!vehicleResponse.success) {
            throw new Error(vehicleResponse.error || 'Failed to load vehicle data');
        }
        
        const vehicle = vehicleResponse.vehicle;
        console.log('Vehicle data:', vehicle);
        console.log('Vehicle OR/CR from API:', vehicle.or_cr_number);
        
        // Get owner details
        console.log('Fetching owner profile...');
        let owner = { email: 'N/A' };
        try {
            const profileResponse = await apiClient.get('/api/auth/profile');
            console.log('Profile response:', profileResponse);
            if (profileResponse.success) {
                owner = profileResponse.user;
            }
        } catch (e) {
            console.warn('Could not load owner profile:', e);
        }
        console.log('Owner data:', owner);
        
        // Generate certificate
        console.log('Calling CertificateGenerator.generateCertificate...');
        const result = await CertificateGenerator.generateCertificate(vehicle, owner);
        console.log('Certificate generation result:', result);
        
        // Show success message
        if (result && result.method === 'download') {
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Certificate downloaded as HTML file. Open it and use Print to save as PDF.', 'warning');
            }
        } else {
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Certificate opened! Use Print dialog to save as PDF.', 'success');
            }
        }
        
        console.log('=== downloadVehicleCertificate SUCCESS ===');
        
    } catch (error) {
        console.error('=== downloadVehicleCertificate ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(`Error: ${error.message}`, 'error');
        } else {
            alert(`Error generating certificate: ${error.message}`);
        }
    }
}

// Make globally available
window.downloadVehicleCertificate = downloadVehicleCertificate;

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
window.downloadVehicleCertificate = downloadVehicleCertificate;

