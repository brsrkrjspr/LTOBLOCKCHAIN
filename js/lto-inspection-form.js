// LTO Inspection Form JavaScript
// Handles vehicle inspection form submission and MVIR generation

let currentVehicleId = null;
let currentVehicle = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication
    if (!AuthUtils.isAuthenticated()) {
        window.location.href = 'login-signup.html';
        return;
    }

    // Check if user is admin, lto_admin, or lto_officer
    const currentUser = AuthUtils.getCurrentUser();
    if (!['admin', 'lto_admin', 'lto_officer'].includes(currentUser.role)) {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Access denied. Admin or Officer privileges required.', 'error');
        } else {
            alert('Access denied. Admin or Officer privileges required.');
        }
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Set user name
    if (currentUser.firstName && currentUser.lastName) {
        const userNameEl = document.getElementById('sidebarUserName');
        if (userNameEl) {
            userNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        }
    }

    // Set inspection officer to current user
    const officerName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
    if (officerName) {
        document.getElementById('inspectionOfficer').value = officerName;
    }

    // Setup event listeners
    setupEventListeners();

    // Setup tab switching
    setupTabs();

    // Load pre-minted vehicles if on that tab
    const currentTab = localStorage.getItem('inspectionTab') || 'pre-minted';
    switchTab(currentTab);

    if (currentTab === 'pre-minted') {
        await loadPreMintedVehicles();
    } else {
        // Load vehicles for inspection tab
        await loadVehicles();
    }
});

function setupTabs() {
    // Tab button click handlers
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function () {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
            localStorage.setItem('inspectionTab', tabName);
        });
    });

    // Mint vehicle form submission
    const mintForm = document.getElementById('mintVehicleForm');
    if (mintForm) {
        mintForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            await submitMintVehicle();
        });
    }
}

function switchTab(tabName) {
    // Validate tab existence, default to 'pre-minted' if invalid
    let selectedTab = document.getElementById(`${tabName}Tab`);
    if (!selectedTab) {
        console.warn(`Tab '${tabName}' not found. Defaulting to 'preMinted'.`);
        tabName = 'preMinted';
        selectedTab = document.getElementById(`${tabName}Tab`);
    }

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);

    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.style.display = 'block';
    }

    if (selectedButton) {
        selectedButton.classList.add('active');
    }
}

function setupEventListeners() {
    // Vehicle selection
    const vehicleSelect = document.getElementById('vehicleSelect');
    if (vehicleSelect) {
        vehicleSelect.addEventListener('change', async function (e) {
            const vehicleId = e.target.value;
            if (vehicleId) {
                await loadVehicleDetails(vehicleId);
            } else {
                hideVehicleInfo();
            }
        });
    }

    // Form submission
    document.getElementById('inspectionForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        await submitInspection();
    });

    // Photo preview
    const vehiclePhotosInput = document.getElementById('vehiclePhotos');
    if (vehiclePhotosInput) {
        vehiclePhotosInput.addEventListener('change', function (e) {
            const photoPreview = document.getElementById('photoPreview');
            if (!photoPreview) return;

            photoPreview.innerHTML = '';
            const files = Array.from(this.files);

            if (files.length === 0) {
                return;
            }

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.cursor = 'pointer';
                    img.title = file.name;
                    photoPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            const confirmed = await ToastNotification.confirm(
                'Are you sure you want to logout?',
                () => {
                    AuthUtils.logout();
                    window.location.href = 'login-signup.html';
                }
            );
        });
    }
}

async function loadVehicles() {
    try {
        const apiClient = window.apiClient || new APIClient();

        // Get all vehicles that may need inspection.
        // We include:
        // - REGISTERED / APPROVED: vehicles that are already in the registry but may not have MVIR yet
        // - TRANSFER_IN_PROGRESS: vehicles currently in an ownership transfer (these MUST be inspectable)
        const response = await apiClient.get('/api/vehicles');

        if (response.success && response.vehicles) {
            const vehicleSelect = document.getElementById('vehicleSelect');
            vehicleSelect.innerHTML = '<option value="">-- Select a vehicle --</option>';

            // Filter eligible vehicles by status
            const eligibleVehicles = response.vehicles.filter(v =>
                v.status === 'APPROVED' ||
                v.status === 'REGISTERED' ||
                v.status === 'TRANSFER_IN_PROGRESS'
            );

            eligibleVehicles.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle.id;
                const displayText = vehicle.plate_number
                    ? `${vehicle.plate_number} - ${vehicle.make} ${vehicle.model} (${vehicle.year})`
                    : `${vehicle.vin} - ${vehicle.make} ${vehicle.model} (${vehicle.year})`;
                option.textContent = displayText;
                vehicleSelect.appendChild(option);
            });

            if (eligibleVehicles.length === 0) {
                vehicleSelect.innerHTML = '<option value="">No vehicles available for inspection</option>';
            }
        }
    } catch (error) {
        console.error('Error loading vehicles:', error);
        showError('Failed to load vehicles: ' + error.message);
    }
}

