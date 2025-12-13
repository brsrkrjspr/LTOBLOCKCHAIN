/**
 * HPG Admin Module JavaScript
 * Handles all HPG Admin functionality including dashboard, requests, verification, certificates, and logs
 */

// HPG Dashboard Module
const HPGDashboard = {
    init: function() {
        this.loadDashboardStats();
        this.loadPendingRequests();
        this.loadNotifications();
        this.loadActivityLogPreview();
    },

    loadDashboardStats: async function() {
        try {
            // Stats are not displayed - all numbers removed
            // Placeholder: Replace with actual API call when needed
            const stats = {
                pending: 0,
                verified: 0,
                completed: 0,
                rejected: 0
            };

            // Keep elements but don't display numbers
            const pendingEl = document.getElementById('pendingRequests');
            const verifiedEl = document.getElementById('verifiedRequests');
            const completedEl = document.getElementById('completedCertificates');
            const rejectedEl = document.getElementById('rejectedRequests');
            const badgeEl = document.getElementById('pendingRequestsBadge');
            
            if (pendingEl) pendingEl.textContent = '-';
            if (verifiedEl) verifiedEl.textContent = '-';
            if (completedEl) completedEl.textContent = '-';
            if (rejectedEl) rejectedEl.textContent = '-';
            if (badgeEl) badgeEl.style.display = 'none';
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    },

    loadPendingRequests: async function() {
        try {
            const tbody = document.getElementById('pendingRequestsTableBody');
            if (!tbody) return;
            
            // Show loading state
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading requests...</td></tr>';
            
            // Call API to get HPG requests
            if (typeof APIClient !== 'undefined') {
                const apiClient = new APIClient();
                const response = await apiClient.get('/api/hpg/requests?status=PENDING');
                
                if (response && response.success && response.requests) {
                    const requests = response.requests;
                    
                    if (requests.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No pending requests</td></tr>';
                    } else {
                        tbody.innerHTML = requests.map(req => {
                            const requestDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A';
                            const vehicleInfo = req.vehicle || {};
                            const ownerInfo = req.owner || {};
                            
                            return `
                                <tr>
                                    <td><strong>${req.id.substring(0, 8)}...</strong></td>
                                    <td>${ownerInfo.first_name || ''} ${ownerInfo.last_name || 'Unknown'}</td>
                                    <td><span class="badge badge-plate">${vehicleInfo.plate_number || 'N/A'}</span></td>
                                    <td>${vehicleInfo.vehicle_type || 'N/A'}</td>
                                    <td><span class="badge badge-purpose">${req.purpose || 'Verification'}</span></td>
                                    <td>${requestDate}</td>
                                    <td><span class="status-badge status-${req.status?.toLowerCase() || 'pending'}">${req.status || 'PENDING'}</span></td>
                                    <td>
                                        <a href="hpg-verification-form.html?requestId=${req.id}" class="btn-primary btn-sm">
                                            <i class="fas fa-check"></i> Verify
                                        </a>
                                        <a href="hpg-requests-list.html?requestId=${req.id}" class="btn-secondary btn-sm">
                                            <i class="fas fa-eye"></i> View
                                        </a>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    }
                } else {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #e74c3c;">Failed to load requests. Please try again.</td></tr>';
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">API client not available</td></tr>';
            }
        } catch (error) {
            console.error('Error loading pending requests:', error);
            const tbody = document.getElementById('pendingRequestsTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #e74c3c;">Error: ${error.message || 'Failed to load requests'}</td></tr>`;
            }
        }
    },

    loadNotifications: async function() {
        try {
            // Placeholder: Replace with actual API call
            // Example: const response = await APIClient.get('/api/hpg/notifications');
            const notifications = [];

            const notificationsList = document.getElementById('notificationsList');
            if (notificationsList) {
                if (notifications.length === 0) {
                    notificationsList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 2rem;">No notifications</p>';
                } else {
                    notificationsList.innerHTML = notifications.map(notif => {
                        const icons = {
                            new_request: 'fa-exclamation-circle',
                            verification_completed: 'fa-check-circle',
                            certificate_released: 'fa-certificate'
                        };
                        return `
                            <div class="notification-item ${notif.unread ? 'unread' : ''}">
                                <div class="notification-icon">
                                    <i class="fas ${icons[notif.type] || 'fa-bell'}"></i>
                                </div>
                                <div class="notification-content">
                                    <h4>${notif.title}</h4>
                                    <p>${notif.message}</p>
                                    <span class="notification-time">${notif.time}</span>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // Notification badge hidden - no numbers displayed
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    },

    loadActivityLogPreview: async function() {
        try {
            // Placeholder: Replace with actual API call
            // Example: const response = await APIClient.get('/api/hpg/logs?limit=3');
            // const logs = await response.json();
            const logs = [];
            
            const previewContainer = document.getElementById('activityLogPreview');
            if (previewContainer) {
                if (logs.length === 0) {
                    previewContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 2rem;">No recent activity</p>';
                } else {
                    // Render activity logs preview
                    previewContainer.innerHTML = logs.map(log => {
                        const actionIcons = {
                            verified: 'fa-check',
                            rejected: 'fa-times-circle',
                            released: 'fa-certificate',
                            received: 'fa-clock'
                        };
                        const actionClasses = {
                            verified: 'verified',
                            rejected: 'rejected',
                            released: 'released',
                            received: 'pending'
                        };
                        return `
                            <div class="activity-item">
                                <div class="activity-icon ${actionClasses[log.action] || 'pending'}">
                                    <i class="fas ${actionIcons[log.action] || 'fa-clock'}"></i>
                                </div>
                                <div class="activity-content">
                                    <h4>${log.title || 'Activity'}</h4>
                                    <p>${log.details || ''}</p>
                                    <span class="activity-time">${log.time || ''}</span>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        } catch (error) {
            console.error('Error loading activity log preview:', error);
        }
    }
};

// HPG Requests Module
const HPGRequests = {
    requests: [],
    filteredRequests: [],

    loadRequests: async function() {
        try {
            // Try to load from API first
            if (typeof APIClient !== 'undefined') {
                try {
                    const apiClient = new APIClient();
                    const response = await apiClient.get('/api/hpg/requests');
                    if (response && response.success && response.requests) {
                        this.requests = response.requests;
                        this.filteredRequests = [...this.requests];
                        this.renderTable();
                        return;
                    }
                } catch (apiError) {
                    console.log('API not available, loading from localStorage');
                }
            }
            
            // Fallback: Load from localStorage or use sample data
            const hpgRequestPending = localStorage.getItem('hpgRequestPending') === 'true';
            const currentRequest = JSON.parse(localStorage.getItem('currentHPGRequest') || 'null');
            const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
            
            // Build requests array from available sources
            this.requests = [];
            
            // Add current HPG request if available
            if (currentRequest && hpgRequestPending) {
                this.requests.push({
                    id: currentRequest.requestId || currentRequest.id || 'REQ-HPG-001',
                    ownerName: currentRequest.ownerName || 'N/A',
                    plateNumber: currentRequest.plateNumber || 'N/A',
                    vehicleType: currentRequest.vehicleType || 'N/A',
                    purpose: currentRequest.purpose || 'Verification',
                    requestDate: new Date().toLocaleDateString(),
                    status: 'pending'
                });
            }
            
            // Add requests from submittedApplications that have hpgRequestPending flag
            applications.forEach(app => {
                if (app.hpgRequestPending === true) {
                    this.requests.push({
                        id: app.id,
                        ownerName: app.owner?.name || app.owner?.email || 'N/A',
                        plateNumber: app.vehicle?.plateNumber || 'N/A',
                        vehicleType: app.vehicle?.type || 'N/A',
                        purpose: app.purpose || 'Verification',
                        requestDate: app.created_at ? new Date(app.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
                        status: 'pending'
                    });
                }
            });
            
            // If still no requests, add sample data for testing
            if (this.requests.length === 0) {
                this.requests = [
                    {
                        id: 'REQ-HPG-001',
                        ownerName: 'Juan Dela Cruz',
                        plateNumber: 'ABC-1234',
                        vehicleType: 'Car',
                        purpose: 'Transfer of Ownership',
                        requestDate: new Date().toLocaleDateString(),
                        status: 'pending'
                    },
                    {
                        id: 'REQ-HPG-002',
                        ownerName: 'Maria Santos',
                        plateNumber: 'XYZ-5678',
                        vehicleType: 'Motorcycle',
                        purpose: 'New Registration',
                        requestDate: new Date().toLocaleDateString(),
                        status: 'pending'
                    }
                ];
            }

            this.filteredRequests = [...this.requests];
            this.renderTable();
        } catch (error) {
            console.error('Error loading requests:', error);
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleError(error);
            }
        }
    },

    filterRequests: function() {
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const purposeFilter = document.getElementById('purposeFilter')?.value || '';
        const searchInput = document.getElementById('searchInput')?.value.toLowerCase() || '';

        this.filteredRequests = this.requests.filter(req => {
            const matchesStatus = !statusFilter || req.status === statusFilter;
            const matchesPurpose = !purposeFilter || req.purpose.toLowerCase().replace(' ', '_') === purposeFilter;
            const matchesSearch = !searchInput || 
                req.id.toLowerCase().includes(searchInput) ||
                req.ownerName.toLowerCase().includes(searchInput) ||
                req.plateNumber.toLowerCase().includes(searchInput);

            return matchesStatus && matchesPurpose && matchesSearch;
        });

        this.renderTable();
    },

    renderTable: function() {
        const tbody = document.getElementById('requestsTableBody');
        if (!tbody) return;

        if (this.filteredRequests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No requests found</td></tr>';
            return;
        }

        tbody.innerHTML = this.filteredRequests.map(req => {
            const statusClass = `status-${req.status}`;
            const statusText = req.status.charAt(0).toUpperCase() + req.status.slice(1);
            
            return `
                <tr>
                    <td><strong>${req.id}</strong></td>
                    <td>${req.ownerName}</td>
                    <td><span class="badge badge-plate">${req.plateNumber}</span></td>
                    <td>${req.vehicleType}</td>
                    <td><span class="badge badge-purpose">${req.purpose}</span></td>
                    <td>${req.requestDate}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${req.status === 'pending' ? `
                                <button class="btn-primary btn-sm" onclick="startVerification('${req.id}')">
                                    <i class="fas fa-check"></i> Verify
                                </button>
                            ` : ''}
                            <button class="btn-secondary btn-sm" onclick="viewDetails('${req.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn-auto-verify btn-sm" onclick="autoFillVerification('${req.id}')" title="Automatically fetch vehicle details from LTO request for verification">
                                <i class="fas fa-bolt"></i> Auto Verify
                            </button>
                            <button class="btn-fetch-lto btn-sm" onclick="fetchLTOVehicleDetails('${req.id}')" title="Go to verification form and fetch LTO vehicle details">
                                <i class="fas fa-download"></i> Fetch LTO Details
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    loadRequestDetails: async function(requestId) {
        try {
            // Placeholder: Replace with actual API call
            const request = this.requests.find(r => r.id === requestId);
            if (!request) {
                alert('Request not found');
                return;
            }

            const content = document.getElementById('requestDetailsContent');
            if (content) {
                content.innerHTML = `
                    <div class="request-details">
                        <div class="detail-row">
                            <label>Request ID:</label>
                            <span>${request.id}</span>
                        </div>
                        <div class="detail-row">
                            <label>Owner Name:</label>
                            <span>${request.ownerName}</span>
                        </div>
                        <div class="detail-row">
                            <label>Plate Number:</label>
                            <span>${request.plateNumber}</span>
                        </div>
                        <div class="detail-row">
                            <label>Vehicle Type:</label>
                            <span>${request.vehicleType}</span>
                        </div>
                        <div class="detail-row">
                            <label>Purpose:</label>
                            <span>${request.purpose}</span>
                        </div>
                        <div class="detail-row">
                            <label>Request Date:</label>
                            <span>${request.requestDate}</span>
                        </div>
                        <div class="detail-row">
                            <label>Status:</label>
                            <span class="status-badge status-${request.status}">${request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading request details:', error);
        }
    }
};

// HPG Verification Module
const HPGVerification = {
    currentRequestId: null,
    requestData: null,

    loadRequestData: async function(requestId) {
        try {
            this.currentRequestId = requestId;
            document.getElementById('currentRequestId').textContent = requestId;

            // Placeholder: Replace with actual API call
            // Example: const response = await APIClient.get(`/api/hpg/requests/${requestId}`);
            // const data = await response.json();
            this.requestData = null;

            // Clear form fields - data will be loaded from API
            const ownerNameEl = document.getElementById('ownerName');
            const plateNumberEl = document.getElementById('plateNumber');
            const vehicleTypeEl = document.getElementById('vehicleType');
            const vehicleModelEl = document.getElementById('vehicleModel');
            const vehicleYearEl = document.getElementById('vehicleYear');
            const purposeEl = document.getElementById('purpose');
            
            if (ownerNameEl) ownerNameEl.value = '';
            if (plateNumberEl) plateNumberEl.value = '';
            if (vehicleTypeEl) vehicleTypeEl.value = '';
            if (vehicleModelEl) vehicleModelEl.value = '';
            if (vehicleYearEl) vehicleYearEl.value = '';
            if (purposeEl) purposeEl.value = '';
            
            // If API call succeeds, populate fields:
            // if (this.requestData) {
            //     if (ownerNameEl) ownerNameEl.value = this.requestData.ownerName || '';
            //     if (plateNumberEl) plateNumberEl.value = this.requestData.plateNumber || '';
            //     if (vehicleTypeEl) vehicleTypeEl.value = this.requestData.vehicleType || '';
            //     if (vehicleModelEl) vehicleModelEl.value = this.requestData.vehicleModel || '';
            //     if (vehicleYearEl) vehicleYearEl.value = this.requestData.vehicleYear || '';
            //     if (purposeEl) purposeEl.value = this.requestData.purpose || '';
            // }
        } catch (error) {
            console.error('Error loading request data:', error);
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleError(error);
            }
        }
    },

    approveVerification: async function() {
        try {
            const form = document.getElementById('verificationForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const formData = new FormData(form);
            const verificationData = {
                requestId: this.currentRequestId,
                engineNumber: formData.get('engineNumber'),
                chassisNumber: formData.get('chassisNumber'),
                macroEtching: document.getElementById('macroEtching').checked,
                remarks: formData.get('remarks'),
                inspectionPhotos: formData.getAll('inspectionPhotos'),
                stencilImage: formData.get('stencilImage')
            };

            // Placeholder: Replace with actual API call
            // Example: await APIClient.post('/api/hpg/verify/approve', verificationData);

            alert('Verification approved successfully!');
            
            // Log activity
            this.logActivity('verified', 'Vehicle verification approved');

            // Redirect to requests list
            window.location.href = 'hpg-requests-list.html';
        } catch (error) {
            console.error('Error approving verification:', error);
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleError(error);
            }
        }
    },

    rejectVerification: async function(reason) {
        try {
            if (!reason || !reason.trim()) {
                alert('Please provide a reason for rejection');
                return;
            }

            const rejectionData = {
                requestId: this.currentRequestId,
                reason: reason
            };

            // Placeholder: Replace with actual API call
            // Example: await APIClient.post('/api/hpg/verify/reject', rejectionData);

            alert('Verification rejected successfully!');
            
            // Log activity
            this.logActivity('rejected', `Verification rejected: ${reason}`);

            // Close modal and redirect
            document.getElementById('rejectModal').classList.remove('active');
            window.location.href = 'hpg-requests-list.html';
        } catch (error) {
            console.error('Error rejecting verification:', error);
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleError(error);
            }
        }
    },

    logActivity: function(action, details) {
        // Placeholder: Log activity to backend
        console.log('Activity logged:', { action, details, requestId: this.currentRequestId });
    }
};

// HPG Certificate Module
const HPGCertificate = {
    verifiedRequests: [],
    currentRequest: null,

    loadVerifiedRequests: async function() {
        try {
            // Placeholder: Replace with actual API call
            // Example: const response = await APIClient.get('/api/hpg/requests?status=verified');
            // const data = await response.json();
            this.verifiedRequests = [];

            const select = document.getElementById('requestSelect');
            if (select) {
                if (this.verifiedRequests.length === 0) {
                    select.innerHTML = '<option value="">-- No verified requests available --</option>';
                } else {
                    select.innerHTML = '<option value="">-- Select a verified request --</option>' +
                        this.verifiedRequests.map(req => 
                            `<option value="${req.id}">${req.id} - ${req.plateNumber} (${req.ownerName})</option>`
                        ).join('');
                }
            }
        } catch (error) {
            console.error('Error loading verified requests:', error);
        }
    },

    loadRequestData: async function(requestId) {
        try {
            this.currentRequest = this.verifiedRequests.find(r => r.id === requestId);
            if (!this.currentRequest) {
                // Placeholder: Load from API if not in list
                // Example: const response = await APIClient.get(`/api/hpg/requests/${requestId}`);
                // this.currentRequest = await response.json();
                this.currentRequest = null;
            }

            if (!this.currentRequest) {
                // Clear certificate fields if no data
                const certRequestIdEl = document.getElementById('certRequestId');
                const certOwnerNameEl = document.getElementById('certOwnerName');
                const certPlateNumberEl = document.getElementById('certPlateNumber');
                const certVehicleTypeEl = document.getElementById('certVehicleType');
                const certEngineNumberEl = document.getElementById('certEngineNumber');
                const certChassisNumberEl = document.getElementById('certChassisNumber');
                const certVerificationDateEl = document.getElementById('certVerificationDate');
                const certVerifiedByEl = document.getElementById('certVerifiedBy');
                const certMacroEtchingEl = document.getElementById('certMacroEtching');
                
                if (certRequestIdEl) certRequestIdEl.textContent = '-';
                if (certOwnerNameEl) certOwnerNameEl.textContent = '-';
                if (certPlateNumberEl) certPlateNumberEl.textContent = '-';
                if (certVehicleTypeEl) certVehicleTypeEl.textContent = '-';
                if (certEngineNumberEl) certEngineNumberEl.textContent = '-';
                if (certChassisNumberEl) certChassisNumberEl.textContent = '-';
                if (certVerificationDateEl) certVerificationDateEl.textContent = '-';
                if (certVerifiedByEl) certVerifiedByEl.textContent = '-';
                if (certMacroEtchingEl) certMacroEtchingEl.textContent = '-';
                return;
            }

            // Populate certificate fields
            const certRequestIdEl = document.getElementById('certRequestId');
            const certOwnerNameEl = document.getElementById('certOwnerName');
            const certPlateNumberEl = document.getElementById('certPlateNumber');
            const certVehicleTypeEl = document.getElementById('certVehicleType');
            const certEngineNumberEl = document.getElementById('certEngineNumber');
            const certChassisNumberEl = document.getElementById('certChassisNumber');
            const certVerificationDateEl = document.getElementById('certVerificationDate');
            const certVerifiedByEl = document.getElementById('certVerifiedBy');
            const certMacroEtchingEl = document.getElementById('certMacroEtching');
            
            if (certRequestIdEl) certRequestIdEl.textContent = this.currentRequest.id || '-';
            if (certOwnerNameEl) certOwnerNameEl.textContent = this.currentRequest.ownerName || '-';
            if (certPlateNumberEl) certPlateNumberEl.textContent = this.currentRequest.plateNumber || '-';
            if (certVehicleTypeEl) certVehicleTypeEl.textContent = this.currentRequest.vehicleType || '-';
            if (certEngineNumberEl) certEngineNumberEl.textContent = this.currentRequest.engineNumber || '-';
            if (certChassisNumberEl) certChassisNumberEl.textContent = this.currentRequest.chassisNumber || '-';
            if (certVerificationDateEl) certVerificationDateEl.textContent = this.currentRequest.verificationDate || '-';
            if (certVerifiedByEl) certVerifiedByEl.textContent = this.currentRequest.verifiedBy || '-';
            if (certMacroEtchingEl) certMacroEtchingEl.textContent = this.currentRequest.macroEtching || '-';

            this.generatePreview();
        } catch (error) {
            console.error('Error loading request data:', error);
        }
    },

    generatePreview: function() {
        if (!this.currentRequest) return;

        // Generate certificate number
        const certNumber = `HPG-CERT-${String(this.currentRequest.id.split('-')[2]).padStart(3, '0')}`;

        // Update preview fields
        document.getElementById('previewCertNumber').textContent = certNumber;
        document.getElementById('previewRequestId').textContent = this.currentRequest.id;
        document.getElementById('previewOwnerName').textContent = this.currentRequest.ownerName;
        document.getElementById('previewPlateNumber').textContent = this.currentRequest.plateNumber;
        document.getElementById('previewVehicleType').textContent = this.currentRequest.vehicleType || '-';
        document.getElementById('previewEngineNumber').textContent = this.currentRequest.engineNumber || '-';
        document.getElementById('previewChassisNumber').textContent = this.currentRequest.chassisNumber || '-';
        document.getElementById('previewVerificationDate').textContent = this.currentRequest.verificationDate || '-';
        document.getElementById('previewVerifiedBy').textContent = this.currentRequest.verifiedBy || '-';

        // Update confirmation modal
        document.getElementById('confirmRequestId').textContent = this.currentRequest.id;
        document.getElementById('confirmCertNumber').textContent = certNumber;
    },

    releaseCertificate: async function() {
        try {
            if (!this.currentRequest) {
                alert('Please select a request first');
                return;
            }

            const certificateData = {
                requestId: this.currentRequest.id,
                certificateNumber: `HPG-CERT-${String(this.currentRequest.id.split('-')[2]).padStart(3, '0')}`,
                // Include certificate file if uploaded
            };

            // Placeholder: Replace with actual API call
            // Example: await APIClient.post('/api/hpg/certificate/release', certificateData);

            alert('Certificate released successfully and sent to LTO Admin!');
            
            // Log activity
            this.logActivity('released', `Certificate ${certificateData.certificateNumber} released`);

            // Close modal and redirect
            document.getElementById('releaseModal').classList.remove('active');
            window.location.href = 'hpg-admin-dashboard.html';
        } catch (error) {
            console.error('Error releasing certificate:', error);
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleError(error);
            }
        }
    },

    logActivity: function(action, details) {
        // Placeholder: Log activity to backend
        console.log('Activity logged:', { action, details, requestId: this.currentRequest?.id });
    }
};

// HPG Workflow Functions
let hpgWorkflowState = {
    requestReceived: false,
    inspectionsUploaded: false,
    clearanceApproved: false,
    certificateSent: false
};

function checkHPGWorkflowState() {
    const savedState = localStorage.getItem('hpgWorkflowState');
    if (savedState) {
        hpgWorkflowState = JSON.parse(savedState);
    }
    updateHPGWorkflowUI();
}

function updateHPGWorkflowUI() {
    const requestItem = document.getElementById('ltoHPGRequestItem');
    const noRequestsMsg = document.getElementById('noHPGRequestsMsg');
    const uploadedPreview = document.getElementById('uploadedHPGPreview');
    const approveBtn = document.getElementById('approveHPGClearanceBtn');
    const sendBtn = document.getElementById('sendHPGCertificateBtn');
    
    if (hpgWorkflowState.requestReceived) {
        if (requestItem) requestItem.style.display = 'flex';
        if (noRequestsMsg) noRequestsMsg.style.display = 'none';
    } else {
        if (requestItem) requestItem.style.display = 'none';
        if (noRequestsMsg) noRequestsMsg.style.display = 'block';
    }
    
    if (hpgWorkflowState.inspectionsUploaded) {
        if (uploadedPreview) uploadedPreview.style.display = 'flex';
        if (approveBtn) approveBtn.disabled = false;
    } else {
        if (uploadedPreview) uploadedPreview.style.display = 'none';
        if (approveBtn) approveBtn.disabled = true;
    }
    
    if (hpgWorkflowState.clearanceApproved) {
        if (sendBtn) sendBtn.disabled = false;
    } else {
        if (sendBtn) sendBtn.disabled = true;
    }
}

function saveHPGWorkflowState() {
    localStorage.setItem('hpgWorkflowState', JSON.stringify(hpgWorkflowState));
    updateHPGWorkflowUI();
}

function receiveHPGRequest() {
    hpgWorkflowState.requestReceived = true;
    saveHPGWorkflowState();
    
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Clearance request received from LTO', 'success');
    } else {
        alert('Clearance request received from LTO');
    }
    
    const btn = document.getElementById('receiveHPGRequestBtn');
    if (btn) {
        btn.textContent = 'Request Received';
        btn.disabled = true;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
    }
}

function uploadHPGInspections(event) {
    event.preventDefault();
    const engineFile = document.getElementById('engineInspectionFile');
    const chassisFile = document.getElementById('chassisInspectionFile');
    const stencilFile = document.getElementById('stencilFile');
    
    if ((!engineFile.files || engineFile.files.length === 0) &&
        (!chassisFile.files || chassisFile.files.length === 0) &&
        (!stencilFile.files || stencilFile.files.length === 0)) {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Please upload at least one inspection document', 'error');
        } else {
            alert('Please upload at least one inspection document');
        }
        return;
    }
    
    hpgWorkflowState.inspectionsUploaded = true;
    hpgWorkflowState.uploadedFiles = [];
    if (engineFile.files[0]) hpgWorkflowState.uploadedFiles.push(engineFile.files[0].name);
    if (chassisFile.files[0]) hpgWorkflowState.uploadedFiles.push(chassisFile.files[0].name);
    if (stencilFile.files[0]) hpgWorkflowState.uploadedFiles.push(stencilFile.files[0].name);
    hpgWorkflowState.uploadedFileDate = new Date().toLocaleString();
    saveHPGWorkflowState();
    
    // Update preview
    const previewName = document.getElementById('previewHPGFileName');
    const previewDate = document.getElementById('previewHPGFileDate');
    if (previewName) previewName.textContent = hpgWorkflowState.uploadedFiles.join(', ');
    if (previewDate) previewDate.textContent = `Uploaded: ${hpgWorkflowState.uploadedFileDate}`;
    
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Inspection documents uploaded successfully', 'success');
    } else {
        alert('Inspection documents uploaded successfully');
    }
    document.getElementById('hpgUploadForm').reset();
}

function approveHPGClearance() {
    if (!hpgWorkflowState.inspectionsUploaded) {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Please upload inspection documents first', 'error');
        } else {
            alert('Please upload inspection documents first');
        }
        return;
    }
    
    hpgWorkflowState.clearanceApproved = true;
    saveHPGWorkflowState();
    
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('HPG MV Clearance approved successfully', 'success');
    } else {
        alert('HPG MV Clearance approved successfully');
    }
    
    const approveBtn = document.getElementById('approveHPGClearanceBtn');
    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.textContent = 'Clearance Approved';
        approveBtn.classList.remove('btn-success');
        approveBtn.classList.add('btn-secondary');
    }
}

function sendHPGCertificateToLTO() {
    if (!hpgWorkflowState.clearanceApproved) {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Please approve clearance first', 'error');
        } else {
            alert('Please approve clearance first');
        }
        return;
    }
    
    hpgWorkflowState.certificateSent = true;
    saveHPGWorkflowState();
    
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('MV Clearance Certificate sent to LTO successfully', 'success');
    } else {
        alert('MV Clearance Certificate sent to LTO successfully');
    }
    
    const statusMsg = document.getElementById('hpgStatusMsg');
    const sendBtn = document.getElementById('sendHPGCertificateBtn');
    if (statusMsg) statusMsg.textContent = 'Certificate sent to LTO on ' + new Date().toLocaleString();
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Certificate Sent';
        sendBtn.classList.remove('btn-primary');
        sendBtn.classList.add('btn-secondary');
    }
}

