// Certificate Generator - Client-Side PDF using Browser APIs
// No external libraries required

const CertificateGenerator = {
    /**
     * Generate and download a registration certificate
     * Uses HTML-to-Canvas approach with browser print
     */
    async generateCertificate(vehicleData, ownerData) {
        console.log('=== CERTIFICATE GENERATOR START ===');
        console.log('Vehicle Data:', JSON.stringify(vehicleData, null, 2));
        console.log('Owner Data:', JSON.stringify(ownerData, null, 2));
        
        try {
            // Validate input
            if (!vehicleData) {
                console.error('ERROR: vehicleData is null or undefined');
                throw new Error('Vehicle data is required');
            }
            
            // Create certificate HTML
            console.log('Creating certificate HTML...');
            const certificateHtml = this.createCertificateHtml(vehicleData, ownerData);
            console.log('Certificate HTML created, length:', certificateHtml.length);
            
            // Try to open print window
            console.log('Attempting to open print window...');
            const printWindow = window.open('', '_blank', 'width=800,height=1000');
            
            // Check if popup was blocked
            if (!printWindow) {
                console.error('ERROR: window.open returned null - popup blocked!');
                console.log('Falling back to HTML file download...');
                this.downloadAsHtmlFile(certificateHtml, vehicleData.or_cr_number || vehicleData.orCrNumber || vehicleData.plate_number || vehicleData.id);
                return { success: true, method: 'download' };
            }
            
            if (printWindow.closed) {
                console.error('ERROR: Print window was immediately closed');
                this.downloadAsHtmlFile(certificateHtml, vehicleData.or_cr_number || vehicleData.orCrNumber || vehicleData.plate_number || vehicleData.id);
                return { success: true, method: 'download' };
            }
            
            console.log('Print window opened successfully');
            
            // Write content to window
            console.log('Writing HTML to print window...');
            printWindow.document.write(certificateHtml);
            printWindow.document.close();
            console.log('HTML written and document closed');
            
            // Wait for content to load, then trigger print
            printWindow.onload = function() {
                console.log('Print window loaded, triggering print dialog in 500ms...');
                setTimeout(() => {
                    console.log('Triggering print...');
                    printWindow.print();
                    console.log('Print dialog should be open now');
                }, 500);
            };
            
            // Also try immediate print as fallback
            setTimeout(() => {
                if (printWindow && !printWindow.closed) {
                    console.log('Fallback: Triggering print after 1 second...');
                    try {
                        printWindow.print();
                    } catch (e) {
                        console.error('Fallback print failed:', e);
                    }
                }
            }, 1000);
            
            console.log('=== CERTIFICATE GENERATOR SUCCESS ===');
            return { success: true, method: 'print' };
            
        } catch (error) {
            console.error('=== CERTIFICATE GENERATOR ERROR ===');
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);
            throw error;
        }
    },

    // Fallback: Download as HTML file that user can open and print
    downloadAsHtmlFile(htmlContent, filename) {
        console.log('downloadAsHtmlFile called with filename:', filename);
        try {
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            console.log('Blob URL created:', url);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `LTO_Certificate_${filename || 'unknown'}.html`;
            console.log('Download filename:', a.download);
            
            document.body.appendChild(a);
            console.log('Clicking download link...');
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('HTML file download initiated');
        } catch (error) {
            console.error('downloadAsHtmlFile ERROR:', error);
            // Last resort: Create a data URL and open it
            const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
            window.open(dataUrl, '_blank');
        }
    },

    createCertificateHtml(vehicle, owner) {
        console.log('createCertificateHtml called');
        
        const orCrNumber = vehicle.or_cr_number || vehicle.orCrNumber || 'NOT ASSIGNED';
        const regDate = vehicle.registration_date || vehicle.approved_at || vehicle.created_at;
        const regDateFormatted = regDate ?  
            new Date(regDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }) : 'N/A';
        
        const ownerName = owner ?  
            `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email || 'N/A'
            : 'N/A';
        
        const verificationUrl = `${window.location.origin}/verify/${vehicle.blockchain_tx_id || vehicle.id}`;
        
        console.log('Certificate data:', {
            orCrNumber,
            regDateFormatted,
            ownerName,
            plateNumber: vehicle.plate_number || vehicle.plateNumber
        });

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LTO Registration Certificate - ${orCrNumber}</title>
    <style>
        @page { size: letter; margin: 0.5in; }
        @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: white; }
        .certificate { max-width: 700px; margin: 0 auto; border: 3px solid #1a5276; padding: 30px; }
        .header { text-align: center; border-bottom: 2px solid #1a5276; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #1a5276; font-size: 14px; margin-bottom: 5px; }
        .header h2 { color: #1a5276; font-size: 20px; margin-bottom: 5px; }
        .header h3 { font-size: 10px; color: #666; }
        .title { text-align: center; margin: 20px 0; }
        .title h1 { color: #1a5276; font-size: 24px; letter-spacing: 2px; }
        .orcr-number { text-align: center; font-size: 20px; font-weight: bold; margin: 15px 0; padding: 10px; background: #e8f4f8; border-radius: 8px; }
        .section { margin: 20px 0; }
        .section-title { font-weight: bold; color: #1a5276; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 8px; font-size: 12px; }
        .info-label { font-weight: 600; color: #555; }
        .info-value { color: #333; }
        .qr-section { text-align: center; margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
        .qr-placeholder { width: 100px; height: 100px; border: 2px dashed #1a5276; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #666; }
        .verification-text { font-size: 10px; color: #666; }
        .blockchain-badge { background: #1a5276; color: white; padding: 5px 15px; border-radius: 20px; font-size: 10px; display: inline-block; margin-top: 10px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 10px; color: #888; }
        .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #1a5276; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
        .print-btn:hover { background: #2980b9; }
        @media print { .print-btn { display: none; } }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            <h1>Republic of the Philippines</h1>
            <h2>LAND TRANSPORTATION OFFICE</h2>
            <h3>TrustChain Vehicle Registration System</h3>
        </div>
        
        <div class="title">
            <h1>CERTIFICATE OF REGISTRATION</h1>
        </div>
        
        <div class="orcr-number">OR/CR Number: ${this.escapeHtml(orCrNumber)}</div>
        
        <div class="section">
            <div class="section-title">VEHICLE INFORMATION</div>
            <div class="info-grid">
                <span class="info-label">Plate Number:</span>
                <span class="info-value">${this.escapeHtml(vehicle.plate_number || vehicle.plateNumber || 'N/A')}</span>
                <span class="info-label">VIN/Chassis:</span>
                <span class="info-value">${this.escapeHtml(vehicle.vin || 'N/A')}</span>
                <span class="info-label">Engine Number:</span>
                <span class="info-value">${this.escapeHtml(vehicle.engine_number || vehicle.engineNumber || 'N/A')}</span>
                <span class="info-label">Make:</span>
                <span class="info-value">${this.escapeHtml(vehicle.make || 'N/A')}</span>
                <span class="info-label">Model:</span>
                <span class="info-value">${this.escapeHtml(vehicle.model || 'N/A')}</span>
                <span class="info-label">Year:</span>
                <span class="info-value">${this.escapeHtml(vehicle.year || 'N/A')}</span>
                <span class="info-label">Color:</span>
                <span class="info-value">${this.escapeHtml(vehicle.color || 'N/A')}</span>
                <span class="info-label">Vehicle Type:</span>
                <span class="info-value">${this.escapeHtml(vehicle.vehicle_type || vehicle.vehicleType || 'N/A')}</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">REGISTERED OWNER</div>
            <div class="info-grid">
                <span class="info-label">Name:</span>
                <span class="info-value">${this.escapeHtml(ownerName)}</span>
                <span class="info-label">Email:</span>
                <span class="info-value">${this.escapeHtml(owner.email || 'N/A')}</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">REGISTRATION DETAILS</div>
            <div class="info-grid">
                <span class="info-label">Registration Date:</span>
                <span class="info-value">${regDateFormatted}</span>
                <span class="info-label">Status:</span>
                <span class="info-value">${this.escapeHtml(vehicle.status || 'REGISTERED')}</span>
            </div>
        </div>
        
        <div class="qr-section">
            <div class="qr-placeholder">QR Code</div>
            <div class="verification-text">Scan to verify on blockchain</div>
            <div class="verification-text" style="word-break: break-all; font-size: 8px;">${verificationUrl}</div>
            <div class="blockchain-badge">✓ BLOCKCHAIN VERIFIED</div>
        </div>
        
        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>This is a computer-generated document. The blockchain record serves as the official verification.</p>
            ${vehicle.blockchain_tx_id ? `<p style="font-size: 8px;">TX: ${vehicle.blockchain_tx_id}</p>` : ''}
        </div>
    </div>
    
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
</body>
</html>
        `;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make globally available
window.CertificateGenerator = CertificateGenerator;
console.log('CertificateGenerator loaded and available globally');

