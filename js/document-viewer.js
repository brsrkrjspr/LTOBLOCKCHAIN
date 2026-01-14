// Document Viewer JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeDocumentViewer();
});

// Go back to the appropriate dashboard based on user role
function goBack() {
    // First check if user is still authenticated
    if (typeof AuthUtils !== 'undefined') {
        if (!AuthUtils.isAuthenticated()) {
            // User is not authenticated, redirect to login
            console.warn('Session expired or user logged out - redirecting to login');
            localStorage.clear();
            window.location.href = 'login-signup.html?expired=true';
            return;
        }
    } else {
        // AuthUtils not available, check token manually
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
        if (!token || token === 'dev-token-bypass' || token.startsWith('demo-token-')) {
            // No valid token, redirect to login
            localStorage.clear();
            window.location.href = 'login-signup.html';
            return;
        }
        
        // Verify token is valid JWT and not expired
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                    // Token expired
                    localStorage.clear();
                    window.location.href = 'login-signup.html?expired=true';
                    return;
                }
            }
        } catch (e) {
            // Invalid token format
            localStorage.clear();
            window.location.href = 'login-signup.html';
            return;
        }
    }
    
    // User is authenticated, proceed with role-based redirect
    try {
        // Try to decode JWT to get user role
        const user = typeof AuthUtils !== 'undefined' ? AuthUtils.getCurrentUser() : null;
        
        if (user && user.role) {
            switch (user.role) {
                case 'admin':
                    window.location.href = 'admin-dashboard.html';
                    return;
                case 'vehicle_owner':
                    window.location.href = 'owner-dashboard.html';
                    return;
                case 'insurance_verifier':
                    window.location.href = 'insurance-verifier-dashboard.html';
                    return;
                case 'emission_verifier':
                    window.location.href = 'emission-verifier-dashboard.html';
                    return;
                case 'hpg_admin':
                    window.location.href = 'hpg-dashboard.html';
                    return;
            }
        }
    } catch (e) {
        console.error('Error getting user role:', e);
    }
    
    // Fallback: use browser history or go to index
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = 'index.html';
    }
}

// Make goBack available globally
window.goBack = goBack;

function initializeDocumentViewer() {
    // Initialize document viewer functionality
    loadDocumentData();
    initializeDocumentActions();
    initializeQRCode();
    initializeAuditTrail();
}

async function loadDocumentData() {
    try {
        // Get parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const documentId = urlParams.get('documentId');
        const vehicleId = urlParams.get('vehicleId');
        const vin = urlParams.get('vin');
        const type = urlParams.get('type') || 'registration';
        const appId = urlParams.get('appId');
        const filename = urlParams.get('filename') || 'document.pdf';
        
        showLoadingState();
        
        // Try to load from API first
        if (documentId && typeof APIClient !== 'undefined') {
            try {
                const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
                if (!token) {
                    throw new Error('Not authenticated');
                }
                
                const response = await fetch(`/api/documents/${documentId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.document) {
                        // Load vehicle data
                        let vehicle = null;
                        if (data.document.vehicleId) {
                            const vehicleResponse = await fetch(`/api/vehicles/id/${data.document.vehicleId}`, {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            if (vehicleResponse.ok) {
                                const vehicleData = await vehicleResponse.json();
                                vehicle = vehicleData.vehicle || vehicleData;
                            }
                        }
                        
                        hideLoadingState();
                        displayDocumentFromAPI(data.document, vehicle, type);
                        return;
                    }
                }
            } catch (apiError) {
                console.warn('API load failed, trying localStorage:', apiError);
            }
        }
        
        // Try to load vehicle by VIN or vehicleId
        if (vin || vehicleId) {
            try {
                const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
                if (token) {
                    let vehicleResponse;
                    if (vin) {
                        vehicleResponse = await fetch(`/api/vehicles/${vin}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                    } else if (vehicleId) {
                        // Check if vehicleId is UUID format (has hyphens) or VIN format
                        const isUUID = vehicleId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                        const vehicleUrl = isUUID ? `/api/vehicles/id/${vehicleId}` : `/api/vehicles/${vehicleId}`;
                        vehicleResponse = await fetch(vehicleUrl, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                    }
                    
                    if (vehicleResponse && vehicleResponse.ok) {
                        const vehicleData = await vehicleResponse.json();
                        if (vehicleData.success && vehicleData.vehicle) {
                            const vehicle = vehicleData.vehicle;
                            // Get documents for this vehicle
                            const documents = vehicle.documents || [];
                            
                            // Always show document selector if multiple documents exist
                            if (documents.length > 1) {
                                hideLoadingState();
                                displayMultipleDocuments(documents, vehicle, type);
                                return;
                            }
                            
                            // If only one document, find specific document by type or use first
                            const doc = documents.find(d => 
                                d.documentType === type || 
                                d.document_type === type ||
                                (type === 'registration' && (d.documentType === 'registration_cert' || d.document_type === 'registration_cert')) ||
                                (type === 'insurance' && (d.documentType === 'insurance_cert' || d.document_type === 'insurance_cert')) ||
                                (type === 'emission' && (d.documentType === 'emission_cert' || d.document_type === 'emission_cert')) ||
                                (type === 'ownerId' && (d.documentType === 'owner_id' || d.document_type === 'owner_id'))
                            ) || documents[0];
                            
                            if (doc) {
                                hideLoadingState();
                                displayDocumentFromAPI(doc, vehicle, type);
                                return;
                            } else if (documents.length > 0) {
                                // Use first document if type doesn't match
                                hideLoadingState();
                                displayDocumentFromAPI(documents[0], vehicle, type);
                                return;
                            } else {
                                // No documents available - show message instead of trying to display
                                hideLoadingState();
                                showNoDocumentsState(vehicle, type, filename);
                                return;
                            }
                        }
                    }
                }
            } catch (vehicleError) {
                console.warn('Vehicle load failed:', vehicleError);
            }
        }
        
        // Fallback to localStorage
        const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
        const application = appId ? applications.find(app => app.id === appId) : null;
        
        if (application) {
            updateDocumentHeader(application, type, filename);
            updateDocumentDetails(application, type, filename);
            hideLoadingState();
            displayDocumentPreview(application, type, filename);
        } else {
            hideLoadingState();
            showErrorState('Document not found. Please ensure you are logged in and the document exists. Try accessing from the owner dashboard.');
        }
    } catch (error) {
        console.error('Error loading document data:', error);
        hideLoadingState();
        showErrorState('Failed to load document: ' + error.message);
    }
}

