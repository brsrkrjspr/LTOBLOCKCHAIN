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
    
    // Load transfer requests (where user is seller)
    loadMyTransferRequests();
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
        
        // TRANSFER_COMPLETED should be treated as REGISTERED (it's a temporary status that should be reverted)
        // Also handle TRANSFER_IN_PROGRESS which might appear in pending vehicles
        const normalizedStatus = (status === 'TRANSFER_COMPLETED' || status === 'TRANSFER_IN_PROGRESS') 
            ? 'REGISTERED' 
            : status;
        
        const isApprovedOrRegistered = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.isApprovedOrRegistered) 
            ? window.StatusUtils.isApprovedOrRegistered(normalizedStatus)
            : (normalizedStatus === 'APPROVED' || normalizedStatus === 'REGISTERED');

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

// Create origin type badge helper function
function createOriginTypeBadge(vehicle) {
    const originType = vehicle.origin_type || vehicle.originType || 'NEW_REG';
    
    if (originType === 'TRANSFER') {
        return '<span class="badge badge-green" style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem;"><i class="fas fa-exchange-alt"></i> Transferred</span>';
    } else {
        return '<span class="badge badge-blue" style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem;"><i class="fas fa-file-alt"></i> New Registration</span>';
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
    const docNumberForDownload = orNumber || crNumber || orCrNumber || '';

    const applicationRef = vehicle.applicationNumber || vehicle.application_number || vehicle.applicationReference || vehicle.application_reference || vehicle.referenceNumber || vehicle.reference_number || vehicle.id || 'N/A';
    const vehicleMeta = [
        vehicle.year ? vehicle.year : '',
        vehicle.make ? vehicle.make : '',
        vehicle.model ? vehicle.model : ''
    ].filter(Boolean).join(' ');
    const vehicleExtras = [vehicle.color || '', vehicle.vehicleType || vehicle.vehicle_type || ''].filter(Boolean).join(' • ');

    // Format dates
    const regDateFormatted = registrationDate ? 
        new Date(registrationDate).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        }) : 'N/A';

    card.innerHTML = `
        <div class="vehicle-card-grid">
            <div class="vehicle-identity">
                <span class="plate-label">Plate Number:</span>
                <div class="vehicle-plate">${escapeHtml(vehicle.plateNumber || vehicle.plate_number || 'N/A')}</div>
                <div class="vehicle-ref">Reference: ${escapeHtml(applicationRef)}</div>
                <div class="identity-meta">
                    <span class="status-chip ownership ${isCurrent ? 'current-owner' : 'previous-owner'}">
                        ${isCurrent ? 'Current Owner' : 'Previous Owner'}
                    </span>
                    <span class="status-chip state ${(vehicle.status || '').toLowerCase()}">
                        ${escapeHtml(vehicle.status || 'Pending')}
                    </span>
                    ${createOriginTypeBadge(vehicle)}
                </div>
            </div>
            <div class="vehicle-main">
                <div class="vehicle-detail-grid">
                    <div class="vehicle-detail-item highlight">
                        <i class="fas fa-car"></i>
                        <div>
                            <div class="detail-label">Vehicle</div>
                            <div class="detail-value">${escapeHtml(vehicleDesc || 'Vehicle')}</div>
                            ${vehicleExtras ? `<div class="detail-label" style="margin-top: 0.2rem;">${escapeHtml(vehicleExtras)}</div>` : ''}
                        </div>
                    </div>
                    <div class="vehicle-detail-item">
                        <i class="fas fa-barcode"></i>
                        <div>
                            <div class="detail-label">VIN</div>
                            <div class="detail-value">${escapeHtml(vehicle.vin || 'N/A')}</div>
                        </div>
                    </div>
                    ${vehicle.engineNumber || vehicle.engine_number ? `
                    <div class="vehicle-detail-item">
                        <i class="fas fa-cog"></i>
                        <div>
                            <div class="detail-label">Engine No.</div>
                            <div class="detail-value">${escapeHtml(vehicle.engineNumber || vehicle.engine_number)}</div>
                        </div>
                    </div>
                    ` : ''}
                    ${vehicle.chassisNumber || vehicle.chassis_number ? `
                    <div class="vehicle-detail-item">
                        <i class="fas fa-wrench"></i>
                        <div>
                            <div class="detail-label">Chassis No.</div>
                            <div class="detail-value">${escapeHtml(vehicle.chassisNumber || vehicle.chassis_number)}</div>
                        </div>
                    </div>
                    ` : ''}
                    <div class="vehicle-detail-item">
                        <i class="fas fa-calendar-alt"></i>
                        <div>
                            <div class="detail-label">Registration Date</div>
                            <div class="detail-value">${regDateFormatted}</div>
                        </div>
                    </div>
                </div>
                <div class="vehicle-documents">
                    <div class="document-card or ${(orNumber ? 'filled' : isRegistered ? 'pending' : '')}">
                        <span class="doc-label">OR Number</span>
                        <span class="doc-value">${escapeHtml(orNumber || (isRegistered ? 'Pending' : 'N/A'))}</span>
                    </div>
                    <div class="document-card cr ${(crNumber ? 'filled' : isRegistered ? 'pending' : '')}">
                        <span class="doc-label">CR Number</span>
                        <span class="doc-value">${escapeHtml(crNumber || (isRegistered ? 'Pending' : 'N/A'))}</span>
                    </div>
                </div>
                <div class="vehicle-meta-row">
                    <div class="registration-date"><i class="fas fa-calendar-day"></i> Registered: ${regDateFormatted}</div>
                </div>
            </div>
            <div class="vehicle-actions-rail">
                <div class="status-chip state ${(vehicle.status || '').toLowerCase()}" style="width: fit-content;">
                    ${escapeHtml(vehicle.status || 'Pending')}
                </div>
                <div class="action-stack vehicle-actions">
                    ${isRegistered && docNumberForDownload ? `
                        <button class="btn btn-certificate btn-download-cert" onclick="downloadVehicleCertificate('${escapeHtml(vehicle.id)}', '${escapeHtml(docNumberForDownload)}')" title="Download Registration Certificate">
                            <i class="fas fa-download"></i> Certificate
                        </button>
                    ` : `
                        <button class="btn btn-certificate" disabled title="Certificate available after approval">
                            <i class="fas fa-download"></i> Certificate
                        </button>
                    `}
                    ${isCurrent && isRegistered ? `
                        <button class="btn btn-transfer" onclick="transferVehicle('${escapeHtml(vehicle.id)}', '${escapeHtml(vehicle.plateNumber || vehicle.plate_number || '')}')" title="Transfer Ownership">
                            <i class="fas fa-exchange-alt"></i> Transfer
                        </button>
                    ` : `
                        <button class="btn btn-transfer" disabled title="Transfer available after approval">
                            <i class="fas fa-exchange-alt"></i> Transfer
                        </button>
                    `}
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

    // Add vehicle information header
    if (timeline && vehicle) {
        const vehicleInfo = document.createElement('div');
        vehicleInfo.className = 'vehicle-info-header';
        vehicleInfo.style.cssText = 'background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #e9ecef;';
        vehicleInfo.innerHTML = `
            <h3 style="margin: 0 0 0.75rem 0; color: #1e293b; font-size: 1.1rem;">
                <i class="fas fa-car" style="color: #3b82f6;"></i> Vehicle Information
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: 0.875rem;">
                <div>
                    <span style="color: #64748b; font-weight: 500;">VIN:</span>
                    <div style="color: #1e293b; font-family: monospace; margin-top: 0.25rem;">${escapeHtml(vehicle.vin || 'N/A')}</div>
                </div>
                <div>
                    <span style="color: #64748b; font-weight: 500;">Plate Number:</span>
                    <div style="color: #1e293b; font-weight: 600; margin-top: 0.25rem;">${escapeHtml(vehicle.plateNumber || vehicle.plate_number || 'Pending')}</div>
                </div>
                <div>
                    <span style="color: #64748b; font-weight: 500;">Vehicle:</span>
                    <div style="color: #1e293b; margin-top: 0.25rem;">
                        ${escapeHtml([vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'N/A')}
                    </div>
                </div>
                <div>
                    <span style="color: #64748b; font-weight: 500;">Vehicle Type:</span>
                    <div style="color: #1e293b; margin-top: 0.25rem;">${escapeHtml(vehicle.vehicle_type || vehicle.vehicleType || 'N/A')}</div>
                </div>
            </div>
        `;
        timeline.appendChild(vehicleInfo);
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
    const transactionId = period.transaction_id || period.transactionId || period.metadata?.transactionId || null;
    
    // Calculate duration
    const startDateObj = new Date(startDate);
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const durationMs = endDateObj - startDateObj;
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    const durationYears = Math.floor(durationDays / 365);
    const remainingDays = durationDays % 365;
    const durationMonths = Math.floor(remainingDays / 30);
    const finalDays = remainingDays % 30;
    
    let durationText = '';
    if (durationYears > 0) {
        durationText = `${durationYears} year${durationYears > 1 ? 's' : ''}`;
        if (durationMonths > 0) {
            durationText += `, ${durationMonths} month${durationMonths > 1 ? 's' : ''}`;
        }
    } else if (durationMonths > 0) {
        durationText = `${durationMonths} month${durationMonths > 1 ? 's' : ''}`;
        if (finalDays > 0) {
            durationText += `, ${finalDays} day${finalDays > 1 ? 's' : ''}`;
        }
    } else {
        durationText = `${durationDays} day${durationDays !== 1 ? 's' : ''}`;
    }
    
    // Mask transaction ID (first 8 chars + "..." + last 4 chars)
    const maskedTxId = transactionId && transactionId.length >= 12
        ? `${transactionId.substring(0, 8)}...${transactionId.substring(transactionId.length - 4)}`
        : null;
    
    // Determine action type
    const actionType = period.action === 'OWNERSHIP_TRANSFERRED' 
        ? 'Ownership Transfer' 
        : period.action === 'REGISTERED' || period.action === 'BLOCKCHAIN_REGISTERED'
        ? 'Initial Registration'
        : period.action || 'Ownership Record';
    
    const actionDescription = period.action === 'OWNERSHIP_TRANSFERRED'
        ? 'Vehicle ownership was transferred'
        : period.action === 'REGISTERED' || period.action === 'BLOCKCHAIN_REGISTERED'
        ? 'Vehicle was initially registered'
        : 'Ownership record created';

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
                    ${durationText ? `<div class="limited-node-duration" style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">
                        <i class="fas fa-clock"></i> Duration: ${durationText}
                    </div>` : ''}
                    <div class="limited-node-action" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e9ecef;">
                        <i class="fas fa-exchange-alt" style="color: #3b82f6;"></i> 
                        <strong>${escapeHtml(actionType)}</strong>
                        <div style="font-size: 0.875rem; color: #64748b; margin-top: 0.25rem;">
                            ${escapeHtml(actionDescription)}
                        </div>
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
            ${maskedTxId ? `
            <div class="limited-transaction-ref" style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #e9ecef;">
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
                    <span style="color: #64748b; font-weight: 500;">Transaction Reference:</span>
                    <code style="background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 4px; font-family: 'Courier New', monospace; color: #1e293b;">
                        ${escapeHtml(maskedTxId)}
                    </code>
                </div>
            </div>
            ` : ''}
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

// Load transfer requests where user is seller
async function loadMyTransferRequests() {
    try {
        const apiClient = window.apiClient || new APIClient();
        
        // Get transfer requests where user is seller
        const response = await apiClient.get('/api/vehicles/transfer/requests?status=REJECTED,UNDER_REVIEW,AWAITING_BUYER_DOCS,PENDING');
        
        if (!response.success) {
            console.warn('Failed to load transfer requests:', response.error);
            return;
        }
        
        const requests = response.requests || [];
        
        // Filter to only show rejected or pending requests (where document updates are needed)
        const updateableRequests = requests.filter(req => {
            const status = (req.status || '').toUpperCase();
            const normalized = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.normalizeStatus) 
                ? window.StatusUtils.normalizeStatus(req.status)
                : status.toLowerCase();
            return (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.canUpdateDocuments) 
                ? window.StatusUtils.canUpdateDocuments(req.status)
                : (status === 'REJECTED' || status === 'UNDER_REVIEW' || status === 'AWAITING_BUYER_DOCS' || status === 'PENDING');
        });
        
        if (updateableRequests.length === 0) {
            // Hide section if no updateable requests
            const listEl = document.getElementById('myTransferRequestsList');
            if (listEl) listEl.style.display = 'none';
            return;
        }
        
        // Display transfer requests
        displayMyTransferRequests(updateableRequests);
        
    } catch (error) {
        console.error('Error loading transfer requests:', error);
        // Don't show error to user - this is a secondary feature
    }
}

// Display transfer requests with document update options
function displayMyTransferRequests(requests) {
    const listEl = document.getElementById('myTransferRequestsList');
    const contentEl = document.getElementById('myTransferRequestsContent');
    const countEl = document.getElementById('myTransferRequestsCount');
    
    if (!listEl || !contentEl) {
        console.error('Transfer requests DOM elements not found');
        return;
    }
    
    // Show section
    listEl.style.display = 'block';
    
    // Update count
    if (countEl) countEl.textContent = requests.length;
    
    // Clear existing content
    contentEl.innerHTML = '';
    
    // Create cards for each transfer request
    requests.forEach(request => {
        const card = createTransferRequestCard(request);
        contentEl.appendChild(card);
    });
}

// Create transfer request card with document update options
function createTransferRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'vehicle-card';
    card.style.marginBottom = '1rem';
    
    const vehicle = request.vehicle || {};
    const status = (request.status || '').toUpperCase();
    const normalizedStatus = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.normalizeStatus) 
        ? window.StatusUtils.normalizeStatus(request.status)
        : status.toLowerCase();
    const canUpdate = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.canUpdateDocuments) 
        ? window.StatusUtils.canUpdateDocuments(request.status)
        : ['rejected', 'under_review', 'awaiting_buyer_docs', 'pending'].includes(normalizedStatus);
    
    // Get rejection reason if available
    const rejectionReason = request.rejectionReason || request.rejection_reason || null;
    
    // Format date
    const createdDate = request.created_at || request.createdAt;
    const dateFormatted = createdDate ? new Date(createdDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) : 'N/A';
    
    // Get buyer name
    const buyerName = request.buyer_name || 
                     (request.buyer_info && request.buyer_info.email ? request.buyer_info.email : 'Pending') ||
                     'Pending';
    
    card.innerHTML = `
        <div style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h4 style="margin: 0 0 0.5rem 0; color: #1f2937;">
                        <i class="fas fa-exchange-alt" style="color: #3b82f6; margin-right: 0.5rem;"></i>
                        Transfer Request
                    </h4>
                    <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">
                        Vehicle: ${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.year || ''}) - ${vehicle.plate_number || vehicle.vin || 'N/A'}
                    </p>
                    <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">
                        Buyer: ${escapeHtml(buyerName)} • Created: ${dateFormatted}
                    </p>
                </div>
                <span class="status-chip state ${normalizedStatus}" style="font-size: 0.875rem; padding: 0.4rem 0.8rem;">
                    ${escapeHtml(request.status || 'PENDING')}
                </span>
            </div>
            
            ${rejectionReason ? `
            <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
                <h5 style="margin: 0 0 0.5rem 0; color: #721c24; font-size: 0.9375rem;">
                    <i class="fas fa-exclamation-triangle"></i> Reason for Rejection
                </h5>
                <p style="margin: 0; color: #721c24; white-space: pre-wrap; font-size: 0.875rem;">${escapeHtml(rejectionReason)}</p>
            </div>
            ` : ''}
            
            ${canUpdate ? `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                <button class="btn btn-primary" onclick="showTransferRequestDetails('${escapeHtml(request.id)}')" style="width: 100%;">
                    <i class="fas fa-eye"></i> View Details & Update Documents
                </button>
            </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

// Show transfer request details modal with documents
async function showTransferRequestDetails(requestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/vehicles/transfer/requests/${requestId}`);
        
        if (!response.success || !response.transferRequest) {
            throw new Error(response.error || 'Failed to load transfer request');
        }
        
        const request = response.transferRequest;
        const vehicle = request.vehicle || {};
        const documents = request.documents || [];
        const status = (request.status || '').toUpperCase();
        const normalizedStatus = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.normalizeStatus) 
            ? window.StatusUtils.normalizeStatus(request.status)
            : status.toLowerCase();
        // Allow document uploads when PENDING (accepting), AWAITING_BUYER_DOCS, or UNDER_REVIEW (updates)
        const canUpdate = status === 'PENDING' || status === 'AWAITING_BUYER_DOCS' || status === 'UNDER_REVIEW' || normalizedStatus === 'under_review';
        
        // Create modal using existing CSS classes
        const modal = document.createElement('div');
        modal.id = 'transferRequestDetailsModal';
        modal.className = 'modal active';
        
        // Buyer-required documents only (seller already submitted Deed of Sale, Valid ID; OR/CR is bound to vehicle)
        const buyerDocumentTypes = [
            { key: 'buyer_id', label: 'Valid ID', icon: 'fa-id-card', type: 'id' },
            { key: 'buyer_tin', label: 'TIN', icon: 'fa-file-invoice', type: 'id' },
            { key: 'buyer_hpg_clearance', label: 'HPG Clearance', icon: 'fa-shield-alt', type: 'other' },
            { key: 'buyer_ctpl', label: 'CTPL (Insurance)', icon: 'fa-shield-alt', type: 'insurance' }
        ];
        
        // Build documents map
        const documentsMap = {};
        documents.forEach(doc => {
            const key = doc.document_type || doc.type;
            documentsMap[key] = {
                id: doc.document_id || doc.id,
                filename: doc.original_name || doc.filename || key,
                type: key
            };
        });
        
        // Show seller documents as read-only (already submitted by seller)
        const sellerDocumentsHTML = [];
        const sellerDocTypes = [
            { key: 'deed_of_sale', label: 'Deed of Sale', icon: 'fa-file-contract' },
            { key: 'seller_id', label: 'Seller Valid ID', icon: 'fa-user-tag' }
        ];
        
        sellerDocTypes.forEach(docType => {
            const docData = documentsMap[docType.key];
            if (docData) {
                sellerDocumentsHTML.push(`
                    <div class="doc-select-item" style="opacity: 0.8; background: #f0f0f0;">
                        <div class="doc-select-icon">
                            <i class="fas ${docType.icon}"></i>
                        </div>
                        <div class="doc-select-info">
                            <div class="doc-select-title">${docType.label} <span style="font-size: 0.75rem; color: #6c757d;">(Seller submitted)</span></div>
                            <div class="doc-select-subtitle">${docData.filename}</div>
                            <div class="doc-select-status">
                                <i class="fas fa-check-circle" style="color: #27ae60;"></i> Submitted
                            </div>
                        </div>
                        <div class="doc-select-actions">
                            <button class="btn-icon" onclick="window.openTransferDocument && window.openTransferDocument('${docData.id}')" title="View Document">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                `);
            }
        });
        
        // Show buyer-required documents with upload capability
        let buyerDocumentsHTML = '';
        buyerDocumentTypes.forEach(docType => {
            const docData = documentsMap[docType.key];
            if (docData) {
                buyerDocumentsHTML += `
                    <div class="doc-select-item" data-doc-key="${docType.key}" data-doc-id="${docData.id || ''}">
                        <div class="doc-select-icon">
                            <i class="fas ${docType.icon}"></i>
                        </div>
                        <div class="doc-select-info">
                            <div class="doc-select-title">${docType.label}</div>
                            <div class="doc-select-subtitle">${docData.filename}</div>
                            <div class="doc-select-status">
                                <i class="fas fa-check-circle" style="color: #27ae60;"></i> Uploaded
                            </div>
                        </div>
                        <div class="doc-select-actions" style="display: flex; gap: 0.5rem;">
                            <button class="btn-icon" onclick="window.openTransferDocument && window.openTransferDocument('${docData.id}')" title="View Document">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${canUpdate ? `
                            <button class="btn-icon btn-update-doc" onclick="window.updateTransferDocument && window.updateTransferDocument('${docType.key}', '${docType.label}', '${docData.id || ''}', '${requestId}', '${vehicle.id || request.vehicle_id}')" title="Update Document" style="color: #3498db;">
                                <i class="fas fa-upload"></i>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                // Show placeholder for missing buyer documents
                buyerDocumentsHTML += `
                    <div class="doc-select-item" data-doc-key="${docType.key}">
                        <div class="doc-select-icon">
                            <i class="fas ${docType.icon}"></i>
                        </div>
                        <div class="doc-select-info">
                            <div class="doc-select-title">${docType.label}</div>
                            <div class="doc-select-subtitle">Not uploaded yet</div>
                            <div class="doc-select-status">
                                <i class="fas fa-exclamation-circle" style="color: #e67e22;"></i> Required
                            </div>
                        </div>
                        ${canUpdate ? `
                        <div class="doc-select-actions">
                            <button class="btn-icon btn-update-doc" onclick="window.updateTransferDocument && window.updateTransferDocument('${docType.key}', '${docType.label}', '', '${requestId}', '${vehicle.id || request.vehicle_id}')" title="Upload Document" style="color: #3498db;">
                                <i class="fas fa-upload"></i>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                `;
            }
        });
        
        const documentListHTML = sellerDocumentsHTML.join('') + buyerDocumentsHTML;
        
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <i class="fas fa-exchange-alt" style="font-size: 1.5rem; color: #3b82f6;"></i>
                        <div>
                            <h2 style="margin: 0;">Transfer Request Details</h2>
                            <small style="color: #6b7280; font-size: 0.875rem;">ID: ${requestId.substring(0, 8)}...</small>
                        </div>
                    </div>
                    <button class="modal-close" onclick="closeTransferRequestDetailsModal()" type="button">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <!-- Status Banner -->
                    <div class="status-banner status-banner-${normalizedStatus}">
                        <i class="fas ${getStatusIconForTransfer(status)}"></i>
                        <span>${request.status || 'PENDING'}</span>
                    </div>
                    
                    ${request.rejectionReason ? `
                    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
                        <h4 style="margin-top: 0; color: #721c24; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-exclamation-triangle"></i> Reason for Rejection
                        </h4>
                        <p style="margin: 0; white-space: pre-wrap; color: #721c24;">${escapeHtml(request.rejectionReason)}</p>
                    </div>
                    ` : ''}
                    
                    <!-- Vehicle Info -->
                    <div class="detail-section">
                        <h4><i class="fas fa-car"></i> Vehicle Information</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">VIN</span>
                                <span class="detail-value">${vehicle.vin || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Plate Number</span>
                                <span class="detail-value">${vehicle.plate_number || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Make</span>
                                <span class="detail-value">${vehicle.make || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Model</span>
                                <span class="detail-value">${vehicle.model || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Year</span>
                                <span class="detail-value">${vehicle.year || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Documents Section -->
                    <div class="detail-section">
                        <h4><i class="fas fa-folder-open"></i> Documents</h4>
                        ${status === 'PENDING' ? `
                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px; font-size: 0.875rem; color: #856404;">
                            <strong><i class="fas fa-exclamation-circle"></i> Action Required:</strong> Please upload all required documents (Valid ID, TIN, HPG Clearance, CTPL) and click "Accept & Submit Documents" to complete your acceptance.
                        </div>
                        ` : status === 'AWAITING_BUYER_DOCS' ? `
                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px; font-size: 0.875rem; color: #856404;">
                            <strong><i class="fas fa-exclamation-circle"></i> Action Required:</strong> Please upload all required documents (Valid ID, TIN, HPG Clearance, CTPL) before submitting.
                        </div>
                        ` : ''}
                        <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px; font-size: 0.875rem; color: #0c4a6e;">
                            <strong><i class="fas fa-info-circle"></i> Your required documents:</strong> Upload Valid ID, TIN, HPG Clearance, CTPL. Seller documents (Deed of Sale, Seller ID) are shown below for reference only. MVIR is completed by LTO during inspection.
                        </div>
                        ${documentListHTML ? `
                            <div class="doc-select-list">
                                ${documentListHTML}
                            </div>
                        ` : '<p style="color: #7f8c8d;">No documents uploaded yet. Upload Valid ID, TIN, HPG Clearance, and CTPL above.</p>'}
                    </div>
                </div>
                
                <div class="modal-footer">
                    ${status === 'PENDING' || status === 'AWAITING_BUYER_DOCS' ? `
                    <button class="btn-primary" type="button" onclick="window.submitTransferAcceptance && window.submitTransferAcceptance('${requestId}')" style="margin-right: 0.5rem;">
                        <i class="fas fa-check"></i> ${status === 'PENDING' ? 'Accept & Submit Documents' : 'Submit Documents'}
                    </button>
                    ` : ''}
                    <button class="btn-secondary" type="button" onclick="window.closeTransferRequestDetailsModal && window.closeTransferRequestDetailsModal()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error showing transfer request details:', error);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(`Error: ${error.message}`, 'error');
        } else {
            alert(`Error: ${error.message}`);
        }
    }
}

function closeTransferRequestDetailsModal() {
    const modal = document.getElementById('transferRequestDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300); // Wait for fade out animation
        document.body.style.overflow = '';
    }
}

function getStatusIconForTransfer(status) {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'REJECTED') return 'fa-times-circle';
    if (normalized === 'APPROVED' || normalized === 'COMPLETED') return 'fa-check-circle';
    if (normalized === 'UNDER_REVIEW' || normalized === 'AWAITING_BUYER_DOCS') return 'fa-clock';
    return 'fa-hourglass-half';
}

function openTransferDocument(documentId) {
    if (documentId) {
        window.open(`/api/documents/${documentId}/view`, '_blank');
    }
}

// Update document for transfer request
async function updateTransferDocument(docKey, docLabel, docId, transferRequestId, vehicleId) {
    // Reuse the document update modal from owner-dashboard.js if available
    if (typeof window.showDocumentUpdateModal === 'function') {
        // Show modal with transfer request context
        window.showDocumentUpdateModal(docKey, docLabel, docId, transferRequestId, true, transferRequestId, vehicleId);
    } else {
        // Fallback: create our own modal
        alert('Document update functionality is being initialized. Please try again in a moment.');
    }
}

// Helper function to escape HTML (if not already defined)
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Accept and submit documents (one action)
async function submitTransferAcceptance(requestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        
        // Get the current transfer request to check what documents are uploaded
        const response = await apiClient.get(`/api/vehicles/transfer/requests/${requestId}`);
        
        if (!response.success || !response.transferRequest) {
            throw new Error(response.error || 'Failed to load transfer request');
        }
        
        const request = response.transferRequest;
        const documents = request.documents || [];
        const status = (request.status || '').toUpperCase();
        
        // Map uploaded documents to the format expected by the backend
        const documentsMap = {};
        documents.forEach(doc => {
            const docType = doc.document_type || doc.type;
            if (docType && doc.document_id) {
                // Map document types to backend expected format
                if (docType === 'buyer_id') documentsMap.buyer_id = doc.document_id;
                else if (docType === 'buyer_tin') documentsMap.buyer_tin = doc.document_id;
                else if (docType === 'buyer_ctpl') documentsMap.buyer_ctpl = doc.document_id;
                else if (docType === 'buyer_hpg_clearance') documentsMap.buyer_hpg_clearance = doc.document_id;
            }
        });
        
        // Check if buyer has uploaded required documents
        const requiredDocs = ['buyer_id', 'buyer_tin', 'buyer_ctpl', 'buyer_hpg_clearance'];
        const missingDocs = requiredDocs.filter(docKey => !documentsMap[docKey]);
        
        if (missingDocs.length > 0) {
            const missingLabels = {
                'buyer_id': 'Valid ID',
                'buyer_tin': 'TIN',
                'buyer_ctpl': 'CTPL',
                'buyer_hpg_clearance': 'HPG Clearance'
            };
            const missingList = missingDocs.map(key => missingLabels[key] || key).join(', ');
            throw new Error(`Please upload all required documents: ${missingList}`);
        }
        
        // Accept and submit documents in one action (accept endpoint handles both PENDING and AWAITING_BUYER_DOCS)
        const acceptResponse = await apiClient.post(`/api/vehicles/transfer/requests/${requestId}/accept`, {
            documents: documentsMap
        });
        
        if (acceptResponse.success) {
            // Build success message with auto-forward information
            let successMessage = 'Documents submitted successfully! Transfer request is now under review.';
            
            if (acceptResponse.autoForward) {
                const autoForward = acceptResponse.autoForward;
                const forwardedOrgs = [];
                
                if (autoForward.results?.hpg?.success) {
                    forwardedOrgs.push('HPG');
                }
                if (autoForward.results?.insurance?.success) {
                    forwardedOrgs.push('Insurance');
                }
                
                if (forwardedOrgs.length > 0) {
                    successMessage += ` Documents have been automatically sent to ${forwardedOrgs.join(' and ')} for verification.`;
                } else if (autoForward.skipped) {
                    // Auto-forward was skipped (already forwarded or not eligible)
                    console.log('Auto-forward skipped:', autoForward.reason);
                }
            }
            
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show(successMessage, 'success', 5000);
            } else {
                alert(successMessage);
            }
            
            // Close the modal
            closeTransferRequestDetailsModal();
            
            // Reload incoming requests
            if (typeof loadIncomingTransferRequests === 'function') {
                loadIncomingTransferRequests();
            } else if (typeof window.loadIncomingTransferRequests === 'function') {
                window.loadIncomingTransferRequests();
            }
        } else {
            throw new Error(acceptResponse.error || 'Failed to submit documents');
        }
    } catch (error) {
        console.error('Error submitting documents:', error);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(`Error: ${error.message || 'Failed to submit documents'}`, 'error');
        } else {
            alert(`Error: ${error.message || 'Failed to submit documents'}`);
        }
    }
}

// Make functions globally available
window.loadMyTransferRequests = loadMyTransferRequests;
window.showTransferRequestDetails = showTransferRequestDetails;
window.closeTransferRequestDetailsModal = closeTransferRequestDetailsModal;
window.updateTransferDocument = updateTransferDocument;
window.openTransferDocument = openTransferDocument;
window.submitTransferAcceptance = submitTransferAcceptance;

// Make functions globally available for inline onclick handlers
window.viewOwnershipHistory = viewOwnershipHistory;
window.backToVehicleList = backToVehicleList;
window.verifyOwnershipPeriod = verifyOwnershipPeriod;
window.closeVerificationModal = closeVerificationModal;
window.transferVehicle = transferVehicle;
window.downloadVehicleCertificate = downloadVehicleCertificate;

