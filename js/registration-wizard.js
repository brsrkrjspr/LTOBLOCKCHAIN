// Registration Wizard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeRegistrationWizard();
    initializeKeyboardShortcuts();
    restoreFormData();
});

// Track if form is submitting to prevent double submissions
let isSubmitting = false;
let currentAbortController = null;

// Store vehicle type value when selected
let storedVehicleType = null;

function initializeRegistrationWizard() {
    // Initialize wizard functionality
    initializeFormValidation();
    initializeFileUploads();
    initializeProgressTracking();
    
    // Ensure only step 1 is visible initially
    // Steps 2, 3, and 4 should be hidden until their previous step is completed
    for (let i = 2; i <= totalSteps; i++) {
        const stepElement = document.getElementById(`step-${i}`);
        const progressStep = document.querySelector(`[data-step="${i}"]`);
        
        if (stepElement) {
            stepElement.classList.remove('active');
        }
        if (progressStep) {
            progressStep.classList.remove('active', 'accessible');
        }
    }
    
    // Ensure step 1 is visible and accessible
    const step1Element = document.getElementById('step-1');
    const progressStep1 = document.querySelector('[data-step="1"]');
    
    if (step1Element) {
        step1Element.classList.add('active');
    }
    if (progressStep1) {
        progressStep1.classList.add('active', 'accessible');
    }
    
    // Store vehicle type when it changes
    const vehicleTypeSelect = document.getElementById('vehicleType');
    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener('change', function() {
            storedVehicleType = this.value;
            console.log('Vehicle type selected and stored:', storedVehicleType);
        });
    }
    
    // Initialize auto-save
    const form = document.querySelector('.wizard-form');
    if (form) {
        FormPersistence.autoSave('registration-wizard', form);
    }
    
    // Load dynamic document requirements (Step 1 - Documents first)
    loadDocumentRequirements();
    
    // Setup OCR auto-fill when documents are uploaded
    setupOCRAutoFill();
}

let currentStep = 1;
const totalSteps = 4;

