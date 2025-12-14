// Vehicle Ownership Trace - Admin JavaScript
// Handles vehicle ownership history tracing and blockchain verification

document.addEventListener('DOMContentLoaded', function() {
    initializeOwnershipTrace();
});

let currentVehicleData = null;

function initializeOwnershipTrace() {
    // Initialize user information
    if (typeof AuthUtils !== 'undefined') {
        const user = AuthUtils.getCurrentUser();
        if (user) {
            const sidebarUserNameEl = document.getElementById('sidebarUserAvatar');
            const sidebarUserRoleEl = document.getElementById('sidebarUserRole');
            if (sidebarUserNameEl) sidebarUserNameEl.textContent = AuthUtils.getUserInitials() || 'AD';
            if (sidebarUserRoleEl) sidebarUserRoleEl.textContent = 'LTO Administrator';
        }
    }

    // Sidebar toggle
    const sidebar = document.querySelector('.dashboard-sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function(e) {
            e.preventDefault();
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('adminSidebarCollapsed', sidebar.classList.contains('collapsed') ? 'true' : 'false');
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

    // Search form handler
    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            searchVehicle();
        });
    }

    // Check for VIN/plate in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const vin = urlParams.get('vin');
    const plate = urlParams.get('plate');
    if (vin) {
        document.getElementById('searchInput').value = vin;
        searchVehicle();
    } else if (plate) {
        document.getElementById('searchInput').value = plate;
        searchVehicle();
    }
}

async function searchVehicle() {
    const searchInput = document.getElementById('searchInput').value.trim();
    const statusFilter = document.getElementById('statusFilter').value;

    if (!searchInput) {
        showError('Please enter a plate number, VIN, or Vehicle ID');
        return;
    }

    try {
        showLoading();

        // Try to find vehicle by VIN first
        let vehicle = null;
        let vin = null;

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Check if input looks like a VIN (17 characters, alphanumeric)
        if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(searchInput)) {
            vin = searchInput.toUpperCase();
        } else {
            // Try to get vehicle by plate number
            const plateResponse = await apiClient.get(`/api/vehicles/plate/${encodeURIComponent(searchInput)}`);
            if (plateResponse.success && plateResponse.vehicle) {
                vehicle = plateResponse.vehicle;
                vin = vehicle.vin;
            }
        }

        // If we have VIN but not vehicle, get vehicle by VIN
        if (vin && !vehicle) {
            const vinResponse = await apiClient.get(`/api/vehicles/${vin}`);
            if (vinResponse.success && vinResponse.vehicle) {
                vehicle = vinResponse.vehicle;
            }
        }

        if (!vehicle) {
            showError('Vehicle not found. Please check the plate number or VIN.');
            hideLoading();
            return;
        }

        // Apply status filter if needed
        if (statusFilter && vehicle.status !== statusFilter) {
            showError('Vehicle status does not match filter');
            hideLoading();
            return;
        }

        // Load ownership history
        await loadOwnershipHistory(vehicle.vin, vehicle);

    } catch (error) {
        console.error('Search vehicle error:', error);
        showError(error.message || 'Failed to search vehicle. Please try again.');
        hideLoading();
    }
}

async function loadOwnershipHistory(vin, vehicle) {
    try {
        showLoading();

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get ownership history from backend
        const response = await apiClient.get(`/api/vehicles/${vin}/ownership-history`);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load ownership history');
        }

        currentVehicleData = {
            ...vehicle,
            ownershipHistory: response.ownershipHistory || []
        };

        // Display timeline
        displayOwnershipTimeline(currentVehicleData);

        hideLoading();

    } catch (error) {
        console.error('Load ownership history error:', error);
        showError(error.message || 'Failed to load ownership history');
        hideLoading();
    }
}