function updateDocumentHeader(application, type, filename) {
    const title = document.getElementById('documentTitle');
    const info = document.getElementById('documentInfo');
    
    if (title) {
        const typeNames = {
            'insurance': 'Insurance Certificate',
            'registration': 'Registration Certificate',
            'emission': 'Emission Certificate',
            'owner': 'Owner ID Document'
        };
        title.textContent = typeNames[type] || 'Document Viewer';
    }
    
    if (info) {
        info.textContent = `Application ID: ${application.id} | Vehicle: ${application.vehicle.make} ${application.vehicle.model} ${application.vehicle.year}`;
    }
}

function updateDocumentDetails(application, type, filename) {
    document.getElementById('documentFilename').textContent = filename;
    document.getElementById('documentType').textContent = type.toUpperCase();
    document.getElementById('applicationId').textContent = application.id;
    document.getElementById('uploadDate').textContent = new Date(application.submittedDate).toLocaleDateString();
}

function displayDocumentFromAPI(doc, vehicle, type) {
    const previewArea = document.getElementById('documentPreview');
    const title = document.getElementById('documentTitle');
    const info = document.getElementById('documentInfo');
    
    if (!previewArea) return;
    
    // Ensure document has required fields - validate document structure
    if (!doc) {
        showErrorState('Document information is missing. Please try again.');
        return;
    }
    
    // Ensure document has an ID or filename for retrieval
    if (!doc.id && !doc.filename) {
        console.warn('Document missing both id and filename:', doc);
        showErrorState('Document information is incomplete. Please contact support.');
        return;
    }
    
    const typeIcons = {
        'insurance': '🛡️',
        'registration': '📄',
        'emission': '🌱',
        'owner': '🆔',
        'insurance_cert': '🛡️',
        'registration_cert': '📄',
        'emission_cert': '🌱',
        'owner_id': '🆔'
    };
    
    const typeTitles = {
        'insurance': 'Insurance Certificate',
        'registration': 'Official Receipt & Certificate of Registration',
        'emission': 'Emission Test Certificate',
        'owner': 'Owner Identification Document',
        'insurance_cert': 'Insurance Certificate',
        'registration_cert': 'Official Receipt & Certificate of Registration',
        'emission_cert': 'Emission Test Certificate',
        'owner_id': 'Owner Identification Document'
    };
    
    const docType = doc.documentType || doc.document_type || type;
    const docIcon = typeIcons[docType] || '📄';
    const docTitle = typeTitles[docType] || 'Document';
    
    // Update header
    if (title) {
        title.textContent = docTitle;
    }
    
    if (info && vehicle) {
        info.textContent = `Vehicle: ${vehicle.make} ${vehicle.model} ${vehicle.year} | VIN: ${vehicle.vin}`;
    }
    
    // Update details
    const filenameEl = document.getElementById('documentFilename');
    const typeEl = document.getElementById('documentType');
    const appIdEl = document.getElementById('applicationId');
    const uploadDateEl = document.getElementById('uploadDate');
    
    if (filenameEl) filenameEl.textContent = doc.originalName || doc.original_name || doc.filename || 'document.pdf';
    if (typeEl) typeEl.textContent = (docType || type).toUpperCase().replace('_', ' ');
    if (appIdEl) appIdEl.textContent = doc.id || vehicle?.id || 'N/A';
    if (uploadDateEl) {
        const uploadDate = doc.uploadedAt || doc.uploaded_at || doc.created_at;
        uploadDateEl.textContent = uploadDate ? new Date(uploadDate).toLocaleDateString() : 'N/A';
    }
    
    // Get MIME type for image detection
    const mimeType = doc.mimeType || doc.mime_type || 
        (doc.filename || doc.original_name ? (() => {
            const filename = doc.filename || doc.original_name || '';
            const ext = filename.split('.').pop().toLowerCase();
            const mimeMap = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'pdf': 'application/pdf'
            };
            return mimeMap[ext] || 'application/octet-stream';
        })() : 'application/pdf');
    
    // Check if document is an image
    const isImage = mimeType && (
        mimeType.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.filename || doc.original_name || '')
    );
    
    // Build document URL - try multiple sources
    // IMPORTANT: Only use doc.id if it's actually a document ID (UUID format), not a vehicle/application ID
    // Check if doc.id is a valid document ID (UUID format) vs vehicle/application ID
    const isValidDocumentId = doc.id && 
        typeof doc.id === 'string' && 
        doc.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) &&
        !doc.id.startsWith('APP-'); // Application IDs start with APP-
    
    let documentUrl = null;
    let needsAuth = false;
    
    // Always use API endpoint for valid document IDs (handles both IPFS and local storage)
    if (isValidDocumentId) {
        documentUrl = `/api/documents/${doc.id}/view`;
        needsAuth = true;
    } else if (doc.url || doc.file_path) {
        // Fallback for documents without valid IDs
        documentUrl = doc.url || doc.file_path;
        needsAuth = doc.url && doc.url.startsWith('/api/');
    } else if (doc.filename) {
        // Last resort: try static file path
        documentUrl = `/uploads/${doc.filename}`;
        needsAuth = false;
    }
    
    // Display preview with actual document viewer
    // Check if document is an image and render accordingly
    if (isImage && documentUrl) {
        // For images, use <img> tag instead of iframe
        previewArea.innerHTML = `
            <div class="document-preview-content">
                <div class="document-header">
                    <div class="document-icon-large">${docIcon}</div>
                    <h4>${docTitle}</h4>
                </div>
                <div class="document-viewer-container">
                    <div class="image-viewer-container" style="text-align: center; padding: 20px;">
                        ${needsAuth && isValidDocumentId ? `
                            <img id="document-image" src="" alt="${docTitle}" style="max-width: 100%; max-height: 80vh; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                            <div class="loading-spinner" style="margin: 20px auto;"></div>
                            <p>Loading image...</p>
                        ` : `
                            <img src="${documentUrl}" alt="${docTitle}" style="max-width: 100%; max-height: 80vh; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onerror="handleImageError(this)" />
                        `}
                    </div>
                </div>
                <div class="document-fields">
                ${vehicle ? `
                <div class="field-row">
                    <span class="field-label">Vehicle:</span>
                    <span class="field-value">${vehicle.make} ${vehicle.model} ${vehicle.year}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Plate Number:</span>
                    <span class="field-value">${vehicle.plate_number || vehicle.plateNumber || 'N/A'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">VIN:</span>
                    <span class="field-value">${vehicle.vin || 'N/A'}</span>
                </div>
                ` : ''}
                <div class="field-row">
                    <span class="field-label">Document:</span>
                    <span class="field-value">${doc.originalName || doc.original_name || doc.filename || 'document.pdf'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Upload Date:</span>
                    <span class="field-value">${doc.uploadedAt || doc.uploaded_at ? new Date(doc.uploadedAt || doc.uploaded_at).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">File Size:</span>
                    <span class="field-value">${doc.fileSize || doc.file_size ? ((doc.fileSize || doc.file_size) / 1024).toFixed(2) + ' KB' : 'N/A'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Status:</span>
                    <span class="field-value">${doc.verified ? '✅ Verified' : '⏳ Pending Verification'}</span>
                </div>
                ${doc.ipfs_cid || doc.cid ? `
                <div class="field-row">
                    <span class="field-label">IPFS CID:</span>
                    <span class="field-value"><code>${doc.ipfs_cid || doc.cid}</code></span>
                </div>
                ` : ''}
            </div>
            <div class="document-status">
                <div class="status-indicator">
                    <span class="status-icon">${doc.verified ? '✅' : '⏳'}</span>
                    <span class="status-text">${doc.verified ? 'Document Verified' : 'Pending Verification'}</span>
                </div>
            </div>
            ${documentUrl ? `
            <div class="document-actions-preview">
                <button class="btn-primary" onclick="viewFullDocument('${doc.id || documentId}', '${documentUrl}')">View Full Document</button>
                <button class="btn-secondary" onclick="downloadDocument()">Download</button>
            </div>
            ` : ''}
        </div>
        `;
        
        // If needs auth, load image via blob URL using API endpoint
        if (needsAuth && isValidDocumentId && isImage) {
            // Use API endpoint instead of direct URL
            const apiUrl = `/api/documents/${doc.id}/view`;
            loadImageInViewer(doc.id, apiUrl);
        }
    } else {
        // For PDFs and other documents, use iframe
        previewArea.innerHTML = `
            <div class="document-preview-content">
                <div class="document-header">
                    <div class="document-icon-large">${docIcon}</div>
                    <h4>${docTitle}</h4>
                </div>
                ${documentUrl ? `
                <div class="document-viewer-container">
                    <div id="document-iframe-container" class="document-iframe-placeholder">
                        <div class="loading-spinner"></div>
                        <p>Loading document...</p>
                    </div>
                    <div class="document-fallback">
                        <p>If the document doesn't load, <a href="${documentUrl}" target="_blank" class="btn-primary" id="document-fallback-link">click here to open in new tab</a></p>
                    </div>
                </div>
                ` : ''}
            <div class="document-fields">
                ${vehicle ? `
                <div class="field-row">
                    <span class="field-label">Vehicle:</span>
                    <span class="field-value">${vehicle.make} ${vehicle.model} ${vehicle.year}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Plate Number:</span>
                    <span class="field-value">${vehicle.plate_number || vehicle.plateNumber || 'N/A'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">VIN:</span>
                    <span class="field-value">${vehicle.vin || 'N/A'}</span>
                </div>
                ` : ''}
                <div class="field-row">
                    <span class="field-label">Document:</span>
                    <span class="field-value">${doc.originalName || doc.original_name || doc.filename || 'document.pdf'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Upload Date:</span>
                    <span class="field-value">${doc.uploadedAt || doc.uploaded_at ? new Date(doc.uploadedAt || doc.uploaded_at).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">File Size:</span>
                    <span class="field-value">${doc.fileSize || doc.file_size ? ((doc.fileSize || doc.file_size) / 1024).toFixed(2) + ' KB' : 'N/A'}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Status:</span>
                    <span class="field-value">${doc.verified ? '✅ Verified' : '⏳ Pending Verification'}</span>
                </div>
                ${doc.ipfs_cid || doc.cid ? `
                <div class="field-row">
                    <span class="field-label">IPFS CID:</span>
                    <span class="field-value"><code>${doc.ipfs_cid || doc.cid}</code></span>
                </div>
                ` : ''}
            </div>
            <div class="document-status">
                <div class="status-indicator">
                    <span class="status-icon">${doc.verified ? '✅' : '⏳'}</span>
                    <span class="status-text">${doc.verified ? 'Document Verified' : 'Pending Verification'}</span>
                </div>
            </div>
            ${documentUrl ? `
            <div class="document-actions-preview">
                <button class="btn-primary" onclick="viewFullDocument('${doc.id || documentId}', '${documentUrl}')">View Full Document</button>
                <button class="btn-secondary" onclick="downloadDocument()">Download</button>
            </div>
            ` : ''}
        </div>
    `;
    
    // Store document ID for download function
    if (doc.id) {
        window.currentDocumentId = doc.id;
    }
    
    // Load document in iframe with authentication (only for non-images)
    if (!isImage) {
        // Only try to load if we have a valid document ID (not vehicle/application ID)
        // Note: isValidDocumentId was already declared above, so we reuse it here
        if (documentUrl && needsAuth && isValidDocumentId) {
            loadDocumentInIframe(doc.id, documentUrl);
        } else if (documentUrl && !needsAuth) {
            // For static files, load directly
            const container = document.getElementById('document-iframe-container');
            if (container) {
                container.innerHTML = `<iframe src="${documentUrl}" class="document-iframe" frameborder="0"></iframe>`;
            }
        } else {
            // No valid document URL available
            const container = document.getElementById('document-iframe-container');
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h4>Document Not Available</h4>
                        <p>Document file could not be located. This may happen if the document was not properly uploaded or linked to the vehicle.</p>
                        ${doc.id ? `<p style="font-size: 0.9em; color: #666; margin-top: 10px;">Document ID: ${doc.id}</p>` : ''}
                    </div>
                `;
            }
        }
    }
    }
}

// Load document in iframe with authentication
async function loadDocumentInIframe(documentId, documentUrl) {
    try {
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
        if (!token) {
            throw new Error('Not authenticated. Please log in to view documents.');
        }
        
        // Validate documentId
        if (!documentId || documentId === 'undefined' || documentId === 'null' || documentId === '') {
            throw new Error('Invalid document ID. The document may not be properly linked to the vehicle.');
        }
        
        // Fetch document with authentication
        const response = await fetch(documentUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 404) {
                throw new Error('Document not found. It may have been deleted or you may not have permission to view it.');
            } else if (response.status === 403) {
                throw new Error('Access denied. You do not have permission to view this document.');
            } else {
                throw new Error(errorData.error || `Failed to load document (Status: ${response.status})`);
            }
        }
        
        // For PDFs, use blob URL with iframe (CSP-friendly, avoids object-src issues)
        const container = document.getElementById('document-iframe-container');
        if (container) {
            try {
                // Fetch document as blob
                const blob = await response.blob();
                
                // Clean up previous blob URL if it exists
                if (window.currentDocumentBlobUrl) {
                    URL.revokeObjectURL(window.currentDocumentBlobUrl);
                    window.currentDocumentBlobUrl = null;
                }
                
                // Use blob URL with iframe (CSP-friendly, avoids object-src issues)
                const blobUrl = URL.createObjectURL(blob);
                window.currentDocumentBlobUrl = blobUrl; // Track for cleanup
                
                container.innerHTML = `
                    <iframe src="${blobUrl}" type="application/pdf" class="document-iframe" style="width: 100%; height: 800px; border: none;">
                        <p style="text-align: center; padding: 40px;">
                            Your browser does not support PDFs. 
                            <a href="${documentUrl}" target="_blank" class="btn-primary" style="margin-top: 15px; display: inline-block;">Click here to download</a>
                        </p>
                    </iframe>
                `;
                
                // Clean up blob URL when page unloads
                if (!window.documentViewerCleanupAdded) {
                    window.addEventListener('beforeunload', () => {
                        if (window.currentDocumentBlobUrl) {
                            URL.revokeObjectURL(window.currentDocumentBlobUrl);
                            window.currentDocumentBlobUrl = null;
                        }
                    });
                    window.documentViewerCleanupAdded = true;
                }
                
                // Update fallback link
                const fallbackLink = document.getElementById('document-fallback-link');
                if (fallbackLink) {
                    fallbackLink.href = documentUrl;
                    fallbackLink.target = '_blank';
                }
                
                // Update view link
                const viewLink = document.getElementById('document-view-link');
                if (viewLink) {
                    viewLink.href = documentUrl;
                    viewLink.target = '_blank';
                }
            } catch (error) {
                console.error('Error creating document viewer:', error);
                // Fallback: show download link
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p>Unable to display PDF in browser.</p>
                        <a href="${documentUrl}" target="_blank" class="btn-primary">Download PDF</a>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading document in iframe:', error);
        console.error('Document ID:', documentId);
        console.error('Document URL:', documentUrl);
        const container = document.getElementById('document-iframe-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <h4>Error Loading Document</h4>
                    <p>${error.message || 'Failed to load document. Please try again.'}</p>
                    <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                        Document ID: ${documentId || 'N/A'}<br>
                        If this problem persists, the document may not be properly linked to your vehicle registration.
                    </p>
                    <a href="${documentUrl}" target="_blank" class="btn-primary" style="margin-top: 15px;">Try Opening in New Tab</a>
                </div>
            `;
        }
    }
}

// Load image in viewer with authentication
async function loadImageInViewer(documentId, imageUrl) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
        showErrorState('Please log in to view documents');
        return;
    }

    try {
        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Image not found');
            } else if (response.status === 403) {
                throw new Error('Access denied');
            } else {
                throw new Error(`Failed to load image: ${response.statusText}`);
            }
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const img = document.getElementById('document-image');
        if (img) {
            img.src = blobUrl;
            img.onload = () => {
                // Remove loading spinner
                const spinner = img.parentElement.querySelector('.loading-spinner');
                const loadingText = img.parentElement.querySelector('p');
                if (spinner) spinner.remove();
                if (loadingText) loadingText.remove();
            };
            img.onerror = () => {
                img.parentElement.innerHTML = '<p style="color:red;">Failed to load image. Please try again.</p>';
            };
            
            // Clean up blob URL when page unloads
            window.addEventListener('beforeunload', () => {
                URL.revokeObjectURL(blobUrl);
            });
        }
    } catch (error) {
        console.error('Error loading image:', error);
        const img = document.getElementById('document-image');
        if (img && img.parentElement) {
            img.parentElement.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    }
}

