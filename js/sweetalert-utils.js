// SweetAlert2 helpers aligned with LTO TrustChain UI
(function () {
    'use strict';

    const baseClasses = {
        popup: 'lto-swal-popup',
        title: 'lto-swal-title',
        htmlContainer: 'lto-swal-body',
        actions: 'lto-swal-actions',
        confirmButton: 'lto-swal-confirm',
        cancelButton: 'lto-swal-cancel'
    };

    function hasSwal() {
        return typeof window !== 'undefined' && window.Swal && typeof window.Swal.fire === 'function';
    }

    function normalizeType(type) {
        const normalized = (type || '').toString().toLowerCase();
        const map = {
            success: 'success',
            error: 'error',
            warning: 'warning',
            warn: 'warning',
            info: 'info'
        };
        return map[normalized] || 'info';
    }

    window.showSweetToast = function (message, type = 'info', options = {}) {
        if (!hasSwal()) {
            alert(message);
            return Promise.resolve();
        }

        const opts = options || {};
        const timer = typeof opts.timer === 'number' ? opts.timer : 5000;

        return window.Swal.fire({
            toast: true,
            position: opts.position || 'top-end',
            icon: normalizeType(opts.icon || type),
            title: message,
            showConfirmButton: false,
            timer,
            timerProgressBar: true,
            customClass: baseClasses,
            buttonsStyling: false,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', window.Swal.stopTimer);
                toast.addEventListener('mouseleave', window.Swal.resumeTimer);
                if (typeof opts.didOpen === 'function') {
                    opts.didOpen(toast);
                }
            }
        });
    };

    window.showSweetAlert = function (message, type = 'info', options = {}) {
        if (!hasSwal()) {
            alert(message);
            return Promise.resolve();
        }

        const opts = options || {};
        return window.Swal.fire({
            icon: normalizeType(opts.icon || type),
            title: opts.title || 'Notification',
            text: message,
            confirmButtonText: opts.confirmText || 'OK',
            customClass: baseClasses,
            buttonsStyling: false
        });
    };

    window.showSweetConfirm = function (options = {}) {
        const opts = options || {};
        const title = opts.title || 'Are you sure?';
        const text = opts.text || 'This action cannot be undone.';
        const confirmText = opts.confirmText || 'Yes, continue';
        const cancelText = opts.cancelText || 'Cancel';
        const icon = normalizeType(opts.icon || 'warning');

        if (!hasSwal()) {
            const fallback = text ? `${title}\n\n${text}` : title;
            return Promise.resolve(confirm(fallback));
        }

        return window.Swal.fire({
            icon,
            title,
            text,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            reverseButtons: true,
            customClass: baseClasses,
            buttonsStyling: false
        }).then((result) => result.isConfirmed);
    };
})();