async function loadVehicleDetails(vehicleId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/vehicles/id/${vehicleId}`);

        if (response.success && response.vehicle) {
            currentVehicle = response.vehicle;
            currentVehicleId = vehicleId;

            // Check if vehicle already has inspection
            if (response.vehicle.mvir_number) {
                const proceed = await ToastNotification.confirm(
                    `This vehicle already has an inspection (MVIR: ${response.vehicle.mvir_number}).\n\nDo you want to view the existing inspection or create a new one?`,
                    () => {
                        // User confirmed - continue
                    },
                    () => {
                        // User cancelled - reset selection
                        document.getElementById('vehicleSelect').value = '';
                    }
                );

                if (!proceed) {
                    document.getElementById('vehicleSelect').value = '';
                    return;
                }
            }

            // Populate vehicle info - handle multiple field name variations and null values
            const vehicle = response.vehicle;

            // Debug: Log vehicle data to help diagnose N/A issues
            // Check if we're in development mode (browser-compatible check)
            const isDevelopment = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('localhost');

            if (isDevelopment) {
                console.log('[LTO Inspection] Vehicle data received:', {
                    hasOwner: !!vehicle.owner,
                    ownerId: vehicle.ownerId || vehicle.owner_id,
                    ownerName: vehicle.ownerName || vehicle.owner_name,
                    ownerFirstName: vehicle.ownerFirstName || vehicle.owner_first_name,
                    ownerLastName: vehicle.ownerLastName || vehicle.owner_last_name,
                    ownerEmail: vehicle.ownerEmail || vehicle.owner_email,
                    make: vehicle.make,
                    model: vehicle.model,
                    year: vehicle.year,
                    plateNumber: vehicle.plateNumber || vehicle.plate_number,
                    vin: vehicle.vin
                });
            }

            // Owner name - try multiple field variations (current owner after transfer)
            const ownerFirstName = vehicle.ownerFirstName || vehicle.owner_first_name ||
                (vehicle.owner && vehicle.owner.firstName) || '';
            const ownerLastName = vehicle.ownerLastName || vehicle.owner_last_name ||
                (vehicle.owner && vehicle.owner.lastName) || '';
            const ownerName = vehicle.ownerName || vehicle.owner_name ||
                (vehicle.owner && vehicle.owner.name) ||
                (ownerFirstName && ownerLastName ? `${ownerFirstName} ${ownerLastName}` : '') ||
                vehicle.ownerEmail || vehicle.owner_email || '';

            document.getElementById('ownerName').value = ownerName.trim() || 'Not Available';

            // Plate number - try multiple variations
            document.getElementById('plateNumber').value =
                vehicle.plateNumber || vehicle.plate_number || 'Pending Assignment';

            // VIN - should always be present
            document.getElementById('vin').value = vehicle.vin || 'Not Available';

            // Make/Model - combine with proper handling
            const make = vehicle.make || '';
            const model = vehicle.model || '';
            document.getElementById('makeModel').value =
                `${make} ${model}`.trim() || 'Not Available';

            // Year - handle null/undefined (convert to string for input field)
            const yearValue = vehicle.year ? String(vehicle.year) : 'Not Available';
            document.getElementById('year').value = yearValue;

            // Engine number - try multiple field variations
            const engineNumber = vehicle.engineNumber || vehicle.engine_number || vehicle.engine_no ||
                vehicle.engineNo || '';
            document.getElementById('engineNumber').value = engineNumber || 'Not Recorded';

            // Chassis number - try multiple field variations, fallback to VIN if available
            const chassisNumber = vehicle.chassisNumber || vehicle.chassis_number || vehicle.chassis_no ||
                vehicle.chassisNo || '';
            document.getElementById('chassisNumber').value = chassisNumber || vehicle.vin || 'Not Recorded';

            // New fields: Weights and Capacity
            document.getElementById('passengerCapacity').value = vehicle.passengerCapacity || vehicle.passenger_capacity || 'Not Available';
            document.getElementById('grossVehicleWeight').value = vehicle.grossVehicleWeight || vehicle.gross_vehicle_weight || 'Not Available';
            document.getElementById('netWeight').value = vehicle.netWeight || vehicle.net_weight || 'Not Available';
            document.getElementById('vehicleType').value = vehicle.vehicleType || vehicle.vehicle_type || 'Not Available';
            document.getElementById('vehicleCategory').value = vehicle.vehicleCategory || vehicle.vehicle_category || 'Not Available';
            document.getElementById('classification').value = vehicle.classification || 'Not Available';

            // Show vehicle info and inspection form
            document.getElementById('vehicleInfoCard').style.display = 'block';
            document.getElementById('inspectionFormCard').style.display = 'block';
            document.getElementById('successCard').style.display = 'none';

            // Scroll to form
            document.getElementById('inspectionFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            throw new Error(response.error || 'Failed to load vehicle details');
        }
    } catch (error) {
        console.error('Error loading vehicle details:', error);
        showError('Failed to load vehicle details: ' + error.message);
    }
}

function hideVehicleInfo() {
    document.getElementById('vehicleInfoCard').style.display = 'none';
    document.getElementById('inspectionFormCard').style.display = 'none';
    document.getElementById('successCard').style.display = 'none';
    currentVehicleId = null;
    currentVehicle = null;
}

async function submitInspection() {
    if (!currentVehicleId) {
        showError('Please select a vehicle first');
        return;
    }

    const form = document.getElementById('inspectionForm');

    // Get form values
    const inspectionResult = form.querySelector('input[name="inspectionResult"]:checked')?.value;
    const roadworthinessStatus = form.querySelector('input[name="roadworthinessStatus"]:checked')?.value;
    const inspectionOfficer = document.getElementById('inspectionOfficer').value.trim();
    const inspectionNotes = document.getElementById('inspectionNotes').value.trim();

    // Get file inputs
    const mvirDocument = document.getElementById('mvirDocument').files[0];
    const vehiclePhotos = document.getElementById('vehiclePhotos').files;
    const additionalDocuments = document.getElementById('additionalDocuments').files;

    // Validate required fields
    if (!inspectionResult || !roadworthinessStatus || !inspectionOfficer) {
        showError('Please fill in all required inspection fields');
        return;
    }

    // Validate file uploads
    if (!mvirDocument) {
        showError('Please upload the MVIR document');
        return;
    }

    if (vehiclePhotos.length === 0) {
        showError('Please upload at least one vehicle photo');
        return;
    }

    // Validate file sizes
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (mvirDocument.size > maxFileSize) {
        showError('MVIR document is too large (max 10MB)');
        return;
    }

    for (let photo of vehiclePhotos) {
        if (photo.size > maxFileSize) {
            showError('One or more vehicle photos are too large (max 10MB each)');
            return;
        }
    }

    // Show loading
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading and submitting...';

    try {
        const apiClient = window.apiClient || new APIClient();

        // First upload the inspection documents
        const inspectionDocumentsFormData = new FormData();
        inspectionDocumentsFormData.append('vehicleId', currentVehicleId);
        inspectionDocumentsFormData.append('mvirDocument', mvirDocument);

        for (let photo of vehiclePhotos) {
            inspectionDocumentsFormData.append('vehiclePhotos', photo);
        }

        for (let doc of additionalDocuments) {
            inspectionDocumentsFormData.append('additionalDocuments', doc);
        }

        // Upload inspection documents
        const docResponse = await fetch('/api/lto/inspect-documents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: inspectionDocumentsFormData
        });

        if (!docResponse.ok) {
            const errorData = await docResponse.json();
            throw new Error(errorData.error || 'Failed to upload inspection documents');
        }

        const docData = await docResponse.json();

        // Now submit the inspection results with document references
        const inspectionResponse = await apiClient.post('/api/lto/inspect', {
            vehicleId: currentVehicleId,
            inspectionResult,
            roadworthinessStatus,
            inspectionOfficer,
            inspectionNotes: inspectionNotes || null,
            documentReferences: docData.documentReferences || {}
        });

        if (inspectionResponse.success) {
            // Show success message
            document.getElementById('mvirNumberDisplay').textContent = inspectionResponse.inspection.mvirNumber;
            document.getElementById('inspectionFormCard').style.display = 'none';
            document.getElementById('successCard').style.display = 'block';

            // Scroll to success message
            document.getElementById('successCard').scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Show toast notification
            if (window.ToastNotification) {
                ToastNotification.show(`Inspection completed! MVIR: ${inspectionResponse.inspection.mvirNumber}`, 'success');
            }
        } else {
            throw new Error(inspectionResponse.error || 'Failed to submit inspection');
        }
    } catch (error) {
        console.error('Error submitting inspection:', error);
        showError('Failed to submit inspection: ' + error.message);
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

function resetForm() {
    document.getElementById('vehicleSelect').value = '';
    document.getElementById('inspectionForm').reset();

    // Reset inspection officer to current user
    const currentUser = AuthUtils.getCurrentUser();
    const officerName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
    if (officerName) {
        document.getElementById('inspectionOfficer').value = officerName;
    }

    hideVehicleInfo();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(message) {
    if (window.ToastNotification) {
        ToastNotification.show(message, 'error');
    } else {
        alert(message);
    }
}

// ============================================
// Pre-Minted Vehicles Functions
// ============================================

async function loadPreMintedVehicles() {
    try {
        const loadingEl = document.getElementById('preMintedVehiclesLoading');
        const containerEl = document.getElementById('preMintedVehiclesTableContainer');
        const emptyEl = document.getElementById('preMintedVehiclesEmpty');
        const tbodyEl = document.getElementById('preMintedVehiclesTableBody');

        if (loadingEl) loadingEl.style.display = 'block';
        if (containerEl) containerEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';

        const apiClient = window.apiClient || new APIClient();

        // Use a shorter timeout for the background list loading to prevent UI hangs
        // The apiClient might already have a timeout, but we ensure we catch it
        const response = await apiClient.get('/api/blockchain/vehicles?status=MINTED');

        if (loadingEl) loadingEl.style.display = 'none';

        if (response.success && Array.isArray(response.vehicles)) {
            if (response.vehicles.length === 0) {
                if (emptyEl) {
                    emptyEl.style.display = 'block';
                    if (response.blockchainUnavailable && response.message) {
                        emptyEl.textContent = response.message;
                    } else {
                        emptyEl.textContent = 'No pre-minted vehicles available. You can mint a new one in the next tab.';
                    }
                }
                if (containerEl) containerEl.style.display = 'none';
            } else {
                if (containerEl) containerEl.style.display = 'block';
                if (emptyEl) emptyEl.style.display = 'none';
                displayPreMintedVehicles(response.vehicles);
            }
        } else {
            throw new Error(response.error || 'Failed to load pre-minted vehicles');
        }
    } catch (error) {
        console.error('Error loading pre-minted vehicles:', error);
        const loadingEl = document.getElementById('preMintedVehiclesLoading');
        const containerEl = document.getElementById('preMintedVehiclesTableContainer');
        const emptyEl = document.getElementById('preMintedVehiclesEmpty');

        if (loadingEl) loadingEl.style.display = 'none';
        if (containerEl) containerEl.style.display = 'none';

        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.textContent = 'Blockchain connectivity issue. Pre-minted vehicles could not be retrieved at this time.';
        }

        // Only show toast error if specifically requested via manual refresh
        // Background loading should be silent to not annoy the user
    }
}

function displayPreMintedVehicles(vehicles) {
    const tbodyEl = document.getElementById('preMintedVehiclesTableBody');
    if (!tbodyEl) return;

    tbodyEl.innerHTML = '';

    vehicles.forEach(vehicle => {
        const row = document.createElement('tr');

        const mintedDate = vehicle.mintedAt || vehicle.createdAt || vehicle.lastUpdated || 'N/A';
        const formattedDate = mintedDate !== 'N/A' ? new Date(mintedDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'N/A';

        row.innerHTML = `
            <td><strong>${vehicle.vin || 'N/A'}</strong></td>
            <td>${vehicle.make || ''} ${vehicle.model || ''}</td>
            <td>${vehicle.year || 'N/A'}</td>
            <td>${vehicle.plateNumber || '<span style="color: #94a3b8;">Pending</span>'}</td>
            <td><span class="vehicle-status-badge status-minted">${vehicle.status || 'MINTED'}</span></td>
            <td>${formattedDate}</td>
            <td>
                <button class="btn-secondary" onclick="viewPreMintedVehicle('${vehicle.vin}')" style="padding: 0.4rem 0.8rem; font-size: 0.875rem;">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        `;

        tbodyEl.appendChild(row);
    });
}

async function viewPreMintedVehicle(vin) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/blockchain/vehicles/${vin}`);

        if (response.success && response.vehicle) {
            const vehicle = response.vehicle;

            // Populate Modal
            document.getElementById('modalVin').textContent = vehicle.vin || 'N/A';
            document.getElementById('modalPlate').textContent = vehicle.plateNumber || 'Pending';
            document.getElementById('modalMakeModel').textContent = `${vehicle.make || ''} ${vehicle.model || ''}`;
            document.getElementById('modalYear').textContent = vehicle.year || 'N/A';
            document.getElementById('modalColor').textContent = vehicle.color || 'N/A';
            document.getElementById('modalType').textContent = vehicle.vehicleType || 'N/A';
            document.getElementById('modalEngine').textContent = vehicle.engineNumber || 'N/A';
            document.getElementById('modalChassis').textContent = vehicle.chassisNumber || 'N/A';
            document.getElementById('modalClass').textContent = vehicle.classification || 'N/A';
            document.getElementById('modalStatus').textContent = vehicle.status || 'N/A';

            const mintedDate = vehicle.mintedAt || vehicle.createdAt || vehicle.lastUpdated;
            document.getElementById('modalDate').textContent = mintedDate ? new Date(mintedDate).toLocaleString() : 'N/A';

            document.getElementById('modalWeight').textContent = vehicle.grossVehicleWeight ? `${vehicle.grossVehicleWeight} kg` : 'N/A';

            // Show Modal
            const modal = document.getElementById('vehicleDetailModal');
            if (modal) {
                modal.classList.add('active');
                // Close on overlay click
                modal.onclick = function (e) {
                    if (e.target === modal) {
                        closeVehicleModal();
                    }
                };
            }
        } else {
            throw new Error(response.error || 'Vehicle not found');
        }
    } catch (error) {
        console.error('Error viewing pre-minted vehicle:', error);
        showError('Failed to load vehicle details: ' + error.message);
    }
}

