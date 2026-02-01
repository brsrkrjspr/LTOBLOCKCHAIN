// Registration Wizard JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Ensure we start on Step 1 (reset any saved step state)
    currentStep = 1;

    initializeRegistrationWizard();
    initializeKeyboardShortcuts();
    restoreFormData();

    // Final safeguard: ensure Step 1 is visible after all initialization
    setTimeout(() => {
        const step1Element = document.getElementById('step-1');
        const step2Element = document.getElementById('step-2');
        const step3Element = document.getElementById('step-3');
        const step4Element = document.getElementById('step-4');

        if (step1Element) {
            step1Element.classList.add('active');
        }
        if (step2Element) {
            step2Element.classList.remove('active');
        }
        if (step3Element) {
            step3Element.classList.remove('active');
        }
        if (step4Element) {
            step4Element.classList.remove('active');
        }

        // Final check: ensure document section is shown if carType is already selected
        const carTypeSelect = document.getElementById('carType');
        if (carTypeSelect && carTypeSelect.value) {
            const documentSection = document.getElementById('document-upload-section');
            if (documentSection && documentSection.style.display === 'none') {
                console.log('[Registration Wizard] Final safeguard: Showing documents for car type:', carTypeSelect.value);
                handleCarTypeChange(carTypeSelect.value);
            }
        }
    }, 150);
});

// Track if form is submitting to prevent double submissions
let isSubmitting = false;
let currentAbortController = null;

// Store vehicle type value when selected
let storedVehicleType = null;

// Store OCR extracted data for later auto-fill (when Step 3 becomes visible)
let storedOCRExtractedData = {};
let ocrDataSource = {}; // Track which document type provided each field (for conflict messages)

/**
 * Store a non-empty OCR value and track its document source.
 * This powers conflict detection at submit time.
 */
function storeOcrValue(key, value, documentType) {
    if (!key) return;
    if (value === undefined || value === null) return;
    const v = value.toString().trim();
    if (!v) return;
    storedOCRExtractedData[key] = v;
    ocrDataSource[key] = documentType || ocrDataSource[key] || null;
}

function initializeRegistrationWizard() {
    // Initialize wizard functionality
    initializeFormValidation();
    initializeFileUploads();
    initializeProgressTracking();
    initializeIDNumberValidation();
    initializeIDTypeOverrideHandling();
    initializeVINAutoFill();
    initializeOcrUserEditTracking();

    // Ensure only step 1 is visible initially
    // Other steps should be hidden until their previous step is completed
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

    // Setup car type selection handler
    const carTypeSelect = document.getElementById('carType');
    if (carTypeSelect) {
        carTypeSelect.addEventListener('change', function () {
            handleCarTypeChange(this.value);
        });

        // Check if car type is already selected (from saved form data)
        // Use setTimeout to ensure this runs after restoreFormData has completed
        setTimeout(() => {
            if (carTypeSelect.value) {
                console.log('[Registration Wizard] Initial car type found:', carTypeSelect.value);
                handleCarTypeChange(carTypeSelect.value);
            }
        }, 100);
    }

    // Store vehicle type when it changes (for Step 2)
    const vehicleTypeField = document.getElementById('vehicleType');
    if (vehicleTypeField) {
        vehicleTypeField.addEventListener('change', function () {
            storedVehicleType = this.value;
            console.log('Vehicle type entered and stored:', storedVehicleType);
        });
    }

    // Initialize auto-save (uses the first wizard form on the page)
    const form = document.querySelector('.wizard-form');
    if (form) {
        FormPersistence.autoSave('registration-wizard', form);
    }

    // Auto-fill owner info on initialization (will be called again when step 3 is shown)
    // Note: This may run before step 3 is visible, so we also call it when navigating to step 3
    setTimeout(() => {
        console.log('[AutoFill Debug] Initial auto-fill attempt (step 3 may not be visible yet)');
        autoFillOwnerInfo();
    }, 500);

    // Don't load documents immediately - wait for car type selection
    // loadDocumentRequirements('NEW');

    // Setup OCR auto-fill when documents are uploaded
    setupOCRAutoFill();

    // Initialize Registration Type Handling
    initializeRegistrationTypeHandler();

    // Initialize Pre-minted Search
    initializePremintedSearch();
}

function initializeRegistrationTypeHandler() {
    const regTypeRadios = document.querySelectorAll('input[name="registrationType"]');
    // Only set up handlers if registration type elements exist
    if (regTypeRadios.length === 0) {
        console.log('[Registration Type] No registration type radio buttons found - skipping initialization');
        return;
    }
    regTypeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            handleRegistrationTypeChange(this.value);
        });
    });

    // Initial check
    const checkedRadio = document.querySelector('input[name="registrationType"]:checked');
    if (checkedRadio) {
        handleRegistrationTypeChange(checkedRadio.value);
    }
}

function handleRegistrationTypeChange(type) {
    const premintedSection = document.getElementById('preminted-vin-section');
    const docUploadSection = document.getElementById('document-upload-section');
    const labelNew = document.getElementById('labelRegTypeNew');
    const labelPreminted = document.getElementById('labelRegTypePreminted');

    if (type === 'PREMINTED') {
        if (premintedSection) premintedSection.style.display = 'block';
        if (docUploadSection) docUploadSection.style.display = 'none'; // Hide docs initially until vehicle found? Or keep hidden?

        // Update button styles
        if (labelNew) labelNew.classList.remove('active');
        if (labelPreminted) labelPreminted.classList.add('active');

        // Clear vehicle info fields to avoid confusion
        // clearVehicleFields();
    } else {
        if (premintedSection) premintedSection.style.display = 'none';
        if (docUploadSection) docUploadSection.style.display = 'block';

        // Update button styles
        if (labelNew) labelNew.classList.add('active');
        if (labelPreminted) labelPreminted.classList.remove('active');
    }
}

function initializePremintedSearch() {
    const btnSearch = document.getElementById('btnSearchPreminted');
    const inputSearch = document.getElementById('premintedVinSearch');

    if (btnSearch) {
        btnSearch.addEventListener('click', searchPremintedVehicle);
    }

    if (inputSearch) {
        inputSearch.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission
                searchPremintedVehicle();
            }
        });
    }
}

async function searchPremintedVehicle() {
    const vinInput = document.getElementById('premintedVinSearch');
    const resultDiv = document.getElementById('preminted-vehicle-result');
    const summaryDiv = document.getElementById('preminted-vehicle-summary');

    if (!vinInput || !vinInput.value.trim()) {
        alert('Please enter a VIN to search.');
        return;
    }

    const vin = vinInput.value.trim();

    // Show loading
    if (summaryDiv) summaryDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
    if (resultDiv) resultDiv.style.display = 'block';

    try {
        const apiClient = window.apiClient || new APIClient();
        console.log(`Searching for pre-minted VIN: ${vin}`);

        // Call API
        // Note: The backend endpoint might be a list with filters or a specific lookup
        // Assuming GET /api/vehicles/pre-minted returns a list, we might need to filter client-side 
        // OR better: GET /api/vehicles/pre-minted?vin=... if supported.
        // For now, let's try to fetch all and find, or mock if not available.

        // STRATEGY: Fetch all pre-minted and find match locally for now (as per implemented backend list endpoint)
        let vehicle = null;

        try {
            const response = await apiClient.get('/api/vehicles/pre-minted');
            if (response && response.success && response.vehicles) {
                vehicle = response.vehicles.find(v => v.vin === vin);
            }
        } catch (e) {
            console.error('API fetch failed for pre-minted vehicle search:', e);
        }

        // No mock fallbacks - only use real API data

        if (vehicle) {
            // Found!
            if (summaryDiv) {
                summaryDiv.innerHTML = `
                    <strong>${vehicle.year} ${vehicle.make} ${vehicle.model}</strong><br>
                    <span>VIN: ${vehicle.vin}</span><br>
                    <span style="color: #64748b; font-size: 0.85rem;">Dealer: ${vehicle.dealer || 'N/A'}</span>
                `;
            }

            // Auto-fill form
            autoFillPremintedVehicle(vehicle);

            // Show success toast
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Vehicle found! Details auto-filled.', 'success');
            }
        } else {
            if (summaryDiv) summaryDiv.innerHTML = '<span style="color: #e74c3c;"><i class="fas fa-times-circle"></i> Vehicle not found. Please check the VIN.</span>';
            // Clear auto-filled fields if not found?
        }

    } catch (error) {
        console.error('Search error:', error);
        if (summaryDiv) summaryDiv.innerHTML = '<span style="color: #e74c3c;">Error searching for vehicle.</span>';
    }
}

function autoFillPremintedVehicle(vehicle) {
    // Map fields
    const fields = {
        'make': vehicle.make,
        'model': vehicle.model,
        'year': vehicle.year,
        'color': vehicle.color,
        'engineNumber': vehicle.engineNumber || vehicle.engine_number,
        'chassisNumber': vehicle.chassisNumber || vehicle.chassis_number || vehicle.vin,
        'vin': vehicle.vin,
        'vehicleType': vehicle.vehicleType || vehicle.vehicle_type,
        'fuelType': vehicle.fuelType || vehicle.fuel_type
    };

    Object.keys(fields).forEach(id => {
        const el = document.getElementById(id);
        if (el && fields[id]) {
            el.value = fields[id];
            // Highlight as auto-filled
            el.style.backgroundColor = '#f0f9ff';
            el.style.borderColor = '#bae6fd';
            // Make read-only?
            // el.setAttribute('readonly', 'true');
        }
    });

    // Also set Car Type in Step 1 if possible
    const carTypeSelect = document.getElementById('carType');
    if (carTypeSelect && fields['vehicleType']) {
        // Try to match value
        // This is tricky as values might differ.
    }
}

/**
 * Normalize a string for loose comparison (ignore case/spacing/punctuation).
 */
function normalizeForComparison(value) {
    if (value === undefined || value === null) return '';
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Detect conflicts between final form values and OCR-extracted data.
 * Properly handles CSR, HPG, and Owner ID certificate fields with correct field mappings.
 * Compares the summarized review data (what will be submitted) with OCR data.
 * Only compares fields where OCR has a non-empty value.
 */
function detectOcrConflicts() {
    const conflicts = [];

    // Map: OCR key(s) -> HTML input id
    // CSR/HPG extract: series->model, yearModel->year, bodyType->vehicleType, grossWeight->grossVehicleWeight, netCapacity->netWeight
    const fieldMap = [
        // Vehicle Identifiers (from CSR, HPG)
        { ocrKeys: ['vin'], htmlId: 'vin', label: 'VIN', priority: 'high', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] },
        { ocrKeys: ['chassisNumber', 'vin'], htmlId: 'chassisNumber', label: 'Chassis / VIN', priority: 'high', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] },
        { ocrKeys: ['plateNumber'], htmlId: 'plateNumber', label: 'Plate Number', priority: 'high', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] },
        { ocrKeys: ['engineNumber'], htmlId: 'engineNumber', label: 'Engine Number', priority: 'high', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] },

        // Vehicle Descriptors (from CSR, HPG)
        { ocrKeys: ['make'], htmlId: 'make', label: 'Make', priority: 'high', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] },
        { ocrKeys: ['model', 'series'], htmlId: 'model', label: 'Model / Series', priority: 'high', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] }, // CSR extracts 'series' which maps to 'model'
        { ocrKeys: ['year', 'yearModel'], htmlId: 'year', label: 'Year', priority: 'high', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] }, // CSR extracts 'yearModel' which maps to 'year'
        { ocrKeys: ['vehicleType', 'bodyType'], htmlId: 'vehicleType', label: 'Vehicle Type', priority: 'medium', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] }, // CSR extracts 'bodyType' which maps to 'vehicleType'
        { ocrKeys: ['color'], htmlId: 'color', label: 'Color', priority: 'medium', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] },
        { ocrKeys: ['fuelType'], htmlId: 'fuelType', label: 'Fuel Type', isSelect: true, priority: 'medium', documentTypes: ['csr', 'hpg_clearance', 'certificateOfStockReport', 'hpgClearance', 'pnpHpgClearance'] },

        // Vehicle Weights (from CSR, HPG)
        { ocrKeys: ['grossVehicleWeight', 'grossWeight'], htmlId: 'grossVehicleWeight', label: 'Gross Vehicle Weight', priority: 'medium', documentTypes: ['csr', 'certificateOfStockReport'] }, // CSR extracts 'grossWeight'
        { ocrKeys: ['netWeight', 'netCapacity'], htmlId: 'netWeight', label: 'Net Weight', priority: 'medium', documentTypes: ['csr', 'certificateOfStockReport'] }, // CSR extracts 'netCapacity'

        // Owner ID Fields (from Owner ID document)
        { ocrKeys: ['idType'], htmlId: 'idType', label: 'ID Type', isSelect: true, priority: 'high', documentTypes: ['ownerValidId', 'owner_id', 'ownerId'] },
        { ocrKeys: ['idNumber'], htmlId: 'idNumber', label: 'ID Number', priority: 'high', documentTypes: ['ownerValidId', 'owner_id', 'ownerId'] }
    ];

    console.log('[OCR Conflict Detection] Starting conflict detection...');
    console.log('[OCR Conflict Detection] Available OCR data keys:', Object.keys(storedOCRExtractedData));
    console.log('[OCR Conflict Detection] OCR data sources:', ocrDataSource);

    fieldMap.forEach(({ ocrKeys, htmlId, label, isSelect, priority, documentTypes }) => {
        // Find the first OCR key that has a value
        let ocrValue = null;
        let ocrKeyUsed = null;
        for (const ocrKey of ocrKeys) {
            if (storedOCRExtractedData[ocrKey]) {
                ocrValue = storedOCRExtractedData[ocrKey];
                ocrKeyUsed = ocrKey;
                break;
            }
        }

        if (!ocrValue) {
            console.log(`[OCR Conflict Detection] Skipping ${label} - no OCR value found in keys: ${ocrKeys.join(', ')}`);
            return; // nothing to compare
        }

        const el = document.getElementById(htmlId);
        if (!el) {
            console.log(`[OCR Conflict Detection] Skipping ${label} - HTML element not found: ${htmlId}`);
            return;
        }

        let formValue = el.value || '';

        // Special handling: If VIN and chassisNumber are the same value (from CSR), 
        // and both fields exist, check if they match each other first
        if (htmlId === 'chassisNumber' && storedOCRExtractedData.vin && storedOCRExtractedData.chassisNumber) {
            const vinNorm = normalizeForComparison(storedOCRExtractedData.vin);
            const chassisNorm = normalizeForComparison(storedOCRExtractedData.chassisNumber);
            // If VIN and chassisNumber from OCR are the same, use VIN value for comparison
            if (vinNorm === chassisNorm) {
                ocrValue = storedOCRExtractedData.vin;
                ocrKeyUsed = 'vin';
            }
        }

        // For selects, compare by normalized token but show the user-facing text
        if (isSelect && el.tagName === 'SELECT') {
            const selectedIndex = el.selectedIndex;
            const opt = selectedIndex >= 0 ? el.options[selectedIndex] : null;
            if (opt && opt.text) {
                formValue = opt.text;
            }
        }

        const normForm = normalizeForComparison(formValue);
        const normOcr = normalizeForComparison(ocrValue);

        // Get document source for this field
        const documentSource = ocrDataSource[ocrKeyUsed] || null;

        // Only check conflicts if the field came from one of the expected document types
        // This ensures we only compare against CSR, HPG, and Owner ID documents
        if (documentTypes && documentSource) {
            const sourceMatches = documentTypes.some(docType => {
                const normalizedDocType = documentSource.toLowerCase().replace(/[_-]/g, '');
                const normalizedExpected = docType.toLowerCase().replace(/[_-]/g, '');
                return normalizedDocType.includes(normalizedExpected) || normalizedExpected.includes(normalizedDocType);
            });

            if (!sourceMatches) {
                console.log(`[OCR Conflict Detection] Skipping ${label} - source "${documentSource}" not in expected types: ${documentTypes.join(', ')}`);
                return; // Skip fields from other document types
            }
        }

        const documentTypeName = getDocumentTypeName(documentSource);

        console.log(`[OCR Conflict Detection] ${label}:`, {
            ocrKey: ocrKeyUsed,
            ocrValue: ocrValue,
            formValue: formValue,
            normOcr: normOcr,
            normForm: normForm,
            match: normForm === normOcr,
            source: documentSource,
            documentTypeName: documentTypeName
        });

        // If normalized values differ, treat as conflict
        // Skip if this is a duplicate (VIN and chassisNumber with same values)
        if (normForm && normOcr && normForm !== normOcr) {
            // Check for duplicate conflicts (VIN and chassisNumber with same OCR values)
            const isDuplicate = htmlId === 'chassisNumber' && conflicts.some(c =>
                c.field === 'VIN' &&
                normalizeForComparison(c.ocrValue) === normOcr &&
                normalizeForComparison(c.formValue) === normForm
            );

            if (!isDuplicate) {
                conflicts.push({
                    field: label,
                    formValue: formValue || '(blank)',
                    ocrValue: ocrValue || '(blank)',
                    documentSource: documentTypeName,
                    priority: priority,
                    documentType: documentSource // Store original document type for grouping
                });
                console.log(`[OCR Conflict Detection] ⚠️ CONFLICT DETECTED: ${label} - Form: "${formValue}", ${documentTypeName}: "${ocrValue}"`);
            } else {
                console.log(`[OCR Conflict Detection] Skipping duplicate conflict for ${label} (same as VIN)`);
            }
        }
    });

    // Sort conflicts by priority (high priority first)
    conflicts.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    console.log(`[OCR Conflict Detection] Total conflicts found: ${conflicts.length}`);
    return conflicts;
}

