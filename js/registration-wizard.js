// Registration Wizard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeRegistrationWizard();
    initializeKeyboardShortcuts();
    restoreFormData();
});

// Track if form is submitting to prevent double submissions
let isSubmitting = false;
let currentAbortController = null;

function initializeRegistrationWizard() {
    // Initialize wizard functionality
    initializeFormValidation();
    initializeFileUploads();
    initializeProgressTracking();
    
    // Initialize auto-save
    const form = document.querySelector('.wizard-form');
    if (form) {
        FormPersistence.autoSave('registration-wizard', form);
    }
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
    const plateNumber = document.getElementById('plateNumber')?.value.trim() || '';
    const year = document.getElementById('year')?.value || '';
    const engineNumber = document.getElementById('engineNumber')?.value.trim() || '';
    const chassisNumber = document.getElementById('chassisNumber')?.value.trim() || '';
    const vin = document.getElementById('vin')?.value.trim().toUpperCase() || '';
    
    let isValid = true;
    let errors = [];
    
    // Validate VIN (17 characters, alphanumeric, no I, O, Q)
    const vinField = document.getElementById('vin');
    if (vin) {
        const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;
        if (!vinPattern.test(vin)) {
            if (vinField) {
                vinField.classList.add('invalid');
                showFieldError(vinField, 'VIN must be exactly 17 characters (alphanumeric, no I, O, or Q)');
            }
            errors.push('VIN must be exactly 17 characters (alphanumeric, no I, O, or Q)');
            isValid = false;
        } else if (vinField) {
            vinField.classList.remove('invalid');
            vinField.classList.add('valid');
            hideFieldError(vinField);
        }
    }
    
    // Validate license plate format
    if (plateNumber && !/^[A-Z]{3}-[0-9]{4}$/.test(plateNumber.toUpperCase())) {
        const plateField = document.getElementById('plateNumber');
        if (plateField) {
            plateField.classList.add('invalid');
            showFieldError(plateField, 'License plate must be in format ABC-1234');
        }
        errors.push('License plate must be in format ABC-1234 (e.g., ABC-1234)');
        isValid = false;
    }
    
    // Validate year (not future, reasonable range: 1990 to current year)
    const currentYear = new Date().getFullYear();
    const yearNum = parseInt(year);
    if (year && (isNaN(yearNum) || yearNum < 1990 || yearNum > currentYear)) {
        const yearField = document.getElementById('year');
        if (yearField) {
            yearField.classList.add('invalid');
            showFieldError(yearField, `Year must be between 1990 and ${currentYear} (not future)`);
        }
        errors.push(`Year must be between 1990 and ${currentYear} (not future)`);
        isValid = false;
    }
    
    // Validate engine number format
    if (engineNumber && engineNumber.length < 5) {
        const engineField = document.getElementById('engineNumber');
        if (engineField) {
            engineField.classList.add('invalid');
            showFieldError(engineField, 'Engine number must be at least 5 characters');
        }
        errors.push('Engine number must be at least 5 characters long');
        isValid = false;
    }
    
    // Validate chassis number format
    if (chassisNumber && chassisNumber.length < 10) {
        const chassisField = document.getElementById('chassisNumber');
        if (chassisField) {
            chassisField.classList.add('invalid');
            showFieldError(chassisField, 'Chassis number must be at least 10 characters');
        }
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
        if (!/^[A-Z]{3}-[0-9]{4}$/.test(value.toUpperCase())) {
            field.classList.add('invalid');
            showFieldError(field, 'License plate must be in format ABC-1234');
            return false;
        }
    }
    
    if (field.id === 'vin' && value.length > 0) {
        const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;
        if (!vinPattern.test(value.toUpperCase())) {
            field.classList.add('invalid');
            showFieldError(field, 'VIN must be exactly 17 characters (alphanumeric, no I, O, or Q)');
            return false;
        }
    }
    
    if (field.id === 'year' && value.length > 0) {
        const currentYear = new Date().getFullYear();
        const yearNum = parseInt(value);
        if (isNaN(yearNum) || yearNum < 1990 || yearNum > currentYear) {
            field.classList.add('invalid');
            showFieldError(field, `Year must be between 1990 and ${currentYear} (not future)`);
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
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            showFieldError(input, 'Please upload a PDF, JPEG, or PNG file');
            input.classList.add('invalid');
            ToastNotification.show('Invalid file type. Please upload PDF, JPEG, or PNG files only.', 'error');
            input.value = ''; // Clear the input
            return;
        }
        
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            showFieldError(input, `File size (${sizeMB}MB) exceeds maximum of 5MB`);
            input.classList.add('invalid');
            ToastNotification.show(`File size (${sizeMB}MB) exceeds maximum of 5MB. Please choose a smaller file.`, 'error');
            input.value = ''; // Clear the input
            return;
        }
        
        // File is valid
        input.classList.remove('invalid');
        input.classList.add('valid');
        hideFieldError(input);
        
        // Show file preview for images
        const label = input.nextElementSibling;
        if (label && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                label.innerHTML = `
                    <img src="${e.target.result}" style="max-width: 100px; max-height: 100px; border-radius: 4px; margin-bottom: 0.5rem;" alt="Preview">
                    <span>${file.name}</span>
                    <small style="display: block; color: #666; font-size: 0.8rem;">${(file.size / 1024).toFixed(2)} KB</small>
                `;
            };
            reader.readAsDataURL(file);
        } else if (label) {
            label.innerHTML = `
                <span class="upload-icon">✅</span>
                <span>${file.name}</span>
                <small style="display: block; color: #666; font-size: 0.8rem;">${(file.size / 1024).toFixed(2)} KB</small>
            `;
        }
        
        ToastNotification.show(`File "${file.name}" uploaded successfully`, 'success');
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
    // Update review section with form data (with null safety)
    const make = document.getElementById('make')?.value || '';
    const model = document.getElementById('model')?.value || '';
    const year = document.getElementById('year')?.value || '';
    const color = document.getElementById('color')?.value || '';
    const vehicleType = document.getElementById('vehicleType')?.value || 'PASSENGER_CAR';
    const plate = document.getElementById('plateNumber')?.value || '';
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    const idType = document.getElementById('idType')?.value || '';

    // Map vehicle type value to display name (handle both PASSENGER and PASSENGER_CAR)
    const vehicleTypeMap = {
        'PASSENGER_CAR': 'Passenger Car',
        'PASSENGER': 'Passenger Car', // Backward compatibility
        'MOTORCYCLE': 'Motorcycle',
        'UTILITY_VEHICLE': 'Utility Vehicle',
        'TRUCK': 'Truck',
        'BUS': 'Bus'
    };

    // Safely update review elements with null checks
    const reviewMakeModel = document.getElementById('review-make-model');
    const reviewYear = document.getElementById('review-year');
    const reviewColor = document.getElementById('review-color');
    const reviewVehicleType = document.getElementById('review-vehicle-type');
    const reviewPlate = document.getElementById('review-plate');
    const reviewName = document.getElementById('review-name');
    const reviewEmail = document.getElementById('review-email');
    const reviewPhone = document.getElementById('review-phone');
    const reviewIdType = document.getElementById('review-id-type');

    if (reviewMakeModel) reviewMakeModel.textContent = (make && model) ? `${make} ${model}` : '-';
    if (reviewYear) reviewYear.textContent = year || '-';
    if (reviewColor) reviewColor.textContent = color || '-';
    if (reviewVehicleType) reviewVehicleType.textContent = vehicleTypeMap[vehicleType] || vehicleType || '-';
    if (reviewPlate) reviewPlate.textContent = plate || '-';
    if (reviewName) reviewName.textContent = (firstName && lastName) ? `${firstName} ${lastName}` : '-';
    if (reviewEmail) reviewEmail.textContent = email || '-';
    if (reviewPhone) reviewPhone.textContent = phone || '-';
    if (reviewIdType) reviewIdType.textContent = idType || '-';
}