function closeVehicleModal() {
    const modal = document.getElementById('vehicleDetailModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function submitMintVehicle() {
    const form = document.getElementById('mintVehicleForm');
    if (!form) return;

    // Get form values
    const vehicleData = {
        vin: document.getElementById('mintVin').value.trim(),
        make: document.getElementById('mintMake').value.trim(),
        model: document.getElementById('mintModel').value.trim(),
        year: parseInt(document.getElementById('mintYear').value),
        color: document.getElementById('mintColor').value.trim() || '',
        plateNumber: document.getElementById('mintPlateNumber').value.trim() || '',
        crNumber: document.getElementById('mintCrNumber').value.trim() || '',
        engineNumber: document.getElementById('mintEngineNumber').value.trim() || '',
        chassisNumber: document.getElementById('mintChassisNumber').value.trim() || '',
        vehicleType: document.getElementById('mintVehicleType').value || 'Car',
        vehicleCategory: document.getElementById('mintVehicleCategory').value.trim() || '',
        classification: document.getElementById('mintClassification').value || 'Private',
        passengerCapacity: parseInt(document.getElementById('mintPassengerCapacity').value) || 0,
        grossVehicleWeight: parseInt(document.getElementById('mintGrossVehicleWeight').value) || 0,
        netWeight: parseInt(document.getElementById('mintNetWeight').value) || 0
    };

    // Validate required fields
    if (!vehicleData.vin || !vehicleData.make || !vehicleData.model || !vehicleData.year) {
        showError('Please fill in all required fields: VIN, Make, Model, Year');
        return;
    }

    // Validate year
    if (vehicleData.year < 1900 || vehicleData.year > 2100) {
        showError('Please enter a valid year');
        return;
    }

    // Show loading
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Minting on Blockchain...';

    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.post('/api/blockchain/vehicles/mint', vehicleData);

        if (response.success) {
            if (window.ToastNotification) {
                ToastNotification.show(`Vehicle ${vehicleData.vin} minted successfully on Fabric!`, 'success');
            } else {
                alert(`Vehicle ${vehicleData.vin} minted successfully!`);
            }

            // Reset form
            resetMintForm();

            // Reload pre-minted vehicles list
            await loadPreMintedVehicles();
        } else {
            throw new Error(response.error || 'Failed to mint vehicle');
        }
    } catch (error) {
        console.error('Error minting vehicle:', error);
        showError('Failed to mint vehicle: ' + error.message);
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

/**
 * Auto-fill Create Pre-Minted Vehicle form with random CSR-verified values.
 * Uses same character rules as LTO (VIN 17 chars, excludes I, O, Q).
 */
function autoFillMintFormRandom() {
    const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    const randomVIN = () => Array.from({ length: 17 }, () => VIN_CHARS[Math.floor(Math.random() * VIN_CHARS.length)]).join('');
    const randomPlate = () => {
        const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
        const letters = Array.from({ length: 3 }, () => L[Math.floor(Math.random() * L.length)]).join('');
        return letters + '-' + (1000 + Math.floor(Math.random() * 9000));
    };
    const randomEngine = () => {
        const pre = ['2NR', '1GR', '3UR', '4GR', '5VZ'][Math.floor(Math.random() * 5)];
        const mid = ['FE', 'GE', 'DE', 'CE', 'BE'][Math.floor(Math.random() * 5)];
        return pre + '-' + mid + (100000 + Math.floor(Math.random() * 900000));
    };
    const randomChassis = () => {
        const len = 10 + Math.floor(Math.random() * 8);
        return Array.from({ length: len }, () => VIN_CHARS[Math.floor(Math.random() * VIN_CHARS.length)]).join('');
    };

    const VEHICLE_CATALOG = [
        { make: 'Toyota', model: 'Vios', vehicleType: 'Car' },
        { make: 'Toyota', model: 'Corolla Altis', vehicleType: 'Car' },
        { make: 'Honda', model: 'Civic', vehicleType: 'Car' },
        { make: 'Honda', model: 'City', vehicleType: 'Car' },
        { make: 'Toyota', model: 'Fortuner', vehicleType: 'SUV' },
        { make: 'Toyota', model: 'Hilux', vehicleType: 'Truck' },
        { make: 'Honda', model: 'Click 125', vehicleType: 'Motorcycle' },
        { make: 'Mitsubishi', model: 'Mirage G4', vehicleType: 'Car' },
        { make: 'Hyundai', model: 'Accent', vehicleType: 'Car' }
    ];
    const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Pearl White', 'Brown', 'Beige'];
    const CLASSIFICATIONS = ['Private', 'Commercial', 'Government'];
    const CATEGORIES = ['Private', 'Commercial', 'For Hire'];

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const vehicle = pick(VEHICLE_CATALOG);
    const year = 2022 + Math.floor(Math.random() * 4); // 2022–2025

    const vin = randomVIN();
    const el = (id) => document.getElementById(id);
    if (el('mintVin')) el('mintVin').value = vin;
    if (el('mintMake')) el('mintMake').value = vehicle.make;
    if (el('mintModel')) el('mintModel').value = vehicle.model;
    if (el('mintYear')) el('mintYear').value = year;
    if (el('mintColor')) el('mintColor').value = pick(COLORS);
    if (el('mintPlateNumber')) el('mintPlateNumber').value = randomPlate();
    if (el('mintCrNumber')) el('mintCrNumber').value = 'CR-' + (1000000 + Math.floor(Math.random() * 8999999));
    if (el('mintEngineNumber')) el('mintEngineNumber').value = randomEngine();
    if (el('mintChassisNumber')) el('mintChassisNumber').value = randomChassis();
    if (el('mintVehicleType')) el('mintVehicleType').value = vehicle.vehicleType;
    if (el('mintVehicleCategory')) el('mintVehicleCategory').value = pick(CATEGORIES);
    if (el('mintClassification')) el('mintClassification').value = pick(CLASSIFICATIONS);

    // Random weights and capacity
    if (el('mintPassengerCapacity')) {
        el('mintPassengerCapacity').value = pick(['2', '4', '5', '7', '15', '45']);
    }
    if (el('mintGrossVehicleWeight')) {
        el('mintGrossVehicleWeight').value = 1500 + Math.floor(Math.random() * 3000);
    }
    if (el('mintNetWeight')) {
        const gross = parseInt(el('mintGrossVehicleWeight').value);
        el('mintNetWeight').value = Math.floor(gross * 0.7);
    }

    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Form filled with random CSR-verified vehicle data.', 'success');
    } else {
        alert('Form filled with random data.');
    }
}

function resetMintForm() {
    const form = document.getElementById('mintVehicleForm');
    if (form) {
        form.reset();
        // Reset vehicle type and classification to defaults
        document.getElementById('mintVehicleType').value = 'Car';
        document.getElementById('mintClassification').value = 'Private';
    }
}