// Helper function to handle image loading errors
function handleImageError(img) {
    if (img && img.parentElement) {
        img.parentElement.innerHTML = '<p style="color:red;">Failed to load image. Please try again.</p>';
    }
}

function displayDocumentPreview(application, type, filename) {
    const previewArea = document.getElementById('documentPreview');
    if (!previewArea) return;
    
    const typeIcons = {
        'insurance': '🛡️',
        'registration': '📄',
        'emission': '🌱',
        'owner': '🆔'
    };
    
    const typeTitles = {
        'insurance': 'Insurance Certificate',
        'registration': 'Official Receipt & Certificate of Registration',
        'emission': 'Emission Test Certificate',
        'owner': 'Owner Identification Document'
    };
    
    previewArea.innerHTML = `
        <div class="document-preview-content">
            <div class="document-header">
                <div class="document-icon-large">${typeIcons[type] || '📄'}</div>
                <h4>${typeTitles[type] || 'Document'}</h4>
            </div>
            <div class="document-fields">
                <div class="field-row">
                    <span class="field-label">Vehicle:</span>
                    <span class="field-value">${application.vehicle.make} ${application.vehicle.model} ${application.vehicle.year}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Plate Number:</span>
                    <span class="field-value">${application.vehicle.plateNumber}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Owner:</span>
                    <span class="field-value">${application.owner.firstName} ${application.owner.lastName}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Document:</span>
                    <span class="field-value">${filename}</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Upload Date:</span>
                    <span class="field-value">${new Date(application.submittedDate).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="document-status">
                <div class="status-indicator">
                    <span class="status-icon">✅</span>
                    <span class="status-text">Document Verified</span>
                </div>
            </div>
        </div>
    `;
}