function displayOwnershipTimeline(vehicleData) {
    const timelineContainer = document.getElementById('timelineContainer');
    const emptyState = document.getElementById('emptyState');
    const timeline = document.getElementById('ownershipTimeline');
    const vehicleInfoSummary = document.getElementById('vehicleInfoSummary');

    // Hide empty state, show timeline
    if (emptyState) emptyState.style.display = 'none';
    if (timelineContainer) timelineContainer.style.display = 'block';

    // Update vehicle info summary
    if (vehicleInfoSummary) {
        vehicleInfoSummary.innerHTML = `
            <div class="vehicle-info-item">
                <div class="vehicle-info-label">Plate Number</div>
                <div class="vehicle-info-value">${vehicleData.plate_number || vehicleData.plateNumber || 'N/A'}</div>
            </div>
            <div class="vehicle-info-item">
                <div class="vehicle-info-label">VIN</div>
                <div class="vehicle-info-value">${vehicleData.vin || 'N/A'}</div>
            </div>
            <div class="vehicle-info-item">
                <div class="vehicle-info-label">Vehicle</div>
                <div class="vehicle-info-value">${vehicleData.year || ''} ${vehicleData.make || ''} ${vehicleData.model || ''}</div>
            </div>
        `;
    }

    // Clear timeline
    if (timeline) timeline.innerHTML = '';

    const history = vehicleData.ownershipHistory || [];

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

    // Sort ownership history by date (newest first)
    const sortedHistory = [...history].sort((a, b) => {
        const dateA = new Date(a.performed_at || a.timestamp || a.startDate);
        const dateB = new Date(b.performed_at || b.timestamp || b.startDate);
        return dateB - dateA;
    });

    // Create timeline nodes
    sortedHistory.forEach((record, index) => {
        const node = createTimelineNode(record, index, sortedHistory.length);
        if (timeline) timeline.appendChild(node);
    });

    // Scroll to timeline
    if (timelineContainer) {
        timelineContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function createTimelineNode(record, index, total) {
    const node = document.createElement('div');
    
    // Determine if this is the current owner
    const isCurrent = index === 0; // First record is current
    const isFirst = index === 0;
    
    node.className = `timeline-node ${isCurrent ? 'current' : ''}`;
    
    // Extract data from record
    const ownerName = record.new_owner_name || record.owner_name || record.metadata?.newOwnerName || 'Unknown Owner';
    const ownerId = record.new_owner_id || record.owner_id || record.metadata?.newOwnerId || 'N/A';
    const startDate = record.performed_at || record.timestamp || record.startDate || new Date().toISOString();
    const endDate = record.metadata?.endDate || record.endDate || (isCurrent ? null : startDate);
    const transactionId = record.transaction_id || record.transactionId || record.metadata?.transactionId || 'N/A';
    const eventType = record.action || record.eventType || 'Ownership Transfer';
    
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

    node.innerHTML = `
        <div class="timeline-node-card">
            <button class="node-expand-btn" onclick="toggleTransactionDetails(this)">
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="node-header">
                <div class="node-owner-info">
                    <div class="node-owner-name">${escapeHtml(ownerName)}</div>
                    <div class="node-owner-details">Owner ID: ${escapeHtml(ownerId)}</div>
                </div>
                <div class="node-badges">
                    ${isCurrent ? '<span class="badge-current"><i class="fas fa-star"></i> Current Owner</span>' : ''}
                    <span class="badge-verified">
                        <i class="fas fa-shield-alt"></i> Verified
                    </span>
                    <span class="badge-transfer-type">${escapeHtml(eventType)}</span>
                </div>
            </div>
            <div class="node-dates">
                <div class="node-date-item">
                    <i class="fas fa-calendar-check"></i>
                    <span><strong>Start:</strong> ${startDateFormatted}</span>
                </div>
                <div class="node-date-item">
                    <i class="fas fa-calendar-times"></i>
                    <span><strong>End:</strong> ${endDateFormatted}</span>
                </div>
            </div>
            <div class="transaction-details">
                <div class="trust-indicators">
                    <div class="trust-indicator" title="Blockchain-verified ownership record">
                        <i class="fas fa-lock"></i>
                        <span>Blockchain Verified</span>
                    </div>
                    <div class="trust-indicator" title="Tamper-proof transaction record">
                        <i class="fas fa-shield-alt"></i>
                        <span>Tamper-Proof</span>
                    </div>
                </div>
                <div class="transaction-details-grid">
                    <div class="transaction-field" style="grid-column: 1 / -1;">
                        <div class="transaction-field-label">Transaction ID / Hash</div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            <div class="transaction-field-value" style="flex: 1; min-width: 200px;">${escapeHtml(transactionId)}</div>
                            <button 
                                class="btn-view-blockchain" 
                                onclick="viewTransactionOnBlockchain('${escapeHtml(transactionId)}', '${escapeHtml(ownerName)}', '${escapeHtml(eventType)}')"
                                title="View transaction on blockchain explorer"
                            >
                                <i class="fas fa-external-link-alt"></i> View on Blockchain
                            </button>
                            <button 
                                class="btn-copy-tx" 
                                onclick="copyTransactionId('${escapeHtml(transactionId)}')"
                                title="Copy transaction ID to clipboard"
                            >
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <div class="transaction-field">
                        <div class="transaction-field-label">Timestamp</div>
                        <div class="transaction-field-value">${new Date(startDate).toLocaleString('en-US')}</div>
                    </div>
                    <div class="transaction-field">
                        <div class="transaction-field-label">Event Type</div>
                        <div class="transaction-field-value">${escapeHtml(eventType)}</div>
                    </div>
                    <div class="transaction-field">
                        <div class="transaction-field-label">Status</div>
                        <div class="transaction-field-value">
                            <span class="badge-verified" style="display: inline-flex; padding: 0.25rem 0.5rem;">
                                <i class="fas fa-check-circle"></i> Verified
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return node;
}

function toggleTransactionDetails(button) {
    const node = button.closest('.timeline-node');
    const details = node.querySelector('.transaction-details');
    const isExpanded = details.classList.contains('expanded');

    if (isExpanded) {
        details.classList.remove('expanded');
        button.classList.remove('expanded');
    } else {
        // Close all other expanded nodes
        document.querySelectorAll('.transaction-details.expanded').forEach(d => {
            d.classList.remove('expanded');
            const btn = d.closest('.timeline-node').querySelector('.node-expand-btn');
            if (btn) btn.classList.remove('expanded');
        });
        details.classList.add('expanded');
        button.classList.add('expanded');
    }
}

function viewTransactionOnBlockchain(transactionId, ownerName, eventType) {
    // Open blockchain viewer with transaction ID
    const blockchainViewerUrl = `admin-blockchain-viewer.html?tx=${encodeURIComponent(transactionId)}`;
    window.open(blockchainViewerUrl, '_blank');
    
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Opening blockchain viewer...', 'info');
    }
}

function copyTransactionId(transactionId) {
    navigator.clipboard.writeText(transactionId).then(() => {
        const buttons = document.querySelectorAll('.btn-copy-tx');
        buttons.forEach(btn => {
            if (btn.textContent.includes(transactionId.substring(0, 10))) {
                const originalText = btn.innerHTML;
                btn.classList.add('copied');
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = originalText;
                }, 2000);
            }
        });
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Transaction ID copied to clipboard', 'success');
        }
    }).catch(err => {
        console.error('Copy error:', err);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Failed to copy transaction ID', 'error');
        }
    });
}

function showLoading() {
    const timelineContainer = document.getElementById('timelineContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (emptyState) emptyState.style.display = 'none';
    if (timelineContainer) {
        timelineContainer.style.display = 'block';
        const timeline = document.getElementById('ownershipTimeline');
        if (timeline) {
            timeline.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading...</h3></div>';
        }
    }
}

function hideLoading() {
    // Loading is hidden when timeline is populated
}

function showError(message) {
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, 'error');
    } else {
        alert(message);
    }
    
    const timelineContainer = document.getElementById('timelineContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (timelineContainer) timelineContainer.style.display = 'none';
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

// Make functions globally available for inline onclick handlers
window.searchVehicle = searchVehicle;
window.toggleTransactionDetails = toggleTransactionDetails;
window.viewTransactionOnBlockchain = viewTransactionOnBlockchain;
window.copyTransactionId = copyTransactionId;

