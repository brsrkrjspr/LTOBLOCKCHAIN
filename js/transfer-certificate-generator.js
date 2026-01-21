// Transfer Certificate Generator - Frontend Logic
// Handles transfer request selection, autofill, and certificate generation

let transferContext = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.authManager !== 'undefined') {
        window.authManager.init().catch(error => {
            console.error('AuthManager init error:', error);
        });
    }

    // Authentication check
    if (typeof AuthUtils !== 'undefined') {
        const user = AuthUtils.getCurrentUser();
        if (!user) {
            console.log('❌ Not authenticated, redirecting to login...');
            window.location.href = 'login-signup.html';
            return;
        }
    }

    // Initialize form handlers
    initializeForm();
    loadTransferRequests();
    
    // Set default sale date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('saleDate').value = today;
});

// Load transfer requests for dropdown
async function loadTransferRequests() {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get('/api/certificate-generation/transfer/requests');
        
        if (response.success && response.requests) {
            const select = document.getElementById('transferRequestSelect');
            select.innerHTML = '<option value="">-- Select a transfer request --</option>';
            
            response.requests.forEach(req => {
                const option = document.createElement('option');
                option.value = req.id;
                option.textContent = req.display;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading transfer requests:', error);
        showError('Failed to load transfer requests: ' + error.message);
    }
}

// Initialize form handlers
function initializeForm() {
    const form = document.getElementById('transferCertificateForm');
    const transferSelect = document.getElementById('transferRequestSelect');
    
    // Handle transfer request selection change
    transferSelect.addEventListener('change', async function() {
        const transferRequestId = this.value;
        if (transferRequestId) {
            await loadTransferContext(transferRequestId);
        } else {
            hideAutofillPreview();
        }
    });
    
    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await generateCertificates();
    });
}

