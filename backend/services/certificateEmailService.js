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
        throw new Error('Emission certificate emails have been removed from this system.');
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

    /**
     * Send CSR Certificate via Email
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async sendCsrCertificate({ to, dealerName, csrNumber, vehicleVIN, vehicleMake, vehicleModel, pdfBuffer }) {
        const subject = `Certificate of Stock Reported (CSR) - ${csrNumber}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f5f7fa;
            padding: 30px 20px;
            border-left: 4px solid #8B4513;
            border-right: 4px solid #8B4513;
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
            border-left: 4px solid #8B4513;
        }
        .info-label {
            font-weight: bold;
            color: #8B4513;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Certificate of Stock Reported (CSR)</h1>
            <p>Vehicle Stock Report Certificate</p>
        </div>
        
        <div class="content">
            <p>Dear ${dealerName},</p>
            
            <p>Your Certificate of Stock Reported has been successfully issued. This document certifies that the vehicle described below has been duly reported as stock to the Land Transportation Office.</p>
            
            <div class="info-box">
                <p><span class="info-label">CSR Number:</span> ${csrNumber}</p>
                <p><span class="info-label">Vehicle Make:</span> ${vehicleMake}</p>
                <p><span class="info-label">Vehicle Model:</span> ${vehicleModel}</p>
                <p><span class="info-label">VIN/Chassis:</span> ${vehicleVIN}</p>
                <p><span class="info-label">Issue Date:</span> ${new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</p>
            </div>
            
            <p><strong>Important:</strong> This CSR is required for initial vehicle registration with the LTO.</p>
        </div>
        
        <div class="footer">
            <p>Land Transportation Office</p>
            <p style="font-size: 0.85em; opacity: 0.8;">This is an automated email.</p>
        </div>
    </div>
</body>
</html>
        `;

        const text = `Certificate of Stock Reported\n\nDear ${dealerName},\n\nYour CSR has been issued.\n\nCSR: ${csrNumber}\nVehicle: ${vehicleMake} ${vehicleModel}\nVIN: ${vehicleVIN}\nIssue Date: ${new Date().toLocaleDateString()}`;

        return await gmailApiService.sendMail({
            to,
            subject,
            text,
            html,
            attachments: [{
                filename: `CSR_${csrNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });
    }

    /**
     * Send Sales Invoice via Email
     * @param {Object} params
     * @param {string} params.to - Recipient email
     * @param {string} params.ownerName - Owner/Buyer name
     * @param {string} params.invoiceNumber - Invoice number
     * @param {string} params.vehicleVIN - Vehicle VIN
     * @param {string} params.vehicleMake - Vehicle make
     * @param {string} params.vehicleModel - Vehicle model
     * @param {Buffer} params.pdfBuffer - PDF invoice buffer
     * @returns {Promise<Object>} - Gmail API response
     */
    async sendSalesInvoice({ to, ownerName, invoiceNumber, vehicleVIN, vehicleMake, vehicleModel, pdfBuffer }) {
        const subject = `Sales Invoice - Invoice ${invoiceNumber}`;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f5f7fa;
            padding: 30px 20px;
            border-left: 4px solid #1e40af;
            border-right: 4px solid #1e40af;
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
            border-left: 4px solid #1e40af;
        }
        .info-label { font-weight: bold; color: #1e3a8a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 Sales Invoice Issued</h1>
            <p>Your vehicle sales invoice is ready</p>
        </div>
        
        <div class="content">
            <p>Dear ${ownerName},</p>
            
            <p>Your sales invoice has been successfully issued. Please find the invoice attached to this email.</p>
            
            <div class="info-box">
                <p><span class="info-label">Invoice Number:</span> ${invoiceNumber}</p>
                <p><span class="info-label">Vehicle:</span> ${vehicleMake} ${vehicleModel}</p>
                <p><span class="info-label">VIN:</span> ${vehicleVIN}</p>
            </div>
            
            <p><strong>Important:</strong> This sales invoice is required for vehicle registration with LTO.</p>
            
            <p>Please keep this document safe as it serves as proof of purchase and ownership transfer.</p>
        </div>
        
        <div class="footer">
            <p>LTO Certificate Generation System</p>
            <p style="font-size: 0.85em; opacity: 0.8;">This is an automated email.</p>
        </div>
    </div>
</body>
</html>
        `;

        const text = `Sales Invoice\n\nDear ${ownerName},\n\nYour sales invoice has been issued.\n\nInvoice: ${invoiceNumber}\nVehicle: ${vehicleMake} ${vehicleModel}\nVIN: ${vehicleVIN}`;

        return await gmailApiService.sendMail({
            to,
            subject,
            text,
            html,
            attachments: [{
                filename: `Sales_Invoice_${invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });
    }

    /**
     * Send Transfer Compliance Documents via Email
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async sendTransferComplianceDocuments({ to, recipientType, documents, transferRequestId, vehicle }) {
        const subject = `Transfer Compliance Documents - ${recipientType === 'seller' ? 'Deed of Sale & Seller ID' : 'Buyer Requirements'}`;
        
        const recipientLabel = recipientType === 'seller' ? 'Seller' : 'Buyer';
        const documentList = documents.map(doc => {
            const docTypeMap = {
                'deed_of_sale': 'Deed of Sale',
                'seller_id': 'Seller ID',
                'buyer_id': 'Buyer ID',
                'buyer_tin': 'TIN Document',
                'buyer_hpg_clearance': 'HPG Clearance',
                'buyer_ctpl': 'CTPL Insurance',
                'buyer_mvir': 'MVIR'
            };
            return docTypeMap[doc.type] || doc.type;
        }).join(', ');

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #1e4b7a 0%, #2196F3 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .info-box {
            background: white;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-label {
            font-weight: bold;
            color: #1e4b7a;
            display: inline-block;
            min-width: 150px;
        }
        .documents-list {
            background: white;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        .documents-list ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .documents-list li {
            margin: 8px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }
        .button {
            display: inline-block;
            background: #2196F3;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 Transfer Compliance Documents</h1>
        <p>Your documents are ready for download</p>
    </div>
    <div class="content">
        <p>Dear ${recipientLabel},</p>
        
        <p>Your transfer compliance documents have been generated. Please download and upload these documents when ${recipientType === 'seller' ? 'submitting your transfer request' : 'accepting the transfer request'}.</p>
        
        <div class="info-box">
            <p><span class="info-label">Transfer Request ID:</span> ${transferRequestId || 'N/A'}</p>
            ${vehicle ? `<p><span class="info-label">Vehicle:</span> ${vehicle.plate_number || vehicle.vin} - ${vehicle.make} ${vehicle.model} (${vehicle.year})</p>` : ''}
        </div>
        
        <div class="documents-list">
            <h3>📎 Attached Documents:</h3>
            <ul>
                ${documents.map(doc => `<li>${doc.filename || doc.type}</li>`).join('')}
            </ul>
        </div>
        
        <p><strong>Important:</strong> These documents are required for the transfer of ownership process. Please keep them safe and upload them to the system when prompted.</p>
        
        <p>If you have any questions, please contact the LTO support team.</p>
    </div>
    
    <div class="footer">
        <p>LTO Transfer of Ownership System</p>
        <p style="font-size: 0.85em; opacity: 0.8;">This is an automated email.</p>
    </div>
</body>
</html>
        `;

        const text = `Transfer Compliance Documents\n\nDear ${recipientLabel},\n\nYour transfer compliance documents have been generated.\n\nDocuments: ${documentList}\nTransfer Request: ${transferRequestId || 'N/A'}\n\nPlease download and upload these documents when ${recipientType === 'seller' ? 'submitting your transfer request' : 'accepting the transfer request'}.\n\nLTO Transfer of Ownership System`;

        // Prepare attachments
        const attachments = documents.map(doc => ({
            filename: doc.filename || `${doc.type}.pdf`,
            content: doc.pdfBuffer,
            contentType: 'application/pdf'
        }));

        return await gmailApiService.sendMail({
            to,
            subject,
            text,
            html,
            attachments
        });
    }
}

module.exports = new CertificateEmailService();
