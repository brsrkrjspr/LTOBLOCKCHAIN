/**
 * Certificate PDF Generator Service
 * Generates PDF certificates from HTML templates using Puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

class CertificatePdfGenerator {
    constructor() {
        this.templatesPath = path.join(__dirname, '..', '..', 'mock_certs');
    }

    /**
     * Generate random VIN (17 characters, excludes I, O, Q)
     * @returns {string} Random VIN
     */
    generateRandomVIN() {
        const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'; // Excludes I, O, Q
        let vin = '';
        for (let i = 0; i < 17; i++) {
            vin += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return vin;
    }

    /**
     * Generate random engine number (format: XXX-XX######)
     * @returns {string} Random engine number
     */
    generateRandomEngineNumber() {
        const prefix = ['2NR', '1GR', '3UR', '4GR', '5VZ'][Math.floor(Math.random() * 5)];
        const middle = ['FE', 'GE', 'DE', 'CE', 'BE'][Math.floor(Math.random() * 5)];
        const numbers = Math.floor(100000 + Math.random() * 900000).toString();
        return `${prefix}-${middle}${numbers}`;
    }

    /**
     * Generate random chassis number (10-17 alphanumeric)
     * @returns {string} Random chassis number
     */
    generateRandomChassisNumber() {
        const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
        const length = 10 + Math.floor(Math.random() * 8); // 10-17 chars
        let chassis = '';
        for (let i = 0; i < length; i++) {
            chassis += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return chassis;
    }

    /**
     * Generate random plate number (format: ABC-1234)
     * @returns {string} Random plate number
     */
    generateRandomPlateNumber() {
        const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
        const letterPart = Array.from({ length: 3 }, () => 
            letters.charAt(Math.floor(Math.random() * letters.length))
        ).join('');
        const numberPart = Math.floor(1000 + Math.random() * 9000).toString();
        return `${letterPart}-${numberPart}`;
    }

    /**
     * Get a random vehicle profile (make/model/body type) for auto generation
     * @returns {{make: string, model: string, vehicleType: string, bodyType: string}}
     */
    getRandomVehicleProfile() {
        const VEHICLE_CATALOG = [
            // Cars (Sedan / Hatchback)
            { make: 'Toyota', model: 'Vios', vehicleType: 'Car', bodyType: 'Sedan' },
            { make: 'Toyota', model: 'Corolla Altis', vehicleType: 'Car', bodyType: 'Sedan' },
            { make: 'Honda', model: 'Civic', vehicleType: 'Car', bodyType: 'Sedan' },
            { make: 'Honda', model: 'City', vehicleType: 'Car', bodyType: 'Sedan' },
            { make: 'Hyundai', model: 'Accent', vehicleType: 'Car', bodyType: 'Sedan' },
            { make: 'Mitsubishi', model: 'Mirage G4', vehicleType: 'Car', bodyType: 'Sedan' },
            { make: 'Kia', model: 'Rio', vehicleType: 'Car', bodyType: 'Hatchback' },
            { make: 'Suzuki', model: 'Swift', vehicleType: 'Car', bodyType: 'Hatchback' },

            // SUV / Crossover / MPV
            { make: 'Toyota', model: 'Fortuner', vehicleType: 'SUV', bodyType: 'SUV' },
            { make: 'Toyota', model: 'Innova', vehicleType: 'MPV', bodyType: 'MPV' },
            { make: 'Mitsubishi', model: 'Montero Sport', vehicleType: 'SUV', bodyType: 'SUV' },
            { make: 'Nissan', model: 'Terra', vehicleType: 'SUV', bodyType: 'SUV' },
            { make: 'Ford', model: 'Everest', vehicleType: 'SUV', bodyType: 'SUV' },
            { make: 'Ford', model: 'EcoSport', vehicleType: 'Crossover', bodyType: 'Crossover' },
            { make: 'Hyundai', model: 'Tucson', vehicleType: 'SUV', bodyType: 'SUV' },
            { make: 'Honda', model: 'CR-V', vehicleType: 'SUV', bodyType: 'SUV' },
            { make: 'Kia', model: 'Stonic', vehicleType: 'Crossover', bodyType: 'Crossover' },
            { make: 'Suzuki', model: 'Ertiga', vehicleType: 'MPV', bodyType: 'MPV' },

            // Pickup / Light Truck
            { make: 'Toyota', model: 'Hilux', vehicleType: 'Truck', bodyType: 'Pickup' },
            { make: 'Ford', model: 'Ranger', vehicleType: 'Truck', bodyType: 'Pickup' },
            { make: 'Nissan', model: 'Navara', vehicleType: 'Truck', bodyType: 'Pickup' },
            { make: 'Isuzu', model: 'D-Max', vehicleType: 'Truck', bodyType: 'Pickup' },
            { make: 'Mitsubishi', model: 'Strada', vehicleType: 'Truck', bodyType: 'Pickup' },
            { make: 'Isuzu', model: 'N-Series', vehicleType: 'Truck', bodyType: 'Light truck' },
            { make: 'Fuso', model: 'Canter', vehicleType: 'Truck', bodyType: 'Light truck' },
            { make: 'Hino', model: '300', vehicleType: 'Truck', bodyType: 'Light truck' },

            // Vans
            { make: 'Toyota', model: 'HiAce', vehicleType: 'Van', bodyType: 'Van' },
            { make: 'Hyundai', model: 'Starex', vehicleType: 'Van', bodyType: 'Van' },
            { make: 'Nissan', model: 'Urvan', vehicleType: 'Van', bodyType: 'Van' },
            { make: 'Foton', model: 'Toano', vehicleType: 'Van', bodyType: 'Van' },
            { make: 'Maxus', model: 'V80', vehicleType: 'Van', bodyType: 'Van' },

            // Motorcycles
            { make: 'Honda', model: 'Click 125', vehicleType: 'Motorcycle', bodyType: 'Scooter' },
            { make: 'Yamaha', model: 'Mio i 125', vehicleType: 'Motorcycle', bodyType: 'Scooter' },
            { make: 'Suzuki', model: 'Raider 150', vehicleType: 'Motorcycle', bodyType: 'Underbone' },
            { make: 'Kawasaki', model: 'Barako II', vehicleType: 'Motorcycle', bodyType: 'Standard' },
            { make: 'Honda', model: 'TMX Supremo', vehicleType: 'Motorcycle', bodyType: 'Standard' },
            { make: 'Yamaha', model: 'Aerox 155', vehicleType: 'Motorcycle', bodyType: 'Scooter' },
            { make: 'Honda', model: 'ADV 160', vehicleType: 'Motorcycle', bodyType: 'Scooter' },
            { make: 'KTM', model: 'Duke 200', vehicleType: 'Motorcycle', bodyType: 'Naked' },
            { make: 'Royal Enfield', model: 'Classic 350', vehicleType: 'Motorcycle', bodyType: 'Standard' }
        ];

        const chosen = VEHICLE_CATALOG[Math.floor(Math.random() * VEHICLE_CATALOG.length)];
        return {
            make: chosen.make,
            model: chosen.model,
            vehicleType: chosen.vehicleType,
            bodyType: chosen.bodyType
        };
    }

    /**
     * Validate PDF buffer
     * @param {Buffer} buffer - PDF buffer to validate
     * @param {string} certificateType - Type of certificate for logging
     * @throws {Error} If PDF buffer is invalid
     */
    validatePdfBuffer(buffer, certificateType = 'Certificate') {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new Error(`${certificateType} PDF generation returned invalid buffer`);
        }

        if (buffer.length === 0) {
            throw new Error(`${certificateType} PDF generation returned empty buffer`);
        }

        // Validate PDF header (PDF files start with %PDF)
        const pdfHeader = buffer.toString('ascii', 0, Math.min(4, buffer.length));
        if (pdfHeader !== '%PDF') {
            console.error(`[${certificateType}] Invalid PDF header: ${pdfHeader}, buffer length: ${buffer.length}`);
            throw new Error(`Invalid PDF format: expected %PDF header, got ${pdfHeader}`);
        }

        console.log(`[${certificateType}] PDF validated: ${buffer.length} bytes, header: ${pdfHeader}`);
    }

    /**
     * Convert PDF result from page.pdf() to Buffer
     * @param {any} pdfResult - Result from page.pdf()
     * @param {string} certificateType - Type of certificate for logging
     * @returns {Buffer} Valid PDF buffer
     */
    ensurePdfBuffer(pdfResult, certificateType = 'Certificate') {
        if (Buffer.isBuffer(pdfResult)) {
            return pdfResult;
        }

        console.log(`[${certificateType}] PDF result type: ${typeof pdfResult}, constructor: ${pdfResult?.constructor?.name}`);

        if (pdfResult instanceof Uint8Array) {
            return Buffer.from(pdfResult);
        } else if (typeof pdfResult === 'string') {
            return Buffer.from(pdfResult, 'base64');
        } else if (pdfResult && typeof pdfResult === 'object') {
            // Try to convert array-like objects
            return Buffer.from(pdfResult);
        } else {
            throw new Error(`Invalid PDF result type: ${typeof pdfResult}, value: ${String(pdfResult).substring(0, 100)}`);
        }
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
     * Get Chromium executable path for Alpine Linux
     * @returns {string|null} Path to Chromium executable or null if not found
     */
    getChromiumExecutablePath() {
        // Common paths for Chromium in Alpine Linux
        const possiblePaths = [
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/usr/bin/chrome',
            '/usr/bin/google-chrome'
        ];

        for (const chromiumPath of possiblePaths) {
            try {
                if (fsSync.existsSync(chromiumPath)) {
                    return chromiumPath;
                }
            } catch (error) {
                // Continue checking other paths
            }
        }

        return null;
    }

    /**
     * Get Puppeteer launch options with Chromium path detection
     * @returns {Object} Puppeteer launch options
     */
    getPuppeteerLaunchOptions() {
        const chromiumPath = this.getChromiumExecutablePath();
        const options = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Important for Docker containers
                '--disable-gpu' // Helpful in headless environments
            ]
        };

        if (chromiumPath) {
            options.executablePath = chromiumPath;
            console.log(`[Puppeteer] Using Chromium at: ${chromiumPath}`);
        } else {
            console.warn('[Puppeteer] Chromium executable not found, Puppeteer will try to use bundled Chrome');
        }

        return options;
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
            vehiclePlate,
            vehicleMake,
            vehicleModel,
            engineNumber,
            chassisNumber,
            bodyType,
            policyNumber,
            coverageType,
            coverageAmount,
            effectiveDate,
            expiryDate,
            additionalCoverage
        } = data || {};

        // Validate required fields
        if (!ownerName || !policyNumber || !effectiveDate || !expiryDate) {
            throw new Error('Missing required fields for Insurance Certificate: ownerName, policyNumber, effectiveDate, expiryDate are required');
        }

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
        const coverageAmountStr = coverageAmount || 'PHP 200,000 / PHP 50,000';
        const coverageParts = coverageAmountStr.split('/');
        const bodilyInjury = coverageParts[0] || coverageAmountStr;
        htmlTemplate = htmlTemplate.replace(
            /(&nbsp;&nbsp;Bodily Injury: <input value=")[^"]*(")/,
            `$1${bodilyInjury.trim()} per person / PHP 200,000 per accident$2`
        );
        
        // Coverage Amount - Property Damage - match the full line
        const propertyDamage = coverageParts[1]?.trim() || 'PHP 50,000';
        htmlTemplate = htmlTemplate.replace(
            /(&nbsp;&nbsp;Property Damage: <input value=")[^"]*(")/,
            `$1${propertyDamage.trim()} per accident$2`
        );
        
        // Owner Name - match in Owner Information section
        htmlTemplate = htmlTemplate.replace(
            /(Name: <input class="full" value=")[^"]*(")/,
            `$1${ownerName}$2`
        );
        
        // Make / Brand - match the full line
        const finalMake = vehicleMake || 'Toyota';
        htmlTemplate = htmlTemplate.replace(
            /(Make \/ Brand: <input value=")[^"]*(")/,
            `$1${finalMake}$2`
        );
        
        // Model - match the full line
        const finalModel = vehicleModel || 'Vios';
        htmlTemplate = htmlTemplate.replace(
            /(Model: <input value=")[^"]*(")/,
            `$1${finalModel}$2`
        );
        
        // Vehicle Type - match the full line
        const finalBodyType = bodyType || 'Sedan';
        htmlTemplate = htmlTemplate.replace(
            /(Vehicle Type: <input value=")[^"]*(")/,
            `$1${finalBodyType}$2`
        );
        
        // Engine No. - match the full line
        const finalEngineNumber = engineNumber || this.generateRandomEngineNumber();
        htmlTemplate = htmlTemplate.replace(
            /(Engine No\.: <input class="wide" value=")[^"]*(")/,
            `$1${finalEngineNumber}$2`
        );
        
        // Chassis No. (VIN) - match the full line (use provided or generate random)
        const finalVIN = vehicleVIN || chassisNumber || this.generateRandomVIN();
        htmlTemplate = htmlTemplate.replace(
            /(Chassis No\.: <input class="wide" value=")[^"]*(")/,
            `$1${finalVIN}$2`
        );
        
        // Plate No. - match the full line
        const finalPlate = vehiclePlate || 'To be issued';
        htmlTemplate = htmlTemplate.replace(
            /(Plate No\.: <input value=")[^"]*(")/,
            `$1${finalPlate}$2`
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
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            // Wait a bit more to ensure all fonts and resources are loaded
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
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

            // Ensure pdfResult is converted to a Buffer
            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'Insurance Certificate');

            // Validate PDF buffer
            this.validatePdfBuffer(pdfBuffer, 'Insurance Certificate');

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
        throw new Error('Emission certificate generation has been removed from this system.');
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
            vehicleMake,
            vehicleModel,
            vehicleYear,
            bodyType,
            color,
            engineNumber,
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
        
        // Make / Model
        const finalMake = vehicleMake || 'Toyota';
        const finalModel = vehicleModel || 'Vios';
        const makeModel = `${finalMake} ${finalModel}`;
        htmlTemplate = htmlTemplate.replace(
            /id="make-model"[^>]*value="[^"]*"/,
            `id="make-model" class="editable-field" value="${makeModel}"`
        );
        
        // Year Model
        const finalYear = vehicleYear || new Date().getFullYear();
        htmlTemplate = htmlTemplate.replace(
            /id="year-model"[^>]*value="[^"]*"/,
            `id="year-model" class="editable-field" value="${finalYear}"`
        );
        
        // Vehicle Type
        const finalBodyType = bodyType || 'Sedan';
        htmlTemplate = htmlTemplate.replace(
            /id="body-type"[^>]*value="[^"]*"/,
            `id="body-type" class="editable-field" value="${finalBodyType}"`
        );
        
        // Color
        const finalColor = color || 'White';
        htmlTemplate = htmlTemplate.replace(
            /id="color"[^>]*value="[^"]*"/,
            `id="color" class="editable-field" value="${finalColor}"`
        );
        
        // Engine Number
        const finalEngineNumber = engineNumber || this.generateRandomEngineNumber();
        htmlTemplate = htmlTemplate.replace(
            /id="engine-number"[^>]*value="[^"]*"/,
            `id="engine-number" class="editable-field" value="${finalEngineNumber}"`
        );
        
        // Chassis / VIN (use provided or generate random)
        const finalVIN = vehicleVIN || this.generateRandomVIN();
        htmlTemplate = htmlTemplate.replace(
            /id="chassis-vin"[^>]*value="[^"]*"/,
            `id="chassis-vin" class="editable-field" value="${finalVIN}"`
        );
        
        // Plate Number (use provided or generate random)
        const finalPlate = vehiclePlate || this.generateRandomPlateNumber();
        htmlTemplate = htmlTemplate.replace(
            /id="plate-number"[^>]*value="[^"]*"/,
            `id="plate-number" class="editable-field" value="${finalPlate}"`
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
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            // Wait a bit more to ensure all fonts and resources are loaded
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
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

            // Ensure pdfResult is converted to a Buffer
            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'HPG Clearance');

            // Validate PDF buffer
            this.validatePdfBuffer(pdfBuffer, 'HPG Clearance');

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
            issuanceDate,
            csrNumber  // Optional: if provided, use it; otherwise generate
        } = data;

        // Generate CSR number: CSR-YYYY-XXXXXX (use provided or generate)
        const certificateNumberGenerator = require('../utils/certificateNumberGenerator');
        const csrNumberFinal = csrNumber || certificateNumberGenerator.generateCsrNumber();

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
            `CSR No.: <input type="text" value="${csrNumberFinal}"`
        );
        
        // Date Issued
        htmlTemplate = htmlTemplate.replace(
            /Date Issued:.*?<input type="date" id="dateIssued">/,
            `Date Issued: <input type="date" id="dateIssued" value="${issuanceDate || new Date().toISOString().split('T')[0]}">`
        );
        
        // Make / Brand (use provided or default)
        const finalMake = vehicleMake || 'Toyota';
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Make \/ Brand<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Make / Brand</td><td><input type="text" value="${finalMake}"`
        );
        
        // Model / Series (use provided or default)
        const finalModel = vehicleModel || 'Corolla Altis';
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Model \/ Series<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Model / Series</td><td><input type="text" value="${finalModel}"`
        );
        
        // Variant / Type
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Variant \/ Type<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Variant / Type</td><td><input type="text" value="${vehicleVariant || '1.8 G CVT'}"`
        );
        
        // Year Model (use provided or default)
        const finalYear = vehicleYear || new Date().getFullYear();
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Year Model<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Year Model</td><td><input type="text" value="${finalYear}"`
        );
        
        // Vehicle Type (use provided or default)
        const finalBodyType = bodyType || 'Sedan';
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Vehicle Type<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Vehicle Type</td><td><input type="text" value="${finalBodyType}"`
        );
        
        // Color (use provided or default)
        const finalColor = color || 'White';
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Color<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Color</td><td><input type="text" value="${finalColor}"`
        );
        
        // Fuel Type (use provided or default)
        const finalFuelType = fuelType || 'Gasoline';
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Fuel Type<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Fuel Type</td><td><input type="text" value="${finalFuelType}"`
        );
        
        // Engine Number (use provided or generate random)
        const finalEngineNumber = engineNumber || this.generateRandomEngineNumber();
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Engine Number<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Engine Number</td><td><input type="text" value="${finalEngineNumber}"`
        );
        
        // Chassis / VIN (use provided or generate random)
        const finalVIN = vehicleVIN || this.generateRandomVIN();
        htmlTemplate = htmlTemplate.replace(
            /<tr><td>Chassis \/ VIN<\/td><td>.*?value="[^"]*"/,
            `<tr><td>Chassis / VIN</td><td><input type="text" value="${finalVIN}"`
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
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            // Wait a bit more to ensure all fonts and resources are loaded
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
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

            // Ensure pdfResult is converted to a Buffer
            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'CSR Certificate');

            // Validate PDF buffer
            this.validatePdfBuffer(pdfBuffer, 'CSR Certificate');

            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: csrNumberFinal
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Generate Sales Invoice PDF
     * @param {Object} data - Invoice data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateSalesInvoice(data) {
        const {
            ownerName,
            vehicleVIN,
            vehiclePlate,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            bodyType,
            color,
            fuelType,
            engineNumber,
            invoiceNumber,
            dateOfSale,
            purchasePrice,
            sellerName,
            sellerPosition,
            dealerName,
            dealerTin,
            dealerAccreditationNo
        } = data;

        // Generate invoice number if not provided: INV-YYYYMMDD-XXXXXX
        let finalInvoiceNumber = invoiceNumber;
        if (!finalInvoiceNumber) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            finalInvoiceNumber = `INV-${year}${month}${day}-${random}`;
        }

        // Load Sales Invoice template
        const templatePath = path.join(this.templatesPath, 'Sales Invoice', 'sales-invoice.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Format date for display (MM/DD/YYYY)
        const formatDate = (dateStr) => {
            if (!dateStr) {
                const today = new Date();
                return today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
            }
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        };

        // Remove JavaScript and download buttons (not needed for server-side PDF generation)
        htmlTemplate = htmlTemplate.replace(/<script[\s\S]*?<\/script>/gi, '');
        htmlTemplate = htmlTemplate.replace(/<div class="download-container">[\s\S]*?<\/div>/gi, '');

        // Replace header company info
        const finalDealerName = dealerName || 'ABC MOTORS CORPORATION';
        htmlTemplate = htmlTemplate.replace(
            /<h1>.*?<\/h1>/,
            `<h1>${finalDealerName}</h1>`
        );

        // Replace TIN
        const finalDealerTin = dealerTin || '123-456-789';
        htmlTemplate = htmlTemplate.replace(
            /<p>TIN:.*?<\/p>/,
            `<p>TIN: ${finalDealerTin}</p>`
        );

        // Replace Dealer Accreditation No
        const finalDealerAccreditationNo = dealerAccreditationNo || 'DA-2023-001';
        htmlTemplate = htmlTemplate.replace(
            /<p>Dealer Accreditation No\.:.*?<\/p>/,
            `<p>Dealer Accreditation No.: ${finalDealerAccreditationNo}</p>`
        );

        // Replace Invoice Number
        htmlTemplate = htmlTemplate.replace(
            /<strong>Invoice No:<\/strong>.*?<\/div>/,
            `<strong>Invoice No:</strong> ${finalInvoiceNumber}</div>`
        );

        // Replace Date of Sale
        const finalDateOfSale = dateOfSale || new Date().toISOString();
        htmlTemplate = htmlTemplate.replace(
            /<span id="date-sale"><\/span>/,
            formatDate(finalDateOfSale)
        );

        // Replace Buyer Name
        const finalOwnerName = ownerName || 'Juan Dela Cruz';
        htmlTemplate = htmlTemplate.replace(
            /id="buyer-name"[^>]*value="[^"]*"/,
            `id="buyer-name" value="${finalOwnerName}"`
        );

        // Replace Vehicle Details
        const finalMake = vehicleMake || 'Toyota';
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-make"[^>]*value="[^"]*"/,
            `id="vehicle-make" value="${finalMake}"`
        );

        const finalModel = vehicleModel || 'Corolla Altis';
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-model"[^>]*value="[^"]*"/,
            `id="vehicle-model" value="${finalModel}"`
        );

        const finalYear = vehicleYear || new Date().getFullYear();
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-year"[^>]*value="[^"]*"/,
            `id="vehicle-year" value="${finalYear}"`
        );

        const finalBodyType = bodyType || 'Sedan';
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-body"[^>]*value="[^"]*"/,
            `id="vehicle-body" value="${finalBodyType}"`
        );

        const finalColor = color || 'White';
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-color"[^>]*value="[^"]*"/,
            `id="vehicle-color" value="${finalColor}"`
        );

        const finalFuelType = fuelType || 'Gasoline';
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-fuel"[^>]*value="[^"]*"/,
            `id="vehicle-fuel" value="${finalFuelType}"`
        );

        const finalEngineNumber = engineNumber || this.generateRandomEngineNumber();
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-engine"[^>]*value="[^"]*"/,
            `id="vehicle-engine" value="${finalEngineNumber}"`
        );

        const finalVIN = vehicleVIN || this.generateRandomVIN();
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-chassis"[^>]*value="[^"]*"/,
            `id="vehicle-chassis" value="${finalVIN}"`
        );

        const finalPlate = vehiclePlate || 'To be issued';
        htmlTemplate = htmlTemplate.replace(
            /id="vehicle-plate"[^>]*value="[^"]*"/,
            `id="vehicle-plate" value="${finalPlate}"`
        );

        // Replace Purchase Price
        const finalPurchasePrice = purchasePrice || '₱1,120,000.00';
        htmlTemplate = htmlTemplate.replace(
            /<td>₱[\d,]+\.\d{2}<\/td>/,
            `<td>${finalPurchasePrice}</td>`
        );

        // Replace Seller Information
        const finalSellerName = sellerName || 'John M. Santos';
        htmlTemplate = htmlTemplate.replace(
            /<p><strong>Name:<\/strong>.*?<\/p>/,
            `<p><strong>Name:</strong> ${finalSellerName}</p>`
        );

        const finalSellerPosition = sellerPosition || 'Sales Manager';
        htmlTemplate = htmlTemplate.replace(
            /<p><strong>Position:<\/strong>.*?<\/p>/,
            `<p><strong>Position:</strong> ${finalSellerPosition}</p>`
        );

        // Replace dates in signature and authentication sections
        htmlTemplate = htmlTemplate.replace(
            /<span id="seller-date"><\/span>/g,
            formatDate(finalDateOfSale)
        );
        htmlTemplate = htmlTemplate.replace(
            /<span id="date-auth"><\/span>/g,
            formatDate(finalDateOfSale)
        );
        htmlTemplate = htmlTemplate.replace(
            /<div class="stamp-date" id="stamp-date"><\/div>/,
            `<div class="stamp-date" id="stamp-date">${formatDate(finalDateOfSale)}</div>`
        );

        // Replace stamp company name
        htmlTemplate = htmlTemplate.replace(
            /<div class="stamp-text-center">ABC MOTORS<\/div>/,
            `<div class="stamp-text-center">${finalDealerName.split(' ').slice(0, 2).join(' ')}</div>`
        );

        // Inline CSS for Sales Invoice
        const cssPath = path.join(this.templatesPath, 'Sales Invoice', 'sales-invoice.css');
        try {
            const cssContent = await fs.readFile(cssPath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(
                /<link rel="stylesheet" href="sales-invoice\.css">/,
                `<style>${cssContent}</style>`
            );
        } catch (cssError) {
            console.warn('[Sales Invoice] Could not load CSS file:', cssError.message);
        }

        // Generate PDF
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());

        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, {
                waitUntil: 'networkidle0'
            });

            // Wait a bit more to ensure all fonts and resources are loaded
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
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

            // Ensure pdfResult is converted to a Buffer
            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'Sales Invoice');

            // Validate PDF buffer
            this.validatePdfBuffer(pdfBuffer, 'Sales Invoice');

            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: finalInvoiceNumber
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Convert number to words (for price in words)
     * @param {number} num - Number to convert
     * @returns {string} Number in words
     */
    numberToWords(num) {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                     'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        if (num === 0) return 'Zero';
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
        if (num < 1000) {
            return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + this.numberToWords(num % 100) : '');
        }
        if (num < 1000000) {
            return this.numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + this.numberToWords(num % 1000) : '');
        }
        if (num < 1000000000) {
            return this.numberToWords(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 !== 0 ? ' ' + this.numberToWords(num % 1000000) : '');
        }
        return 'Very Large Number';
    }

    /**
     * Format price to words (e.g., "One Million One Hundred Twenty Thousand Pesos")
     * @param {string} priceStr - Price string (e.g., "PHP 1,120,000.00" or "₱1,120,000.00")
     * @returns {string} Price in words
     */
    formatPriceToWords(priceStr) {
        if (!priceStr) return 'Zero Pesos';
        
        // Extract numeric value
        const numericStr = priceStr.replace(/[^0-9.]/g, '');
        const num = parseFloat(numericStr);
        if (isNaN(num)) return 'Zero Pesos';
        
        const wholePart = Math.floor(num);
        const decimalPart = Math.round((num - wholePart) * 100);
        
        let words = this.numberToWords(wholePart) + ' Pesos';
        if (decimalPart > 0) {
            words += ' and ' + this.numberToWords(decimalPart) + ' Centavos';
        }
        
        return words;
    }

    /**
     * Generate Deed of Sale PDF for Transfer of Ownership
     * @param {Object} data - Deed of Sale data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateDeedOfSale(data) {
        const {
            sellerName,
            sellerAddress,
            buyerName,
            buyerAddress,
            vehicleVIN,
            vehiclePlate,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            engineNumber,
            chassisNumber,
            purchasePrice,
            saleDate,
            odometerReading,
            notaryName,
            notaryCommission
        } = data;

        // Use Deed of Sale template
        const templatePath = path.join(this.templatesPath, 'Deed of Sale', 'deedofsale.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Remove JavaScript and controls (not needed for server-side PDF generation)
        htmlTemplate = htmlTemplate.replace(/<script[\s\S]*?<\/script>/gi, '');
        htmlTemplate = htmlTemplate.replace(/<div class="controls">[\s\S]*?<\/div>/gi, '');
        htmlTemplate = htmlTemplate.replace(/<div id="previewModal"[\s\S]*?<\/div>/gi, '');

        // Format sale date
        const finalSaleDate = saleDate ? new Date(saleDate) : new Date();
        const day = finalSaleDate.getDate();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const month = monthNames[finalSaleDate.getMonth()];
        const formattedDate = finalSaleDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Replace seller information
        htmlTemplate = htmlTemplate.replace(
            /id="seller-name"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="seller-name" class="field-input" value="${sellerName || 'N/A'}" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="seller-address"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="seller-address" class="field-input" value="${sellerAddress || 'N/A'}" readonly>`
        );

        // Replace buyer information
        htmlTemplate = htmlTemplate.replace(
            /id="buyer-name"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="buyer-name" class="field-input" value="${buyerName || 'N/A'}" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="buyer-address"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="buyer-address" class="field-input" value="${buyerAddress || 'N/A'}" readonly>`
        );

        // Replace date fields
        htmlTemplate = htmlTemplate.replace(
            /id="day"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="day" class="field-input" value="${day}" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="month"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="month" class="field-input" value="${month}" readonly>`
        );

        // Replace vehicle details
        const makeModel = vehicleMake && vehicleModel ? `${vehicleMake} ${vehicleModel}` : (vehicleMake || vehicleModel || 'N/A');
        htmlTemplate = htmlTemplate.replace(
            /id="model"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="model" class="field-input" value="${makeModel}" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="color"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="color" class="field-input" value="N/A" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="body"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="body" class="field-input" value="N/A" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="motor-no"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="motor-no" class="field-input" value="${engineNumber || 'N/A'}" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="chassis-no"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="chassis-no" class="field-input" value="${vehicleVIN || chassisNumber || 'N/A'}" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="plate-no"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="plate-no" class="field-input" value="${vehiclePlate || 'N/A'}" readonly>`
        );

        // Replace purchase price
        const priceText = purchasePrice || 'PHP 0.00';
        htmlTemplate = htmlTemplate.replace(
            /id="amount"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="amount" class="field-input" value="${priceText}" readonly>`
        );
        const priceInWords = this.formatPriceToWords(priceText);
        htmlTemplate = htmlTemplate.replace(
            /id="amount-words"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="amount-words" class="field-input" value="${priceInWords}" readonly>`
        );

        // Replace acknowledgment section names
        htmlTemplate = htmlTemplate.replace(
            /id="seller-name-ack"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="seller-name-ack" class="field-input" value="${sellerName || 'N/A'}" readonly>`
        );
        htmlTemplate = htmlTemplate.replace(
            /id="buyer-name-ack"[^>]*placeholder="[^"]*"[^>]*>/,
            `id="buyer-name-ack" class="field-input" value="${buyerName || 'N/A'}" readonly>`
        );

        // Replace notary information if provided
        if (notaryName) {
            htmlTemplate = htmlTemplate.replace(
                /<strong>JANE J. DOE<\/strong>/g,
                `<strong>${notaryName}</strong>`
            );
            htmlTemplate = htmlTemplate.replace(
                /<div class="seal-text-top">JANE J. DOE<\/div>/,
                `<div class="seal-text-top">${notaryName.toUpperCase()}</div>`
            );
            if (notaryCommission) {
                htmlTemplate = htmlTemplate.replace(
                    /My Commission Expires:<br>\s*January 21, 2029/,
                    `Commission No.: ${notaryCommission}<br>My Commission Expires:<br>January 21, 2029`
                );
            }
        }

        // Replace date in acknowledgment section
        htmlTemplate = htmlTemplate.replace(
            /<strong>\[DATE OF NOTARIZATION\]<\/strong>/,
            `<strong>${formattedDate}</strong>`
        );

        // Hide signature canvases (they won't work in server-side PDF generation)
        htmlTemplate = htmlTemplate.replace(
            /<canvas id="sellerCanvas"[^>]*>[\s\S]*?<\/canvas>/gi,
            '<div style="border: 2px solid #333; width: 200px; height: 80px; margin: 10px auto; display: flex; align-items: center; justify-content: center; background: #f5f5f5;">Signature</div>'
        );
        htmlTemplate = htmlTemplate.replace(
            /<canvas id="buyerCanvas"[^>]*>[\s\S]*?<\/canvas>/gi,
            '<div style="border: 2px solid #333; width: 200px; height: 80px; margin: 10px auto; display: flex; align-items: center; justify-content: center; background: #f5f5f5;">Signature</div>'
        );
        htmlTemplate = htmlTemplate.replace(
            /<button class="clear-btn"[^>]*>Clear<\/button>/gi,
            ''
        );

        // Replace seller/buyer names in signature boxes
        htmlTemplate = htmlTemplate.replace(
            /<div><strong>\[NAME OF SELLER\]<\/strong><\/div>/,
            `<div><strong>${sellerName || 'SELLER NAME'}</strong></div>`
        );
        htmlTemplate = htmlTemplate.replace(
            /<div><strong>\[NAME OF BUYER\]<\/strong><\/div>/,
            `<div><strong>${buyerName || 'BUYER NAME'}</strong></div>`
        );

        // Generate PDF
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());
        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
            });

            await browser.close();

            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'Deed of Sale');
            this.validatePdfBuffer(pdfBuffer, 'Deed of Sale');
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: `DEED-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Generate Government ID PDF (Driver's License or National ID)
     * @param {Object} data - ID data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateGovernmentId(data) {
        const {
            holderName,
            holderAddress,
            idType,
            idNumber,
            dateOfBirth,
            isSeller
        } = data;

        // Use Driver's License template
        const templatePath = path.join(this.templatesPath, 'Mockups ID', 'drivers-license.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Replace name (look for name fields in the template)
        htmlTemplate = htmlTemplate.replace(
            /id="full-name"[^>]*value="[^"]*"/g,
            `id="full-name" value="${holderName || 'N/A'}"`
        );

        // Replace address
        htmlTemplate = htmlTemplate.replace(
            /id="address"[^>]*value="[^"]*"/g,
            `id="address" value="${holderAddress || 'N/A'}"`
        );

        // Replace ID number
        htmlTemplate = htmlTemplate.replace(
            /id="license-number"[^>]*value="[^"]*"/g,
            `id="license-number" value="${idNumber || 'N/A'}"`
        );

        // Replace date of birth if provided
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            const dobStr = dob.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
            htmlTemplate = htmlTemplate.replace(
                /id="birthdate"[^>]*value="[^"]*"/g,
                `id="birthdate" value="${dobStr}"`
            );
        }

        // Generate PDF
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());
        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
            });

            await browser.close();

            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'Government ID');
            this.validatePdfBuffer(pdfBuffer, 'Government ID');
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: idNumber || `ID-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Generate TIN Document PDF
     * @param {Object} data - TIN data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateTinDocument(data) {
        const {
            holderName,
            holderAddress,
            tinNumber
        } = data;

        // Create simple TIN document HTML
        const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>TIN Certificate</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #1e4b7a;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1e4b7a;
            margin: 0;
        }
        .content {
            margin: 30px 0;
        }
        .info-row {
            display: flex;
            margin: 15px 0;
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
        }
        .info-label {
            font-weight: bold;
            width: 200px;
            color: #333;
        }
        .info-value {
            flex: 1;
            color: #666;
        }
        .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .tin-number {
            font-size: 24px;
            font-weight: bold;
            color: #1e4b7a;
            text-align: center;
            padding: 20px;
            background: #f0f7ff;
            border: 2px solid #1e4b7a;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>BUREAU OF INTERNAL REVENUE</h1>
        <p>Republic of the Philippines</p>
        <h2>TAX IDENTIFICATION NUMBER (TIN)</h2>
    </div>
    <div class="content">
        <div class="info-row">
            <div class="info-label">Name:</div>
            <div class="info-value">${holderName || 'N/A'}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Address:</div>
            <div class="info-value">${holderAddress || 'N/A'}</div>
        </div>
        <div class="tin-number">
            ${tinNumber || 'N/A'}
        </div>
        <div class="info-row">
            <div class="info-label">Date Issued:</div>
            <div class="info-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
    </div>
    <div class="footer">
        <p>This is a system-generated document for demo/testing purposes.</p>
        <p>For official TIN, please visit your local BIR office.</p>
    </div>
</body>
</html>
        `;

        // Generate PDF
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());
        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
            });

            await browser.close();

            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'TIN Document');
            this.validatePdfBuffer(pdfBuffer, 'TIN Document');
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: tinNumber || `TIN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }

    /**
     * Generate MVIR (Motor Vehicle Inspection Report) PDF
     * @param {Object} data - MVIR data
     * @returns {Promise<{pdfBuffer: Buffer, fileHash: string, certificateNumber: string}>}
     */
    async generateMvir(data) {
        const {
            vehicleVIN,
            vehiclePlate,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            engineNumber,
            chassisNumber,
            inspectionDate,
            mvirNumber,
            inspectionResult,
            roadworthinessStatus,
            inspectorName,
            inspectionNotes,
            bodyType,
            color,
            fuelType
        } = data;

        // Generate MVIR number if not provided
        const finalMvirNumber = mvirNumber || `MVIR-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Load MVIR template
        const templatePath = path.join(this.templatesPath, 'mvir', 'mvir-form.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf-8');

        // Format inspection date
        const formatDate = (dateStr) => {
            if (!dateStr) return new Date().toISOString().split('T')[0];
            const date = new Date(dateStr);
            return date.toISOString().split('T')[0];
        };

        // Replace MVIR Number
        htmlTemplate = htmlTemplate.replace(
            /<input type="text" value="[^"]*" class="mvir-number">/,
            `<input type="text" value="${finalMvirNumber}" class="mvir-number">`
        );

        // Replace Inspection Date
        htmlTemplate = htmlTemplate.replace(
            /<input type="date" id="inspectionDate" value="[^"]*">/,
            `<input type="date" id="inspectionDate" value="${formatDate(inspectionDate)}">`
        );

        // Replace Plate Number
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Plate Number:<\/td>\s*<td>.*?value="[^"]*"/,
            `<tr><td class="label">Plate Number:</td><td><input type="text" value="${vehiclePlate || ''}"`
        );

        // Replace Make / Brand
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Make \/ Brand:<\/td>\s*<td>.*?value="[^"]*"/,
            `<tr><td class="label">Make / Brand:</td><td><input type="text" value="${vehicleMake || ''}"`
        );

        // Replace Model / Series
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Model \/ Series:<\/td>\s*<td>.*?value="[^"]*"/,
            `<tr><td class="label">Model / Series:</td><td><input type="text" value="${vehicleModel || ''}"`
        );

        // Replace Year Model
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Year Model:<\/td>\s*<td>.*?value="[^"]*"/,
            `<tr><td class="label">Year Model:</td><td><input type="text" value="${vehicleYear || ''}"`
        );

        // Replace Body Type
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Body Type:<\/td>\s*<td>.*?value="[^"]*"/,
            `<tr><td class="label">Body Type:</td><td><input type="text" value="${bodyType || ''}"`
        );

        // Replace Color
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Color:<\/td>\s*<td>.*?value="[^"]*"/,
            `<tr><td class="label">Color:</td><td><input type="text" value="${color || ''}"`
        );

        // Replace Fuel Type
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Fuel Type:<\/td>\s*<td>.*?value="[^"]*"/,
            `<tr><td class="label">Fuel Type:</td><td><input type="text" value="${fuelType || ''}"`
        );

        // Replace Engine Number
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Engine Number:<\/td>\s*<td colspan="3">.*?value="[^"]*"/,
            `<tr><td class="label">Engine Number:</td><td colspan="3"><input type="text" value="${engineNumber || ''}"`
        );

        // Replace Chassis / VIN
        htmlTemplate = htmlTemplate.replace(
            /<tr>\s*<td class="label">Chassis \/ VIN:<\/td>\s*<td colspan="3">.*?value="[^"]*"/,
            `<tr><td class="label">Chassis / VIN:</td><td colspan="3"><input type="text" value="${chassisNumber || vehicleVIN || ''}"`
        );

        // Replace Inspection Result
        const finalInspectionResult = (inspectionResult || 'PASS').toUpperCase();
        const resultClass = finalInspectionResult === 'PASS' ? 'result-pass' : 'result-fail';
        htmlTemplate = htmlTemplate.replace(
            /<span class="result-badge result-pass">PASS<\/span>\s*<input type="hidden" id="inspectionResult" value="[^"]*">/,
            `<span class="result-badge ${resultClass}">${finalInspectionResult}</span><input type="hidden" id="inspectionResult" value="${finalInspectionResult}">`
        );

        // Replace Roadworthiness Status
        const finalRoadworthinessStatus = (roadworthinessStatus || 'ROADWORTHY').toUpperCase();
        const roadworthinessClass = finalRoadworthinessStatus === 'ROADWORTHY' ? 'status-roadworthy' : 'status-not-roadworthy';
        htmlTemplate = htmlTemplate.replace(
            /<span class="status-badge status-roadworthy">ROADWORTHY<\/span>\s*<input type="hidden" id="roadworthinessStatus" value="[^"]*">/,
            `<span class="status-badge ${roadworthinessClass}">${finalRoadworthinessStatus}</span><input type="hidden" id="roadworthinessStatus" value="${finalRoadworthinessStatus}">`
        );

        // Replace Inspection Notes
        if (inspectionNotes) {
            htmlTemplate = htmlTemplate.replace(
                /<textarea class="notes-field"[^>]*>.*?<\/textarea>/s,
                `<textarea class="notes-field" rows="3">${inspectionNotes}</textarea>`
            );
        }

        // Replace Inspector Name
        htmlTemplate = htmlTemplate.replace(
            /<input type="text" value="[^"]*" class="inspector-name">/,
            `<input type="text" value="${inspectorName || 'LTO Inspector'}" class="inspector-name">`
        );

        // Inline CSS for MVIR form
        const cssPath = path.join(this.templatesPath, 'mvir', 'mvir-form.css');
        try {
            const cssContent = await fs.readFile(cssPath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(
                /<link rel="stylesheet" href="mvir-form\.css">/,
                `<style>${cssContent}</style>`
            );
        } catch (cssError) {
            console.warn('[MVIR Certificate] Could not load CSS file:', cssError.message);
        }

        // Generate PDF
        const browser = await puppeteer.launch(this.getPuppeteerLaunchOptions());
        try {
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdfResult = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
            });

            await browser.close();

            const pdfBuffer = this.ensurePdfBuffer(pdfResult, 'MVIR');
            this.validatePdfBuffer(pdfBuffer, 'MVIR');
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                pdfBuffer,
                fileHash,
                certificateNumber: finalMvirNumber
            };
        } catch (error) {
            await browser.close();
            throw error;
        }
    }
}

module.exports = new CertificatePdfGenerator();
