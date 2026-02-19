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

    const titles = {
        success: 'Success!',
        error: 'Error',
        warning: 'Warning',
        info: 'Notice'
    };

    function normalizeType(type) {
        const normalized = (type || '').toString().toLowerCase();
        const map = { success: 'success', error: 'error', warning: 'warning', warn: 'warning', info: 'info' };
        return map[normalized] || 'info';
    }

    function fireSwal(message, type = 'info', duration) {
        if (!hasSwal()) {
            alert(message);
            return Promise.resolve();
        }
        const icon = normalizeType(type);
        const hasTimer = typeof duration === 'number';
        return window.Swal.fire({
            icon,
            title: titles[icon] || 'Notification',
            text: message,
            position: 'center',
            confirmButtonText: 'OK',
            timer: hasTimer ? duration : undefined,
            timerProgressBar: !!hasTimer,
            showConfirmButton: !hasTimer,
            backdrop: !hasTimer,
            allowOutsideClick: hasTimer,
            customClass: classes,
            buttonsStyling: false
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
            icon: 'warning',
            title: 'Confirm Action',
            text: message || 'Are you sure you want to proceed?',
            position: 'center',
            showCancelButton: true,
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            customClass: classes,
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
})();
