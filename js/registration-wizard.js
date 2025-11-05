// Registration Wizard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeRegistrationWizard();
});

function initializeRegistrationWizard() {
    // Initialize wizard functionality
    initializeFormValidation();
    initializeFileUploads();
    initializeProgressTracking();
}

let currentStep = 1;
const totalSteps = 4;

function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
            // Hide current step
            document.getElementById(`step-${currentStep}`).classList.remove('active');
            document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
            
            currentStep++;
            
            // Show next step
            document.getElementById(`step-${currentStep}`).classList.add('active');
            document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
            
            // Update review data if on final step
            if (currentStep === 4) {
                updateReviewData();
            }
            
            // Scroll to top of form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        // Hide current step
        document.getElementById(`step-${currentStep}`).classList.remove('active');
        document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
        
        currentStep--;
        
        // Show previous step
        document.getElementById(`step-${currentStep}`).classList.add('active');
        document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
        
        // Scroll to top of form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function validateCurrentStep() {
    const currentStepElement = document.getElementById(`step-${currentStep}`);
    const requiredFields = currentStepElement.querySelectorAll('[required]');
    let isValid = true;
    let errorMessages = [];
    
    // Clear previous errors
    requiredFields.forEach(field => {
        field.classList.remove('invalid');
        hideFieldError(field);
    });
    
    // Validate required fields
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('invalid');
            showFieldError(field, 'This field is required');
            isValid = false;
        }
    });
    
    // Additional validation for specific steps
    if (currentStep === 1) {
        const vehicleErrors = validateVehicleInfo();
        if (!vehicleErrors.isValid) {
            isValid = false;
            errorMessages = errorMessages.concat(vehicleErrors.errors);
        }
    } else if (currentStep === 2) {
        const ownerErrors = validateOwnerInfo();
        if (!ownerErrors.isValid) {
            isValid = false;
            errorMessages = errorMessages.concat(ownerErrors.errors);
        }
    } else if (currentStep === 3) {
        const docErrors = validateDocumentUploads();
        if (!docErrors.isValid) {
            isValid = false;
            errorMessages = errorMessages.concat(docErrors.errors);
        }
    }
    
    if (!isValid) {
        showTopError(errorMessages.length > 0 ? errorMessages.join('<br>') : 'Please fill in all required fields correctly');
    }
    
    return isValid;
}

function validateVehicleInfo() {
    const plateNumber = document.getElementById('plateNumber').value.trim();
    const year = document.getElementById('year').value;
    const engineNumber = document.getElementById('engineNumber').value.trim();
    const chassisNumber = document.getElementById('chassisNumber').value.trim();
    
    let isValid = true;
    let errors = [];
    
    // Validate license plate format
    if (plateNumber && !/^[A-Z]{3}-[0-9]{4}$/.test(plateNumber)) {
        const plateField = document.getElementById('plateNumber');
        plateField.classList.add('invalid');
        showFieldError(plateField, 'License plate must be in format ABC-1234');
        errors.push('License plate must be in format ABC-1234 (e.g., ABC-1234)');
        isValid = false;
    }
    
    // Validate year
    const currentYear = new Date().getFullYear();
    if (year && (year < 1990 || year > currentYear)) {
        const yearField = document.getElementById('year');
        yearField.classList.add('invalid');
        showFieldError(yearField, `Year must be between 1990 and ${currentYear}`);
        errors.push(`Year must be between 1990 and ${currentYear}`);
        isValid = false;
    }
    
    // Validate engine number format
    if (engineNumber && engineNumber.length < 5) {
        const engineField = document.getElementById('engineNumber');
        engineField.classList.add('invalid');
        showFieldError(engineField, 'Engine number must be at least 5 characters');
        errors.push('Engine number must be at least 5 characters long');
        isValid = false;
    }
    
    // Validate chassis number format
    if (chassisNumber && chassisNumber.length < 10) {
        const chassisField = document.getElementById('chassisNumber');
        chassisField.classList.add('invalid');
        showFieldError(chassisField, 'Chassis number must be at least 10 characters');
        errors.push('Chassis number must be at least 10 characters long');
        isValid = false;
    }
    
    return { isValid, errors };
}