/**
 * Get user-friendly document type name
 */
function getDocumentTypeName(documentType) {
    if (!documentType) return 'uploaded document';

    const normalizedType = documentType.toLowerCase().replace(/[_-]/g, '');
    const typeMap = {
        'csr': 'CSR Certificate',
        'certificateofstockreport': 'CSR Certificate',
        'hpgclearance': 'HPG Certificate',
        'pnphpgclearance': 'HPG Certificate',
        'hpg': 'HPG Certificate',
        'ownerid': 'Owner ID',
        'ownervalidid': 'Owner ID',
        'owner_id': 'Owner ID',
        'registrationcert': 'Registration Certificate',
        'orcr': 'Registration Certificate',
        'salesinvoice': 'Sales Invoice'
    };

    // Check exact match first
    if (typeMap[normalizedType]) {
        return typeMap[normalizedType];
    }

    // Check partial matches
    if (normalizedType.includes('csr') || normalizedType.includes('stock')) {
        return 'CSR Certificate';
    }
    if (normalizedType.includes('hpg') || normalizedType.includes('clearance')) {
        return 'HPG Certificate';
    }
    if (normalizedType.includes('owner') || normalizedType.includes('id')) {
        return 'Owner ID';
    }

    return 'uploaded document';
}

/**
 * Before final submit, warn user if there are conflicts between OCR data and entered values.
 * Returns true if user explicitly confirms, false if they cancel.
 */
async function checkOcrConflictsBeforeSubmit() {
    try {
        // Only ask once per page load
        if (window._ocrConflictConfirmed === true) {
            // Preserve previous decision about whether conflicts existed
            return true;
        }

        // Debug: Log what OCR data we have
        console.log('[OCR Conflict Check] Checking for conflicts...');
        console.log('[OCR Conflict Check] Stored OCR data:', storedOCRExtractedData);
        console.log('[OCR Conflict Check] Stored OCR keys:', Object.keys(storedOCRExtractedData));

        const conflicts = detectOcrConflicts();
        console.log('[OCR Conflict Check] Detected conflicts:', conflicts);

        if (!conflicts || conflicts.length === 0) {
            console.log('[OCR Conflict Check] No conflicts detected - proceeding with submission');
            // Mark that we had a clean match between documents and form
            window._ocrHadConflicts = false;
            return true;
        }

        // Group conflicts by document type for clearer presentation
        const conflictsByDocument = {};
        conflicts.forEach(c => {
            const docType = c.documentSource || 'Other Documents';
            if (!conflictsByDocument[docType]) {
                conflictsByDocument[docType] = [];
            }
            conflictsByDocument[docType].push(c);
        });

        // Build conflict message grouped by document type (HTML format)
        let conflictLinesHTML = '';
        const documentOrder = ['CSR Certificate', 'HPG Certificate', 'Owner ID', 'Other Documents'];

        documentOrder.forEach(docType => {
            if (conflictsByDocument[docType] && conflictsByDocument[docType].length > 0) {
                conflictLinesHTML += `<div style="margin-bottom: 1rem;"><strong style="color: #2c3e50;">📄 ${docType}:</strong><ul style="margin-top: 0.5rem; margin-left: 1.5rem;">`;
                conflictsByDocument[docType].forEach(c => {
                    conflictLinesHTML += `<li style="margin-bottom: 0.5rem;"><strong>${c.field}:</strong> Your entry = "<span style="color: #e74c3c;">${c.formValue}</span>", Document = "<span style="color: #27ae60;">${c.ocrValue}</span>"</li>`;
                });
                conflictLinesHTML += '</ul></div>';
            }
        });

        // If there are conflicts from other document types
        Object.keys(conflictsByDocument).forEach(docType => {
            if (!documentOrder.includes(docType) && conflictsByDocument[docType].length > 0) {
                conflictLinesHTML += `<div style="margin-bottom: 1rem;"><strong style="color: #2c3e50;">📄 ${docType}:</strong><ul style="margin-top: 0.5rem; margin-left: 1.5rem;">`;
                conflictsByDocument[docType].forEach(c => {
                    conflictLinesHTML += `<li style="margin-bottom: 0.5rem;"><strong>${c.field}:</strong> Your entry = "<span style="color: #e74c3c;">${c.formValue}</span>", Document = "<span style="color: #27ae60;">${c.ocrValue}</span>"</li>`;
                });
                conflictLinesHTML += '</ul></div>';
            }
        });

        // Format message with HTML for better readability
        const message = `
            <div style="text-align: left; line-height: 1.6; max-height: 60vh; overflow-y: auto;">
                <p style="font-weight: bold; color: #e67e22; margin-bottom: 1rem; font-size: 1.1rem;">⚠️ DATA MISMATCH DETECTED</p>
                <p style="margin-bottom: 1rem;">We found differences between the information you entered and the data extracted from your uploaded documents:</p>
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border-left: 4px solid #e67e22;">
                    ${conflictLinesHTML}
                </div>
                <p style="font-weight: bold; color: #e67e22; margin-top: 1rem; margin-bottom: 0.5rem;">⚠️ IMPORTANT:</p>
                <ul style="margin-left: 1.5rem; margin-bottom: 1rem;">
                    <li style="margin-bottom: 0.5rem;">The form values you entered will be used for registration if you proceed.</li>
                    <li style="margin-bottom: 0.5rem;">Please verify that your entered values are correct, especially for:
                        <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
                            <li><strong>VIN / Chassis Number</strong></li>
                            <li><strong>Plate Number</strong></li>
                            <li><strong>Make and Model</strong></li>
                            <li><strong>ID Type and ID Number</strong></li>
                        </ul>
                    </li>
                </ul>
                <p style="color: #555; font-size: 0.9rem; margin-top: 1rem;">If the document values are correct, please review and update your form fields before submitting.</p>
            </div>
        `;

        const confirmed = await ConfirmationDialog.show({
            title: '⚠️ Data Mismatch Warning',
            message: message,
            confirmText: 'Yes, use my entered values',
            cancelText: 'Go back and review',
            confirmColor: '#e67e22',
            type: 'warning',
            html: true // Enable HTML formatting for better display
        });

        if (!confirmed) {
            return false;
        }

        // User acknowledged conflicts and chose to proceed
        window._ocrConflictConfirmed = true;
        window._ocrHadConflicts = true;
        window._ocrConflictSummary = conflicts;
        return true;
    } catch (e) {
        console.warn('[OCR Conflict Check] Error while checking conflicts:', e);
        // Fail-open: do not block submission if checker fails
        return true;
    }
}


