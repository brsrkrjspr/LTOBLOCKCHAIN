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
                            
                            <div class="doc-viewer-header">
                                <h2 class="doc-title" id="docModalTitle">Document Viewer</h2>
                                <div class="doc-zoom-controls">
                                    <button class="doc-zoom-btn" onclick="DocumentModal.zoomOut()" title="Zoom Out (-)">−</button>
                                    <span class="doc-zoom-level" id="docZoomLevel">100%</span>
                                    <button class="doc-zoom-btn" onclick="DocumentModal.zoomIn()" title="Zoom In (+)">+</button>
                                </div>
                            </div>

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
                                
                                <!-- Document Frame -->
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
               DOCUMENT MODAL - RUST/GOLD/CHARCOAL THEME
               Matches Provided Design
               ============================================ */
            
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
            
            :root {
                --cream: #FBF9F4;
                --charcoal: #2B2D31;
                --slate: #5A5D63;
                --rust: #C7492A;
                --gold: #D4A574;
                --shadow: rgba(43, 45, 49, 0.08);
                --shadow-heavy: rgba(43, 45, 49, 0.15);
            }
            
            .doc-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 20000;
                font-family: 'Crimson Pro', serif;
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
                color: var(--charcoal);
                letter-spacing: -0.02em;
                font-family: 'Crimson Pro', serif;
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
                color: var(--charcoal);
                font-family: 'IBM Plex Mono', monospace;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.08em;
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
                background: var(--rust);
                transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: -1;
            }
            
            .doc-btn:hover::before {
                left: 0;
            }
            
            .doc-btn:hover {
                color: white;
                border-color: var(--rust);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px var(--shadow-heavy);
            }
            
            .doc-btn-primary {
                background: var(--rust);
                color: white;
                border-color: var(--rust);
            }
            
            .doc-btn-primary::before {
                background: var(--charcoal);
            }
            
            .doc-close-modal {
                width: 40px;
                height: 40px;
                border: 1px solid rgba(43, 45, 49, 0.12);
                background: white;
                color: var(--rust);
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
                background: var(--rust);
                transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: -1;
            }
            
            .doc-close-modal:hover::before {
                left: 0;
            }
            
            .doc-close-modal:hover {
                color: white;
                border-color: var(--rust);
                transform: translateY(-2px) rotate(90deg);
                box-shadow: 0 4px 12px var(--shadow-heavy);
            }
            
            /* ============================================
               MAIN CONTENT SECTION
               ============================================ */
            
            .doc-modal-content {
                flex: 1;
                padding: 2rem;
                overflow: auto;
                background: linear-gradient(135deg, #E8E4DC 0%, #D4CFC4 100%);
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
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.12em;
                color: var(--slate);
                margin-bottom: 1rem;
                font-family: 'IBM Plex Mono', monospace;
                font-weight: 500;
            }
            
            .doc-info {
                background: white;
                border: 1px solid rgba(43, 45, 49, 0.08);
                padding: 1.5rem;
                box-shadow: 0 2px 8px var(--shadow);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                margin-bottom: 2rem;
            }
            
            .doc-info:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px var(--shadow-heavy);
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
                font-size: 0.7rem;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--slate);
                margin-bottom: 0.3rem;
                font-family: 'IBM Plex Mono', monospace;
            }
            
            .doc-info-value {
                font-size: 0.95rem;
                color: var(--charcoal);
                font-family: 'Crimson Pro', serif;
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
                color: var(--charcoal);
                margin-bottom: 0.5rem;
                border: 2px solid transparent;
            }
            
            .doc-sidebar-item:hover {
                background: var(--cream);
                color: var(--charcoal);
                border-color: rgba(199, 73, 42, 0.2);
            }
            
            .doc-sidebar-item.active {
                background: rgba(199, 73, 42, 0.1);
                border-color: var(--rust);
                color: var(--charcoal);
            }
            
            .doc-sidebar-item-icon {
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                background: rgba(199, 73, 42, 0.1);
                font-size: 1.125rem;
                flex-shrink: 0;
                color: var(--rust);
            }
            
            .doc-sidebar-item.active .doc-sidebar-item-icon {
                background: var(--rust);
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
                font-family: 'Crimson Pro', serif;
            }
            
            .doc-sidebar-item-type {
                font-size: 0.75rem;
                color: var(--slate);
                font-family: 'Crimson Pro', serif;
            }
            
            .doc-page-nav {
                background: white;
                border: 1px solid rgba(43, 45, 49, 0.08);
                padding: 1.5rem;
                box-shadow: 0 2px 8px var(--shadow);
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
                color: var(--charcoal);
            }
            
            .doc-nav-btn:hover:not(:disabled) {
                background: var(--cream);
                transform: scale(1.05);
            }
            
            .doc-nav-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .doc-counter {
                font-family: 'IBM Plex Mono', monospace;
                font-size: 0.85rem;
                color: var(--slate);
                min-width: 60px;
                text-align: center;
            }
            
            .doc-page-indicator {
                text-align: center;
                font-family: 'IBM Plex Mono', monospace;
                font-size: 0.85rem;
                color: var(--slate);
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
                border: 2px solid var(--gold);
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
            
            .doc-viewer-header {
                background: linear-gradient(135deg, var(--charcoal) 0%, var(--slate) 100%);
                color: white;
                padding: 1.5rem 2rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 3px solid var(--rust);
            }
            
            .doc-title {
                font-size: 1.5rem;
                font-weight: 600;
                letter-spacing: -0.01em;
                margin: 0;
                color: white;
                font-family: 'Crimson Pro', serif;
            }
            
            .doc-zoom-controls {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            
            .doc-zoom-btn {
                width: 36px;
                height: 36px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                background: rgba(255, 255, 255, 0.1);
                color: white;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(8px);
            }
            
            .doc-zoom-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(1.1);
            }
            
            .doc-zoom-level {
                font-family: 'IBM Plex Mono', monospace;
                font-size: 0.85rem;
                min-width: 50px;
                text-align: center;
            }
            
            .doc-pdf-container {
                flex: 1;
                background: var(--cream);
                position: relative;
                overflow: auto;
                min-height: 500px;
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
                border: 3px solid rgba(199, 73, 42, 0.1);
                border-top-color: var(--rust);
                border-radius: 50%;
                animation: docSpin 1s linear infinite;
            }
            
            @keyframes docSpin {
                to { transform: rotate(360deg); }
            }
            
            .doc-loading-text {
                margin-top: 1rem;
                font-family: 'IBM Plex Mono', monospace;
                font-size: 0.85rem;
                color: var(--slate);
                text-transform: uppercase;
                letter-spacing: 0.12em;
            }
            
            /* Error State */
            .doc-error {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: var(--charcoal);
                z-index: 5;
                max-width: 400px;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 16px var(--shadow-heavy);
            }
            
            .doc-error-icon {
                font-size: 4rem;
                color: #ef4444;
                margin-bottom: 1rem;
            }
            
            .doc-error h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.25rem;
                color: var(--charcoal);
                font-family: 'Crimson Pro', serif;
            }
            
            .doc-error p {
                margin: 0 0 1.5rem 0;
                color: var(--slate);
                font-size: 0.9375rem;
                font-family: 'Crimson Pro', serif;
            }
            
            .doc-error-actions {
                display: flex;
                gap: 0.75rem;
                justify-content: center;
            }
            
            /* Document Frame Container */
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
            }
            
            .doc-frame-wrapper {
                position: relative;
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                overflow: visible;
                transition: transform 0.2s ease;
                margin: auto;
                max-width: calc(100% - 2rem);
                max-height: calc(100% - 2rem);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .doc-frame-wrapper img {
                display: block;
                width: auto;
                height: auto;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                margin: 0 auto;
                border-radius: 8px;
            }
            
            .doc-frame-wrapper iframe,
            .doc-frame-wrapper embed {
                display: block;
                width: 100%;
                height: 100%;
                min-width: 800px;
                min-height: 600px;
                border: none;
                background: #ffffff;
                border-radius: 8px;
            }
            
            /* Ensure PDFs are readable by default */
            .doc-frame-wrapper iframe[type="application/pdf"] {
                width: 100% !important;
                height: 100% !important;
            }
            
            /* Custom Scrollbar */
            .doc-sidebar-list::-webkit-scrollbar,
            .doc-pdf-container::-webkit-scrollbar {
                width: 6px;
            }
            
            .doc-sidebar-list::-webkit-scrollbar-track,
            .doc-pdf-container::-webkit-scrollbar-track {
                background: rgba(199, 73, 42, 0.05);
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb,
            .doc-pdf-container::-webkit-scrollbar-thumb {
                background: rgba(199, 73, 42, 0.2);
                border-radius: 3px;
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb:hover,
            .doc-pdf-container::-webkit-scrollbar-thumb:hover {
                background: rgba(199, 73, 42, 0.3);
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
                
                .doc-title {
                    font-size: 1.25rem;
                }
                
                .doc-viewer-header {
                    padding: 1rem 1.5rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                
                .doc-zoom-controls {
                    flex-wrap: wrap;
                }
                
                .doc-pdf-container {
                    min-height: 400px;
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
                
                .doc-title {
                    font-size: 1.125rem;
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
    
    // Apply zoom to document
    function applyZoom() {
        const wrapper = document.getElementById('docFrameWrapper');
        if (wrapper) {
            wrapper.style.transform = `scale(${currentZoom / 100})`;
            wrapper.style.transformOrigin = 'center center';
        }
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
    
    // Auto-fit document to container
    function autoFitDocument() {
        const wrapper = document.getElementById('docFrameWrapper');
        const container = document.getElementById('docFrameContainer');
        
        if (!wrapper || !container) return;
        
        const img = wrapper.querySelector('img');
        const iframe = wrapper.querySelector('iframe');
        
        if (img) {
            // For images, calculate auto-fit scale
            if (img.complete && img.naturalWidth) {
                const scale = calculateAutoFitScale(img, container);
                currentZoom = scale;
                applyZoom();
            } else {
                // Wait for image to load
                const originalOnload = img.onload;
                img.onload = function() {
                    if (originalOnload) originalOnload.call(this);
                    const scale = calculateAutoFitScale(img, container);
                    currentZoom = scale;
                    applyZoom();
                };
            }
        } else if (iframe) {
            // For PDFs, ensure iframe uses full container size
            const containerWidth = Math.max(container.clientWidth - 40, 1000);
            const containerHeight = Math.max(container.clientHeight - 40, 700);
            
            // Set wrapper to full container size for PDFs
            wrapper.style.width = containerWidth + 'px';
            wrapper.style.height = containerHeight + 'px';
            wrapper.style.maxWidth = 'none';
            wrapper.style.maxHeight = 'none';
            
            // Ensure iframe fills wrapper completely
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.minWidth = '0';
            iframe.style.minHeight = '0';
            
            // PDFs don't need zoom scaling - they use iframe size
            currentZoom = 100;
            applyZoom();
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
        
        // Reset wrapper styles
        if (wrapper) {
            wrapper.style.width = 'auto';
            wrapper.style.height = 'auto';
            wrapper.style.maxWidth = 'calc(100% - 2rem)';
            wrapper.style.maxHeight = 'calc(100% - 2rem)';
        }
        
        applyZoom();
        
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
                        // Reset wrapper styles for images
                        wrapper.style.width = 'auto';
                        wrapper.style.height = 'auto';
                        wrapper.style.maxWidth = 'calc(100% - 2rem)';
                        wrapper.style.maxHeight = 'calc(100% - 2rem)';
                        
                        wrapper.innerHTML = `<img src="${url}" alt="${escapeHtml(docName)}" style="display: block; width: auto; height: auto; max-width: 100%; max-height: 100%;" />`;
                        // Auto-fit after image loads
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
                        const container = document.getElementById('docFrameContainer');
                        let containerWidth = 1200;
                        let containerHeight = 800;
                        
                        if (container) {
                            containerWidth = Math.max(container.clientWidth - 40, 1000);
                            containerHeight = Math.max(container.clientHeight - 40, 700);
                        }
                        
                        // Set wrapper to match container size
                        wrapper.style.width = containerWidth + 'px';
                        wrapper.style.height = containerHeight + 'px';
                        wrapper.style.maxWidth = 'none';
                        wrapper.style.maxHeight = 'none';
                        
                        wrapper.innerHTML = `<iframe src="${url}" title="${escapeHtml(docName)}" style="width: 100%; height: 100%; border: none; display: block;"></iframe>`;
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
                    
                    // Calculate container size
                    const container = document.getElementById('docFrameContainer');
                    let containerWidth = 1200;
                    let containerHeight = 800;
                    
                    if (container) {
                        containerWidth = Math.max(container.clientWidth - 40, 1000);
                        containerHeight = Math.max(container.clientHeight - 40, 700);
                    }
                    
                    if (wrapper) {
                        // Set wrapper to match container size
                        wrapper.style.width = containerWidth + 'px';
                        wrapper.style.height = containerHeight + 'px';
                        wrapper.style.maxWidth = 'none';
                        wrapper.style.maxHeight = 'none';
                        
                        // Load directly via iframe URL with token - no blob URL needed!
                        wrapper.innerHTML = `
                            <iframe src="${iframeUrl}" 
                                    type="application/pdf" 
                                    title="${escapeHtml(docName)}"
                                    style="width: 100%; height: 100%; border: none; display: block;"></iframe>
                        `;
                        
                        // Ensure iframe fills wrapper completely
                        setTimeout(() => {
                            const iframe = wrapper.querySelector('iframe');
                            if (iframe && container) {
                                const newWidth = Math.max(container.clientWidth - 40, 1000);
                                const newHeight = Math.max(container.clientHeight - 40, 700);
                                wrapper.style.width = newWidth + 'px';
                                wrapper.style.height = newHeight + 'px';
                                iframe.style.width = '100%';
                                iframe.style.height = '100%';
                            }
                        }, 100);
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
                                // Reset wrapper styles for images
                                wrapper.style.width = 'auto';
                                wrapper.style.height = 'auto';
                                wrapper.style.maxWidth = 'calc(100% - 2rem)';
                                wrapper.style.maxHeight = 'calc(100% - 2rem)';
                                
                                wrapper.innerHTML = `<img src="${e.target.result}" alt="${escapeHtml(docName)}" style="display: block; width: auto; height: auto; max-width: 100%; max-height: 100%;" />`;
                                // Auto-fit after image loads
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
                        // Use blob URL for PDFs
                        const blobUrl = URL.createObjectURL(blob);
                        activeBlobUrls.push(blobUrl);
                        
                        // Calculate container size for PDF - use full available space
                        const container = document.getElementById('docFrameContainer');
                        let containerWidth = 1200; // Default fallback
                        let containerHeight = 800; // Default fallback
                        
                        if (container) {
                            containerWidth = Math.max(container.clientWidth - 40, 1000);
                            containerHeight = Math.max(container.clientHeight - 40, 700);
                        }
                        
                        if (wrapper) {
                            // Set wrapper to match container size
                            wrapper.style.width = containerWidth + 'px';
                            wrapper.style.height = containerHeight + 'px';
                            wrapper.style.maxWidth = 'none';
                            wrapper.style.maxHeight = 'none';
                            
                            wrapper.innerHTML = `
                                <iframe src="${blobUrl}" 
                                        type="application/pdf" 
                                        title="${escapeHtml(docName)}"
                                        style="width: 100%; height: 100%; border: none; display: block;"></iframe>
                            `;
                            
                            // Ensure iframe fills wrapper completely
                            setTimeout(() => {
                                const iframe = wrapper.querySelector('iframe');
                                if (iframe && container) {
                                    const newWidth = Math.max(container.clientWidth - 40, 1000);
                                    const newHeight = Math.max(container.clientHeight - 40, 700);
                                    wrapper.style.width = newWidth + 'px';
                                    wrapper.style.height = newHeight + 'px';
                                    iframe.style.width = '100%';
                                    iframe.style.height = '100%';
                                }
                            }, 100);
                        }
                        
                        // PDF loaded successfully
                    } else {
                        // Other file types - show download option
                        if (wrapper) {
                            wrapper.innerHTML = `
                                <div style="text-align: center; padding: 3rem; color: var(--charcoal); background: white; border-radius: 8px; box-shadow: 0 4px 16px var(--shadow-heavy);">
                                    <i class="fas fa-file-alt" style="font-size: 4rem; color: var(--rust); margin-bottom: 1rem;"></i>
                                    <h3 style="margin: 0 0 0.5rem 0; color: var(--charcoal); font-family: 'Crimson Pro', serif;">Preview Not Available</h3>
                                    <p style="color: var(--slate); margin: 0 0 1.5rem 0; font-family: 'Crimson Pro', serif;">This file type cannot be previewed in the browser.</p>
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
                // Direct external URL
                if (isImage) {
                    if (wrapper) {
                        // Reset wrapper styles for images
                        wrapper.style.width = 'auto';
                        wrapper.style.height = 'auto';
                        wrapper.style.maxWidth = 'calc(100% - 2rem)';
                        wrapper.style.maxHeight = 'calc(100% - 2rem)';
                        
                        wrapper.innerHTML = `<img src="${url}" alt="${escapeHtml(docName)}" style="display: block; width: auto; height: auto; max-width: 100%; max-height: 100%;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'text-align:center;padding:2rem;color:#ef4444;\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'font-size:2rem;margin-bottom:0.5rem;\\'></i><p>Image failed to load</p></div>';" />`;
                        // Auto-fit after image loads
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
                        const container = document.getElementById('docFrameContainer');
                        let containerWidth = 1200;
                        let containerHeight = 800;
                        
                        if (container) {
                            containerWidth = Math.max(container.clientWidth - 40, 1000);
                            containerHeight = Math.max(container.clientHeight - 40, 700);
                        }
                        
                        // Set wrapper to match container size
                        wrapper.style.width = containerWidth + 'px';
                        wrapper.style.height = containerHeight + 'px';
                        wrapper.style.maxWidth = 'none';
                        wrapper.style.maxHeight = 'none';
                        
                        wrapper.innerHTML = `<iframe src="${url}" title="${escapeHtml(docName)}" style="width: 100%; height: 100%; border: none; display: block;"></iframe>`;
                    }
                }
            }
            
            // Show frame
            if (loading) loading.style.display = 'none';
            if (frame) frame.style.display = 'flex';
            
            // Auto-fit document after container is fully rendered
            // Use requestAnimationFrame for better timing
            requestAnimationFrame(() => {
                setTimeout(() => {
                    autoFitDocument();
                }, 100);
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
