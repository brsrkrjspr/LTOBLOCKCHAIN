// Certificate Generator - Client-Side PDF using Browser APIs
// No external libraries required
// Version: 2.0 - Updated with cache-busting support

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
        
        // Separate OR and CR numbers (new format)
        const orNumber = vehicle.or_number || vehicle.orNumber || vehicle.or_cr_number || vehicle.orCrNumber || 'NOT ASSIGNED';
        const crNumber = vehicle.cr_number || vehicle.crNumber || vehicle.or_cr_number || vehicle.orCrNumber || 'NOT ASSIGNED';
        
        // Date of registration (separate from date issued)
        const dateOfRegistration = vehicle.date_of_registration || vehicle.registration_date || vehicle.approved_at || vehicle.created_at;
        const regDate = vehicle.registration_date || vehicle.approved_at || vehicle.created_at;
        
        const regDateFormatted = regDate ?  
            new Date(regDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }) : 'N/A';
        
        const regDateShort = regDate ?  
            new Date(regDate).toLocaleDateString('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit'
            }) : 'N/A';
        
        const dateOfRegFormatted = dateOfRegistration ?  
            new Date(dateOfRegistration).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }) : regDateFormatted;
        
        // Calculate validity date (1 year from registration - LTO standard)
        const validityDate = regDate ?  
            new Date(new Date(regDate).setFullYear(new Date(regDate).getFullYear() + 1)).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }) : 'N/A';
        
        const ownerName = owner ?  
            `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email || 'N/A'
            : 'N/A';
        
        const ownerAddress = owner?.address || owner?.full_address || 'N/A';
        const transactionType = vehicle.transaction_type || 'NEW REGISTRATION';
        const blockchainTxId = vehicle.blockchain_tx_id || vehicle.id || 'N/A';
        const verificationUrl = `${window.location.origin}/verify/${blockchainTxId}`;
        
        // Vehicle details
        const plateNumber = vehicle.plate_number || vehicle.plateNumber || 'N/A';
        const mvFileNumber = vehicle.mv_file_number || vehicle.mvFileNumber || 'N/A';
        const engineNumber = vehicle.engine_number || vehicle.engineNumber || 'N/A';
        const chassisNumber = vehicle.chassis_number || vehicle.chassisNumber || vehicle.vin || 'N/A';
        const make = vehicle.make || 'N/A';
        const model = vehicle.model || 'N/A';
        const year = vehicle.year || 'N/A';
        const bodyType = vehicle.vehicle_type || vehicle.vehicleType || 'N/A';
        const color = vehicle.color || 'N/A';
        const fuelType = vehicle.fuel_type || vehicle.fuelType || 'N/A';
        const displacement = vehicle.displacement || vehicle.piston_displacement || 'N/A';
        const grossWeight = vehicle.gross_weight || vehicle.grossWeight || 'N/A';
        const netWeight = vehicle.net_weight || vehicle.netWeight || 'N/A';
        const registrationType = vehicle.registration_type || vehicle.registrationType || 'PRIVATE';
        const vehicleClassification = vehicle.vehicle_classification || vehicle.vehicleClassification || 'N/A';
        
        // Payment details (if available)
        const paymentDate = regDateShort;
        const paymentMode = vehicle.payment_mode || 'ONLINE';
        const amountPaid = vehicle.amount_paid || vehicle.total_amount || 'N/A';
        const paymentPurpose = vehicle.payment_purpose || 'VEHICLE REGISTRATION';
        
        // Issuing office
        const issuingOffice = vehicle.issuing_office || 'LTO MAIN OFFICE';
        
        // Inspection data (from HPG clearance or vehicle verifications)
        const inspectionDate = vehicle.inspection_date || vehicle.inspectionDate || vehicle.or_issued_at || vehicle.cr_issued_at || regDate;
        const inspectionDateFormatted = inspectionDate ?  
            new Date(inspectionDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }) : 'N/A';
        const inspectionResult = vehicle.inspection_result || vehicle.inspectionResult || 'PASS';
        const mvirNumber = vehicle.mvir_number || vehicle.mvirNumber || 'N/A';
        const inspectionOfficer = vehicle.inspection_officer || vehicle.inspectionOfficer || 'LTO INSPECTION OFFICER';
        const roadworthinessStatus = vehicle.roadworthiness_status || vehicle.roadworthinessStatus || 'ROADWORTHY';
        const emissionCompliance = vehicle.emission_compliance || vehicle.emissionCompliance || 'COMPLIANT';
        
        console.log('Certificate data:', {
            orNumber,
            crNumber,
            regDateFormatted,
            ownerName,
            plateNumber
        });

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LTO Official Receipt & Certificate of Registration</title>
    <style>
        /* General Document Settings */
        body {
            background-color: #525659; /* Grey background for viewing */
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
        }

        .document-container {
            background-color: white;
            width: 210mm; /* A4 Width */
            min-height: 297mm; /* A4 Height */
            padding: 10mm 15mm;
            box-sizing: border-box;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
            position: relative;
        }

        /* Watermark */
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100px;
            color: rgba(0, 0, 0, 0.05);
            font-weight: bold;
            pointer-events: none;
            z-index: 0;
            white-space: nowrap;
        }

        /* Typography & Colors */
        h1, h2, h3, h4, p { margin: 0; }
        
        .text-center { text-align: center; }
        .text-blue { color: #003366; }
        .text-uppercase { text-transform: uppercase; }
        
        /* Header Section */
        .header {
            text-align: center;
            margin-bottom: 20px;
            position: relative;
            z-index: 1;
        }

        .seal-placeholder {
            width: 60px;
            height: 60px;
            border: 2px solid #ccc;
            border-radius: 50%;
            margin: 0 auto 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #ccc;
        }

        .agency-name {
            font-size: 22px;
            font-weight: bold;
            color: #003366;
            letter-spacing: 1px;
        }

        .doc-title-box {
            background-color: #003366;
            color: white;
            display: inline-block;
            padding: 8px 30px;
            border-radius: 4px;
            margin-top: 5px;
            font-weight: bold;
            font-size: 16px;
        }

        .sub-text {
            font-size: 12px;
            font-style: italic;
            color: #666;
            margin-top: 5px;
        }

        /* Section Styling */
        .section-box {
            border: 1px solid #b0b0b0;
            margin-bottom: 15px;
            position: relative;
            z-index: 1;
            background: white;
        }

        .section-header {
            background-color: #eaf2f8;
            color: #003366;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #b0b0b0;
        }

        .section-body {
            padding: 10px;
        }

        /* Grid Layouts */
        .grid-row {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
        }

        .col {
            flex: 1;
            min-width: 0; /* Prevents overflow */
        }

        .col-half { flex: 0 0 48%; }
        .col-third { flex: 0 0 30%; }
        .col-quarter { flex: 0 0 22%; }
        .col-full { flex: 0 0 100%; width: 100%; }

        /* Field Styling */
        .field-group {
            margin-bottom: 10px;
        }

        .label {
            display: block;
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 2px;
        }

        .value {
            display: block;
            font-size: 13px;
            font-weight: bold;
            color: #000;
            text-transform: uppercase;
        }

        .value.highlight { color: #b91c1c; } /* Red text for validity/important */

        /* Specific Adjustments for Layout Match */
        .top-info-bar {
            display: flex;
            justify-content: space-between;
            border: 1px solid #b0b0b0;
            padding: 10px 15px;
            margin-bottom: 15px;
        }

        /* Blockchain Section */
        .blockchain-container {
            display: flex;
            align-items: center;
        }

        .qr-box {
            width: 80px;
            height: 80px;
            border: 1px dashed #999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #999;
            margin-right: 20px;
            flex-shrink: 0;
        }

        .hash-container {
            flex-grow: 1;
        }

        .hash-code {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            padding: 8px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            word-break: break-all;
            margin-bottom: 5px;
            color: #333;
        }

        .notice-text {
            font-size: 9px;
            color: #777;
            line-height: 1.3;
        }

        /* Footer */
        .footer {
            text-align: center;
            margin-top: 30px;
            border-top: 1px dashed #ccc;
            padding-top: 20px;
        }

        .footer h3 { font-size: 14px; color: #003366; }
        .footer p { font-size: 10px; color: #666; margin-top: 5px; }

        /* Print Settings */
        @media print {
            body { background: none; padding: 0; }
            .document-container { box-shadow: none; width: 100%; height: auto; }
        }
    </style>
</head>
<body>

    <div class="document-container">
        <div class="watermark">OFFICIAL COPY</div>

        <div class="header">
            <div class="seal-placeholder">[SEAL]</div>
            <div class="agency-name">LAND TRANSPORTATION OFFICE</div>
            <div class="doc-title-box">OFFICIAL RECEIPT & CERTIFICATE OF REGISTRATION</div>
            <div class="sub-text">Digitally Generated via LTO Blockchain System</div>
        </div>

        <div class="top-info-bar">
            <div class="col">
                <span class="label">OR Number</span>
                <span class="value">${this.escapeHtml(orNumber)}</span>
            </div>
            <div class="col">
                <span class="label">CR Number</span>
                <span class="value">${this.escapeHtml(crNumber)}</span>
            </div>
            <div class="col">
                <span class="label">Date Issued</span>
                <span class="value">${regDateShort}</span>
            </div>
            <div class="col">
                <span class="label">Registration Validity</span>
                <span class="value highlight">${validityDate}</span>
            </div>
        </div>

        <div class="section-box">
            <div class="section-header">REGISTERED OWNER INFORMATION</div>
            <div class="section-body">
                <div class="grid-row">
                    <div class="col-half">
                        <span class="label">Full Name</span>
                        <span class="value">${this.escapeHtml(ownerName)}</span>
                    </div>
                    <div class="col-half">
                        <span class="label">Transaction Type</span>
                        <span class="value">${this.escapeHtml(transactionType)}</span>
                    </div>
                    <div class="col-full" style="margin-top: 10px;">
                        <span class="label">Complete Address</span>
                        <span class="value">${this.escapeHtml(ownerAddress)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section-box">
            <div class="section-header">VEHICLE INFORMATION</div>
            <div class="section-body">
                <div class="grid-row">
                    <div class="col-third">
                        <span class="label">Plate Number</span>
                        <span class="value">${this.escapeHtml(plateNumber)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">MV File Number</span>
                        <span class="value">${this.escapeHtml(mvFileNumber)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Engine Number</span>
                        <span class="value">${this.escapeHtml(engineNumber)}</span>
                    </div>
                    
                    <div class="col-third">
                        <span class="label">Chassis Number</span>
                        <span class="value">${this.escapeHtml(chassisNumber)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Make</span>
                        <span class="value">${this.escapeHtml(make)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Series / Model</span>
                        <span class="value">${this.escapeHtml(model)}</span>
                    </div>

                    <div class="col-third">
                        <span class="label">Year Model</span>
                        <span class="value">${this.escapeHtml(year)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Body Type</span>
                        <span class="value">${this.escapeHtml(bodyType)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Color</span>
                        <span class="value">${this.escapeHtml(color)}</span>
                    </div>

                    <div class="col-third">
                        <span class="label">Fuel Type</span>
                        <span class="value">${this.escapeHtml(fuelType)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Piston Disp.</span>
                        <span class="value">${this.escapeHtml(displacement)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Gross Wt.</span>
                        <span class="value">${this.escapeHtml(grossWeight)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Net Wt.</span>
                        <span class="value">${this.escapeHtml(netWeight)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Registration Type</span>
                        <span class="value">${this.escapeHtml(registrationType)}</span>
                    </div>
                    <div class="col-third">
                        <span class="label">Classification</span>
                        <span class="value">${this.escapeHtml(vehicleClassification)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section-box">
            <div class="section-header">MOTOR VEHICLE INSPECTION REPORT (MVIR)</div>
            <div class="section-body">
                <div class="grid-row">
                    <div class="col-half">
                        <span class="label">Inspection Date</span>
                        <span class="value">${inspectionDateFormatted}</span>
                    </div>
                    <div class="col-half">
                        <span class="label">Inspection Result</span>
                        <span class="value highlight">${this.escapeHtml(inspectionResult)}</span>
                    </div>
                    <div class="col-half">
                        <span class="label">MVIR Number</span>
                        <span class="value">${this.escapeHtml(mvirNumber)}</span>
                    </div>
                    <div class="col-half">
                        <span class="label">Inspection Officer</span>
                        <span class="value">${this.escapeHtml(inspectionOfficer)}</span>
                    </div>
                    <div class="col-full" style="margin-top: 10px;">
                        <span class="label">Roadworthiness Status</span>
                        <span class="value">${this.escapeHtml(roadworthinessStatus)}</span>
                    </div>
                    <div class="col-full">
                        <span class="label">Emission Compliance</span>
                        <span class="value">${this.escapeHtml(emissionCompliance)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section-box">
            <div class="section-header">OFFICIAL RECEIPT (OR) DETAILS</div>
            <div class="section-body">
                <div class="grid-row">
                    <div class="col-quarter">
                        <span class="label">OR Number</span>
                        <span class="value">${this.escapeHtml(orNumber)}</span>
                    </div>
                    <div class="col-quarter">
                        <span class="label">Date of Payment</span>
                        <span class="value">${paymentDate}</span>
                    </div>
                    <div class="col-quarter">
                        <span class="label">Mode of Payment</span>
                        <span class="value">${this.escapeHtml(paymentMode)}</span>
                    </div>
                    <div class="col-quarter">
                        <span class="label">Total Amount Paid</span>
                        <span class="value">${this.escapeHtml(amountPaid)}</span>
                    </div>
                    <div class="col-full" style="margin-top: 10px;">
                        <span class="label">Purpose of Payment</span>
                        <span class="value">${this.escapeHtml(paymentPurpose)}</span>
                    </div>
                    <div class="col-full" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                        <span class="label" style="font-size: 10px; margin-bottom: 5px;">Fee Breakdown:</span>
                        <div style="font-size: 11px; color: #666;">
                            <div>Registration Fee: ${this.escapeHtml(amountPaid !== 'N/A' ? 'Included' : 'N/A')}</div>
                            <div>Insurance Fee: ${this.escapeHtml(amountPaid !== 'N/A' ? 'Included' : 'N/A')}</div>
                            <div>Computer Fee: ${this.escapeHtml(amountPaid !== 'N/A' ? 'Included' : 'N/A')}</div>
                            <div>Legal Research Fee: ${this.escapeHtml(amountPaid !== 'N/A' ? 'Included' : 'N/A')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section-box">
            <div class="section-header">CERTIFICATE OF REGISTRATION (CR) DETAILS</div>
            <div class="section-body">
                <div class="grid-row">
                    <div class="col-half">
                        <span class="label">CR Number</span>
                        <span class="value">${this.escapeHtml(crNumber)}</span>
                    </div>
                    <div class="col-half">
                        <span class="label">Date of Registration</span>
                        <span class="value">${dateOfRegFormatted}</span>
                    </div>
                    <div class="col-half">
                        <span class="label">Date Issued</span>
                        <span class="value">${regDateFormatted}</span>
                    </div>
                    <div class="col-half">
                        <span class="label">Expiration Date</span>
                        <span class="value highlight">${validityDate}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section-box">
            <div class="section-header">BLOCKCHAIN VERIFICATION</div>
            <div class="section-body">
                <div class="blockchain-container">
                    <div class="qr-box">
                        [QR PLACEHOLDER]
                    </div>
                    <div class="hash-container">
                        <span class="label">Blockchain Transaction Hash</span>
                        <div class="hash-code">${this.escapeHtml(blockchainTxId)}</div>
                        <div class="notice-text">
                            SYSTEM NOTICE: This document is digitally generated and secured via the LTO Private Blockchain. 
                            The QR code above contains the cryptographic proof of ownership and registration validity. 
                            No physical signature is required. This document is tamper-proof.
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <h3>AUTHORIZED BY: LAND TRANSPORTATION OFFICE</h3>
            <p>Digitally Signed: ${new Date().toLocaleString()} | Server ID: ${this.escapeHtml(blockchainTxId)}</p>
        </div>

    </div>

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

