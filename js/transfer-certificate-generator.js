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
    loadVehicles();
    loadTransferRequests(); // Optional - for linking to transfer requests
    
    // Set default sale date to today
    const today = new Date().toISOString().split('T')[0];
    const saleDateInput = document.getElementById('saleDate');
    if (saleDateInput) saleDateInput.value = today;
});

// Load registered vehicles for dropdown
async function loadVehicles() {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get('/api/certificate-generation/transfer/vehicles');
        
        if (response.success && response.vehicles) {
            const select = document.getElementById('vehicleSelect');
            if (select) {
                select.innerHTML = '<option value="">-- Select a registered vehicle --</option>';
                
                response.vehicles.forEach(vehicle => {
                    const option = document.createElement('option');
                    option.value = vehicle.id;
                    option.textContent = vehicle.display;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading vehicles:', error);
        showError('Failed to load vehicles: ' + error.message);
    }
}

// Load transfer requests for dropdown (optional)
async function loadTransferRequests() {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get('/api/certificate-generation/transfer/requests');
        
        if (response.success && response.requests) {
            const select = document.getElementById('transferRequestSelect');
            if (select) {
                select.innerHTML = '<option value="">-- None (standalone certificate generation) --</option>';
                
                response.requests.forEach(req => {
                    const option = document.createElement('option');
                    option.value = req.id;
                    option.textContent = req.display;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading transfer requests:', error);
        // Don't show error - transfer requests are optional
    }
}

// Initialize form handlers
function initializeForm() {
    const form = document.getElementById('transferCertificateForm');
    const vehicleSelect = document.getElementById('vehicleSelect');
    const transferSelect = document.getElementById('transferRequestSelect');
    
    // Handle vehicle selection change
    if (vehicleSelect) {
        vehicleSelect.addEventListener('change', async function() {
            const vehicleId = this.value;
            if (vehicleId) {
                await loadVehicleContext(vehicleId);
            } else {
                hideAutofillPreview();
            }
        });
    }
    
    // Handle transfer request selection change (optional - for autofill buyer/seller)
    if (transferSelect) {
        transferSelect.addEventListener('change', async function() {
            const transferRequestId = this.value;
            if (transferRequestId) {
                await loadTransferContext(transferRequestId);
                // Hide buyer email section when transfer request is selected (buyer comes from request)
                const buyerInfoSection = document.getElementById('buyerInfoSection');
                if (buyerInfoSection) buyerInfoSection.style.display = 'none';
            } else {
                // Show buyer email section when no transfer request is selected (standalone mode)
                const buyerInfoSection = document.getElementById('buyerInfoSection');
                if (buyerInfoSection) buyerInfoSection.style.display = 'block';
            }
        });
    }
    
    // Handle vehicle selection change - show buyer email section if no transfer request
    if (vehicleSelect) {
        vehicleSelect.addEventListener('change', function() {
            const transferRequestId = document.getElementById('transferRequestSelect')?.value;
            const buyerInfoSection = document.getElementById('buyerInfoSection');
            if (buyerInfoSection) {
                // Show buyer email section only if vehicle is selected AND no transfer request is selected
                buyerInfoSection.style.display = (this.value && !transferRequestId) ? 'block' : 'none';
            }
        });
    }
    
    // Buyer email lookup on blur
    const buyerEmailInput = document.getElementById('buyerEmail');
    if (buyerEmailInput) {
        buyerEmailInput.addEventListener('blur', async function() {
            await lookupBuyer(this.value.trim());
        });
    }
    
    // Handle form submission
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            await generateCertificates();
        });
    }
}

// Load vehicle context for autofill
async function loadVehicleContext(vehicleId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/certificate-generation/transfer/vehicle/${vehicleId}`);
        
        if (response.success && response.vehicle) {
            transferContext = {
                vehicle: response.vehicle,
                seller: response.vehicle.owner || null,
                buyer: null // Buyer info must be provided manually
            };
            displayAutofillPreview(transferContext);
            
            // Show buyer email section if no transfer request is selected
            const transferRequestId = document.getElementById('transferRequestSelect')?.value;
            const buyerInfoSection = document.getElementById('buyerInfoSection');
            if (buyerInfoSection && !transferRequestId) {
                buyerInfoSection.style.display = 'block';
            }
        } else {
            showError('Failed to load vehicle context');
        }
    } catch (error) {
        console.error('Error loading vehicle context:', error);
        showError('Failed to load vehicle context: ' + error.message);
    }
}

// Buyer lookup function (similar to registration certificate generator)
async function lookupBuyer(email) {
    if (!email) {
        // Hide previews if email is empty
        document.getElementById('buyerPreview').style.display = 'none';
        document.getElementById('buyerError').style.display = 'none';
        return;
    }
    
    const previewDiv = document.getElementById('buyerPreview');
    const detailsDiv = document.getElementById('buyerDetails');
    const errorDiv = document.getElementById('buyerError');
    
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/auth/users/lookup?email=${encodeURIComponent(email)}`);
        
        if (response.success && response.user) {
            // Show buyer details
            const user = response.user;
            const buyerName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
            detailsDiv.innerHTML = `
                <div><strong>Name:</strong> ${buyerName}</div>
                <div><strong>Email:</strong> ${user.email}</div>
                ${user.address ? `<div><strong>Address:</strong> ${user.address}</div>` : ''}
                ${user.phone ? `<div><strong>Phone:</strong> ${user.phone}</div>` : ''}
            `;
            previewDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            
            // Update transfer context with buyer info
            if (!transferContext) transferContext = {};
            transferContext.buyer = {
                id: user.id,
                email: user.email,
                name: buyerName,
                first_name: user.first_name,
                last_name: user.last_name,
                address: user.address,
                phone: user.phone
            };
            displayAutofillPreview(transferContext);
        } else {
            throw new Error(response.error || 'Buyer not found');
        }
    } catch (error) {
        console.error('Buyer lookup error:', error);
        
        // Check if error is due to HTML response (API returning error page instead of JSON)
        let errorMessage = error.message || 'Buyer not found. User must be registered in the system.';
        if (error.message && (error.message.includes('Unexpected token') || error.message.includes('<!DOCTYPE'))) {
            errorMessage = 'API endpoint returned an error page. Please check your authentication and try again.';
        } else if (error.message && error.message.includes('JSON')) {
            errorMessage = 'Invalid response from server. Please check your connection and try again.';
        } else if (error.message && error.message.includes('404')) {
            errorMessage = 'Buyer lookup endpoint not found. Please contact support.';
        } else if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
            errorMessage = 'You do not have permission to lookup users. Please contact an administrator.';
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
        previewDiv.style.display = 'none';
    }
}

// Load transfer context for autofill
async function loadTransferContext(transferRequestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/certificate-generation/transfer/context/${transferRequestId}`);
        
        if (response.success && response.context) {
            // Hide buyer email section when transfer request is selected
            const buyerInfoSection = document.getElementById('buyerInfoSection');
            if (buyerInfoSection) buyerInfoSection.style.display = 'none';
            transferContext = response.context;
            displayAutofillPreview(response.context);
        } else {
            showError('Failed to load transfer context');
        }
    } catch (error) {
        console.error('Error loading transfer context:', error);
        
        // Check if error is due to HTML response (API returning error page instead of JSON)
        let errorMessage = error.message || 'Failed to load transfer context';
        if (error.message && error.message.includes('Unexpected token') && error.message.includes('<!DOCTYPE')) {
            errorMessage = 'API endpoint returned an error page. Please check your authentication and try again.';
        } else if (error.message && error.message.includes('JSON')) {
            errorMessage = 'Invalid response from server. Please check your connection and try again.';
        }
        
        showError('Failed to load transfer context: ' + errorMessage);
    }
}

// Display autofill preview
function displayAutofillPreview(context) {
    const previewDiv = document.getElementById('autofillPreview');
    const previewContent = document.getElementById('previewContent');
    
    const vehicle = context.vehicle;
    const seller = context.seller || (context.vehicle && context.vehicle.owner);
    const buyer = context.buyer;
    
    let previewHtml = `
        <div class="preview-row">
            <span class="preview-label">Vehicle:</span>
            <span class="preview-value">${vehicle.plateNumber || vehicle.vin || 'N/A'} - ${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.year || ''})</span>
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
            <span class="preview-label">OR Number:</span>
            <span class="preview-value">${vehicle.orNumber || 'N/A'}</span>
        </div>
        <div class="preview-row">
            <span class="preview-label">CR Number:</span>
            <span class="preview-value">${vehicle.crNumber || 'N/A'}</span>
        </div>
    `;
    
    if (seller) {
        previewHtml += `
        <div class="preview-row">
            <span class="preview-label">Seller:</span>
            <span class="preview-value">${seller.name || seller.email || 'N/A'} (${seller.email || 'N/A'})</span>
        </div>
        `;
    }
    
    if (buyer) {
        previewHtml += `
        <div class="preview-row">
            <span class="preview-label">Buyer:</span>
            <span class="preview-value">${buyer.name || buyer.email || 'N/A'} (${buyer.email || 'N/A'})</span>
        </div>
        `;
    } else {
        previewHtml += `
        <div class="preview-row">
            <span class="preview-label">Buyer:</span>
            <span class="preview-value" style="color: #f39c12;">Please provide buyer information in the form below</span>
        </div>
        `;
    }
    
    previewContent.innerHTML = previewHtml;
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
        // Validate vehicle selection (required)
        const vehicleId = document.getElementById('vehicleSelect')?.value;
        if (!vehicleId) {
            showError('Please select a registered vehicle');
            return;
        }
        
        // Transfer request is optional
        const transferRequestId = document.getElementById('transferRequestSelect')?.value || null;
        
        if (!transferContext || !transferContext.vehicle) {
            showError('Please wait for vehicle context to load');
            return;
        }
        
        // Show loading
        if (loadingOverlay) loadingOverlay.classList.add('show');
        if (statusDiv) {
            statusDiv.classList.remove('show');
            statusDiv.innerHTML = '';
        }
        
        // Collect form data
        const buyerEmail = document.getElementById('buyerEmail')?.value.trim();
        
        // Validate buyer email if no transfer request is selected (standalone mode)
        if (!transferRequestId && !buyerEmail) {
            showError('Buyer email is required when no transfer request is selected');
            return;
        }
        
        // Check if buyer was validated (preview should be visible) when in standalone mode
        if (!transferRequestId) {
            const buyerPreview = document.getElementById('buyerPreview');
            if (!buyerPreview || buyerPreview.style.display === 'none') {
                showError('Please verify buyer email first. Buyer must be registered in the system.');
                return;
            }
        }
        
        const formData = {
            vehicleId: vehicleId,  // Required
            transferRequestId: transferRequestId || null,  // Optional
            sellerDocuments: {
                deedOfSale: {
                    purchasePrice: document.getElementById('purchasePrice').value,
                    saleDate: document.getElementById('saleDate').value || new Date().toISOString(),
                    odometerReading: document.getElementById('odometerReading').value,
                    notaryName: document.getElementById('notaryName').value,
                    notaryCommission: document.getElementById('notaryCommission').value
                }
                // Seller ID removed: IDs should not be generated as certificates
                // IDs (Owner ID, Seller ID, Buyer ID) require no backend validation and should only be uploaded
                // sellerId: { ... } // REMOVED - IDs are upload-only, not generated
            },
            buyerDocuments: {
                // Include buyer email/ID for standalone generation (when no transfer request)
                ...(buyerEmail && !transferRequestId ? { email: buyerEmail } : {}),
                // Buyer ID removed: IDs should not be generated as certificates
                // IDs (Owner ID, Seller ID, Buyer ID) require no backend validation and should only be uploaded
                // buyerId: { ... } // REMOVED - IDs are upload-only, not generated
                // Buyer TIN removed: TIN is not required for certificate generation
                // buyerTin: { ... } // REMOVED - TIN is not generated as a certificate
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
        
        // Check if error is due to HTML response (API returning error page instead of JSON)
        let errorMessage = error.message || 'Failed to generate certificates';
        if (error.message && error.message.includes('Unexpected token') && error.message.includes('<!DOCTYPE')) {
            errorMessage = 'API endpoint returned an error page. Please check your authentication and try again. If the problem persists, contact support.';
        } else if (error.message && error.message.includes('JSON')) {
            errorMessage = 'Invalid response from server. Please check your connection and try again.';
        }
        
        showError('Failed to generate certificates: ' + errorMessage);
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
            // Seller ID removed: IDs are upload-only, not generated
            html += '</ul>';
        }
        
        if (response.results.buyerDocuments) {
            html += '<h5>Buyer Documents:</h5><ul>';
            // Buyer ID removed: IDs are upload-only, not generated
            // Buyer TIN removed: TIN is not generated as a certificate
            // if (response.results.buyerDocuments.buyerTin) html += '<li>TIN Document ✓</li>'; // REMOVED
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