function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
            // Mark current step as completed
            const currentStepElement = document.getElementById(`step-${currentStep}`);
            const currentProgressStep = document.querySelector(`[data-step="${currentStep}"]`);
            
            // Hide current step
            currentStepElement.classList.remove('active');
            currentProgressStep.classList.remove('active');
            currentProgressStep.classList.add('completed');
            
            currentStep++;
            
            // Make next step accessible and show it
            const nextStepElement = document.getElementById(`step-${currentStep}`);
            const nextProgressStep = document.querySelector(`[data-step="${currentStep}"]`);
            
            // Mark next step as accessible (visible in progress indicator)
            nextProgressStep.classList.add('accessible');
            
            // Show next step
            nextStepElement.classList.add('active');
            nextProgressStep.classList.add('active');
            
            // Update review data if on final step
            if (currentStep === 4) {
                // Use setTimeout to ensure DOM is fully rendered before updating
                setTimeout(() => {
                    updateReviewData();
                }, 100);
            }
            
            // Scroll to top of form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        // Hide current step
        const currentStepElement = document.getElementById(`step-${currentStep}`);
        const currentProgressStep = document.querySelector(`[data-step="${currentStep}"]`);
        
        currentStepElement.classList.remove('active');
        currentProgressStep.classList.remove('active');
        
        currentStep--;
        
        // Show previous step (it's already accessible since we've been there)
        const prevStepElement = document.getElementById(`step-${currentStep}`);
        const prevProgressStep = document.querySelector(`[data-step="${currentStep}"]`);
        
        prevStepElement.classList.add('active');
        prevProgressStep.classList.add('active');
        prevProgressStep.classList.remove('completed'); // Remove completed status when going back
        
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
    const vehicleType = document.getElementById('vehicleType')?.value || '';
    const vehicleCategory = document.getElementById('vehicleCategory')?.value || '';
    const passengerCapacity = parseInt(document.getElementById('passengerCapacity')?.value || 0);
    const grossVehicleWeight = parseFloat(document.getElementById('grossVehicleWeight')?.value || 0);
    const netWeight = parseFloat(document.getElementById('netWeight')?.value || 0);
    const classification = document.getElementById('classification')?.value || '';
    
    let isValid = true;
    let errors = [];
    
    // Validate vehicle type (required field)
    const vehicleTypeField = document.getElementById('vehicleType');
    if (!vehicleType || !vehicleType.trim()) {
        if (vehicleTypeField) {
            vehicleTypeField.classList.add('invalid');
            showFieldError(vehicleTypeField, 'Please select a vehicle type');
        }
        errors.push('Vehicle type is required');
        isValid = false;
    } else if (vehicleTypeField) {
        vehicleTypeField.classList.remove('invalid');
        vehicleTypeField.classList.add('valid');
        hideFieldError(vehicleTypeField);
    }
    
    // Validate vehicle category (PNS code)
    const vehicleCategoryField = document.getElementById('vehicleCategory');
    if (!vehicleCategory || !vehicleCategory.trim()) {
        if (vehicleCategoryField) {
            vehicleCategoryField.classList.add('invalid');
            showFieldError(vehicleCategoryField, 'Please select a vehicle category');
        }
        errors.push('Vehicle category is required');
        isValid = false;
    } else {
        const categoryPattern = /^(L[1-5]|M[1-3]|N[1-3]|O[1-4])$/;
        if (!categoryPattern.test(vehicleCategory)) {
            if (vehicleCategoryField) {
                vehicleCategoryField.classList.add('invalid');
                showFieldError(vehicleCategoryField, 'Invalid vehicle category. Must be a valid PNS code.');
            }
            errors.push('Invalid vehicle category. Must be a valid PNS code (L1-L5, M1-M3, N1-N3, O1-O4)');
            isValid = false;
        } else if (vehicleCategoryField) {
            vehicleCategoryField.classList.remove('invalid');
            vehicleCategoryField.classList.add('valid');
            hideFieldError(vehicleCategoryField);
        }
    }
    
    // Validate passenger capacity
    const passengerCapacityField = document.getElementById('passengerCapacity');
    if (!passengerCapacity || isNaN(passengerCapacity) || passengerCapacity < 1 || passengerCapacity > 100) {
        if (passengerCapacityField) {
            passengerCapacityField.classList.add('invalid');
            showFieldError(passengerCapacityField, 'Passenger capacity must be between 1 and 100');
        }
        errors.push('Passenger capacity must be between 1 and 100');
        isValid = false;
    } else if (passengerCapacityField) {
        passengerCapacityField.classList.remove('invalid');
        passengerCapacityField.classList.add('valid');
        hideFieldError(passengerCapacityField);
    }
    
    // Validate gross vehicle weight
    const grossVehicleWeightField = document.getElementById('grossVehicleWeight');
    if (!grossVehicleWeight || isNaN(grossVehicleWeight) || grossVehicleWeight <= 0) {
        if (grossVehicleWeightField) {
            grossVehicleWeightField.classList.add('invalid');
            showFieldError(grossVehicleWeightField, 'Gross Vehicle Weight must be greater than 0');
        }
        errors.push('Gross Vehicle Weight must be greater than 0');
        isValid = false;
    } else if (grossVehicleWeightField) {
        grossVehicleWeightField.classList.remove('invalid');
        grossVehicleWeightField.classList.add('valid');
        hideFieldError(grossVehicleWeightField);
    }
    
    // Validate net weight
    const netWeightField = document.getElementById('netWeight');
    if (!netWeight || isNaN(netWeight) || netWeight <= 0) {
        if (netWeightField) {
            netWeightField.classList.add('invalid');
            showFieldError(netWeightField, 'Net weight must be greater than 0');
        }
        errors.push('Net weight must be greater than 0');
        isValid = false;
    } else if (netWeight >= grossVehicleWeight) {
        if (netWeightField) {
            netWeightField.classList.add('invalid');
            showFieldError(netWeightField, 'Net weight must be less than Gross Vehicle Weight');
        }
        errors.push('Net weight must be less than Gross Vehicle Weight');
        isValid = false;
    } else if (netWeightField) {
        netWeightField.classList.remove('invalid');
        netWeightField.classList.add('valid');
        hideFieldError(netWeightField);
    }
    
    // Validate classification
    const classificationField = document.getElementById('classification');
    const validClassifications = ['Private', 'For Hire', 'Government', 'Exempt'];
    if (!classification || !classification.trim()) {
        if (classificationField) {
            classificationField.classList.add('invalid');
            showFieldError(classificationField, 'Please select a classification');
        }
        errors.push('Classification is required');
        isValid = false;
    } else if (!validClassifications.includes(classification)) {
        if (classificationField) {
            classificationField.classList.add('invalid');
            showFieldError(classificationField, 'Invalid classification');
        }
        errors.push('Classification must be one of: Private, For Hire, Government, Exempt');
        isValid = false;
    } else if (classificationField) {
        classificationField.classList.remove('invalid');
        classificationField.classList.add('valid');
        hideFieldError(classificationField);
    }
    
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
    // Fix: Handle empty string case - if empty, use default
    // Try to get value from element first, then from stored value
    const vehicleTypeElement = document.getElementById('vehicleType');
    let vehicleTypeRaw = vehicleTypeElement?.value || '';
    
    // If element value is empty, try stored value
    if (!vehicleTypeRaw && storedVehicleType) {
        vehicleTypeRaw = storedVehicleType;
        console.log('Using stored vehicle type:', storedVehicleType);
    }
    
    const vehicleType = vehicleTypeRaw.trim() || 'PASSENGER_CAR';
    const plate = document.getElementById('plateNumber')?.value || '';
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    const idType = document.getElementById('idType')?.value || '';

    // Debug logging
    console.log('updateReviewData - vehicleType:', {
        element: vehicleTypeElement,
        rawValue: vehicleTypeRaw,
        trimmedValue: vehicleType,
        selectedIndex: vehicleTypeElement?.selectedIndex,
        selectedOption: vehicleTypeElement?.options[vehicleTypeElement?.selectedIndex]?.text
    });

    // Map vehicle type value to display name (handle both old and new formats)
    const vehicleTypeMap = {
        'PASSENGER_CAR': 'Passenger Car',
        'PASSENGER': 'Passenger Car', // Backward compatibility
        'Car': 'Car',
        'MOTORCYCLE': 'Motorcycle',
        'MC/TC': 'MC/TC (Motorcycle/Tricycle)',
        'UTILITY_VEHICLE': 'Utility Vehicle',
        'UV': 'UV (Utility Vehicle)',
        'SUV': 'SUV',
        'TRUCK': 'Truck',
        'Truck': 'Truck',
        'BUS': 'Bus',
        'Bus': 'Bus',
        'Trailer': 'Trailer'
    };
    
    // Get new LTO fields
    const vehicleCategory = document.getElementById('vehicleCategory')?.value || '';
    const passengerCapacity = document.getElementById('passengerCapacity')?.value || '';
    const grossVehicleWeight = document.getElementById('grossVehicleWeight')?.value || '';
    const netWeight = document.getElementById('netWeight')?.value || '';
    const classification = document.getElementById('classification')?.value || '';

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
    
    // Fix: Map vehicle type value to display name with better fallback
    // If vehicleType is empty or not in map, use default 'Passenger Car'
    let displayVehicleType = 'Passenger Car'; // Default
    
    // First, try to get the value from the select element directly
    if (vehicleTypeElement) {
        const selectedValue = vehicleTypeElement.value;
        const selectedIndex = vehicleTypeElement.selectedIndex;
        const selectedOption = vehicleTypeElement.options[selectedIndex];
        
        console.log('updateReviewData - select element details:', {
            selectedValue,
            selectedIndex,
            selectedOptionText: selectedOption?.text,
            selectedOptionValue: selectedOption?.value
        });
        
        // If we have a selected option with a value, use it
        if (selectedValue && selectedValue.trim()) {
            if (vehicleTypeMap[selectedValue]) {
                displayVehicleType = vehicleTypeMap[selectedValue];
            } else if (selectedOption && selectedOption.text) {
                // Use the option text as fallback
                displayVehicleType = selectedOption.text;
            }
        } else if (selectedOption && selectedOption.text && selectedOption.value) {
            // Fallback to option text if value is empty but option exists
            displayVehicleType = selectedOption.text;
        }
    } else {
        // If element not found, try using the vehicleType variable
        if (vehicleType && vehicleTypeMap[vehicleType]) {
            displayVehicleType = vehicleTypeMap[vehicleType];
        } else if (vehicleType) {
            displayVehicleType = vehicleType;
        }
    }
    
    console.log('updateReviewData - final displayVehicleType:', displayVehicleType);
    if (reviewVehicleType) {
        reviewVehicleType.textContent = displayVehicleType;
        console.log('updateReviewData - set textContent to:', displayVehicleType);
    } else {
        console.error('review-vehicle-type element not found!');
    }
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
            
            // Application stored in PostgreSQL via API (no localStorage backup)
            
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
        
        // STRICT: No localStorage fallback - real services only
        // If API fails, user must retry with working backend connection
        
    } finally {
        isSubmitting = false;
        LoadingManager.hide(submitButton);
        allButtons.forEach(btn => btn.disabled = false);
        currentAbortController = null;
    }
}