async function submitApplication() {
    // Prevent double submission
    if (isSubmitting) {
        ToastNotification.show('Please wait, submission in progress...', 'warning');
        return;
    }
    
    const termsAgreement = document.getElementById('termsAgreement');
    
    if (!termsAgreement || !termsAgreement.checked) {
        ToastNotification.show('Please agree to the terms and conditions before submitting', 'error');
        return;
    }
    
    // Show confirmation dialog
    const confirmed = await ConfirmationDialog.show({
        title: 'Submit Application',
        message: 'Are you sure you want to submit this vehicle registration application? Please review all information before proceeding.',
        confirmText: 'Submit Application',
        cancelText: 'Review Again',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (!confirmed) {
        return;
    }
    
    isSubmitting = true;
    
    // Cancel any previous requests
    if (currentAbortController) {
        currentAbortController.abort();
    }
    
    // Create new abort controller
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    
    const submitButton = document.querySelector('#step-4 .btn-primary');
    LoadingManager.show(submitButton, 'Submitting...');
    
    // Disable all form buttons
    const allButtons = document.querySelectorAll('#step-4 button');
    allButtons.forEach(btn => btn.disabled = true);
    
    try {
        // Collect all form data
        const applicationData = collectApplicationData();
        
        // Upload documents first with abort signal
        let documentUploads = {};
        try {
            documentUploads = await uploadDocuments(signal);
            applicationData.documents = documentUploads;
        } catch (uploadError) {
            // If document uploads fail, log warning but allow registration to proceed
            console.warn('⚠️ Document uploads failed, but proceeding with registration:', uploadError.message);
            console.warn('   Documents can be uploaded later. Registration will continue without documents.');
            
            // Show user-friendly warning
            ToastNotification.show(
                'Warning: Some documents failed to upload. Registration will continue, but you may need to upload documents later.',
                'warning',
                8000
            );
            
            // Continue with empty documents object
            applicationData.documents = {};
        }
        
        // Submit to backend API using apiClient
        const result = await apiClient.post('/api/vehicles/register', applicationData);
        
        if (result.success) {
            // Clear saved form data
            FormPersistence.clear('registration-wizard');
            
            // Store application locally as backup (only on success)
            storeApplication(applicationData);
            
            // Success animation
            const reviewSection = document.querySelector('.review-section');
            if (reviewSection) {
                reviewSection.classList.add('success-animation');
            }
            
            ToastNotification.show('Vehicle registration submitted successfully! You will receive a confirmation email shortly.', 'success', 6000);
            
            // Redirect to dashboard after delay
            setTimeout(() => {
                window.location.href = 'owner-dashboard.html';
            }, 3000);
        } else {
            throw new Error(result.error || 'Registration failed');
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            ToastNotification.show('Request cancelled', 'info');
            return;
        }
        
        // Check if it's a duplicate VIN error (409 Conflict)
        const isDuplicateError = error.message && (
            error.message.includes('already exists') || 
            error.message.includes('Vehicle with this VIN') ||
            error.message.includes('duplicate')
        );
        
        // Use ErrorHandler if available, otherwise show error
        if (typeof ErrorHandler !== 'undefined') {
            ErrorHandler.handleAPIError(error, 'Registration');
        } else {
            console.error('Registration error:', error);
            ToastNotification.show(error.message || 'Registration failed. Please try again.', 'error', 8000);
        }
        
        // Don't save locally if it's a duplicate VIN error - user needs to fix the VIN
        if (isDuplicateError) {
            // Highlight the VIN field to help user identify the issue
            const vinInput = document.querySelector('input[name="vin"], #vin');
            if (vinInput) {
                vinInput.classList.add('error');
                vinInput.focus();
                // Show field-specific error
                const errorMsg = document.createElement('div');
                errorMsg.className = 'field-error';
                errorMsg.textContent = 'This VIN is already registered. Please check your VIN number.';
                errorMsg.style.color = '#e74c3c';
                errorMsg.style.fontSize = '0.875rem';
                errorMsg.style.marginTop = '0.25rem';
                // Remove existing error message if any
                const existingError = vinInput.parentElement.querySelector('.field-error');
                if (existingError) existingError.remove();
                vinInput.parentElement.appendChild(errorMsg);
            }
            return; // Don't proceed with local storage
        }
        
        // Fallback to local storage as backup (only for non-duplicate errors)
        try {
            const applicationData = collectApplicationData();
            storeApplication(applicationData);
            ToastNotification.show('Application saved locally as backup. Please try again later.', 'warning');
        } catch (storageError) {
            console.error('Failed to save application locally:', storageError);
        }
        
    } finally {
        isSubmitting = false;
        LoadingManager.hide(submitButton);
        allButtons.forEach(btn => btn.disabled = false);
        currentAbortController = null;
    }
}

function storeApplication(applicationData) {
    // REMOVED: Applications are now stored in PostgreSQL via API
    // No longer storing in localStorage - data persists in database
    // This function is kept for backward compatibility but does nothing
    
    // Only log in development to reduce console noise
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Application registered successfully (stored in PostgreSQL):', { 
            id: applicationData.id, 
            vin: applicationData.vehicle?.vin 
        });
    }
}

