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
            // Call API to get HPG dashboard statistics
            let stats = {
                pending: 0,
                verified: 0,
                completed: 0,
                rejected: 0
            };

            if (typeof APIClient !== 'undefined') {
                const apiClient = new APIClient();
                const response = await apiClient.get('/api/hpg/stats');
                
                if (response && response.success && response.stats) {
                    stats = response.stats;
                }
            } else if (typeof window.apiClient !== 'undefined') {
                const response = await window.apiClient.get('/api/hpg/stats');
                
                if (response && response.success && response.stats) {
                    stats = response.stats;
                }
            }

            // Update DOM elements with real stats
            const pendingEl = document.getElementById('pendingRequests');
            const verifiedEl = document.getElementById('verifiedRequests');
            const completedEl = document.getElementById('completedCertificates');
            const rejectedEl = document.getElementById('rejectedRequests');
            const badgeEl = document.getElementById('pendingRequestsBadge');
            
            if (pendingEl) pendingEl.textContent = stats.pending || 0;
            if (verifiedEl) verifiedEl.textContent = stats.verified || 0;
            if (completedEl) completedEl.textContent = stats.completed || 0;
            if (rejectedEl) rejectedEl.textContent = stats.rejected || 0;
            
            // Show/hide badge based on pending count
            if (badgeEl) {
                if (stats.pending > 0) {
                    badgeEl.textContent = stats.pending;
                    badgeEl.style.display = 'inline-block';
                } else {
                    badgeEl.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            // Fallback to showing dashes on error
            const pendingEl = document.getElementById('pendingRequests');
            const verifiedEl = document.getElementById('verifiedRequests');
            const completedEl = document.getElementById('completedCertificates');
            const rejectedEl = document.getElementById('rejectedRequests');
            
            if (pendingEl) pendingEl.textContent = '-';
            if (verifiedEl) verifiedEl.textContent = '-';
            if (completedEl) completedEl.textContent = '-';
            if (rejectedEl) rejectedEl.textContent = '-';
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
            const tbody = document.getElementById('requestsTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading requests...</td></tr>';
            }
            
            // Call API to get HPG requests
            if (typeof window.apiClient !== 'undefined') {
                const response = await window.apiClient.get('/api/hpg/requests');
                
                if (response && response.success && response.requests) {
                    this.requests = response.requests.map(req => {
                        const metadata = typeof req.metadata === 'string' ? JSON.parse(req.metadata) : (req.metadata || {});
                        return {
                            id: req.id,
                            ownerName: metadata.ownerName || (req.owner ? `${req.owner.first_name || ''} ${req.owner.last_name || ''}` : 'N/A'),
                            ownerEmail: metadata.ownerEmail || req.owner?.email || 'N/A',
                            plateNumber: metadata.vehiclePlate || req.plate_number || 'N/A',
                            vehicleType: req.vehicle?.vehicle_type || metadata.vehicleType || 'N/A',
                            vehicleMake: metadata.vehicleMake || req.vehicle?.make || 'N/A',
                            vehicleModel: metadata.vehicleModel || req.vehicle?.model || 'N/A',
                            vehicleYear: metadata.vehicleYear || req.vehicle?.year || 'N/A',
                            vin: metadata.vehicleVin || req.vin || 'N/A',
                            engineNumber: metadata.engineNumber || req.vehicle?.engine_number || 'N/A',
                            chassisNumber: metadata.chassisNumber || req.vehicle?.chassis_number || 'N/A',
                            purpose: req.purpose || 'Vehicle Clearance',
                            requestDate: req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A',
                            status: (req.status || 'PENDING').toLowerCase(),
                            vehicleId: req.vehicle_id,
                            // Document references for viewing (HPG receives only OR/CR and Owner ID)
                            documentId: metadata.ownerIdDocId || metadata.orCrDocId || null,
                            documentCid: metadata.ownerIdDocCid || metadata.orCrDocCid || null,
                            documents: metadata.documents || metadata.allDocuments || []
                        };
                    });
                    
                    // Update pending badge
                    const pendingCount = this.requests.filter(r => r.status === 'pending').length;
                    const badge = document.getElementById('pendingRequestsBadge');
                    if (badge) {
                        badge.textContent = pendingCount;
                        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
                    }
                } else {
                    this.requests = [];
                }
            } else {
                console.warn('API client not available');
                this.requests = [];
            }

            this.filteredRequests = [...this.requests];
            this.renderTable();
        } catch (error) {
            console.error('Error loading requests:', error);
            this.requests = [];
            this.filteredRequests = [];
            this.renderTable();
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleAPIError(error);
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
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #7f8c8d;"><i class="fas fa-inbox"></i> No requests found</td></tr>';
            return;
        }

        tbody.innerHTML = this.filteredRequests.map(req => {
            const status = (req.status || 'pending').toLowerCase();
            const statusClass = `status-${status}`;
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            const reqId = typeof req.id === 'string' && req.id.length > 10 ? req.id.substring(0, 10) + '...' : req.id;
            const docCount = req.documents?.length || 0;
            const isProcessed = ['approved', 'completed', 'rejected'].includes(status);

            let actionButtons = '';
            if (isProcessed) {
                if (status === 'approved' || status === 'completed') {
                    actionButtons = `
                        <span class="status-badge status-approved" style="cursor: default; display: inline-flex; align-items: center; gap: 0.25rem;">
                            <i class="fas fa-check-circle"></i> Verified
                        </span>
                    `;
                } else if (status === 'rejected') {
                    actionButtons = `
                        <span class="status-badge status-rejected" style="cursor: default; display: inline-flex; align-items: center; gap: 0.25rem;">
                            <i class="fas fa-times-circle"></i> Rejected
                        </span>
                    `;
                }
            } else {
                actionButtons = `
                    <button class="btn-success btn-sm" onclick="startVerification('${req.id}')" title="Start verification process">
                        <i class="fas fa-clipboard-check"></i> Verify
                    </button>
                `;
            }
            
            return `
                <tr>
                    <td><code style="font-size: 0.85rem;" title="${req.id}">${reqId}</code></td>
                    <td>${req.ownerName}</td>
                    <td><span class="badge badge-plate">${req.plateNumber}</span></td>
                    <td>${req.vehicleType}</td>
                    <td><span class="badge badge-purpose">${req.purpose}</span></td>
                    <td>${req.requestDate}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                            <button class="btn-secondary btn-sm" onclick="viewDetails('${req.id}')" title="View request details">
                                <i class="fas fa-eye"></i> Details
                            </button>
                            ${docCount > 0 ? `
                                <button class="btn-info btn-sm" onclick="HPGRequests.viewDocument('${req.id}')" title="View ${docCount} document(s)">
                                    <i class="fas fa-file-image"></i> ${docCount} Doc${docCount > 1 ? 's' : ''}
                                </button>
                            ` : ''}
                            ${actionButtons}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    viewDocument: function(requestId) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) {
            alert('Request not found');
            return;
        }
        
        if (request.documents && request.documents.length > 0) {
            // Document type labels (HPG only receives OR/CR and Owner ID)
            const docTypeLabels = {
                'owner_id': 'Owner ID',
                'ownerId': 'Owner ID',
                'registration_cert': 'OR/CR',
                'registrationCert': 'OR/CR',
                'registration': 'OR/CR',
                'or_cr': 'OR/CR'
            };
            
            // Prepare documents for DocumentModal
            // #region agent log
            console.log('[HPG Debug] viewDocument - raw document data:', {
                requestId,
                docCount: request.documents.length,
                documents: request.documents.map(d => ({ id: d.id, cid: d.cid, path: d.path, type: d.type, url: d.url }))
            });
            // #endregion
            const docs = request.documents.map(doc => {
                // #region agent log
                console.log('[HPG Debug] document mapping - before:', {
                    hasId: !!doc.id,
                    hasCid: !!doc.cid,
                    hasPath: !!doc.path,
                    hasUrl: !!doc.url,
                    id: doc.id,
                    cid: doc.cid,
                    url: doc.url
                });
                // #endregion
                // Fix: Don't set url property - let DocumentModal construct it properly
                // DocumentModal will prioritize doc.id over doc.cid over doc.url
                return {
                    id: doc.id,
                    filename: docTypeLabels[doc.type] || doc.type || doc.filename || 'Document',
                    type: doc.type,
                    document_type: doc.type,
                    cid: doc.cid,
                    path: doc.path
                    // Don't set url - let DocumentModal construct it from id/cid
                };
            });
            // #region agent log
            console.log('[HPG Debug] document mapping - after:', {
                docs: docs.map(d => ({ id: d.id, cid: d.cid, hasUrl: !!d.url }))
            });
            // #endregion
            
            // Use DocumentModal if available
            if (typeof DocumentModal !== 'undefined') {
                DocumentModal.viewMultiple(docs, 0);
            } else {
                // Fallback to old modal
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; justify-content: center; align-items: center;';
                modal.innerHTML = `
                    <div class="modal-content" style="background: white; padding: 2rem; border-radius: 10px; max-width: 600px; width: 90%;">
                        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3><i class="fas fa-file-alt" style="color: #3498db;"></i> HPG Verification Documents</h3>
                            <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p><strong>Vehicle:</strong> ${request.vehicleMake} ${request.vehicleModel} ${request.vehicleYear}</p>
                            <p><strong>Plate:</strong> ${request.plateNumber}</p>
                            <h4>Attached Documents:</h4>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
                                ${docs.map((doc, index) => `
                                    <button class="btn-secondary" onclick="if(typeof DocumentModal !== 'undefined') { DocumentModal.viewMultiple(${JSON.stringify(docs)}, ${index}); } else { alert('Document viewer modal is not available. Please refresh the page.'); }" style="text-align: left; display: flex; align-items: center; gap: 0.5rem;">
                                        <i class="fas fa-file-image" style="color: #3498db;"></i>
                                        <span>${doc.filename}</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
        } else if (request.documentCid) {
            if (typeof DocumentModal !== 'undefined') {
                DocumentModal.view({ cid: request.documentCid, filename: 'Document' });
            } else {
                alert('Document viewer modal is not available. Please refresh the page.');
            }
        } else {
            alert('No documents attached to this request');
        }
    },

    }


// Global viewDetails function for HPG requests
async function viewDetails(requestId) {
    try {
        const apiClient = window.apiClient || (typeof APIClient !== 'undefined' ? new APIClient() : null);
        if (!apiClient) {
            alert('API client not available');
            return;
        }
        
        const response = await apiClient.get(`/api/hpg/requests/${requestId}`);
        if (response.success && response.request) {
            showHpgRequestDetailsModal(response.request);
        } else {
            throw new Error(response.error || 'Failed to load request');
        }
    } catch (error) {
        console.error('Error viewing HPG request:', error);
        alert('Failed to load request: ' + error.message);
    }
}

function showHpgRequestDetailsModal(request) {
    const vehicle = request.vehicle || {};
    const metadata = typeof request.metadata === 'string' ? JSON.parse(request.metadata) : (request.metadata || {});
    const status = (request.status || 'PENDING').toUpperCase();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
            <div class="modal-header" style="padding: 1.5rem; border-bottom: 2px solid #e9ecef; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); border-radius: 16px 16px 0 0;">
                <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-shield-alt"></i> HPG Request Details
                </h3>
                <button onclick="this.closest('.modal').remove()" style="background: rgba(255,255,255,0.2); border: none; font-size: 1.25rem; cursor: pointer; color: white; width: 36px; height: 36px; border-radius: 50%;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div style="display: grid; gap: 1.25rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Request ID</label>
                            <div style="font-weight: 600; font-family: monospace; font-size: 0.9rem;">${request.id.substring(0, 12)}...</div>
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Status</label>
                            <div><span class="status-badge status-${status.toLowerCase()}">${status}</span></div>
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Vehicle</label>
                        <div style="font-weight: 600; font-size: 1.1rem;">${vehicle.plate_number || metadata.vehiclePlate || 'N/A'}</div>
                        <div style="color: #7f8c8d;">${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}</div>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Owner</label>
                        <div>${metadata.ownerName || (request.owner?.first_name ? request.owner.first_name + ' ' + (request.owner.last_name || '') : 'N/A')}</div>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Created</label>
                        <div>${request.created_at ? new Date(request.created_at).toLocaleString() : 'N/A'}</div>
                    </div>
                    ${metadata.autoVerificationResult || metadata.autoVerified || metadata.autoVerify ? `
                    <div style="padding: 1rem; background: ${(metadata.autoVerificationResult?.status === 'APPROVED' || metadata.autoVerified || metadata.autoVerify?.recommendation === 'APPROVE') ? '#e8f5e9' : '#fff3e0'}; border-left: 4px solid ${(metadata.autoVerificationResult?.status === 'APPROVED' || metadata.autoVerified || metadata.autoVerify?.recommendation === 'APPROVE') ? '#4caf50' : '#ff9800'}; border-radius: 4px;">
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 0.5rem;">
                            <i class="fas fa-robot"></i> Auto-Verification Status
                        </label>
                        ${metadata.autoVerificationResult ? `
                            <div style="display: grid; gap: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="status-badge status-${metadata.autoVerificationResult.status === 'APPROVED' ? 'approved' : metadata.autoVerificationResult.status === 'REJECTED' ? 'rejected' : 'pending'}" style="font-size: 0.875rem;">
                                        ${metadata.autoVerificationResult.status === 'APPROVED' ? '<i class="fas fa-check-circle"></i> Verified' : metadata.autoVerificationResult.status === 'REJECTED' ? '<i class="fas fa-times-circle"></i> Rejected' : '<i class="fas fa-clock"></i> Pending Review'}
                                    </span>
                                    ${metadata.autoVerificationResult.score !== undefined ? `
                                        <span style="font-weight: 600; color: ${metadata.autoVerificationResult.score >= 80 ? '#4caf50' : metadata.autoVerificationResult.score >= 60 ? '#ff9800' : '#f44336'};">
                                            Score: ${metadata.autoVerificationResult.score}%
                                        </span>
                                    ` : ''}
                                </div>
                                ${metadata.autoVerificationResult.reason ? `
                                    <div style="font-size: 0.875rem; color: #666;">
                                        <strong>Reason:</strong> ${metadata.autoVerificationResult.reason}
                                    </div>
                                ` : ''}
                            </div>
                        ` : metadata.autoVerify ? `
                            <div style="display: grid; gap: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="status-badge status-${metadata.autoVerify.recommendation === 'APPROVE' ? 'approved' : metadata.autoVerify.recommendation === 'REJECT' ? 'rejected' : 'pending'}" style="font-size: 0.875rem;">
                                        ${metadata.autoVerify.recommendation === 'APPROVE' ? '<i class="fas fa-check-circle"></i> Recommended: Approve' : metadata.autoVerify.recommendation === 'REJECT' ? '<i class="fas fa-times-circle"></i> Recommended: Reject' : '<i class="fas fa-clock"></i> Review Required'}
                                    </span>
                                    ${metadata.autoVerify.confidenceScore !== undefined ? `
                                        <span style="font-weight: 600; color: ${metadata.autoVerify.confidenceScore >= 80 ? '#4caf50' : metadata.autoVerify.confidenceScore >= 60 ? '#ff9800' : '#f44336'};">
                                            Confidence: ${metadata.autoVerify.confidenceScore}%
                                        </span>
                                    ` : ''}
                                </div>
                                ${metadata.autoVerify.recommendationReason ? `
                                    <div style="font-size: 0.875rem; color: #666;">
                                        <strong>Reason:</strong> ${metadata.autoVerify.recommendationReason}
                                    </div>
                                ` : ''}
                            </div>
                        ` : metadata.autoVerified ? `
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="status-badge status-approved">
                                    <i class="fas fa-check-circle"></i> Auto-Verified & Approved
                                </span>
                                ${metadata.notes ? `
                                    <span style="font-size: 0.875rem; color: #666;">${metadata.notes}</span>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 2px solid #e9ecef; display: flex; gap: 0.5rem; justify-content: flex-end;">
                ${(request.documents?.length > 0 || metadata.documents?.length > 0) ? `
                    <button onclick="HPGRequests.viewDocument('${request.id}'); this.closest('.modal').remove();" class="btn-primary">
                        <i class="fas fa-file-image"></i> View Documents
                    </button>
                ` : ''}
                <button onclick="this.closest('.modal').remove()" class="btn-secondary">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

window.viewDetails = viewDetails;

// HPG Verification Module
const HPGVerification = {
    currentRequestId: null,
    requestData: null,

    loadRequestData: async function(requestId) {
        try {
            this.currentRequestId = requestId;
            const requestIdEl = document.getElementById('currentRequestId');
            if (requestIdEl) requestIdEl.textContent = requestId.substring(0, 12) + '...';
            
            // Also set hidden form field
            const requestIdHidden = document.getElementById('requestId');
            if (requestIdHidden) requestIdHidden.value = requestId;

            // Fetch request details from API
            if (typeof window.apiClient !== 'undefined') {
                const response = await window.apiClient.get(`/api/hpg/requests/${requestId}`);
                
                if (response && response.success && response.request) {
                    const req = response.request;
                    const metadata = typeof req.metadata === 'string' ? JSON.parse(req.metadata) : (req.metadata || {});
                    
                    // HPG receives only OR/CR and Owner ID documents (filtered by backend)
                    const hpgDocuments = metadata.documents || metadata.allDocuments || [];
                    console.log(`[HPG] Received ${hpgDocuments.length} documents for verification`);
                    
                    // Use owner data from API response if available (enhanced endpoint)
                    const ownerData = req.owner || {};
                    const ownerName = ownerData.firstName && ownerData.lastName 
                        ? `${ownerData.firstName} ${ownerData.lastName}`
                        : metadata.ownerName || (req.vehicle?.owner_name) || 'N/A';
                    
                    // Get Phase 1 automation data (OCR extraction and database check)
                    const automation = req.automation || {};
                    const extractedData = automation.extractedData || {};
                    const databaseCheck = automation.databaseCheck || null;
                    const automationPhase1 = automation.phase1 || null;
                    
                    // Use OCR-extracted data if available (for transfers), otherwise use metadata/vehicle data
                    const engineNumber = extractedData.engineNumber || metadata.engineNumber || req.vehicle?.engine_number || '';
                    const chassisNumber = extractedData.chassisNumber || metadata.chassisNumber || req.vehicle?.chassis_number || '';
                    const ocrExtracted = extractedData.ocrExtracted || false;
                    const dataMatch = extractedData.dataMatch || {};
                    
                    this.requestData = {
                        id: req.id,
                        ownerName: ownerName,
                        ownerEmail: ownerData.email || metadata.ownerEmail || req.vehicle?.owner_email || 'N/A',
                        ownerPhone: ownerData.phone || metadata.ownerPhone || 'N/A',
                        ownerAddress: ownerData.address || metadata.ownerAddress || 'N/A',
                        plateNumber: metadata.vehiclePlate || req.vehicle?.plate_number || 'N/A',
                        vehicleType: req.vehicle?.vehicle_type || 'N/A',
                        vehicleMake: metadata.vehicleMake || req.vehicle?.make || 'N/A',
                        vehicleModel: metadata.vehicleModel || req.vehicle?.model || 'N/A',
                        vehicleYear: metadata.vehicleYear || req.vehicle?.year || 'N/A',
                        vin: metadata.vehicleVin || req.vehicle?.vin || 'N/A',
                        engineNumber: engineNumber,
                        chassisNumber: chassisNumber,
                        purpose: req.purpose || 'Vehicle Clearance',
                        // Only OR/CR and Owner ID documents (filtered by LTO before sending)
                        documents: hpgDocuments,
                        // Phase 1 automation data
                        automation: {
                            phase1: automationPhase1,
                            extractedData: extractedData,
                            databaseCheck: databaseCheck,
                            ocrExtracted: ocrExtracted,
                            dataMatch: dataMatch
                        }
                    };
                    
                    // Populate form fields
                    const ownerNameEl = document.getElementById('ownerName');
                    const plateNumberEl = document.getElementById('plateNumber');
                    const vehicleTypeEl = document.getElementById('vehicleType');
                    const vehicleModelEl = document.getElementById('vehicleModel');
                    const vehicleYearEl = document.getElementById('vehicleYear');
                    const purposeEl = document.getElementById('purpose');
                    const vinEl = document.getElementById('vin');
                    const engineNumberEl = document.getElementById('engineNumber');
                    const chassisNumberEl = document.getElementById('chassisNumber');
                    
                    if (ownerNameEl) ownerNameEl.value = this.requestData.ownerName;
                    if (plateNumberEl) plateNumberEl.value = this.requestData.plateNumber;
                    if (vehicleTypeEl) vehicleTypeEl.value = this.requestData.vehicleType;
                    if (vehicleModelEl) vehicleModelEl.value = `${this.requestData.vehicleMake} ${this.requestData.vehicleModel}`;
                    if (vehicleYearEl) vehicleYearEl.value = this.requestData.vehicleYear;
                    if (purposeEl) purposeEl.value = this.requestData.purpose;
                    if (vinEl) vinEl.value = this.requestData.vin;
                    
                    // Auto-fill engine and chassis numbers (prioritize OCR-extracted data)
                    if (engineNumberEl) {
                        engineNumberEl.value = engineNumber;
                        // Add visual indicator if OCR-extracted
                        if (ocrExtracted) {
                            engineNumberEl.style.backgroundColor = '#e8f5e9';
                            engineNumberEl.title = 'Auto-filled from OCR extraction';
                        }
                    }
                    if (chassisNumberEl) {
                        chassisNumberEl.value = chassisNumber;
                        // Add visual indicator if OCR-extracted
                        if (ocrExtracted) {
                            chassisNumberEl.style.backgroundColor = '#e8f5e9';
                            chassisNumberEl.title = 'Auto-filled from OCR extraction';
                        }
                    }
                    
                    // Display database check results if available
                    if (databaseCheck) {
                        this.displayDatabaseCheckResult(databaseCheck);
                        
                        // Show auto-verify card if database check was already done
                        const autoVerifyCard = document.getElementById('autoVerifyCard');
                        if (autoVerifyCard) {
                            autoVerifyCard.style.display = 'block';
                            autoVerifyCard.dataset.shown = 'true';
                        }
                    }
                    
                    // Display data match results if OCR was used
                    if (ocrExtracted && Object.keys(dataMatch).length > 0) {
                        this.displayDataMatchResults(dataMatch);
                    }
                    
                    // Load OR/CR document (if loadORCRDocument function exists)
                    if (typeof loadORCRDocument === 'function' && this.requestData.documents.length > 0) {
                        loadORCRDocument(this.requestData.documents);
                    }
                    
                    // Show success notification
                    this.showAutoFillNotification();
                } else {
                    this.requestData = null;
                    console.error('Failed to load request data');
                }
            }
        } catch (error) {
            console.error('Error loading request data:', error);
            this.requestData = null;
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleAPIError(error);
            }
        }
    },
    
    displayDatabaseCheckResult: function(databaseCheck) {
        // Remove existing database check display if any
        const existing = document.getElementById('hpgDatabaseCheckResult');
        if (existing) existing.remove();
        
        // Find Step 3 card (Database Check section)
        const step3Card = document.getElementById('step3Card');
        if (!step3Card) return;
        
        const databaseResultDiv = document.getElementById('databaseResult');
        if (!databaseResultDiv) return;
        
        // Create result display
        const resultHeader = document.getElementById('resultHeader');
        const resultDetails = document.getElementById('resultDetails');
        
        if (!resultHeader || !resultDetails) return;
        
        // Determine status and styling
        let statusIcon, statusText, statusClass, statusColor;
        if (databaseCheck.status === 'FLAGGED') {
            statusIcon = 'fas fa-exclamation-triangle';
            statusText = '⚠️ FLAGGED';
            statusClass = 'result-flagged';
            statusColor = '#ef4444';
        } else if (databaseCheck.status === 'CLEAN') {
            statusIcon = 'fas fa-check-circle';
            statusText = '✓ CLEAN';
            statusClass = 'result-clean';
            statusColor = '#10b981';
        } else {
            statusIcon = 'fas fa-question-circle';
            statusText = '? UNKNOWN';
            statusClass = 'result-unknown';
            statusColor = '#6b7280';
        }
        
        resultHeader.innerHTML = `
            <i class="${statusIcon}" style="color: ${statusColor}; font-size: 2rem;"></i>
            <h4 style="color: ${statusColor}; margin: 0.5rem 0;">${statusText}</h4>
        `;
        
        resultDetails.innerHTML = `
            <p><strong>Status:</strong> ${databaseCheck.status}</p>
            <p><strong>Details:</strong> ${databaseCheck.details || 'N/A'}</p>
            ${databaseCheck.matchedRecords && databaseCheck.matchedRecords.length > 0 ? `
                <div style="margin-top: 1rem;">
                    <strong>Matched Records:</strong>
                    <ul style="margin-top: 0.5rem;">
                        ${databaseCheck.matchedRecords.map(record => `
                            <li>
                                <strong>Reason:</strong> ${record.reason || 'N/A'}<br>
                                <strong>Reported:</strong> ${record.reportedDate || 'N/A'} by ${record.reportedBy || 'N/A'}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
            <p style="margin-top: 1rem; font-size: 0.9em; color: #6b7280;">
                <i class="fas fa-info-circle"></i> Checked at: ${new Date(databaseCheck.checkedAt).toLocaleString()}
            </p>
        `;
        
        databaseResultDiv.style.display = 'block';
        databaseResultDiv.className = `database-result ${statusClass}`;
        
        // Auto-click the database check button if it exists (to show the result)
        const checkBtn = document.getElementById('checkDatabaseBtn');
        if (checkBtn && databaseCheck.status === 'FLAGGED') {
            // Highlight the button for flagged vehicles
            checkBtn.style.backgroundColor = '#ef4444';
            checkBtn.style.color = 'white';
        }
    },
    
    displayDataMatchResults: function(dataMatch) {
        // Display data matching results (OCR vs vehicle record)
        const step2Card = document.getElementById('step2Card');
        if (!step2Card) return;
        
        // Create match indicator
        let matchIndicator = document.getElementById('dataMatchIndicator');
        if (!matchIndicator) {
            matchIndicator = document.createElement('div');
            matchIndicator.id = 'dataMatchIndicator';
            matchIndicator.style.cssText = 'margin-top: 1rem; padding: 1rem; border-radius: 4px; background-color: #f3f4f6;';
            step2Card.querySelector('.card-body').appendChild(matchIndicator);
        }
        
        const allMatch = dataMatch.engineNumber === true && dataMatch.chassisNumber === true;
        const anyMismatch = dataMatch.engineNumber === false || dataMatch.chassisNumber === false;
        
        let matchStatus, matchColor, matchIcon;
        if (allMatch) {
            matchStatus = 'All data matches';
            matchColor = '#10b981';
            matchIcon = 'fas fa-check-circle';
        } else if (anyMismatch) {
            matchStatus = '⚠️ Data mismatch detected';
            matchColor = '#f59e0b';
            matchIcon = 'fas fa-exclamation-triangle';
        } else {
            matchStatus = 'Data match status unknown';
            matchColor = '#6b7280';
            matchIcon = 'fas fa-question-circle';
        }
        
        matchIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <i class="${matchIcon}" style="color: ${matchColor};"></i>
                <strong style="color: ${matchColor};">${matchStatus}</strong>
            </div>
            <div style="font-size: 0.9em;">
                <p><strong>Engine Number:</strong> ${dataMatch.engineNumber === true ? '✓ Match' : dataMatch.engineNumber === false ? '✗ Mismatch' : '? Not checked'}</p>
                <p><strong>Chassis Number:</strong> ${dataMatch.chassisNumber === true ? '✓ Match' : dataMatch.chassisNumber === false ? '✗ Mismatch' : '? Not checked'}</p>
            </div>
            <p style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">
                <i class="fas fa-info-circle"></i> Data extracted from OR/CR document via OCR
            </p>
        `;
    },
    
    showAutoFillNotification: function() {
        // Remove existing notification if any
        const existing = document.getElementById('hpgAutoFillNotification');
        if (existing) existing.remove();
        
        const hasData = this.requestData?.plateNumber || this.requestData?.engineNumber;
        const hasDocuments = this.requestData?.documents && this.requestData.documents.length > 0;
        
        if (!hasData && !hasDocuments) return;
        
        const notification = document.createElement('div');
        notification.id = 'hpgAutoFillNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
        `;
        
        let message = '<strong>🚔 HPG Clearance Verification</strong><br>';
        message += `Vehicle: ${this.requestData.plateNumber || 'N/A'}<br>`;
        if (hasDocuments) {
            message += `<span style="color: #27ae60;">✓ ${this.requestData.documents.length} document(s) loaded (OR/CR & Owner ID)</span>`;
        }
        
        notification.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="flex: 1;">${message}</div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer;">×</button>
            </div>
        `;
        
        // Add animation
        if (!document.getElementById('hpgAutoFillStyles')) {
            const style = document.createElement('style');
            style.id = 'hpgAutoFillStyles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    },

    approveVerification: async function() {
        try {
            // Validate required fields exist
            if (!this.currentRequestId) {
                alert('No request selected. Please select a request first.');
                return;
            }

            // Get values directly from input elements (not from FormData)
            // Use optional chaining to safely access elements that may not exist
            const engineNumberEl = document.getElementById('engineNumber');
            const chassisNumberEl = document.getElementById('chassisNumber');
            const remarksEl = document.getElementById('remarks');
            const macroEtchingEl = document.getElementById('macroEtching'); // May not exist
            
            // Build verification data with safe property access
            const verificationData = {
                requestId: this.currentRequestId,
                engineNumber: engineNumberEl?.value || '',
                chassisNumber: chassisNumberEl?.value || '',
                macroEtching: macroEtchingEl?.checked || false, // Safe access with optional chaining
                remarks: remarksEl?.value || '',
                // Note: inspectionPhotos and stencilImage are not in the current form
                // If needed, add file input fields to the HTML form
                photos: [], // Placeholder - add file upload if needed
                stencil: null // Placeholder - add file upload if needed
            };

            // Validate required fields
            if (!verificationData.engineNumber || !verificationData.chassisNumber) {
                alert('Engine number and chassis number are required.');
                return;
            }

            // Make actual API call
            try {
                const apiClient = typeof APIClient !== 'undefined' ? new APIClient() : window.apiClient;
                if (!apiClient) {
                    throw new Error('API client not available');
                }

                const response = await apiClient.post('/api/hpg/verify/approve', verificationData);
                
                if (response && response.success) {
                    // Show success notification
                    if (typeof ToastNotification !== 'undefined') {
                        ToastNotification.show('HPG verification approved successfully!', 'success');
                    } else {
                        alert('Verification approved successfully!');
                    }
                    
                    // Log activity
                    this.logActivity('verified', 'Vehicle verification approved');
                    
                    // Redirect to requests list
                    setTimeout(() => {
                        window.location.href = 'hpg-requests-list.html';
                    }, 1000);
                } else {
                    throw new Error(response?.error || 'Failed to approve verification');
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                throw new Error(apiError.message || 'Failed to submit approval. Please try again.');
            }

        } catch (error) {
            console.error('Error approving verification:', error);
            if (typeof ErrorHandler !== 'undefined') {
                ErrorHandler.handleAPIError(error);
            } else {
                alert('Error: ' + (error.message || 'Failed to approve verification'));
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
                ErrorHandler.handleAPIError(error);
            }
        }
    },

    logActivity: function(action, details) {
        // Placeholder: Log activity to backend
        console.log('Activity logged:', { action, details, requestId: this.currentRequestId });
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


// Status tab filter (All/Pending/Approved/Rejected)
HPGRequests.filterByStatus = function(status, btn) {
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (status === 'all') {
        this.filteredRequests = [...this.requests];
    } else {
        this.filteredRequests = this.requests.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    }
    this.renderTable();
};

// Make globally accessible
window.filterHPGByStatus = function(status, btn) {
    if (typeof HPGRequests !== 'undefined') {
        HPGRequests.filterByStatus(status, btn);
    }
};

