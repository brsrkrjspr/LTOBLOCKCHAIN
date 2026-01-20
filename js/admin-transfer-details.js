// Admin Transfer Details - JavaScript
// Handles viewing detailed transfer request information

document.addEventListener('DOMContentLoaded', function() {
    initializeTransferDetails();
});

let currentTransferRequest = null;
let currentRequestId = null;

function isFinalizedStatus(status) {
    return status === 'APPROVED' || status === 'REJECTED' || status === 'COMPLETED';
}

function initializeTransferDetails() {
    // Get request ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentRequestId = urlParams.get('id');

    if (!currentRequestId) {
        showError('Transfer request ID is required');
        setTimeout(() => {
            window.location.href = 'admin-transfer-requests.html';
        }, 2000);
        return;
    }

    // Initialize user information
    if (typeof AuthUtils !== 'undefined') {
        const user = AuthUtils.getCurrentUser();
        if (user) {
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            const userAvatarEl = document.getElementById('userAvatar');
            const sidebarUserNameEl = document.getElementById('sidebarUserName');
            const sidebarUserRoleEl = document.getElementById('sidebarUserRole');
            const sidebarUserAvatarEl = document.getElementById('sidebarUserAvatar');
            
            const displayName = AuthUtils.getUserDisplayName() || 'ADMIN';
            const initials = AuthUtils.getUserInitials() || 'AD';
            
            if (userNameEl) userNameEl.textContent = displayName;
            if (userRoleEl) userRoleEl.textContent = 'System Administrator';
            if (userAvatarEl) userAvatarEl.textContent = initials;
            
            // Update sidebar user info
            if (sidebarUserNameEl) sidebarUserNameEl.textContent = displayName;
            if (sidebarUserRoleEl) sidebarUserRoleEl.textContent = 'System Administrator';
            if (sidebarUserAvatarEl) sidebarUserAvatarEl.textContent = initials;
        } else {
            window.location.href = 'login-signup.html';
        }
    }

    // Sidebar toggle
    const sidebar = document.querySelector('.dashboard-sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('adminSidebarCollapsed', sidebar.classList.contains('collapsed') ? 'true' : 'false');
        });
    }

    // Load sidebar state
    const savedSidebarState = localStorage.getItem('adminSidebarCollapsed');
    if (sidebar && savedSidebarState === 'true') {
        sidebar.classList.add('collapsed');
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

    // Load transfer request details
    loadTransferRequestDetails();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Stop auto-refresh when page unloads
    window.addEventListener('beforeunload', stopAutoRefresh);
}

async function loadTransferRequestDetails() {
    try {
        showLoading();

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get transfer request by ID (mounted under /api/vehicles/transfer)
        const response = await apiClient.get(`/api/vehicles/transfer/requests/${currentRequestId}`);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load transfer request');
        }

        currentTransferRequest = response.transferRequest;
        
        // Display transfer request details
        renderTransferRequestDetails(currentTransferRequest);

        hideLoading();

    } catch (error) {
        console.error('Load transfer request details error:', error);
        showError(error.message || 'Failed to load transfer request details');
        hideLoading();
    }
}

// Auto-refresh transfer request details every 30 seconds
// This ensures organization approval statuses are updated when approvals happen from other dashboards
let autoRefreshInterval = null;

