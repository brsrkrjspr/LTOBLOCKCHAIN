// TrustChain LTO - Transfer Document Generator
// Generates a compact PDF package for transfer demo/record purposes.

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

class TransferDocumentGeneratorService {
    constructor() {
        this.outputPath = path.join(__dirname, '../../uploads/transfer-packages');
        this.ensureOutputDirectory();
    }

    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.outputPath, { recursive: true });
        } catch (error) {
            console.error('Error creating transfer packages directory:', error);
        }
    }

    buildHtml({ transferRequest, vehicle, seller, buyer, deadline }) {
        const safe = value => value || '—';
        const expiryText = deadline ? new Date(deadline).toLocaleString() : '—';
        const createdAt = transferRequest?.created_at ? new Date(transferRequest.created_at).toLocaleString() : '—';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Transfer Package</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
        h1 { margin: 0 0 4px 0; font-size: 22px; }
        h2 { margin: 16px 0 6px 0; font-size: 16px; }
        .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
        .row { display: flex; flex-wrap: wrap; }
        .col { flex: 1; min-width: 220px; margin-right: 12px; }
        .muted { color: #6b7280; font-size: 12px; }
        .pill { display: inline-block; padding: 4px 8px; border-radius: 12px; background: #e0f2fe; color: #075985; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        td { padding: 6px 4px; vertical-align: top; }
        td.label { width: 180px; color: #4b5563; font-weight: 600; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }
    </style>
</head>
<body>
    <h1>Transfer of Ownership Package</h1>
    <div class="muted">Transfer ID: ${safe(transferRequest?.id)} • Created: ${createdAt}</div>
    <div class="pill">Deadline: ${expiryText}</div>

    <div class="card">
        <h2>Vehicle</h2>
        <table>
            <tr><td class="label">Plate</td><td>${safe(vehicle?.plate_number || vehicle?.plateNumber)}</td></tr>
            <tr><td class="label">VIN</td><td>${safe(vehicle?.vin)}</td></tr>
            <tr><td class="label">Make/Model</td><td>${safe(vehicle?.make)} / ${safe(vehicle?.model)}</td></tr>
            <tr><td class="label">Year</td><td>${safe(vehicle?.year)}</td></tr>
        </table>
    </div>

    <div class="row">
        <div class="card col">
            <h2>Seller</h2>
            <table>
                <tr><td class="label">Name</td><td>${safe(seller?.name)}</td></tr>
                <tr><td class="label">Email</td><td>${safe(seller?.email)}</td></tr>
            </table>
        </div>
        <div class="card col">
            <h2>Buyer</h2>
            <table>
                <tr><td class="label">Name</td><td>${safe(buyer?.name)}</td></tr>
                <tr><td class="label">Email</td><td>${safe(buyer?.email)}</td></tr>
            </table>
        </div>
    </div>

    <div class="card">
        <h2>Notes</h2>
        <p>This package is system-generated to summarize the transfer request, parties, and deadline for document submission.</p>
    </div>
</body>
</html>`;
    }

    async htmlToPDF(htmlContent) {
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: true,
                executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            return await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
            });
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async generateTransferPackage({ transferRequest, vehicle, seller, buyer, deadline }) {
        await this.ensureOutputDirectory();
        const html = this.buildHtml({ transferRequest, vehicle, seller, buyer, deadline });
        const pdfBuffer = await this.htmlToPDF(html);

        const filename = `transfer-package-${transferRequest?.id || Date.now()}.pdf`;
        const filePath = path.join(this.outputPath, filename);
        await fs.writeFile(filePath, pdfBuffer);

        const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

        return {
            filename,
            filePath,
            fileHash,
            mimeType: 'application/pdf',
            fileSize: pdfBuffer.length
        };
    }
}

module.exports = new TransferDocumentGeneratorService();