function validateOwnerInfo() {
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    
    let isValid = true;
    let errors = [];
    
    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const emailField = document.getElementById('email');
        emailField.classList.add('invalid');
        showFieldError(emailField, 'Please enter a valid email address');
        errors.push('Please enter a valid email address (e.g., juan@email.com)');
        isValid = false;
    }
    
    // Validate phone format
    if (phone && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(phone)) {
        const phoneField = document.getElementById('phone');
        phoneField.classList.add('invalid');
        showFieldError(phoneField, 'Please enter a valid phone number');
        errors.push('Please enter a valid phone number (e.g., +63 912 345 6789)');
        isValid = false;
    }
    
    // Validate name format
    if (firstName && firstName.length < 2) {
        const firstNameField = document.getElementById('firstName');
        firstNameField.classList.add('invalid');
        showFieldError(firstNameField, 'First name must be at least 2 characters');
        errors.push('First name must be at least 2 characters long');
        isValid = false;
    }
    
    if (lastName && lastName.length < 2) {
        const lastNameField = document.getElementById('lastName');
        lastNameField.classList.add('invalid');
        showFieldError(lastNameField, 'Last name must be at least 2 characters');
        errors.push('Last name must be at least 2 characters long');
        isValid = false;
    }
    
    return { isValid, errors };
}

function validateDocumentUploads() {
    const requiredFiles = ['registrationCert', 'insuranceCert', 'emissionCert', 'ownerId'];
    let isValid = true;
    let errors = [];
    
    requiredFiles.forEach(fileId => {
        const fileInput = document.getElementById(fileId);
        if (!fileInput.files || fileInput.files.length === 0) {
            fileInput.classList.add('invalid');
            showFieldError(fileInput, 'Please upload this required document');
            const fieldName = fileId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            errors.push(`${fieldName} is required`);
            isValid = false;
        } else {
            fileInput.classList.remove('invalid');
            hideFieldError(fileInput);
        }
    });
    
    return { isValid, errors };
}

function initializeFormValidation() {
    // Add real-time validation for all form fields
    const allInputs = document.querySelectorAll('input, select, textarea');
    allInputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('invalid')) {
                validateField(this);
            }
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    
    // Remove existing validation classes
    field.classList.remove('valid', 'invalid');
    
    if (field.hasAttribute('required') && value.length === 0) {
        field.classList.add('invalid');
        showFieldError(field, 'This field is required');
        return false;
    }
    
    // Specific field validations
    if (field.type === 'email' && value.length > 0) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            field.classList.add('invalid');
            showFieldError(field, 'Please enter a valid email address');
            return false;
        }
    }
    
    if (field.id === 'plateNumber' && value.length > 0) {
        if (!/^[A-Z]{3}-[0-9]{4}$/.test(value)) {
            field.classList.add('invalid');
            showFieldError(field, 'License plate must be in format ABC-1234');
            return false;
        }
    }
    
    if (field.type === 'tel' && value.length > 0) {
        if (!/^[\+]?[0-9\s\-\(\)]{10,}$/.test(value)) {
            field.classList.add('invalid');
            showFieldError(field, 'Please enter a valid phone number');
            return false;
        }
    }
    
    // Field is valid
    if (value.length > 0) {
        field.classList.add('valid');
    }
    hideFieldError(field);
    return true;
}

function showFieldError(field, message) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.textContent = message;
    } else {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }
}

function hideFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function initializeFileUploads() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            handleFileUpload(this);
        });
    });
}

function handleFileUpload(input) {
    const file = input.files[0];
    if (file) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            showFieldError(input, 'Please upload a PDF or JPEG file');
            input.classList.add('invalid');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showFieldError(input, 'File size must be less than 5MB');
            input.classList.add('invalid');
            return;
        }
        
        // File is valid
        input.classList.remove('invalid');
        input.classList.add('valid');
        hideFieldError(input);
        
        // Update upload label
        const label = input.nextElementSibling;
        if (label) {
            label.innerHTML = `
                <span class="upload-icon">✅</span>
                <span>${file.name}</span>
            `;
        }
        
        showNotification(`File "${file.name}" uploaded successfully`, 'success');
    }
}

