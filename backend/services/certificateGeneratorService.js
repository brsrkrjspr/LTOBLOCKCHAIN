// TrustChain LTO - Certificate Generator Service
// DEPRECATED: This service is no longer used for certificate generation.
// 
// ⚠️ DEPRECATION NOTICE (Effective: 2026-01-17):
// Certificate generation by LTO system has been discontinued.
// 
// REASON:
// LTO cannot legally generate insurance or HPG certificates.
// These must be issued by authorized external organizations only:
// - Insurance Certificates: Issued by Insurance Companies
// - (Emission certificates removed from this system)
// - HPG Clearances: Issued by Philippine National Police - HPG
// 
// NEW PROCESS:
// 1. External organizations issue certificates using /backend/routes/issuer.js
// 2. Vehicle owners upload certificates using /backend/routes/certificate-upload.js
// 3. System verifies authenticity by matching file hashes against blockchain
// 
// MIGRATION DEADLINE: 2026-02-17
// After this date, all methods in this service will throw errors.
// 
// For questions or migration assistance, see:
// - CERTIFICATE_ARCHITECTURE_MIGRATION.md (migration guide)
// - backend/routes/issuer.js (external issuer APIs)
// - backend/routes/certificate-upload.js (owner upload system)

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
     * @param {string} type - Certificate type: 'insurance', 'hpg'
     * @param {string} vehicleVIN - Vehicle VIN
     * @param {number} sequence - Sequence number (from database)
     * @returns {string} Certificate number
     */
    generateCertificateNumber(type, vehicleVIN, sequence = 1) {
        const certificateNumberGenerator = require('../utils/certificateNumberGenerator');
        return certificateNumberGenerator.generateCertificateNumber(type, { sequence });
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
                executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
     * DEPRECATED - Generate Insurance Certificate
     * @deprecated Use POST /api/issuer/insurance/issue-certificate instead
     * @param {Object} vehicleData - Vehicle information
     * @param {Object} ownerData - Owner information
     * @param {string} certificateNumber - Certificate number (optional, will generate if not provided)
     * @returns {Promise<Object>} Certificate data with PDF buffer and hash
     */
    async generateInsuranceCertificate(vehicleData, ownerData, certificateNumber = null) {
        console.error('❌ DEPRECATED METHOD: generateInsuranceCertificate()');
        console.error('   Use POST /api/issuer/insurance/issue-certificate instead');
        console.error('   This method will be removed on 2026-02-17');
        
        throw new Error(
            'DEPRECATED: generateInsuranceCertificate() is no longer supported.\n' +
            'Insurance certificates must be issued by authorized insurance companies.\n' +
            'Use POST /api/issuer/insurance/issue-certificate instead.\n' +
            'Migration deadline: 2026-02-17'
        );
    }

    /**
     * DEPRECATED - Generate HPG Clearance Certificate
     * @deprecated Use POST /api/issuer/hpg/issue-clearance instead
     * @param {Object} vehicleData - Vehicle information
     * @param {Object} ownerData - Owner information
     * @param {string} certificateNumber - Certificate number (optional)
     * @returns {Promise<Object>} Certificate data with PDF buffer and hash
     */
    async generateHPGClearance(vehicleData, ownerData, certificateNumber = null) {
        console.error('❌ DEPRECATED METHOD: generateHPGClearance()');
        console.error('   Use POST /api/issuer/hpg/issue-clearance instead');
        console.error('   This method will be removed on 2026-02-17');
        
        throw new Error(
            'DEPRECATED: generateHPGClearance() is no longer supported.\n' +
            'HPG clearances must be issued by the Philippine National Police - Highway Patrol Group.\n' +
            'Use POST /api/issuer/hpg/issue-clearance instead.\n' +
            'Migration deadline: 2026-02-17'
        );
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