// Restore form data on page load
function restoreFormData() {
    const form = document.querySelector('.wizard-form');
    if (form && FormPersistence.restore('registration-wizard', form)) {
        ToastNotification.show('Previous form data restored', 'info', 3000);
    }
}

// Keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+S or Cmd+S to save (prevent default and show message)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            ToastNotification.show('Form data is automatically saved as you type', 'info');
        }
        
        // Escape to go back
        if (e.key === 'Escape' && currentStep > 1) {
            prevStep();
        }
        
        // Enter to proceed (if on a step with next button)
        if (e.key === 'Enter' && !e.shiftKey && !e.target.matches('textarea')) {
            const activeStep = document.querySelector('.wizard-step.active');
            if (activeStep) {
                const nextButton = activeStep.querySelector('.btn-primary');
                if (nextButton && !nextButton.disabled) {
                    e.preventDefault();
                    if (currentStep < totalSteps) {
                        nextStep();
                    } else if (currentStep === totalSteps) {
                        submitApplication();
                    }
                }
            }
        }
    });
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

// Legacy notification function - now uses ToastNotification
function showNotification(message, type = 'info') {
    ToastNotification.show(message, type);
}

// Helper functions for API integration
async function uploadDocuments(signal) {
    const documentTypes = ['registrationCert', 'insuranceCert', 'emissionCert', 'ownerId'];
    const uploadResults = {};
    const uploadErrors = [];
    
    // Upload documents in parallel for better performance
    const uploadPromises = documentTypes.map(async (docType) => {
        const fileInput = document.getElementById(docType);
        if (fileInput && fileInput.files && fileInput.files[0]) {
            try {
                // Check if request was aborted
                if (signal && signal.aborted) {
                    throw new Error('Upload cancelled');
                }
                
                const formData = new FormData();
                formData.append('document', fileInput.files[0]);
                formData.append('type', docType);
                
                // Use apiClient upload method for FormData
                const result = await apiClient.upload('/api/documents/upload', formData);
                
                if (result && result.success) {
                    // Verify storage mode - should be 'ipfs' when STORAGE_MODE=ipfs
                    const actualStorageMode = result.storageMode || result.document?.storageMode;
                    if (!actualStorageMode || actualStorageMode === 'local') {
                        console.warn(`⚠️ Document uploaded but storage mode is 'local' instead of 'ipfs'. Check STORAGE_MODE environment variable.`);
                    }
                    
                    uploadResults[docType] = {
                        id: result.document?.id || result.id || null, // Include document ID for linking
                        cid: result.cid || result.document?.cid || null,
                        filename: result.filename || result.document?.filename || fileInput.files[0].name,
                        url: result.url || result.document?.url || `/uploads/${result.filename || result.document?.filename}`,
                        storageMode: actualStorageMode || 'unknown'
                    };
                    
                    // Log success with storage mode
                    const storageMode = uploadResults[docType].storageMode === 'ipfs' ? '🌐 IPFS' : 
                                      uploadResults[docType].storageMode === 'local' ? '📁 Local (WARNING: Should be IPFS!)' : 
                                      '❓ Unknown';
                    console.log(`✅ Uploaded ${docType} to ${storageMode}:`, uploadResults[docType]);
                } else {
                    // Check if there's a warning but still proceed
                    if (result && result.warning) {
                        console.warn(`⚠️ Upload warning for ${docType}:`, result.warning);
                        // Still add to results with available data
                        const actualStorageMode = result.storageMode || 'unknown';
                        if (actualStorageMode === 'local') {
                            console.warn(`⚠️ Document fallback to local storage. Check IPFS service and STORAGE_MODE setting.`);
                        }
                        
                        uploadResults[docType] = {
                            id: result.document?.id || result.id || null, // Include document ID for linking
                            cid: result.cid || null,
                            filename: result.filename || fileInput.files[0].name,
                            url: result.url || `/uploads/${result.filename || fileInput.files[0].name}`,
                            storageMode: actualStorageMode,
                            warning: result.warning
                        };
                    } else {
                        throw new Error(result?.error || result?.message || 'Upload failed');
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw error; // Re-throw abort errors immediately
                }
                
                // Log detailed error for debugging
                console.error(`Upload error for ${docType}:`, error);
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                
                // Store error but don't fail entire upload
                uploadErrors.push({ docType, error: error.message });
                
                // Use ErrorHandler if available (but don't throw)
                if (typeof ErrorHandler !== 'undefined') {
                    ErrorHandler.handleAPIError(error, `Document Upload (${docType})`);
                }
                
                // For required documents (registrationCert), we should fail
                if (docType === 'registrationCert') {
                    throw new Error(`Failed to upload required ${docType} document: ${error.message || 'Unknown error'}`);
                }
                
                // For optional documents, just log and continue
                console.warn(`⚠️ Optional document ${docType} upload failed, continuing...`);
            }
        }
    });
    
    // Wait for all uploads to complete
    await Promise.allSettled(uploadPromises);
    
    // If we have errors but no results, throw
    if (uploadErrors.length > 0 && Object.keys(uploadResults).length === 0) {
        throw new Error(`All document uploads failed: ${uploadErrors.map(e => e.error).join(', ')}`);
    }
    
    // Log summary
    if (uploadErrors.length > 0) {
        console.warn(`⚠️ Some documents failed to upload:`, uploadErrors);
    }
    
    return uploadResults;
}

function getAuthToken() {
    // Get token from localStorage or sessionStorage
    // Get token and check authentication
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
        // Not authenticated, redirect to login
        window.location.href = 'login-signup.html?redirect=' + encodeURIComponent(window.location.pathname);
        return null;
    }
    
    // Check token expiration if AuthUtils is available
    if (typeof AuthUtils !== 'undefined') {
        if (!AuthUtils.isAuthenticated()) {
            return null; // AuthUtils will handle redirect
        }
    }
    
    return token;
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
    // Generate unique application ID
    const applicationId = 'APP-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);
    
    // Get VIN from form or generate if not provided
    const vinInput = document.getElementById('vin');
    const vin = vinInput ? vinInput.value.trim().toUpperCase() : generateVIN();
    
    // Collect vehicle information
    const vehicleInfo = {
        vin: vin || generateVIN(),
        make: document.getElementById('make')?.value || '',
        model: document.getElementById('model')?.value || '',
        year: parseInt(document.getElementById('year')?.value || new Date().getFullYear()),
        color: document.getElementById('color')?.value || '',
        engineNumber: document.getElementById('engineNumber')?.value || '',
        chassisNumber: document.getElementById('chassisNumber')?.value || '',
        plateNumber: document.getElementById('plateNumber')?.value.toUpperCase() || '',
        vehicleType: document.getElementById('vehicleType')?.value || 'PASSENGER_CAR',
        fuelType: 'GASOLINE', // Default fuel type
        transmission: 'AUTOMATIC', // Default transmission
        engineDisplacement: '1.5L' // Default displacement
    };
    
    // Collect owner information
    const ownerInfo = {
        firstName: document.getElementById('firstName')?.value || '',
        lastName: document.getElementById('lastName')?.value || '',
        email: document.getElementById('email')?.value || '',
        phone: document.getElementById('phone')?.value || '',
        address: document.getElementById('address')?.value || '',
        idType: document.getElementById('idType')?.value || '',
        idNumber: document.getElementById('idNumber')?.value || '',
        dateOfBirth: new Date().toISOString().split('T')[0], // Mock DOB
        nationality: 'Filipino' // Default nationality
    };
    
    return {
        id: applicationId,
        vin: vin || generateVIN(),
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
