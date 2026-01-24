// LTO Inspection Form JavaScript
// Handles vehicle inspection form submission and MVIR generation

let currentVehicleId = null;
let currentVehicle = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
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

    // Load vehicles
    await loadVehicles();
});

function setupEventListeners() {
    // Vehicle selection
    document.getElementById('vehicleSelect').addEventListener('change', async function(e) {
        const vehicleId = e.target.value;
        if (vehicleId) {
            await loadVehicleDetails(vehicleId);
        } else {
            hideVehicleInfo();
        }
    });

    // Form submission
    document.getElementById('inspectionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await submitInspection();
    });

    // Photo preview
    const vehiclePhotosInput = document.getElementById('vehiclePhotos');
    if (vehiclePhotosInput) {
        vehiclePhotosInput.addEventListener('change', function(e) {
            const photoPreview = document.getElementById('photoPreview');
            if (!photoPreview) return;
            
            photoPreview.innerHTML = '';
            const files = Array.from(this.files);
            
            if (files.length === 0) {
                return;
            }
            
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = function(event) {
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
        logoutBtn.addEventListener('click', async function(e) {
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

