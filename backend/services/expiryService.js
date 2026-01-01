// TrustChain - Certificate Expiry Notification Service
const db = require('../database/db');
const dbServices = require('../database/services');

const NOTIFICATION_WINDOWS = {
    '30d': 30,
    '7d': 7,
    '1d': 1
};

async function checkExpiringRegistrations() {
    console.log('[ExpiryService] Checking for expiring registrations...');
    
    const results = {
        checked: 0,
        notificationsSent: 0,
        errors: []
    };
    
    try {
        // Find vehicles with registration expiring in the next 30 days
        const query = `
            SELECT v.id, v.vin, v.plate_number, v.registration_expiry_date,
                   v.expiry_notified_30d, v.expiry_notified_7d, v.expiry_notified_1d,
                   u.id as owner_id, u.email as owner_email, u.first_name, u.last_name
            FROM vehicles v
            JOIN users u ON v.owner_id = u.id
            WHERE v.registration_expiry_date IS NOT NULL
            AND v.registration_expiry_date > NOW()
            AND v.registration_expiry_date <= NOW() + INTERVAL '30 days'
            AND v.status = 'REGISTERED'
        `;
        
        const result = await db.query(query);
        results.checked = result.rows.length;
        
        for (const vehicle of result.rows) {
            const daysUntilExpiry = Math.ceil(
                (new Date(vehicle.registration_expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
            );
            
            let notificationType = null;
            let shouldNotify = false;
            
            // Determine notification type
            if (daysUntilExpiry <= 1 && !vehicle.expiry_notified_1d) {
                notificationType = '1d';
                shouldNotify = true;
            } else if (daysUntilExpiry <= 7 && !vehicle.expiry_notified_7d) {
                notificationType = '7d';
                shouldNotify = true;
            } else if (daysUntilExpiry <= 30 && !vehicle.expiry_notified_30d) {
                notificationType = '30d';
                shouldNotify = true;
            }
            
            if (shouldNotify && notificationType) {
                try {
                    await sendExpiryNotification(vehicle, notificationType, daysUntilExpiry);
                    await markNotificationSent(vehicle.id, notificationType);
                    results.notificationsSent++;
                } catch (err) {
                    results.errors.push({ vehicleId: vehicle.id, error: err.message });
                }
            }
        }
        
    } catch (error) {
        console.error('[ExpiryService] Error checking expirations:', error);
        results.errors.push({ error: error.message });
    }
    
    console.log(`[ExpiryService] Checked ${results.checked} vehicles, sent ${results.notificationsSent} notifications`);
    return results;
}

async function sendExpiryNotification(vehicle, notificationType, daysUntilExpiry) {
    const urgencyLabels = {
        '30d': 'Reminder',
        '7d': 'Important',
        '1d': 'URGENT'
    };
    
    const title = `${urgencyLabels[notificationType]}: Vehicle Registration Expiring`;
    const message = `Your vehicle registration for ${vehicle.plate_number || vehicle.vin} will expire in ${daysUntilExpiry} day(s) on ${new Date(vehicle.registration_expiry_date).toLocaleDateString()}. Please renew your registration to avoid penalties.`;
    
    // Create in-app notification
    await dbServices.createNotification({
        userId: vehicle.owner_id,
        title: title,
        message: message,
        type: daysUntilExpiry <= 1 ? 'warning' : 'info'
    });
    
    // Log notification sent
    await db.query(
        `INSERT INTO expiry_notifications (vehicle_id, user_id, notification_type, email_sent)
         VALUES ($1, $2, $3, $4)`,
        [vehicle.id, vehicle.owner_id, `registration_${notificationType}`, false]
    );
    
    console.log(`[ExpiryService] Sent ${notificationType} notification for vehicle ${vehicle.plate_number}`);
}

async function markNotificationSent(vehicleId, notificationType) {
    const column = `expiry_notified_${notificationType.replace('d', '')}d`;
    await db.query(
        `UPDATE vehicles SET ${column} = TRUE WHERE id = $1`,
        [vehicleId]
    );
}

// Set registration expiry (1 year from registration)
async function setRegistrationExpiry(vehicleId, registrationDate) {
    const expiryDate = new Date(registrationDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    
    await db.query(
        `UPDATE vehicles 
         SET registration_expiry_date = $1,
             expiry_notified_30d = FALSE,
             expiry_notified_7d = FALSE,
             expiry_notified_1d = FALSE
         WHERE id = $2`,
        [expiryDate, vehicleId]
    );
    
    console.log(`[ExpiryService] Set expiry date ${expiryDate.toISOString()} for vehicle ${vehicleId}`);
}

module.exports = {
    checkExpiringRegistrations,
    setRegistrationExpiry
};

