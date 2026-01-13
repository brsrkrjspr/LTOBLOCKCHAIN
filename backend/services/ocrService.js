// TrustChain LTO - OCR Service
// Extracts text from documents and parses vehicle/owner information

// Lazy load OCR dependencies to avoid errors if packages not installed
let Tesseract, pdfParse, sharp;
try {
    Tesseract = require('tesseract.js');
} catch (e) {
    console.warn('Tesseract.js not installed. OCR will be limited.');
}
try {
    pdfParse = require('pdf-parse');
} catch (e) {
    console.warn('pdf-parse not installed. PDF OCR will be limited.');
}
try {
    sharp = require('sharp');
} catch (e) {
    console.warn('sharp not installed. Image preprocessing will be limited.');
}

const fs = require('fs').promises;
const path = require('path');

class OCRService {
    /**
     * Extract text from document (image or PDF)
     * @param {string} filePath - Path to the uploaded file
     * @param {string} mimeType - MIME type of the file
     * @returns {Promise<string>} Extracted text
     */
    async extractText(filePath, mimeType) {
        try {
            if (mimeType === 'application/pdf') {
                return await this.extractFromPDF(filePath);
            } else if (mimeType.startsWith('image/')) {
                return await this.extractFromImage(filePath);
            } else {
                throw new Error(`Unsupported file type: ${mimeType}`);
            }
        } catch (error) {
            console.error('OCR extraction error:', error);
            throw error;
        }
    }

    /**
     * Extract text from PDF file
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<string>} Extracted text
     */
    async extractFromPDF(filePath) {
        try {
            if (!pdfParse) {
                throw new Error('pdf-parse package not installed');
            }
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text || '';
        } catch (error) {
            console.error('PDF extraction error:', error);
            // If PDF parsing fails, try converting first page to image and OCR
            try {
                return await this.extractFromPDFAsImage(filePath);
            } catch (fallbackError) {
                console.error('PDF fallback extraction error:', fallbackError);
                throw new Error('Failed to extract text from PDF');
            }
        }
    }

    /**
     * Extract text from PDF by converting first page to image (fallback)
     */
    async extractFromPDFAsImage(filePath) {
        // This would require pdf-poppler or similar - for now, return empty
        // Can be enhanced later if needed
        console.warn('PDF to image conversion not implemented, returning empty text');
        return '';
    }

    /**
     * Extract text from image file using Tesseract OCR
     * @param {string} filePath - Path to image file
     * @returns {Promise<string>} Extracted text
     */
    async extractFromImage(filePath) {
        try {
            if (!Tesseract) {
                throw new Error('Tesseract.js package not installed');
            }
            
            // Preprocess image for better OCR results
            const processedImagePath = await this.preprocessImage(filePath);
            
            const { data: { text } } = await Tesseract.recognize(
                processedImagePath || filePath,
                'eng',
                {
                    logger: m => {
                        // Only log errors and warnings
                        if (m.status === 'recognizing text') {
                            // Suppress progress logs
                        } else {
                            console.log(`[OCR] ${m.status}`);
                        }
                    }
                }
            );

            // Clean up processed image if different from original
            if (processedImagePath && processedImagePath !== filePath) {
                try {
                    await fs.unlink(processedImagePath);
                } catch (cleanupError) {
                    console.warn('Failed to cleanup processed image:', cleanupError);
                }
            }

            return text || '';
        } catch (error) {
            console.error('Image OCR extraction error:', error);
            throw error;
        }
    }