function showErrorState(message) {
    const previewArea = document.getElementById('documentPreview');
    if (previewArea) {
        previewArea.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <h4>Error Loading Document</h4>
                <p>${message}</p>
                <button class="btn-primary" onclick="window.close()">Close</button>
            </div>
        `;
    }
}

function showNoDocumentsState(vehicle, type, filename) {
    const previewArea = document.getElementById('documentPreview');
    const title = document.getElementById('documentTitle');
    const info = document.getElementById('documentInfo');
    
    const typeTitles = {
        'insurance': 'Insurance Certificate',
        'registration': 'Official Receipt & Certificate of Registration',
        'emission': 'Emission Test Certificate',
        'owner': 'Owner Identification Document',
        'insurance_cert': 'Insurance Certificate',
        'registration_cert': 'Official Receipt & Certificate of Registration',
        'emission_cert': 'Emission Test Certificate',
        'owner_id': 'Owner Identification Document'
    };
    
    const docTitle = typeTitles[type] || 'Document';
    
    if (title) {
        title.textContent = docTitle;
    }
    
    if (info && vehicle) {
        info.textContent = `Vehicle: ${vehicle.make} ${vehicle.model} ${vehicle.year} | VIN: ${vehicle.vin}`;
    }
    
    // Update details
    const filenameEl = document.getElementById('documentFilename');
    const typeEl = document.getElementById('documentType');
    const appIdEl = document.getElementById('applicationId');
    const uploadDateEl = document.getElementById('uploadDate');
    
    if (filenameEl) filenameEl.textContent = filename || 'document.pdf';
    if (typeEl) typeEl.textContent = (type || 'REGISTRATION').toUpperCase().replace('_', ' ');
    if (appIdEl) appIdEl.textContent = vehicle?.id || 'N/A';
    if (uploadDateEl) {
        const uploadDate = vehicle?.registrationDate || vehicle?.registration_date || vehicle?.created_at;
        uploadDateEl.textContent = uploadDate ? new Date(uploadDate).toLocaleDateString() : 'N/A';
    }
    
    if (previewArea) {
        previewArea.innerHTML = `
            <div class="document-preview-content">
                <div class="document-header">
                    <div class="document-icon-large">📄</div>
                    <h4>${docTitle}</h4>
                </div>
                <div class="document-viewer-container">
                    <div id="document-iframe-container" class="document-iframe-placeholder">
                        <div class="error-state">
                            <div class="error-icon">⚠️</div>
                            <h4>Document Not Available</h4>
                            <p>This document was not uploaded during vehicle registration. Documents may have failed to upload due to storage service issues.</p>
                            <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                                You can upload documents later from your dashboard or contact support for assistance.
                            </p>
                        </div>
                    </div>
                </div>
                <div class="document-fields">
                    ${vehicle ? `
                    <div class="field-row">
                        <span class="field-label">Vehicle:</span>
                        <span class="field-value">${vehicle.make} ${vehicle.model} ${vehicle.year}</span>
                    </div>
                    <div class="field-row">
                        <span class="field-label">Plate Number:</span>
                        <span class="field-value">${vehicle.plate_number || vehicle.plateNumber || 'N/A'}</span>
                    </div>
                    <div class="field-row">
                        <span class="field-label">VIN:</span>
                        <span class="field-value">${vehicle.vin || 'N/A'}</span>
                    </div>
                    ` : ''}
                    <div class="field-row">
                        <span class="field-label">Document:</span>
                        <span class="field-value">${filename || 'document.pdf'}</span>
                    </div>
                    <div class="field-row">
                        <span class="field-label">Upload Date:</span>
                        <span class="field-value">N/A</span>
                    </div>
                    <div class="field-row">
                        <span class="field-label">File Size:</span>
                        <span class="field-value">N/A</span>
                    </div>
                    <div class="field-row">
                        <span class="field-label">Status:</span>
                        <span class="field-value">⚠️ Not Uploaded</span>
                    </div>
                </div>
                <div class="document-status">
                    <div class="status-indicator">
                        <span class="status-icon">⚠️</span>
                        <span class="status-text">Document Not Uploaded</span>
                    </div>
                </div>
            </div>
        `;
    }
}

function initializeDocumentActions() {
    // Actions are now handled by onclick attributes in HTML
}

// View full document in new window with authentication
async function viewFullDocument(documentId, documentUrl) {
    try {
        showNotification('Opening document...', 'info');
        
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
        if (!token) {
            showNotification('Please log in to view documents', 'error');
            return;
        }
        
        // Construct URL if not provided or if it's not an API endpoint
        let url = documentUrl;
        if (!url && documentId) {
            url = `/api/documents/${documentId}/view`;
        } else if (url && !url.startsWith('/api/') && documentId) {
            // If URL is not an API endpoint, use the API endpoint instead
            url = `/api/documents/${documentId}/view`;
        }
        
        if (!url) {
            throw new Error('Document URL or ID is required');
        }
        
        // Fetch document with authentication
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load document');
        }
        
        // Convert to blob and open in new window
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Open in new window
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow) {
            // If popup blocked, show notification
            showNotification('Please allow popups to view documents in a new window', 'warning');
            // Fallback: download instead
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'document.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showNotification('Document downloaded instead (popup blocked)', 'info');
        } else {
            showNotification('Document opened in new window', 'success');
        }
        
        // Clean up blob URL after a delay
        setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
        }, 1000);
        
    } catch (error) {
        console.error('View full document error:', error);
        showNotification('Failed to open document: ' + (error.message || 'Please try again.'), 'error');
    }
}

async function downloadDocument() {
    try {
        showNotification('Preparing document download...', 'info');
        
        // Get document ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const documentId = urlParams.get('documentId');
        
        if (documentId) {
            // Download from API
            const token = (typeof window !== 'undefined' && window.authManager) 
                ? window.authManager.getAccessToken() 
                : (localStorage.getItem('authToken') || localStorage.getItem('token'));
            if (!token) {
                showNotification('Please log in to download documents', 'error');
                return;
            }
            
            try {
                const response = await fetch(`/api/documents/${documentId}/download`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    // Get filename from Content-Disposition header or use default
                    const contentDisposition = response.headers.get('Content-Disposition');
                    let filename = 'document.pdf';
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                        if (filenameMatch) {
                            filename = filenameMatch[1];
                        }
                    }
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    showNotification('Document downloaded successfully!', 'success');
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to download document');
                }
            } catch (fetchError) {
                console.error('Download fetch error:', fetchError);
                throw fetchError;
            }
        } else {
            // Fallback: simulate download if no documentId
            showNotification('Document downloaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to download document: ' + (error.message || 'Please try again.'), 'error');
    }
}

function printDocument() {
    showNotification('Opening print dialog...', 'info');
    
    // Simulate print functionality
    setTimeout(() => {
        window.print();
    }, 500);
}

function verifyDocument() {
    showNotification('Verifying document authenticity...', 'info');
    
    // Simulate document verification
    setTimeout(() => {
        showNotification('Document verified successfully! ✅', 'success');
        
        // Update QR section with verification result
        const qrSection = document.querySelector('.qr-section');
        if (qrSection) {
            qrSection.innerHTML = `
                <h3>Document Verification</h3>
                <div class="qr-placeholder verified">✅ VERIFIED</div>
                <div class="verification-result">
                    <p><strong>Status:</strong> Authentic</p>
                    <p><strong>Verified:</strong> ${new Date().toLocaleString()}</p>
                </div>
            `;
        }
    }, 2000);
}

function initializeQRCode() {
    // QR code functionality is now handled by verifyDocument function
}

function initializeAuditTrail() {
    // Add real-time audit trail updates
    addAuditTrailEntry();
}

function addAuditTrailEntry() {
    const timeline = document.querySelector('.timeline');
    if (!timeline) return;
    
    // Add new audit entry every 30 seconds
    setInterval(() => {
        const newEntry = createAuditEntry();
        timeline.appendChild(newEntry);
        
        // Remove oldest entry if more than 5
        if (timeline.children.length > 5) {
            timeline.removeChild(timeline.firstChild);
        }
    }, 30000);
}

function createAuditEntry() {
    const events = [
        { icon: '👁️', title: 'Document Viewed', description: 'Document accessed by user', time: new Date().toLocaleString() },
        { icon: '📱', title: 'QR Code Scanned', description: 'QR code verification performed', time: new Date().toLocaleString() },
        { icon: '💾', title: 'Document Downloaded', description: 'PDF copy downloaded', time: new Date().toLocaleString() }
    ];
    
    const randomEvent = events[Math.floor(Math.random() * events.length)];
    
    const entry = document.createElement('div');
    entry.className = 'timeline-item';
    entry.innerHTML = `
        <div class="timeline-icon">${randomEvent.icon}</div>
        <div class="timeline-content">
            <h4>${randomEvent.title}</h4>
            <p>${randomEvent.description}</p>
            <small>${randomEvent.time}</small>
        </div>
    `;
    
    return entry;
}

function showLoadingState() {
    const previewArea = document.querySelector('.placeholder-box');
    if (previewArea) {
        previewArea.innerHTML = '<div class="loading-spinner"></div> Loading document...';
    }
}

function hideLoadingState() {
    // Loading state will be replaced by displayDocumentPreview
}

function showNotification(message, type = 'info') {
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, type);
    } else {
        // Fallback if utils.js not loaded
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 4000);
    }
}

// Export functions - create aliases for HTML onclick handlers
function handleDownloadPDF() {
    downloadDocument();
}

function handlePrint() {
    printDocument();
}

function handleQRVerification() {
    verifyDocument();
}

// Display multiple documents with selector
function displayMultipleDocuments(documents, vehicle, selectedType) {
    const previewArea = document.getElementById('documentPreview');
    const title = document.getElementById('documentTitle');
    const info = document.getElementById('documentInfo');
    
    if (!previewArea) return;
    
    // Find selected document or use first one
    const selectedDoc = documents.find(d => 
        (d.documentType === selectedType || d.document_type === selectedType) ||
        (selectedType === 'registration' && (d.documentType === 'registration_cert' || d.document_type === 'registration_cert'))
    ) || documents[0];
    
    // Update header
    if (title) {
        title.textContent = `Document Viewer - ${documents.length} Documents Available`;
    }
    
    if (info && vehicle) {
        info.textContent = `Vehicle: ${vehicle.make} ${vehicle.model} ${vehicle.year} | VIN: ${vehicle.vin}`;
    }
    
    // Create document selector and viewer
    previewArea.innerHTML = `
        <div class="document-preview-content">
            <div class="document-selector">
                <h4>Select Document to View:</h4>
                <div class="document-list">
                    ${documents.map((doc, index) => {
                        const docType = doc.documentType || doc.document_type || 'document';
                        const typeNames = {
                            'registration_cert': 'Registration Certificate',
                            'insurance_cert': 'Insurance Certificate',
                            'emission_cert': 'Emission Certificate',
                            'owner_id': 'Owner ID'
                        };
                        const isSelected = doc.id === selectedDoc.id;
                        return `
                            <div class="document-item ${isSelected ? 'selected' : ''}" onclick="selectDocument('${doc.id}', '${vehicle.vin || vehicle.id}')">
                                <span class="doc-icon">${docType.includes('insurance') ? '🛡️' : docType.includes('emission') ? '🌱' : docType.includes('owner') ? '🆔' : '📄'}</span>
                                <span class="doc-name">${typeNames[docType] || docType}</span>
                                <span class="doc-filename">${doc.originalName || doc.original_name || doc.filename || 'document.pdf'}</span>
                                ${isSelected ? '<span class="doc-selected">✓</span>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="document-viewer-section">
                ${selectedDoc ? (() => {
                    displayDocumentFromAPI(selectedDoc, vehicle, selectedDoc.documentType || selectedDoc.document_type || selectedType);
                    return '<div id="selectedDocumentView"></div>';
                })() : ''}
            </div>
        </div>
    `;
    
    // Display selected document
    if (selectedDoc) {
        const viewerSection = previewArea.querySelector('.document-viewer-section');
        if (viewerSection) {
            const tempDiv = document.createElement('div');
            tempDiv.id = 'tempDocumentView';
            viewerSection.appendChild(tempDiv);
            displayDocumentFromAPI(selectedDoc, vehicle, selectedDoc.documentType || selectedDoc.document_type || selectedType);
        }
    }
}

// Select document function
window.selectDocument = function(documentId, vehicleId) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
        showNotification('Please log in to view documents', 'error');
        return;
    }
    
    // Reload page with selected document
    window.location.href = `document-viewer.html?documentId=${documentId}&vehicleId=${vehicleId}`;
};

// Export functions
window.DocumentViewer = {
    loadDocumentData,
    downloadDocument,
    viewFullDocument,
    printDocument,
    verifyDocument,
    handleDownloadPDF,
    handlePrint,
    handleQRVerification,
    showNotification,
    displayMultipleDocuments,
    selectDocument
};

// Make functions available globally for onclick handlers
window.viewFullDocument = viewFullDocument;
window.downloadDocument = downloadDocument;
