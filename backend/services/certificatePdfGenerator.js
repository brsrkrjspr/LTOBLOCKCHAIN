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

        // Replace placeholders in template
        htmlTemplate = htmlTemplate
            .replace(/{{POLICY_NUMBER}}/g, policyNumber)
            .replace(/{{OWNER_NAME}}/g, ownerName)
            .replace(/{{VEHICLE_VIN}}/g, vehicleVIN)
            .replace(/{{COVERAGE_TYPE}}/g, coverageType)
            .replace(/{{COVERAGE_AMOUNT}}/g, coverageAmount)
            .replace(/{{EFFECTIVE_DATE}}/g, new Date(effectiveDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }))
            .replace(/{{EXPIRY_DATE}}/g, new Date(expiryDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }))
            .replace(/{{ADDITIONAL_COVERAGE}}/g, additionalCoverage || 'Standard Coverage')
            .replace(/{{ISSUE_DATE}}/g, new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }));

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

        // Replace placeholders
        htmlTemplate = htmlTemplate
            .replace(/{{CERTIFICATE_NUMBER}}/g, certificateNumber)
            .replace(/{{OWNER_NAME}}/g, ownerName)
            .replace(/{{VEHICLE_VIN}}/g, vehicleVIN)
            .replace(/{{VEHICLE_PLATE}}/g, vehiclePlate || 'PENDING')
            .replace(/{{TEST_DATE}}/g, new Date(testDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }))
            .replace(/{{EXPIRY_DATE}}/g, new Date(expiryDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }))
            .replace(/{{CO_LEVEL}}/g, testResults?.co || '0.5')
            .replace(/{{HC_LEVEL}}/g, testResults?.hc || '100')
            .replace(/{{NOX_LEVEL}}/g, testResults?.nox || '0.3')
            .replace(/{{SMOKE_OPACITY}}/g, testResults?.smoke || '15');

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

        // Replace placeholders
        htmlTemplate = htmlTemplate
            .replace(/{{CLEARANCE_NUMBER}}/g, clearanceNumber)
            .replace(/{{OWNER_NAME}}/g, ownerName)
            .replace(/{{VEHICLE_VIN}}/g, vehicleVIN)
            .replace(/{{VEHICLE_PLATE}}/g, vehiclePlate || 'PENDING')
            .replace(/{{ISSUE_DATE}}/g, new Date(issueDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }))
            .replace(/{{VERIFICATION_DETAILS}}/g, verificationDetails || 'No adverse record found');

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
}

module.exports = new CertificatePdfGenerator();
