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

    // Check if user is admin
    const currentUser = AuthUtils.getCurrentUser();
    if (currentUser.role !== 'admin') {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Access denied. Admin privileges required.', 'error');
        } else {
            alert('Access denied. Admin privileges required.');
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
        
        // Get all vehicles that are APPROVED or REGISTERED but may not have inspection
        const response = await apiClient.get('/api/vehicles');
        
        if (response.success && response.vehicles) {
            const vehicleSelect = document.getElementById('vehicleSelect');
            vehicleSelect.innerHTML = '<option value="">-- Select a vehicle --</option>';
            
            // Filter vehicles that are APPROVED or REGISTERED
            const eligibleVehicles = response.vehicles.filter(v => 
                v.status === 'APPROVED' || v.status === 'REGISTERED'
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
            
            // Populate vehicle info
            document.getElementById('ownerName').value = 
                `${response.vehicle.owner_first_name || ''} ${response.vehicle.owner_last_name || ''}`.trim() || 'N/A';
            document.getElementById('plateNumber').value = response.vehicle.plate_number || 'N/A';
            document.getElementById('vin').value = response.vehicle.vin || 'N/A';
            document.getElementById('makeModel').value = `${response.vehicle.make || ''} ${response.vehicle.model || ''}`.trim() || 'N/A';
            document.getElementById('year').value = response.vehicle.year || 'N/A';
            document.getElementById('engineNumber').value = response.vehicle.engine_number || 'N/A';
            document.getElementById('chassisNumber').value = response.vehicle.chassis_number || 'N/A';
            
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
    const emissionCompliance = form.querySelector('input[name="emissionCompliance"]:checked')?.value;
    const inspectionOfficer = document.getElementById('inspectionOfficer').value.trim();
    const inspectionNotes = document.getElementById('inspectionNotes').value.trim();
    
    // Get file inputs
    const mvirDocument = document.getElementById('mvirDocument').files[0];
    const vehiclePhotos = document.getElementById('vehiclePhotos').files;
    const additionalDocuments = document.getElementById('additionalDocuments').files;
    
    // Validate required fields
    if (!inspectionResult || !roadworthinessStatus || !emissionCompliance || !inspectionOfficer) {
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
            emissionCompliance,
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

