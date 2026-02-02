// Admin Transfer Requests - JavaScript
// Handles transfer request management, approval, and rejection

document.addEventListener('DOMContentLoaded', function () {
    initializeTransferRequests();
});

let currentRequests = [];
let selectedRequests = new Set();
let currentFilters = {};
let currentPage = 1;
const itemsPerPage = 50;

function initializeTransferRequests() {
    // Initialize user information
    if (typeof AuthUtils !== 'undefined') {
        const user = AuthUtils.getCurrentUser();
        if (user) {
            const sidebarUserNameEl = document.getElementById('sidebarUserName');
            const sidebarUserRoleEl = document.getElementById('sidebarUserRole');
            const sidebarUserAvatarEl = document.getElementById('sidebarUserAvatar');

            if (sidebarUserNameEl) sidebarUserNameEl.textContent = 'ADMIN';
            if (sidebarUserRoleEl) sidebarUserRoleEl.textContent = 'System Administrator';
            if (sidebarUserAvatarEl) sidebarUserAvatarEl.textContent = 'AD';
        } else {
            // Not authenticated, redirect to login
            window.location.href = 'login-signup.html';
        }
    }

    // Sidebar toggle
    const sidebar = document.querySelector('.dashboard-sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function (e) {
            e.preventDefault();
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

    // Filter toggle
    const filterToggle = document.getElementById('filterToggle');
    const filterPanel = document.getElementById('filterPanel');
    if (filterToggle && filterPanel) {
        filterToggle.addEventListener('click', function () {
            filterPanel.style.display = filterPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function () {
            applyFilters();
        }, 500));
    }

    // Select all checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', toggleSelectAll);
    }

    // Load transfer requests
    loadTransferRequests();
    loadTransferStats();
}

async function loadTransferRequests(filters = {}) {
    try {
        showLoading();

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Build query parameters
        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage,
            ...filters,
            ...currentFilters
        });

        // Get transfer requests
        const response = await apiClient.get(`/api/vehicles/transfer/requests?${params.toString()}`);

        if (!response.success) {
            throw new Error(response.error || 'Failed to load transfer requests');
        }

        currentRequests = response.requests || [];

        // Display requests
        renderTransferRequests(currentRequests);

        // Update pagination
        if (response.pagination) {
            updatePagination(response.pagination);
        }

        hideLoading();

    } catch (error) {
        console.error('Load transfer requests error:', error);
        showError(error.message || 'Failed to load transfer requests');
        hideLoading();
    }
}

