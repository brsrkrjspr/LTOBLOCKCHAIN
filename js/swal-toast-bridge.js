// Bridge ToastNotification -> SweetAlert2 for admin/HPG/insurance pages
(function () {
    'use strict';

    function hasSwal() {
        return window.Swal && typeof window.Swal.fire === 'function';
    }

    const classes = {
        popup: 'lto-swal-popup',
        title: 'lto-swal-title',
        htmlContainer: 'lto-swal-body',
        actions: 'lto-swal-actions',
        confirmButton: 'lto-swal-confirm',
        cancelButton: 'lto-swal-cancel'
    };

    const iconColor = {
        success: '#16a34a',
        error: '#dc2626',
        warning: '#f59e0b',
        info: '#2563eb',
        question: '#2563eb'
    };

    function normalizeType(type) {
        const normalized = (type || '').toString().toLowerCase();
        const map = { success: 'success', error: 'error', warning: 'warning', warn: 'warning', info: 'info' };
        return map[normalized] || 'info';
    }

    function classConfig(type, isToast) {
        return {
            popup: isToast
                ? `${classes.popup} lto-swal-toast lto-swal-toast-${type}`
                : `${classes.popup} lto-swal-modal lto-swal-modal-${type}`,
            title: isToast ? `${classes.title} lto-swal-toast-title` : classes.title,
            htmlContainer: classes.htmlContainer,
            actions: classes.actions,
            confirmButton: classes.confirmButton,
            cancelButton: classes.cancelButton
        };
    }

    function fireSwal(message, type = 'info', duration) {
        if (!hasSwal()) {
            alert(message);
            return Promise.resolve();
        }
        const icon = normalizeType(type);
        const hasTimer = typeof duration === 'number' && duration > 0;
        const timer = hasTimer ? duration : 5000;

        return window.Swal.fire({
            toast: true,
            position: 'top-end',
            icon,
            iconColor: iconColor[icon],
            title: message,
            showConfirmButton: false,
            timer,
            timerProgressBar: true,
            allowOutsideClick: true,
            customClass: classConfig(icon, true),
            buttonsStyling: false,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', window.Swal.stopTimer);
                toast.addEventListener('mouseleave', window.Swal.resumeTimer);
            }
        });
    }

    function fireConfirm(message, onConfirm, onCancel) {
        if (!hasSwal()) {
            const ok = confirm(message || 'Are you sure you want to proceed?');
            if (ok && typeof onConfirm === 'function') onConfirm();
            if (!ok && typeof onCancel === 'function') onCancel();
            return Promise.resolve(ok);
        }
        return window.Swal.fire({
            icon: 'question',
            iconColor: iconColor.question,
            title: 'Confirm Action',
            text: message || 'Are you sure you want to proceed?',
            position: 'center',
            showCancelButton: true,
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            customClass: classConfig('question', false),
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed && typeof onConfirm === 'function') onConfirm();
            if (!result.isConfirmed && typeof onCancel === 'function') onCancel();
            return result.isConfirmed;
        });
    }

    if (!window.ToastNotification) {
        window.ToastNotification = {};
    }

    window.ToastNotification.show = function (message, type, duration) {
        return fireSwal(message, type, duration);
    };

    window.ToastNotification.confirm = function (message, onConfirm, onCancel) {
        return fireConfirm(message, onConfirm, onCancel);
    };

    window.showToastNotification = function (message, type, duration) {
        return fireSwal(message, type, duration);
    };
})();