// Initialize workflow state on page load
document.addEventListener('DOMContentLoaded', function() {
    checkHPGWorkflowState();
});

// HPG Activity Logs Module
const HPGLogs = {
    logs: [],
    filteredLogs: [],
    currentPage: 1,
    itemsPerPage: 10,

    loadLogs: async function() {
        try {
            // Placeholder: Replace with actual API call
            // Example: const response = await APIClient.get('/api/hpg/logs');
            // const data = await response.json();
            this.logs = [];

            this.filteredLogs = [...this.logs];
            this.renderTable();
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    },

    filterLogs: function() {
        const actionFilter = document.getElementById('actionFilter')?.value || '';
        const dateFrom = document.getElementById('dateFrom')?.value || '';
        const dateTo = document.getElementById('dateTo')?.value || '';
        const searchInput = document.getElementById('searchInput')?.value.toLowerCase() || '';

        this.filteredLogs = this.logs.filter(log => {
            const matchesAction = !actionFilter || log.action === actionFilter;
            const matchesDate = (!dateFrom || log.date >= dateFrom) && (!dateTo || log.date <= dateTo);
            const matchesSearch = !searchInput ||
                log.requestId.toLowerCase().includes(searchInput) ||
                log.adminName.toLowerCase().includes(searchInput) ||
                log.details.toLowerCase().includes(searchInput);

            return matchesAction && matchesDate && matchesSearch;
        });

        this.currentPage = 1;
        this.renderTable();
    },

    renderTable: function() {
        const tbody = document.getElementById('activityLogsTableBody');
        if (!tbody) return;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageLogs = this.filteredLogs.slice(start, end);

        if (pageLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No logs found</td></tr>';
            return;
        }

        tbody.innerHTML = pageLogs.map(log => {
            const actionClass = `action-${log.action}`;
            const actionIcons = {
                verified: 'fa-check-circle',
                rejected: 'fa-times-circle',
                released: 'fa-certificate',
                received: 'fa-inbox'
            };
            const actionLabels = {
                verified: 'Verified',
                rejected: 'Rejected',
                released: 'Released Certificate',
                received: 'Received Request'
            };

            return `
                <tr>
                    <td>${log.date}</td>
                    <td>
                        <span class="action-badge ${actionClass}">
                            <i class="fas ${actionIcons[log.action]}"></i> ${actionLabels[log.action]}
                        </span>
                    </td>
                    <td><strong>${log.requestId}</strong></td>
                    <td>${log.adminName}</td>
                    <td>${log.details}</td>
                    <td><span class="status-badge status-${log.status}">${log.status.charAt(0).toUpperCase() + log.status.slice(1)}</span></td>
                </tr>
            `;
        }).join('');

        // Update pagination
        const totalPages = Math.ceil(this.filteredLogs.length / this.itemsPerPage);
        document.getElementById('currentPage').textContent = this.currentPage;
        document.getElementById('totalPages').textContent = totalPages || 1;
    },

    previousPage: function() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    },

    nextPage: function() {
        const totalPages = Math.ceil(this.filteredLogs.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    }
};

