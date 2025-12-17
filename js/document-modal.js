// TrustChain LTO - Universal Document Viewing Modal
// Works across all pages: Owner, Admin, HPG, Insurance, Emission

(function() {
    'use strict';
    
    // Create modal container once
    let modalContainer = null;
    let currentDocuments = [];
    let currentDocIndex = 0;
    
    // Initialize modal container
    function initModal() {
        if (modalContainer) return;
        
        modalContainer = document.createElement('div');
        modalContainer.id = 'documentViewerModal';
        modalContainer.className = 'doc-viewer-modal';
        modalContainer.innerHTML = `
            <div class="doc-viewer-overlay" onclick="DocumentModal.close()"></div>
            <div class="doc-viewer-content">
                <div class="doc-viewer-header">
                    <div class="doc-viewer-title">
                        <i class="fas fa-file-alt"></i>
                        <span id="docViewerTitle">Document Viewer</span>
                    </div>
                    <div class="doc-viewer-nav" id="docViewerNav" style="display: none;">
                        <button class="doc-nav-btn" onclick="DocumentModal.prev()" title="Previous">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span id="docViewerCounter">1 / 1</span>
                        <button class="doc-nav-btn" onclick="DocumentModal.next()" title="Next">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="doc-viewer-actions">
                        <button class="doc-action-btn" onclick="DocumentModal.download()" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="doc-action-btn" onclick="DocumentModal.openInNewTab()" title="Open in New Tab">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                        <button class="doc-action-btn doc-close-btn" onclick="DocumentModal.close()" title="Close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="doc-viewer-body">
                    <div class="doc-viewer-loading" id="docViewerLoading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading document...</span>
                    </div>
                    <div class="doc-viewer-error" id="docViewerError" style="display: none;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span id="docViewerErrorMsg">Failed to load document</span>
                        <button class="btn-retry" onclick="DocumentModal.retry()">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    </div>
                    <div class="doc-viewer-frame" id="docViewerFrame" style="display: none;">
                        <!-- Document will be loaded here -->
                    </div>
                </div>
                <div class="doc-viewer-sidebar" id="docViewerSidebar">
                    <div class="doc-sidebar-header">
                        <h4><i class="fas fa-list"></i> All Documents</h4>
                        <button class="sidebar-toggle-btn" onclick="DocumentModal.toggleSidebar()">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="doc-sidebar-list" id="docSidebarList">
                        <!-- Document list will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .doc-viewer-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .doc-viewer-modal.active {
                display: flex;
                animation: docModalFadeIn 0.3s ease;
            }
            @keyframes docModalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .doc-viewer-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
            }
            .doc-viewer-content {
                position: relative;
                width: 95%;
                max-width: 1400px;
                height: 90%;
                margin: auto;
                background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.1);
                animation: docModalSlideUp 0.3s ease;
            }
            @keyframes docModalSlideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .doc-viewer-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1.25rem 1.5rem;
                background: rgba(0,0,0,0.3);
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .doc-viewer-title {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                color: #fff;
                font-size: 1.15rem;
                font-weight: 600;
                max-width: 300px;
            }
            .doc-viewer-title i {
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
            }
            .doc-viewer-title span {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .doc-viewer-nav {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                color: #fff;
                background: rgba(255,255,255,0.05);
                padding: 0.5rem 1rem;
                border-radius: 12px;
            }
            .doc-nav-btn {
                background: rgba(255,255,255,0.1);
                border: none;
                color: #fff;
                width: 36px;
                height: 36px;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 0.9rem;
            }
            .doc-nav-btn:hover {
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                transform: scale(1.05);
            }
            #docViewerCounter {
                font-weight: 600;
                font-size: 0.9rem;
                min-width: 60px;
                text-align: center;
            }
            .doc-viewer-actions {
                display: flex;
                gap: 0.5rem;
            }
            .doc-action-btn {
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.1);
                color: #fff;
                width: 42px;
                height: 42px;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 1rem;
            }
            .doc-action-btn:hover {
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                border-color: transparent;
                transform: scale(1.05);
            }
            .doc-close-btn:hover {
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                border-color: transparent;
            }
            .doc-viewer-body {
                flex: 1;
                display: flex;
                position: relative;
                background: linear-gradient(180deg, #0d0d1a 0%, #0f0f23 100%);
                min-height: 0;
            }
            .doc-viewer-loading,
            .doc-viewer-error {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #fff;
                z-index: 5;
            }
            .doc-viewer-loading i {
                font-size: 3rem;
                margin-bottom: 1rem;
                display: block;
                color: #3498db;
            }
            .doc-viewer-error i {
                font-size: 3.5rem;
                margin-bottom: 1rem;
                display: block;
                color: #e74c3c;
            }
            .doc-viewer-loading span,
            .doc-viewer-error span {
                font-size: 1rem;
                color: rgba(255,255,255,0.7);
            }
            .btn-retry {
                margin-top: 1.5rem;
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                color: #fff;
                border: none;
                padding: 0.875rem 2rem;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                transition: all 0.2s;
            }
            .btn-retry:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
            }
            .doc-viewer-frame {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1.5rem;
                min-height: 0;
            }
            .doc-viewer-frame iframe {
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 12px;
                background: #fff;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            }
            .doc-viewer-frame img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            }
            .doc-viewer-sidebar {
                width: 300px;
                background: rgba(0,0,0,0.2);
                border-left: 1px solid rgba(255,255,255,0.08);
                display: flex;
                flex-direction: column;
                transition: width 0.3s ease;
            }
            .doc-viewer-sidebar.collapsed {
                width: 52px;
            }
            .doc-viewer-sidebar.collapsed .doc-sidebar-list,
            .doc-viewer-sidebar.collapsed .doc-sidebar-header h4 {
                display: none;
            }
            .doc-viewer-sidebar.collapsed .sidebar-toggle-btn i {
                transform: rotate(180deg);
            }
            .doc-sidebar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1.25rem 1rem;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .doc-sidebar-header h4 {
                margin: 0;
                color: #fff;
                font-size: 0.95rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: 600;
            }
            .doc-sidebar-header h4 i {
                color: #3498db;
            }
            .sidebar-toggle-btn {
                background: rgba(255,255,255,0.1);
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 8px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .sidebar-toggle-btn:hover {
                background: rgba(255,255,255,0.2);
            }
            .sidebar-toggle-btn i {
                transition: transform 0.3s;
            }
            .doc-sidebar-list {
                flex: 1;
                overflow-y: auto;
                padding: 0.75rem;
            }
            .doc-sidebar-item {
                display: flex;
                align-items: center;
                gap: 0.875rem;
                padding: 0.875rem 1rem;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                color: rgba(255,255,255,0.7);
                margin-bottom: 0.5rem;
                border: 2px solid transparent;
            }
            .doc-sidebar-item:hover {
                background: rgba(52, 152, 219, 0.15);
                color: #fff;
                border-color: rgba(52, 152, 219, 0.3);
            }
            .doc-sidebar-item.active {
                background: linear-gradient(135deg, rgba(52, 152, 219, 0.25) 0%, rgba(41, 128, 185, 0.25) 100%);
                border-color: #3498db;
                color: #fff;
            }
            .doc-sidebar-item i {
                font-size: 1.25rem;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                background: rgba(255,255,255,0.1);
            }
            .doc-sidebar-item.active i {
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            }
            .doc-sidebar-item-info {
                flex: 1;
                min-width: 0;
            }
            .doc-sidebar-item-title {
                font-weight: 500;
                font-size: 0.9rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .doc-sidebar-item-type {
                font-size: 0.75rem;
                opacity: 0.7;
                margin-top: 0.125rem;
            }
            
            /* Custom scrollbar for sidebar */
            .doc-sidebar-list::-webkit-scrollbar {
                width: 6px;
            }
            .doc-sidebar-list::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.05);
                border-radius: 3px;
            }
            .doc-sidebar-list::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 3px;
            }
            .doc-sidebar-list::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.3);
            }
            
            @media (max-width: 900px) {
                .doc-viewer-sidebar {
                    position: absolute;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    width: 280px;
                    z-index: 10;
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                }
                .doc-viewer-sidebar.mobile-open {
                    transform: translateX(0);
                }
                .doc-viewer-content {
                    width: 100%;
                    height: 100%;
                    border-radius: 0;
                }
                .doc-viewer-title {
                    max-width: 180px;
                }
                .doc-viewer-nav {
                    padding: 0.375rem 0.75rem;
                }
            }
            @media (max-width: 480px) {
                .doc-viewer-header {
                    padding: 0.75rem 1rem;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .doc-viewer-title {
                    max-width: calc(100% - 100px);
                    font-size: 1rem;
                }
                .doc-viewer-title i {
                    width: 36px;
                    height: 36px;
                    font-size: 0.9rem;
                }
                .doc-action-btn {
                    width: 36px;
                    height: 36px;
                }
                .doc-viewer-nav {
                    order: 3;
                    width: 100%;
                    justify-content: center;
                }
                .doc-viewer-frame {
                    padding: 0.75rem;
                }
            }
        `;
        
        document.head.appendChild(styles);
        document.body.appendChild(modalContainer);
    }
    
    // Get auth token
    function getAuthToken() {
        return localStorage.getItem('token') || localStorage.getItem('authToken');
    }
    
    // Get document type label
    function getDocTypeLabel(type) {
        const labels = {
            'registration_cert': 'Registration Certificate (OR/CR)',
            'registrationCert': 'Registration Certificate (OR/CR)',
            'or_cr': 'OR/CR',
            'insurance_cert': 'Insurance Certificate',
            'insuranceCert': 'Insurance Certificate',
            'emission_cert': 'Emission Certificate',
            'emissionCert': 'Emission Certificate',
            'owner_id': 'Owner ID',
            'ownerId': 'Owner ID',
            'deed_of_sale': 'Deed of Sale',
            'deedOfSale': 'Deed of Sale',
            'valid_id': 'Valid ID',
            'validId': 'Valid ID',
            'hpg_clearance': 'HPG Clearance',
            'hpgClearance': 'HPG Clearance'
        };
        return labels[type] || type || 'Document';
    }
    
    // Get document icon
    function getDocIcon(type) {
        const icons = {
            'registration_cert': 'fa-car',
            'registrationCert': 'fa-car',
            'or_cr': 'fa-car',
            'insurance_cert': 'fa-shield-alt',
            'insuranceCert': 'fa-shield-alt',
            'emission_cert': 'fa-leaf',
            'emissionCert': 'fa-leaf',
            'owner_id': 'fa-id-card',
            'ownerId': 'fa-id-card',
            'deed_of_sale': 'fa-file-contract',
            'deedOfSale': 'fa-file-contract',
            'valid_id': 'fa-id-badge',
            'validId': 'fa-id-badge',
            'hpg_clearance': 'fa-certificate',
            'hpgClearance': 'fa-certificate'
        };
        return icons[type] || 'fa-file-alt';
    }
    
    // Render sidebar
    function renderSidebar() {
        const list = document.getElementById('docSidebarList');
        if (!list) return;
        
        if (currentDocuments.length <= 1) {
            document.getElementById('docViewerSidebar').style.display = 'none';
            document.getElementById('docViewerNav').style.display = 'none';
            return;
        }
        
        document.getElementById('docViewerSidebar').style.display = 'flex';
        document.getElementById('docViewerNav').style.display = 'flex';
        
        list.innerHTML = currentDocuments.map((doc, index) => `
            <div class="doc-sidebar-item ${index === currentDocIndex ? 'active' : ''}" 
                 onclick="DocumentModal.goTo(${index})">
                <i class="fas ${getDocIcon(doc.type || doc.document_type)}"></i>
                <div class="doc-sidebar-item-info">
                    <div class="doc-sidebar-item-title">${doc.filename || doc.original_name || 'Document'}</div>
                    <div class="doc-sidebar-item-type">${getDocTypeLabel(doc.type || doc.document_type)}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Update counter
    function updateCounter() {
        const counter = document.getElementById('docViewerCounter');
        if (counter) {
            counter.textContent = `${currentDocIndex + 1} / ${currentDocuments.length}`;
        }
    }
    
    // Load document content
    async function loadDocument(doc) {
        const frame = document.getElementById('docViewerFrame');
        const loading = document.getElementById('docViewerLoading');
        const error = document.getElementById('docViewerError');
        const title = document.getElementById('docViewerTitle');
        
        // Show loading
        loading.style.display = 'block';
        frame.style.display = 'none';
        error.style.display = 'none';
        
        // Update title
        title.textContent = doc.filename || doc.original_name || getDocTypeLabel(doc.type || doc.document_type);
        
        try {
            let url = null;
            const token = getAuthToken();
            
            // Determine URL
            if (doc.id && !doc.id.startsWith('APP-')) {
                url = `/api/documents/${doc.id}/view`;
            } else if (doc.cid || doc.ipfs_cid) {
                // Try IPFS gateway
                const cid = doc.cid || doc.ipfs_cid;
                url = `https://ipfs.io/ipfs/${cid}`;
            } else if (doc.url) {
                url = doc.url;
            } else if (doc.path || doc.file_path) {
                url = doc.path || doc.file_path;
            }
            
            if (!url) {
                throw new Error('No document URL available');
            }
            
            // Check if it's an image
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url) || 
                           /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.filename || doc.original_name || '') ||
                           (doc.mime_type && doc.mime_type.startsWith('image/'));
            
            // For API endpoints, fetch with auth
            if (url.startsWith('/api/')) {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to load document (${response.status})`);
                }
                
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                if (isImage || blob.type.startsWith('image/')) {
                    frame.innerHTML = `<img src="${blobUrl}" alt="${doc.filename || 'Document'}" />`;
                } else {
                    frame.innerHTML = `<iframe src="${blobUrl}" title="${doc.filename || 'Document'}"></iframe>`;
                }
            } else {
                // Direct URL
                if (isImage) {
                    frame.innerHTML = `<img src="${url}" alt="${doc.filename || 'Document'}" />`;
                } else {
                    frame.innerHTML = `<iframe src="${url}" title="${doc.filename || 'Document'}"></iframe>`;
                }
            }
            
            // Show frame
            loading.style.display = 'none';
            frame.style.display = 'flex';
            
        } catch (err) {
            console.error('Error loading document:', err);
            loading.style.display = 'none';
            error.style.display = 'block';
            document.getElementById('docViewerErrorMsg').textContent = err.message;
        }
        
        // Update sidebar and counter
        renderSidebar();
        updateCounter();
    }
    
    // Public API
    window.DocumentModal = {
        // View single document
        view: function(doc) {
            this.viewMultiple([doc], 0);
        },
        
        // View multiple documents with optional starting index
        viewMultiple: function(docs, startIndex = 0) {
            initModal();
            
            if (!docs || docs.length === 0) {
                alert('No documents available to view');
                return;
            }
            
            currentDocuments = Array.isArray(docs) ? docs : [docs];
            currentDocIndex = startIndex;
            
            modalContainer.classList.add('active');
            loadDocument(currentDocuments[currentDocIndex]);
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        },
        
        // Navigate to specific index
        goTo: function(index) {
            if (index >= 0 && index < currentDocuments.length) {
                currentDocIndex = index;
                loadDocument(currentDocuments[currentDocIndex]);
            }
        },
        
        // Previous document
        prev: function() {
            if (currentDocIndex > 0) {
                this.goTo(currentDocIndex - 1);
            } else {
                this.goTo(currentDocuments.length - 1); // Loop to end
            }
        },
        
        // Next document
        next: function() {
            if (currentDocIndex < currentDocuments.length - 1) {
                this.goTo(currentDocIndex + 1);
            } else {
                this.goTo(0); // Loop to start
            }
        },
        
        // Close modal
        close: function() {
            if (modalContainer) {
                modalContainer.classList.remove('active');
                document.body.style.overflow = '';
            }
        },
        
        // Download current document
        download: async function() {
            const doc = currentDocuments[currentDocIndex];
            if (!doc) return;
            
            try {
                let url = doc.id ? `/api/documents/${doc.id}/download` : 
                         (doc.url || doc.path || doc.file_path);
                
                if (!url) {
                    alert('Download not available for this document');
                    return;
                }
                
                const token = getAuthToken();
                
                if (url.startsWith('/api/')) {
                    const response = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (!response.ok) throw new Error('Download failed');
                    
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = doc.filename || doc.original_name || 'document';
                    a.click();
                    URL.revokeObjectURL(blobUrl);
                } else {
                    window.open(url, '_blank');
                }
            } catch (err) {
                console.error('Download error:', err);
                alert('Failed to download document: ' + err.message);
            }
        },
        
        // Open in new tab
        openInNewTab: async function() {
            const doc = currentDocuments[currentDocIndex];
            if (!doc) return;
            
            try {
                let url = doc.id ? `/api/documents/${doc.id}/view` : 
                         (doc.url || doc.path || doc.file_path);
                
                if (!url) {
                    alert('Cannot open document in new tab');
                    return;
                }
                
                const token = getAuthToken();
                
                if (url.startsWith('/api/')) {
                    const response = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (!response.ok) throw new Error('Failed to load');
                    
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, '_blank');
                } else {
                    window.open(url, '_blank');
                }
            } catch (err) {
                console.error('Open in new tab error:', err);
                alert('Failed to open document: ' + err.message);
            }
        },
        
        // Retry loading
        retry: function() {
            if (currentDocuments[currentDocIndex]) {
                loadDocument(currentDocuments[currentDocIndex]);
            }
        },
        
        // Toggle sidebar
        toggleSidebar: function() {
            const sidebar = document.getElementById('docViewerSidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        }
    };
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!modalContainer || !modalContainer.classList.contains('active')) return;
        
        switch (e.key) {
            case 'Escape':
                DocumentModal.close();
                break;
            case 'ArrowLeft':
                DocumentModal.prev();
                break;
            case 'ArrowRight':
                DocumentModal.next();
                break;
        }
    });
    
    // Auto-initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModal);
    } else {
        initModal();
    }
    
})();

// Helper function for easy document viewing (can be called from anywhere)
window.viewDocument = function(docOrId, allDocs) {
    if (typeof docOrId === 'string') {
        // It's a document ID
        DocumentModal.view({ id: docOrId });
    } else if (typeof docOrId === 'object') {
        if (allDocs && Array.isArray(allDocs)) {
            const index = allDocs.findIndex(d => d.id === docOrId.id);
            DocumentModal.viewMultiple(allDocs, index >= 0 ? index : 0);
        } else {
            DocumentModal.view(docOrId);
        }
    }
};

// Helper to view all documents for a vehicle
window.viewVehicleDocuments = async function(vehicleId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`/api/vehicles/${vehicleId}/documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load documents');
        
        const data = await response.json();
        const docs = data.documents || data.data || data;
        
        if (docs.length === 0) {
            alert('No documents found for this vehicle');
            return;
        }
        
        DocumentModal.viewMultiple(docs, 0);
    } catch (err) {
        console.error('Error loading vehicle documents:', err);
        alert('Failed to load documents: ' + err.message);
    }
};