function startAutoRefresh() {
    // Clear existing interval if any
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Refresh every 30 seconds
    autoRefreshInterval = setInterval(() => {
        if (currentRequestId && document.visibilityState === 'visible') {
            loadTransferRequestDetails();
        }
    }, 30000); // 30 seconds
    
    // Also refresh when window gains focus
    window.addEventListener('focus', () => {
        if (currentRequestId) {
            loadTransferRequestDetails();
        }
    });
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

function renderTransferRequestDetails(request) {
    // Update request header
    const requestIdEl = document.getElementById('requestId');
    const requestStatusEl = document.getElementById('requestStatus');
    const requestDateEl = document.getElementById('requestDate');
    
    if (requestIdEl) requestIdEl.textContent = request.id.substring(0, 8) + '...';
    if (requestStatusEl) {
        requestStatusEl.textContent = request.status || 'PENDING';
        requestStatusEl.className = `status-badge ${getStatusClass(request.status)}`;
    }

    // Update page header status badge (top-right chip)
    const headerStatusEl = document.getElementById('pageStatusBadge');
    if (headerStatusEl) {
        const status = request.status || 'PENDING';
        headerStatusEl.textContent = status;
        headerStatusEl.className = `status-badge status-badge-large ${getStatusClass(status)}`;
    }
    if (requestDateEl) {
        requestDateEl.textContent = new Date(request.submitted_at || request.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Update seller information
    renderSellerInfo(request);

    // Update buyer information
    renderBuyerInfo(request);

    // Update vehicle information
    renderVehicleInfo(request);

    // Update documents
    renderDocuments(request.documents || []);

    // Update organization approval status display
    renderOrgApprovalStatus(request);
    
    // Update action buttons
    updateActionButtons(request);
}

function renderOrgApprovalStatus(request) {
    // Debug: Log approval statuses
    console.log('Organization Approval Statuses:', {
        hpg: request.hpg_approval_status,
        insurance: request.insurance_approval_status,
        emission: request.emission_approval_status,
        hpg_clearance_request_id: request.hpg_clearance_request_id,
        insurance_clearance_request_id: request.insurance_clearance_request_id,
        emission_clearance_request_id: request.emission_clearance_request_id
    });
    
    const orgSection = document.getElementById('orgApprovalSection');
    const orgMessage = document.getElementById('orgApprovalMessage');
    
    if (!orgSection) return;
    
    // Show section if any org approval is tracked
    const hasOrgTracking = request.hpg_approval_status || request.insurance_approval_status || request.emission_approval_status;
    
    if (hasOrgTracking) {
        orgSection.style.display = 'block';
        orgMessage.style.display = 'block';
    } else {
        orgSection.style.display = 'none';
        orgMessage.style.display = 'none';
    }
    
    // HPG Approval Status
    const hpgStatus = request.hpg_approval_status || 'PENDING';
    const hpgStatusEl = document.getElementById('hpgApprovalStatus');
    const hpgDateEl = document.getElementById('hpgApprovalDate');
    
    if (hpgStatusEl) {
        const statusClass = hpgStatus === 'APPROVED' ? 'status-approved' : 
                           hpgStatus === 'REJECTED' ? 'status-rejected' : 'status-pending';
        hpgStatusEl.innerHTML = `<span class="status-badge ${statusClass}">${hpgStatus}</span>`;
    }
    
    if (hpgDateEl && request.hpg_approved_at) {
        hpgDateEl.textContent = `Approved: ${new Date(request.hpg_approved_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    } else if (hpgDateEl) {
        hpgDateEl.textContent = '';
    }
    
    // Insurance Approval Status
    const insuranceStatus = request.insurance_approval_status || 'PENDING';
    const insuranceStatusEl = document.getElementById('insuranceApprovalStatus');
    const insuranceDateEl = document.getElementById('insuranceApprovalDate');
    
    if (insuranceStatusEl) {
        const statusClass = insuranceStatus === 'APPROVED' ? 'status-approved' : 
                           insuranceStatus === 'REJECTED' ? 'status-rejected' : 'status-pending';
        insuranceStatusEl.innerHTML = `<span class="status-badge ${statusClass}">${insuranceStatus}</span>`;
    }
    
    if (insuranceDateEl && request.insurance_approved_at) {
        insuranceDateEl.textContent = `Approved: ${new Date(request.insurance_approved_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    } else if (insuranceDateEl) {
        insuranceDateEl.textContent = '';
    }
    
    // Emission Approval Status
    const emissionStatus = request.emission_approval_status || 'PENDING';
    const emissionStatusEl = document.getElementById('emissionApprovalStatus');
    const emissionDateEl = document.getElementById('emissionApprovalDate');
    
    if (emissionStatusEl) {
        const statusClass = emissionStatus === 'APPROVED' ? 'status-approved' : 
                           emissionStatus === 'REJECTED' ? 'status-rejected' : 'status-pending';
        emissionStatusEl.innerHTML = `<span class="status-badge ${statusClass}">${emissionStatus}</span>`;
    }
    
    if (emissionDateEl && request.emission_approved_at) {
        emissionDateEl.textContent = `Approved: ${new Date(request.emission_approved_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    } else if (emissionDateEl) {
        emissionDateEl.textContent = '';
    }
}

function renderSellerInfo(request) {
    // Extract seller info from database join (real data, not placeholders)
    // Seller is always a user account, so we use seller object from API
    const seller = request.seller || {};
    
    // Log error if seller object is missing or empty
    if (!request.seller || Object.keys(seller).length === 0) {
        console.error('❌ [Seller Info] Seller object is missing or empty:', {
            requestId: request.id,
            hasSeller: !!request.seller,
            sellerKeys: request.seller ? Object.keys(request.seller) : [],
            fullRequest: request
        });
    }
    
    // Construct seller name from database fields (real data)
    let sellerName = 'Unknown Seller';
    let nameSource = 'none';
    
    if (seller.first_name && seller.last_name) {
        sellerName = `${seller.first_name} ${seller.last_name}`;
        nameSource = 'first_name + last_name';
    } else if (seller.first_name) {
        sellerName = seller.first_name;
        nameSource = 'first_name only';
    } else if (seller.email) {
        sellerName = seller.email; // Use email as fallback (real data)
        nameSource = 'email (fallback)';
    } else {
        // Log error if no name can be extracted
        console.error('❌ [Seller Info] Cannot extract seller name - all fields missing:', {
            requestId: request.id,
            seller: seller,
            availableFields: Object.keys(seller),
            sellerId: seller.id,
            sellerEmail: seller.email
        });
    }
    
    const sellerContact = seller.phone || 'N/A';
    const sellerEmail = seller.email || 'N/A';
    const sellerAddress = seller.address || 'N/A';
    
    // Log warning if critical fields are missing
    if (!seller.email) {
        console.warn('⚠️ [Seller Info] Seller email is missing:', {
            requestId: request.id,
            sellerId: seller.id,
            sellerName: sellerName,
            availableFields: Object.keys(seller)
        });
    }
    
    // Log info about data extraction
    console.log('ℹ️ [Seller Info] Extracted seller data:', {
        requestId: request.id,
        sellerId: seller.id,
        name: sellerName,
        nameSource: nameSource,
        email: sellerEmail,
        phone: sellerContact,
        hasAddress: !!seller.address
    });

    // Update DOM elements
    const sellerNameEl = document.querySelector('[data-field="seller-name"]');
    const sellerContactEl = document.querySelector('[data-field="seller-contact"]');
    const sellerEmailEl = document.querySelector('[data-field="seller-email"]');
    const sellerAddressEl = document.querySelector('[data-field="seller-address"]');
    const sellerIdEl = document.querySelector('[data-field="seller-id"]');

    if (sellerNameEl) sellerNameEl.textContent = sellerName;
    if (sellerContactEl) sellerContactEl.textContent = sellerContact;
    if (sellerEmailEl) sellerEmailEl.textContent = sellerEmail;
    if (sellerAddressEl) sellerAddressEl.textContent = sellerAddress;

    // Find seller ID document
    const sellerIdDoc = (request.documents || []).find(doc => 
        doc.document_type === 'SELLER_ID' || doc.type === 'seller_id'
    );
    if (sellerIdEl && sellerIdDoc) {
        sellerIdEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${sellerIdDoc.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${sellerIdDoc.id}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    } else if (sellerIdEl) {
        sellerIdEl.innerHTML = '<span style="color: #7f8c8d;">No document uploaded</span>';
    }
}

function renderBuyerInfo(request) {
    // Extract buyer info - prioritize database join (real user data), then buyer_info JSONB
    // NEVER use placeholders - always use real data from records
    let buyerName = null;
    let buyerContact = null;
    let buyerEmail = null;
    let buyerAddress = null;
    let dataSource = 'none';
    
    // First, try buyer object (if buyer has account)
    if (request.buyer && request.buyer.id) {
        dataSource = 'buyer object (database join)';
        // Buyer has account - use database fields
        if (request.buyer.first_name && request.buyer.last_name) {
            buyerName = `${request.buyer.first_name} ${request.buyer.last_name}`;
        } else if (request.buyer.first_name) {
            buyerName = request.buyer.first_name;
        }
        buyerContact = request.buyer.phone || null;
        buyerEmail = request.buyer.email || null;
        buyerAddress = request.buyer.address || null;
        
        // Log warning if buyer account exists but name is missing
        if (!buyerName && !request.buyer.email) {
            console.warn('⚠️ [Buyer Info] Buyer account exists but name and email are missing:', {
                requestId: request.id,
                buyerId: request.buyer.id,
                availableFields: Object.keys(request.buyer)
            });
        }
    }
    
    // If no buyer account, try buyer_info JSONB
    if (!buyerName && request.buyer_info) {
        try {
            const buyerInfo = typeof request.buyer_info === 'string' ? JSON.parse(request.buyer_info) : request.buyer_info;
            dataSource = 'buyer_info JSONB';
            
            if (buyerInfo.firstName && buyerInfo.lastName) {
                buyerName = `${buyerInfo.firstName} ${buyerInfo.lastName}`;
            } else if (buyerInfo.firstName) {
                buyerName = buyerInfo.firstName;
            }
            
            buyerContact = buyerInfo.phone || null;
            buyerEmail = buyerInfo.email || null;
            buyerAddress = buyerInfo.address || null;
            
            // Log warning if buyer_info exists but email is missing
            if (!buyerEmail) {
                console.warn('⚠️ [Buyer Info] buyer_info JSONB exists but email is missing:', {
                    requestId: request.id,
                    buyerInfo: buyerInfo,
                    availableFields: Object.keys(buyerInfo)
                });
            }
        } catch (parseError) {
            console.error('❌ [Buyer Info] Failed to parse buyer_info JSONB:', {
                requestId: request.id,
                buyer_info: request.buyer_info,
                error: parseError.message,
                stack: parseError.stack
            });
        }
    }
    
    // Final fallback: use email (real data, not placeholder)
    if (!buyerName && buyerEmail) {
        buyerName = buyerEmail;
        dataSource = dataSource === 'none' ? 'email (fallback)' : dataSource + ' + email fallback';
    } else if (!buyerName) {
        buyerName = 'Unknown Buyer';
        // Log error if no buyer data can be extracted at all
        console.error('❌ [Buyer Info] Cannot extract buyer information - all sources failed:', {
            requestId: request.id,
            hasBuyerObject: !!(request.buyer && request.buyer.id),
            hasBuyerInfo: !!request.buyer_info,
            buyerObject: request.buyer,
            buyerInfo: request.buyer_info,
            availableFields: Object.keys(request).filter(k => k.includes('buyer'))
        });
    }
    
    // Set defaults for missing fields
    buyerContact = buyerContact || 'N/A';
    buyerEmail = buyerEmail || 'N/A';
    buyerAddress = buyerAddress || 'N/A';
    
    // Log error if critical email is missing
    if (buyerEmail === 'N/A') {
        console.error('❌ [Buyer Info] Buyer email is missing - this is required:', {
            requestId: request.id,
            buyerName: buyerName,
            dataSource: dataSource,
            hasBuyerObject: !!(request.buyer && request.buyer.id),
            hasBuyerInfo: !!request.buyer_info
        });
    }
    
    // Log info about data extraction
    console.log('ℹ️ [Buyer Info] Extracted buyer data:', {
        requestId: request.id,
        name: buyerName,
        email: buyerEmail,
        phone: buyerContact,
        dataSource: dataSource,
        hasAddress: buyerAddress !== 'N/A'
    });

    // Update DOM elements
    const buyerNameEl = document.querySelector('[data-field="buyer-name"]');
    const buyerContactEl = document.querySelector('[data-field="buyer-contact"]');
    const buyerEmailEl = document.querySelector('[data-field="buyer-email"]');
    const buyerAddressEl = document.querySelector('[data-field="buyer-address"]');
    const buyerIdEl = document.querySelector('[data-field="buyer-id"]');

    if (buyerNameEl) buyerNameEl.textContent = buyerName;
    if (buyerContactEl) buyerContactEl.textContent = buyerContact;
    if (buyerEmailEl) buyerEmailEl.textContent = buyerEmail;
    if (buyerAddressEl) buyerAddressEl.textContent = buyerAddress;

    // Find buyer ID document
    const buyerIdDoc = (request.documents || []).find(doc => 
        doc.document_type === 'BUYER_ID' || doc.type === 'buyer_id'
    );
    if (buyerIdEl && buyerIdDoc) {
        buyerIdEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${buyerIdDoc.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${buyerIdDoc.id}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    } else if (buyerIdEl) {
        buyerIdEl.innerHTML = '<span style="color: #7f8c8d;">No document uploaded</span>';
    }
}

function renderVehicleInfo(request) {
    const vehicle = request.vehicle || {};
    const plateNumberEl = document.querySelector('[data-field="plate-number"]');
    const engineNumberEl = document.querySelector('[data-field="engine-number"]');
    const chassisNumberEl = document.querySelector('[data-field="chassis-number"]');
    const vehicleTypeEl = document.querySelector('[data-field="vehicle-type"]');
    const makeModelEl = document.querySelector('[data-field="make-model"]');
    const yearModelEl = document.querySelector('[data-field="year-model"]');
    const orNumberEl = document.querySelector('[data-field="or-number"]');
    const crNumberEl = document.querySelector('[data-field="cr-number"]');
    const orCrNumberEl = document.querySelector('[data-field="or-cr-number"]'); // Backward compatibility
    const orDocEl = document.querySelector('[data-field="or-doc"]');
    const crDocEl = document.querySelector('[data-field="cr-doc"]');

    if (plateNumberEl) plateNumberEl.textContent = vehicle.plate_number || vehicle.plateNumber || 'N/A';
    if (engineNumberEl) engineNumberEl.textContent = vehicle.engine_number || vehicle.engineNumber || 'N/A';
    if (chassisNumberEl) chassisNumberEl.textContent = vehicle.chassis_number || vehicle.chassisNumber || 'N/A';
    if (vehicleTypeEl) vehicleTypeEl.textContent = vehicle.vehicle_type || vehicle.vehicleType || 'N/A';
    if (makeModelEl) makeModelEl.textContent = `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'N/A';
    if (yearModelEl) yearModelEl.textContent = vehicle.year || 'N/A';
    
    // Display OR/CR Number if available
    // Display separate OR and CR numbers (new format)
    const orNumber = vehicle.or_number || vehicle.orNumber;
    const crNumber = vehicle.cr_number || vehicle.crNumber;
    // Backward compatibility
    const orCrNumber = vehicle.or_cr_number || vehicle.orCrNumber;
    
    if (orNumberEl) {
        if (orNumber) {
            orNumberEl.innerHTML = `<strong style="color: #667eea; font-size: 1.1em;">OR: ${orNumber}</strong>`;
        } else if (orCrNumber) {
            orNumberEl.innerHTML = `<strong style="color: #667eea; font-size: 1.1em;">OR: ${orCrNumber.replace('ORCR-', 'OR-')}</strong>`;
        } else {
            orNumberEl.textContent = 'Not yet assigned';
        }
    }
    
    if (crNumberEl) {
        if (crNumber) {
            crNumberEl.innerHTML = `<strong style="color: #27ae60; font-size: 1.1em;">CR: ${crNumber}</strong>`;
        } else if (orCrNumber) {
            crNumberEl.innerHTML = `<strong style="color: #27ae60; font-size: 1.1em;">CR: ${orCrNumber.replace('ORCR-', 'CR-')}</strong>`;
        } else {
            crNumberEl.textContent = 'Not yet assigned';
        }
    }
    
    // Backward compatibility - update old field if it exists
    if (orCrNumberEl) {
        if (orNumber && crNumber) {
            orCrNumberEl.innerHTML = `<strong style="color: #27ae60; font-size: 1.1em;">OR: ${orNumber} | CR: ${crNumber}</strong>`;
        } else if (orCrNumber) {
            orCrNumberEl.innerHTML = `<strong style="color: #27ae60; font-size: 1.1em;">${orCrNumber}</strong>`;
        } else {
            orCrNumberEl.textContent = 'Not yet assigned';
        }
    }

    // Find OR/CR documents (real document_id, not transfer_documents.id)
    const orDoc = (request.documents || []).find(doc => 
        doc.document_type === 'OR' || doc.type === 'or' || doc.document_type === 'OR_CR' || doc.type === 'orCr' || doc.document_type === 'or_cr'
    );
    const crDoc = (request.documents || []).find(doc => 
        doc.document_type === 'CR' || doc.type === 'cr' || doc.document_type === 'OR_CR' || doc.type === 'orCr' || doc.document_type === 'or_cr'
    );

    const orDocId = orDoc ? (orDoc.document_id || orDoc.id) : null;
    const crDocId = crDoc ? (crDoc.document_id || crDoc.id) : null;

    if (orDocEl && orDocId) {
        orDocEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${orDocId}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${orDocId}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    } else if (orDocEl) {
        orDocEl.innerHTML = '<span style="color: #7f8c8d;">No document uploaded</span>';
    }

    if (crDocEl && crDocId) {
        crDocEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${crDocId}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${crDocId}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    } else if (crDocEl) {
        crDocEl.innerHTML = '<span style="color: #7f8c8d;">No document uploaded</span>';
    }
}

function renderDocuments(documents) {
    const documentsContainer = document.querySelector('.documents-grid');
    if (!documentsContainer) {
        console.error('[renderDocuments] Container .documents-grid not found');
        return;
    }
    
    console.log('[renderDocuments] Rendering documents:', documents);

    if (!documents || documents.length === 0) {
        documentsContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                <i class="fas fa-file-alt" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                <p>No documents uploaded for this transfer request</p>
            </div>
        `;
        return;
    }

    documentsContainer.innerHTML = documents.map(doc => {
        const docId = doc.document_id || doc.id;
        const docType = doc.document_type || doc.type || 'Document';
        const docName = doc.original_name || doc.filename || doc.name || docType;
        const docTypeLabel = getDocumentTypeLabel(docType);
        
        console.log('[renderDocuments] Document:', { id: docId, type: docType, name: docName });

        return `
            <div class="document-card">
                <div class="document-icon">
                    <i class="fas fa-file-contract"></i>
                </div>
                <div class="document-info">
                    <h4>${escapeHtml(docName)}</h4>
                    <p class="document-type">${escapeHtml(docTypeLabel)}</p>
                </div>
                <div class="document-actions">
                    <button class="btn-secondary btn-sm" onclick="viewDocument('${docId}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-secondary btn-sm" onclick="downloadDocument('${docId}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getDocumentTypeLabel(type) {
    const labels = {
        'DEED_OF_SALE': 'Legal Document',
        'SELLER_ID': 'Identification',
        'BUYER_ID': 'Identification',
        'OR': 'Vehicle Registration',
        'CR': 'Vehicle Registration',
        'OR_CR': 'Vehicle Registration',
        'EMISSION': 'Test Certificate'
    };
    return labels[type] || 'Document';
}

function updateActionButtons(request) {
    const status = request.status || 'PENDING';
    const actionButtons = document.querySelector('.action-buttons') || document.getElementById('actionButtons');
    
    // Update side card header: Admin Actions vs Document Verification
    const actionCardTitle = document.querySelector('.action-panel .dashboard-card h3');
    if (actionCardTitle) {
        if (!isFinalizedStatus(status)) {
            actionCardTitle.innerHTML = '<span class="card-icon">⚙️</span> Admin Actions';
        } else {
            // Finalized request – we will hide the card entirely
            actionCardTitle.textContent = '';
        }
    }
    
    if (!actionButtons) return;

    // Check organization approval statuses
    const hpgStatus = request.hpg_approval_status || 'NOT_FORWARDED';
    const insuranceStatus = request.insurance_approval_status || 'NOT_FORWARDED';
    const emissionStatus = request.emission_approval_status || 'NOT_FORWARDED';
    
    // Determine if all orgs have approved
    const hpgApproved = hpgStatus === 'APPROVED';
    const insuranceApproved = insuranceStatus === 'APPROVED';
    const emissionApproved = emissionStatus === 'APPROVED';
    // Only HPG and Insurance are treated as required organizations for final approval.
    const allOrgsApproved = hpgApproved && insuranceApproved;
    
    // Determine what's pending
    const pendingOrgs = [];
    if (hpgStatus !== 'APPROVED' && hpgStatus !== 'NOT_FORWARDED' && hpgStatus !== 'REJECTED') pendingOrgs.push('HPG');
    if (insuranceStatus !== 'APPROVED' && insuranceStatus !== 'NOT_FORWARDED' && insuranceStatus !== 'REJECTED') pendingOrgs.push('Insurance');
    
    // Not forwarded orgs
    const notForwardedOrgs = [];
    if (hpgStatus === 'NOT_FORWARDED' || !hpgStatus || (!request.forwarded_to_hpg && !request.hpg_clearance_request_id)) notForwardedOrgs.push('HPG');
    if (insuranceStatus === 'NOT_FORWARDED' || !insuranceStatus || !request.insurance_clearance_request_id) notForwardedOrgs.push('Insurance');
    
    // Check for rejections
    // Only HPG and Insurance rejections block final approval.
    const anyRejected = hpgStatus === 'REJECTED' || insuranceStatus === 'REJECTED';
    
    // Clear existing buttons
    actionButtons.innerHTML = '';

    if (!isFinalizedStatus(status)) {
        let buttonsHTML = '';
        
        // Show forward buttons for orgs not yet forwarded
        if (notForwardedOrgs.includes('HPG')) {
            buttonsHTML += `
                <button class="btn-info btn-block" onclick="forwardToHPG()">
                    <i class="fas fa-shield-alt"></i> Forward to HPG
                </button>
            `;
        }
        if (notForwardedOrgs.includes('Insurance')) {
            buttonsHTML += `
                <button class="btn-info btn-block" onclick="forwardToInsurance()">
                    <i class="fas fa-file-shield"></i> Forward to Insurance
                </button>
            `;
        }
        if (emissionStatus === 'NOT_FORWARDED' || !emissionStatus || !request.emission_clearance_request_id) {
            buttonsHTML += `
                <button class="btn-info btn-block" onclick="forwardToEmission()">
                    <i class="fas fa-leaf"></i> Forward to Emission
                </button>
            `;
        }
        
        // Approve/Reject buttons - only enabled if all orgs approved
        if (allOrgsApproved) {
            buttonsHTML += `
                <div class="approval-ready-banner" style="background: #d4edda; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
                    <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                    <strong style="color: #155724;">All organizations have approved. Ready for final approval.</strong>
                </div>
                <button class="btn-success btn-block" onclick="approveTransfer()">
                    <i class="fas fa-check"></i> Approve Transfer
                </button>
                <button class="btn-danger btn-block" onclick="rejectTransfer()">
                    <i class="fas fa-times"></i> Reject Transfer
                </button>
            `;
        } else if (anyRejected) {
            buttonsHTML += `
                <div class="approval-rejected-banner" style="background: #f8d7da; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
                    <i class="fas fa-times-circle" style="color: #e74c3c;"></i>
                    <strong style="color: #721c24;">One or more organizations have rejected this request.</strong>
                </div>
                <button class="btn-danger btn-block" onclick="rejectTransfer()">
                    <i class="fas fa-times"></i> Reject Transfer
                </button>
            `;
        } else {
            // Show disabled buttons with explanation
            const waitingFor = pendingOrgs.length > 0 ? pendingOrgs : notForwardedOrgs;
            buttonsHTML += `
                <div class="approval-pending-banner" style="background: #fff3cd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <i class="fas fa-hourglass-half" style="color: #856404;"></i>
                    <strong style="color: #856404;">Cannot approve yet.</strong>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #856404;">
                        ${notForwardedOrgs.length > 0 ? `Not forwarded to: ${notForwardedOrgs.join(', ')}` : ''}
                        ${pendingOrgs.length > 0 ? `<br>Pending approval from: ${pendingOrgs.join(', ')}` : ''}
                    </p>
                </div>
                <button class="btn-success btn-block" disabled style="opacity: 0.5; cursor: not-allowed;">
                    <i class="fas fa-check"></i> Approve Transfer (Waiting for Orgs)
                </button>
                <button class="btn-danger btn-block" onclick="rejectTransfer()">
                    <i class="fas fa-times"></i> Reject Transfer
                </button>
            `;
        }
        
        // Always show verification link
        buttonsHTML += `
            <a href="admin-transfer-verification.html?id=${currentRequestId}" class="btn-secondary btn-block">
                <i class="fas fa-clipboard-check"></i> Verify Documents
            </a>
        `;
        
        actionButtons.innerHTML = buttonsHTML;
    } else {
        // Finalized: hide the entire card and clear any actions/links
        const card = document.querySelector('.action-panel .dashboard-card');
        if (card) card.style.display = 'none';
        actionButtons.innerHTML = '';
    }
}

async function viewDocument(docId) {
    console.log('[viewDocument] Called with docId:', docId);
    
    try {
        // Use DocumentModal if available for better in-page viewing
        if (typeof DocumentModal !== 'undefined') {
            console.log('[viewDocument] Using DocumentModal');
            DocumentModal.view({ id: docId });
            return;
        }
        
        // Strict: never open new tabs for viewing documents
        console.log('[viewDocument] DocumentModal not available');
        showError('Document viewer modal is not available. Please refresh the page.');

    } catch (error) {
        console.error('[viewDocument] Error:', error);
        showError(error.message || 'Failed to view document');
    }
}

async function downloadDocument(docId) {
    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Download document
        const response = await apiClient.get(`/api/documents/${docId}/download`, {
            responseType: 'blob'
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to download document');
        }

        // Create download link
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showSuccess('Document downloaded successfully');

    } catch (error) {
        console.error('Download document error:', error);
        showError(error.message || 'Failed to download document');
    }
}

async function approveTransfer() {
    // Check if all orgs have approved
    if (currentTransferRequest) {
        const hpgStatus = currentTransferRequest.hpg_approval_status || 'PENDING';
        const insuranceStatus = currentTransferRequest.insurance_approval_status || 'PENDING';
        const emissionStatus = currentTransferRequest.emission_approval_status || 'PENDING';
        
        const pendingApprovals = [];
        if (hpgStatus !== 'APPROVED') pendingApprovals.push('HPG');
        if (insuranceStatus !== 'APPROVED') pendingApprovals.push('Insurance');
        
        if (pendingApprovals.length > 0) {
            showError(`Cannot approve. Pending approvals from: ${pendingApprovals.join(', ')}`);
            return;
        }
    }
    
    if (!confirm('Are you sure you want to approve this transfer request?')) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/approve`, {});
        
        if (response.success) {
            showSuccess('Transfer request approved successfully');
            loadTransferRequestDetails(); // Reload to update status
        } else {
            throw new Error(response.error || response.message || 'Failed to approve transfer request');
        }
    } catch (error) {
        console.error('Approve transfer error:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Failed to approve transfer request';
        showError(errorMessage);
    }
}

async function rejectTransfer() {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/reject`, {
            reason: reason
        });
        
        if (response.success) {
            showSuccess('Transfer request rejected');
            loadTransferRequestDetails(); // Reload to update status
        } else {
            throw new Error(response.error || 'Failed to reject transfer request');
        }
    } catch (error) {
        console.error('Reject transfer error:', error);
        showError(error.message || 'Failed to reject transfer request');
    }
}

function getStatusClass(status) {
    const statusClasses = {
        'PENDING': 'pending',
        'REVIEWING': 'reviewing',
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'COMPLETED': 'completed',
        'FORWARDED_TO_HPG': 'forwarded'
    };
    return statusClasses[status] || 'pending';
}

function showLoading() {
    const content = document.querySelector('.dashboard-content');
    if (content) {
        content.style.opacity = '0.5';
        content.style.pointerEvents = 'none';
    }
}

function hideLoading() {
    const content = document.querySelector('.dashboard-content');
    if (content) {
        content.style.opacity = '1';
        content.style.pointerEvents = 'auto';
    }
}

function showSuccess(message) {
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, 'success');
    } else {
        alert(message);
    }
}

function showError(message) {
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, 'error');
    } else {
        alert(message);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function forwardToHPG() {
    if (!confirm('Forward this transfer request to HPG for clearance review?')) {
        return;
    }

    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/forward-hpg`, {
            purpose: 'Vehicle ownership transfer clearance',
            notes: 'Forwarded for HPG clearance review'
        });
        
        if (response.success) {
            showSuccess('Transfer request forwarded to HPG successfully');
            loadTransferRequestDetails(); // Reload to update status
        } else {
            throw new Error(response.error || 'Failed to forward to HPG');
        }
    } catch (error) {
        console.error('Forward to HPG error:', error);
        showError(error.message || 'Failed to forward to HPG');
    }
}

async function forwardToInsurance() {
    if (!confirm('Forward this transfer request to Insurance for clearance review?')) {
        return;
    }

    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/forward-insurance`, {
            purpose: 'Vehicle ownership transfer clearance',
            notes: 'Forwarded for Insurance clearance review'
        });
        
        if (response.success) {
            showSuccess('Transfer request forwarded to Insurance successfully');
            loadTransferRequestDetails(); // Reload to update status
        } else {
            throw new Error(response.error || 'Failed to forward to Insurance');
        }
    } catch (error) {
        console.error('Forward to Insurance error:', error);
        showError(error.message || 'Failed to forward to Insurance');
    }
}

async function forwardToEmission() {
    if (!confirm('Forward this transfer request to Emission for clearance review?')) {
        return;
    }

    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/forward-emission`, {
            purpose: 'Vehicle ownership transfer clearance',
            notes: 'Forwarded for Emission clearance review'
        });
        
        if (response.success) {
            showSuccess('Transfer request forwarded to Emission successfully');
            loadTransferRequestDetails(); // Reload to update status
        } else {
            throw new Error(response.error || 'Failed to forward to Emission');
        }
    } catch (error) {
        console.error('Forward to Emission error:', error);
        showError(error.message || 'Failed to forward to Emission');
    }
}

// Make functions globally available for inline onclick handlers
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;
window.approveTransfer = approveTransfer;
window.rejectTransfer = rejectTransfer;
window.forwardToHPG = forwardToHPG;
window.forwardToInsurance = forwardToInsurance;
window.forwardToEmission = forwardToEmission;

