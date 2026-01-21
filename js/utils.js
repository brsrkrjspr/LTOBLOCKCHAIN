// Utility functions for common features across the application

// Toast Notification System
class ToastNotification {
    static show(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getToastColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        `;
        
        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span style="font-size: 1.2rem;">${icon}</span>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">×</button>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
        
        return toast;
    }

    /**
     * Confirm dialog helper.
     * Returns a Promise<boolean> and optionally runs callbacks.
     *
     * NOTE: Some pages load both `js/toast-notification.js` and `js/utils.js`.
     * Those pages may call `ToastNotification.confirm(...)`.
     * This implementation keeps behavior consistent even if this file is loaded last.
     */
    static confirm(message, onConfirm, onCancel) {
        // Prefer the richer ConfirmationDialog if present
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

        // Fallback to native confirm if ConfirmationDialog is unavailable
        const ok = window.confirm(message || 'Are you sure you want to proceed?');
        if (ok) {
            if (typeof onConfirm === 'function') onConfirm();
        } else {
            if (typeof onCancel === 'function') onCancel();
        }
        return Promise.resolve(ok);
    }
    
    static getToastColor(type) {
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        return colors[type] || colors.info;
    }
    
    static getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
}

// Confirmation Dialog System
class ConfirmationDialog {
    static show(options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Confirm Action',
                message = 'Are you sure you want to proceed?',
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                confirmColor = '#e74c3c',
                type = 'warning',
                html = false
            } = options;
            
            const modal = document.createElement('div');
            modal.className = 'confirmation-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease-out;
            `;
            
            const icon = this.getDialogIcon(type);
            const iconColor = this.getIconColor(type);
            
            // Use div for HTML messages, p for plain text
            const messageTag = html ? 'div' : 'p';
            const messageStyle = html ? 'margin: 0 0 2rem 0; text-align: left;' : 'margin: 0 0 2rem 0; color: #555; line-height: 1.6;';
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
                    max-width: ${html ? '600px' : '500px'};
                    width: 90%;
                    animation: slideUp 0.3s ease-out;
                ">
                    <div style="padding: 2rem; ${html ? '' : 'text-align: center;'}">
                        <div style="font-size: 3rem; margin-bottom: 1rem; color: ${iconColor}; ${html ? 'text-align: center;' : ''}">${icon}</div>
                        <h3 style="margin: 0 0 1rem 0; color: #2c3e50; font-size: 1.5rem; ${html ? 'text-align: center;' : ''}">${title}</h3>
                        <${messageTag} style="${messageStyle}">${message}</${messageTag}>
                        <div style="display: flex; gap: 1rem; justify-content: center;">
                            <button class="confirm-btn" style="
                                padding: 0.75rem 2rem;
                                background: ${confirmColor};
                                color: white;
                                border: none;
                                border-radius: 6px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s;
                            ">${confirmText}</button>
                            <button class="cancel-btn" style="
                                padding: 0.75rem 2rem;
                                background: #ecf0f1;
                                color: #2c3e50;
                                border: none;
                                border-radius: 6px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s;
                            ">${cancelText}</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const confirmBtn = modal.querySelector('.confirm-btn');
            const cancelBtn = modal.querySelector('.cancel-btn');
            
            confirmBtn.addEventListener('mouseenter', () => {
                confirmBtn.style.transform = 'scale(1.05)';
                confirmBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            });
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.transform = 'scale(1)';
                confirmBtn.style.boxShadow = 'none';
            });
            
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#bdc3c7';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = '#ecf0f1';
            });
            
            confirmBtn.onclick = () => {
                modal.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => modal.remove(), 300);
                resolve(true);
            };
            
            cancelBtn.onclick = () => {
                modal.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => modal.remove(), 300);
                resolve(false);
            };
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.animation = 'fadeOut 0.3s ease-out';
                    setTimeout(() => modal.remove(), 300);
                    resolve(false);
                }
            };
        });
    }
    
    static getDialogIcon(type) {
        const icons = {
            warning: '⚠️',
            danger: '🗑️',
            info: 'ℹ️',
            question: '❓'
        };
        return icons[type] || icons.warning;
    }
    
    static getIconColor(type) {
        const colors = {
            warning: '#f39c12',
            danger: '#e74c3c',
            info: '#3498db',
            question: '#3498db'
        };
        return colors[type] || colors.warning;
    }
}

// Loading State Manager
class LoadingManager {
    static show(element, text = 'Loading...') {
        if (!element) return;
        
        element.disabled = true;
        element.dataset.originalText = element.textContent || element.innerHTML;
        element.dataset.loading = 'true';
        
        const spinner = '<span class="loading-spinner"></span>';
        if (element.tagName === 'BUTTON') {
            element.innerHTML = spinner + ' ' + text;
        } else {
            element.innerHTML = spinner + ' ' + text;
        }
        
        element.classList.add('loading');
    }
    
