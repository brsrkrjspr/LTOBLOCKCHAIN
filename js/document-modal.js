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
            <!-- Dark Overlay Backdrop -->
            <div class="doc-modal-overlay" onclick="DocumentModal.close()"></div>
            
            <!-- Main Modal Container -->
            <div class="doc-modal-container">
                <!-- Header Section (Sticky) -->
                <div class="doc-modal-header">
                    <div class="doc-header-left">
                        <div class="doc-title-section">
                            <h2 class="doc-title" id="docModalTitle">Document Viewer</h2>
                            <span class="doc-page-indicator" id="docPageIndicator" style="display: none;">Page 1 of 1</span>
                        </div>
                    </div>
                    
                    <div class="doc-header-center">
                        <div class="doc-nav-controls" id="docNavControls" style="display: none;">
                            <button class="doc-nav-btn" id="docPrevBtn" onclick="DocumentModal.prev()" title="Previous Document (←)">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <span class="doc-counter" id="docCounter">1 / 1</span>
                            <button class="doc-nav-btn" id="docNextBtn" onclick="DocumentModal.next()" title="Next Document (→)">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="doc-header-right">
                        <button class="doc-header-btn" id="docDownloadBtn" onclick="DocumentModal.download()" title="Download Document">
                            <i class="fas fa-download"></i>
                            <span class="btn-label">Download</span>
                        </button>
                        <button class="doc-header-btn doc-close-btn" onclick="DocumentModal.close()" title="Close (ESC)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Main Content Area -->
                <div class="doc-modal-body">
                    <!-- Left Sidebar (Document List) -->
                    <aside class="doc-sidebar" id="docSidebar">
                        <div class="doc-sidebar-header">
                            <h3><i class="fas fa-list"></i> Documents</h3>
                            <button class="doc-sidebar-toggle" id="docSidebarToggle" onclick="DocumentModal.toggleSidebar()" title="Toggle Sidebar">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                        </div>
                        <div class="doc-sidebar-list" id="docSidebarList">
                            <!-- Document list will be populated here -->
                        </div>
                    </aside>
                    
                    <!-- Main Viewer Area -->
                    <div class="doc-viewer-area" id="docViewerArea">
                        <!-- Loading State -->
                        <div class="doc-loading" id="docLoading">
                            <div class="doc-loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                            </div>
                            <p>Loading document...</p>
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
                                <button class="doc-btn doc-btn-secondary" onclick="DocumentModal.download()">
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
                
                <!-- Footer Section (Optional Controls) -->
                <div class="doc-modal-footer" id="docModalFooter" style="display: none;">
                    <div class="doc-footer-left">
                        <div class="doc-zoom-controls">
                            <button class="doc-zoom-btn" onclick="DocumentModal.zoomOut()" title="Zoom Out (-)">
                                <i class="fas fa-search-minus"></i>
                            </button>
                            <span class="doc-zoom-level" id="docZoomLevel">100%</span>
                            <button class="doc-zoom-btn" onclick="DocumentModal.zoomIn()" title="Zoom In (+)">
                                <i class="fas fa-search-plus"></i>
                            </button>
                            <button class="doc-zoom-btn" onclick="DocumentModal.zoomFit()" title="Fit to Width">
                                <i class="fas fa-expand-arrows-alt"></i>
                            </button>
                            <button class="doc-zoom-btn" onclick="DocumentModal.zoomReset()" title="Reset Zoom">
                                <i class="fas fa-undo"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="doc-footer-center" id="docPdfControls" style="display: none;">
                        <div class="doc-pdf-nav">
                            <button class="doc-pdf-btn" id="docPdfPrevBtn" onclick="DocumentModal.prevPage()" title="Previous Page">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <input type="number" class="doc-page-input" id="docPageInput" min="1" value="1" onchange="DocumentModal.goToPage(parseInt(this.value))">
                            <span class="doc-page-separator">of</span>
                            <span class="doc-total-pages" id="docTotalPages">1</span>
                            <button class="doc-pdf-btn" id="docPdfNextBtn" onclick="DocumentModal.nextPage()" title="Next Page">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="doc-footer-right">
                        <!-- Reserved for future controls -->
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
               DOCUMENT MODAL - PROFESSIONAL ADMIN THEME
               Dark Navy/Charcoal Government System UI
               ============================================ */
            
            .doc-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 20000;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            .doc-modal.active {
                display: flex;
                animation: docFadeIn 0.2s ease;
            }
            
            @keyframes docFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            /* Dark Overlay Backdrop */
            .doc-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }
            
            /* Main Modal Container */
            .doc-modal-container {
                position: relative;
                width: 95%;
                max-width: 1600px;
                height: 90vh;
                max-height: 900px;
                margin: auto;
                background: #1a1d29;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
                animation: docSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            @keyframes docSlideUp {
                from {
                    transform: translateY(30px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            /* ============================================
               HEADER SECTION (Sticky)
               ============================================ */
            
            .doc-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem 1.5rem;
                background: #0f1117;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                flex-shrink: 0;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            
            .doc-header-left {
                flex: 1;
                min-width: 0;
            }
            
            .doc-title-section {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }
            
            .doc-title {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 600;
                color: #ffffff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 400px;
            }
            
            .doc-page-indicator {
                font-size: 0.875rem;
                color: #9ca3af;
                font-weight: 500;
            }
            
            .doc-header-center {
                flex: 0 0 auto;
                display: flex;
                align-items: center;
            }
            
            .doc-nav-controls {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                background: rgba(255, 255, 255, 0.05);
                padding: 0.5rem 1rem;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .doc-nav-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                width: 36px;
                height: 36px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                font-size: 0.875rem;
            }
            
            .doc-nav-btn:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
                transform: scale(1.05);
            }
            
            .doc-nav-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .doc-counter {
                font-weight: 600;
                font-size: 0.9375rem;
                color: #ffffff;
                min-width: 60px;
                text-align: center;
            }
            
            .doc-header-right {
                flex: 0 0 auto;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .doc-header-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                padding: 0.625rem 1rem;
                border-radius: 8px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                transition: all 0.2s ease;
                font-size: 0.9375rem;
                font-weight: 500;
            }
            
            .doc-header-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .doc-header-btn .btn-label {
                display: inline;
            }
            
            .doc-close-btn:hover {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.4);
                color: #fca5a5;
            }
            
            /* ============================================
               BODY SECTION (Sidebar + Viewer)
               ============================================ */
            
            .doc-modal-body {
                flex: 1;
                display: flex;
                min-height: 0;
                background: #0f1117;
                overflow: hidden;
            }
            
            /* Left Sidebar */
            .doc-sidebar {
                width: 280px;
                background: #151821;
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                transition: transform 0.3s ease, width 0.3s ease;
            }
            
            .doc-sidebar.collapsed {
                width: 0;
                transform: translateX(-100%);
                border-right: none;
            }
            
            .doc-sidebar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem 1.25rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .doc-sidebar-header h3 {
                margin: 0;
                font-size: 0.9375rem;
                font-weight: 600;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .doc-sidebar-header h3 i {
                color: #60a5fa;
            }
            
            .doc-sidebar-toggle {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .doc-sidebar-toggle:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .doc-sidebar.collapsed .doc-sidebar-toggle i {
                transform: rotate(180deg);
            }
            
            .doc-sidebar-list {
                flex: 1;
                overflow-y: auto;
                padding: 0.75rem;
            }
            
            /* Custom Scrollbar */
            .doc-sidebar-list::-webkit-scrollbar {
                width: 6px;
            }
            
            .doc-sidebar-list::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            /* Sidebar Document Item */
            .doc-sidebar-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.875rem 1rem;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #d1d5db;
                margin-bottom: 0.5rem;
                border: 2px solid transparent;
            }
            
            .doc-sidebar-item:hover {
                background: rgba(96, 165, 250, 0.1);
                color: #ffffff;
                border-color: rgba(96, 165, 250, 0.2);
            }
            
            .doc-sidebar-item.active {
                background: rgba(96, 165, 250, 0.2);
                border-color: #60a5fa;
                color: #ffffff;
            }
            
            .doc-sidebar-item-icon {
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
                font-size: 1.125rem;
                flex-shrink: 0;
            }
            
            .doc-sidebar-item.active .doc-sidebar-item-icon {
                background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
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
            }
            
            .doc-sidebar-item-type {
                font-size: 0.75rem;
                color: #9ca3af;
            }
            
            /* Main Viewer Area */
            .doc-viewer-area {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                background: #0a0c10;
                min-width: 0;
                min-height: 0;
                overflow: hidden;
            }
            
            /* Loading State */
            .doc-loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #ffffff;
                z-index: 5;
            }
            
            .doc-loading-spinner {
                font-size: 3rem;
                color: #60a5fa;
                margin-bottom: 1rem;
            }
            
            .doc-loading p {
                font-size: 1rem;
                color: #9ca3af;
                margin: 0;
            }
            
            /* Error State */
            .doc-error {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #ffffff;
                z-index: 5;
                max-width: 400px;
                padding: 2rem;
            }
            
            .doc-error-icon {
                font-size: 4rem;
                color: #ef4444;
                margin-bottom: 1rem;
            }
            
            .doc-error h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.25rem;
                color: #ffffff;
            }
            
            .doc-error p {
                margin: 0 0 1.5rem 0;
                color: #9ca3af;
                font-size: 0.9375rem;
            }
            
            .doc-error-actions {
                display: flex;
                gap: 0.75rem;
                justify-content: center;
            }
            
            .doc-btn {
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 0.9375rem;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                transition: all 0.2s ease;
            }
            
            .doc-btn-primary {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: #ffffff;
            }
            
            .doc-btn-primary:hover {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }
            
            .doc-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .doc-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
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
            
            /* PDF Auto-fit Container */
            .doc-pdf-container {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: auto;
            }
            
            .doc-pdf-iframe-wrapper {
                position: relative;
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                margin: auto;
            }
            
            /* ============================================
               FOOTER SECTION (Controls)
               ============================================ */
            
            .doc-modal-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.875rem 1.5rem;
                background: #0f1117;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                flex-shrink: 0;
            }
            
            .doc-footer-left,
            .doc-footer-center,
            .doc-footer-right {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .doc-zoom-controls {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                padding: 0.5rem 1rem;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .doc-zoom-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                font-size: 0.875rem;
            }
            
            .doc-zoom-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .doc-zoom-level {
                font-weight: 600;
                font-size: 0.875rem;
                color: #ffffff;
                min-width: 50px;
                text-align: center;
            }
            
            .doc-pdf-nav {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                padding: 0.5rem 1rem;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .doc-pdf-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                font-size: 0.875rem;
            }
            
            .doc-pdf-btn:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .doc-pdf-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .doc-page-input {
                width: 60px;
                padding: 0.375rem 0.5rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                color: #ffffff;
                font-size: 0.875rem;
                text-align: center;
            }
            
            .doc-page-input:focus {
                outline: none;
                border-color: #60a5fa;
                background: rgba(255, 255, 255, 0.15);
            }
            
            .doc-page-separator,
            .doc-total-pages {
                font-size: 0.875rem;
                color: #9ca3af;
                font-weight: 500;
            }
            
            /* ============================================
               RESPONSIVE DESIGN
               ============================================ */
            
            @media (max-width: 1024px) {
                .doc-modal-container {
                    width: 100%;
                    height: 100vh;
                    max-height: 100vh;
                    border-radius: 0;
                }
                
                .doc-sidebar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    z-index: 20;
                    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
                }
                
                .doc-sidebar:not(.collapsed) {
                    transform: translateX(0);
                }
                
                .doc-header-btn .btn-label {
                    display: none;
                }
            }
            
            @media (max-width: 768px) {
                .doc-modal-header {
                    padding: 0.875rem 1rem;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                }
                
                .doc-title {
                    font-size: 1.125rem;
                    max-width: 200px;
                }
                
                .doc-nav-controls {
                    order: 3;
                    width: 100%;
                    justify-content: center;
                }
                
                .doc-header-right {
                    order: 2;
                }
                
                .doc-frame-container {
                    padding: 1rem;
                }
                
                .doc-modal-footer {
                    padding: 0.75rem 1rem;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                
                .doc-footer-center {
                    order: 3;
                    width: 100%;
                    justify-content: center;
                }
            }
            
            @media (max-width: 480px) {
                .doc-title {
                    font-size: 1rem;
                    max-width: 150px;
                }
                
                .doc-sidebar {
                    width: 100%;
                }
                
                .doc-zoom-controls {
                    flex-wrap: wrap;
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
    
    // Render sidebar document list
    function renderSidebar() {
        const list = document.getElementById('docSidebarList');
        const sidebar = document.getElementById('docSidebar');
        const navControls = document.getElementById('docNavControls');
        
        if (!list || !sidebar) return;
        
        if (currentDocuments.length <= 1) {
            sidebar.classList.add('collapsed');
            if (navControls) navControls.style.display = 'none';
            return;
        }
        
        sidebar.classList.remove('collapsed');
        if (navControls) navControls.style.display = 'flex';
        
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
                        <div class="doc-sidebar-item-title">${escapeHtml(docName)}</div>
                        <div class="doc-sidebar-item-type">${escapeHtml(docLabel)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Update navigation counter
    function updateCounter() {
        const counter = document.getElementById('docCounter');
        const prevBtn = document.getElementById('docPrevBtn');
        const nextBtn = document.getElementById('docNextBtn');
        
        if (counter) {
            counter.textContent = `${currentDocIndex + 1} / ${currentDocuments.length}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = currentDocuments.length <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentDocuments.length <= 1;
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
        const footer = document.getElementById('docModalFooter');
        const pdfControls = document.getElementById('docPdfControls');
        
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
        if (loading) loading.style.display = 'block';
        if (frame) frame.style.display = 'none';
        if (error) error.style.display = 'none';
        if (pdfControls) pdfControls.style.display = 'none';
        
        // Update title
        const docName = doc.filename || doc.original_name || doc.name || getDocTypeLabel(doc.type || doc.document_type);
        if (title) {
            title.textContent = docName;
        }
        
        if (pageIndicator) {
            pageIndicator.style.display = 'none';
        }
        
        try {
            let url = null;
            const token = getAuthToken();
            
            console.log('[DocumentModal] loadDocument input:', {
                doc_id: doc.id,
                doc_url: doc.url,
                doc_cid: doc.cid,
                doc_ipfs_cid: doc.ipfs_cid,
                doc_mime_type: doc.mime_type,
                token_exists: !!token
            });
            
            // Priority 1: Document ID (UUID)
            if (doc.id && typeof doc.id === 'string') {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id);
                if (isUUID) {
                    url = `/api/documents/${doc.id}/view`;
                    console.log('[DocumentModal] Using Priority 1 (UUID):', url);
                }
            }
            
            // Priority 2: Data URL
            if (!url && doc.url && typeof doc.url === 'string' && doc.url.startsWith('data:')) {
                url = doc.url;
                console.log('[DocumentModal] Using Priority 2 (Data URL)');
            }
            // Priority 3: IPFS CID
            else if (!url && (doc.cid || doc.ipfs_cid)) {
                const cid = doc.cid || doc.ipfs_cid;
                url = `/api/documents/ipfs/${cid}`;
                console.log('[DocumentModal] Using Priority 3 (IPFS):', url);
            }
            // Priority 4: Direct URL
            else if (!url && doc.url && typeof doc.url === 'string' && 
                     (doc.url.startsWith('http') || doc.url.startsWith('/api/') || doc.url.startsWith('/uploads/'))) {
                url = doc.url;
                console.log('[DocumentModal] Using Priority 4 (Direct URL):', url);
            }
            // Fallback
            else if (!url && doc.url) {
                url = doc.url;
                console.log('[DocumentModal] Using Fallback URL:', url);
            }
            
            if (!url) {
                throw new Error('No document URL available. doc=' + JSON.stringify(doc));
            }
            
            console.log('[DocumentModal] Final URL selected:', url);
            
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
            // Handle API/server endpoints
            else if (url.startsWith('/api/') || url.startsWith('/uploads/')) {
                console.log('[DocumentModal] Fetching from API/server:', { url, token_exists: !!token });
                
                try {
                    const response = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'image/*,application/pdf,*/*'
                        }
                    });
                    
                    console.log('[DocumentModal] Fetch response:', {
                        status: response.status,
                        statusText: response.statusText,
                        contentType: response.headers.get('content-type'),
                        contentLength: response.headers.get('content-length')
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('[DocumentModal] Server error response:', errorText);
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }
                    
                    const blob = await response.blob();
                    console.log('[DocumentModal] Blob received:', {
                        size: blob.size,
                        type: blob.type
                    });
                    
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
                    
                    // Show PDF controls
                    if (pdfControls) pdfControls.style.display = 'flex';
                    if (footer) footer.style.display = 'flex';
                } else {
                    // Other file types - show download option
                    if (wrapper) {
                        wrapper.innerHTML = `
                            <div style="text-align: center; padding: 3rem; color: #ffffff;">
                                <i class="fas fa-file-alt" style="font-size: 4rem; color: #60a5fa; margin-bottom: 1rem;"></i>
                                <h3 style="margin: 0 0 0.5rem 0; color: #ffffff;">Preview Not Available</h3>
                                <p style="color: #9ca3af; margin: 0 0 1.5rem 0;">This file type cannot be previewed in the browser.</p>
                                <button class="doc-btn doc-btn-primary" onclick="DocumentModal.download()">
                                    <i class="fas fa-download"></i> Download Document
                                </button>
                            </div>
                        `;
                    }
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
            if (footer) footer.style.display = 'flex';
            
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
                const pageInput = document.getElementById('docPageInput');
                if (pageInput) {
                    pageInput.value = page;
                }
                const pageIndicator = document.getElementById('docPageIndicator');
                if (pageIndicator) {
                    pageIndicator.textContent = `Page ${page} of ${totalPages}`;
                    pageIndicator.style.display = 'inline';
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
        const pageInput = document.getElementById('docPageInput');
        const totalPagesEl = document.getElementById('docTotalPages');
        const pageIndicator = document.getElementById('docPageIndicator');
        
        if (pageInput) {
            pageInput.max = pages;
            pageInput.value = 1;
        }
        if (totalPagesEl) {
            totalPagesEl.textContent = pages;
        }
        if (pageIndicator) {
            pageIndicator.textContent = `Page 1 of ${pages}`;
            pageIndicator.style.display = 'inline';
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
