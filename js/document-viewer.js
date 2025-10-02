// Document Viewer JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeDocumentViewer();
});

function initializeDocumentViewer() {
    // Initialize document viewer functionality
    loadDocumentData();
    initializeDocumentActions();
    initializeQRCode();
    initializeAuditTrail();
}

function loadDocumentData() {
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'registration';
    const appId = urlParams.get('appId') || 'APP-2024-001';
    const filename = urlParams.get('filename') || 'document.pdf';
    
    // Load application data from localStorage
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const application = applications.find(app => app.id === appId);
    
    if (application) {
        updateDocumentHeader(application, type, filename);
        updateDocumentDetails(application, type, filename);
        showLoadingState();
        
        setTimeout(() => {
            hideLoadingState();
            displayDocumentPreview(application, type, filename);
        }, 1500);
    } else {
        showErrorState('Application not found');
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

function initializeDocumentActions() {
    // Actions are now handled by onclick attributes in HTML
}

function downloadDocument() {
    showNotification('Preparing document download...', 'info');
    
    // Simulate document download
    setTimeout(() => {
        showNotification('Document downloaded successfully!', 'success');
        // In a real app, this would trigger actual document download
    }, 2000);
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

// Export functions
window.DocumentViewer = {
    loadDocumentData,
    handleDownloadPDF,
    handlePrint,
    handleQRVerification,
    showNotification
};
