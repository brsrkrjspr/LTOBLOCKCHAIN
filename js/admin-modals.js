// Admin Dashboard Modal Functions

// User Management Functions
function showUserManagementModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
            <div class="modal-header">
                <h3>User Management</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="management-toolbar">
                    <button class="btn-primary" onclick="addNewUser()">Add New User</button>
                    <button class="btn-secondary" onclick="exportUsers()">Export Users</button>
                    <div class="search-box">
                        <input type="text" id="userSearch" placeholder="Search users..." onkeyup="searchUsers()">
                    </div>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Login</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody">
                            <!-- Users will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    loadUsersTable();
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function loadUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    // Get users from localStorage or create sample data
    let users = JSON.parse(localStorage.getItem('systemUsers') || '[]');
    
    if (users.length === 0) {
        // Create sample users
        users = [
            {
                id: 'USR001',
                name: 'John Doe',
                email: 'john.doe@example.com',
                role: 'Admin',
                status: 'Active',
                lastLogin: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 'USR002',
                name: 'Jane Smith',
                email: 'jane.smith@example.com',
                role: 'User',
                status: 'Active',
                lastLogin: new Date(Date.now() - 172800000).toISOString()
            },
            {
                id: 'USR003',
                name: 'Bob Johnson',
                email: 'bob.johnson@example.com',
                role: 'Verifier',
                status: 'Inactive',
                lastLogin: new Date(Date.now() - 604800000).toISOString()
            }
        ];
        localStorage.setItem('systemUsers', JSON.stringify(users));
    }
    
    tbody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span></td>
            <td><span class="status-badge status-${user.status.toLowerCase()}">${user.status}</span></td>
            <td>${new Date(user.lastLogin).toLocaleDateString()}</td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editUser('${user.id}')">Edit</button>
                <button class="btn-danger btn-sm" onclick="deleteUser('${user.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Organization Management Functions
function showOrganizationManagementModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
            <div class="modal-header">
                <h3>Organization Management</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="management-toolbar">
                    <button class="btn-primary" onclick="addNewOrganization()">Add New Organization</button>
                    <button class="btn-secondary" onclick="exportOrganizations()">Export Organizations</button>
                    <div class="search-box">
                        <input type="text" id="orgSearch" placeholder="Search organizations..." onkeyup="searchOrganizations()">
                    </div>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Org ID</th>
                                <th>Organization Name</th>
                                <th>Type</th>
                                <th>Users</th>
                                <th>Applications</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="organizationsTableBody">
                            <!-- Organizations will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    loadOrganizationsTable();
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function loadOrganizationsTable() {
    const tbody = document.getElementById('organizationsTableBody');
    if (!tbody) return;
    
    // Get organizations from localStorage or create sample data
    let organizations = JSON.parse(localStorage.getItem('systemOrganizations') || '[]');
    
    if (organizations.length === 0) {
        // Create sample organizations
        organizations = [
            {
                id: 'ORG001',
                name: 'ABC Transport Corp',
                type: 'Transport Company',
                users: 15,
                applications: 45,
                status: 'Active'
            },
            {
                id: 'ORG002',
                name: 'XYZ Logistics Ltd',
                type: 'Logistics Company',
                users: 8,
                applications: 23,
                status: 'Active'
            },
            {
                id: 'ORG003',
                name: 'City Taxi Services',
                type: 'Taxi Service',
                users: 25,
                applications: 67,
                status: 'Suspended'
            }
        ];
        localStorage.setItem('systemOrganizations', JSON.stringify(organizations));
    }
    
    tbody.innerHTML = '';
    organizations.forEach(org => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${org.id}</td>
            <td>${org.name}</td>
            <td>${org.type}</td>
            <td>${org.users}</td>
            <td>${org.applications}</td>
            <td><span class="status-badge status-${org.status.toLowerCase()}">${org.status}</span></td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editOrganization('${org.id}')">Edit</button>
                <button class="btn-danger btn-sm" onclick="deleteOrganization('${org.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Audit Logs Functions
function showAuditLogsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
            <div class="modal-header">
                <h3>System Audit Logs</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="management-toolbar">
                    <button class="btn-secondary" onclick="exportAuditLogs()">Export Logs</button>
                    <button class="btn-secondary" onclick="clearAuditLogs()">Clear Logs</button>
                    <div class="filter-box">
                        <select id="logFilter" onchange="filterAuditLogs()">
                            <option value="all">All Activities</option>
                            <option value="login">Login/Logout</option>
                            <option value="application">Application Actions</option>
                            <option value="user">User Management</option>
                            <option value="system">System Events</option>
                        </select>
                    </div>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Details</th>
                                <th>IP Address</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="auditLogsTableBody">
                            <!-- Audit logs will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    loadAuditLogsTable();
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function loadAuditLogsTable() {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;
    
    // Get audit logs from localStorage or create sample data
    let auditLogs = JSON.parse(localStorage.getItem('systemAuditLogs') || '[]');
    
    if (auditLogs.length === 0) {
        // Create sample audit logs
        auditLogs = [
            {
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                user: 'Admin User',
                action: 'Application Approved',
                details: 'Approved application APP-001 for Toyota Camry',
                ipAddress: '192.168.1.100',
                status: 'Success'
            },
            {
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                user: 'John Doe',
                action: 'User Login',
                details: 'Successful login from web interface',
                ipAddress: '192.168.1.101',
                status: 'Success'
            },
            {
                timestamp: new Date(Date.now() - 10800000).toISOString(),
                user: 'Jane Smith',
                action: 'Application Submitted',
                details: 'New application submitted for Honda Civic',
                ipAddress: '192.168.1.102',
                status: 'Success'
            }
        ];
        localStorage.setItem('systemAuditLogs', JSON.stringify(auditLogs));
    }
    
    tbody.innerHTML = '';
    auditLogs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td>${log.user}</td>
            <td>${log.action}</td>
            <td>${log.details}</td>
            <td>${log.ipAddress}</td>
            <td><span class="status-badge status-${log.status.toLowerCase()}">${log.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Reports Functions
function showReportsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h3>System Reports</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="reports-grid">
                    <div class="report-card" onclick="generateReport('users')">
                        <div class="report-icon">👥</div>
                        <h4>User Report</h4>
                        <p>Generate comprehensive user statistics and activity report</p>
                    </div>
                    <div class="report-card" onclick="generateReport('applications')">
                        <div class="report-icon">📋</div>
                        <h4>Application Report</h4>
                        <p>Generate application processing and status reports</p>
                    </div>
                    <div class="report-card" onclick="generateReport('organizations')">
                        <div class="report-icon">🏢</div>
                        <h4>Organization Report</h4>
                        <p>Generate organization performance and compliance reports</p>
                    </div>
                    <div class="report-card" onclick="generateReport('system')">
                        <div class="report-icon">📊</div>
                        <h4>System Report</h4>
                        <p>Generate system performance and usage analytics</p>
                    </div>
                </div>
                <div class="report-options">
                    <h4>Report Options</h4>
                    <div class="form-group">
                        <label>Date Range:</label>
                        <select id="reportDateRange">
                            <option value="7">Last 7 days</option>
                            <option value="30" selected>Last 30 days</option>
                            <option value="90">Last 90 days</option>
                            <option value="365">Last year</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Format:</label>
                        <select id="reportFormat">
                            <option value="pdf" selected>PDF</option>
                            <option value="excel">Excel</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Helper functions for the modals
function addNewUser() {
    showNotification('Add New User - Feature coming soon', 'info');
}

function exportUsers() {
    showNotification('Exporting users...', 'success');
}

function searchUsers() {
    showNotification('Searching users...', 'info');
}

function editUser(userId) {
    showNotification(`Editing user ${userId} - Feature coming soon`, 'info');
}

function deleteUser(userId) {
    if (confirm(`Are you sure you want to delete user ${userId}?`)) {
        showNotification(`User ${userId} deleted`, 'success');
    }
}

function addNewOrganization() {
    showNotification('Add New Organization - Feature coming soon', 'info');
}

function exportOrganizations() {
    showNotification('Exporting organizations...', 'success');
}

function searchOrganizations() {
    showNotification('Searching organizations...', 'info');
}

function editOrganization(orgId) {
    showNotification(`Editing organization ${orgId} - Feature coming soon`, 'info');
}

function deleteOrganization(orgId) {
    if (confirm(`Are you sure you want to delete organization ${orgId}?`)) {
        showNotification(`Organization ${orgId} deleted`, 'success');
    }
}

function exportAuditLogs() {
    showNotification('Exporting audit logs...', 'success');
}

function clearAuditLogs() {
    if (confirm('Are you sure you want to clear all audit logs?')) {
        showNotification('Audit logs cleared', 'success');
    }
}

function filterAuditLogs() {
    showNotification('Filtering audit logs...', 'info');
}

function generateReport(type) {
    const dateRange = document.getElementById('reportDateRange')?.value || '30';
    const format = document.getElementById('reportFormat')?.value || 'pdf';
    showNotification(`Generating ${type} report for last ${dateRange} days in ${format.toUpperCase()} format...`, 'success');
}