    /**
     * Preprocess image for better OCR accuracy
     * @param {string} filePath - Path to image file
     * @returns {Promise<string>} Path to processed image (or original if processing fails)
     */
    async preprocessImage(filePath) {
        try {
            // Check if sharp is available
            if (!sharp) {
                return filePath; // Return original if sharp not available
            }

            const processedPath = filePath.replace(/\.[^.]+$/, '_processed.png');
            
            // Enhance image: grayscale, increase contrast, resize if too large
            await sharp(filePath)
                .greyscale()
                .normalize()
                .sharpen()
                .resize(2000, null, { 
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .toFile(processedPath);

            return processedPath;
        } catch (error) {
            console.warn('Image preprocessing failed, using original:', error);
            return filePath;
        }
    }

    /**
     * Parse vehicle information from extracted text
     * @param {string} text - Extracted text from document
     * @param {string} documentType - Type of document (registration_cert, owner_id, etc.)
     * @returns {Object} Extracted data
     */
    parseVehicleInfo(text, documentType) {
        const extracted = {};

        if (!text || text.trim().length === 0) {
            return extracted;
        }

        // Normalize text for better pattern matching
        const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');

        if (documentType === 'registration_cert' || documentType === 'registrationCert' || 
            documentType === 'or_cr' || documentType === 'orCr') {
            // Extract VIN/Chassis Number (17 characters, alphanumeric, excludes I, O, Q)
            const vinPattern = /(?:VIN|CHASSIS\s*(?:NO)?\.?)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
            const vinMatch = text.match(vinPattern);
            if (vinMatch) extracted.vin = vinMatch[1].trim();

            // Extract Engine Number
            const enginePattern = /(?:ENGINE\s*(?:NO)?\.?)\s*[:.]?\s*([A-Z0-9\-]{6,20})/i;
            const engineMatch = text.match(enginePattern);
            if (engineMatch) extracted.engineNumber = engineMatch[1].trim();

            // Extract Plate Number (Format: ABC-1234 or ABC 1234)
            const platePattern = /(?:PLATE\s*(?:NO)?\.?|PLATE\s*NUMBER)\s*[:.]?\s*([A-Z]{2,3}[-\s]?\d{3,4})/i;
            const plateMatch = text.match(platePattern);
            if (plateMatch) extracted.plateNumber = plateMatch[1].replace(/\s/g, '-').trim();

            // Extract Make/Brand
            const makePattern = /(?:MAKE|BRAND|MANUFACTURER)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)?)/i;
            const makeMatch = text.match(makePattern);
            if (makeMatch) extracted.make = makeMatch[1].trim();

            // Extract Model
            const modelPattern = /(?:MODEL|SERIES|TYPE)\s*[:.]?\s*([A-Z0-9\s\-]+?)(?:\s*(?:YEAR|ENGINE|COLOR|VIN)|$)/i;
            const modelMatch = text.match(modelPattern);
            if (modelMatch) extracted.model = modelMatch[1].trim();

            // Extract Year (4-digit year)
            const yearPattern = /(?:YEAR|MODEL\s*YEAR|MFG\.?\s*YEAR|MANUFACTURE\s*YEAR)\s*[:.]?\s*((?:19|20)\d{2})/i;
            const yearMatch = text.match(yearPattern);
            if (yearMatch) extracted.year = yearMatch[1].trim();

            // Extract Color
            const colorPattern = /(?:COLOR|COLOUR)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)?)/i;
            const colorMatch = text.match(colorPattern);
            if (colorMatch) extracted.color = colorMatch[1].trim();
        }

        if (documentType === 'owner_id' || documentType === 'ownerId' || 
            documentType === 'seller_id' || documentType === 'buyer_id') {
            // Extract Name (various formats)
            const namePatterns = [
                /(?:NAME|FULL\s*NAME|COMPLETE\s*NAME)\s*[:.]?\s*([A-Z\s,]+?)(?:\s*(?:ADDRESS|DATE|BIRTH|ID)|$)/i,
                /^([A-Z]+(?:\s+[A-Z]+)+)/m // First line if all caps
            ];

            for (const pattern of namePatterns) {
                const nameMatch = text.match(pattern);
                if (nameMatch) {
                    const fullName = nameMatch[1].trim();
                    const nameParts = fullName.split(/[,\s]+/).filter(Boolean);
                    if (nameParts.length >= 2) {
                        extracted.lastName = nameParts[0];
                        extracted.firstName = nameParts.slice(1).join(' ');
                    } else if (nameParts.length === 1) {
                        extracted.firstName = nameParts[0];
                    }
                    break;
                }
            }

            // Extract Address
            const addressPatterns = [
                /(?:ADDRESS|RESIDENCE|HOME\s*ADDRESS)\s*[:.]?\s*(.+?)(?:\s*(?:DATE|BIRTH|ID|PHONE|CONTACT)|$)/i,
                /(?:ADDRESS|RESIDENCE)\s*[:.]?\s*([^\n]{10,200})/i
            ];

            for (const pattern of addressPatterns) {
                const addressMatch = text.match(pattern);
                if (addressMatch) {
                    extracted.address = addressMatch[1].trim();
                    break;
                }
            }

            // Extract Phone Number
            const phonePattern = /(?:PHONE|CONTACT|MOBILE|TEL)\s*[:.]?\s*([\+\d\s\-\(\)]{10,20})/i;
            const phoneMatch = text.match(phonePattern);
            if (phoneMatch) extracted.phone = phoneMatch[1].trim();
        }

        if (documentType === 'insurance_cert' || documentType === 'insuranceCert') {
            // Extract Policy Number
            const policyPattern = /(?:POLICY\s*(?:NO|NUMBER)?\.?)\s*[:.]?\s*([A-Z0-9\-]+)/i;
            const policyMatch = text.match(policyPattern);
            if (policyMatch) extracted.insurancePolicyNumber = policyMatch[1].trim();

            // Extract Expiry Date
            const expiryPattern = /(?:EXPIR|VALID\s*UNTIL|EFFECTIVE\s*TO|EXPIRY)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
            const expiryMatch = text.match(expiryPattern);
            if (expiryMatch) extracted.insuranceExpiry = expiryMatch[1].trim();
        }

        return extracted;
    }

    /**
     * Extract patterns from text (generic method)
     * @param {string} text - Text to extract from
     * @returns {Object} Extracted data
     */
    extractPatterns(text) {
        return this.parseVehicleInfo(text, 'registration_cert');
    }
}

module.exports = new OCRService();