const totalSteps = 5;

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

            // Update review data if on final step (Step 4)
            // Update review section when landing on Payment (step 4) or Review (step 5)
            if (currentStep === 4 || currentStep === totalSteps) {
                setTimeout(() => {
                    try {
                        updateUploadedDocumentsList();
                    } catch (err) {
                        console.error('[Review] Error updating documents list:', err);
                    }
                    try {
                        updateReviewData();
                    } catch (err) {
                        console.error('[Review] Error updating review data:', err, err.stack);
                    }
                }, 100);
            }

            // Auto-fill owner info when navigating to step 3 (Owner Information)
            if (currentStep === 3) {
                // Use setTimeout to ensure DOM is fully rendered before auto-filling
                setTimeout(() => {
                    console.log('[AutoFill Debug] Navigating to step 3, triggering auto-fill');
                    autoFillOwnerInfo();

                    // Also re-apply OCR extracted data if available (fields might not have existed when OCR ran)
                    // ONLY re-apply ID info (idType, idNumber) for Step 3 - personal info comes from account
                    const ownerIdDataFromStorage = {
                        idType: storedOCRExtractedData.idType,
                        idNumber: storedOCRExtractedData.idNumber
                        // Note: firstName, lastName, address, phone excluded - these come from account profile
                    };

                    const hasOwnerIdData = Object.values(ownerIdDataFromStorage).some(val => val !== undefined && val !== null && val !== '');

                    if (hasOwnerIdData) {
                        console.log('[ID AutoFill Debug] Re-applying stored owner ID data (ID info only) when Step 3 becomes visible:', {
                            ownerIdDataFromStorage,
                            hasIdType: !!storedOCRExtractedData.idType,
                            hasIdNumber: !!storedOCRExtractedData.idNumber,
                            idType: storedOCRExtractedData.idType,
                            idNumber: storedOCRExtractedData.idNumber,
                            note: 'Personal info (name, address, phone) loaded from account, not document'
                        });
                        // Use ownerValidId document type to trigger personal info filtering
                        autoFillFromOCRData(ownerIdDataFromStorage, 'ownerValidId');
                    } else {
                        console.log('[ID AutoFill Debug] No stored owner ID data to re-apply (only vehicle data available)');
                    }
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

        // Auto-fill owner info when navigating back to step 3 (Owner Information)
        if (currentStep === 3) {
            // Use setTimeout to ensure DOM is fully rendered before auto-filling
            setTimeout(() => {
                console.log('[AutoFill Debug] Navigating back to step 3, triggering auto-fill');
                autoFillOwnerInfo();

                // Also re-apply OCR extracted data if available
                // ONLY re-apply ID info (idType, idNumber) for Step 3 - personal info comes from account
                const ownerIdDataFromStorage = {
                    idType: storedOCRExtractedData.idType,
                    idNumber: storedOCRExtractedData.idNumber
                    // Note: firstName, lastName, address, phone excluded - these come from account profile
                };

                const hasOwnerIdData = Object.values(ownerIdDataFromStorage).some(val => val !== undefined && val !== null && val !== '');

                if (hasOwnerIdData) {
                    console.log('[ID AutoFill Debug] Re-applying stored owner ID data (ID info only) when navigating back to Step 3:', ownerIdDataFromStorage);
                    autoFillFromOCRData(ownerIdDataFromStorage, 'ownerValidId');
                }
            }, 100);
        }

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
        // Step 1: car type selection and documents
        const carType = document.getElementById('carType')?.value || '';
        if (!carType || !carType.trim()) {
            const carTypeField = document.getElementById('carType');
            if (carTypeField) {
                carTypeField.classList.add('invalid');
                showFieldError(carTypeField, 'Please select a vehicle type');
            }
            isValid = false;
            errorMessages.push('Vehicle type is required');
        } else {
            const carTypeField = document.getElementById('carType');
            if (carTypeField) {
                carTypeField.classList.remove('invalid');
            }
        }

        // Validate documents only if car type is selected AND not Pre-minted
        const regType = document.querySelector('input[name="registrationType"]:checked')?.value;

        if (regType === 'PREMINTED') {
            const resultSummary = document.getElementById('preminted-vehicle-summary');
            if (!resultSummary || !resultSummary.innerHTML.trim() || resultSummary.innerHTML.includes('not found')) {
                isValid = false;
                showTopError('Please search and select a pre-minted vehicle first.');
                // Highlight search box?
                const vinSearch = document.getElementById('premintedVinSearch');
                if (vinSearch) vinSearch.style.borderColor = '#e74c3c';
            }
        } else {
            if (carType && carType.trim()) {
                const docErrors = validateDocumentUploads();
                if (!docErrors.isValid) {
                    isValid = false;
                    errorMessages = errorMessages.concat(docErrors.errors);
                }
            }
        }
    } else if (currentStep === 2) {
        // Step 2: vehicle info
        const vehicleErrors = validateVehicleInfo();
        if (!vehicleErrors.isValid) {
            isValid = false;
            errorMessages = errorMessages.concat(vehicleErrors.errors);
        }
    } else if (currentStep === 3) {
        // Step 3: owner info
        const ownerErrors = validateOwnerInfo();
        if (!ownerErrors.isValid) {
            isValid = false;
            errorMessages = errorMessages.concat(ownerErrors.errors);
        }
    } else if (currentStep === 4) {
        // Step 4: Payment
        const paymentInput = document.getElementById('document-payment');
        if (!paymentInput || !paymentInput.files || paymentInput.files.length === 0) {
            isValid = false;
            errorMessages.push('Please upload proof of payment');
            // Show error on input?
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
            showFieldError(vehicleTypeField, 'Please enter a vehicle type');
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
            showFieldError(classificationField, 'Please enter a classification');
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
    // Get car type to determine which documents are required
    const carType = document.getElementById('carType')?.value || '';
    const container = document.getElementById('document-upload-container');

    if (!container) {
        return { isValid: false, errors: ['Document upload container not found'] };
    }

    // Find all required file inputs in the container
    const requiredFileInputs = container.querySelectorAll('input[type="file"][required]');
    let isValid = true;
    let errors = [];

    requiredFileInputs.forEach(fileInput => {
        if (!fileInput.files || fileInput.files.length === 0) {
            fileInput.classList.add('invalid');
            const label = fileInput.closest('.upload-item')?.querySelector('h4')?.textContent ||
                fileInput.getAttribute('data-document-type') ||
                fileInput.id;
            showFieldError(fileInput, 'Please upload this required document');
            errors.push(`${label} is required`);
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
        input.addEventListener('blur', function () {
            validateField(this);
        });

        input.addEventListener('input', function () {
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

/**
 * Show error message at top of page (used by validation).
 */
function showTopError(message) {
    const existingError = document.querySelector('.top-error-message');
    if (existingError) existingError.remove();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'top-error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-text">
                <h4>Please fix the following errors:</h4>
                <p>${typeof message === 'string' ? message : (message || '')}</p>
            </div>
            <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    const main = document.querySelector('main');
    if (main) main.insertBefore(errorDiv, main.firstChild);
    else document.body.insertBefore(errorDiv, document.body.firstChild);
    setTimeout(() => { if (errorDiv.parentElement) errorDiv.remove(); }, 8000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Update the uploaded documents list in the Review step.
 */
function updateUploadedDocumentsList() {
    const container = document.getElementById('review-documents-list');
    if (!container) return;
    const documentInputs = document.querySelectorAll('input[type="file"][data-document-type]');
    let html = '';
    if (documentInputs.length === 0) {
        container.innerHTML = '<p>No documents to upload</p>';
        return;
    }
    documentInputs.forEach(input => {
        const docType = input.getAttribute('data-document-type') || input.id || 'Unknown';
        const hasFile = input.files && input.files.length > 0;
        const icon = hasFile ? '✅' : '❌';
        const docLabel = docType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
        html += `<p>${icon} ${docLabel}</p>`;
    });
    container.innerHTML = html;
}

/**
 * Keyboard shortcuts (Ctrl+S save, Escape back, Enter next/submit).
 */
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (typeof ToastNotification !== 'undefined') ToastNotification.show('Form data is automatically saved as you type', 'info');
        }
        if (e.key === 'Escape' && currentStep > 1) prevStep();
        if (e.key === 'Enter' && !e.shiftKey && !e.target.matches('textarea')) {
            const activeStep = document.querySelector('.wizard-step.active');
            if (activeStep) {
                const nextButton = activeStep.querySelector('.btn-primary');
                if (nextButton && !nextButton.disabled) {
                    e.preventDefault();
                    if (currentStep < totalSteps) nextStep();
                    else if (currentStep === totalSteps) submitApplication();
                }
            }
        }
    });
}

/**
 * Restore saved form data on page load and re-show document section if car type was set.
 */
function restoreFormData() {
    const form = document.querySelector('.wizard-form');
    if (form && typeof FormPersistence !== 'undefined' && FormPersistence.restore('registration-wizard', form)) {
        if (typeof ToastNotification !== 'undefined') ToastNotification.show('Previous form data restored', 'info', 3000);
    }
    setTimeout(() => {
        const carTypeSelect = document.getElementById('carType');
        if (carTypeSelect && carTypeSelect.value) {
            handleCarTypeChange(carTypeSelect.value);
        }
    }, 50);
}

/**
 * Validate ID number format based on ID type
 */
function validateIDNumber(idNumber, idType) {
    if (!idNumber || !idType) {
        return { valid: false, message: 'ID number and type required' };
    }
    const cleaned = idNumber.replace(/\s+/g, '').toUpperCase();
    const patterns = {
        'drivers-license': /^[A-Z]\d{2}-\d{2}-\d{6,}$/,
        'passport': /^[A-Z]{2}\d{7}$/,
        'national-id': /^\d{4}-\d{4}-\d{4}-\d{4}$/,
        'postal-id': /^[A-Z]{2,3}\d{6,9}$|^\d{8,10}$/,
        'voters-id': /^\d{4}-\d{4}-\d{4}$/,
        'sss-id': /^\d{2}-\d{7}-\d{1}$/,
        'philhealth-id': /^\d{2}-\d{7}-\d{2}$/,
        'tin': /^\d{3}-\d{3}-\d{3}-\d{3}$/
    };
    const pattern = patterns[idType];
    if (pattern && pattern.test(cleaned)) {
        return { valid: true, message: 'Valid format' };
    }
    return { valid: false, message: `Invalid ${idType.replace(/-/g, ' ')} format` };
}

/**
 * Initialize ID number validation on form fields
 */
function initializeIDNumberValidation() {
    const idNumberField = document.getElementById('idNumber');
    const idTypeField = document.getElementById('idType');
    if (idNumberField && idTypeField) {
        idNumberField.addEventListener('blur', function () {
            const idType = idTypeField.value;
            const idNumber = idNumberField.value;
            if (idType && idNumber) {
                const validation = validateIDNumber(idNumber, idType);
                if (!validation.valid) {
                    showFieldError(idNumberField, validation.message);
                } else {
                    hideFieldError(idNumberField);
                }
            } else if (idNumber && !idType) {
                showFieldError(idNumberField, 'Please select an ID type first');
            } else {
                hideFieldError(idNumberField);
            }
        });
        idTypeField.addEventListener('change', function () {
            const idType = idTypeField.value;
            const idNumber = idNumberField.value;
            if (idType && idNumber) {
                const validation = validateIDNumber(idNumber, idType);
                if (!validation.valid) {
                    showFieldError(idNumberField, validation.message);
                } else {
                    hideFieldError(idNumberField);
                }
            } else {
                hideFieldError(idNumberField);
            }
        });
        idNumberField.addEventListener('input', function () {
            const idType = idTypeField.value;
            const idNumber = idNumberField.value;
            if (idType && idNumber) {
                const validation = validateIDNumber(idNumber, idType);
                if (validation.valid) {
                    hideFieldError(idNumberField);
                }
            }
        });
    }
}

/**
 * Ensure manual overrides to ID type are respected
 */
function initializeIDTypeOverrideHandling() {
    const idTypeField = document.getElementById('idType');
    if (!idTypeField) return;
    idTypeField.addEventListener('change', function () {
        const badge = idTypeField.parentElement && idTypeField.parentElement.querySelector('.ocr-detection-indicator');
        if (badge) badge.remove();
        delete idTypeField.dataset.ocrConfidence;
        idTypeField.title = 'ID type selected manually';
    });
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
 * Handle car type selection change – show document upload section and load docs by type
 */
function handleCarTypeChange(carType) {
    const documentSection = document.getElementById('document-upload-section');
    const container = document.getElementById('document-upload-container');
    if (!carType || !carType.trim()) {
        if (documentSection) documentSection.style.display = 'none';
        if (container) container.innerHTML = '<div class="loading-message">Please select a vehicle type first</div>';
        return;
    }
    if (documentSection) documentSection.style.display = 'block';
    loadDocumentsByCarType(carType);
}

/**
 * Load documents based on selected car type
 */
function loadDocumentsByCarType(carType) {
    const container = document.getElementById('document-upload-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-message">Loading document requirements...</div>';
    let documents = [];
    if (carType === 'Motorcycle – Tricycle (TC)') {
        documents = [
            { id: 'certificateOfStockReport', name: 'Certificate of Stock Report (CSR)', description: 'Upload your Certificate of Stock Report', required: true },
            { id: 'insuranceCertificate', name: 'Insurance Certificate of Cover (Third Party Liability)', description: 'Upload your Insurance Certificate of Cover', required: true },
            { id: 'pnpHpgClearance', name: 'PNP-HPG Motor Vehicle (MV) Clearance Certificate', description: 'Upload your PNP-HPG MV Clearance Certificate', required: true },
            { id: 'salesInvoice', name: 'Sales Invoice', description: 'Upload your Sales Invoice', required: true },
            { id: 'ownerValidId', name: 'Owner Valid ID', description: 'Upload a copy of your valid ID', required: true },
            { id: 'affidavitOfAttachment', name: 'Original Affidavit of Attachment for Sidecar', description: 'Upload the Original Affidavit of Attachment for Sidecar', required: true }
        ];
    } else if (carType === 'Passenger Vehicle' || carType === 'Commercial Vehicle' || carType === 'Motorcycle') {
        documents = [
            { id: 'certificateOfStockReport', name: 'Certificate of Stock Report (CSR)', description: 'Upload your Certificate of Stock Report', required: true },
            { id: 'insuranceCertificate', name: 'Insurance Certificate of Cover (Third Party Liability)', description: 'Upload your Insurance Certificate of Cover', required: true },
            { id: 'pnpHpgClearance', name: 'PNP-HPG Motor Vehicle (MV) Clearance Certificate', description: 'Upload your PNP-HPG MV Clearance Certificate', required: true },
            { id: 'salesInvoice', name: 'Sales Invoice', description: 'Upload your Sales Invoice', required: true },
            { id: 'ownerValidId', name: 'Owner Valid ID', description: 'Upload a copy of your valid ID', required: true }
        ];
    } else {
        container.innerHTML = '<div class="error-message">Please select a valid vehicle type</div>';
        return;
    }
    renderCustomDocumentFields(documents, container);
    initializeFileUploads();
}

/**
 * Render custom document upload fields into container
 */
function renderCustomDocumentFields(documents, container) {
    container.innerHTML = '';
    documents.forEach(doc => {
        const uploadItem = document.createElement('div');
        uploadItem.className = 'upload-item';
        uploadItem.innerHTML = `
            <div class="upload-info">
                <h4>${escapeHtml(doc.name)} ${doc.required ? '<span class="required">*</span>' : ''}</h4>
                <p>${escapeHtml(doc.description || '')}</p>
                <small class="form-hint">Accepted: PDF, JPG, JPEG, PNG | Max: 10MB</small>
            </div>
            <div class="upload-area">
                <input type="file" id="${doc.id}" name="${doc.id}" accept=".pdf,.jpg,.jpeg,.png" data-document-type="${doc.id}" data-max-size="${10 * 1024 * 1024}" ${doc.required ? 'required' : ''}>
                <label for="${doc.id}" class="upload-label">
                    <span class="upload-icon">📄</span>
                    <span>Choose File</span>
                </label>
            </div>
        `;
        container.appendChild(uploadItem);
    });
}

/**
 * Initialize VIN auto-fill from chassis number
 */
function initializeVINAutoFill() {
    const chassisNumberField = document.getElementById('chassisNumber');
    const vinField = document.getElementById('vin');
    if (!chassisNumberField || !vinField) {
        console.warn('[VIN AutoFill] Chassis or VIN field not found');
        return;
    }
    const syncVinFromChassis = () => {
        const chassisValue = (chassisNumberField.value || '').trim();
        if (chassisValue) {
            vinField.value = chassisValue;
            vinField.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    chassisNumberField.addEventListener('input', syncVinFromChassis);
    chassisNumberField.addEventListener('change', syncVinFromChassis);
    syncVinFromChassis();
    console.log('[VIN AutoFill] VIN auto-fill initialized');
}

/**
 * Track when a user manually edits a field so OCR auto-fill won't overwrite it later.
 */
function initializeOcrUserEditTracking() {
    const selector = 'input, select, textarea';
    document.querySelectorAll(selector).forEach((el) => {
        if (el.dataset.ocrUserEditTrackingBound === 'true') return;
        el.dataset.ocrUserEditTrackingBound = 'true';
        const markUserEdited = () => {
            if (el.dataset.ocrFilling === 'true') return;
            el.dataset.userEdited = 'true';
        };
        el.addEventListener('input', markUserEdited);
        el.addEventListener('change', markUserEdited);
    });
}

/**
 * Get auth token for API calls (used by OCR extraction).
 */
function getAuthToken() {
    const token = (typeof window !== 'undefined' && window.authManager)
        ? window.authManager.getAccessToken()
        : (localStorage.getItem('authToken') || sessionStorage.getItem('authToken'));
    if (!token) {
        window.location.href = 'login-signup.html?redirect=' + encodeURIComponent(window.location.pathname);
        return null;
    }
    if (typeof AuthUtils !== 'undefined' && !AuthUtils.isAuthenticated()) {
        return null;
    }
    return token;
}

/**
 * Detect Philippine ID type from ID number using known patterns.
 */
function detectIDTypeFromNumber(idNumber) {
    if (!idNumber) return null;
    const cleaned = idNumber.replace(/\s+/g, '').toUpperCase();
    const candidates = [
        { idType: 'drivers-license', pattern: /^[A-Z]\d{2}-\d{2}-\d{6,}$/ },
        { idType: 'passport', pattern: /^[A-Z]{2}\d{7}$/ },
        { idType: 'national-id', pattern: /^\d{4}-\d{4}-\d{4}-\d{4}$/ },
        { idType: 'postal-id', pattern: /^[A-Z]{2,3}\d{6,9}$|^\d{8,10}$/ },
        { idType: 'voters-id', pattern: /^\d{4}-\d{4}-\d{4}$/ },
        { idType: 'sss-id', pattern: /^\d{2}-\d{7}-\d{1}$/ },
        { idType: 'philhealth-id', pattern: /^\d{2}-\d{7}-\d{2}$/ },
        { idType: 'tin', pattern: /^\d{3}-\d{3}-\d{3}-\d{3}$/ }
    ];
    for (const c of candidates) {
        if (c.pattern.test(cleaned)) return { idType: c.idType, confidence: 0.9 };
    }
    return null;
}

/**
 * Render a small inline detection badge next to the select element.
 */
function renderIDTypeDetectionBadge(selectEl, idType, confidence) {
    const prev = selectEl.parentElement.querySelector('.ocr-detection-indicator');
    if (prev) prev.remove();
    const span = document.createElement('span');
    span.className = 'ocr-detection-indicator';
    span.style.marginLeft = '8px';
    span.style.fontSize = '12px';
    span.style.color = '#555';
    span.textContent = `Auto-selected (${idType.replace(/-/g, ' ')}, ${Math.round((confidence || 0) * 100)}%)`;
    selectEl.parentElement.insertBefore(span, selectEl.nextSibling);
}

/**
 * Auto-fill form fields from OCR extracted data.
 */
function autoFillFromOCRData(extractedData, documentType) {
    if (!extractedData) return;
    console.log('[OCR AutoFill] Processing extracted data:', extractedData, 'Document type:', documentType);
    const strictFieldMapping = {
        'vin': 'chassisNumber', 'chassisNumber': 'chassisNumber', 'chassis / vin': 'chassisNumber', 'chassis/vin': 'chassisNumber', 'chassis vin': 'chassisNumber',
        'engineNumber': 'engineNumber', 'plateNumber': 'plateNumber', 'mvFileNumber': 'mvFileNumber',
        'make': 'make', 'series': 'model', 'model': 'model', 'bodyType': 'vehicleType', 'vehicleType': 'vehicleType', 'yearModel': 'year', 'year': 'year', 'color': 'color', 'fuelType': 'fuelType',
        'grossWeight': 'grossVehicleWeight', 'netCapacity': 'netWeight', 'netWeight': 'netWeight',
        'idType': 'idType', 'idNumber': 'idNumber'
    };
    const normalizeOcrKey = (k) => (k || '').toString().trim().toLowerCase().replace(/[_-]/g, '').replace(/\s+/g, '');
    const normalizedStrictMapping = {};
    Object.keys(strictFieldMapping).forEach((k) => { normalizedStrictMapping[normalizeOcrKey(k)] = strictFieldMapping[k]; });

    let idTypeDetection = null;
    if ((documentType === 'ownerValidId' || documentType === 'owner_id' || documentType === 'ownerId') &&
        (!extractedData.idType || extractedData.idType === '') && extractedData.idNumber) {
        idTypeDetection = detectIDTypeFromNumber(extractedData.idNumber);
        if (idTypeDetection && idTypeDetection.idType) extractedData.idType = idTypeDetection.idType;
    }

    let fieldsFilled = 0;
    const personalInfoFields = ['firstName', 'lastName', 'address', 'phone', 'email'];

    Object.keys(extractedData).forEach(ocrField => {
        const value = extractedData[ocrField];
        if (!value || value === '') return;
        if ((documentType === 'ownerValidId' || documentType === 'owner_id' || documentType === 'ownerId') && personalInfoFields.includes(ocrField)) return;

        const normalizedField = normalizeOcrKey(ocrField);
        let htmlInputId = normalizedStrictMapping[normalizedField] || strictFieldMapping[ocrField];
        if (!htmlInputId) return;

        const inputElement = document.getElementById(htmlInputId);
        if (!inputElement) return;
        if (inputElement.dataset.userEdited === 'true') return;

        const getDocPriority = (dt) => {
            const n = (dt || '').toString().trim().toLowerCase();
            if (n === 'csr') return 3;
            if (n === 'sales_invoice' || n === 'salesinvoice') return 2;
            return 1;
        };
        const incomingPriority = getDocPriority(documentType);
        const existingPriority = parseInt(inputElement.dataset.ocrPriority || '0', 10) || 0;
        const hasExistingValue = !!(inputElement.value && inputElement.value.toString().trim() !== '');
        const existingWasOcr = inputElement.classList.contains('ocr-auto-filled');
        if (hasExistingValue && !existingWasOcr) return;
        if (hasExistingValue && existingWasOcr && existingPriority > incomingPriority) return;

        let formattedValue = value.trim();
        if (htmlInputId === 'plateNumber') {
            formattedValue = formattedValue.replace(/\s/g, '').toUpperCase().replace(/-/g, '');
            if (formattedValue.length === 7 && /^[A-Z]{3}\d{4}$/.test(formattedValue)) {
                formattedValue = formattedValue.substring(0, 3) + '-' + formattedValue.substring(3);
            } else return;
        }

        const normalizeDropdownToken = (raw) => {
            if (!raw) return '';
            const s = raw.toString().trim().toLowerCase().replace(/\s+/g, '');
            const stripped = s.replace(/^fueltype/, '').replace(/^fuel/, '').replace(/^type/, '').replace(/^kind/, '');
            return stripped.replace(/[^a-z0-9]/g, '');
        };
        const matchSelectOption = (selectEl, rawVal) => {
            const token = normalizeDropdownToken(rawVal);
            if (!token) return null;
            const options = Array.from(selectEl.options || []);
            const byValue = options.find((opt) => normalizeDropdownToken(opt.value) === token);
            if (byValue) return byValue;
            const byText = options.find((opt) => normalizeDropdownToken(opt.textContent || '') === token);
            if (byText) return byText;
            if (token === 'gas' || token === 'gasoline' || token === 'petrol') return options.find((opt) => normalizeDropdownToken(opt.value) === 'gasoline' || normalizeDropdownToken(opt.textContent || '') === 'gasoline') || null;
            if (token === 'diesel') return options.find((opt) => normalizeDropdownToken(opt.value) === 'diesel' || normalizeDropdownToken(opt.textContent || '') === 'diesel') || null;
            return null;
        };

        if (inputElement.tagName === 'SELECT') {
            const optionExists = matchSelectOption(inputElement, formattedValue) || Array.from(inputElement.options).find(opt => opt.value === formattedValue || opt.textContent.trim() === formattedValue || opt.value.toLowerCase() === formattedValue.toLowerCase() || opt.textContent.trim().toLowerCase() === formattedValue.toLowerCase());
            if (optionExists) {
                inputElement.dataset.ocrFilling = 'true';
                inputElement.value = optionExists.value;
                inputElement.dataset.ocrFilling = 'false';
            } else return;
        } else {
            inputElement.dataset.ocrFilling = 'true';
            inputElement.value = formattedValue;
            inputElement.dataset.ocrFilling = 'false';
        }
        inputElement.classList.add('ocr-auto-filled');
        inputElement.dataset.ocrSource = (documentType || '').toString();
        inputElement.dataset.ocrPriority = String(incomingPriority);

        const htmlToCanonical = { vin: 'vin', chassisNumber: 'chassisNumber', engineNumber: 'engineNumber', plateNumber: 'plateNumber', make: 'make', model: 'model', year: 'year', vehicleType: 'vehicleType', color: 'color', fuelType: 'fuelType', grossVehicleWeight: 'grossVehicleWeight', netWeight: 'netWeight', idType: 'idType', idNumber: 'idNumber' };
        const canonicalKey = htmlToCanonical[htmlInputId];
        if (canonicalKey) {
            storeOcrValue(canonicalKey, formattedValue, documentType);
            if (canonicalKey === 'chassisNumber') storeOcrValue('vin', formattedValue, documentType);
        }

        if (htmlInputId === 'plateNumber') {
            if (validateField(inputElement) === false) {
                inputElement.value = '';
                inputElement.classList.remove('ocr-auto-filled');
                inputElement.classList.add('invalid');
                return;
            }
        }
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        fieldsFilled++;
    });

    if (idTypeDetection && idTypeDetection.idType) {
        const idTypeSelect = document.getElementById('idType');
        if (idTypeSelect) {
            idTypeSelect.dataset.ocrConfidence = (idTypeDetection.confidence || 0).toString();
            idTypeSelect.title = `Detected: ${idTypeDetection.idType.replace(/-/g, ' ')} (confidence ${Math.round((idTypeDetection.confidence || 0) * 100)}%)`;
            renderIDTypeDetectionBadge(idTypeSelect, idTypeDetection.idType, idTypeDetection.confidence || 0);
        }
    }
    if (fieldsFilled > 0) console.log(`[OCR AutoFill] Successfully auto-filled ${fieldsFilled} field(s) from document type: ${documentType}`);
}

/**
 * Process document upload and extract data via OCR for auto-fill.
 */
async function processDocumentForOCRAutoFill(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const documentType = fileInput.getAttribute('data-document-type') || fileInput.id;

    try {
        const apiClient = window.apiClient || (window.APIClient && new window.APIClient());
        if (!apiClient) return;

        const indicator = document.createElement('div');
        indicator.className = 'ocr-processing';
        indicator.textContent = 'Extracting information from document...';
        indicator.style.cssText = 'color: #667eea; font-size: 0.875rem; margin-top: 0.5rem;';
        fileInput.parentElement.appendChild(indicator);

        const formData = new FormData();
        formData.append('document', file);
        formData.append('documentType', documentType);

        const token = getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch('/api/documents/extract-info', { method: 'POST', headers: headers, body: formData });
            if (!response.ok) {
                indicator.textContent = `OCR extraction failed (${response.status}). Please enter information manually.`;
                indicator.style.color = '#e74c3c';
                setTimeout(() => indicator.remove(), 5000);
                return;
            }
            const data = await response.json();

            if (data.success && data.extractedData) {
                if (documentType === 'ownerValidId' || documentType === 'owner_id' || documentType === 'ownerId') {
                    const ownerIdData = { idType: data.extractedData.idType, idNumber: data.extractedData.idNumber };
                    Object.keys(ownerIdData).forEach(key => { storeOcrValue(key, ownerIdData[key], documentType); });
                } else {
                    const vehicleDataFields = ['engineNumber', 'chassisNumber', 'plateNumber', 'vin', 'make', 'model', 'series', 'year', 'yearModel', 'color', 'fuelType', 'vehicleType', 'bodyType', 'grossVehicleWeight', 'grossWeight', 'netWeight', 'netCapacity', 'mvFileNumber', 'csrNumber'];
                    vehicleDataFields.forEach(key => {
                        const value = data.extractedData[key];
                        if (value !== undefined && value !== null && value !== '') {
                            storeOcrValue(key, value, documentType);
                            if (key === 'series') storeOcrValue('model', value, documentType);
                            if (key === 'yearModel') storeOcrValue('year', value, documentType);
                            if (key === 'grossWeight') storeOcrValue('grossVehicleWeight', value, documentType);
                            if (key === 'netCapacity') storeOcrValue('netWeight', value, documentType);
                        }
                    });
                    const d = data.extractedData;
                    if (d.engine_number) storeOcrValue('engineNumber', d.engine_number, documentType);
                    if (d.chassis_number) storeOcrValue('chassisNumber', d.chassis_number, documentType);
                    if (d.plate_number) storeOcrValue('plateNumber', d.plate_number, documentType);
                    if (d.vin_number || d.vin_no) storeOcrValue('vin', d.vin_number || d.vin_no, documentType);
                    if (d.vehicle_make) storeOcrValue('make', d.vehicle_make, documentType);
                    if (d.vehicle_model || d.vehicle_series) storeOcrValue('model', d.vehicle_model || d.vehicle_series, documentType);
                    if (d.year_model) storeOcrValue('year', d.year_model, documentType);
                    if (d.vehicle_type || d.body_type) storeOcrValue('vehicleType', d.vehicle_type || d.body_type, documentType);
                    if (d.fuel_type) storeOcrValue('fuelType', d.fuel_type, documentType);
                    if (d.vehicle_color) storeOcrValue('color', d.vehicle_color, documentType);
                }
                autoFillFromOCRData(data.extractedData, documentType);
                indicator.textContent = '✓ Information extracted and auto-filled';
                indicator.style.color = '#27ae60';
                setTimeout(() => indicator.remove(), 3000);
            } else {
                indicator.textContent = 'Could not extract information (manual entry required)';
                indicator.style.color = '#e74c3c';
                setTimeout(() => indicator.remove(), 3000);
            }
        } catch (ocrError) {
            console.error('[ID AutoFill Debug] OCR ERROR:', ocrError);
            indicator.remove();
            if (documentType === 'owner_id' || documentType === 'ownerId' || documentType === 'ownerValidId') {
                autoFillOwnerInfo();
            }
        }
    } catch (error) {
        console.error('Error processing document for OCR:', error);
    }
}

/**
 * Setup OCR auto-fill when documents are uploaded.
 */
function setupOCRAutoFill() {
    setTimeout(() => {
        const container = document.getElementById('document-upload-container');
        console.log('[ID AutoFill Debug] setupOCRAutoFill - container found:', !!container);
        if (!container) {
            setTimeout(() => {
                const retryContainer = document.getElementById('document-upload-container');
                if (retryContainer) {
                    retryContainer.addEventListener('change', async function (e) {
                        if (e.target.type === 'file' && e.target.files && e.target.files[0]) {
                            await processDocumentForOCRAutoFill(e.target);
                        }
                    });
                }
            }, 1000);
            return;
        }
        container.addEventListener('change', async function (e) {
            if (e.target.type === 'file' && e.target.files && e.target.files[0]) {
                await processDocumentForOCRAutoFill(e.target);
            }
        });
        console.log('[ID AutoFill Debug] setupOCRAutoFill - event listener attached');
    }, 1000);
}

/**
 * Auto-fill owner information from logged-in user profile.
 */
async function autoFillOwnerInfo() {
    try {
        if (typeof window === 'undefined' || (!window.apiClient && !window.APIClient)) {
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (window.apiClient || window.APIClient) break;
            }
        }
        const apiClient = window.apiClient || (window.APIClient && new window.APIClient());
        if (!apiClient) return;
        let token = (apiClient && typeof apiClient.getAuthToken === 'function')
            ? apiClient.getAuthToken()
            : (localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('accessToken') ||
               sessionStorage.getItem('authToken') || sessionStorage.getItem('token') || sessionStorage.getItem('accessToken'));
        if (!token && typeof window !== 'undefined' && window.authManager && typeof window.authManager.getAccessToken === 'function') {
            token = window.authManager.getAccessToken();
        }
        if (!token) return;
        let profileResponse;
        try {
            profileResponse = await apiClient.get('/api/auth/profile');
        } catch (error) {
            return;
        }
        if (!profileResponse || !profileResponse.success || !profileResponse.user) return;
        const user = profileResponse.user;
        const firstNameField = document.getElementById('firstName');
        const lastNameField = document.getElementById('lastName');
        const emailField = document.getElementById('email');
        const phoneField = document.getElementById('phone');
        const addressField = document.getElementById('address');
        let fieldsFilled = 0;
        if (firstNameField && !firstNameField.value && user.firstName) {
            firstNameField.value = user.firstName;
            firstNameField.classList.add('auto-filled');
            fieldsFilled++;
        }
        if (lastNameField && !lastNameField.value && user.lastName) {
            lastNameField.value = user.lastName;
            lastNameField.classList.add('auto-filled');
            fieldsFilled++;
        }
        if (emailField && !emailField.value && user.email) {
            emailField.value = user.email;
            emailField.classList.add('auto-filled');
            fieldsFilled++;
        }
        if (phoneField && !phoneField.value && user.phone) {
            phoneField.value = user.phone;
            phoneField.classList.add('auto-filled');
            fieldsFilled++;
        }
        if (addressField && !addressField.value && user.address) {
            addressField.value = user.address;
            addressField.classList.add('auto-filled');
            fieldsFilled++;
        }
        if (fieldsFilled > 0 && typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Owner information has been auto-filled from your profile. Upload documents in Step 1 for more accurate auto-fill.', 'info');
        }
    } catch (error) {
        console.log('Auto-fill error (non-critical):', error);
    }
}

function initializeFileUploads() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function () {
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
            reader.onload = function (e) {
                label.innerHTML = `
                    <img src="${e.target.result}" style="max-width: 100px; max-height: 100px; border-radius: 4px; margin-bottom: 0.5rem;" alt="Preview">
                    <span style="color: #000000 !important; font-weight: 600;">${file.name}</span>
                    <small style="display: block; color: #000000 !important; font-size: 0.8rem;">${(file.size / 1024).toFixed(2)} KB</small>
                `;
                // Update label background to show file is selected
                label.style.background = '#f8f9fa';
                label.style.border = '2px solid #2d7ff9';
                label.style.color = '#000000';
            };
            reader.readAsDataURL(file);
        } else if (label) {
            label.innerHTML = `
                <span class="upload-icon">✅</span>
                <span style="color: #000000 !important; font-weight: 600;">${file.name}</span>
                <small style="display: block; color: #000000 !important; font-size: 0.8rem;">${(file.size / 1024).toFixed(2)} KB</small>
            `;
            // Update label background to show file is selected
            label.style.background = '#f8f9fa';
            label.style.border = '2px solid #2d7ff9';
            label.style.color = '#000000';
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
    console.log('[Review] updateReviewData() started');

    const getFieldValue = (id) => {
        const el = document.getElementById(id);
        if (!el) return '';
        return (el.value || '').trim();
    };

    const make = getFieldValue('make');
    const model = getFieldValue('model');
    const year = getFieldValue('year');
    const color = getFieldValue('color');
    const plate = getFieldValue('plateNumber');
    const vehicleCategory = getFieldValue('vehicleCategory');
    const passengerCapacity = getFieldValue('passengerCapacity');
    const grossVehicleWeight = getFieldValue('grossVehicleWeight');
    const netWeight = getFieldValue('netWeight');
    const classification = getFieldValue('classification');
    const firstName = getFieldValue('firstName');
    const lastName = getFieldValue('lastName');
    const email = getFieldValue('email');
    const phone = getFieldValue('phone');
    const idNumber = getFieldValue('idNumber');

    const vehicleTypeEl = document.getElementById('vehicleType');
    const vehicleType = vehicleTypeEl ? (vehicleTypeEl.value || '').trim() : '';
    const idTypeEl = document.getElementById('idType');
    let displayIdType = '-';
    if (idTypeEl && idTypeEl.options[idTypeEl.selectedIndex]) {
        displayIdType = idTypeEl.options[idTypeEl.selectedIndex].text || idTypeEl.value || '-';
    }

    const setReview = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '-';
    };
    setReview('review-make-model', (make && model) ? `${make} ${model}` : '');
    setReview('review-year', year);
    setReview('review-color', color);
    setReview('review-vehicle-type', vehicleType);
    setReview('review-plate', plate);
    setReview('review-vehicle-category', vehicleCategory);
    setReview('review-passenger-capacity', passengerCapacity);
    setReview('review-gvw', grossVehicleWeight);
    setReview('review-net-weight', netWeight);
    setReview('review-classification', classification);
    setReview('review-name', (firstName && lastName) ? `${firstName} ${lastName}` : '');
    setReview('review-email', email);
    setReview('review-phone', phone);
    setReview('review-id-type', displayIdType);
    setReview('review-id-number', idNumber);
}

    /**
     * Update the uploaded documents list dynamically (nested - top-level version used by wizard).
     */
    function updateUploadedDocumentsListNested() {
        const container = document.getElementById('review-documents-list');
        if (!container) {
            console.warn('review-documents-list container not found');
            return;
        }

        // Find all file inputs with data-document-type attribute (works even when Step 1 is hidden)
        const documentInputs = document.querySelectorAll('input[type="file"][data-document-type]');
        let html = '';

        if (documentInputs.length === 0) {
            container.innerHTML = '<p>No documents to upload</p>';
            return;
        }

        // Loop through each input and check if file is present
        documentInputs.forEach(input => {
            const docType = input.getAttribute('data-document-type') || input.id || 'Unknown';
            const hasFile = input.files && input.files.length > 0;
            const icon = hasFile ? '✅' : '❌';

            // Convert docType from camelCase to readable label
            const docLabel = docType
                .replace(/([A-Z])/g, ' $1')  // Add space before capitals
                .replace(/^./, str => str.toUpperCase())  // Capitalize first letter
                .trim();

            html += `<p>${icon} ${docLabel}</p>`;
        });

        container.innerHTML = html;
        console.log('[Review] Updated documents list with', documentInputs.length, 'document slots');
    }

    /**
     * Validate document keys before submission
     * Checks for invalid IDs, missing CIDs, and mapping issues
     * @param {Object} documents - Document uploads object
     * @returns {Object} - { errors: [], warnings: [] }
     */
    function validateDocumentKeys(documents) {
        const errors = [];
        const warnings = [];

        // Try to get documentTypes - may not be available in browser
        let docTypes = null;
        try {
            if (typeof window !== 'undefined' && window.documentTypes) {
                docTypes = window.documentTypes;
            } else if (typeof require !== 'undefined') {
                docTypes = require('./documentTypes');
            }
        } catch (e) {
            console.warn('DocumentTypes module not available, skipping type validation:', e);
        }

        // UUID validation regex (RFC 4122 compliant)
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        for (const [frontendKey, docData] of Object.entries(documents || {})) {
            // Check if document data exists
            if (!docData || typeof docData !== 'object') {
                errors.push({
                    document: frontendKey,
                    error: 'Document data is missing or invalid'
                });
                continue;
            }

            // Validate document type mapping (if docTypes available)
            if (docTypes) {
                try {
                    const logicalType = docTypes.mapLegacyType(frontendKey);
                    const dbType = docTypes.mapToDbType(logicalType);

                    if (!logicalType || !dbType) {
                        errors.push({
                            document: frontendKey,
                            error: `Unknown document type. Cannot map '${frontendKey}' to database type.`
                        });
                    } else if (dbType === 'other') {
                        warnings.push({
                            document: frontendKey,
                            warning: `Document type '${frontendKey}' maps to 'other' type. This may cause issues.`
                        });
                    }
                } catch (e) {
                    // If mapping fails, log warning but don't fail
                    warnings.push({
                        document: frontendKey,
                        warning: `Could not validate document type mapping: ${e.message}`
                    });
                }
            }

            // Validate document ID format if present
            if (docData.id) {
                if (typeof docData.id !== 'string') {
                    warnings.push({
                        document: frontendKey,
                        warning: `Document ID is not a string: ${typeof docData.id}`
                    });
                } else if (docData.id.startsWith('TEMP_') || docData.id.startsWith('doc_')) {
                    warnings.push({
                        document: frontendKey,
                        warning: `Document has temporary ID (${docData.id}). Document may not have been saved to database. Please re-upload.`
                    });
                } else if (!UUID_REGEX.test(docData.id)) {
                    warnings.push({
                        document: frontendKey,
                        warning: `Document ID format is invalid (${docData.id}). Expected UUID format.`
                    });
                }
            }

            // Validate CID if present
            if (!docData.cid && !docData.id) {
                warnings.push({
                    document: frontendKey,
                    warning: `Document has no CID or ID. It may not be linkable to vehicle.`
                });
            }
        }

        return { errors, warnings };
    }

    async function submitApplication() {
        const termsAgreement = document.getElementById('termsAgreement');

        if (!termsAgreement || !termsAgreement.checked) {
            ToastNotification.show('Please agree to the terms and conditions before submitting', 'error');
            return;
        }

        // Prevent double submit
        if (isSubmitting) return;
        isSubmitting = true;

        const apiClient = window.apiClient || new APIClient();

        try {
            // 1. Upload documents first (backend /api/vehicles/register expects document IDs, not raw files)
            if (typeof ToastNotification !== 'undefined') ToastNotification.show('Uploading documents...', 'info');
            const uploadResults = await uploadDocuments(undefined);

            // 2. Collect vehicle and owner data (matches backend POST /api/vehicles/register payload)
            if (typeof ToastNotification !== 'undefined') ToastNotification.show('Submitting application...', 'info');
            const applicationData = collectApplicationData();

            const registrationData = {
                vehicle: applicationData.vehicle,
                owner: {
                    firstName: applicationData.owner.firstName,
                    lastName: applicationData.owner.lastName,
                    email: applicationData.owner.email,
                    phone: applicationData.owner.phone || undefined,
                    address: applicationData.owner.address || undefined
                },
                documents: uploadResults,
                notes: (applicationData.notes && applicationData.notes.admin) || ''
            };

            // 3. POST JSON to backend (no FormData - backend expects JSON body)
            const response = await apiClient.post('/api/vehicles/register', registrationData);

            if (response && response.success) {
                if (typeof ToastNotification !== 'undefined') {
                    ToastNotification.show('Application submitted successfully!', 'success');
                }
                setTimeout(() => {
                    window.location.href = 'owner-dashboard.html?submitted=true';
                }, 1500);
            } else {
                throw new Error(response.error || response.message || 'Submission failed');
            }
        } catch (error) {
            console.error('Submission error:', error);
            showTopError(`Submission failed: ${error.message}`);
        } finally {
            isSubmitting = false;
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

            // Always check for car type value after restore (even if restore returned false)
            // Use setTimeout to ensure DOM has been updated with restored values
            setTimeout(() => {
                const carTypeSelect = document.getElementById('carType');
                if (carTypeSelect && carTypeSelect.value) {
                    console.log('[Registration Wizard] Restoring document visibility for car type:', carTypeSelect.value);
                    handleCarTypeChange(carTypeSelect.value);
                }
            }, 50);
        }

        // Keyboard shortcuts
        function initializeKeyboardShortcuts() {
            document.addEventListener('keydown', function (e) {
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
            const apiClient = window.apiClient || (typeof APIClient !== 'undefined' && new APIClient());
            if (!apiClient) throw new Error('API client not available');
            const uploadResults = {};
            const uploadErrors = [];

            // Find all file inputs in the document upload container (dynamic or static)
            const container = document.getElementById('document-upload-container');
            const fileInputs = container ?
                Array.from(container.querySelectorAll('input[type="file"]')) :
                // Fallback: try to find static fields
                ['registrationCert', 'insuranceCert', 'ownerId']
                    .map(id => document.getElementById(id))
                    .filter(input => input !== null);

            // Upload documents in parallel for better performance
            const uploadPromises = fileInputs.map(async (fileInput) => {
                // Handle both direct input elements and IDs
                const input = typeof fileInput === 'string' ? document.getElementById(fileInput) : fileInput;
                if (!input) return;

                if (input.files && input.files[0]) {
                    // Get document type from data attribute - this MUST exist
                    const docType = input.getAttribute('data-document-type');

                    if (!docType) {
                        // This should never happen - all upload fields should have data-document-type
                        console.error('[BUG] Upload field missing data-document-type attribute:', {
                            inputId: input.id,
                            inputName: input.name,
                            container: container?.id,
                            timestamp: new Date().toISOString()
                        });

                        uploadErrors.push({
                            docType: input.id || input.name || 'unknown',
                            error: 'Configuration error: Document type not specified'
                        });
                        return; // Skip this upload
                    }

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

        // Enhanced collectApplicationData function
        function collectApplicationData() {
            // Generate unique application ID
            const applicationId = 'APP-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);

            // Get car type from Step 1
            const carType = document.getElementById('carType')?.value || '';

            // Collect vehicle information
            // Helper function to safely get and trim field values
            const getFieldValue = (fieldId, defaultValue = '') => {
                const field = document.getElementById(fieldId);
                if (!field) {
                    console.warn(`[collectApplicationData] Field not found: ${fieldId}`);
                    return defaultValue;
                }
                const value = (field.value || '').trim();
                return value || defaultValue;
            };

            const plateNumberValue = getFieldValue('plateNumber');
            const vehicleInfo = {
                make: getFieldValue('make'),
                model: getFieldValue('model'),
                year: parseInt(getFieldValue('year') || new Date().getFullYear()),
                color: getFieldValue('color'),
                engineNumber: getFieldValue('engineNumber'),
                chassisNumber: getFieldValue('chassisNumber'),
                vin: getFieldValue('vin') || getFieldValue('chassisNumber'),
                plateNumber: plateNumberValue ? plateNumberValue.toUpperCase() : '',
                vehicleType: getFieldValue('vehicleType', 'Car'),
                carType: carType, // Add car type from Step 1
                vehicleCategory: getFieldValue('vehicleCategory'),
                passengerCapacity: parseInt(getFieldValue('passengerCapacity') || 0),
                grossVehicleWeight: parseFloat(getFieldValue('grossVehicleWeight') || 0),
                netWeight: parseFloat(getFieldValue('netWeight') || 0),
                classification: getFieldValue('classification', 'Private')
            };

            // Debug: Log collected vehicle data to help diagnose issues
            console.log('[collectApplicationData] Collected vehicle data:', {
                vin: vehicleInfo.vin,
                plateNumber: vehicleInfo.plateNumber,
                make: vehicleInfo.make,
                model: vehicleInfo.model,
                hasVin: !!vehicleInfo.vin,
                hasPlateNumber: !!vehicleInfo.plateNumber,
                hasMake: !!vehicleInfo.make,
                hasModel: !!vehicleInfo.model
            });

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
                vehicle: vehicleInfo,
                owner: ownerInfo,
                status: 'SUBMITTED',
                submittedDate: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                priority: 'MEDIUM',
                verificationStatus: {
                    insurance: 'PENDING',
                    hpg: 'PENDING'  // Changed from 'admin' to 'hpg' to match dashboard expectations
                },
                notes: {
                    admin: '',
                    insurance: ''
                }
            };
        }

        /**
         * Initialize VIN auto-fill from chassis number
         * VIN should mirror chassis number (as used in this wizard) to keep both fields consistent.
         */
        function initializeVINAutoFill() {
            const chassisNumberField = document.getElementById('chassisNumber');
            const vinField = document.getElementById('vin');

            if (!chassisNumberField || !vinField) {
                // VIN field may not exist until Step 2 is rendered; warn but don't break initialization
                console.warn('[VIN AutoFill] Chassis or VIN field not found');
                return;
            }

            const syncVinFromChassis = () => {
                const chassisValue = (chassisNumberField.value || '').trim();
                if (chassisValue) {
                    vinField.value = chassisValue;
                    vinField.dispatchEvent(new Event('input', { bubbles: true }));
                }
            };

            // Keep VIN synced as user types/edits chassis number
            chassisNumberField.addEventListener('input', syncVinFromChassis);
            chassisNumberField.addEventListener('change', syncVinFromChassis);

            // If chassis was restored from persistence before init, sync once
            syncVinFromChassis();

            console.log('[VIN AutoFill] VIN auto-fill initialized');
        }

        /**
         * Handle car type selection change
         */
        function handleCarTypeChange(carType) {
            const documentSection = document.getElementById('document-upload-section');
            const container = document.getElementById('document-upload-container');

            if (!carType || !carType.trim()) {
                // Hide document section if no car type selected
                if (documentSection) {
                    documentSection.style.display = 'none';
                }
                if (container) {
                    container.innerHTML = '<div class="loading-message">Please select a vehicle type first</div>';
                }
                return;
            }

            // Show document section
            if (documentSection) {
                documentSection.style.display = 'block';
            }

            // Load documents based on car type
            loadDocumentsByCarType(carType);
        }

        /**
         * Load documents based on selected car type
         */
        function loadDocumentsByCarType(carType) {
            const container = document.getElementById('document-upload-container');
            if (!container) return;

            container.innerHTML = '<div class="loading-message">Loading document requirements...</div>';

            // Define documents for each car type
            let documents = [];

            if (carType === 'Motorcycle – Tricycle (TC)') {
                // For Tricycle: Standard documents + Affidavit of Attachment for Sidecar
                documents = [
                    {
                        id: 'certificateOfStockReport',
                        name: 'Certificate of Stock Report (CSR)',
                        description: 'Upload your Certificate of Stock Report',
                        required: true
                    },
                    {
                        id: 'insuranceCertificate',
                        name: 'Insurance Certificate of Cover (Third Party Liability)',
                        description: 'Upload your Insurance Certificate of Cover',
                        required: true
                    },
                    {
                        id: 'pnpHpgClearance',
                        name: 'PNP-HPG Motor Vehicle (MV) Clearance Certificate',
                        description: 'Upload your PNP-HPG MV Clearance Certificate',
                        required: true
                    },
                    {
                        id: 'salesInvoice',
                        name: 'Sales Invoice',
                        description: 'Upload your Sales Invoice',
                        required: true
                    },
                    {
                        id: 'ownerValidId',
                        name: 'Owner Valid ID',
                        description: 'Upload a copy of your valid ID',
                        required: true
                    },
                    {
                        id: 'affidavitOfAttachment',
                        name: 'Original Affidavit of Attachment for Sidecar',
                        description: 'Upload the Original Affidavit of Attachment for Sidecar',
                        required: true
                    }
                ];
            } else if (carType === 'Passenger Vehicle' || carType === 'Commercial Vehicle' || carType === 'Motorcycle') {
                // For Passenger Vehicle, Commercial Vehicle, and Motorcycle: Standard documents
                documents = [
                    {
                        id: 'certificateOfStockReport',
                        name: 'Certificate of Stock Report (CSR)',
                        description: 'Upload your Certificate of Stock Report',
                        required: true
                    },
                    {
                        id: 'insuranceCertificate',
                        name: 'Insurance Certificate of Cover (Third Party Liability)',
                        description: 'Upload your Insurance Certificate of Cover',
                        required: true
                    },
                    {
                        id: 'pnpHpgClearance',
                        name: 'PNP-HPG Motor Vehicle (MV) Clearance Certificate',
                        description: 'Upload your PNP-HPG MV Clearance Certificate',
                        required: true
                    },
                    {
                        id: 'salesInvoice',
                        name: 'Sales Invoice',
                        description: 'Upload your Sales Invoice',
                        required: true
                    },
                    {
                        id: 'ownerValidId',
                        name: 'Owner Valid ID',
                        description: 'Upload a copy of your valid ID',
                        required: true
                    }
                ];
            } else {
                // Fallback: Show message
                container.innerHTML = '<div class="error-message">Please select a valid vehicle type</div>';
                return;
            }

            // Render document upload fields
            renderCustomDocumentFields(documents, container);

            // Re-initialize file upload handlers for new fields
            initializeFileUploads();
        }

        /**
         * Render custom document upload fields
         */
        function renderCustomDocumentFields(documents, container) {
            container.innerHTML = '';

            documents.forEach(doc => {
                const uploadItem = document.createElement('div');
                uploadItem.className = 'upload-item';

                uploadItem.innerHTML = `
            <div class="upload-info">
                <h4>${escapeHtml(doc.name)} ${doc.required ? '<span class="required">*</span>' : ''}</h4>
                <p>${escapeHtml(doc.description || '')}</p>
                <small class="form-hint">Accepted: PDF, JPG, JPEG, PNG | Max: 10MB</small>
            </div>
            <div class="upload-area">
                <input type="file" 
                       id="${doc.id}" 
                       name="${doc.id}"
                       accept=".pdf,.jpg,.jpeg,.png"
                       data-document-type="${doc.id}"
                       data-max-size="${10 * 1024 * 1024}"
                       ${doc.required ? 'required' : ''}>
                <label for="${doc.id}" class="upload-label">
                    <span class="upload-icon">📄</span>
                    <span>Choose File</span>
                </label>
            </div>
        `;

                container.appendChild(uploadItem);
            });
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

                // Fetch document requirements (single global set for NEW registration)
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
                <input type="file" id="registrationCert" accept=".pdf,.jpg,.jpeg" data-document-type="registrationCert" required>
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
                <input type="file" id="insuranceCert" accept=".pdf,.jpg,.jpeg" data-document-type="insuranceCert" required>
                <label for="insuranceCert" class="upload-label">
                    <span class="upload-icon">🛡️</span>
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
                <input type="file" id="ownerId" accept=".pdf,.jpg,.jpeg" data-document-type="ownerValidId" required>
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
                console.log('[ID AutoFill Debug] setupOCRAutoFill - container found:', !!container);
                if (!container) {
                    console.log('[ID AutoFill Debug] setupOCRAutoFill - container not found, retrying...');
                    // Retry after another second
                    setTimeout(() => {
                        const retryContainer = document.getElementById('document-upload-container');
                        console.log('[ID AutoFill Debug] setupOCRAutoFill - retry container found:', !!retryContainer);
                        if (retryContainer) {
                            retryContainer.addEventListener('change', async function (e) {
                                console.log('[ID AutoFill Debug] File input change event triggered:', {
                                    targetType: e.target.type,
                                    hasFiles: !!(e.target.files && e.target.files[0]),
                                    fileInputId: e.target.id,
                                    documentType: e.target.getAttribute('data-document-type') || e.target.id
                                });
                                if (e.target.type === 'file' && e.target.files && e.target.files[0]) {
                                    await processDocumentForOCRAutoFill(e.target);
                                }
                            });
                        }
                    }, 1000);
                    return;
                }

                // Use event delegation to handle file inputs that are dynamically added
                container.addEventListener('change', async function (e) {
                    console.log('[ID AutoFill Debug] File input change event triggered:', {
                        targetType: e.target.type,
                        hasFiles: !!(e.target.files && e.target.files[0]),
                        fileInputId: e.target.id,
                        documentType: e.target.getAttribute('data-document-type') || e.target.id
                    });
                    if (e.target.type === 'file' && e.target.files && e.target.files[0]) {
                        await processDocumentForOCRAutoFill(e.target);
                    }
                });
                console.log('[ID AutoFill Debug] setupOCRAutoFill - event listener attached');
            }, 1000);
        }

        /**
         * Process document upload and extract data via OCR for auto-fill
         */
        async function processDocumentForOCRAutoFill(fileInput) {
            console.log('[ID AutoFill Debug] processDocumentForOCRAutoFill called:', {
                fileInputId: fileInput.id,
                hasFiles: !!fileInput.files,
                fileCount: fileInput.files ? fileInput.files.length : 0
            });

            const file = fileInput.files[0];
            if (!file) {
                console.log('[ID AutoFill Debug] No file found in fileInput');
                return;
            }

            const documentType = fileInput.getAttribute('data-document-type') || fileInput.id;
            console.log('[ID AutoFill Debug] Document type determined:', {
                dataAttribute: fileInput.getAttribute('data-document-type'),
                fileInputId: fileInput.id,
                finalDocumentType: documentType
            });


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

                // #region agent log
                console.log('[ID AutoFill Debug] Starting OCR extraction:', { documentType, fileName: file.name });
                // #endregion

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

                    // Check if response is OK before parsing JSON
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('[ID AutoFill Debug] OCR endpoint returned error:', {
                            status: response.status,
                            statusText: response.statusText,
                            errorPreview: errorText.substring(0, 200),
                            documentType: documentType,
                            fileName: file.name
                        });

                        // Show user-friendly error message
                        indicator.textContent = `OCR extraction failed (${response.status}). Please enter information manually.`;
                        indicator.style.color = '#e74c3c';
                        setTimeout(() => indicator.remove(), 5000);

                        throw new Error(`OCR extraction failed: ${response.status} ${response.statusText}`);
                    }

                    // Parse JSON only if response is OK
                    const data = await response.json();

                    // #region agent log
                    const ocrDebugInfo = {
                        success: data.success,
                        hasExtractedData: !!data.extractedData,
                        extractedDataKeys: data.extractedData ? Object.keys(data.extractedData) : [],
                        hasIdType: !!(data.extractedData && data.extractedData.idType),
                        hasIdNumber: !!(data.extractedData && data.extractedData.idNumber),
                        idType: data.extractedData?.idType,
                        idNumber: data.extractedData?.idNumber,
                        fullExtractedData: data.extractedData,
                        documentType: documentType
                    };
                    console.log('[ID AutoFill Debug] OCR response received:', ocrDebugInfo);
                    console.log('[ID AutoFill Debug] Full extractedData JSON:', JSON.stringify(data.extractedData, null, 2));
                    console.log('[ID AutoFill Debug] Document type was:', documentType);
                    if (documentType === 'ownerValidId' && (!data.extractedData || Object.keys(data.extractedData).length === 0)) {
                        console.warn('[ID AutoFill Debug] WARNING: ownerValidId document returned empty extractedData! Check backend logs for OCR extraction.');
                    }
                    // #endregion

                    if (data.success && data.extractedData) {
                        // For owner ID documents, ONLY extract ID type and number
                        // Personal information (name, address, phone) should come from account, not documents
                        if (documentType === 'ownerValidId' || documentType === 'owner_id' || documentType === 'ownerId') {
                            // Store ONLY ID-related data (NOT personal information like name, address, phone)
                            const ownerIdData = {
                                idType: data.extractedData.idType,
                                idNumber: data.extractedData.idNumber
                            };
                            // Merge ID data into stored data (don't overwrite with empty if extraction failed)
                            Object.keys(ownerIdData).forEach(key => {
                                storeOcrValue(key, ownerIdData[key], documentType);
                            });
                            console.log('[ID AutoFill Debug] Stored owner ID OCR data (ID info only):', {
                                documentType,
                                extractedIdData: ownerIdData,
                                storedKeys: Object.keys(storedOCRExtractedData),
                                hasIdType: !!storedOCRExtractedData.idType,
                                hasIdNumber: !!storedOCRExtractedData.idNumber,
                                idType: storedOCRExtractedData.idType,
                                idNumber: storedOCRExtractedData.idNumber,
                                note: 'Personal info (name, address, phone) will be loaded from user account'
                            });
                        } else {
                            // For vehicle documents, store ALL vehicle-related data for conflict detection
                            // Store all fields that might be extracted from vehicle documents
                            const vehicleDataFields = [
                                'engineNumber', 'chassisNumber', 'plateNumber', 'vin',
                                'make', 'model', 'series', 'year', 'yearModel', 'color',
                                'fuelType', 'vehicleType', 'bodyType',
                                'grossVehicleWeight', 'grossWeight', 'netWeight', 'netCapacity',
                                'mvFileNumber', 'csrNumber'
                            ];

                            // Merge ALL vehicle-related fields into stored data
                            vehicleDataFields.forEach(key => {
                                const value = data.extractedData[key];
                                if (value === undefined || value === null || value === '') return;
                                // Store the raw key too
                                storeOcrValue(key, value, documentType);

                                // Also store canonical equivalents for conflict detection consistency
                                if (key === 'series') storeOcrValue('model', value, documentType);
                                if (key === 'yearModel') storeOcrValue('year', value, documentType);
                                if (key === 'grossWeight') storeOcrValue('grossVehicleWeight', value, documentType);
                                if (key === 'netCapacity') storeOcrValue('netWeight', value, documentType);
                            });

                            // Support common snake_case keys returned by some OCR pipelines
                            storeOcrValue('engineNumber', data.extractedData.engine_number, documentType);
                            storeOcrValue('chassisNumber', data.extractedData.chassis_number, documentType);
                            storeOcrValue('plateNumber', data.extractedData.plate_number, documentType);
                            storeOcrValue('vin', data.extractedData.vin_number || data.extractedData.vin_no, documentType);
                            storeOcrValue('make', data.extractedData.vehicle_make, documentType);
                            storeOcrValue('model', data.extractedData.vehicle_model || data.extractedData.vehicle_series, documentType);
                            storeOcrValue('year', data.extractedData.year_model, documentType);
                            storeOcrValue('vehicleType', data.extractedData.vehicle_type || data.extractedData.body_type, documentType);
                            storeOcrValue('fuelType', data.extractedData.fuel_type, documentType);
                            storeOcrValue('color', data.extractedData.vehicle_color, documentType);

                            console.log('[ID AutoFill Debug] Stored vehicle OCR data:', {
                                documentType,
                                extractedVehicleData: data.extractedData,
                                storedKeys: Object.keys(storedOCRExtractedData).filter(k => vehicleDataFields.includes(k) || k === 'model' || k === 'year' || k === 'grossVehicleWeight' || k === 'netWeight')
                            });
                        }

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
                    console.error('[ID AutoFill Debug] OCR ERROR DETAILS:', {
                        error: ocrError.message,
                        errorName: ocrError.name,
                        stack: ocrError.stack,
                        documentType: documentType,
                        fileInputId: fileInput.id
                    });
                    indicator.remove();

                    // Fallback: Still auto-fill owner info from profile if logged in
                    // Also check for ownerValidId (not just ownerId/owner_id)
                    if (documentType === 'owner_id' || documentType === 'ownerId' || documentType === 'ownerValidId') {
                        console.log('[ID AutoFill Debug] OCR failed, attempting fallback auto-fill from profile');
                        autoFillOwnerInfo();
                    }
                }
            } catch (error) {
                console.error('Error processing document for OCR:', error);
            }
        }

        /**
         * Track when a user manually edits a field so OCR auto-fill won't overwrite it later.
         * Uses `dataset.userEdited = 'true'` and `dataset.ocrFilling = 'true'`.
         */
        function initializeOcrUserEditTracking() {
            const selector = 'input, select, textarea';
            document.querySelectorAll(selector).forEach((el) => {
                if (el.dataset.ocrUserEditTrackingBound === 'true') return;
                el.dataset.ocrUserEditTrackingBound = 'true';

                const markUserEdited = () => {
                    if (el.dataset.ocrFilling === 'true') return;
                    el.dataset.userEdited = 'true';
                };

                el.addEventListener('input', markUserEdited);
                el.addEventListener('change', markUserEdited);
            });
        }

        /**
         * Auto-fill form fields from OCR extracted data
         * Maps API response STRICTLY to HTML input IDs
         */
        function autoFillFromOCRData(extractedData, documentType) {
            console.log('[OCR AutoFill] Processing extracted data:', extractedData, 'Document type:', documentType);

            // **STRICT MAPPING: OCR Response Fields → HTML Input IDs**
            // This mapping ensures ALL extracted fields are correctly placed
            // Maps the OCR/backend response fields to the actual HTML form input IDs
            const strictFieldMapping = {
                // Identifiers
                'vin': 'chassisNumber',                  // Map VIN to chassisNumber (same field)
                'chassisNumber': 'chassisNumber',
                'chassis / vin': 'chassisNumber',        // Maps "Chassis / VIN" to chassisNumber
                'chassis/vin': 'chassisNumber',          // Alternative format without spaces
                'chassis vin': 'chassisNumber',          // Alternative format with space only
                'engineNumber': 'engineNumber',
                'plateNumber': 'plateNumber',
                'mvFileNumber': 'mvFileNumber',  // If field exists in HTML

                // Descriptors (LTO Standard Names → Actual HTML IDs)
                'make': 'make',
                'series': 'model',              // Maps LTO "series" to HTML "model" field
                'model': 'model',               // Fallback: map model to model
                'bodyType': 'vehicleType',      // Maps LTO "bodyType" to HTML "vehicleType" field
                'yearModel': 'year',            // Maps LTO "yearModel" to HTML "year" field
                'year': 'year',                 // Fallback: map year to year
                'color': 'color',
                'fuelType': 'fuelType',         // If field exists in HTML

                // Weights (LTO Standard Names → Actual HTML IDs)
                'grossWeight': 'grossVehicleWeight',  // Maps LTO "grossWeight" to HTML "grossVehicleWeight"
                'netCapacity': 'netWeight',           // Maps LTO "netCapacity" to HTML "netWeight"
                'netWeight': 'netWeight',             // Fallback: map netWeight to netWeight

                // Owner ID fields - ONLY ID type and number from documents
                // Personal info (firstName, lastName, address, phone) should come from account profile
                'idType': 'idType',
                'idNumber': 'idNumber'
                // Note: firstName, lastName, address, phone mappings removed - these come from user account
            };

            // Build a normalized lookup so we can match snake_case / spaced / dashed keys too
            const normalizeOcrKey = (k) =>
                (k || '')
                    .toString()
                    .trim()
                    .toLowerCase()
                    .replace(/[_-]/g, '')
                    .replace(/\s+/g, '');

            const normalizedStrictMapping = {};
            Object.keys(strictFieldMapping).forEach((k) => {
                normalizedStrictMapping[normalizeOcrKey(k)] = strictFieldMapping[k];
            });

            // Debug logging
            console.log('[OCR AutoFill] Strict field mapping applied:', {
                documentType,
                extractedKeys: Object.keys(extractedData),
                mappedFields: Object.keys(strictFieldMapping)
            });

            // Heuristic: Detect ID type from ID number if missing and owner ID document
            let idTypeDetection = null;
            if ((documentType === 'ownerValidId' || documentType === 'owner_id' || documentType === 'ownerId') &&
                (!extractedData.idType || extractedData.idType === '') && extractedData.idNumber) {
                idTypeDetection = detectIDTypeFromNumber(extractedData.idNumber);
                if (idTypeDetection && idTypeDetection.idType) {
                    extractedData.idType = idTypeDetection.idType;
                    console.log('[OCR AutoFill] Heuristic ID type detected from number:', idTypeDetection);
                } else {
                    console.log('[OCR AutoFill] No ID type detected from number');
                }
            }

            // **ITERATE THROUGH EXTRACTED DATA AND APPLY STRICT MAPPING**
            let fieldsFilled = 0;

            // For owner ID documents, skip personal information fields (they come from account)
            const personalInfoFields = ['firstName', 'lastName', 'address', 'phone', 'email'];

            Object.keys(extractedData).forEach(ocrField => {
                const value = extractedData[ocrField];

                // Skip empty values
                if (!value || value === '') {
                    console.log(`[OCR AutoFill] Skipping empty value for field: ${ocrField}`);
                    return;
                }

                // CRITICAL: For owner ID documents, skip personal information
                // Only extract ID type and number from documents; personal info comes from account
                if ((documentType === 'ownerValidId' || documentType === 'owner_id' || documentType === 'ownerId') &&
                    personalInfoFields.includes(ocrField)) {
                    console.log(`[OCR AutoFill] Skipping personal info field for owner ID: ${ocrField} (data comes from account, not document)`);
                    return;
                }

                // Normalize field name for case-insensitive and variation matching
                const normalizedField = normalizeOcrKey(ocrField);

                // Get mapped HTML input ID from strict mapping (supports snake_case / dashed / spaced keys)
                let htmlInputId = normalizedStrictMapping[normalizedField];

                // If not found, try exact match fallback
                if (!htmlInputId) htmlInputId = strictFieldMapping[ocrField];

                if (!htmlInputId) {
                    console.log(`[OCR AutoFill] No mapping found for OCR field: ${ocrField}`);
                    return;
                }

                // Get the HTML element
                const inputElement = document.getElementById(htmlInputId);
                if (!inputElement) {
                    console.log(`[OCR AutoFill] HTML element not found: ${htmlInputId}`);
                    return;
                }

                // -------- Overwrite control (prevents bad docs overwriting good/user edits) --------
                // 1) Never overwrite if user manually edited the field
                if (inputElement.dataset.userEdited === 'true') {
                    console.log(`[OCR AutoFill] Skipping user-edited field: ${htmlInputId}`);
                    return;
                }

                // 2) Only overwrite OCR-filled fields if incoming doc has >= priority (CSR wins)
                const getDocPriority = (dt) => {
                    const normalized = (dt || '').toString().trim().toLowerCase();
                    if (normalized === 'csr') return 3;
                    if (normalized === 'sales_invoice' || normalized === 'salesinvoice') return 2;
                    return 1;
                };
                const incomingPriority = getDocPriority(documentType);
                const existingPriority = parseInt(inputElement.dataset.ocrPriority || '0', 10) || 0;

                const hasExistingValue = !!(inputElement.value && inputElement.value.toString().trim() !== '');
                const existingWasOcr = inputElement.classList.contains('ocr-auto-filled');

                // If there is already a value and it wasn't OCR-filled, do not overwrite.
                if (hasExistingValue && !existingWasOcr) {
                    console.log(`[OCR AutoFill] Field already has non-OCR value, skipping: ${htmlInputId}`);
                    return;
                }

                // If there is an OCR value with higher priority, do not overwrite.
                if (hasExistingValue && existingWasOcr && existingPriority > incomingPriority) {
                    console.log(`[OCR AutoFill] Existing OCR value has higher priority (${existingPriority}) than incoming (${incomingPriority}), skipping: ${htmlInputId}`);
                    return;
                }

                // Set the value
                let formattedValue = value.trim();

                // STRICT plate number validation: ONLY accept ABC-1234 format (3 letters, 4 numbers)
                if (htmlInputId === 'plateNumber') {
                    formattedValue = formattedValue.replace(/\s/g, '').toUpperCase();
                    // Remove existing hyphens, then validate strict format
                    formattedValue = formattedValue.replace(/-/g, '');

                    // STRICT validation: exactly 7 chars, 3 letters + 4 numbers
                    if (formattedValue.length === 7 && /^[A-Z]{3}\d{4}$/.test(formattedValue)) {
                        // Valid: ABC1234 -> ABC-1234
                        formattedValue = formattedValue.substring(0, 3) + '-' + formattedValue.substring(3);
                    } else {
                        // INVALID FORMAT - REJECT auto-fill completely
                        console.log(`[OCR AutoFill] REJECTED plate number - invalid format: "${formattedValue}" - must be ABC-1234 (3 letters, 4 numbers)`);
                        return; // Skip this field - do NOT auto-fill
                    }
                }

                // Normalize dropdown-like values (fuelType etc.) to match options safely
                const normalizeDropdownToken = (raw) => {
                    if (!raw) return '';
                    const s = raw.toString().trim();
                    const lower = s.toLowerCase().replace(/\s+/g, '');
                    const stripped = lower
                        .replace(/^fueltype/, '')
                        .replace(/^fuel/, '')
                        .replace(/^type/, '')
                        .replace(/^kind/, '');
                    return stripped.replace(/[^a-z0-9]/g, '');
                };

                const matchSelectOption = (selectEl, rawVal) => {
                    const token = normalizeDropdownToken(rawVal);
                    if (!token) return null;

                    const options = Array.from(selectEl.options || []);
                    const byValue = options.find((opt) => normalizeDropdownToken(opt.value) === token);
                    if (byValue) return byValue;
                    const byText = options.find((opt) => normalizeDropdownToken(opt.textContent || '') === token);
                    if (byText) return byText;

                    // Fuel-specific synonyms
                    if (token === 'gas' || token === 'gasoline' || token === 'petrol') {
                        return options.find((opt) =>
                            normalizeDropdownToken(opt.value) === 'gasoline' ||
                            normalizeDropdownToken(opt.textContent || '') === 'gasoline'
                        ) || null;
                    }
                    if (token === 'diesel') {
                        return options.find((opt) =>
                            normalizeDropdownToken(opt.value) === 'diesel' ||
                            normalizeDropdownToken(opt.textContent || '') === 'diesel'
                        ) || null;
                    }
                    return null;
                };

                // Handle dropdown/select elements (e.g., fuelType)
                if (inputElement.tagName === 'SELECT') {
                    // For dropdown: match safely to existing options
                    const optionExists =
                        matchSelectOption(inputElement, formattedValue) ||
                        Array.from(inputElement.options).find(opt =>
                            opt.value === formattedValue ||
                            opt.textContent.trim() === formattedValue ||
                            opt.value.toLowerCase() === formattedValue.toLowerCase() ||
                            opt.textContent.trim().toLowerCase() === formattedValue.toLowerCase()
                        );
                    if (optionExists) {
                        inputElement.dataset.ocrFilling = 'true';
                        inputElement.value = optionExists.value;
                        inputElement.dataset.ocrFilling = 'false';
                        console.log(`[OCR AutoFill] Dropdown matched: ${formattedValue} -> ${optionExists.value}`);
                    } else {
                        console.log(`[OCR AutoFill] Dropdown value not found in options: ${formattedValue}`);
                        // Do NOT set an invalid value on a <select>. Keep existing selection.
                        return;
                    }
                } else {
                    inputElement.dataset.ocrFilling = 'true';
                    inputElement.value = formattedValue;
                    inputElement.dataset.ocrFilling = 'false';
                }
                inputElement.classList.add('ocr-auto-filled');
                inputElement.dataset.ocrSource = (documentType || '').toString();
                inputElement.dataset.ocrPriority = String(incomingPriority);

                // Record the OCR value we just applied so submit-time conflict checks always have data.
                // Map html input id -> canonical OCR keys used by detectOcrConflicts()
                const htmlToCanonical = {
                    vin: 'vin',
                    chassisNumber: 'chassisNumber',
                    engineNumber: 'engineNumber',
                    plateNumber: 'plateNumber',
                    make: 'make',
                    model: 'model',
                    year: 'year',
                    vehicleType: 'vehicleType',
                    color: 'color',
                    fuelType: 'fuelType',
                    grossVehicleWeight: 'grossVehicleWeight',
                    netWeight: 'netWeight',
                    idType: 'idType',
                    idNumber: 'idNumber'
                };
                const canonicalKey = htmlToCanonical[htmlInputId];
                if (canonicalKey) {
                    storeOcrValue(canonicalKey, formattedValue, documentType);
                    // Special case: chassisNumber field often represents VIN too
                    if (canonicalKey === 'chassisNumber') {
                        storeOcrValue('vin', formattedValue, documentType);
                    }
                }

                // CRITICAL: For plate number, validate immediately after auto-fill
                if (htmlInputId === 'plateNumber') {
                    // Trigger validation to catch any remaining issues
                    const isValid = validateField(inputElement);
                    if (isValid === false) {
                        console.warn(`[OCR AutoFill] Plate number auto-fill failed validation, clearing field`);
                        inputElement.value = '';
                        inputElement.classList.remove('ocr-auto-filled');
                        inputElement.classList.add('invalid');
                        return; // Skip event dispatch for invalid field
                    }
                }

                // Trigger change and input events for any listeners (validation)
                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));

                fieldsFilled++;

                // Debug logging
                console.log(`[OCR AutoFill] Field filled: ${ocrField} → ${htmlInputId} = "${formattedValue}"`);
            });

            // If we detected ID type heuristically, add a subtle confidence indicator next to the dropdown
            if (idTypeDetection && idTypeDetection.idType) {
                const idTypeSelect = document.getElementById('idType');
                if (idTypeSelect) {
                    // Attach confidence to element for possible future use
                    idTypeSelect.dataset.ocrConfidence = (idTypeDetection.confidence || 0).toString();
                    idTypeSelect.title = `Detected: ${idTypeDetection.idType.replace(/-/g, ' ')} (confidence ${(Math.round((idTypeDetection.confidence || 0) * 100))}%)`;
                    // Render a small inline badge
                    renderIDTypeDetectionBadge(idTypeSelect, idTypeDetection.idType, idTypeDetection.confidence || 0);
                }
            }

            // Show success notification
            if (fieldsFilled > 0) {
                console.log(`[OCR AutoFill] Successfully auto-filled ${fieldsFilled} field(s) from document type: ${documentType}`);
            } else {
                console.warn(`[OCR AutoFill] No fields were auto-filled from document type: ${documentType}`);
            }
        }

        /**
         * Detect Philippine ID type from ID number using known patterns
         * Returns { idType, confidence } where idType matches dropdown values
         */
        function detectIDTypeFromNumber(idNumber) {
            if (!idNumber) return null;
            const cleaned = idNumber.replace(/\s+/g, '').toUpperCase();
            const candidates = [
                { idType: 'drivers-license', pattern: /^[A-Z]\d{2}-\d{2}-\d{6,}$/ },
                { idType: 'passport', pattern: /^[A-Z]{2}\d{7}$/ },
                { idType: 'national-id', pattern: /^\d{4}-\d{4}-\d{4}-\d{4}$/ },
                { idType: 'postal-id', pattern: /^[A-Z]{2,3}\d{6,9}$|^\d{8,10}$/ },
                { idType: 'voters-id', pattern: /^\d{4}-\d{4}-\d{4}$/ },
                { idType: 'sss-id', pattern: /^\d{2}-\d{7}-\d{1}$/ },
                { idType: 'philhealth-id', pattern: /^\d{2}-\d{7}-\d{2}$/ },
                { idType: 'tin', pattern: /^\d{3}-\d{3}-\d{3}-\d{3}$/ }
            ];
            for (const c of candidates) {
                if (c.pattern.test(cleaned)) {
                    // High confidence when number format matches exactly
                    return { idType: c.idType, confidence: 0.9 };
                }
            }
            // No match
            return null;
        }

        /**
         * Render a small inline detection badge next to the select element
         */
        function renderIDTypeDetectionBadge(selectEl, idType, confidence) {
            // Remove previous badge if any
            const prev = selectEl.parentElement.querySelector('.ocr-detection-indicator');
            if (prev) prev.remove();
            const span = document.createElement('span');
            span.className = 'ocr-detection-indicator';
            span.style.marginLeft = '8px';
            span.style.fontSize = '12px';
            span.style.color = '#555';
            const pct = Math.round((confidence || 0) * 100);
            span.textContent = `Auto-selected (${idType.replace(/-/g, ' ')}, ${pct}%)`;
            // Insert after select
            selectEl.parentElement.insertBefore(span, selectEl.nextSibling);
        }

        /**
         * Validate ID number format based on ID type
         * @param {string} idNumber - ID number to validate
         * @param {string} idType - Type of ID (drivers-license, passport, etc.)
         * @returns {Object} Validation result with valid flag and message
         */
        function validateIDNumber(idNumber, idType) {
            if (!idNumber || !idType) {
                return { valid: false, message: 'ID number and type required' };
            }

            const cleaned = idNumber.replace(/\s+/g, '').toUpperCase();
            const patterns = {
                'drivers-license': /^[A-Z]\d{2}-\d{2}-\d{6,}$/,
                'passport': /^[A-Z]{2}\d{7}$/,
                'national-id': /^\d{4}-\d{4}-\d{4}-\d{4}$/,
                'postal-id': /^[A-Z]{2,3}\d{6,9}$|^\d{8,10}$/,
                'voters-id': /^\d{4}-\d{4}-\d{4}$/,
                'sss-id': /^\d{2}-\d{7}-\d{1}$/,
                'philhealth-id': /^\d{2}-\d{7}-\d{2}$/,
                'tin': /^\d{3}-\d{3}-\d{3}-\d{3}$/
            };

            const pattern = patterns[idType];
            if (pattern && pattern.test(cleaned)) {
                return { valid: true, message: 'Valid format' };
            }

            return { valid: false, message: `Invalid ${idType.replace(/-/g, ' ')} format` };
        }

        /**
         * Initialize ID number validation on form fields
         * This sets up real-time validation when user leaves the ID number field
         */
        function initializeIDNumberValidation() {
            const idNumberField = document.getElementById('idNumber');
            const idTypeField = document.getElementById('idType');

            if (idNumberField && idTypeField) {
                // Validate on blur (when user leaves the field)
                idNumberField.addEventListener('blur', function () {
                    const idType = idTypeField.value;
                    const idNumber = idNumberField.value;

                    if (idType && idNumber) {
                        const validation = validateIDNumber(idNumber, idType);
                        if (!validation.valid) {
                            showFieldError(idNumberField, validation.message);
                        } else {
                            hideFieldError(idNumberField);
                        }
                    } else if (idNumber && !idType) {
                        // Show error if ID number entered but no ID type selected
                        showFieldError(idNumberField, 'Please select an ID type first');
                    } else {
                        hideFieldError(idNumberField);
                    }
                });

                // Also validate when ID type changes
                idTypeField.addEventListener('change', function () {
                    const idType = idTypeField.value;
                    const idNumber = idNumberField.value;

                    if (idType && idNumber) {
                        const validation = validateIDNumber(idNumber, idType);
                        if (!validation.valid) {
                            showFieldError(idNumberField, validation.message);
                        } else {
                            hideFieldError(idNumberField);
                        }
                    } else {
                        hideFieldError(idNumberField);
                    }
                });

                // Clear error on input (optional - provides better UX)
                idNumberField.addEventListener('input', function () {
                    // Only clear error if field has value and ID type is selected
                    const idType = idTypeField.value;
                    const idNumber = idNumberField.value;

                    if (idType && idNumber) {
                        const validation = validateIDNumber(idNumber, idType);
                        if (validation.valid) {
                            hideFieldError(idNumberField);
                        }
                    }
                });
            }
        }

        /**
         * Ensure manual overrides to ID type are respected: remove detection badge and confidence
         */
        function initializeIDTypeOverrideHandling() {
            const idTypeField = document.getElementById('idType');
            if (!idTypeField) return;
            idTypeField.addEventListener('change', function () {
                // Remove detection badge if present
                const badge = idTypeField.parentElement && idTypeField.parentElement.querySelector('.ocr-detection-indicator');
                if (badge) badge.remove();
                // Clear confidence metadata
                delete idTypeField.dataset.ocrConfidence;
                // Update title to reflect manual selection
                idTypeField.title = 'ID type selected manually';
            });
        }

        /**
         * Auto-fill owner information from logged-in user profile
         * This is a fallback when OCR is not available
         */
        async function autoFillOwnerInfo() {
            try {
                // #region agent log
                console.log('[AutoFill Debug] autoFillOwnerInfo called');
                console.log('[AutoFill Debug] Window objects:', {
                    hasApiClient: typeof window !== 'undefined' && !!window.apiClient,
                    hasAPIClient: typeof window !== 'undefined' && !!window.APIClient,
                    hasAuthManager: typeof window !== 'undefined' && !!window.authManager,
                    windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.toLowerCase().includes('auth') || k.toLowerCase().includes('api') || k.toLowerCase().includes('client')).slice(0, 10) : []
                });
                // #endregion

                // Wait a bit for scripts to load if needed
                if (typeof window === 'undefined' || (!window.apiClient && !window.APIClient)) {
                    // #region agent log
                    console.log('[AutoFill Debug] Waiting for API client to load...');
                    // #endregion
                    // Wait up to 2 seconds for API client to be available
                    for (let i = 0; i < 20; i++) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        if (window.apiClient || window.APIClient) break;
                    }
                }

                // Check if user is logged in
                const apiClient = window.apiClient || (window.APIClient && new window.APIClient());
                if (!apiClient) {
                    // #region agent log
                    console.log('[AutoFill Debug] API client not available after wait, skipping auto-fill');
                    // #endregion
                    console.log('API client not available, skipping auto-fill');
                    return;
                }

                // Check if we have a token - use API client's getAuthToken method (handles all token sources)
                let token = null;
                if (apiClient && typeof apiClient.getAuthToken === 'function') {
                    token = apiClient.getAuthToken();
                    // #region agent log
                    console.log('[AutoFill Debug] Token from API client getAuthToken():', {
                        hasToken: !!token,
                        tokenLength: token ? token.length : 0,
                        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
                    });
                    // #endregion
                } else {
                    // #region agent log
                    console.log('[AutoFill Debug] API client getAuthToken() method not available, using fallback');
                    // #endregion
                }

                // Fallback: check multiple possible token storage locations
                if (!token) {
                    token = localStorage.getItem('authToken') ||
                        localStorage.getItem('token') ||
                        localStorage.getItem('accessToken') ||
                        sessionStorage.getItem('authToken') ||
                        sessionStorage.getItem('token') ||
                        sessionStorage.getItem('accessToken');
                    // #region agent log
                    console.log('[AutoFill Debug] Token from localStorage/sessionStorage fallback:', {
                        hasToken: !!token,
                        checkedAuthToken: !!localStorage.getItem('authToken'),
                        checkedToken: !!localStorage.getItem('token'),
                        checkedAccessToken: !!localStorage.getItem('accessToken'),
                        sessionAuthToken: !!sessionStorage.getItem('authToken'),
                        sessionToken: !!sessionStorage.getItem('token')
                    });
                    // #endregion
                }

                // Also check AuthManager if available (as additional fallback)
                if (!token && typeof window !== 'undefined' && window.authManager) {
                    if (typeof window.authManager.getAccessToken === 'function') {
                        token = window.authManager.getAccessToken();
                        // #region agent log
                        console.log('[AutoFill Debug] Token from AuthManager.getAccessToken():', { hasToken: !!token });
                        // #endregion
                    }
                }

                if (!token) {
                    // #region agent log
                    console.log('[AutoFill Debug] No authentication token found anywhere, skipping auto-fill', {
                        hasApiClient: !!apiClient,
                        hasGetAuthToken: !!(apiClient && typeof apiClient.getAuthToken === 'function'),
                        hasAuthManager: !!(typeof window !== 'undefined' && window.authManager),
                        localStorageAuthToken: !!localStorage.getItem('authToken'),
                        localStorageToken: !!localStorage.getItem('token'),
                        localStorageAccessToken: !!localStorage.getItem('accessToken'),
                        allLocalStorageKeys: Object.keys(localStorage).filter(k => k.toLowerCase().includes('token') || k.toLowerCase().includes('auth')).slice(0, 10)
                    });
                    // #endregion
                    console.log('No authentication token found, skipping auto-fill. User may not be logged in.');
                    console.log('Note: Auto-fill from profile requires user to be logged in. OCR auto-fill from documents will still work.');
                    return;
                }

                // #region agent log
                console.log('[AutoFill Debug] Token successfully retrieved:', {
                    hasToken: !!token,
                    tokenLength: token ? token.length : 0,
                    tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
                });
                // #endregion

                // Fetch user profile - use the API client which handles authentication automatically
                // #region agent log
                console.log('[AutoFill Debug] Fetching user profile via API client...');
                // #endregion

                let profileResponse;
                try {
                    profileResponse = await apiClient.get('/api/auth/profile');
                } catch (error) {
                    // #region agent log
                    console.log('[AutoFill Debug] Error fetching profile:', {
                        error: error.message,
                        status: error.status,
                        isAuthError: error.status === 401 || error.status === 403
                    });
                    // #endregion
                    console.log('Could not fetch user profile for auto-fill:', error.message);
                    return;
                }

                if (!profileResponse || !profileResponse.success || !profileResponse.user) {
                    // #region agent log
                    console.log('[AutoFill Debug] Profile response invalid:', {
                        hasResponse: !!profileResponse,
                        success: profileResponse?.success,
                        hasUser: !!(profileResponse?.user)
                    });
                    // #endregion
                    console.log('Could not fetch user profile for auto-fill');
                    return;
                }

                const user = profileResponse.user;
                // #region agent log
                console.log('[AutoFill Debug] User profile fetched:', {
                    hasFirstName: !!user.firstName,
                    hasLastName: !!user.lastName,
                    hasEmail: !!user.email,
                    hasPhone: !!user.phone,
                    hasAddress: !!user.address
                });
                // #endregion
                console.log('Auto-filling owner information from profile:', user);

                // Auto-fill owner fields (only if they're empty)
                const firstNameField = document.getElementById('firstName');
                const lastNameField = document.getElementById('lastName');
                const emailField = document.getElementById('email');
                const phoneField = document.getElementById('phone');
                const addressField = document.getElementById('address');

                // #region agent log
                console.log('[AutoFill Debug] Field availability check:', {
                    firstNameField: !!firstNameField,
                    lastNameField: !!lastNameField,
                    emailField: !!emailField,
                    phoneField: !!phoneField,
                    addressField: !!addressField,
                    firstNameValue: firstNameField?.value || '',
                    lastNameValue: lastNameField?.value || '',
                    emailValue: emailField?.value || '',
                    phoneValue: phoneField?.value || '',
                    addressValue: addressField?.value || ''
                });
                // #endregion

                let fieldsFilled = 0;

                if (firstNameField && !firstNameField.value && user.firstName) {
                    firstNameField.value = user.firstName;
                    firstNameField.classList.add('auto-filled');
                    fieldsFilled++;
                    // #region agent log
                    console.log('[AutoFill Debug] Filled firstName:', user.firstName);
                    // #endregion
                }
                if (lastNameField && !lastNameField.value && user.lastName) {
                    lastNameField.value = user.lastName;
                    lastNameField.classList.add('auto-filled');
                    fieldsFilled++;
                    // #region agent log
                    console.log('[AutoFill Debug] Filled lastName:', user.lastName);
                    // #endregion
                }
                if (emailField && !emailField.value && user.email) {
                    emailField.value = user.email;
                    emailField.classList.add('auto-filled');
                    fieldsFilled++;
                    // #region agent log
                    console.log('[AutoFill Debug] Filled email:', user.email);
                    // #endregion
                }
                if (phoneField && !phoneField.value && user.phone) {
                    phoneField.value = user.phone;
                    phoneField.classList.add('auto-filled');
                    fieldsFilled++;
                    // #region agent log
                    console.log('[AutoFill Debug] Filled phone:', user.phone);
                    // #endregion
                }
                if (addressField && !addressField.value && user.address) {
                    addressField.value = user.address;
                    addressField.classList.add('auto-filled');
                    fieldsFilled++;
                    // #region agent log
                    console.log('[AutoFill Debug] Filled address:', user.address);
                    // #endregion
                }

                // #region agent log
                console.log('[AutoFill Debug] Auto-fill complete:', { fieldsFilled });
                // #endregion

                // Show notification if any fields were auto-filled
                if (fieldsFilled > 0) {
                    showNotification('Owner information has been auto-filled from your profile. Upload documents in Step 1 for more accurate auto-fill.', 'info');
                } else {
                    // #region agent log
                    console.log('[AutoFill Debug] No fields were auto-filled (fields may already have values or user profile missing data)');
                    // #endregion
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
    }