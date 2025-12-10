// Admin Login Helper
// Run this in browser console to login as admin

async function loginAsAdmin() {
    console.log('🔐 Logging in as admin...');
    
    // Clear old tokens
    localStorage.clear();
    console.log('✅ Cleared old tokens');
    
    try {
        // Login via API
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@lto.gov.ph',
                password: 'admin123'
            })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
            // Store token and user
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            console.log('✅ Admin login successful!');
            console.log('User role:', data.user.role);
            console.log('User email:', data.user.email);
            
            // Verify token
            const token = data.token;
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                console.log('Token payload:', payload);
                if (payload.role === 'admin') {
                    console.log('✅ Token has admin role!');
                } else {
                    console.error('❌ Token does NOT have admin role. Current role:', payload.role);
                }
            } catch (e) {
                console.error('❌ Could not decode token:', e);
            }
            
            // Redirect to admin dashboard
            console.log('Redirecting to admin dashboard...');
            window.location.href = 'admin-dashboard.html';
        } else {
            console.error('❌ Login failed:', data.error);
            alert('Login failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        alert('Login error: ' + error.message);
    }
}

// Make it available globally
window.loginAsAdmin = loginAsAdmin;

console.log('✅ Admin login helper loaded!');
console.log('Run: loginAsAdmin()');