function initializeProgressTracking() {
    // Add progress tracking functionality
    updateProgressBar();
}

function updateProgressBar() {
    const progressPercentage = (currentStep / totalSteps) * 100;
    // You could add a progress bar element to show visual progress
}

function updateReviewData() {
    // Update review section with form data
    const make = document.getElementById('make').value;
    const model = document.getElementById('model').value;
    const year = document.getElementById('year').value;
    const color = document.getElementById('color').value;
    const plate = document.getElementById('plateNumber').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const idType = document.getElementById('idType').value;

    document.getElementById('review-make-model').textContent = `${make} ${model}`;
    document.getElementById('review-year').textContent = year;
    document.getElementById('review-color').textContent = color;
    document.getElementById('review-plate').textContent = plate;
    document.getElementById('review-name').textContent = `${firstName} ${lastName}`;
    document.getElementById('review-email').textContent = email;
    document.getElementById('review-phone').textContent = phone;
    document.getElementById('review-id-type').textContent = idType;
}

async function submitApplication() {
    const termsAgreement = document.getElementById('termsAgreement');
    
    if (!termsAgreement.checked) {
        showNotification('Please agree to the terms and conditions before submitting', 'error');
        return;
    }
    
    // Show loading state
    showLoadingState();
    
    try {
        // Collect all form data
        const applicationData = collectApplicationData();
        
        // Upload documents first
        const documentUploads = await uploadDocuments();
        applicationData.documents = documentUploads;
        
        // Submit to backend API
        const response = await fetch('/api/vehicles/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(applicationData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Store application locally as backup
            storeApplication(applicationData);
            
            showNotification('Vehicle registration submitted successfully! You will receive a confirmation email shortly.', 'success');
            
            // Redirect to dashboard after delay
            setTimeout(() => {
                window.location.href = 'owner-dashboard.html';
            }, 2000);
        } else {
            throw new Error(result.error || 'Registration failed');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showNotification(`Registration failed: ${error.message}`, 'error');
        
        // Fallback to local storage
        const applicationData = collectApplicationData();
        storeApplication(applicationData);
        showNotification('Application saved locally. Please try again later.', 'warning');
        
    } finally {
        hideLoadingState();
    }
}

function collectApplicationData() {
    // Generate unique application ID
    const applicationId = 'APP-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);
    
    // Collect vehicle information
    const vehicleInfo = {
        make: document.getElementById('make').value,
        model: document.getElementById('model').value,
        year: document.getElementById('year').value,
        color: document.getElementById('color').value,
        engineNumber: document.getElementById('engineNumber').value,
        chassisNumber: document.getElementById('chassisNumber').value,
        plateNumber: document.getElementById('plateNumber').value
    };
    
    // Collect owner information
    const ownerInfo = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        idType: document.getElementById('idType').value,
        idNumber: document.getElementById('idNumber').value
    };
    
    // Collect document information
    const documents = {
        registrationCert: document.getElementById('registrationCert').files[0]?.name || 'Not uploaded',
        insuranceCert: document.getElementById('insuranceCert').files[0]?.name || 'Not uploaded',
        emissionCert: document.getElementById('emissionCert').files[0]?.name || 'Not uploaded',
        ownerId: document.getElementById('ownerId').files[0]?.name || 'Not uploaded'
    };
    
    return {
        id: applicationId,
        vehicle: vehicleInfo,
        owner: ownerInfo,
        documents: documents,
        status: 'submitted',
        submittedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        priority: 'medium',
        adminNotes: '',
        verifierNotes: '',
        insuranceNotes: ''
    };
}

function storeApplication(applicationData) {
    // Get existing applications
    let applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    
    // Add new application
    applications.push(applicationData);
    
    // Store back to localStorage
    localStorage.setItem('submittedApplications', JSON.stringify(applications));
    
    // Also store in user's personal applications
    let userApplications = JSON.parse(localStorage.getItem('userApplications') || '[]');
    userApplications.push(applicationData);
    localStorage.setItem('userApplications', JSON.stringify(userApplications));
    
    console.log('Application stored:', applicationData);
}

