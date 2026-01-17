// TrustChain LTO - Certificate Generator Service
// Generates PDF certificates from HTML templates

const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const crypto = require('crypto');

class CertificateGeneratorService {
    constructor() {
        this.templatesPath = path.join(__dirname, '../templates/certificates');
        this.outputPath = path.join(__dirname, '../../uploads/certificates');
        this.ensureOutputDirectory();
    }

    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.outputPath, { recursive: true });
        } catch (error) {
            console.error('Error creating certificates directory:', error);
        }
    }

    /**
     * Generate unique certificate number
     * @param {string} type - Certificate type: 'insurance', 'emission', 'hpg'
     * @param {string} vehicleVIN - Vehicle VIN
     * @param {number} sequence - Sequence number (from database)
     * @returns {string} Certificate number
     */
    generateCertificateNumber(type, vehicleVIN, sequence = 1) {
        const year = new Date().getFullYear();
        const date = new Date();
        const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

        switch (type) {
            case 'insurance':
                return `CTPL-${year}-${String(sequence).padStart(6, '0')}`;
            case 'emission':
                return `ETC-${dateStr}-${String(sequence).padStart(3, '0')}`;
            case 'hpg':
                return `HPG-${year}-${String(sequence).padStart(6, '0')}`;
            default:
                throw new Error(`Unknown certificate type: ${type}`);
        }
    }

    /**
     * Load and compile HTML template
     * @param {string} templateName - Template filename (without extension)
     * @returns {Promise<HandlebarsTemplateDelegate>} Compiled template
     */
    async loadTemplate(templateName) {
        try {
            const templatePath = path.join(this.templatesPath, `${templateName}.html`);
            const templateContent = await fs.readFile(templatePath, 'utf8');
            return handlebars.compile(templateContent);
        } catch (error) {
            console.error(`Error loading template ${templateName}:`, error);
            throw new Error(`Failed to load template: ${templateName}`);
        }
    }

    /**
     * Render template with data
     * @param {HandlebarsTemplateDelegate} template - Compiled template
     * @param {Object} data - Template data
     * @returns {string} Rendered HTML
     */
    renderTemplate(template, data) {
        return template(data);
    }

    /**
     * Convert HTML to PDF using Puppeteer
     * @param {string} htmlContent - Rendered HTML content
     * @returns {Promise<Buffer>} PDF buffer
     */
    async htmlToPDF(htmlContent) {
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            
            await page.setContent(htmlContent, {
                waitUntil: 'networkidle0'
            });

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: {
                    top: '0',
                    right: '0',
                    bottom: '0',
                    left: '0'
                }
            });

            return pdfBuffer;
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw new Error(`PDF generation failed: ${error.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Calculate SHA-256 hash of PDF buffer
     * @param {Buffer} pdfBuffer - PDF file buffer
     * @returns {string} SHA-256 hash (hex)
     */
    calculateFileHash(pdfBuffer) {
        return crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    }

    /**
     * Format date for certificate display
     * @param {Date} date - Date object
     * @param {string} format - Format type: 'short', 'long', 'iso'
     * @returns {string} Formatted date
     */
    formatDate(date, format = 'short') {
        if (!date) return '';
        
        const d = date instanceof Date ? date : new Date(date);
        
        if (format === 'long') {
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else if (format === 'iso') {
            return d.toISOString().split('T')[0];
        } else {
            // Short format: DD-MMM-YYYY
            const day = String(d.getDate()).padStart(2, '0');
            const month = d.toLocaleDateString('en-US', { month: 'short' });
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        }
    }

    /**
     * Generate Insurance Certificate
     * @param {Object} vehicleData - Vehicle information
     * @param {Object} ownerData - Owner information
     * @param {string} certificateNumber - Certificate number (optional, will generate if not provided)
     * @returns {Promise<Object>} Certificate data with PDF buffer and hash
     */
    async generateInsuranceCertificate(vehicleData, ownerData, certificateNumber = null) {
        try {
            const template = await this.loadTemplate('insurance-certificate');
            
            const effectiveDate = new Date();
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            const data = {
                policyNumber: certificateNumber || this.generateCertificateNumber('insurance', vehicleData.vin, 1),
                companyName: 'LTO Insurance Services',
                companyAddress: 'Land Transportation Office, Quezon City',
                companyContact: '(02) 1234-5678',
                companyLicense: '001-CTPL-2025',
                effectiveDate: this.formatDate(effectiveDate),
                expiryDate: this.formatDate(expiryDate),
                bodilyInjuryCoverage: 'PHP 100,000 per person / PHP 200,000 per accident',
                propertyDamageCoverage: 'PHP 50,000 per accident',
                coverageType: 'Third-Party Liability Only',
                vehicleType: vehicleData.vehicle_type || 'Motorcycle',
                make: vehicleData.make,
                model: vehicleData.model,
                engineNumber: vehicleData.engine_number || 'N/A',
                chassisNumber: vehicleData.chassis_number || 'N/A',
                plateNumber: vehicleData.plate_number || 'To be issued',
                ownerName: `${ownerData.first_name || ''} ${ownerData.last_name || ''}`.trim(),
                ownerAddress: ownerData.address || 'N/A',
                signatoryName: 'LTO Insurance Manager',
                signatoryPosition: 'CTPL Department Manager'
            };

            const html = this.renderTemplate(template, data);
            const pdfBuffer = await this.htmlToPDF(html);
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                success: true,
                certificateNumber: data.policyNumber,
                pdfBuffer,
                fileHash,
                data,
                type: 'insurance'
            };
        } catch (error) {
            console.error('Error generating insurance certificate:', error);
            throw error;
        }
    }

    /**
     * Generate Emission Certificate
     * @param {Object} vehicleData - Vehicle information
     * @param {Object} ownerData - Owner information
     * @param {string} certificateNumber - Certificate number (optional)
     * @returns {Promise<Object>} Certificate data with PDF buffer and hash
     */
    async generateEmissionCertificate(vehicleData, ownerData, certificateNumber = null) {
        try {
            const template = await this.loadTemplate('emission-certificate');
            
            const issueDate = new Date();
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            const data = {
                certificateNumber: certificateNumber || this.generateCertificateNumber('emission', vehicleData.vin, 1),
                ownerName: `${ownerData.first_name || ''} ${ownerData.last_name || ''}`.trim(),
                ownerAddress: ownerData.address || 'N/A',
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                bodyType: vehicleData.vehicle_type || 'Sedan',
                color: vehicleData.color || 'N/A',
                engineNumber: vehicleData.engine_number || 'N/A',
                chassisVIN: vehicleData.vin,
                plateNumber: vehicleData.plate_number || 'N/A',
                fuelType: vehicleData.fuel_type || 'Gasoline',
                coLevel: '0.20% - Pass',
                hcLevel: '120 ppm - Pass',
                noxLevel: '0.25% - Pass',
                smokeOpacity: '18% - Pass',
                overallResult: 'PASS',
                inspectorName: 'Engr. LTO Emission Inspector',
                issueDate: this.formatDate(issueDate, 'short'),
                expiryDate: this.formatDate(expiryDate, 'short')
            };

            const html = this.renderTemplate(template, data);
            const pdfBuffer = await this.htmlToPDF(html);
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                success: true,
                certificateNumber: data.certificateNumber,
                pdfBuffer,
                fileHash,
                data,
                type: 'emission'
            };
        } catch (error) {
            console.error('Error generating emission certificate:', error);
            throw error;
        }
    }

    /**
     * Generate HPG Clearance Certificate
     * @param {Object} vehicleData - Vehicle information
     * @param {Object} ownerData - Owner information
     * @param {string} certificateNumber - Certificate number (optional)
     * @returns {Promise<Object>} Certificate data with PDF buffer and hash
     */
    async generateHPGClearance(vehicleData, ownerData, certificateNumber = null) {
        try {
            const template = await this.loadTemplate('hpg-clearance');
            
            const issueDate = new Date();

            const data = {
                certificateNumber: certificateNumber || this.generateCertificateNumber('hpg', vehicleData.vin, 1),
                dateIssued: this.formatDate(issueDate, 'long'),
                statement: 'This is to certify that the motor vehicle described below has been verified by the Philippine National Police – Highway Patrol Group and is found to be FREE FROM ANY POLICE RECORD, HOLD, LIEN, ENCUMBRANCE, OR CRIMINAL CASE as of the date of issuance of this certificate.',
                ownerName: `${ownerData.first_name || ''} ${ownerData.last_name || ''}`.trim(),
                ownerAddress: ownerData.address || 'N/A',
                make: vehicleData.make,
                model: vehicleData.model,
                year: vehicleData.year,
                bodyType: vehicleData.vehicle_type || 'Sedan',
                color: vehicleData.color || 'N/A',
                engineNumber: vehicleData.engine_number || 'N/A',
                chassisVIN: vehicleData.vin,
                plateNumber: vehicleData.plate_number || 'N/A',
                purpose: 'This clearance is issued for the purpose of vehicle registration, transfer of ownership, and other lawful transactions.',
                officerName: 'P/Supt. LTO HPG Officer',
                officerPosition: 'Authorized Officer, PNP-HPG'
            };

            const html = this.renderTemplate(template, data);
            const pdfBuffer = await this.htmlToPDF(html);
            const fileHash = this.calculateFileHash(pdfBuffer);

            return {
                success: true,
                certificateNumber: data.certificateNumber,
                pdfBuffer,
                fileHash,
                data,
                type: 'hpg'
            };
        } catch (error) {
            console.error('Error generating HPG clearance:', error);
            throw error;
        }
    }

    /**
     * Save PDF to file system
     * @param {Buffer} pdfBuffer - PDF buffer
     * @param {string} filename - Filename
     * @returns {Promise<string>} File path
     */
    async savePDF(pdfBuffer, filename) {
        try {
            const filePath = path.join(this.outputPath, filename);
            await fs.writeFile(filePath, pdfBuffer);
            return filePath;
        } catch (error) {
            console.error('Error saving PDF:', error);
            throw error;
        }
    }
}

module.exports = new CertificateGeneratorService();