    static hide(element) {
        if (!element) return;
        
        element.disabled = false;
        element.dataset.loading = 'false';
        
        if (element.dataset.originalText) {
            if (element.tagName === 'BUTTON') {
                element.textContent = element.dataset.originalText;
            } else {
                element.innerHTML = element.dataset.originalText;
            }
        }
        
        element.classList.remove('loading');
    }
    
    static showOverlay(text = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-out;
        `;
        
        overlay.innerHTML = `
            <div style="
                background: white;
                padding: 2rem;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            ">
                <div class="loading-spinner" style="
                    display: inline-block;
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 1rem;
                "></div>
                <p style="margin: 0; color: #2c3e50; font-weight: 600;">${text}</p>
            </div>
        `;
        
        document.body.appendChild(overlay);
        return overlay;
    }
    
    static hideOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

// Request Manager with AbortController for race condition prevention
class RequestManager {
    constructor() {
        this.controllers = new Map();
    }
    
    createRequest(key) {
        // Cancel previous request with same key
        if (this.controllers.has(key)) {
            this.controllers.get(key).abort();
        }
        
        const controller = new AbortController();
        this.controllers.set(key, controller);
        return controller.signal;
    }
    
    cancelRequest(key) {
        if (this.controllers.has(key)) {
            this.controllers.get(key).abort();
            this.controllers.delete(key);
        }
    }
    
    cancelAll() {
        this.controllers.forEach(controller => controller.abort());
        this.controllers.clear();
    }
}

// Global request manager instance
const requestManager = new RequestManager();

// Form Data Persistence
class FormPersistence {
    static save(formId, data) {
        const key = `form_data_${formId}`;
        localStorage.setItem(key, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
    }
    
    static load(formId) {
        const key = `form_data_${formId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Check if data is older than 7 days
                const sevenDays = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - parsed.timestamp < sevenDays) {
                    return parsed.data;
                } else {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        }
        return null;
    }
    
    static clear(formId) {
        const key = `form_data_${formId}`;
        localStorage.removeItem(key);
    }
    
    static autoSave(formId, formElement) {
        if (!formElement) return;
        
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                const formData = new FormData(formElement);
                const data = {};
                formData.forEach((value, key) => {
                    data[key] = value;
                });
                this.save(formId, data);
            });
        });
    }
    
    static restore(formId, formElement) {
        if (!formElement) return false;
        
        const saved = this.load(formId);
        if (saved) {
            Object.keys(saved).forEach(key => {
                const input = formElement.querySelector(`[name="${key}"]`);
                if (input) {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = saved[key] === input.value;
                    } else {
                        input.value = saved[key];
                    }
                }
            });
            return true;
        }
        return false;
    }
}

// Pagination Helper
class PaginationHelper {
    static createPagination(container, currentPage, totalPages, onPageChange) {
        if (!container) return;
        
        container.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        pagination.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 0.5rem;
            margin: 2rem 0;
        `;
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Previous';
        prevBtn.disabled = currentPage === 1;
        prevBtn.className = 'btn-secondary btn-sm';
        prevBtn.onclick = () => onPageChange(currentPage - 1);
        pagination.appendChild(prevBtn);
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.textContent = '1';
            firstBtn.className = 'btn-secondary btn-sm';
            firstBtn.onclick = () => onPageChange(1);
            pagination.appendChild(firstBtn);
            
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '0.5rem';
                pagination.appendChild(ellipsis);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = i === currentPage ? 'btn-primary btn-sm' : 'btn-secondary btn-sm';
            pageBtn.onclick = () => onPageChange(i);
            pagination.appendChild(pageBtn);
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '0.5rem';
                pagination.appendChild(ellipsis);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.textContent = totalPages;
            lastBtn.className = 'btn-secondary btn-sm';
            lastBtn.onclick = () => onPageChange(totalPages);
            pagination.appendChild(lastBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.className = 'btn-secondary btn-sm';
        nextBtn.onclick = () => onPageChange(currentPage + 1);
        pagination.appendChild(nextBtn);
        
        container.appendChild(pagination);
    }
}

// Export for global use
window.ToastNotification = ToastNotification;
window.ConfirmationDialog = ConfirmationDialog;
window.LoadingManager = LoadingManager;
window.RequestManager = RequestManager;
window.requestManager = requestManager;
window.FormPersistence = FormPersistence;
window.PaginationHelper = PaginationHelper;

