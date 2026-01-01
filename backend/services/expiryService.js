// TrustChain - Certificate Expiry Notification Service
const db = require('../database/db');
const dbServices = require('../database/services');
const { sendMail } = require('./gmailApiService');

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
    
    const urgencyColors = {
        '30d': '#667eea',
        '7d': '#f39c12',
        '1d': '#e74c3c'
    };
    
    const ownerName = `${vehicle.first_name || ''} ${vehicle.last_name || ''}`.trim() || vehicle.owner_email || 'Vehicle Owner';
    const urgencyLabel = urgencyLabels[notificationType];
    const urgencyColor = urgencyColors[notificationType];
    const expiryDate = new Date(vehicle.registration_expiry_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const appUrl = process.env.APP_BASE_URL || 'https://ltoblockchain.duckdns.org';
    
    const title = `${urgencyLabel}: Vehicle Registration Expiring`;
    const subject = `${urgencyLabel}: Vehicle Registration Expiring - TrustChain LTO`;
    
    // Plain text email
    const text = `
Dear ${ownerName},

${urgencyLabel === 'URGENT' ? '⚠️ URGENT: ' : ''}Your vehicle registration will expire in ${daysUntilExpiry} day(s).

Vehicle Details:
- Plate Number: ${vehicle.plate_number || vehicle.vin}
- VIN: ${vehicle.vin}
- Expiry Date: ${expiryDate}
- Days Remaining: ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}

Please renew your registration before the expiry date to avoid penalties and ensure your vehicle remains legally registered.

You can renew your registration by logging into your TrustChain account at ${appUrl}.

${urgencyLabel === 'URGENT' ? '\n⚠️ ACTION REQUIRED: Your registration expires very soon. Please renew immediately to avoid penalties.\n' : ''}

Thank you for using TrustChain LTO System.

Best regards,
LTO Lipa City Team
    `.trim();
    
    // HTML email
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid ${urgencyColor};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: ${urgencyColor};
            margin: 0;
            font-size: 24px;
        }
        ${urgencyLabel === 'URGENT' ? `
        .urgent-banner {
            background-color: #fff3cd;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            text-align: center;
        }
        .urgent-banner strong {
            color: #e74c3c;
            font-size: 18px;
        }
        ` : ''}
        .content {
            margin-bottom: 30px;
        }
        .vehicle-details {
            background-color: #f8f9fa;
            border-left: 4px solid ${urgencyColor};
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .vehicle-details p {
            margin: 8px 0;
            font-size: 14px;
        }
        .vehicle-details strong {
            color: ${urgencyColor};
        }
        .expiry-warning {
            background-color: ${urgencyLabel === 'URGENT' ? '#ffebee' : urgencyLabel === 'Important' ? '#fff3e0' : '#e8f5e9'};
            border: 2px solid ${urgencyColor};
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            text-align: center;
        }
        .expiry-warning h2 {
            color: ${urgencyColor};
            margin: 0 0 10px 0;
            font-size: 20px;
        }
        .expiry-warning .days-count {
            font-size: 32px;
            font-weight: bold;
            color: ${urgencyColor};
            margin: 10px 0;
        }
        .footer {
            text-align: center;
            color: #666666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: ${urgencyColor};
            color: #ffffff;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: 600;
        }
        .button:hover {
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>${urgencyLabel}: Registration Expiring</h1>
        </div>
        <div class="content">
            <p>Dear ${ownerName},</p>
            
            ${urgencyLabel === 'URGENT' ? `
            <div class="urgent-banner">
                <strong>⚠️ URGENT ACTION REQUIRED</strong>
            </div>
            ` : ''}
            
            <p>Your vehicle registration will expire in ${daysUntilExpiry} day(s).</p>
            
            <div class="expiry-warning">
                <h2>Expiry Date</h2>
                <div class="days-count">${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'Day' : 'Days'}</div>
                <p style="margin: 0;">Remaining until ${expiryDate}</p>
            </div>
            
            <div class="vehicle-details">
                <p><strong>Plate Number:</strong> ${vehicle.plate_number || vehicle.vin}</p>
                <p><strong>VIN:</strong> ${vehicle.vin}</p>
                <p><strong>Expiry Date:</strong> ${expiryDate}</p>
            </div>
            
            <p>Please renew your registration before the expiry date to avoid penalties and ensure your vehicle remains legally registered.</p>
            
            ${urgencyLabel === 'URGENT' ? `
            <p style="color: #e74c3c; font-weight: bold; text-align: center;">
                ⚠️ ACTION REQUIRED: Your registration expires very soon. Please renew immediately to avoid penalties.
            </p>
            ` : ''}
            
            <p style="text-align: center;">
                <a href="${appUrl}" class="button">Renew Registration Now</a>
            </p>
            
            <p>You can track and manage your vehicle registrations by logging into your TrustChain account.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>LTO Lipa City Team</p>
            <p style="margin-top: 10px; font-size: 11px; color: #999;">
                This is an automated notification. Please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
    
    let emailSent = false;
    let emailError = null;
    
    // Send email via Gmail API
    try {
        await sendMail({ 
            to: vehicle.owner_email, 
            subject, 
            text, 
            html 
        });
        emailSent = true;
        console.log(`[ExpiryService] ✅ Email sent via Gmail API for vehicle ${vehicle.plate_number || vehicle.vin} (${notificationType})`);
    } catch (error) {
        emailError = error.message;
        console.error(`[ExpiryService] ❌ Failed to send email via Gmail API for vehicle ${vehicle.plate_number || vehicle.vin}:`, error.message);
        // Continue with in-app notification even if email fails
    }
    
    // Create in-app notification
    try {
        await dbServices.createNotification({
            userId: vehicle.owner_id,
            title: title,
            message: `Your vehicle registration for ${vehicle.plate_number || vehicle.vin} will expire in ${daysUntilExpiry} day(s) on ${expiryDate}. Please renew your registration to avoid penalties.`,
            type: daysUntilExpiry <= 1 ? 'warning' : 'info'
        });
    } catch (notifError) {
        console.error(`[ExpiryService] ⚠️ Failed to create in-app notification:`, notifError.message);
    }
    
    // Log notification sent
    try {
        await db.query(
            `INSERT INTO expiry_notifications (vehicle_id, user_id, notification_type, email_sent, sent_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [vehicle.id, vehicle.owner_id, `registration_${notificationType}`, emailSent]
        );
    } catch (logError) {
        console.error(`[ExpiryService] ⚠️ Failed to log notification:`, logError.message);
    }
    
    if (emailError) {
        // Don't throw - in-app notification was created successfully
        console.warn(`[ExpiryService] ⚠️ Notification sent but email failed: ${emailError}`);
    } else {
        console.log(`[ExpiryService] ✅ Sent ${notificationType} notification (email + in-app) for vehicle ${vehicle.plate_number || vehicle.vin}`);
    }
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

