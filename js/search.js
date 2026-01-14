// Search/Verification JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
});

function initializeSearch() {
    // Initialize search functionality
    initializeSearchTabs();
    initializeSearchForms();
    initializeResults();
}

function initializeSearchTabs() {
    const searchTabs = document.querySelectorAll('.search-tab');
    const searchInputs = document.querySelectorAll('.search-input');
    
    searchTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const searchType = this.getAttribute('data-search');
            
            // Remove active class from all tabs and inputs
            searchTabs.forEach(t => t.classList.remove('active'));
            searchInputs.forEach(input => input.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding input
            this.classList.add('active');
            document.getElementById(searchType + '-search').classList.add('active');
        });
    });
}

function initializeSearchForms() {
    // CID search form
    const cidSearch = document.getElementById('cid-search');
    if (cidSearch) {
        const cidInput = cidSearch.querySelector('input');
        const cidButton = cidSearch.querySelector('button');
        
        cidButton.addEventListener('click', () => handleCIDSearch());
        cidInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleCIDSearch();
            }
        });
    }
    
    // Plate search form
    const plateSearch = document.getElementById('plate-search');
    if (plateSearch) {
        const plateInput = plateSearch.querySelector('input');
        const plateButton = plateSearch.querySelector('button');
        
        plateButton.addEventListener('click', () => handlePlateSearch());
        plateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handlePlateSearch();
            }
        });
    }
}

function handleCIDSearch() {
    const cidInput = document.getElementById('cid-input');
    const cid = cidInput.value.trim();
    
    if (!cid) {
        showError('Please enter a CID');
        return;
    }
    
    if (!isValidCID(cid)) {
        showError('Invalid CID format. Please enter a valid CID (e.g., QmXvJ1Z...)');
        return;
    }
    
    performSearch('cid', cid);
}

function handlePlateSearch() {
    const plateInput = document.getElementById('plate-input');
    const plate = plateInput.value.trim().toUpperCase();
    
    if (!plate) {
        showError('Please enter a license plate number');
        return;
    }
    
    if (!isValidPlate(plate)) {
        showError('Invalid plate format. Please enter a valid license plate (e.g., ABC-1234)');
        return;
    }
    
    performSearch('plate', plate);
}

function isValidCID(cid) {
    // Basic CID validation (starts with Qm and is alphanumeric)
    return /^Qm[a-zA-Z0-9]{40,}$/.test(cid);
}

function isValidPlate(plate) {
    // Basic plate validation (3 letters, dash, 4 numbers)
    return /^[A-Z]{3}-[0-9]{4}$/.test(plate);
}

async function performSearch(type, query) {
    showLoadingState();
    
    try {
        // Use real API call
        const endpoint = type === 'cid' 
            ? `/api/ledger/verify?cid=${encodeURIComponent(query)}`
            : `/api/vehicles/search?${type}=${encodeURIComponent(query)}`;
        
        const result = await apiClient.get(endpoint, { public: true });
        
        hideLoadingState();
        
        if (result && result.success && result.data) {
            displaySearchResults(result.data);
        } else {
            showNoResults(type, query);
        }
    } catch (error) {
        hideLoadingState();
        console.error('Search error:', error);
        showError(error.message || 'Search failed. Please try again.');
        showNoResults(type, query);
    }
}

function displaySearchResults(result) {
    const resultsSection = document.getElementById('results');
    const resultCard = resultsSection.querySelector('.result-card');
    
    // Update result card with actual data
    resultCard.querySelector('h4').textContent = `${result.vehicle} - ${result.plate}`;
    resultCard.querySelector('.result-details p:nth-child(1)').innerHTML = `<strong>Owner:</strong> ${result.owner}`;
    resultCard.querySelector('.result-details p:nth-child(2)').innerHTML = `<strong>CID:</strong> ${result.cid}`;
    resultCard.querySelector('.result-details p:nth-child(3)').innerHTML = `<strong>Last Updated:</strong> ${result.lastUpdated}`;
    
    // Update status badge
    const statusBadge = resultCard.querySelector('.status-badge');
    statusBadge.textContent = 'Verified';
    statusBadge.className = 'status-badge status-approved';
    
    // Update action buttons
    const viewButton = resultCard.querySelector('.result-actions .btn-primary');
    // Strict: view in modal (no new tab / no full-page viewer)
    viewButton.href = '#';
    viewButton.onclick = (e) => {
        e.preventDefault();
        if (typeof DocumentModal === 'undefined') {
            alert('Document viewer modal is not available. Please refresh the page.');
            return;
        }
        DocumentModal.view({
            cid: result.cid,
            filename: `Certificate (${result.plate || 'Document'})`
        });
    };
    
    const downloadButton = resultCard.querySelector('.result-actions .btn-secondary');
    downloadButton.addEventListener('click', () => handleDownloadCertificate(result));
    
    // Show results
    resultsSection.style.display = 'block';
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function showNoResults(type, query) {
    const resultsSection = document.getElementById('results');
    const resultCard = resultsSection.querySelector('.result-card');
    
    // Update result card to show no results
    resultCard.innerHTML = `
        <div class="no-results">
            <div class="no-results-icon">🔍</div>
            <h4>No Results Found</h4>
            <p>No documents found for ${type === 'cid' ? 'CID' : 'license plate'}: <strong>${query}</strong></p>
            <div class="no-results-suggestions">
                <p>Please check:</p>
                <ul>
                    <li>Spelling and format are correct</li>
                    <li>The document exists in our system</li>
                    <li>You have permission to view this document</li>
                </ul>
            </div>
        </div>
    `;
    
    // Show results
    resultsSection.style.display = 'block';
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function handleDownloadCertificate(result) {
    showNotification('Preparing certificate download...', 'info');
    
    // Simulate certificate generation
    setTimeout(() => {
        showNotification('Certificate downloaded successfully!', 'success');
        // In a real app, this would trigger actual certificate download
    }, 2000);
}

function showLoadingState() {
    const resultsSection = document.getElementById('results');
    const resultCard = resultsSection.querySelector('.result-card');
    
    resultCard.innerHTML = `
        <div class="loading-results">
            <div class="loading-spinner"></div>
            <p>Searching for documents...</p>
        </div>
    `;
    
    resultsSection.style.display = 'block';
}

function hideLoadingState() {
    // Loading state will be replaced by actual results
}

function showError(message) {
    // Remove existing error messages
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-text">${message}</span>
        </div>
    `;
    
    // Insert after search form
    const searchForm = document.querySelector('.search-form');
    searchForm.parentNode.insertBefore(errorDiv, searchForm.nextSibling);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 4000);
}

// Export functions
window.Search = {
    handleCIDSearch,
    handlePlateSearch,
    performSearch,
    displaySearchResults,
    showError,
    showNotification
};
