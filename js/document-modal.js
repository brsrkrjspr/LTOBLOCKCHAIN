// TrustChain LTO - Professional Document Viewing Modal
// Government/Admin System UI - Production Ready
// Supports PDFs, Images, and all document types

(function() {
    'use strict';
    
    // State management
    let modalContainer = null;
    let currentDocuments = [];
    let currentDocIndex = 0;
    let activeBlobUrls = [];
    let currentZoom = 100;
    let pdfViewer = null;
    let currentPage = 1;
    let totalPages = 1;
    
    // Initialize modal container
    function initModal() {
        if (modalContainer) return;
        
        modalContainer = document.createElement('div');
        modalContainer.id = 'documentViewerModal';
        modalContainer.className = 'doc-modal';
        modalContainer.innerHTML = `
            <!-- Modal Overlay -->
            <div class="doc-modal-overlay" onclick="DocumentModal.close()"></div>
            
            <!-- Main Modal Container -->
            <div class="doc-modal-container">
                <!-- Header -->
                <header class="doc-modal-header">
                    <div class="doc-header-content">
                        <div class="doc-logo">◆ DocuView</div>
                        <div class="doc-toolbar">
                            <button class="doc-btn" id="docDownloadBtn" onclick="DocumentModal.download()">Download</button>
                            <button class="doc-btn" onclick="window.print()">Print</button>
                            <button class="doc-btn doc-btn-primary" onclick="DocumentModal.share()">Share</button>
                            <button class="doc-close-modal" onclick="DocumentModal.close()" title="Close (ESC)">×</button>
                        </div>
                    </div>
                </header>

                <!-- Main Content -->
                <div class="doc-modal-content">
                    <div class="doc-container">
                        <!-- Sidebar -->
                        <aside class="doc-sidebar" id="docSidebar">
                            <!-- Document Info -->
                            <div class="doc-info">
                                <h3>Document Info</h3>
                                <div class="doc-info-item">
                                    <span class="doc-info-label">File Name</span>
                                    <span class="doc-info-value" id="docInfoFileName">-</span>
                                </div>
                                <div class="doc-info-item">
                                    <span class="doc-info-label">File Size</span>
                                    <span class="doc-info-value" id="docInfoFileSize">-</span>
                                </div>
                                <div class="doc-info-item">
                                    <span class="doc-info-label">Pages</span>
                                    <span class="doc-info-value" id="docInfoPages">-</span>
                                </div>
                                <div class="doc-info-item">
                                    <span class="doc-info-label">Last Modified</span>
                                    <span class="doc-info-value" id="docInfoLastModified">-</span>
                                </div>
                            </div>

                            <!-- Document List (if multiple) -->
                            <div class="doc-list-section" id="docListSection" style="display: none;">
                                <h3>Documents</h3>
                                <div class="doc-sidebar-list" id="docSidebarList">
                                    <!-- Document list will be populated here -->
                                </div>
                            </div>

                            <!-- Page Navigation -->
                            <div class="doc-page-nav" id="docPageNav" style="display: none;">
                                <h3>Navigation</h3>
                                <div class="doc-nav-controls">
                                    <button class="doc-nav-btn" id="docPrevBtn" onclick="DocumentModal.prev()" title="Previous Document">‹</button>
                                    <span class="doc-counter" id="docCounter">1 / 1</span>
                                    <button class="doc-nav-btn" id="docNextBtn" onclick="DocumentModal.next()" title="Next Document">›</button>
                                </div>
                                <div class="doc-page-indicator">
                                    Page <span id="docCurrentPage">1</span> of <span id="docTotalPages">1</span>
                                </div>
                            </div>
                        </aside>

                        <!-- Viewer Container -->
                        <div class="doc-viewer-container">
                            <div class="doc-corner-accent doc-corner-top-left"></div>
                            <div class="doc-corner-accent doc-corner-bottom-right"></div>
                            
                            <!-- Document Display Area - Single Page, Centered -->
                            <div class="doc-pdf-container" id="docPdfContainer">
                                <!-- Loading State -->
                                <div class="doc-loading-overlay" id="docLoading">
                                    <div class="doc-spinner"></div>
                                    <div class="doc-loading-text">Loading Document...</div>
                                </div>
                                
                                <!-- Error State -->
                                <div class="doc-error" id="docError" style="display: none;">
                                    <div class="doc-error-icon">
                                        <i class="fas fa-exclamation-triangle"></i>
                                    </div>
                                    <h3>Failed to Load Document</h3>
                                    <p id="docErrorMessage">An error occurred while loading the document.</p>
                                    <div class="doc-error-actions">
                                        <button class="doc-btn doc-btn-primary" onclick="DocumentModal.retry()">
                                            <i class="fas fa-redo"></i> Retry
                                        </button>
                                        <button class="doc-btn" onclick="DocumentModal.download()">
                                            <i class="fas fa-download"></i> Download Instead
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Document Frame - Single Page Display -->
                                <div class="doc-frame-container" id="docFrameContainer" style="display: none;">
                                    <div class="doc-frame-wrapper" id="docFrameWrapper">
                                        <!-- PDF or Image will be rendered here -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add comprehensive styles
        addModalStyles();
        
        document.body.appendChild(modalContainer);
    }
    
    // Add professional modal styles
    function addModalStyles() {
        const styles = document.createElement('style');
        styles.id = 'doc-modal-styles';
        styles.textContent = `
            /* ============================================
               DOCUMENT MODAL - SYSTEM THEME
               Matches System Font and Colors
               ============================================ */
            
            .doc-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 20000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                align-items: center;
                justify-content: center;
            }
            
            .doc-modal.active {
                display: flex;
                opacity: 0;
                pointer-events: none;
                animation: docFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            
            @keyframes docFadeIn {
                to {
                    opacity: 1;
                    pointer-events: all;
                }
            }
            
            /* Modal Overlay Backdrop */
            .doc-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(43, 45, 49, 0.85);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }
            
            /* Main Modal Container */
            .doc-modal-container {
                position: relative;
                width: 100%;
                max-width: 1400px;
                max-height: 90vh;
                margin: auto;
                background: white;
                border: 1px solid rgba(43, 45, 49, 0.08);
                box-shadow: 0 20px 60px rgba(43, 45, 49, 0.3);
                transform: scale(0.9) translateY(30px);
                transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .doc-modal.active .doc-modal-container {
                transform: scale(1) translateY(0);
            }
            
            /* ============================================
               HEADER SECTION
               ============================================ */
            
            .doc-modal-header {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(12px);
                border-bottom: 1px solid rgba(43, 45, 49, 0.08);
                padding: 1.5rem 2rem;
                flex-shrink: 0;
            }
            
            .doc-header-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .doc-logo {
                font-size: 1.5rem;
                font-weight: 600;
                color: #0c4a6e;
                letter-spacing: -0.02em;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-logo::before {
                content: '◆';
                color: #0284c7;
                margin-right: 0.5rem;
                font-size: 0.8em;
            }
            
            .doc-toolbar {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            
            .doc-btn {
                padding: 0.6rem 1.2rem;
                border: 1px solid rgba(43, 45, 49, 0.12);
                background: white;
                color: #0c4a6e;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
                overflow: hidden;
            }
            
            .doc-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: #0284c7;
                transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: -1;
            }
            
            .doc-btn:hover::before {
                left: 0;
            }
            
            .doc-btn:hover {
                color: white;
                border-color: #0284c7;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
            }
            
            .doc-btn-primary {
                background: #0284c7;
                color: white;
                border-color: #0284c7;
            }
            
            .doc-btn-primary::before {
                background: #0369a1;
            }
            
            .doc-close-modal {
                width: 40px;
                height: 40px;
                border: 1px solid rgba(43, 45, 49, 0.12);
                background: white;
                color: #0284c7;
                font-size: 1.5rem;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
            }
            
            .doc-close-modal::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: #0284c7;
                transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: -1;
            }
            
            .doc-close-modal:hover::before {
                left: 0;
            }
            
            .doc-close-modal:hover {
                color: white;
                border-color: #0284c7;
                transform: translateY(-2px) rotate(90deg);
                box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
            }
            
            /* ============================================
               MAIN CONTENT SECTION
               ============================================ */
            
            .doc-modal-content {
                flex: 1;
                padding: 2rem;
                overflow: auto;
                background: #f8fafc;
            }
            
            .doc-container {
                display: grid;
                grid-template-columns: 250px 1fr;
                gap: 2rem;
                height: 100%;
            }
            
            /* ============================================
               SIDEBAR SECTION
               ============================================ */
            
            .doc-sidebar {
                display: flex;
                flex-direction: column;
                gap: 2rem;
            }
            
            .doc-sidebar h3 {
                font-size: 0.875rem;
                font-weight: 600;
                color: #64748b;
                margin-bottom: 1rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-info {
                background: white;
                border: 1px solid rgba(43, 45, 49, 0.08);
                padding: 1.5rem;
                box-shadow: 0 2px 8px rgba(43, 45, 49, 0.08);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                margin-bottom: 2rem;
            }
            
            .doc-info:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(43, 45, 49, 0.15);
            }
            
            .doc-info-item {
                display: flex;
                flex-direction: column;
                margin-bottom: 1rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid rgba(43, 45, 49, 0.06);
            }
            
            .doc-info-item:last-child {
                margin-bottom: 0;
                padding-bottom: 0;
                border-bottom: none;
            }
            
            .doc-info-label {
                font-size: 0.75rem;
                font-weight: 500;
                color: #64748b;
                margin-bottom: 0.3rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-info-value {
                font-size: 0.95rem;
                color: #0c4a6e;
                font-weight: 500;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-list-section {
                background: white;
                border: 1px solid rgba(43, 45, 49, 0.08);
                padding: 1.5rem;
                box-shadow: 0 2px 8px rgba(43, 45, 49, 0.08);
            }
            
            .doc-sidebar-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .doc-sidebar-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.875rem 1rem;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #475569;
                margin-bottom: 0.5rem;
                border: 2px solid transparent;
            }
            
            .doc-sidebar-item:hover {
                background: #f0f9ff;
                color: #0284c7;
                border-color: rgba(2, 132, 199, 0.2);
            }
            
            .doc-sidebar-item.active {
                background: rgba(2, 132, 199, 0.1);
                border-color: #0284c7;
                color: #0284c7;
            }
            
            .doc-sidebar-item-icon {
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                background: rgba(2, 132, 199, 0.1);
                font-size: 1.125rem;
                flex-shrink: 0;
                color: #0284c7;
            }
            
            .doc-sidebar-item.active .doc-sidebar-item-icon {
                background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
                color: white;
            }
            
            .doc-sidebar-item-info {
                flex: 1;
                min-width: 0;
            }
            
            .doc-sidebar-item-title {
                font-weight: 500;
                font-size: 0.875rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 0.25rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-sidebar-item-type {
                font-size: 0.75rem;
                color: #64748b;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-page-nav {
                background: white;
                border: 1px solid rgba(43, 45, 49, 0.08);
                padding: 1.5rem;
                box-shadow: 0 2px 8px rgba(43, 45, 49, 0.08);
            }
            
            .doc-nav-controls {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 1rem;
                align-items: center;
            }
            
            .doc-nav-btn {
                flex: 1;
                padding: 0.5rem;
                border: 1px solid rgba(43, 45, 49, 0.12);
                background: white;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 1rem;
                color: #0c4a6e;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-nav-btn:hover:not(:disabled) {
                background: #f0f9ff;
                transform: scale(1.05);
                border-color: #0284c7;
                color: #0284c7;
            }
            
            .doc-nav-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .doc-counter {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.85rem;
                color: #64748b;
                min-width: 60px;
                text-align: center;
                font-weight: 500;
            }
            
            .doc-page-indicator {
                text-align: center;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.85rem;
                color: #64748b;
                font-weight: 500;
            }
            
            /* ============================================
               VIEWER CONTAINER
               ============================================ */
            
            .doc-viewer-container {
                background: white;
                border: 1px solid rgba(43, 45, 49, 0.08);
                box-shadow: 0 8px 32px rgba(43, 45, 49, 0.15);
                position: relative;
                overflow: hidden;
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            
            .doc-corner-accent {
                position: absolute;
                width: 40px;
                height: 40px;
                border: 2px solid #0284c7;
                z-index: 1;
            }
            
            .doc-corner-top-left {
                top: 10px;
                left: 10px;
                border-right: none;
                border-bottom: none;
            }
            
            .doc-corner-bottom-right {
                bottom: 10px;
                right: 10px;
                border-left: none;
                border-top: none;
            }
            
            .doc-pdf-container {
                flex: 1;
                background: #0f172a;
                position: relative;
                overflow: hidden;
                min-height: 500px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Loading Overlay */
            .doc-loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(251, 249, 244, 0.95);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10;
            }
            
            .doc-spinner {
                width: 50px;
                height: 50px;
                border: 3px solid rgba(2, 132, 199, 0.1);
                border-top-color: #0284c7;
                border-radius: 50%;
                animation: docSpin 1s linear infinite;
            }
            
            @keyframes docSpin {
                to { transform: rotate(360deg); }
            }
            
            .doc-loading-text {
                margin-top: 1rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.875rem;
                color: #94a3b8;
                font-weight: 500;
            }
            
            /* Error State */
            .doc-error {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #0c4a6e;
                z-index: 5;
                max-width: 400px;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(43, 45, 49, 0.15);
            }
            
            .doc-error-icon {
                font-size: 4rem;
                color: #ef4444;
                margin-bottom: 1rem;
            }
            
            .doc-error h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.25rem;
                color: #0c4a6e;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-weight: 600;
            }
            
            .doc-error p {
                margin: 0 0 1.5rem 0;
                color: #64748b;
                font-size: 0.9375rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-error-actions {
                display: flex;
                gap: 0.75rem;
                justify-content: center;
            }
            
            /* Document Frame Container - Single Page, Centered, Large Display */
            .doc-frame-container {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                overflow: auto;
                position: relative;
                box-sizing: border-box;
                /* Ensure scrolling works when document is larger than container */
                overflow-x: auto;
                overflow-y: auto;
            }
            
            .doc-frame-wrapper {
                position: relative;
                background: #ffffff;
                border-radius: 4px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                overflow: visible;
                margin: auto;
                display: flex;
                align-items: center;
                justify-content: center;
                width: fit-content;
                height: fit-content;
                min-width: 0;
                min-height: 0;
                /* Prevent thumbnail rendering - ensure full-size display */
                flex-shrink: 0;
            }
            
            .doc-frame-wrapper img {
                display: block;
                width: auto;
                height: auto;
                object-fit: contain;
                margin: 0;
                border-radius: 4px;
                max-width: none;
                max-height: none;
            }
            
            .doc-frame-wrapper iframe,
            .doc-frame-wrapper embed {
                display: block;
                width: auto;
                height: auto;
                border: none;
                background: #ffffff;
                border-radius: 4px;
                max-width: none;
                max-height: none;
            }
            
            /* Ensure PDFs are properly sized */
            .doc-frame-wrapper iframe[type="application/pdf"] {
                width: auto !important;
                height: auto !important;
                max-width: none !important;
                max-height: none !important;
            }
            
            /* Custom Scrollbar */
            .doc-sidebar-list::-webkit-scrollbar,
            .doc-pdf-container::-webkit-scrollbar {
                width: 6px;
            }
            
            .doc-sidebar-list::-webkit-scrollbar-track,
            .doc-pdf-container::-webkit-scrollbar-track {
                background: rgba(2, 132, 199, 0.05);
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb,
            .doc-pdf-container::-webkit-scrollbar-thumb {
                background: rgba(2, 132, 199, 0.2);
                border-radius: 3px;
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb:hover,
            .doc-pdf-container::-webkit-scrollbar-thumb:hover {
                background: rgba(2, 132, 199, 0.3);
            }
            
            /* ============================================
               RESPONSIVE DESIGN
               ============================================ */
            
            @media (max-width: 1024px) {
                .doc-container {
                    grid-template-columns: 1fr;
                    gap: 1.5rem;
                }
                
                .doc-sidebar {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }
                
                .doc-modal-container {
                    max-height: 95vh;
                }
                
                .doc-modal-content {
                    padding: 1.5rem;
                }
            }
            
            @media (max-width: 768px) {
                .doc-modal-header {
                    padding: 1rem 1.5rem;
                }
                
                .doc-header-content {
                    flex-direction: column;
                    gap: 1rem;
                    align-items: flex-start;
                }
                
                .doc-toolbar {
                    width: 100%;
                    flex-wrap: wrap;
                }
                
                .doc-modal-content {
                    padding: 1rem;
                }
                
                .doc-sidebar {
                    grid-template-columns: 1fr;
                }
                
                .doc-pdf-container {
                    min-height: 400px;
                }
                
                .doc-frame-container {
                    padding: 1rem;
                }
            }
            
            @media (max-width: 640px) {
                .doc-modal {
                    padding: 1rem;
                }
                
                .doc-modal-container {
                    max-height: 100vh;
                    border-radius: 0;
                }
                
                .doc-logo {
                    font-size: 1.25rem;
                }
                
                .doc-btn {
                    padding: 0.5rem 1rem;
                    font-size: 0.7rem;
                }
                
                .doc-frame-container {
                    padding: 0.5rem;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // Get authentication token
    function getAuthToken() {
        return (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
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
            'ownerValidId': 'Owner Valid ID',
            'valid_id': 'Valid ID',
            'validId': 'Valid ID',
            'deed_of_sale': 'Deed of Sale',
            'deedOfSale': 'Deed of Sale',
            'hpg_clearance': 'HPG Clearance',
            'hpgClearance': 'HPG Clearance',
            'pnpHpgClearance': 'PNP-HPG Clearance',
            'sales_invoice': 'Sales Invoice',
            'salesInvoice': 'Sales Invoice',
            'certificate_of_stock_report': 'Certificate of Stock Report (CSR)',
            'certificateOfStockReport': 'Certificate of Stock Report (CSR)',
            'csr': 'Certificate of Stock Report (CSR)',
            'affidavit_of_attachment': 'Affidavit of Attachment',
            'affidavitOfAttachment': 'Affidavit of Attachment'
        };
        return labels[type] || (type ? type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Document');
    }
    
    // Get document icon
    function getDocIcon(type) {
        const icons = {
            'registration_cert': 'fa-file-alt',
            'registrationCert': 'fa-file-alt',
            'or_cr': 'fa-file-alt',
            'insurance_cert': 'fa-shield-alt',
            'insuranceCert': 'fa-shield-alt',
            'emission_cert': 'fa-leaf',
            'emissionCert': 'fa-leaf',
            'owner_id': 'fa-id-card',
            'ownerId': 'fa-id-card',
            'ownerValidId': 'fa-id-card',
            'valid_id': 'fa-id-badge',
            'validId': 'fa-id-badge',
            'hpg_clearance': 'fa-certificate',
            'hpgClearance': 'fa-certificate',
            'pnpHpgClearance': 'fa-certificate',
            'sales_invoice': 'fa-file-invoice',
            'salesInvoice': 'fa-file-invoice',
            'certificate_of_stock_report': 'fa-file-contract',
            'certificateOfStockReport': 'fa-file-contract',
            'csr': 'fa-file-contract',
            'affidavit_of_attachment': 'fa-file-signature',
            'affidavitOfAttachment': 'fa-file-signature'
        };
        return icons[type] || 'fa-file-alt';
    }
    
    // Update document info in sidebar
    function updateDocumentInfo(doc) {
        const fileNameEl = document.getElementById('docInfoFileName');
        const fileSizeEl = document.getElementById('docInfoFileSize');
        const pagesEl = document.getElementById('docInfoPages');
        const lastModifiedEl = document.getElementById('docInfoLastModified');
        
        const docName = doc.filename || doc.original_name || doc.name || 'Unknown';
        const docSize = doc.file_size || doc.size || '-';
        const docPages = doc.pages || doc.page_count || '-';
        const docModified = doc.updated_at || doc.created_at || doc.last_modified || null;
        
        if (fileNameEl) fileNameEl.textContent = docName.length > 30 ? docName.substring(0, 30) + '...' : docName;
        if (fileSizeEl) fileSizeEl.textContent = docSize !== '-' ? formatFileSize(docSize) : '-';
        if (pagesEl) pagesEl.textContent = docPages !== '-' ? `${docPages} page${docPages !== 1 ? 's' : ''}` : '-';
        if (lastModifiedEl) {
            if (docModified) {
                const date = new Date(docModified);
                lastModifiedEl.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } else {
                lastModifiedEl.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
        }
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (!bytes || bytes === '-') return '-';
        if (typeof bytes === 'string') {
            // If already formatted, return as is
            if (bytes.includes('KB') || bytes.includes('MB') || bytes.includes('GB')) return bytes;
            bytes = parseInt(bytes);
        }
        if (isNaN(bytes)) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    
    // Render sidebar document list
    function renderSidebar() {
        const list = document.getElementById('docSidebarList');
        const listSection = document.getElementById('docListSection');
        const pageNav = document.getElementById('docPageNav');
        
        if (!list || !listSection) return;
        
        if (currentDocuments.length <= 1) {
            listSection.style.display = 'none';
            if (pageNav) pageNav.style.display = 'none';
            return;
        }
        
        listSection.style.display = 'block';
        if (pageNav) pageNav.style.display = 'block';
        
        list.innerHTML = currentDocuments.map((doc, index) => {
            const docType = doc.type || doc.document_type || 'document';
            const docName = doc.filename || doc.original_name || doc.name || getDocTypeLabel(docType);
            const docLabel = getDocTypeLabel(docType);
            
            return `
                <div class="doc-sidebar-item ${index === currentDocIndex ? 'active' : ''}" 
                     onclick="DocumentModal.goTo(${index})"
                     title="${escapeHtml(docName)}">
                    <div class="doc-sidebar-item-icon">
                        <i class="fas ${getDocIcon(docType)}"></i>
                    </div>
                    <div class="doc-sidebar-item-info">
                        <div class="doc-sidebar-item-title">${escapeHtml(docName.length > 25 ? docName.substring(0, 25) + '...' : docName)}</div>
                        <div class="doc-sidebar-item-type">${escapeHtml(docLabel)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Update navigation counter
    function updateCounter() {
        const counter = document.getElementById('docCounter');
        const currentPageEl = document.getElementById('docCurrentPage');
        const totalPagesEl = document.getElementById('docTotalPages');
        const prevBtn = document.getElementById('docPrevBtn');
        const nextBtn = document.getElementById('docNextBtn');
        
        if (counter) {
            counter.textContent = `${currentDocIndex + 1} / ${currentDocuments.length}`;
        }
        
        if (currentPageEl) {
            currentPageEl.textContent = currentDocIndex + 1;
        }
        
        if (totalPagesEl) {
            totalPagesEl.textContent = currentDocuments.length;
        }
        
        if (prevBtn) {
            prevBtn.disabled = currentDocuments.length <= 1 || currentDocIndex === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentDocuments.length <= 1 || currentDocIndex === currentDocuments.length - 1;
        }
    }
    
    // Update zoom display
    function updateZoomDisplay() {
        const zoomLevel = document.getElementById('docZoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(currentZoom)}%`;
        }
    }
    
    // Apply zoom to document (disabled for single-page view)
    function applyZoom() {
        // Zoom functionality disabled - using auto-fit single-page view instead
        // Keep function for compatibility but don't apply transforms
        updateZoomDisplay();
    }
    
    // Calculate auto-fit scale for images
    function calculateAutoFitScale(img, container) {
        if (!img || !container) return 100;
        
        const containerWidth = container.clientWidth - 40; // Account for padding
        const containerHeight = container.clientHeight - 40;
        
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;
        
        if (!imgWidth || !imgHeight) return 100;
        
        const scaleX = (containerWidth / imgWidth) * 100;
        const scaleY = (containerHeight / imgHeight) * 100;
        
        // Use the smaller scale to fit within container, but ensure minimum readable size
        let scale = Math.min(scaleX, scaleY);
        
        // Ensure minimum 100% for readability, but allow up to 150% if it fits
        scale = Math.max(100, Math.min(scale, 150));
        
        return scale;
    }
    
    // Auto-fit document to container - Fit to width, large and readable
    function autoFitDocument() {
        const wrapper = document.getElementById('docFrameWrapper');
        const container = document.getElementById('docFrameContainer');
        const pdfContainer = document.getElementById('docPdfContainer');
        
        if (!wrapper || !container || !pdfContainer) return;
        
        const img = wrapper.querySelector('img');
        const iframe = wrapper.querySelector('iframe');
        
        // Get available space - use 85% of container for optimal readability
        const containerWidth = pdfContainer.clientWidth;
        const containerHeight = pdfContainer.clientHeight;
        const availableWidth = Math.floor(containerWidth * 0.85); // 85% of width
        const availableHeight = Math.floor(containerHeight * 0.85); // 85% of height
        
        if (img) {
            // For images, scale to fit width (fit-to-width), allow vertical scrolling if needed
            if (img.complete && img.naturalWidth) {
                const imgWidth = img.naturalWidth;
                const imgHeight = img.naturalHeight;
                
                if (imgWidth > 0 && imgHeight > 0) {
                    // Fit to width - scale based on width, maintain aspect ratio
                    // Use 85% of available width for optimal readability
                    const scale = availableWidth / imgWidth;
                    const scaledWidth = imgWidth * scale;
                    const scaledHeight = imgHeight * scale;
                    
                    // Ensure minimum readable size - never render as thumbnail
                    const minReadableWidth = Math.min(600, availableWidth * 0.7);
                    const finalWidth = Math.max(scaledWidth, minReadableWidth);
                    const finalHeight = (finalWidth / imgWidth) * imgHeight;
                    
                    // Apply sizing - ensure document is large and readable
                    img.style.width = finalWidth + 'px';
                    img.style.height = finalHeight + 'px';
                    img.style.maxWidth = 'none';
                    img.style.maxHeight = 'none';
                    img.style.objectFit = 'contain';
                    
                    // Set wrapper to match image size
                    wrapper.style.width = finalWidth + 'px';
                    wrapper.style.height = finalHeight + 'px';
                    wrapper.style.maxWidth = 'none';
                    wrapper.style.maxHeight = 'none';
                }
            } else {
                // Wait for image to load
                const originalOnload = img.onload;
                img.onload = function() {
                    if (originalOnload) originalOnload.call(this);
                    autoFitDocument();
                };
            }
        } else if (iframe) {
            // For PDFs, use fit-to-width approach
            // Calculate width to fill 85% of container width for optimal readability
            const pdfWidth = Math.max(availableWidth, 800); // Minimum 800px width
            // Calculate height based on standard PDF aspect ratio (8.5:11 for portrait)
            // Use the larger of: available height or calculated height from aspect ratio
            const aspectRatioHeight = Math.floor(pdfWidth * 1.294); // 11/8.5 ratio
            const pdfHeight = Math.max(availableHeight, aspectRatioHeight, 1000); // Minimum 1000px height
            
            // Set wrapper to match PDF size - ensure large display
            wrapper.style.width = pdfWidth + 'px';
            wrapper.style.height = pdfHeight + 'px';
            wrapper.style.maxWidth = 'none';
            wrapper.style.maxHeight = 'none';
            
            // Set iframe size - make it large and readable, never thumbnail
            iframe.style.width = pdfWidth + 'px';
            iframe.style.height = pdfHeight + 'px';
            iframe.style.maxWidth = 'none';
            iframe.style.maxHeight = 'none';
            iframe.style.minWidth = '800px'; // Enforce minimum readable size
            iframe.style.minHeight = '1000px';
        }
    }
    
    // Debounced resize handler
    let resizeTimeout = null;
    function handleResize() {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(function() {
            if (modalContainer && modalContainer.classList.contains('active')) {
                autoFitDocument();
            }
        }, 250);
    }
    
    // Load document content
    async function loadDocument(doc) {
        const frame = document.getElementById('docFrameContainer');
        const wrapper = document.getElementById('docFrameWrapper');
        const loading = document.getElementById('docLoading');
        const error = document.getElementById('docError');
        const errorMsg = document.getElementById('docErrorMessage');
        const title = document.getElementById('docModalTitle');
        const pageIndicator = document.getElementById('docPageIndicator');
        
        // Reset state
        currentZoom = 100;
        currentPage = 1;
        totalPages = 1;
        
        // Reset wrapper styles for large single-page display
        if (wrapper) {
            wrapper.style.width = 'auto';
            wrapper.style.height = 'auto';
            wrapper.style.maxWidth = 'none';
            wrapper.style.maxHeight = 'none';
            wrapper.style.transform = 'none';
        }
        
        // Reset zoom (not used in single-page view)
        currentZoom = 100;
        
        // Show loading
        if (loading) loading.style.display = 'flex';
        if (frame) frame.style.display = 'none';
        if (error) error.style.display = 'none';
        
        // Update title and document info
        const docName = doc.filename || doc.original_name || doc.name || getDocTypeLabel(doc.type || doc.document_type);
        if (title) {
            title.textContent = docName;
        }
        
        // Update document info in sidebar
        updateDocumentInfo(doc);
        
        if (pageIndicator) {
            pageIndicator.style.display = 'none';
        }
        
        try {
            let url = null;
            const token = getAuthToken();
            
            // Priority 1: Document ID (UUID)
            if (doc.id && typeof doc.id === 'string') {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id);
                if (isUUID) {
                    url = `/api/documents/${doc.id}/view`;
                }
            }
            
            // Priority 2: Data URL
            if (!url && doc.url && typeof doc.url === 'string' && doc.url.startsWith('data:')) {
                url = doc.url;
            }
            // Priority 3: IPFS CID
            else if (!url && (doc.cid || doc.ipfs_cid)) {
                const cid = doc.cid || doc.ipfs_cid;
                url = `/api/documents/ipfs/${cid}`;
            }
            // Priority 4: Direct URL
            else if (!url && doc.url && typeof doc.url === 'string' && 
                     (doc.url.startsWith('http') || doc.url.startsWith('/api/') || doc.url.startsWith('/uploads/'))) {
                url = doc.url;
            }
            // Fallback
            else if (!url && doc.url) {
                url = doc.url;
            }
            
            if (!url) {
                throw new Error('No document URL available');
            }
            
            // Determine file type
            const urlStr = url || '';
            const filenameStr = docName.toLowerCase();
            const mimeType = doc.mime_type || doc.mimeType || '';
            
            const isDataImage = urlStr.startsWith('data:image');
            const isFileImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(urlStr) || 
                               /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filenameStr);
            const isMimeImage = mimeType.startsWith('image/');
            const isImage = isDataImage || isFileImage || isMimeImage;
            
            const isFilePdf = /\.pdf$/i.test(urlStr) || /\.pdf$/i.test(filenameStr);
            const isMimePdf = mimeType === 'application/pdf';
            const isPdf = isFilePdf || isMimePdf;
            
            // Handle data URLs directly
            if (url.startsWith('data:')) {
                if (isImage) {
                    if (wrapper) {
                        wrapper.innerHTML = `<img src="${url}" alt="${escapeHtml(docName)}" style="display: block; width: auto; height: auto; object-fit: contain;" />`;
                        // Auto-fit after image loads - ensure large display
                        setTimeout(() => {
                            const img = wrapper.querySelector('img');
                            if (img) {
                                img.onload = function() {
                                    autoFitDocument();
                                };
                                if (img.complete) {
                                    autoFitDocument();
                                }
                            }
                        }, 100);
                    }
                } else {
                    if (wrapper) {
                        wrapper.innerHTML = `<iframe src="${url}" title="${escapeHtml(docName)}" style="display: block; border: none;"></iframe>`;
                        // Auto-fit after iframe loads - ensure large display
                        setTimeout(() => {
                            autoFitDocument();
                        }, 200);
                    }
                }
            }
            // Handle API/server endpoints (document view)
            else if (url.startsWith('/api/documents/') && url.includes('/view')) {
                try {
                    // Extract document ID from URL
                    const docIdMatch = url.match(/\/api\/documents\/([^/]+)\/view/);
                    const docId = docIdMatch ? docIdMatch[1] : null;
                    
                    if (!docId) {
                        throw new Error('Could not extract document ID');
                    }
                    
                    // Generate temporary view token
                    const tokenResponse = await fetch(`/api/documents/${docId}/temp-view-token`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!tokenResponse.ok) {
                        throw new Error(`Failed to generate view token: ${tokenResponse.status} ${tokenResponse.statusText}`);
                    }
                    
                    const tokenData = await tokenResponse.json();
                    const viewToken = tokenData.token;
                    
                    // Construct iframe URL with token parameter
                    const iframeUrl = `/api/documents/${docId}/view?token=${viewToken}`;
                    
                    if (wrapper) {
                        // Load directly via iframe URL with token - large, readable display
                        wrapper.innerHTML = `
                            <iframe src="${iframeUrl}" 
                                    type="application/pdf" 
                                    title="${escapeHtml(docName)}"
                                    style="display: block; border: none;"></iframe>
                        `;
                        
                        // Auto-fit after iframe loads - ensure large display
                        setTimeout(() => {
                            autoFitDocument();
                        }, 200);
                    }
                    
                    // PDF loaded successfully
                } catch (error) {
                    throw new Error(`Failed to load document: ${error.message}`);
                }
            }
            // Handle other API/server endpoints (IPFS, uploads, etc)
            else if (url.startsWith('/api/') || url.startsWith('/uploads/')) {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'image/*,application/pdf,*/*'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }
                    
                    const blob = await response.blob();
                    
                    if (isImage || blob.type.startsWith('image/')) {
                        // Convert blob to data URL for images
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            if (wrapper) {
                                wrapper.innerHTML = `<img src="${e.target.result}" alt="${escapeHtml(docName)}" style="display: block; width: auto; height: auto; object-fit: contain;" />`;
                                // Auto-fit after image loads - ensure large display
                                setTimeout(() => {
                                    const img = wrapper.querySelector('img');
                                    if (img) {
                                        img.onload = function() {
                                            autoFitDocument();
                                        };
                                        if (img.complete) {
                                            autoFitDocument();
                                        }
                                    }
                                }, 100);
                            }
                        };
                        reader.onerror = function() {
                            throw new Error('Failed to read image file');
                        };
                        reader.readAsDataURL(blob);
                    } else if (isPdf || blob.type === 'application/pdf') {
                        // Use blob URL for PDFs - large, readable display
                        const blobUrl = URL.createObjectURL(blob);
                        activeBlobUrls.push(blobUrl);
                        
                        if (wrapper) {
                            wrapper.innerHTML = `
                                <iframe src="${blobUrl}" 
                                        type="application/pdf" 
                                        title="${escapeHtml(docName)}"
                                        style="display: block; border: none;"></iframe>
                            `;
                            
                            // Auto-fit after iframe loads - ensure large display
                            setTimeout(() => {
                                autoFitDocument();
                            }, 200);
                        }
                        
                        // PDF loaded successfully
                    } else {
                        // Other file types - show download option
                        if (wrapper) {
                            wrapper.innerHTML = `
                                <div style="text-align: center; padding: 3rem; color: #0c4a6e; background: white; border-radius: 8px; box-shadow: 0 4px 16px rgba(43, 45, 49, 0.15); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                    <i class="fas fa-file-alt" style="font-size: 4rem; color: #0284c7; margin-bottom: 1rem;"></i>
                                    <h3 style="margin: 0 0 0.5rem 0; color: #0c4a6e; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: 600;">Preview Not Available</h3>
                                    <p style="color: #64748b; margin: 0 0 1.5rem 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">This file type cannot be previewed in the browser.</p>
                                    <button class="doc-btn doc-btn-primary" onclick="DocumentModal.download()">
                                        <i class="fas fa-download"></i> Download Document
                                    </button>
                                </div>
                            `;
                        }
                    }
                } catch (fetchError) {
                    console.error('[DocumentModal] Error fetching document:', fetchError);
                    if (loading) loading.style.display = 'none';
                    if (frame) frame.style.display = 'none';
                    if (error) {
                        error.style.display = 'block';
                        if (errorMsg) {
                            errorMsg.textContent = fetchError.message || 'Failed to load document';
                        }
                    }
                    return; // Exit early on fetch error
                }
            } else {
                // Direct external URL - large, readable display
                if (isImage) {
                    if (wrapper) {
                        wrapper.innerHTML = `<img src="${url}" alt="${escapeHtml(docName)}" style="display: block; width: auto; height: auto; object-fit: contain;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'text-align:center;padding:2rem;color:#ef4444;\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'font-size:2rem;margin-bottom:0.5rem;\\'></i><p>Image failed to load</p></div>';" />`;
                        // Auto-fit after image loads - ensure large display
                        setTimeout(() => {
                            const img = wrapper.querySelector('img');
                            if (img) {
                                img.onload = function() {
                                    autoFitDocument();
                                };
                                if (img.complete) {
                                    autoFitDocument();
                                }
                            }
                        }, 100);
                    }
                } else {
                    if (wrapper) {
                        wrapper.innerHTML = `<iframe src="${url}" title="${escapeHtml(docName)}" style="display: block; border: none;"></iframe>`;
                        // Auto-fit after iframe loads - ensure large display
                        setTimeout(() => {
                            autoFitDocument();
                        }, 200);
                    }
                }
            }
            
            // Show frame
            if (loading) loading.style.display = 'none';
            if (frame) frame.style.display = 'flex';
            
            // Auto-fit document after container is fully rendered
            // Use requestAnimationFrame for better timing - ensure large display
            requestAnimationFrame(() => {
                setTimeout(() => {
                    autoFitDocument();
                    // Retry after a short delay to ensure iframe/content is fully loaded
                    setTimeout(() => {
                        autoFitDocument();
                    }, 500);
                }, 200);
            });
            
        } catch (err) {
            console.error('Error loading document:', err);
            if (loading) loading.style.display = 'none';
            if (frame) frame.style.display = 'none';
            if (error) {
                error.style.display = 'block';
                if (errorMsg) {
                    errorMsg.textContent = err.message || 'An unexpected error occurred';
                }
            }
        }
        
        // Update sidebar and counter
        renderSidebar();
        updateCounter();
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Copy to clipboard helper
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                if (typeof ToastNotification !== 'undefined') {
                    ToastNotification.show('Link copied to clipboard!', 'success');
                } else {
                    alert('Link copied to clipboard!');
                }
            }).catch(err => {
                console.error('Failed to copy:', err);
                fallbackCopyToClipboard(text);
            });
        } else {
            fallbackCopyToClipboard(text);
        }
    }
    
    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Link copied to clipboard!', 'success');
            } else {
                alert('Link copied to clipboard!');
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            alert('Failed to copy link. Please copy manually: ' + text);
        }
        document.body.removeChild(textArea);
    }
    
    // Public API
    window.DocumentModal = {
        // View single document
        view: function(doc) {
            this.viewMultiple([doc], 0);
        },
        
        // View multiple documents
        viewMultiple: function(docs, startIndex = 0) {
            initModal();
            
            if (!docs || docs.length === 0) {
                console.error('DocumentModal: No documents provided');
                return;
            }
            
            currentDocuments = Array.isArray(docs) ? docs : [docs];
            currentDocIndex = Math.max(0, Math.min(startIndex, currentDocuments.length - 1));
            
            modalContainer.classList.add('active');
            
            // Reset zoom before loading
            currentZoom = 100;
            
            // Use requestAnimationFrame to ensure modal is rendered before loading
            requestAnimationFrame(() => {
                loadDocument(currentDocuments[currentDocIndex]);
            });
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        },
        
        // Navigate to specific document index
        goTo: function(index) {
            if (index >= 0 && index < currentDocuments.length) {
                currentDocIndex = index;
                // Reset zoom when switching documents
                currentZoom = 100;
                loadDocument(currentDocuments[currentDocIndex]);
            }
        },
        
        // Previous document
        prev: function() {
            if (currentDocuments.length <= 1) return;
            if (currentDocIndex > 0) {
                this.goTo(currentDocIndex - 1);
            } else {
                this.goTo(currentDocuments.length - 1); // Loop to end
            }
        },
        
        // Next document
        next: function() {
            if (currentDocuments.length <= 1) return;
            if (currentDocIndex < currentDocuments.length - 1) {
                this.goTo(currentDocIndex + 1);
            } else {
                this.goTo(0); // Loop to start
            }
        },
        
        // Close modal
        close: function() {
            // Clean up blob URLs
            activeBlobUrls.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.warn('Error revoking blob URL:', e);
                }
            });
            activeBlobUrls = [];
            
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
                let url = null;
                const token = getAuthToken();
                
                if (doc.id && typeof doc.id === 'string') {
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id);
                    if (isUUID) {
                        url = `/api/documents/${doc.id}/download`;
                    }
                }
                
                if (!url && doc.url) {
                    url = doc.url;
                }
                
                if (!url) {
                    alert('Download not available for this document');
                    return;
                }
                
                const filename = doc.filename || doc.original_name || doc.name || 'document';
                
                if (url.startsWith('/api/')) {
                    const response = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (!response.ok) throw new Error('Download failed');
                    
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                } else {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            } catch (err) {
                console.error('Download error:', err);
                alert('Failed to download document: ' + err.message);
            }
        },
        
        // Retry loading
        retry: function() {
            if (currentDocuments[currentDocIndex]) {
                loadDocument(currentDocuments[currentDocIndex]);
            }
        },
        
        // Share document
        share: function() {
            const doc = currentDocuments[currentDocIndex];
            if (!doc) return;
            
            const docName = doc.filename || doc.original_name || doc.name || 'Document';
            
            if (navigator.share) {
                navigator.share({
                    title: docName,
                    text: `Check out this document: ${docName}`,
                    url: window.location.href
                }).catch(err => {
                    console.log('Error sharing:', err);
                    // Fallback to clipboard
                    copyToClipboard(window.location.href);
                });
            } else {
                // Fallback: copy link to clipboard
                copyToClipboard(window.location.href);
            }
        },
        
        // Toggle sidebar
        toggleSidebar: function() {
            const sidebar = document.getElementById('docSidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        },
        
        // Zoom controls
        zoomIn: function() {
            currentZoom = Math.min(currentZoom + 25, 300);
            applyZoom();
        },
        
        zoomOut: function() {
            currentZoom = Math.max(currentZoom - 25, 50);
            applyZoom();
        },
        
        // Get current auto-fit scale (for reference)
        getAutoFitScale: function() {
            const wrapper = document.getElementById('docFrameWrapper');
            const container = document.getElementById('docFrameContainer');
            const img = wrapper ? wrapper.querySelector('img') : null;
            
            if (img && container && img.naturalWidth) {
                return calculateAutoFitScale(img, container);
            }
            return 100;
        },
        
        zoomFit: function() {
            const wrapper = document.getElementById('docFrameWrapper');
            const container = document.getElementById('docFrameContainer');
            
            if (wrapper && container) {
                const img = wrapper.querySelector('img');
                if (img && img.naturalWidth) {
                    const scale = calculateAutoFitScale(img, container);
                    currentZoom = scale;
                    applyZoom();
                } else {
                    // For PDFs, reset zoom to 100% and let iframe handle sizing
                    currentZoom = 100;
                    applyZoom();
                    const iframe = wrapper.querySelector('iframe');
                    if (iframe) {
                        const containerWidth = Math.max(container.clientWidth - 40, 800);
                        const containerHeight = Math.max(container.clientHeight - 40, 600);
                        iframe.style.width = containerWidth + 'px';
                        iframe.style.height = containerHeight + 'px';
                    }
                }
            }
        },
        
        zoomReset: function() {
            currentZoom = 100;
            applyZoom();
        },
        
        // PDF page navigation
        prevPage: function() {
            if (currentPage > 1) {
                this.goToPage(currentPage - 1);
            }
        },
        
        nextPage: function() {
            if (currentPage < totalPages) {
                this.goToPage(currentPage + 1);
            }
        },
        
        goToPage: function(page) {
            if (page >= 1 && page <= totalPages) {
                currentPage = page;
                const currentPageEl = document.getElementById('docCurrentPage');
                const totalPagesEl = document.getElementById('docTotalPages');
                if (currentPageEl) {
                    currentPageEl.textContent = page;
                }
                if (totalPagesEl) {
                    totalPagesEl.textContent = totalPages;
                }
                // Note: PDF page navigation would require PDF.js library for full implementation
                // This is a placeholder for the UI
            }
        }
    };
    
    // Global helper for PDF page updates (called from iframe)
    window.documentModalUpdatePages = function(index, pages) {
        totalPages = pages;
        currentPage = 1;
        const currentPageEl = document.getElementById('docCurrentPage');
        const totalPagesEl = document.getElementById('docTotalPages');
        const pagesEl = document.getElementById('docInfoPages');
        
        if (currentPageEl) {
            currentPageEl.textContent = 1;
        }
        if (totalPagesEl) {
            totalPagesEl.textContent = pages;
        }
        if (pagesEl) {
            pagesEl.textContent = `${pages} page${pages !== 1 ? 's' : ''}`;
        }
    };
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!modalContainer || !modalContainer.classList.contains('active')) return;
        
        // Don't handle if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            case 'Escape':
                DocumentModal.close();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                DocumentModal.prev();
                break;
            case 'ArrowRight':
                e.preventDefault();
                DocumentModal.next();
                break;
            case '+':
            case '=':
                if (e.shiftKey || e.key === '+') {
                    e.preventDefault();
                    DocumentModal.zoomIn();
                }
                break;
            case '-':
            case '_':
                if (e.shiftKey || e.key === '-') {
                    e.preventDefault();
                    DocumentModal.zoomOut();
                }
                break;
            case '0':
                if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    DocumentModal.zoomReset();
                }
                break;
        }
    });
    
    // Auto-initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModal);
    } else {
        initModal();
    }
    
    // Add resize handler for window resize
    window.addEventListener('resize', handleResize);
    
})();

// Helper function for easy document viewing
window.viewDocument = function(docOrId, allDocs) {
    if (typeof docOrId === 'string') {
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
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
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
