/**
 * Notification adapter:
 * Keep the historical ToastNotification API but render with SweetAlert2.
 */
(function () {
    'use strict';

    const ASSETS = {
        script: 'js/sweetalert2.min.js',
        style: 'css/sweetalert2.min.css',
        theme: 'css/sweetalert-theme.css'
    };

    const CLASSES = {
        popup: 'lto-swal-popup',
        title: 'lto-swal-title',
        htmlContainer: 'lto-swal-body',
        actions: 'lto-swal-actions',
        confirmButton: 'lto-swal-confirm',
        cancelButton: 'lto-swal-cancel'
    };

    const TYPE_MAP = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        warn: 'warning',
        info: 'info'
    };

    const ICON_COLOR = {
        success: '#16a34a',
        error: '#dc2626',
        warning: '#f59e0b',
        info: '#2563eb',
        question: '#2563eb'
    };

    function hasSwal() {
        return typeof window !== 'undefined' && window.Swal && typeof window.Swal.fire === 'function';
    }

    function normalizeType(type) {
        const normalized = (type || '').toString().toLowerCase();
        return TYPE_MAP[normalized] || 'info';
    }

    function ensureStyle(href) {
        if (!href || typeof document === 'undefined') return;
        const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some((link) => (link.getAttribute('href') || '').includes(href));
        if (exists) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function hasSweetAlertScriptTag() {
        if (typeof document === 'undefined') return false;
        return Array.from(document.querySelectorAll('script[src]'))
            .some((script) => {
                const src = (script.getAttribute('src') || '').toLowerCase();
                return src.includes('sweetalert2') || src.includes('swal-loader');
            });
    }

    function ensureScript(src) {
        return new Promise((resolve) => {
            if (hasSwal()) {
                resolve(true);
                return;
            }

            if (hasSweetAlertScriptTag()) {
                setTimeout(() => resolve(hasSwal()), 1200);
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    }

    async function ensureSwal() {
        if (typeof document !== 'undefined') {
            ensureStyle(ASSETS.style);
            ensureStyle(ASSETS.theme);
        }

        if (hasSwal()) return true;
        await ensureScript(ASSETS.script);
        return hasSwal();
    }

    function getClassConfig(type, isToast) {
        const popupBase = isToast
            ? `${CLASSES.popup} lto-swal-toast lto-swal-toast-${type}`
            : `${CLASSES.popup} lto-swal-modal lto-swal-modal-${type}`;
        return {
            popup: popupBase,
            title: isToast ? `${CLASSES.title} lto-swal-toast-title` : CLASSES.title,
            htmlContainer: CLASSES.htmlContainer,
            actions: CLASSES.actions,
            confirmButton: CLASSES.confirmButton,
            cancelButton: CLASSES.cancelButton
        };
    }

    async function show(message, type = 'info', duration = 5000) {
        const text = (message || 'Notification').toString();
        const icon = normalizeType(type);
        const timer = typeof duration === 'number' && duration > 0 ? duration : 5000;
        const ready = await ensureSwal();

        if (!ready) {
            alert(text);
            return Promise.resolve();
        }

        return window.Swal.fire({
            toast: true,
            position: 'top-end',
            icon,
            iconColor: ICON_COLOR[icon],
            title: text,
            showConfirmButton: false,
            timer,
            timerProgressBar: true,
            allowOutsideClick: true,
            customClass: getClassConfig(icon, true),
            buttonsStyling: false,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', window.Swal.stopTimer);
                toast.addEventListener('mouseleave', window.Swal.resumeTimer);
            }
        });
    }

    async function confirmAction(message, onConfirm, onCancel) {
        const text = (message || 'Are you sure you want to proceed?').toString();
        const ready = await ensureSwal();

        if (!ready) {
            const ok = confirm(text);
            if (ok && typeof onConfirm === 'function') onConfirm();
            if (!ok && typeof onCancel === 'function') onCancel();
            return ok;
        }

        const result = await window.Swal.fire({
            icon: 'question',
            iconColor: ICON_COLOR.question,
            title: 'Confirm Action',
            text,
            position: 'center',
            showCancelButton: true,
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            customClass: getClassConfig('question', false),
            buttonsStyling: false
        });

        if (result.isConfirmed && typeof onConfirm === 'function') onConfirm();
        if (!result.isConfirmed && typeof onCancel === 'function') onCancel();
        return !!result.isConfirmed;
    }

    window.ToastNotification = {
        show,
        confirm: confirmAction
    };

    // Backward-compatible alias used by older dashboard scripts.
    window.showToastNotification = function (message, type, duration) {
        return window.ToastNotification.show(message, type, duration);
    };
})();
