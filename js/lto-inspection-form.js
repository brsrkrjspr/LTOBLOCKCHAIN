// LTO Inspection Form JavaScript
// Handles vehicle inspection form submission and MVIR generation

let currentVehicleId = null;
let currentVehicle = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    if (!AuthUtils.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Check if user is admin
    const currentUser = AuthUtils.getCurrentUser();
    if (currentUser.role !== 'admin') {
        alert('Access denied. Admin privileges required.');
        window.location.href = 'index.html';
        return;
    }

    // Set user name
    if (currentUser.firstName && currentUser.lastName) {
        document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
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

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        AuthUtils.logout();
        window.location.href = 'login.html';
    });
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
                const proceed = confirm(
                    `This vehicle already has an inspection (MVIR: ${response.vehicle.mvir_number}).\n\n` +
                    `Do you want to view the existing inspection or create a new one?`
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
    const formData = new FormData(form);
    
    // Get form values
    const inspectionResult = form.querySelector('input[name="inspectionResult"]:checked')?.value;
    const roadworthinessStatus = form.querySelector('input[name="roadworthinessStatus"]:checked')?.value;
    const emissionCompliance = form.querySelector('input[name="emissionCompliance"]:checked')?.value;
    const inspectionOfficer = document.getElementById('inspectionOfficer').value.trim();
    const inspectionNotes = document.getElementById('inspectionNotes').value.trim();
    
    // Validate
    if (!inspectionResult || !roadworthinessStatus || !emissionCompliance || !inspectionOfficer) {
        showError('Please fill in all required fields');
        return;
    }
    
    // Show loading
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.post('/api/lto/inspect', {
            vehicleId: currentVehicleId,
            inspectionResult,
            roadworthinessStatus,
            emissionCompliance,
            inspectionOfficer,
            inspectionNotes: inspectionNotes || null
        });
        
        if (response.success) {
            // Show success message
            document.getElementById('mvirNumberDisplay').textContent = response.inspection.mvirNumber;
            document.getElementById('inspectionFormCard').style.display = 'none';
            document.getElementById('successCard').style.display = 'block';
            
            // Scroll to success message
            document.getElementById('successCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Show toast notification
            if (window.ToastNotification) {
                ToastNotification.show(`Inspection completed! MVIR: ${response.inspection.mvirNumber}`, 'success');
            }
        } else {
            throw new Error(response.error || 'Failed to submit inspection');
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