function showLoadingState() {
    const submitButton = document.querySelector('#step-4 .btn-primary');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="loading-spinner"></span> Submitting Application...';
        submitButton.classList.add('loading');
    }
}

function hideLoadingState() {
    const submitButton = document.querySelector('#step-4 .btn-primary');
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Application';
        submitButton.classList.remove('loading');
    }
}

function showTopError(message) {
    // Remove existing error messages
    const existingError = document.querySelector('.top-error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create error message at the top
    const errorDiv = document.createElement('div');
    errorDiv.className = 'top-error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-text">
                <h4>Please fix the following errors:</h4>
                <p>${message}</p>
            </div>
            <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Insert at the top of the page
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(errorDiv, main.firstChild);
    } else {
        document.body.insertBefore(errorDiv, document.body.firstChild);
    }
    
    // Auto remove after 8 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 8000);
    
    // Scroll to top to show error
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    }, 5000);
}

// Helper functions for API integration
async function uploadDocuments() {
    const documentTypes = ['registrationCert', 'insuranceCert', 'emissionCert', 'ownerId'];
    const uploadResults = {};
    
    for (const docType of documentTypes) {
        const fileInput = document.getElementById(docType);
        if (fileInput.files && fileInput.files[0]) {
            try {
                const formData = new FormData();
                formData.append('document', fileInput.files[0]);
                formData.append('type', docType);
                
                const response = await fetch('/api/documents/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: formData
                });
                
                const result = await response.json();
                if (result.success) {
                    uploadResults[docType] = {
                        cid: result.cid,
                        filename: result.filename,
                        url: result.url
                    };
                } else {
                    throw new Error(result.error || 'Upload failed');
                }
            } catch (error) {
                console.error(`Upload error for ${docType}:`, error);
                // Fallback to mock data
                uploadResults[docType] = {
                    cid: `mock_cid_${docType}_${Date.now()}`,
                    filename: fileInput.files[0].name,
                    url: `mock_url_${docType}`
                };
            }
        }
    }
    
    return uploadResults;
}

function getAuthToken() {
    // Get token from localStorage or sessionStorage
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || 'mock_token';
}

function generateVIN() {
    // Generate a mock VIN for the vehicle
    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    let vin = '';
    for (let i = 0; i < 17; i++) {
        vin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return vin;
}

// Enhanced collectApplicationData function
function collectApplicationData() {
    // Generate unique application ID and VIN
    const applicationId = 'APP-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);
    const vin = generateVIN();
    
    // Collect vehicle information
    const vehicleInfo = {
        vin: vin,
        make: document.getElementById('make').value,
        model: document.getElementById('model').value,
        year: parseInt(document.getElementById('year').value),
        color: document.getElementById('color').value,
        engineNumber: document.getElementById('engineNumber').value,
        chassisNumber: document.getElementById('chassisNumber').value,
        plateNumber: document.getElementById('plateNumber').value.toUpperCase(),
        vehicleType: 'PASSENGER', // Default type
        fuelType: 'GASOLINE', // Default fuel type
        transmission: 'AUTOMATIC', // Default transmission
        engineDisplacement: '1.5L' // Default displacement
    };
    
    // Collect owner information
    const ownerInfo = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        idType: document.getElementById('idType').value,
        idNumber: document.getElementById('idNumber').value,
        dateOfBirth: new Date().toISOString().split('T')[0], // Mock DOB
        nationality: 'Filipino' // Default nationality
    };
    
    return {
        id: applicationId,
        vin: vin,
        vehicle: vehicleInfo,
        owner: ownerInfo,
        status: 'SUBMITTED',
        submittedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        priority: 'MEDIUM',
        verificationStatus: {
            insurance: 'PENDING',
            emission: 'PENDING',
            admin: 'PENDING'
        },
        notes: {
            admin: '',
            insurance: '',
            emission: ''
        }
    };
}

// Export functions for global access
window.nextStep = nextStep;
window.prevStep = prevStep;
window.submitApplication = submitApplication;

// Export for potential external use
window.RegistrationWizard = {
    nextStep,
    prevStep,
    submitApplication,
    validateCurrentStep,
    showNotification,
    uploadDocuments,
    collectApplicationData
};
