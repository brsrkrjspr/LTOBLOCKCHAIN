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

    // PDF rendering state (for toolbar-free viewing)
    let pdfJsLib = null;
    let pdfJsLoadingPromise = null;
    let lastPdfRenderState = null; // { data: ArrayBuffer, pageNumber: number }
    
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
                            <!-- Top navigation (shown only when multiple docs) -->
                            <div class="doc-top-nav" id="docTopNav" style="display: none;">
                                <button class="doc-top-nav-btn" id="docPrevTopBtn" onclick="DocumentModal.prev()" title="Previous document">‹</button>
                                <span class="doc-top-nav-counter" id="docTopCounter">1 / 1</span>
                                <button class="doc-top-nav-btn" id="docNextTopBtn" onclick="DocumentModal.next()" title="Next document">›</button>
                            </div>
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
                            
                            <!-- Viewer header (title + zoom like screenshot) -->
                            <div class="doc-viewer-header">
                                <h2 class="doc-viewer-title" id="docModalTitle">Document Viewer</h2>
                                <div class="doc-viewer-zoom">
                                    <button class="doc-zoom-btn" type="button" onclick="DocumentModal.zoomOut()" title="Zoom out">−</button>
                                    <span class="doc-zoom-level" id="docZoomLevel">100%</span>
                                    <button class="doc-zoom-btn" type="button" onclick="DocumentModal.zoomIn()" title="Zoom in">+</button>
                                </div>
                            </div>
                            
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
               Align fonts/colors with system UI
               ============================================ */

            :root {
                --dv-blue: #0284c7;
                --dv-blue-dark: #0369a1;
                --dv-blue-deep: #0c4a6e;
                --dv-slate: #64748b;
                --dv-text: #0f172a;
                --dv-bg: #f8fafc;
                --dv-panel: #ffffff;
                --dv-viewer-bg: #0f172a;
            }
            
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
                color: var(--dv-blue-deep);
                letter-spacing: -0.02em;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .doc-toolbar {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            
            /* Header navigation beside Share */
            .doc-top-nav {
                display: flex;
                align-items: center;
                gap: 0.45rem;
                padding-left: 0.25rem;
            }

            .doc-top-nav-btn {
                width: 44px;
                height: 40px;
                border-radius: 10px;
                border: 1px solid rgba(43, 45, 49, 0.12);
                background: #ffffff;
                color: var(--dv-blue-deep);
                cursor: pointer;
                transition: all 0.15s ease;
                font-size: 1.1rem;
                font-weight: 800;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .doc-top-nav-btn:hover:not(:disabled) {
                background: #f0f9ff;
                border-color: var(--dv-blue);
                color: var(--dv-blue);
                transform: translateY(-1px);
            }

            .doc-top-nav-btn:disabled {
                opacity: 0.45;
                cursor: not-allowed;
                transform: none;
            }

            .doc-top-nav-counter {
                min-width: 64px;
                text-align: center;
                font-size: 0.9rem;
                font-weight: 700;
                color: var(--dv-slate);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .doc-btn {
                padding: 0.6rem 1.2rem;
                border: 1px solid rgba(43, 45, 49, 0.12);
                background: white;
                color: var(--dv-blue-deep);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.875rem;
                font-weight: 600;
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
                background: var(--dv-blue);
                transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: -1;
            }
            
            .doc-btn:hover::before {
                left: 0;
            }
            
            .doc-btn:hover {
                color: white;
                border-color: var(--dv-blue);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
            }
            
            .doc-btn-primary {
                background: var(--dv-blue);
                color: white;
                border-color: var(--dv-blue);
            }
            
            .doc-btn-primary::before {
                background: var(--dv-blue-dark);
            }
            
            .doc-close-modal {
                width: 40px;
                height: 40px;
                border: 1px solid rgba(43, 45, 49, 0.12);
                background: white;
                color: var(--dv-blue);
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
                background: var(--dv-blue);
                transition: left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: -1;
            }
            
            .doc-close-modal:hover::before {
                left: 0;
            }
            
            .doc-close-modal:hover {
                color: white;
                border-color: var(--dv-blue);
                transform: translateY(-2px) rotate(90deg);
                box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
            }
            
            /* ============================================
               MAIN CONTENT SECTION
               ============================================ */
            
            .doc-modal-content {
                flex: 1;
                padding: 2rem;
                overflow: auto;
                background: var(--dv-bg);
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
                font-size: 0.85rem;
                letter-spacing: 0.02em;
                color: var(--dv-slate);
                margin-bottom: 1rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-weight: 700;
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
                letter-spacing: 0.02em;
                color: var(--dv-slate);
                margin-bottom: 0.3rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-weight: 600;
            }
            
            .doc-info-value {
                font-size: 0.95rem;
                color: var(--dv-text);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-weight: 600;
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
                color: var(--dv-blue);
                border-color: rgba(2, 132, 199, 0.2);
            }
            
            .doc-sidebar-item.active {
                background: rgba(2, 132, 199, 0.12);
                border-color: var(--dv-blue);
                color: var(--dv-blue);
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
                color: var(--dv-blue);
            }
            
            .doc-sidebar-item.active .doc-sidebar-item-icon {
                background: linear-gradient(135deg, var(--dv-blue) 0%, var(--dv-blue-dark) 100%);
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
                color: var(--dv-slate);
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
                color: var(--dv-blue-deep);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-weight: 700;
            }
            
            .doc-nav-btn:hover:not(:disabled) {
                background: #f0f9ff;
                transform: scale(1.05);
                border-color: var(--dv-blue);
                color: var(--dv-blue);
            }
            
            .doc-nav-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .doc-counter {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.85rem;
                color: var(--dv-slate);
                min-width: 60px;
                text-align: center;
            }
            
            .doc-page-indicator {
                text-align: center;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.85rem;
                color: var(--dv-slate);
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
                border: 2px solid rgba(2, 132, 199, 0.55);
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
                background: var(--dv-viewer-bg);
                position: relative;
                overflow: hidden;
                min-height: 500px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Viewer header (title + zoom like screenshot) */
            .doc-viewer-header {
                background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                color: #ffffff;
                padding: 1.25rem 1.75rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 3px solid var(--dv-blue);
                width: 100%;
                box-sizing: border-box;
            }

            .doc-viewer-title {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 700;
                letter-spacing: -0.01em;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-right: 1rem;
            }

            .doc-viewer-zoom {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 0.9rem;
                flex-shrink: 0;
            }

            .doc-zoom-btn {
                width: 40px;
                height: 40px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.25);
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
                cursor: pointer;
                transition: all 0.15s ease;
                font-size: 1.1rem;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .doc-zoom-btn:hover {
                background: rgba(255, 255, 255, 0.16);
                transform: translateY(-1px);
            }

            .doc-zoom-level {
                min-width: 56px;
                text-align: center;
                font-weight: 700;
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
                border: 3px solid rgba(2, 132, 199, 0.15);
                border-top-color: var(--dv-blue);
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
                color: #cbd5e1;
                font-weight: 500;
            }
            
            /* Error State */
            .doc-error {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: var(--dv-blue-deep);
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
                color: var(--dv-blue-deep);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-weight: 600;
            }
            
            .doc-error p {
                margin: 0 0 1.5rem 0;
                color: var(--dv-slate);
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
            
            .doc-frame-container.doc-frame-scroll {
                align-items: flex-start;
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
            
            .doc-frame-wrapper canvas.doc-pdf-canvas {
                display: block;
                width: 100%;
                height: auto;
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
                background: rgba(2, 132, 199, 0.08);
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb,
            .doc-pdf-container::-webkit-scrollbar-thumb {
                background: rgba(2, 132, 199, 0.35);
                border-radius: 3px;
            }
            
            .doc-sidebar-list::-webkit-scrollbar-thumb:hover,
            .doc-pdf-container::-webkit-scrollbar-thumb:hover {
                background: rgba(2, 132, 199, 0.5);
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

    async function ensurePdfJsLoaded() {
        if (pdfJsLib) return pdfJsLib;
        if (pdfJsLoadingPromise) return pdfJsLoadingPromise;

        const moduleUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs';
        const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

        pdfJsLoadingPromise = import(moduleUrl)
            .then((mod) => {
                const lib = (mod && mod.getDocument) ? mod : (mod && mod.default ? mod.default : null);
                if (!lib || typeof lib.getDocument !== 'function') {
                    throw new Error('PDF.js failed to load (missing getDocument).');
                }
                if (lib.GlobalWorkerOptions) {
                    lib.GlobalWorkerOptions.workerSrc = workerUrl;
                }
                pdfJsLib = lib;
                return pdfJsLib;
            })
            .catch((e) => {
                pdfJsLoadingPromise = null;
                throw e;
            });

        return pdfJsLoadingPromise;
    }

    function dataUrlToArrayBuffer(dataUrl) {
        const commaIndex = dataUrl.indexOf(',');
        const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    async function renderPdfFirstPage(arrayBuffer) {
        const frame = document.getElementById('docFrameContainer');
        const wrapper = document.getElementById('docFrameWrapper');
        const viewer = document.getElementById('docPdfContainer');

        if (!frame || !wrapper || !viewer) return;

        const pdfjs = await ensurePdfJsLoaded();
        const docTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await docTask.promise;
        const pageNumber = 1;
        const page = await pdf.getPage(pageNumber);

        // Fit-to-width target (90% of viewer width), apply zoom multiplier
        const targetWidth = Math.max(600, Math.floor(viewer.clientWidth * 0.9));
        const viewportAt1 = page.getViewport({ scale: 1 });
        const baseScale = targetWidth / viewportAt1.width;
        const scale = baseScale * (currentZoom / 100);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.className = 'doc-pdf-canvas';
        const ctx = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        wrapper.innerHTML = '';
        wrapper.appendChild(canvas);
        wrapper.style.width = canvas.width + 'px';
        wrapper.style.height = canvas.height + 'px';

        frame.style.display = 'flex';
        frame.classList.toggle('doc-frame-scroll', canvas.height > Math.floor(viewer.clientHeight * 0.9));

        await page.render({ canvasContext: ctx, viewport }).promise;
        updateZoomDisplay();
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
        const topNav = document.getElementById('docTopNav');
        
        if (!list || !listSection) return;
        
        if (currentDocuments.length <= 1) {
            listSection.style.display = 'none';
            if (pageNav) pageNav.style.display = 'none';
            if (topNav) topNav.style.display = 'none';
            return;
        }
        
        listSection.style.display = 'block';
        // Navigation controls are now in the header beside Share
        if (pageNav) pageNav.style.display = 'none';
        if (topNav) topNav.style.display = 'flex';
        
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
        const topCounter = document.getElementById('docTopCounter');
        const topPrevBtn = document.getElementById('docPrevTopBtn');
        const topNextBtn = document.getElementById('docNextTopBtn');
        
        if (counter) {
            counter.textContent = `${currentDocIndex + 1} / ${currentDocuments.length}`;
        }
        if (topCounter) {
            topCounter.textContent = `${currentDocIndex + 1} / ${currentDocuments.length}`;
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
        if (topPrevBtn) {
            topPrevBtn.disabled = currentDocuments.length <= 1 || currentDocIndex === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentDocuments.length <= 1 || currentDocIndex === currentDocuments.length - 1;
        }
        if (topNextBtn) {
            topNextBtn.disabled = currentDocuments.length <= 1 || currentDocIndex === currentDocuments.length - 1;
        }
    }
    
    // Update zoom display
    function updateZoomDisplay() {
        const zoomLevel = document.getElementById('docZoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(currentZoom)}%`;
        }
    }
    
    // Apply zoom to document (canvas/images)
    function applyZoom() {
        updateZoomDisplay();
        autoFitDocument();
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
        const pdfContainer = document.getElementById('docPdfContainer');
        
        if (!wrapper || !container || !pdfContainer) return;
        
        const img = wrapper.querySelector('img');
        const canvas = wrapper.querySelector('canvas.doc-pdf-canvas');
        
        if (img) {
            // Images: fit to container (90% width), apply zoom multiplier
            if (img.complete && img.naturalWidth) {
                const imgWidth = img.naturalWidth;
                const imgHeight = img.naturalHeight;
                
                const targetWidth = Math.max(600, Math.floor(pdfContainer.clientWidth * 0.9));
                const baseScale = targetWidth / imgWidth;
                const scale = baseScale * (currentZoom / 100);
                const finalWidth = imgWidth * scale;
                const finalHeight = imgHeight * scale;

                img.style.width = finalWidth + 'px';
                img.style.height = finalHeight + 'px';
                wrapper.style.width = finalWidth + 'px';
                wrapper.style.height = finalHeight + 'px';

                container.classList.toggle('doc-frame-scroll', finalHeight > Math.floor(pdfContainer.clientHeight * 0.9));
            } else {
                // Wait for image to load
                const originalOnload = img.onload;
                img.onload = function() {
                    if (originalOnload) originalOnload.call(this);
                    autoFitDocument();
                };
            }
        } else if (canvas && lastPdfRenderState && lastPdfRenderState.data) {
            // PDFs: re-render at new size (toolbar-free)
            renderPdfFirstPage(lastPdfRenderState.data).catch(() => {});
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
                } else if (isPdf) {
                    // Render PDF without browser toolbar
                    const buf = dataUrlToArrayBuffer(url);
                    lastPdfRenderState = { data: buf, pageNumber: 1 };
                    await renderPdfFirstPage(buf);
                } else {
                    // Non-previewable data URL type
                    if (wrapper) {
                        wrapper.innerHTML = `
                            <div style="text-align: center; padding: 3rem; color: var(--dv-charcoal); background: white; border-radius: 8px; box-shadow: 0 4px 16px var(--dv-shadow-heavy); font-family: 'Crimson Pro', serif;">
                                <i class="fas fa-file-alt" style="font-size: 4rem; color: var(--dv-rust); margin-bottom: 1rem;"></i>
                                <h3 style="margin: 0 0 0.5rem 0; color: var(--dv-charcoal); font-weight: 600;">Preview Not Available</h3>
                                <p style="color: var(--dv-slate); margin: 0 0 1.5rem 0;">This file type cannot be previewed in the browser.</p>
                                <button class="doc-btn doc-btn-primary" onclick="DocumentModal.download()">Download Document</button>
                            </div>
                        `;
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

                    // IMPORTANT: this endpoint can return PDF OR image. Detect and render accordingly.
                    const res = await fetch(iframeUrl, { headers: { 'Accept': 'image/*,application/pdf,*/*' } });
                    if (!res.ok) throw new Error(`Failed to fetch document: ${res.status} ${res.statusText}`);

                    const contentType = (res.headers.get('content-type') || '').toLowerCase();

                    // Reset last render state
                    lastPdfRenderState = null;

                    if (contentType.includes('application/pdf') || isPdf) {
                        const buf = await res.arrayBuffer();
                        lastPdfRenderState = { data: buf, pageNumber: 1 };
                        await renderPdfFirstPage(buf);
                    } else if (contentType.startsWith('image/') || isImage) {
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        activeBlobUrls.push(blobUrl);

                        if (wrapper) {
                            wrapper.innerHTML = `<img src="${blobUrl}" alt="${escapeHtml(docName)}" style="display: block; width: auto; height: auto; object-fit: contain;" />`;
                        }
                    } else {
                        // Unsupported preview type from /view
                        if (wrapper) {
                            wrapper.innerHTML = `
                                <div style="text-align: center; padding: 3rem; color: var(--dv-blue-deep); background: white; border-radius: 8px; box-shadow: 0 4px 16px rgba(43, 45, 49, 0.15); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                    <i class="fas fa-file-alt" style="font-size: 4rem; color: var(--dv-blue); margin-bottom: 1rem;"></i>
                                    <h3 style="margin: 0 0 0.5rem 0; color: var(--dv-blue-deep); font-weight: 700;">Preview Not Available</h3>
                                    <p style="color: var(--dv-slate); margin: 0 0 1.5rem 0;">This file type cannot be previewed in the browser.</p>
                                    <button class="doc-btn doc-btn-primary" onclick="DocumentModal.download()">Download Document</button>
                                </div>
                            `;
                        }
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
                        // Render PDF without toolbar
                        const buf = await blob.arrayBuffer();
                        lastPdfRenderState = { data: buf, pageNumber: 1 };
                        await renderPdfFirstPage(buf);
                        
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
                } else if (isPdf) {
                    // Try to fetch and render PDF without toolbar (may fail due to CORS)
                    const pdfRes = await fetch(url, { headers: { 'Accept': 'application/pdf' } });
                    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status} ${pdfRes.statusText}`);
                    const buf = await pdfRes.arrayBuffer();
                    lastPdfRenderState = { data: buf, pageNumber: 1 };
                    await renderPdfFirstPage(buf);
                } else {
                    // Other types: fallback to download-only UI
                    if (wrapper) {
                        wrapper.innerHTML = `
                            <div style="text-align: center; padding: 3rem; color: var(--dv-charcoal); background: white; border-radius: 8px; box-shadow: 0 4px 16px var(--dv-shadow-heavy); font-family: 'Crimson Pro', serif;">
                                <i class="fas fa-file-alt" style="font-size: 4rem; color: var(--dv-rust); margin-bottom: 1rem;"></i>
                                <h3 style="margin: 0 0 0.5rem 0; color: var(--dv-charcoal); font-weight: 600;">Preview Not Available</h3>
                                <p style="color: var(--dv-slate); margin: 0 0 1.5rem 0;">This file type cannot be previewed in the browser.</p>
                                <button class="doc-btn doc-btn-primary" onclick="DocumentModal.download()">Download Document</button>
                            </div>
                        `;
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
            currentZoom = Math.min(currentZoom + 10, 200);
            applyZoom();
        },
        
        zoomOut: function() {
            currentZoom = Math.max(currentZoom - 10, 50);
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
            // Fit-to-width baseline
            currentZoom = 100;
            applyZoom();
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
