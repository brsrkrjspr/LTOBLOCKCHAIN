// TrustChain LTO - Mobile Navigation Handler
// Handles mobile menu toggle and responsive sidebar behavior

(function() {
    'use strict';
    
    let sidebar = null;
    let overlay = null;
    let toggleBtn = null;
    
    // Initialize mobile navigation
    function init() {
        sidebar = document.querySelector('.dashboard-sidebar');
        if (!sidebar) return;
        
        // Create mobile menu toggle button if it doesn't exist
        createMobileToggle();
        
        // Create overlay for sidebar
        createOverlay();
        
        // Handle window resize
        window.addEventListener('resize', handleResize);
        handleResize();
        
        // Handle escape key to close sidebar
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
                closeMobileSidebar();
            }
        });
    }
    
    // Create mobile menu toggle button
    function createMobileToggle() {
        // Check if toggle already exists
        if (document.querySelector('.mobile-menu-toggle')) return;
        
        const header = document.querySelector('.dashboard-header .dashboard-nav');
        if (!header) return;
        
        toggleBtn = document.createElement('button');
        toggleBtn.className = 'mobile-menu-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle menu');
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
        toggleBtn.style.cssText = `
            display: none;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.25rem;
            margin-right: 1rem;
            flex-shrink: 0;
        `;
        
        toggleBtn.addEventListener('click', toggleMobileSidebar);
        
        // Insert at the beginning of the nav
        header.insertBefore(toggleBtn, header.firstChild);
    }
    
    // Create overlay
    function createOverlay() {
        if (document.querySelector('.sidebar-overlay')) return;
        
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        overlay.addEventListener('click', closeMobileSidebar);
        document.body.appendChild(overlay);
    }
    
    // Toggle mobile sidebar
    function toggleMobileSidebar() {
        if (sidebar.classList.contains('mobile-open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    }
    
    // Open mobile sidebar
    function openMobileSidebar() {
        sidebar.classList.add('mobile-open');
        sidebar.classList.remove('collapsed');
        overlay.style.display = 'block';
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
        document.body.style.overflow = 'hidden';
        toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
    }
    
    // Close mobile sidebar
    function closeMobileSidebar() {
        sidebar.classList.remove('mobile-open');
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
        document.body.style.overflow = '';
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }
    
    // Handle window resize
    function handleResize() {
        const isMobile = window.innerWidth <= 768;
        
        if (toggleBtn) {
            toggleBtn.style.display = isMobile ? 'flex' : 'none';
        }
        
        if (!isMobile) {
            // Close mobile sidebar on desktop
            if (sidebar.classList.contains('mobile-open')) {
                closeMobileSidebar();
            }
        }
    }
    
    // Expose functions globally
    window.MobileNav = {
        init: init,
        open: openMobileSidebar,
        close: closeMobileSidebar,
        toggle: toggleMobileSidebar
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

