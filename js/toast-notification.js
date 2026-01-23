/**
 * Toast Notification System
 * Replaces alert() and confirm() with non-blocking UI feedback
 * Supports both callback-based and async/await usage patterns
 */
class ToastNotification {
    static container = null;
    
    static init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(this.container);
        }
    }
    
    static show(message, type = 'info', duration = 5000) {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: ${this.getBackgroundColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            min-width: 300px;
            max-width: 500px;
            pointer-events: auto;
            animation: slideInRight 0.3s ease-out;
        `;
        
        const icon = this.getIcon(type);
        toast.innerHTML = `
            <i class="fas ${icon}" style="font-size: 1.25rem;"></i>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; padding: 0.25rem; opacity: 0.8;">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        this.container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    static getBackgroundColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }
    
    static getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * Confirm dialog - supports BOTH callback and async/await patterns
     * 
     * Usage 1 (async/await):
     *   const ok = await ToastNotification.confirm('Are you sure?');
     *   if (ok) { ... }
     * 
     * Usage 2 (callbacks):
     *   ToastNotification.confirm('Are you sure?', 
     *     () => { console.log('confirmed'); },
     *     () => { console.log('cancelled'); }
     *   );
     * 
     * @param {string} message - Confirmation message
     * @param {function} onConfirm - Optional callback if user confirms
     * @param {function} onCancel - Optional callback if user cancels
     * @returns {Promise<boolean>} - true if confirmed, false if cancelled
     */
    static confirm(message, onConfirm, onCancel) {
        // Use ConfirmationDialog from utils.js when available (richer UI)
        if (typeof window !== 'undefined' && window.ConfirmationDialog && typeof window.ConfirmationDialog.show === 'function') {
            return window.ConfirmationDialog.show({
                title: 'Confirm Action',
                message: message || 'Are you sure you want to proceed?',
                confirmText: 'Confirm',
                cancelText: 'Cancel',
                confirmColor: '#3498db',
                type: 'question'
            }).then((ok) => {
                if (ok) {
                    if (typeof onConfirm === 'function') onConfirm();
                } else {
                    if (typeof onCancel === 'function') onCancel();
                }
                return ok;
            });
        }

        this.init();

        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'toast-confirm-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                animation: fadeIn 0.2s ease-out;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 2rem;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
            `;
            
            dialog.innerHTML = `
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem; color: #111827;">Confirm Action</h3>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280; line-height: 1.6;">${message}</p>
                <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                    <button class="toast-btn-cancel" style="padding: 0.75rem 1.5rem; border: 1px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; color: #374151;">
                        Cancel
                    </button>
                    <button class="toast-btn-confirm" style="padding: 0.75rem 1.5rem; border: none; background: #3b82f6; color: white; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Confirm
                    </button>
                </div>
            `;
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            const handleConfirm = () => {
                modal.remove();
                if (typeof onConfirm === 'function') onConfirm();
                resolve(true);
            };
            
            const handleCancel = () => {
                modal.remove();
                if (typeof onCancel === 'function') onCancel();
                resolve(false);
            };
            
            dialog.querySelector('.toast-btn-confirm').addEventListener('click', handleConfirm);
            dialog.querySelector('.toast-btn-cancel').addEventListener('click', handleCancel);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) handleCancel();
            });
        });
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;
document.head.appendChild(style);

// Make globally available
window.ToastNotification = ToastNotification;
