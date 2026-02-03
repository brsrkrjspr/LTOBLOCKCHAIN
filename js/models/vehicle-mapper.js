/**
 * Canonical Vehicle Mapper
 * 
 * Provides a single source of truth for mapping vehicle API responses
 * to the frontend application object model.
 * 
 * This module ensures consistent data structure across all pages that
 * consume vehicle data from the API.
 */

/**
 * Normalizes verification status object to lowercase keys and values
 * @param {Object|undefined} raw - Raw verification status from API
 * @returns {Object} Normalized object with lowercase keys and values, or {}
 */
function normalizeVerificationStatus(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    
    const normalized = {};
    const keys = ['emission', 'insurance', 'hpg'];
    
    keys.forEach(key => {
        // Try multiple case variations
        const value = raw[key] || raw[key.toLowerCase()] || raw[key.toUpperCase()];
        if (value) {
            normalized[key] = String(value).toLowerCase();
        }
    });
    
    return normalized;
}

/**
 * Safely extracts the first valid ISO date string from candidates
 * @param {...string|Date} candidates - Date candidates to check
 * @returns {string} First valid ISO date string or current date as ISO string
 */
function safeDateIso(...candidates) {
    for (const candidate of candidates) {
        if (!candidate) continue;
        
        try {
            const date = candidate instanceof Date ? candidate : new Date(candidate);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        } catch (e) {
            // Invalid date, continue to next candidate
        }
    }
    
    return new Date().toISOString();
}

/**
 * Maps a vehicle API response to the canonical application object model
 * 
 * @param {Object} vehicle - Vehicle object from API (may be camelCase or snake_case)
 * @returns {Object} Canonical application object with normalized fields
 * 
 * @example
 * const app = mapVehicleToApplication({
 *   id: '123',
 *   plateNumber: 'ABC-123',
 *   make: 'Toyota',
 *   verificationStatus: { emission: 'APPROVED', insurance: 'pending' }
 * });
 */
function mapVehicleToApplication(vehicle) {
    if (!vehicle || typeof vehicle !== 'object') {
        throw new Error('mapVehicleToApplication: vehicle must be an object');
    }
    
    // Extract vehicle info with fallbacks (using || for compatibility)
    const vehicleInfo = {
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || '',
        plateNumber: vehicle.plateNumber || vehicle.plate_number || '',
        vin: vehicle.vin || '',
        color: vehicle.color || '',
        orCrNumber: vehicle.orCrNumber || vehicle.or_cr_number || null
    };
    
    // Extract OR/CR number (snake_case fallback for backward compatibility)
    const orCrNumber = vehicle.orCrNumber || vehicle.or_cr_number || null;
    
    // Normalize status to lowercase
    const status = vehicle.status 
        ? String(vehicle.status).toLowerCase() 
        : 'submitted';
    
    // Extract submitted date using safeDateIso helper
    const submittedDate = safeDateIso(
        vehicle.registrationDate,
        vehicle.registration_date,
        vehicle.createdAt,
        vehicle.created_at,
        vehicle.lastUpdated,
        vehicle.last_updated
    );
    
    // Extract documents array (ensure it's an array)
    const documents = Array.isArray(vehicle.documents) 
        ? vehicle.documents 
        : [];
    
    // Normalize verification status
    const verificationStatus = normalizeVerificationStatus(
        vehicle.verificationStatus || vehicle.verification_status
    );
    
    return {
        id: vehicle.id || '',
        vehicle: vehicleInfo,
        or_cr_number: orCrNumber, // Keep snake_case for backward compatibility
        status,
        submittedDate,
        documents,
        verificationStatus
    };
}

// Export for module systems (if using ES modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeVerificationStatus,
        safeDateIso,
        mapVehicleToApplication
    };
}

// Attach to window for plain script usage
if (typeof window !== 'undefined') {
    window.VehicleMapper = {
        normalizeVerificationStatus,
        safeDateIso,
        mapVehicleToApplication
    };
}
