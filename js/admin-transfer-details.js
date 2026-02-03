// Admin Transfer Details - JavaScript
// Handles viewing detailed transfer request information

document.addEventListener('DOMContentLoaded', function () {
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
        sidebarToggle.addEventListener('click', function () {
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
        sidebarLogoutBtn.addEventListener('click', function (e) {
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

    // Load ownership history (but don't display until toggled)
    if (request.vehicle_id || (request.vehicle && request.vehicle.id)) {
        loadOwnershipHistory(request.vehicle_id || request.vehicle.id, false); // false = don't auto-expand
    }

    // Update documents - use categorized documents from backend (fallback to legacy documents array)
    const hasCategorizedDocuments = ['vehicleDocuments', 'sellerDocuments', 'buyerDocuments']
        .every(key => Array.isArray(request[key]));
    const categorizedDocuments = hasCategorizedDocuments
        ? {
            vehicleDocuments: request.vehicleDocuments || [],
            sellerDocuments: request.sellerDocuments || [],
            buyerDocuments: request.buyerDocuments || []
        }
        : (request.documents || []);
    renderDocuments(categorizedDocuments);

    // Update organization approval status display
    renderOrgApprovalStatus(request);

    // Update MVIR (LTO) validation status display
    renderMvirValidationStatus(request);

    // Update action buttons
    updateActionButtons(request);
}

function renderMvirValidationStatus(request) {
    const section = document.getElementById('mvirVerificationSection');
    if (!section) return;

    // Show this section for transfer requests (safe default: show when viewing transfer details)
    section.style.display = 'block';

    const vehicle = request.vehicle || request.vehicle_info || {};
    const mvirNumber =
        vehicle.mvir_number ||
        vehicle.mvirNumber ||
        (request.vehicle && (request.vehicle.mvir_number || request.vehicle.mvirNumber)) ||
        null;

    const mvirInspectionNumberEl = document.getElementById('mvirInspectionNumber');
    const mvirInspectionHintEl = document.getElementById('mvirInspectionHint');
    const mvirAutoVerifyStatusEl = document.getElementById('mvirAutoVerifyStatus');
    const mvirAutoVerifyReasonEl = document.getElementById('mvirAutoVerifyReason');
    const mvirAutoVerifyCheckedAtEl = document.getElementById('mvirAutoVerifyCheckedAt');
    const rerunBtn = document.getElementById('rerunMvirVerifyBtn');

    if (mvirInspectionNumberEl) {
        if (mvirNumber) {
            mvirInspectionNumberEl.innerHTML = `<strong style="color: #0c4a6e;">${escapeHtml(String(mvirNumber))}</strong>`;
        } else {
            mvirInspectionNumberEl.innerHTML = `<span style="color: #7f8c8d;">Not yet inspected</span>`;
        }
    }

    if (mvirInspectionHintEl) {
        if (mvirNumber) {
            mvirInspectionHintEl.textContent = 'Inspection record exists on the vehicle.';
        } else {
            mvirInspectionHintEl.textContent = 'LTO inspection is required before final approval.';
        }
    }

    const mvirAuto = request.metadata && request.metadata.mvirAutoVerification
        ? request.metadata.mvirAutoVerification
        : null;

    const status = mvirAuto?.status || 'NOT_CHECKED';
    const automated = mvirAuto?.automated;
    const reason = mvirAuto?.reason || '';

    if (mvirAutoVerifyStatusEl) {
        const statusClass =
            status === 'APPROVED' ? 'status-approved' :
                status === 'REJECTED' ? 'status-rejected' :
                    status === 'PENDING' ? 'status-pending' :
                        'status-pending';

        const label =
            status === 'NOT_CHECKED' ? 'Not checked' :
                status;

        const autoSuffix = (status !== 'NOT_CHECKED' && automated !== undefined)
            ? (automated ? ' (Auto)' : ' (Manual/Review)')
            : '';

        mvirAutoVerifyStatusEl.innerHTML = `<span class="status-badge ${statusClass}">${escapeHtml(label)}${escapeHtml(autoSuffix)}</span>`;
    }

    if (mvirAutoVerifyReasonEl) {
        mvirAutoVerifyReasonEl.textContent = reason ? reason : '—';
    }

    if (mvirAutoVerifyCheckedAtEl) {
        // We don't currently store a checkedAt timestamp in metadata; keep it simple.
        // If you later add it, it will appear automatically.
        mvirAutoVerifyCheckedAtEl.textContent = status === 'NOT_CHECKED' ? '' : 'Saved on transfer metadata';
    }

    // Disable re-run button on finalized statuses (avoid confusion)
    if (rerunBtn) {
        const finalized = isFinalizedStatus(request.status);
        rerunBtn.disabled = !!finalized;
        rerunBtn.title = finalized ? 'Cannot re-run MVIR check on finalized requests' : 'Re-run MVIR auto-verification';
        rerunBtn.style.opacity = finalized ? '0.6' : '1';
        rerunBtn.style.cursor = finalized ? 'not-allowed' : 'pointer';
    }
}

async function rerunMvirVerification() {
    if (!currentRequestId) return;
    try {
        const apiClient = window.apiClient || new APIClient();
        const btn = document.getElementById('rerunMvirVerifyBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Checking...`;
        }

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/verify-mvir`, {});
        if (!response || !response.success) {
            throw new Error(response?.error || 'Failed to verify MVIR');
        }

        // Refresh UI with latest data from backend
        await loadTransferRequestDetails();

        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('MVIR verification completed', 'success');
        }
    } catch (error) {
        console.error('[MVIR Verify] Error:', error);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(`MVIR verification failed: ${error.message}`, 'error');
        } else {
            alert(`MVIR verification failed: ${error.message}`);
        }
    } finally {
        const btn = document.getElementById('rerunMvirVerifyBtn');
        if (btn && currentTransferRequest && !isFinalizedStatus(currentTransferRequest.status)) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-sync-alt"></i> Re-run MVIR Check`;
        }
    }
}
window.rerunMvirVerification = rerunMvirVerification;

function openLtoInspectionForm() {
    const vehicleId = currentTransferRequest?.vehicle_id || currentTransferRequest?.vehicleId || null;
    const url = vehicleId ? `lto-inspection-form.html?vehicleId=${encodeURIComponent(vehicleId)}` : 'lto-inspection-form.html';
    window.open(url, '_blank');
}
window.openLtoInspectionForm = openLtoInspectionForm;

function renderOrgApprovalStatus(request) {
    // Debug: Log approval statuses
    console.log('Organization Approval Statuses:', {
        hpg: request.hpg_approval_status,
        insurance: request.insurance_approval_status,
        hpg_clearance_request_id: request.hpg_clearance_request_id,
        insurance_clearance_request_id: request.insurance_clearance_request_id
    });

    const orgSection = document.getElementById('orgApprovalSection');
    const orgMessage = document.getElementById('orgApprovalMessage');

    if (!orgSection) return;

    // Show section if any org approval is tracked (HPG or Insurance)
    const hasOrgTracking = request.hpg_approval_status || request.insurance_approval_status;

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
    const sellerIdDoc = (request.documents || []).find(doc => {
        const docType = (doc.document_type || doc.type || '').toString().toLowerCase();
        return docType === 'seller_id';
    });
    if (sellerIdEl && sellerIdDoc) {
        const docId = sellerIdDoc.document_id || sellerIdDoc.id;
        sellerIdEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${docId}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${docId}')">
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
    const buyerIdDoc = (request.documents || []).find(doc => {
        const docType = (doc.document_type || doc.type || '').toString().toLowerCase();
        return docType === 'buyer_id';
    });
    if (buyerIdEl && buyerIdDoc) {
        const docId = buyerIdDoc.document_id || buyerIdDoc.id;
        buyerIdEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${docId}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${docId}')">
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

function renderDocuments(documentCategories) {
    const documentsContainer = document.querySelector('.documents-grid');
    if (!documentsContainer) {
        console.error('[renderDocuments] Container .documents-grid not found');
        return;
    }

    // Handle legacy format (array of documents) for backward compatibility
    if (Array.isArray(documentCategories)) {
        console.warn('[renderDocuments] Legacy document format detected, converting...');
        const vehicleDocuments = [];
        const sellerDocuments = [];
        const buyerDocuments = [];

        documentCategories.forEach(doc => {
            const docType = (doc.document_type || doc.type || '').toLowerCase();
            if (doc.is_vehicle_document || doc.source === 'vehicle' || doc.auto_included) {
                vehicleDocuments.push(doc);
            } else if (docType === 'deed_of_sale' || docType === 'seller_id') {
                sellerDocuments.push(doc);
            } else if (docType.startsWith('buyer_') || docType === 'buyer_id' || docType === 'buyer_tin' ||
                docType === 'buyer_ctpl' || docType === 'buyer_hpg_clearance') {
                buyerDocuments.push(doc);
            } else {
                vehicleDocuments.push(doc); // Default to vehicle documents
            }
        });

        documentCategories = { vehicleDocuments, sellerDocuments, buyerDocuments };
    }

    const { vehicleDocuments = [], sellerDocuments = [], buyerDocuments = [] } = documentCategories;

    console.log('[renderDocuments] Rendering categorized documents:', {
        vehicle: vehicleDocuments.length,
        seller: sellerDocuments.length,
        buyer: buyerDocuments.length
    });

    const totalDocs = vehicleDocuments.length + sellerDocuments.length + buyerDocuments.length;
    if (totalDocs === 0) {
        documentsContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                <i class="fas fa-file-alt" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                <p>No documents uploaded for this transfer request</p>
            </div>
        `;
        return;
    }

    // Render categorized documents
    let html = '';

    // Vehicle Original Documents Section (owned by seller while transfer is not approved)
    if (vehicleDocuments.length > 0) {
        html += `
            <div class="document-category-section" style="grid-column: 1 / -1; margin-bottom: 1.5rem;">
                <h4 style="color: #7c3aed; font-size: 1rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-car" style="color: #8b5cf6;"></i>
                    Vehicle Original Documents
                    <span style="font-size: 0.875rem; font-weight: 400; color: #6b7280; margin-left: auto;">
                        (Owned by seller until transfer approved)
                    </span>
                </h4>
                <div class="documents-grid" style="margin-top: 0;">
                    ${vehicleDocuments.map(doc => renderDocumentCard(doc)).join('')}
                </div>
            </div>
        `;
    }

    // Seller Submitted Documents Section
    if (sellerDocuments.length > 0) {
        html += `
            <div class="document-category-section" style="grid-column: 1 / -1; margin-bottom: 1.5rem;">
                <h4 style="color: #1e40af; font-size: 1rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-user-tie" style="color: #3b82f6;"></i>
                    Seller Submitted Documents
                </h4>
                <div class="documents-grid" style="margin-top: 0;">
                    ${sellerDocuments.map(doc => renderDocumentCard(doc)).join('')}
                </div>
            </div>
        `;
    }

    // Buyer Submitted Documents Section
    if (buyerDocuments.length > 0) {
        html += `
            <div class="document-category-section" style="grid-column: 1 / -1; margin-bottom: 1.5rem;">
                <h4 style="color: #059669; font-size: 1rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-user-check" style="color: #10b981;"></i>
                    Buyer Submitted Documents
                </h4>
                <div class="documents-grid" style="margin-top: 0;">
                    ${buyerDocuments.map(doc => renderDocumentCard(doc)).join('')}
                </div>
            </div>
        `;
    }

    documentsContainer.innerHTML = html;
}

function renderDocumentCard(doc) {
    const docId = doc.document_id || doc.id;
    const docType = doc.document_type || doc.type || 'Document';
    const docName = doc.original_name || doc.filename || doc.name || docType;
    const docTypeLabel = getDocumentTypeLabel(docType);
    const docIcon = getDocumentIcon(docType);

    return `
        <div class="document-card">
            <div class="document-header">
                <div class="document-icon">
                    <i class="fas ${docIcon}"></i>
                </div>
                <div class="document-info">
                    <h4>${escapeHtml(docName)}</h4>
                    <span class="document-type">${escapeHtml(docTypeLabel)}</span>
                </div>
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
}

function getDocumentTypeLabel(type) {
    const labels = {
        'deed_of_sale': 'Deed of Sale',
        'seller_id': 'Seller ID',
        'buyer_id': 'Buyer ID',
        'buyer_tin': 'Buyer TIN',
        'buyer_ctpl': 'Buyer CTPL',
        'buyer_hpg_clearance': 'Buyer HPG Clearance',
        'or': 'Vehicle Registration (OR)',
        'cr': 'Vehicle Registration (CR)',
        'or_cr': 'Vehicle Registration (OR/CR)',
        'owner_id': 'Owner ID',
        'insurance_cert': 'Insurance Certificate',
        'registration_cert': 'Registration Certificate',
        'hpg_clearance': 'HPG Clearance',
        'DEED_OF_SALE': 'Deed of Sale',
        'SELLER_ID': 'Seller ID',
        'BUYER_ID': 'Buyer ID',
        'OR': 'Vehicle Registration (OR)',
        'CR': 'Vehicle Registration (CR)',
        'OR_CR': 'Vehicle Registration (OR/CR)',
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getDocumentIcon(type) {
    const icons = {
        'deed_of_sale': 'fa-file-contract',
        'seller_id': 'fa-id-card',
        'buyer_id': 'fa-id-card',
        'buyer_tin': 'fa-file-invoice',
        'buyer_ctpl': 'fa-shield-alt',
        'buyer_hpg_clearance': 'fa-shield-alt',
        'or': 'fa-file-alt',
        'cr': 'fa-file-alt',
        'or_cr': 'fa-file-alt',
        'owner_id': 'fa-id-card',
        'insurance_cert': 'fa-shield-alt',
        'registration_cert': 'fa-file-certificate',
        'hpg_clearance': 'fa-shield-alt',
    };
    return icons[type?.toLowerCase()] || 'fa-file-contract';
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

    // Determine if all orgs have approved
    const hpgApproved = hpgStatus === 'APPROVED';
    const insuranceApproved = insuranceStatus === 'APPROVED';
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

        // Extract detailed error message
        let errorMessage = 'Failed to approve transfer request';
        if (error.response?.data) {
            const errorData = error.response.data;

            // Show detailed missing documents if available
            if (errorData.missingLabels) {
                const missingList = [];
                if (errorData.missingLabels.seller?.length > 0) {
                    missingList.push(`Seller: ${errorData.missingLabels.seller.join(', ')}`);
                }
                if (errorData.missingLabels.buyer?.length > 0) {
                    missingList.push(`Buyer: ${errorData.missingLabels.buyer.join(', ')}`);
                }
                if (missingList.length > 0) {
                    errorMessage = `Missing required documents: ${missingList.join('; ')}`;
                }
            } else if (errorData.message) {
                errorMessage = errorData.message;
            } else if (errorData.error) {
                errorMessage = errorData.error;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }

        showError(errorMessage);
    }
}

async function rejectTransfer() {
    // Show modal dialog for rejection reason
    const modal = document.createElement('div');
    modal.className = 'rejection-modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: modalSlideIn 0.2s ease-out;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                <i class="fas fa-times-circle" style="color: white; font-size: 1.5rem;"></i>
                <h3 style="margin: 0; color: white; font-size: 1.1rem; font-weight: 600;">Reject Transfer Request</h3>
            </div>
            <div style="padding: 1.5rem;">
                <p style="margin: 0 0 1rem 0; color: #4b5563; font-size: 0.95rem;">Please provide a reason for rejecting this transfer request:</p>
                <textarea id="rejectionReasonInput" placeholder="Enter rejection reason..." 
                    style="width: 100%; min-height: 120px; padding: 0.875rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 0.95rem; resize: vertical; font-family: inherit; transition: border-color 0.2s;"
                    onfocus="this.style.borderColor='#ef4444'; this.style.outline='none';"
                    onblur="this.style.borderColor='#e5e7eb';"></textarea>
            </div>
            <div style="padding: 1rem 1.5rem; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button class="cancel-btn" style="padding: 0.625rem 1.25rem; background: white; border: 1px solid #d1d5db; border-radius: 8px; color: #4b5563; font-weight: 500; cursor: pointer; transition: all 0.2s;">Cancel</button>
                <button class="confirm-btn" style="padding: 0.625rem 1.25rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none; border-radius: 8px; color: white; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                    <i class="fas fa-times" style="margin-right: 0.5rem;"></i>Reject Request
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus the textarea
    setTimeout(() => modal.querySelector('#rejectionReasonInput').focus(), 100);

    return new Promise((resolve) => {
        const closeModal = () => {
            modal.remove();
            resolve();
        };

        modal.querySelector('.cancel-btn').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        modal.querySelector('.confirm-btn').onclick = async function () {
            const reason = modal.querySelector('#rejectionReasonInput').value.trim();
            if (!reason) {
                showError('Please provide a reason for rejection');
                modal.querySelector('#rejectionReasonInput').focus();
                return;
            }

            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Rejecting...';

            try {
                const apiClient = window.apiClient || new APIClient();
                const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/reject`, {
                    reason: reason
                });

                if (response.success) {
                    showSuccess('Transfer request rejected');
                    closeModal();
                    loadTransferRequestDetails(); // Reload to update status
                } else {
                    throw new Error(response.error || 'Failed to reject transfer request');
                }
            } catch (error) {
                console.error('Reject transfer error:', error);
                showError(error.message || 'Failed to reject transfer request');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-times" style="margin-right: 0.5rem;"></i>Reject Request';
            }
        };
    });
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

window.forwardToHPG = forwardToHPG;
window.forwardToInsurance = forwardToInsurance;

// Ownership History Functions
let ownershipHistoryExpanded = false;

async function loadOwnershipHistory(vehicleId, autoExpand = false) {
    if (!vehicleId) return;

    const contentEl = document.getElementById('ownershipHistoryContent');
    if (!contentEl) return;

    try {
        const apiClient = window.apiClient || new APIClient();
        const vehicle = await apiClient.get(`/api/vehicles/${vehicleId}`);

        if (!vehicle || !vehicle.vehicle) {
            throw new Error('Vehicle not found');
        }

        const vin = vehicle.vehicle.vin || vehicleId;
        const response = await apiClient.get(`/api/vehicles/${vin}/ownership-history`);

        if (response.success) {
            const history = response.ownershipHistory || [];
            renderOwnershipHistory(history, vehicle.vehicle);

            if (autoExpand && history.length > 0) {
                toggleOwnershipHistory();
            }
        } else {
            throw new Error(response.error || 'Failed to load ownership history');
        }
    } catch (error) {
        console.error('Load ownership history error:', error);
        const contentEl = document.getElementById('ownershipHistoryContent');
        if (contentEl) {
            contentEl.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load ownership history: ${escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }
}

function renderOwnershipHistory(history, vehicle) {
    const contentEl = document.getElementById('ownershipHistoryContent');
    if (!contentEl) return;

    if (!history || history.length === 0) {
        contentEl.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                <i class="fas fa-info-circle"></i>
                <h4>No Ownership History</h4>
                <p>This vehicle has no ownership transfer records yet.</p>
            </div>
        `;
        return;
    }

    // Sort by date (newest first)
    const sortedHistory = [...history].sort((a, b) => {
        const dateA = new Date(a.performed_at || a.timestamp || 0);
        const dateB = new Date(b.performed_at || b.timestamp || 0);
        return dateB - dateA;
    });

    let html = '<div class="ownership-timeline" style="position: relative; padding-left: 2rem;">';

    sortedHistory.forEach((record, index) => {
        const isCurrent = index === 0;
        const date = new Date(record.performed_at || record.timestamp);
        const dateFormatted = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const action = record.action || 'UNKNOWN';
        const previousOwner = record.previous_owner_name || record.metadata?.previousOwnerName || 'N/A';
        const newOwner = record.new_owner_name || record.current_owner_name || record.metadata?.newOwnerName || 'N/A';
        const performedBy = record.performed_by_name || 'System';
        const transactionId = record.transaction_id || record.transactionId || 'N/A';

        html += `
            <div class="timeline-item" style="position: relative; padding-bottom: 2rem; border-left: 2px solid ${isCurrent ? '#27ae60' : '#e9ecef'}; padding-left: 1.5rem; margin-left: -2rem;">
                <div class="timeline-marker" style="position: absolute; left: -6px; top: 0; width: 12px; height: 12px; border-radius: 50%; background: ${isCurrent ? '#27ae60' : '#95a5a6'}; border: 2px solid white; box-shadow: 0 0 0 2px ${isCurrent ? '#27ae60' : '#95a5a6'};"></div>
                <div class="timeline-content" style="background: ${isCurrent ? '#e8f5e9' : '#f8f9fa'}; padding: 1rem; border-radius: 8px; border-left: 3px solid ${isCurrent ? '#27ae60' : '#95a5a6'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div>
                            <h4 style="margin: 0; color: ${isCurrent ? '#27ae60' : '#2c3e50'}; font-size: 1rem;">
                                ${isCurrent ? '<i class="fas fa-star" style="color: #f39c12;"></i> ' : ''}${escapeHtml(action.replace(/_/g, ' '))}
                            </h4>
                            <small style="color: #7f8c8d;"><i class="fas fa-calendar"></i> ${dateFormatted}</small>
                        </div>
                        ${isCurrent ? '<span class="status-badge status-success" style="font-size: 0.75rem;">Current</span>' : ''}
                    </div>
                    ${action === 'OWNERSHIP_TRANSFERRED' ? `
                        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e9ecef;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.875rem;">
                                <div>
                                    <strong style="color: #e74c3c;">Previous Owner:</strong><br>
                                    ${escapeHtml(previousOwner)}
                                </div>
                                <div>
                                    <strong style="color: #27ae60;">New Owner:</strong><br>
                                    ${escapeHtml(newOwner)}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e9ecef; font-size: 0.875rem; color: #7f8c8d;">
                        <div><i class="fas fa-user-cog"></i> Performed by: ${escapeHtml(performedBy)}</div>
                        ${transactionId !== 'N/A' ? `<div style="margin-top: 0.25rem;"><i class="fas fa-link"></i> Transaction: <code style="font-size: 0.75rem;">${escapeHtml(transactionId.substring(0, 20))}...</code></div>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    contentEl.innerHTML = html;
}

function toggleOwnershipHistory() {
    const section = document.getElementById('ownershipHistorySection');
    const icon = document.getElementById('ownershipHistoryIcon');
    const toggleText = document.getElementById('ownershipHistoryToggleText');

    if (!section) return;

    ownershipHistoryExpanded = !ownershipHistoryExpanded;

    if (ownershipHistoryExpanded) {
        section.style.display = 'block';
        if (icon) icon.className = 'fas fa-chevron-up';
        if (toggleText) toggleText.textContent = 'Hide History';
    } else {
        section.style.display = 'none';
        if (icon) icon.className = 'fas fa-chevron-down';
        if (toggleText) toggleText.textContent = 'Show History';
    }
}

// Make functions globally available
window.toggleOwnershipHistory = toggleOwnershipHistory;
window.loadOwnershipHistory = loadOwnershipHistory;

function viewVerification() {
    if (!currentRequestId) return;
    window.location.href = `admin-transfer-verification.html?id=${encodeURIComponent(currentRequestId)}`;
}

window.viewVerification = viewVerification;
