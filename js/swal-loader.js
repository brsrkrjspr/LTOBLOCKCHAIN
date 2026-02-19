// SweetAlert2 loader + alias to `swal`
(function () {
    'use strict';

    const fallbackScript = 'js/sweetalert2.min.js';
    const fallbackStyle = 'css/sweetalert2.min.css';

    function ensureStyle(href) {
        const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some((link) => (link.getAttribute('href') || '').includes(href));
        if (existing) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function ensureScript(src) {
        return new Promise((resolve, reject) => {
            const existing = Array.from(document.querySelectorAll('script[src]'))
                .some((script) => (script.getAttribute('src') || '').includes(src));
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load SweetAlert2 fallback'));
            document.head.appendChild(script);
        });
    }

    function setAlias() {
        if (window.Swal && !window.swal) {
            window.swal = window.Swal;
        }
    }

    if (window.Swal && typeof window.Swal.fire === 'function') {
        setAlias();
        return;
    }

    ensureStyle(fallbackStyle);
    ensureScript(fallbackScript)
        .then(setAlias)
        .catch(() => {
            // Fallback silently; callers may still use alert()
        });
})();