function storeApplication(applicationData) {
    // STRICT: Applications are stored ONLY in PostgreSQL via API
    // NO localStorage backup - real services only
    // If API fails, the error will be thrown and handled by the caller
    
    // Only log in development to reduce console noise
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Application registered successfully (stored in PostgreSQL only):', { 
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
    const uploadResults = {};
    const uploadErrors = [];
    
    // Find all file inputs in the document upload container (dynamic or static)
    const container = document.getElementById('document-upload-container');
    const fileInputs = container ? 
        Array.from(container.querySelectorAll('input[type="file"]')) :
        // Fallback: try to find static fields
        ['registrationCert', 'insuranceCert', 'emissionCert', 'ownerId']
            .map(id => document.getElementById(id))
            .filter(input => input !== null);
    
    // Upload documents in parallel for better performance
    const uploadPromises = fileInputs.map(async (fileInput) => {
        // Handle both direct input elements and IDs
        const input = typeof fileInput === 'string' ? document.getElementById(fileInput) : fileInput;
        if (!input) return;
        
        if (input.files && input.files[0]) {
            // Get document type from data attribute or ID
            const docType = input.getAttribute('data-document-type') || 
                           input.id || 
                           input.name;
            
            // Validate file size if max size is specified
            const maxSize = input.getAttribute('data-max-size');
            if (maxSize && input.files[0].size > parseInt(maxSize)) {
                const maxSizeMB = (parseInt(maxSize) / (1024 * 1024)).toFixed(1);
                uploadErrors.push(`${docType}: File size exceeds ${maxSizeMB}MB limit`);
                return;
            }
            try {
                // Check if request was aborted
                if (signal && signal.aborted) {
                    throw new Error('Upload cancelled');
                }
                
                const formData = new FormData();
                formData.append('document', input.files[0]);
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
                        filename: result.filename || result.document?.filename || input.files[0].name,
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
                        filename: result.filename || input.files[0].name,
                        url: result.url || `/uploads/${result.filename || input.files[0].name}`,
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
    const token = (typeof window !== 'undefined' && window.authManager) 
        ? window.authManager.getAccessToken() 
        : (localStorage.getItem('authToken') || sessionStorage.getItem('authToken'));
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
        vehicleType: document.getElementById('vehicleType')?.value || 'Car',
        vehicleCategory: document.getElementById('vehicleCategory')?.value || '',
        passengerCapacity: parseInt(document.getElementById('passengerCapacity')?.value || 0),
        grossVehicleWeight: parseFloat(document.getElementById('grossVehicleWeight')?.value || 0),
        netWeight: parseFloat(document.getElementById('netWeight')?.value || 0),
        classification: document.getElementById('classification')?.value || 'Private'
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
            hpg: 'PENDING'  // Changed from 'admin' to 'hpg' to match dashboard expectations
        },
        notes: {
            admin: '',
            insurance: '',
            emission: ''
        }
    };
}

/**
 * Load document requirements from API and render upload fields
 */
async function loadDocumentRequirements(registrationType = 'NEW') {
    try {
        const container = document.getElementById('document-upload-container');
        if (!container) {
            console.warn('Document upload container not found');
            return;
        }

        // Show loading state
        container.innerHTML = '<div class="loading-message">Loading document requirements...</div>';

        const apiClient = window.apiClient || (window.APIClient && new window.APIClient());
        if (!apiClient) {
            // Fallback to static fields if API client not available
            renderStaticDocumentFields(container);
            return;
        }

        // Fetch document requirements
        const response = await apiClient.get(`/api/document-requirements/${registrationType}`);
        
        if (response && response.success && response.requirements) {
            renderDocumentUploadFields(response.requirements, container);
        } else {
            console.warn('Failed to load document requirements, using static fields');
            renderStaticDocumentFields(container);
        }
    } catch (error) {
        console.error('Error loading document requirements:', error);
        // Fallback to static fields on error
        const container = document.getElementById('document-upload-container');
        if (container) {
            renderStaticDocumentFields(container);
        }
    }
}

/**
 * Render document upload fields from requirements
 */
function renderDocumentUploadFields(requirements, container) {
    container.innerHTML = '';

    if (!requirements || requirements.length === 0) {
        container.innerHTML = '<div class="error-message">No document requirements found. Please contact support.</div>';
        return;
    }

    // Filter active requirements and sort by display order
    const activeRequirements = requirements
        .filter(r => r.is_active !== false)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    activeRequirements.forEach(req => {
        const uploadItem = document.createElement('div');
        uploadItem.className = 'upload-item';
        
        // Map document_type to field ID (camelCase)
        const fieldId = req.document_type.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        
        // Build accept attribute from accepted_formats
        const acceptFormats = req.accepted_formats || 'pdf,jpg,jpeg,png';
        const acceptAttr = acceptFormats.split(',').map(f => `.${f.trim()}`).join(',');
        
        uploadItem.innerHTML = `
            <div class="upload-info">
                <h4>${escapeHtml(req.display_name)} ${req.is_required ? '<span class="required">*</span>' : ''}</h4>
                <p>${escapeHtml(req.description || '')}</p>
                <small class="form-hint">Accepted: ${escapeHtml(acceptFormats)} | Max: ${req.max_file_size_mb || 10}MB</small>
            </div>
            <div class="upload-area">
                <input type="file" 
                       id="${fieldId}" 
                       name="${fieldId}"
                       accept="${acceptAttr}"
                       data-document-type="${req.document_type}"
                       data-max-size="${(req.max_file_size_mb || 10) * 1024 * 1024}"
                       ${req.is_required ? 'required' : ''}>
                <label for="${fieldId}" class="upload-label">
                    <span class="upload-icon">📄</span>
                    <span>Choose File</span>
                </label>
            </div>
        `;
        
        container.appendChild(uploadItem);
    });
}

/**
 * Render static document fields as fallback
 */
function renderStaticDocumentFields(container) {
    container.innerHTML = `
        <div class="upload-item">
            <div class="upload-info">
                <h4>Vehicle Registration Certificate <span class="required">*</span></h4>
                <p>Upload your current vehicle registration certificate (PDF, JPEG)</p>
            </div>
            <div class="upload-area">
                <input type="file" id="registrationCert" accept=".pdf,.jpg,.jpeg" required>
                <label for="registrationCert" class="upload-label">
                    <span class="upload-icon">📄</span>
                    <span>Choose File</span>
                </label>
            </div>
        </div>
        <div class="upload-item">
            <div class="upload-info">
                <h4>Insurance Certificate <span class="required">*</span></h4>
                <p>Upload your vehicle insurance certificate (PDF, JPEG)</p>
            </div>
            <div class="upload-area">
                <input type="file" id="insuranceCert" accept=".pdf,.jpg,.jpeg" required>
                <label for="insuranceCert" class="upload-label">
                    <span class="upload-icon">🛡️</span>
                    <span>Choose File</span>
                </label>
            </div>
        </div>
        <div class="upload-item">
            <div class="upload-info">
                <h4>Emission Test Certificate <span class="required">*</span></h4>
                <p>Upload your emission test certificate (PDF, JPEG)</p>
            </div>
            <div class="upload-area">
                <input type="file" id="emissionCert" accept=".pdf,.jpg,.jpeg" required>
                <label for="emissionCert" class="upload-label">
                    <span class="upload-icon">🌱</span>
                    <span>Choose File</span>
                </label>
            </div>
        </div>
        <div class="upload-item">
            <div class="upload-info">
                <h4>Owner's ID <span class="required">*</span></h4>
                <p>Upload a copy of your valid ID (PDF, JPEG)</p>
            </div>
            <div class="upload-area">
                <input type="file" id="ownerId" accept=".pdf,.jpg,.jpeg" required>
                <label for="ownerId" class="upload-label">
                    <span class="upload-icon">🆔</span>
                    <span>Choose File</span>
                </label>
            </div>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Setup OCR auto-fill when documents are uploaded
 * This will extract data from documents and auto-fill vehicle and owner fields
 */
function setupOCRAutoFill() {
    // This will be called after document upload container is loaded
    // We'll set up event listeners when the container is ready
    setTimeout(() => {
        const container = document.getElementById('document-upload-container');
        if (!container) return;
        
        // Use event delegation to handle file inputs that are dynamically added
        container.addEventListener('change', async function(e) {
            if (e.target.type === 'file' && e.target.files && e.target.files[0]) {
                await processDocumentForOCRAutoFill(e.target);
            }
        });
    }, 1000);
}

/**
 * Process document upload and extract data via OCR for auto-fill
 */
async function processDocumentForOCRAutoFill(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    
    const documentType = fileInput.getAttribute('data-document-type') || fileInput.id;
    
    try {
        const apiClient = window.apiClient || (window.APIClient && new window.APIClient());
        if (!apiClient) {
            console.log('API client not available for OCR');
            return;
        }
        
        // Show processing indicator
        const indicator = document.createElement('div');
        indicator.className = 'ocr-processing';
        indicator.textContent = 'Extracting information from document...';
        indicator.style.cssText = 'color: #667eea; font-size: 0.875rem; margin-top: 0.5rem;';
        fileInput.parentElement.appendChild(indicator);
        
        // Create FormData for OCR extraction
        const formData = new FormData();
        formData.append('document', file);
        formData.append('documentType', documentType);
        
        // Call OCR endpoint
        try {
            // Get auth token from localStorage or apiClient
            let authToken = null;
            if (typeof AuthUtils !== 'undefined' && AuthUtils.getToken) {
                authToken = AuthUtils.getToken();
            } else if (typeof localStorage !== 'undefined') {
                authToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
            }
            
            // Use getAuthToken function (defined in this file)
            const token = getAuthToken();
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/documents/extract-info', {
                method: 'POST',
                headers: headers,
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success && data.extractedData) {
                // Auto-fill fields based on extracted data
                autoFillFromOCRData(data.extractedData, documentType);
                
                indicator.textContent = '✓ Information extracted and auto-filled';
                indicator.style.color = '#27ae60';
                
                // Remove indicator after 3 seconds
                setTimeout(() => indicator.remove(), 3000);
            } else {
                indicator.textContent = 'Could not extract information (manual entry required)';
                indicator.style.color = '#e74c3c';
                setTimeout(() => indicator.remove(), 3000);
            }
        } catch (ocrError) {
            // OCR endpoint not available yet (Task 4 not implemented)
            console.log('OCR extraction not available:', ocrError);
            indicator.remove();
            
            // Fallback: Still auto-fill owner info from profile if logged in
            if (documentType === 'owner_id' || documentType === 'ownerId') {
                autoFillOwnerInfo();
            }
        }
    } catch (error) {
        console.error('Error processing document for OCR:', error);
    }
}

/**
 * Auto-fill form fields from OCR extracted data
 */
function autoFillFromOCRData(extractedData, documentType) {
    console.log('Auto-filling from OCR data:', extractedData, 'Document type:', documentType);
    
    // Map OCR fields to form field IDs
    const fieldMappings = {
        // Vehicle fields
        vin: 'vin',
        engineNumber: 'engineNumber',
        chassisNumber: 'chassisNumber',
        plateNumber: 'plateNumber',
        make: 'make',
        model: 'model',
        year: 'year',
        color: 'color',
        
        // Owner fields
        firstName: 'firstName',
        lastName: 'lastName',
        address: 'address',
        phone: 'phone'
    };
    
    // Auto-fill vehicle fields (Step 2)
    if (documentType === 'registration_cert' || documentType === 'registrationCert') {
        Object.entries(extractedData).forEach(([key, value]) => {
            const fieldId = fieldMappings[key];
            if (fieldId) {
                const field = document.getElementById(fieldId);
                if (field && !field.value && value) {
                    field.value = value;
                    field.classList.add('ocr-auto-filled');
                    
                    // For select fields (like make), try to match option
                    if (field.tagName === 'SELECT') {
                        const option = Array.from(field.options).find(opt => 
                            opt.value.toLowerCase() === value.toLowerCase() ||
                            opt.text.toLowerCase().includes(value.toLowerCase())
                        );
                        if (option) {
                            field.value = option.value;
                        }
                    }
                }
            }
        });
    }
    
    // Auto-fill owner fields (Step 3)
    if (documentType === 'owner_id' || documentType === 'ownerId') {
        Object.entries(extractedData).forEach(([key, value]) => {
            const fieldId = fieldMappings[key];
            if (fieldId) {
                const field = document.getElementById(fieldId);
                if (field && !field.value && value) {
                    field.value = value;
                    field.classList.add('ocr-auto-filled');
                }
            }
        });
    }
    
    // Show notification
    if (Object.keys(extractedData).length > 0) {
        showNotification('Information extracted from document and auto-filled. Please verify all fields.', 'success');
    }
}

/**
 * Auto-fill owner information from logged-in user profile
 * This is a fallback when OCR is not available
 */
async function autoFillOwnerInfo() {
    try {
        // Check if user is logged in
        const apiClient = window.apiClient || (window.APIClient && new window.APIClient());
        if (!apiClient) {
            console.log('API client not available, skipping auto-fill');
            return;
        }

        // Check if we have a token
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (!token) {
            console.log('No authentication token found, skipping auto-fill');
            return;
        }

        // Fetch user profile
        const profileResponse = await apiClient.get('/api/auth/profile');
        if (!profileResponse || !profileResponse.success || !profileResponse.user) {
            console.log('Could not fetch user profile for auto-fill');
            return;
        }

        const user = profileResponse.user;
        console.log('Auto-filling owner information from profile:', user);

        // Auto-fill owner fields (only if they're empty)
        const firstNameField = document.getElementById('firstName');
        const lastNameField = document.getElementById('lastName');
        const emailField = document.getElementById('email');
        const phoneField = document.getElementById('phone');
        const addressField = document.getElementById('address');

        if (firstNameField && !firstNameField.value && user.firstName) {
            firstNameField.value = user.firstName;
            firstNameField.classList.add('auto-filled');
        }
        if (lastNameField && !lastNameField.value && user.lastName) {
            lastNameField.value = user.lastName;
            lastNameField.classList.add('auto-filled');
        }
        if (emailField && !emailField.value && user.email) {
            emailField.value = user.email;
            emailField.classList.add('auto-filled');
        }
        if (phoneField && !phoneField.value && user.phone) {
            phoneField.value = user.phone;
            phoneField.classList.add('auto-filled');
        }
        if (addressField && !addressField.value && user.address) {
            addressField.value = user.address;
            addressField.classList.add('auto-filled');
        }

        // Show notification if any fields were auto-filled
        if ((firstNameField && firstNameField.classList.contains('auto-filled')) ||
            (lastNameField && lastNameField.classList.contains('auto-filled')) ||
            (emailField && emailField.classList.contains('auto-filled'))) {
            showNotification('Owner information has been auto-filled from your profile. Upload documents in Step 1 for more accurate auto-fill.', 'info');
        }

        // Optionally offer to copy from previous vehicle registration
        try {
            const vehiclesResponse = await apiClient.get('/api/vehicles/my-vehicles');
            if (vehiclesResponse && vehiclesResponse.success && vehiclesResponse.vehicles && vehiclesResponse.vehicles.length > 0) {
                const latestVehicle = vehiclesResponse.vehicles[0]; // Most recent vehicle
                console.log('Found previous vehicle registration, can offer to copy details');
                // Could add a "Copy from previous registration" button here
            }
        } catch (vehiclesError) {
            console.log('Could not fetch previous vehicles for auto-fill:', vehiclesError);
        }

    } catch (error) {
        console.log('Auto-fill error (non-critical):', error);
        // Don't show error to user - auto-fill is a convenience feature
    }
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
    collectApplicationData,
    autoFillOwnerInfo,
    loadDocumentRequirements,
    renderDocumentUploadFields
};