async function loadTransferStats() {
    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get transfer statistics
        const response = await apiClient.get('/api/vehicles/transfer/requests/stats');

        if (response.success && response.stats) {
            // Update badge if exists
            const transferBadge = document.getElementById('transferBadge');
            if (transferBadge && response.stats.pending) {
                transferBadge.textContent = response.stats.pending;
                transferBadge.style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Load transfer stats error:', error);
        // Non-critical, don't show error
    }
}

function renderTransferRequests(requests) {
    const tbody = document.getElementById('transferRequestsBody');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <p>No transfer requests found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = requests.map(request => {
        // Extract seller name - should be from database join
        const sellerName = request.seller_name ||
            (request.seller ? `${request.seller.first_name || ''} ${request.seller.last_name || ''}`.trim() : null) ||
            (request.seller?.name) ||
            'N/A';

        // Extract buyer name - prioritize database join (real user data), then buyer_info JSONB
        // NEVER use placeholders - always use real data from records
        let buyerName = request.buyer_name; // From database join (if buyer has account)

        // If no buyer_name from join, try buyer object
        if (!buyerName && request.buyer) {
            const buyerFirst = request.buyer.first_name || '';
            const buyerLast = request.buyer.last_name || '';
            buyerName = `${buyerFirst} ${buyerLast}`.trim() || null;
        }

        // If still no buyer name, try extracting from buyer_info JSONB
        if (!buyerName && request.buyer_info) {
            const buyerInfo = typeof request.buyer_info === 'string' ? JSON.parse(request.buyer_info) : request.buyer_info;
            if (buyerInfo.firstName && buyerInfo.lastName) {
                buyerName = `${buyerInfo.firstName} ${buyerInfo.lastName}`;
            } else if (buyerInfo.firstName) {
                buyerName = buyerInfo.firstName;
            }
        }

        // If still no name, use buyer email (real data, not placeholder)
        if (!buyerName) {
            buyerName = request.buyer_email ||
                (request.buyer?.email) ||
                (request.buyer_info && (typeof request.buyer_info === 'string' ? JSON.parse(request.buyer_info) : request.buyer_info).email) ||
                'Unknown Buyer';
        }

        const plateNumber = request.vehicle?.plate_number || request.plate_number || 'N/A';
        const submittedDate = new Date(request.submitted_at || request.created_at).toLocaleDateString('en-US');
        const status = request.status || 'PENDING';
        const statusClass = getStatusClass(status);

        return `
            <tr>
                <td>
                    <input type="checkbox" class="request-checkbox" value="${request.id}" onchange="updateSelection()">
                </td>
                <td>${escapeHtml(request.id.substring(0, 8))}...</td>
                <td>${escapeHtml(sellerName)}</td>
                <td>${escapeHtml(buyerName)}</td>
                <td>${escapeHtml(plateNumber)}</td>
                <td>${submittedDate}</td>
                <td>
                    <span class="status-badge ${statusClass}" title="${status === 'PENDING' ? 'Waiting for buyer to accept the transfer request' : status === 'REVIEWING' ? 'Buyer has accepted, waiting for admin review' : ''}">
                        ${escapeHtml(status)}
                        ${status === 'PENDING' ? ' <i class="fas fa-info-circle" style="font-size: 0.8em; opacity: 0.7;"></i>' : ''}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="viewTransferDetails('${request.id}')" title="View Request Details" aria-label="View Request Details">
                            <i class="fas fa-eye" aria-hidden="true"></i>
                            <span>View Details</span>
                        </button>
                        ${status === 'REVIEWING' ? `
                            <button class="btn-icon btn-success" onclick="approveTransfer('${request.id}')" title="Approve Transfer" aria-label="Approve Transfer">
                                <i class="fas fa-check" aria-hidden="true"></i>
                                <span>Approve</span>
                            </button>
                            <button class="btn-icon btn-danger" onclick="rejectTransfer('${request.id}')" title="Reject Transfer" aria-label="Reject Transfer">
                                <i class="fas fa-times" aria-hidden="true"></i>
                                <span>Reject</span>
                            </button>
                        ` : status === 'PENDING' ? `
                            <button class="btn-icon" disabled title="Waiting for buyer to accept" aria-label="Waiting for buyer to accept" style="opacity: 0.5; cursor: not-allowed;">
                                <i class="fas fa-clock" aria-hidden="true"></i>
                                <span>Waiting</span>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
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

function updatePagination(pagination) {
    const paginationInfo = document.querySelector('.pagination-info');
    const prevButton = document.querySelector('.pagination .btn-secondary:first-child');
    const nextButton = document.querySelector('.pagination .btn-secondary:last-child');

    if (paginationInfo) {
        paginationInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages || 1}`;
    }

    if (prevButton) {
        prevButton.disabled = !pagination.hasPrev;
        if (pagination.hasPrev) {
            prevButton.onclick = () => {
                currentPage--;
                loadTransferRequests();
            };
        }
    }

    if (nextButton) {
        nextButton.disabled = !pagination.hasNext;
        if (pagination.hasNext) {
            nextButton.onclick = () => {
                currentPage++;
                loadTransferRequests();
            };
        }
    }
}

function applyFilters() {
    const status = document.getElementById('statusFilter')?.value || '';
    const dateFrom = document.getElementById('dateFrom')?.value || '';
    const dateTo = document.getElementById('dateTo')?.value || '';
    const plateNumber = document.getElementById('plateFilter')?.value || '';
    const searchText = document.getElementById('searchInput')?.value || '';

    currentFilters = {};
    if (status) {
        // Status values are already uppercase (PENDING, REVIEWING, etc.)
        currentFilters.status = status;
    }
    if (dateFrom) currentFilters.dateFrom = dateFrom;
    if (dateTo) currentFilters.dateTo = dateTo;
    if (plateNumber) currentFilters.plateNumber = plateNumber;

    currentPage = 1; // Reset to first page
    loadTransferRequests();
}

function clearFilters() {
    document.getElementById('statusFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('plateFilter').value = '';
    document.getElementById('searchInput').value = '';

    currentFilters = {};
    currentPage = 1;
    loadTransferRequests();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.request-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
        if (selectAll.checked) {
            selectedRequests.add(checkbox.value);
        } else {
            selectedRequests.delete(checkbox.value);
        }
    });

    updateBulkActions();
}

function updateSelection() {
    const checkboxes = document.querySelectorAll('.request-checkbox');
    selectedRequests.clear();

    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedRequests.add(checkbox.value);
        }
    });

    // Update select all checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.checked = selectedRequests.size === checkboxes.length && checkboxes.length > 0;
    }

    updateBulkActions();
}

function updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = document.getElementById('selectedCount');

    if (bulkActions && selectedCount) {
        if (selectedRequests.size > 0) {
            bulkActions.style.display = 'flex';
            selectedCount.textContent = `${selectedRequests.size} selected`;
        } else {
            bulkActions.style.display = 'none';
        }
    }
}

function clearSelection() {
    selectedRequests.clear();
    const checkboxes = document.querySelectorAll('.request-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;
    updateBulkActions();
}

async function approveTransfer(requestId) {
    if (!confirm('Are you sure you want to approve this transfer request?')) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${requestId}/approve`, {});

        if (response.success) {
            showSuccess('Transfer request approved successfully');
            loadTransferRequests();
            loadTransferStats();
        } else {
            throw new Error(response.error || 'Failed to approve transfer request');
        }
    } catch (error) {
        console.error('Approve transfer error:', error);
        showError(error.message || 'Failed to approve transfer request');
    }
}

async function rejectTransfer(requestId) {
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
                const response = await apiClient.post(`/api/vehicles/transfer/requests/${requestId}/reject`, {
                    reason: reason
                });

                if (response.success) {
                    showSuccess('Transfer request rejected');
                    closeModal();
                    loadTransferRequests();
                    loadTransferStats();
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

async function bulkApprove() {
    if (selectedRequests.size === 0) {
        showError('Please select at least one request');
        return;
    }

    if (!confirm(`Are you sure you want to approve ${selectedRequests.size} transfer request(s)?`)) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const requestIds = Array.from(selectedRequests);
        const response = await apiClient.post('/api/vehicles/transfer/requests/bulk-approve', {
            requestIds: requestIds
        });

        if (response.success) {
            showSuccess(`${requestIds.length} transfer request(s) approved successfully`);
            clearSelection();
            loadTransferRequests();
            loadTransferStats();
        } else {
            throw new Error(response.error || 'Failed to approve transfer requests');
        }
    } catch (error) {
        console.error('Bulk approve error:', error);
        showError(error.message || 'Failed to approve transfer requests');
    }
}

async function bulkReject() {
    if (selectedRequests.size === 0) {
        showError('Please select at least one request');
        return;
    }

    const count = selectedRequests.size;

    // Show modal dialog for rejection reason
    const modal = document.createElement('div');
    modal.className = 'rejection-modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                <i class="fas fa-times-circle" style="color: white; font-size: 1.5rem;"></i>
                <h3 style="margin: 0; color: white; font-size: 1.1rem; font-weight: 600;">Bulk Reject Transfer Requests</h3>
            </div>
            <div style="padding: 1.5rem;">
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.875rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                    <span style="color: #991b1b; font-size: 0.9rem;">You are about to reject <strong>${count}</strong> transfer request(s).</span>
                </div>
                <p style="margin: 0 0 1rem 0; color: #4b5563; font-size: 0.95rem;">Please provide a reason for rejecting these requests:</p>
                <textarea id="rejectionReasonInput" placeholder="Enter rejection reason..." 
                    style="width: 100%; min-height: 100px; padding: 0.875rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 0.95rem; resize: vertical; font-family: inherit; transition: border-color 0.2s;"
                    onfocus="this.style.borderColor='#ef4444'; this.style.outline='none';"
                    onblur="this.style.borderColor='#e5e7eb';"></textarea>
            </div>
            <div style="padding: 1rem 1.5rem; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button class="cancel-btn" style="padding: 0.625rem 1.25rem; background: white; border: 1px solid #d1d5db; border-radius: 8px; color: #4b5563; font-weight: 500; cursor: pointer;">Cancel</button>
                <button class="confirm-btn" style="padding: 0.625rem 1.25rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none; border-radius: 8px; color: white; font-weight: 500; cursor: pointer;">
                    <i class="fas fa-times" style="margin-right: 0.5rem;"></i>Reject ${count} Request(s)
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
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
                const requestIds = Array.from(selectedRequests);
                const response = await apiClient.post('/api/vehicles/transfer/requests/bulk-reject', {
                    requestIds: requestIds,
                    reason: reason
                });

                if (response.success) {
                    showSuccess(`${requestIds.length} transfer request(s) rejected`);
                    closeModal();
                    clearSelection();
                    loadTransferRequests();
                    loadTransferStats();
                } else {
                    throw new Error(response.error || 'Failed to reject transfer requests');
                }
            } catch (error) {
                console.error('Bulk reject error:', error);
                showError(error.message || 'Failed to reject transfer requests');
                btn.disabled = false;
                btn.innerHTML = `<i class="fas fa-times" style="margin-right: 0.5rem;"></i>Reject ${count} Request(s)`;
            }
        };
    });
}

function viewTransferDetails(requestId) {
    // Navigate to transfer details page
    window.location.href = `admin-transfer-details.html?id=${requestId}`;
}

function showLoading() {
    const tbody = document.getElementById('transferRequestsBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
                    <p>Loading...</p>
                </td>
            </tr>
        `;
    }
}

function hideLoading() {
    // Loading is hidden when content is populated
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

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions globally available for inline onclick handlers
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.toggleSelectAll = toggleSelectAll;
window.updateSelection = updateSelection;
window.clearSelection = clearSelection;
window.bulkApprove = bulkApprove;
window.bulkReject = bulkReject;
window.approveTransfer = approveTransfer;
window.rejectTransfer = rejectTransfer;
window.viewTransferDetails = viewTransferDetails;