// Load transfer context for autofill
async function loadTransferContext(transferRequestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/certificate-generation/transfer/context/${transferRequestId}`);
        
        if (response.success && response.context) {
            transferContext = response.context;
            displayAutofillPreview(response.context);
        } else {
            showError('Failed to load transfer context');
        }
    } catch (error) {
        console.error('Error loading transfer context:', error);
        showError('Failed to load transfer context: ' + error.message);
    }
}

// Display autofill preview
function displayAutofillPreview(context) {
    const previewDiv = document.getElementById('autofillPreview');
    const previewContent = document.getElementById('previewContent');
    
    const vehicle = context.vehicle;
    const seller = context.seller;
    const buyer = context.buyer;
    
    previewContent.innerHTML = `
        <div class="preview-row">
            <span class="preview-label">Vehicle:</span>
            <span class="preview-value">${vehicle.plateNumber || vehicle.vin} - ${vehicle.make} ${vehicle.model} (${vehicle.year})</span>
        </div>
        <div class="preview-row">
            <span class="preview-label">VIN:</span>
            <span class="preview-value">${vehicle.vin || 'N/A'}</span>
        </div>
        <div class="preview-row">
            <span class="preview-label">Engine:</span>
            <span class="preview-value">${vehicle.engineNumber || 'N/A'}</span>
        </div>
        <div class="preview-row">
            <span class="preview-label">Chassis:</span>
            <span class="preview-value">${vehicle.chassisNumber || vehicle.vin || 'N/A'}</span>
        </div>
        <div class="preview-row">
            <span class="preview-label">Seller:</span>
            <span class="preview-value">${seller.name} (${seller.email})</span>
        </div>
        <div class="preview-row">
            <span class="preview-label">Buyer:</span>
            <span class="preview-value">${buyer.name} (${buyer.email})</span>
        </div>
    `;
    
    previewDiv.style.display = 'block';
}

// Hide autofill preview
function hideAutofillPreview() {
    document.getElementById('autofillPreview').style.display = 'none';
    transferContext = null;
}

// Generate all certificates
async function generateCertificates() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const statusDiv = document.getElementById('certificateStatus');
    
    try {
        // Validate transfer request selection
        const transferRequestId = document.getElementById('transferRequestSelect').value;
        if (!transferRequestId) {
            showError('Please select a transfer request');
            return;
        }
        
        if (!transferContext) {
            showError('Please wait for transfer context to load');
            return;
        }
        
        // Show loading
        loadingOverlay.classList.add('show');
        statusDiv.classList.remove('show');
        statusDiv.innerHTML = '';
        
        // Collect form data
        const formData = {
            transferRequestId: transferRequestId,
            sellerDocuments: {
                deedOfSale: {
                    purchasePrice: document.getElementById('purchasePrice').value,
                    saleDate: document.getElementById('saleDate').value || new Date().toISOString(),
                    odometerReading: document.getElementById('odometerReading').value,
                    notaryName: document.getElementById('notaryName').value,
                    notaryCommission: document.getElementById('notaryCommission').value
                },
                sellerId: {
                    idType: document.getElementById('sellerIdType').value,
                    idNumber: document.getElementById('sellerIdNumber').value,
                    dateOfBirth: document.getElementById('sellerDob').value
                }
            },
            buyerDocuments: {
                buyerId: {
                    idType: document.getElementById('buyerIdType').value,
                    idNumber: document.getElementById('buyerIdNumber').value,
                    dateOfBirth: document.getElementById('buyerDob').value
                },
                buyerTin: {
                    tinNumber: document.getElementById('buyerTin').value
                },
                hpgClearance: {
                    clearanceNumber: document.getElementById('hpgClearanceNumber').value || null,
                    verificationDetails: document.getElementById('hpgOfficerName').value 
                        ? `Verified by ${document.getElementById('hpgOfficerName').value}. No adverse record found. Vehicle cleared for registration.`
                        : 'No adverse record found. Vehicle cleared for registration.'
                },
                ctplInsurance: {
                    policyNumber: document.getElementById('ctplPolicyNumber').value || null,
                    coverageAmount: document.getElementById('ctplCoverageAmount').value,
                    insurerName: document.getElementById('ctplInsurerName').value || null
                },
                mvir: {
                    mvirNumber: document.getElementById('mvirNumber').value || null,
                    inspectionResult: document.getElementById('mvirResult').value,
                    inspectorName: document.getElementById('mvirInspectorName').value || null
                }
            }
        };
        
        // Call API
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.post('/api/certificate-generation/transfer/generate-compliance-documents', formData);
        
        // Hide loading
        loadingOverlay.classList.remove('show');
        
        if (response.success) {
            showSuccess('All compliance documents generated successfully!', response);
        } else {
            showError(response.error || 'Failed to generate certificates', response);
        }
        
    } catch (error) {
        console.error('Error generating certificates:', error);
        loadingOverlay.classList.remove('show');
        showError('Failed to generate certificates: ' + error.message);
    }
}

// Show success message
function showSuccess(message, response) {
    const statusDiv = document.getElementById('certificateStatus');
    statusDiv.className = 'certificate-status show success';
    
    let html = `<h4><i class="fas fa-check-circle"></i> ${message}</h4>`;
    
    if (response.results) {
        html += '<div style="margin-top: 1rem;">';
        
        if (response.results.sellerDocuments) {
            html += '<h5>Seller Documents:</h5><ul>';
            if (response.results.sellerDocuments.deedOfSale) {
                html += '<li>Deed of Sale ✓</li>';
            }
            if (response.results.sellerDocuments.sellerId) {
                html += '<li>Seller ID ✓</li>';
            }
            html += '</ul>';
        }
        
        if (response.results.buyerDocuments) {
            html += '<h5>Buyer Documents:</h5><ul>';
            if (response.results.buyerDocuments.buyerId) html += '<li>Buyer ID ✓</li>';
            if (response.results.buyerDocuments.buyerTin) html += '<li>TIN Document ✓</li>';
            if (response.results.buyerDocuments.hpgClearance) html += '<li>HPG Clearance ✓</li>';
            if (response.results.buyerDocuments.ctplInsurance) html += '<li>CTPL Insurance ✓</li>';
            if (response.results.buyerDocuments.mvir) html += '<li>MVIR ✓</li>';
            html += '</ul>';
        }
        
        html += '</div>';
    }
    
    statusDiv.innerHTML = html;
}

// Show error message
function showError(message, response) {
    const statusDiv = document.getElementById('certificateStatus');
    statusDiv.className = 'certificate-status show error';
    
    let html = `<h4><i class="fas fa-exclamation-circle"></i> ${message}</h4>`;
    
    if (response && response.errors && response.errors.length > 0) {
        html += '<ul style="margin-top: 1rem;">';
        response.errors.forEach(err => {
            html += `<li>${err.type}: ${err.error}</li>`;
        });
        html += '</ul>';
    }
    
    statusDiv.innerHTML = html;
}

// Toggle collapsible sections
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.toggle('show');
    
    const header = event.target.closest('.collapsible');
    const icon = header.querySelector('i');
    if (section.classList.contains('show')) {
        icon.className = 'fas fa-chevron-down';
    } else {
        icon.className = 'fas fa-chevron-right';
    }
}
