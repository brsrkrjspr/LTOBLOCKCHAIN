/**
 * Certificate Email Service
 * Sends certificate PDFs via email using Gmail API
 */

const gmailApiService = require('./gmailApiService');

class CertificateEmailService {
    /**
     * Send Insurance Certificate via Email
     * @param {Object} params
     * @param {string} params.to - Recipient email
     * @param {string} params.ownerName - Owner name
     * @param {string} params.policyNumber - Policy number
     * @param {string} params.vehicleVIN - Vehicle VIN
     * @param {Buffer} params.pdfBuffer - PDF certificate buffer
     * @param {Date} params.expiryDate - Certificate expiry date
     * @returns {Promise<Object>} - Gmail API response
     */
    async sendInsuranceCertificate({ to, ownerName, policyNumber, vehicleVIN, pdfBuffer, expiryDate }) {
        const subject = `Insurance Certificate - Policy ${policyNumber}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f5f7fa;
            padding: 30px 20px;
            border-left: 4px solid #0066cc;
            border-right: 4px solid #0066cc;
        }
        .footer {
            background: #14171a;
            color: #fff;
            padding: 20px;
            text-align: center;
            border-radius: 0 0 8px 8px;
            font-size: 0.9em;
        }
        .info-box {
            background: white;
            padding: 15px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #00a8a8;
        }
        .info-label {
            font-weight: bold;
            color: #0066cc;
        }
        .alert-box {
            background: #fff3cd;
            border: 1px solid #ffeb3b;
            padding: 15px;
            margin: 15px 0;
            border-radius: 8px;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #00b894 0%, #009975 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Insurance Certificate Issued</h1>
            <p>Your vehicle insurance certificate is ready</p>
        </div>
        
        <div class="content">
            <p>Dear ${ownerName},</p>
            
            <p>Your insurance certificate has been successfully issued. Please find the certificate attached to this email.</p>
            
            <div class="info-box">
                <p><span class="info-label">Policy Number:</span> ${policyNumber}</p>
                <p><span class="info-label">Vehicle VIN:</span> ${vehicleVIN}</p>
                <p><span class="info-label">Expiry Date:</span> ${new Date(expiryDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</p>
            </div>
            
            <div class="alert-box">
                <strong>📋 Next Steps:</strong>
                <ol>
                    <li>Download the attached PDF certificate</li>
                    <li>Keep a copy for your records</li>
                    <li>Upload this certificate to LTO when registering your vehicle</li>
                </ol>
            </div>
            
            <p><strong>Important:</strong> This certificate is required for vehicle registration with the Land Transportation Office (LTO).</p>
        </div>
        
        <div class="footer">
            <p>Land Transportation Office - Blockchain Vehicle Registration System</p>
            <p style="font-size: 0.85em; margin-top: 10px; opacity: 0.8;">
                This is an automated email. Please do not reply to this message.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        const text = `
Insurance Certificate Issued

Dear ${ownerName},

Your insurance certificate has been successfully issued. Please find the certificate attached to this email.

Policy Number: ${policyNumber}
Vehicle VIN: ${vehicleVIN}
Expiry Date: ${new Date(expiryDate).toLocaleDateString()}

Next Steps:
1. Download the attached PDF certificate
2. Keep a copy for your records
3. Upload this certificate to LTO when registering your vehicle

Important: This certificate is required for vehicle registration with the Land Transportation Office (LTO).

---
Land Transportation Office - Blockchain Vehicle Registration System
This is an automated email. Please do not reply to this message.
        `;

        return await gmailApiService.sendMail({
            to,
            subject,
            text,
            html,
            attachments: [{
                filename: `Insurance_Certificate_${policyNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });
    }

    /**
     * Send Emission Certificate via Email
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async sendEmissionCertificate({ to, ownerName, certificateNumber, vehicleVIN, pdfBuffer, expiryDate }) {
        const subject = `Emission Test Certificate - ${certificateNumber}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #00b894 0%, #009975 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f5f7fa;
            padding: 30px 20px;
            border-left: 4px solid #00b894;
            border-right: 4px solid #00b894;
        }
        .footer {
            background: #14171a;
            color: #fff;
            padding: 20px;
            text-align: center;
            border-radius: 0 0 8px 8px;
            font-size: 0.9em;
        }
        .info-box {
            background: white;
            padding: 15px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #00d4a8;
        }
        .info-label { font-weight: bold; color: #00b894; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌱 Emission Test Certificate</h1>
            <p>Your vehicle has passed emission testing</p>
        </div>
        
        <div class="content">
            <p>Dear ${ownerName},</p>
            
            <p>Your vehicle has successfully passed the emission test. Please find the certificate attached.</p>
            
            <div class="info-box">
                <p><span class="info-label">Certificate Number:</span> ${certificateNumber}</p>
                <p><span class="info-label">Vehicle VIN:</span> ${vehicleVIN}</p>
                <p><span class="info-label">Valid Until:</span> ${new Date(expiryDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</p>
            </div>
            
            <p><strong>Important:</strong> Upload this certificate to LTO for vehicle registration.</p>
        </div>
        
        <div class="footer">
            <p>LTO Emission Testing Center</p>
            <p style="font-size: 0.85em; opacity: 0.8;">This is an automated email.</p>
        </div>
    </div>
</body>
</html>
        `;

        const text = `Emission Test Certificate\n\nDear ${ownerName},\n\nYour vehicle has successfully passed the emission test.\n\nCertificate: ${certificateNumber}\nVIN: ${vehicleVIN}\nValid Until: ${new Date(expiryDate).toLocaleDateString()}`;

        return await gmailApiService.sendMail({
            to,
            subject,
            text,
            html,
            attachments: [{
                filename: `Emission_Certificate_${certificateNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });
    }

    /**
     * Send HPG Clearance via Email
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async sendHpgClearance({ to, ownerName, clearanceNumber, vehicleVIN, pdfBuffer }) {
        const subject = `HPG Clearance Certificate - ${clearanceNumber}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f5f7fa;
            padding: 30px 20px;
            border-left: 4px solid #1e3a8a;
            border-right: 4px solid #1e3a8a;
        }
        .footer {
            background: #14171a;
            color: #fff;
            padding: 20px;
            text-align: center;
            border-radius: 0 0 8px 8px;
            font-size: 0.9em;
        }
        .info-box {
            background: white;
            padding: 15px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #3730a3;
        }
        .info-label { font-weight: bold; color: #1e3a8a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚔 HPG Clearance Certificate</h1>
            <p>PNP Highway Patrol Group Clearance</p>
        </div>
        
        <div class="content">
            <p>Dear ${ownerName},</p>
            
            <p>Your HPG clearance has been issued. Please find the certificate attached.</p>
            
            <div class="info-box">
                <p><span class="info-label">Clearance Number:</span> ${clearanceNumber}</p>
                <p><span class="info-label">Vehicle VIN:</span> ${vehicleVIN}</p>
                <p><span class="info-label">Issue Date:</span> ${new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</p>
            </div>
            
            <p><strong>Important:</strong> This clearance is required for LTO vehicle registration.</p>
        </div>
        
        <div class="footer">
            <p>PNP Highway Patrol Group</p>
            <p style="font-size: 0.85em; opacity: 0.8;">This is an automated email.</p>
        </div>
    </div>
</body>
</html>
        `;

        const text = `HPG Clearance Certificate\n\nDear ${ownerName},\n\nYour HPG clearance has been issued.\n\nClearance: ${clearanceNumber}\nVIN: ${vehicleVIN}\nIssue Date: ${new Date().toLocaleDateString()}`;

        return await gmailApiService.sendMail({
            to,
            subject,
            text,
            html,
            attachments: [{
                filename: `HPG_Clearance_${clearanceNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });
    }
}

module.exports = new CertificateEmailService();
