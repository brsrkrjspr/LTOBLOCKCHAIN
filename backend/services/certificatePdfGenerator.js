/**
 * Certificate PDF Generator Service
 * Generates PDF certificates from HTML templates using Puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CertificatePdfGenerator {
    constructor() {
        this.templatesPath = path.join(__dirname, '..', '..', 'Mock Certs');
    }

    /**
     * Calculate SHA-256 hash of a buffer
     * @param {Buffer} buffer - PDF buffer
     * @returns {string} - Hex hash
     */
    calculateFileHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Generate composite hash for unique verification
     * @param {string} certificateNumber 
     * @param {string} vehicleVIN 
     * @param {string} expiryDate 
     * @param {string} fileHash 
     * @returns {string}
     */
    generateCompositeHash(certificateNumber, vehicleVIN, expiryDate, fileHash) {
        const compositeString = `${certificateNumber}|${vehicleVIN}|${expiryDate}|${fileHash}`;
        return crypto.createHash('sha256').update(compositeString).digest('hex');
    }

    /**
     * Generate Insurance Certificate PDF
     * @param {Object} data - Certificate data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateInsuranceCertificate(data) {
        const {
            ownerName,
            vehicleVIN,
            policyNumber,
            coverageType,
            coverageAmount,
            effectiveDate,
            expiryDate,
            additionalCoverage
        } = data;

        // Read template
        const templatePath = path.join(this.templatesPath, 'Insurance Cert', 'index.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Format dates to match mock certificate format (DD-MMM-YYYY)
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = date.getDate().toString().padStart(2, '0');
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };

        // Replace input field values by matching context (Insurance cert uses input fields without IDs)
        // Policy / Certificate No. - match the full line
        htmlTemplate = htmlTemplate.replace(
            /(Policy \/ Certificate No\.: <input class="full" value=")[^"]*(")/,
            `$1${policyNumber}$2`
        );
        
        // Effective Date - match the full line
        htmlTemplate = htmlTemplate.replace(
            /(Effective Date: <input value=")[^"]*(")/,
            `$1${formatDate(effectiveDate)}$2`
        );
        
        // Expiry Date - match the full line
        htmlTemplate = htmlTemplate.replace(
            /(Expiry Date: <input value=")[^"]*(")/,
            `$1${formatDate(expiryDate)}$2`
        );
        
        // Coverage Type - match the full line
        const coverageTypeText = coverageType === 'CTPL' ? 'Third-Party Liability Only' : coverageType;
        htmlTemplate = htmlTemplate.replace(
            /(Coverage Type: <input value=")[^"]*(")/,
            `$1${coverageTypeText}$2`
        );
        
        // Coverage Amount - Bodily Injury - match the full line
        const coverageParts = coverageAmount.split('/');
        const bodilyInjury = coverageParts[0] || coverageAmount;
        htmlTemplate = htmlTemplate.replace(
            /(&nbsp;&nbsp;Bodily Injury: <input value=")[^"]*(")/,
            `$1${bodilyInjury.trim()} per person / PHP 200,000 per accident$2`
        );
        
        // Coverage Amount - Property Damage - match the full line
        const propertyDamage = coverageParts[1] || 'PHP 50,000';
        htmlTemplate = htmlTemplate.replace(
            /(&nbsp;&nbsp;Property Damage: <input value=")[^"]*(")/,
            `$1${propertyDamage.trim()} per accident$2`
        );
        
        // Owner Name - match in Owner Information section
        htmlTemplate = htmlTemplate.replace(
            /(Name: <input class="full" value=")[^"]*(")/,
            `$1${ownerName}$2`
        );
        
        // Chassis No. (VIN) - match the full line
        htmlTemplate = htmlTemplate.replace(
            /(Chassis No\.: <input class="wide" value=")[^"]*(")/,
            `$1${vehicleVIN}$2`
        );

        // Inline CSS for Insurance certificate
        const cssPath = path.join(this.templatesPath, 'Insurance Cert', 'style.css');
        try {
            const cssContent = await fs.readFile(cssPath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(
                /<link rel="stylesheet" href="style\.css">/,
                `<style>${cssContent}</style>`
            );
        } catch (cssError) {
            console.warn('[Insurance Certificate] Could not load CSS file:', cssError.message);
        }

        // Generate PDF using Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                }
            });

            await browser.close();

            // Calculate file hash
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: policyNumber
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Generate Emission Certificate PDF
     * @param {Object} data - Certificate data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateEmissionCertificate(data) {
        const {
            ownerName,
            vehicleVIN,
            vehiclePlate,
            certificateNumber,
            testDate,
            expiryDate,
            testResults
        } = data;

        // Read template
        const templatePath = path.join(this.templatesPath, 'Emission Cert', 'emission-certificate.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Format dates
        const formatDateLong = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Replace input field values by ID (Emission cert uses IDs)
        // Certificate Reference Number
        htmlTemplate = htmlTemplate.replace(
            /id="cert-ref-input"[^>]*value="[^"]*"/,
            `id="cert-ref-input" class="editable-field" value="${certificateNumber}" data-field="cert-ref"`
        );
        
        // Owner Name
        htmlTemplate = htmlTemplate.replace(
            /id="owner-name"[^>]*value="[^"]*"/,
            `id="owner-name" class="editable-field" value="${ownerName}" data-field="owner-name"`
        );
        
        // Chassis / VIN
        htmlTemplate = htmlTemplate.replace(
            /id="chassis-vin"[^>]*value="[^"]*"/,
            `id="chassis-vin" class="editable-field" value="${vehicleVIN}" data-field="chassis-vin"`
        );
        
        // Plate No.
        htmlTemplate = htmlTemplate.replace(
            /id="plate-no"[^>]*value="[^"]*"/,
            `id="plate-no" class="editable-field" value="${vehiclePlate || 'PENDING'}" data-field="plate-no"`
        );
        
        // Test Results - CO Level
        const coValue = testResults?.co ? `${testResults.co} - Pass` : '0.20% - Pass';
        htmlTemplate = htmlTemplate.replace(
            /id="co-level"[^>]*value="[^"]*"/,
            `id="co-level" class="editable-field table-input" value="${coValue}" data-field="co-level"`
        );
        
        // Test Results - HC Level
        const hcValue = testResults?.hc ? `${testResults.hc} - Pass` : '120 ppm - Pass';
        htmlTemplate = htmlTemplate.replace(
            /id="hc-level"[^>]*value="[^"]*"/,
            `id="hc-level" class="editable-field table-input" value="${hcValue}" data-field="hc-level"`
        );
        
        // Test Results - NOx Level
        const noxValue = testResults?.nox ? `${testResults.nox} - Pass` : '0.25% - Pass';
        htmlTemplate = htmlTemplate.replace(
            /id="nox-level"[^>]*value="[^"]*"/,
            `id="nox-level" class="editable-field table-input" value="${noxValue}" data-field="nox-level"`
        );
        
        // Test Results - Smoke Opacity
        const smokeValue = testResults?.smoke ? `${testResults.smoke}% - Pass` : '18% - Pass';
        htmlTemplate = htmlTemplate.replace(
            /id="smoke-opacity"[^>]*value="[^"]*"/,
            `id="smoke-opacity" class="editable-field table-input" value="${smokeValue}" data-field="smoke-opacity"`
        );
        
        // Update date spans if they exist
        htmlTemplate = htmlTemplate.replace(
            /id="date-issue"[^>]*>.*?<\/span>/,
            `id="date-issue">${formatDateLong(testDate)}</span>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="date-expiry"[^>]*>.*?<\/span>/,
            `id="date-expiry">${formatDateLong(expiryDate)}</span>`
        );

        // Inline CSS for Emission certificate
        const cssPath = path.join(this.templatesPath, 'Emission Cert', 'emission-certificate.css');
        try {
            const cssContent = await fs.readFile(cssPath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(
                /<link rel="stylesheet" href="emission-certificate\.css">/,
                `<style>${cssContent}</style>`
            );
        } catch (cssError) {
            console.warn('[Emission Certificate] Could not load CSS file:', cssError.message);
        }

        // Generate PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                }
            });

            await browser.close();

            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Generate HPG Clearance Certificate PDF
     * @param {Object} data - Certificate data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateHpgClearance(data) {
        const {
            ownerName,
            vehicleVIN,
            vehiclePlate,
            clearanceNumber,
            issueDate,
            verificationDetails
        } = data;

        // Read template
        const templatePath = path.join(this.templatesPath, 'HPG certificate', 'pnp-hpg-clearance.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Format date
        const formatDateLong = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Replace input field values by ID (HPG cert uses IDs)
        // Certificate Number
        htmlTemplate = htmlTemplate.replace(
            /id="cert-number"[^>]*value="[^"]*"/,
            `id="cert-number" class="editable-field" value="${clearanceNumber}"`
        );
        
        // Date Issued
        htmlTemplate = htmlTemplate.replace(
            /id="date-issued"[^>]*value="[^"]*"/,
            `id="date-issued" class="editable-field" value="${formatDateLong(issueDate)}"`
        );
        
        // Owner Name
        htmlTemplate = htmlTemplate.replace(
            /id="owner-name"[^>]*value="[^"]*"/,
            `id="owner-name" class="editable-field" value="${ownerName}"`
        );
        
        // Chassis / VIN
        htmlTemplate = htmlTemplate.replace(
            /id="chassis-vin"[^>]*value="[^"]*"/,
            `id="chassis-vin" class="editable-field" value="${vehicleVIN}"`
        );
        
        // Plate Number
        htmlTemplate = htmlTemplate.replace(
            /id="plate-number"[^>]*value="[^"]*"/,
            `id="plate-number" class="editable-field" value="${vehiclePlate || 'PENDING'}"`
        );
        
        // Verification Details (statement textarea)
        htmlTemplate = htmlTemplate.replace(
            /id="statement-text"[^>]*>.*?<\/textarea>/s,
            `id="statement-text" rows="3">${verificationDetails || 'No adverse record found. Vehicle cleared for registration.'}</textarea>`
        );

        // Inline CSS for HPG certificate
        const cssPath = path.join(this.templatesPath, 'HPG certificate', 'pnp-hpg-clearance.css');
        try {
            const cssContent = await fs.readFile(cssPath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(
                /<link rel="stylesheet" href="pnp-hpg-clearance\.css">/,
                `<style>${cssContent}</style>`
            );
        } catch (cssError) {
            console.warn('[HPG Clearance] Could not load CSS file:', cssError.message);
        }

        // Generate PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                }
            });

            await browser.close();

            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: clearanceNumber
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Generate CSR Certificate PDF
     * @param {Object} data - Certificate data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateCsrCertificate(data) {
        const {
            dealerName,
            dealerLtoNumber,
            vehicleMake,
            vehicleModel,
            vehicleVariant,
            vehicleYear,
            bodyType,
            color,
            fuelType,
            engineNumber,
            vehicleVIN,
            issuanceDate
        } = data;

        // Generate CSR number: CSR-YYYY-XXXXXX
        const year = new Date().getFullYear();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const csrNumber = `CSR-${year}-${random}`;

        // Load CSR template
        const templatePath = path.join(this.templatesPath, 'csr cert', 'csr-certificate.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Format date
        const formatDateLong = (dateStr) => {
            if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Replace input field values by matching context (CSR cert uses input fields)
        // Company Name
        htmlTemplate = htmlTemplate.replace(
            /<p class="company">.*?value="[^"]*"/,
            `<p class="company"><input type="text" value="${dealerName || 'ABC MOTOR VEHICLE DEALER, INC.'}"`
        );
        
        // LTO Accredited Dealer Number
        htmlTemplate = htmlTemplate.replace(
            /<p class="company-sub">.*?value="[^"]*"/,
            `<p class="company-sub"><input type="text" value="LTO Accredited Dealer No. ${dealerLtoNumber || '12345'}"`
        );
        
        // CSR Number
        htmlTemplate = htmlTemplate.replace(
            /CSR No\.:.*?value="[^"]*"/,
            `CSR No.: <input type="text" value="${csrNumber}"`
        );
        
        // Date Issued
        htmlTemplate = htmlTemplate.replace(
            /Date Issued:.*?<input type="date" id="dateIssued">/,
            `Date Issued: <input type="date" id="dateIssued" value="${issuanceDate || new Date().toISOString().split('T')[0]}">`
        );
        
        // Make / Brand
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Make \/ Brand<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Make / Brand</td><td><input type="text" value="${vehicleMake || 'Toyota'}"`
        );
        
        // Model / Series
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Model \/ Series<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Model / Series</td><td><input type="text" value="${vehicleModel || 'Corolla Altis'}"`
        );
        
        // Variant / Type
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Variant \/ Type<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Variant / Type</td><td><input type="text" value="${vehicleVariant || '1.8 G CVT'}"`
        );
        
        // Year Model
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Year Model<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Year Model</td><td><input type="text" value="${vehicleYear || '2025'}"`
        );
        
        // Body Type
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Body Type<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Body Type</td><td><input type="text" value="${bodyType || 'Sedan'}"`
        );
        
        // Color
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Color<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Color</td><td><input type="text" value="${color || 'White'}"`
        );
        
        // Fuel Type
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Fuel Type<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Fuel Type</td><td><input type="text" value="${fuelType || 'Gasoline'}"`
        );
        
        // Engine Number
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Engine Number<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Engine Number</td><td><input type="text" value="${engineNumber || '2NR-FE123456'}"`
        );
        
        // Chassis / VIN
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Chassis \/ VIN<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Chassis / VIN</td><td><input type="text" value="${vehicleVIN || '1HGBH41JXMN109186'}"`
        );

        // Inline CSS for CSR certificate
        const cssPath = path.join(this.templatesPath, 'csr cert', 'csr-certificate.css');
        try {
            const cssContent = await fs.readFile(cssPath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(
                /<link rel="stylesheet" href="csr-certificate\.css">/,
                `<style>${cssContent}</style>`
            );
        } catch (cssError) {
            console.warn('[CSR Certificate] Could not load CSS file:', cssError.message);
        }

        // Generate PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                }
            });

            await browser.close();

            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: csrNumber
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }
}

module.exports = new CertificatePdfGenerator();
