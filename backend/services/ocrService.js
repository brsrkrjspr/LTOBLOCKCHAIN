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
            // #region agent log
            console.log('[OCR Debug] extractText called:', {filePath, mimeType});
            // #endregion
            
            let extractedText = '';
            if (mimeType === 'application/pdf') {
                extractedText = await this.extractFromPDF(filePath);
            } else if (mimeType.startsWith('image/')) {
                extractedText = await this.extractFromImage(filePath);
            } else {
                throw new Error(`Unsupported file type: ${mimeType}`);
            }
            
            // #region agent log
            console.log('[OCR Debug] Text extraction result:', {
                mimeType,
                textLength: extractedText ? extractedText.length : 0,
                textPreview: extractedText ? extractedText.substring(0, 500) : 'NO TEXT',
                hasText: !!extractedText && extractedText.length > 0
            });
            // #endregion
            
            return extractedText;
        } catch (error) {
            console.error('[OCR Debug] OCR extraction error:', error);
            throw error;
        }
    }

    /**
     * Extract text from PDF file
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<string>} Extracted text
     */
    async extractFromPDF(filePath) {
        // #region agent log
        console.log('[OCR Debug] Starting PDF extraction:', { filePath });
        // #endregion
        
        // Pre-extraction validation
        try {
            const stats = await fs.stat(filePath);
            
            // #region agent log
            console.log('[OCR Debug] PDF file validation:', {
                filePath,
                fileSize: stats.size,
                isReadable: true,
                isValidSize: stats.size > 0
            });
            // #endregion
            
            if (stats.size === 0) {
                console.error('[OCR Debug] ERROR: PDF file is empty (size = 0)');
                return '';
            }
            
            if (stats.size > 50 * 1024 * 1024) { // 50MB limit
                console.warn('[OCR Debug] WARNING: PDF file is very large (', stats.size, 'bytes). Extraction may be slow.');
            }
        } catch (statError) {
            console.error('[OCR Debug] ERROR: Cannot read PDF file stats:', statError.message);
            return '';
        }
        
        // Primary extraction method: pdf-parse (text layer extraction)
        try {
            if (!pdfParse) {
                console.error('[OCR Debug] pdf-parse package not installed');
                throw new Error('pdf-parse package not installed');
            }
            
            // #region agent log
            console.log('[OCR Debug] Attempting primary extraction method: pdf-parse (text layer)');
            // #endregion
            
            const dataBuffer = await fs.readFile(filePath);
            
            // Validate PDF structure (basic check - PDF files start with %PDF)
            const pdfHeader = dataBuffer.toString('ascii', 0, Math.min(4, dataBuffer.length));
            if (pdfHeader !== '%PDF') {
                console.warn('[OCR Debug] WARNING: File may not be a valid PDF (header check failed). Attempting extraction anyway...');
            }
            
            const data = await pdfParse(dataBuffer);
            const extractedText = data.text || '';
            
            // #region agent log
            console.log('[OCR Debug] PDF text extraction result (pdf-parse):', {
                textLength: extractedText.length,
                textPreview: extractedText.substring(0, 500),
                hasText: extractedText.length > 0,
                pageCount: data.numpages || 0
            });
            // #endregion
            
            // Text quality validation
            if (extractedText && extractedText.trim().length > 0) {
                // Check for expected keywords (indicates successful extraction)
                const normalizedText = extractedText.toUpperCase();
                const hasKeywords = /LICENSE|ID|PASSPORT|DRIVER|NAME|ADDRESS|NUMBER/.test(normalizedText);
                
                // #region agent log
                console.log('[OCR Debug] Text quality check:', {
                    textLength: extractedText.length,
                    hasKeywords: hasKeywords,
                    keywordCheck: 'PASSED' // Will be updated below
                });
                // #endregion
                
                if (hasKeywords || extractedText.length > 50) {
                    // #region agent log
                    console.log('[OCR Debug] Primary extraction method SUCCESS: Text extracted with acceptable quality');
                    // #endregion
                    return extractedText;
                } else {
                    console.warn('[OCR Debug] WARNING: Extracted text exists but lacks expected keywords. Text may be low quality.');
                }
            }
            
            // If text is empty or low quality, try fallback
            if (!extractedText || extractedText.trim().length === 0) {
                console.warn('[OCR Debug] WARNING: PDF parsed but extracted text is empty! Attempting fallback method...');
            } else {
                console.warn('[OCR Debug] WARNING: Extracted text quality is low. Attempting fallback method for better results...');
            }
            
            // Fallback 1: PDF to image OCR (first page only)
            try {
                console.log('[OCR Debug] Attempting fallback method 1: PDF to image OCR (first page)');
                const fallbackText = await this.extractFromPDFAsImage(filePath);
                if (fallbackText && fallbackText.trim().length > 0) {
                    // #region agent log
                    console.log('[OCR Debug] Fallback method 1 SUCCESS:', {
                        textLength: fallbackText.length,
                        textPreview: fallbackText.substring(0, 500)
                    });
                    // #endregion
                    return fallbackText;
                }
            } catch (fallbackError) {
                console.error('[OCR Debug] Fallback method 1 failed:', fallbackError.message);
            }
            
            // If we got some text from primary method, return it even if quality is low
            if (extractedText && extractedText.trim().length > 0) {
                console.warn('[OCR Debug] Returning text from primary method despite low quality (fallback failed)');
                return extractedText;
            }
            
            return ''; // Return empty if all methods failed
            
        } catch (error) {
            console.error('[OCR Debug] Primary PDF extraction error:', {
                error: error.message,
                errorType: error.name,
                stack: error.stack
            });
            
            // Fallback 2: PDF to image OCR (when primary method fails completely)
            try {
                console.log('[OCR Debug] Attempting fallback method 2: PDF to image OCR (error recovery)');
                const fallbackText = await this.extractFromPDFAsImage(filePath);
                if (fallbackText && fallbackText.trim().length > 0) {
                    // #region agent log
                    console.log('[OCR Debug] Fallback method 2 SUCCESS:', {
                        textLength: fallbackText.length,
                        textPreview: fallbackText.substring(0, 500)
                    });
                    // #endregion
                    return fallbackText;
                }
            } catch (fallbackError) {
                console.error('[OCR Debug] Fallback method 2 also failed:', fallbackError.message);
            }
            
            // All extraction methods failed
            console.error('[OCR Debug] ERROR: All PDF extraction methods failed. Returning empty string.');
            return ''; // Return empty string instead of throwing to allow graceful handling
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

        // #region agent log
        console.log('[OCR Debug] parseVehicleInfo called:', {
            documentType,
            hasText: !!text,
            textLength: text ? text.length : 0,
            textPreview: text ? text.substring(0, 300) : 'NO TEXT'
        });
        // #endregion

        // Validate input parameters
        if (!documentType) {
            console.warn('[OCR Debug] WARNING: documentType is undefined or null. Using default: registration_cert');
            documentType = 'registration_cert';
        }

        if (!text || text.trim().length === 0) {
            // #region agent log
            console.log('[OCR Debug] WARNING: No text extracted from document! Returning empty object.');
            // #endregion
            return extracted;
        }

        // Validate text is a string
        if (typeof text !== 'string') {
            console.error('[OCR Debug] ERROR: text parameter is not a string. Type:', typeof text);
            return extracted;
        }

        // Normalize text for better pattern matching
        const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
        
        // #region agent log
        console.log('[OCR Debug] Document type check:', {
            documentType,
            isOwnerId: documentType === 'owner_id' || documentType === 'ownerId' || documentType === 'ownerValidId',
            isRegistrationCert: documentType === 'registration_cert' || documentType === 'registrationCert' || documentType === 'or_cr' || documentType === 'orCr'
        });
        // #endregion

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

        // Process owner ID documents with error handling
        if (documentType === 'owner_id' || documentType === 'ownerId' || 
            documentType === 'ownerValidId' ||
            documentType === 'seller_id' || documentType === 'buyer_id') {
            // #region agent log
            console.log('[OCR Debug] Processing owner ID document type:', {
                documentType,
                textLength: text.length,
                textSample: text.substring(0, 500)
            });
            // #endregion
            
            try {
            
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
            
            // #region agent log
            console.log('[OCR Debug] Starting ID Type/Number extraction for owner_id document:', {
                documentType: documentType,
                textLength: text.length,
                textPreview: text.substring(0, 300),
                normalizedTextPreview: text.toUpperCase().replace(/\s+/g, ' ').substring(0, 300)
            });
            // #endregion
            
            // Extract ID Type (from document headers or common patterns)
            // Strategy 1: Check document title/header (first 200 chars) - most reliable
            // Strategy 2: Check entire text with patterns
            
            const idTypeMap = {
                'driver': 'drivers-license',
                'license': 'drivers-license',
                'dl': 'drivers-license',
                'passport': 'passport',
                'pp': 'passport',
                'national': 'national-id',
                'nid': 'national-id',
                'philippine': 'national-id',
                'philid': 'national-id',
                'postal': 'postal-id',
                'voter': 'voters-id',
                'sss': 'sss-id',
                'social': 'sss-id',
                'security': 'sss-id'
            };
            
            // Strategy 1: Scan document title/header (first 200 chars) - most reliable location
            const documentHeader = text.substring(0, 200).toUpperCase();
            const headerPatterns = [
                // Driver's License patterns (most common)
                /DRIVER['\s]*S?\s*LICENSE/i,
                /DRIVER\s*LICENSE/i,
                /\bDL\b/i,
                /\bLICENSE\b/i,
                // Passport
                /PASSPORT/i,
                /\bPP\b/i,
                // National ID
                /NATIONAL\s*ID/i,
                /\bNID\b/i,
                /PHILIPPINE\s*IDENTIFICATION/i,
                /PHILID/i,
                // Postal ID
                /POSTAL\s*ID/i,
                // Voter's ID
                /VOTER['\s]*S?\s*ID/i,
                /VOTER['\s]*S?\s*REGISTRATION/i,
                // SSS ID
                /SSS\s*ID/i,
                /SOCIAL\s*SECURITY/i
            ];
            
            // #region agent log
            console.log('[OCR Debug] Strategy 1: Scanning document header (first 200 chars) for ID Type');
            console.log('[OCR Debug] Document header preview:', documentHeader.substring(0, 100));
            // #endregion
            
            let foundInHeader = false;
            for (let i = 0; i < headerPatterns.length && !foundInHeader; i++) {
                const pattern = headerPatterns[i];
                const match = documentHeader.match(pattern);
                if (match) {
                    const matchedText = match[0].toLowerCase();
                    // #region agent log
                    console.log('[OCR Debug] ID Type found in document header:', {
                        patternIndex: i,
                        pattern: pattern.toString(),
                        matchedText,
                        matchContext: documentHeader.substring(Math.max(0, match.index - 20), Math.min(documentHeader.length, match.index + match[0].length + 20))
                    });
                    // #endregion
                    for (const [key, value] of Object.entries(idTypeMap)) {
                        if (matchedText.includes(key)) {
                            extracted.idType = value;
                            foundInHeader = true;
                            // #region agent log
                            console.log('[OCR Debug] ID Type extracted from header successfully:', {
                                matchedText,
                                key,
                                value,
                                idType: extracted.idType
                            });
                            // #endregion
                            break;
                        }
                    }
                }
            }
            
            // Strategy 2: If not found in header, scan entire text
            if (!extracted.idType) {
                // #region agent log
                console.log('[OCR Debug] Strategy 2: ID Type not found in header, scanning entire text');
                // #endregion
                
                const idTypePatterns = [
                    // Driver's License patterns (most common)
                    /DRIVER['\s]*S?\s*LICENSE/i,
                    /DRIVER\s*LICENSE/i,
                    /\bDL\b/i,
                    /\bLICENSE\b/i,
                    // Passport
                    /PASSPORT/i,
                    /\bPP\b/i,
                    // National ID
                    /NATIONAL\s*ID/i,
                    /\bNID\b/i,
                    /PHILIPPINE\s*IDENTIFICATION/i,
                    /PHILID/i,
                    // Postal ID
                    /POSTAL\s*ID/i,
                    // Voter's ID
                    /VOTER['\s]*S?\s*ID/i,
                    /VOTER['\s]*S?\s*REGISTRATION/i,
                    // SSS ID
                    /SSS\s*ID/i,
                    /SOCIAL\s*SECURITY/i
                ];
                
                // #region agent log
                console.log('[OCR Debug] Attempting ID Type extraction with', idTypePatterns.length, 'patterns on full text');
                // #endregion
                
                for (let i = 0; i < idTypePatterns.length; i++) {
                    const pattern = idTypePatterns[i];
                    const match = text.match(pattern);
                    
                    // #region agent log
                    if (!match && i === 0) {
                        // Log first pattern attempt for debugging
                        console.log('[OCR Debug] ID Type pattern attempt', i + 1, ':', {
                            pattern: pattern.toString(),
                            matched: false
                        });
                    }
                    // #endregion
                    
                    if (match) {
                        const matchedText = match[0].toLowerCase();
                        // #region agent log
                        console.log('[OCR Debug] ID Type pattern matched in full text:', {
                            patternIndex: i,
                            pattern: pattern.toString(),
                            matchedText,
                            matchContext: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + match[0].length + 20))
                        });
                        // #endregion
                        for (const [key, value] of Object.entries(idTypeMap)) {
                            if (matchedText.includes(key)) {
                                extracted.idType = value;
                                // #region agent log
                                console.log('[OCR Debug] ID Type extracted from full text successfully:', {
                                    matchedText,
                                    key,
                                    value,
                                    idType: extracted.idType
                                });
                                // #endregion
                                break;
                            }
                        }
                        if (extracted.idType) break;
                    }
                }
            }
            
            // #region agent log
            if (!extracted.idType) {
                console.log('[OCR Debug] ID Type not found after trying all strategies. Text sample:', text.substring(0, 500));
                console.log('[OCR Debug] Normalized text sample (for pattern debugging):', text.toUpperCase().replace(/\s+/g, ' ').substring(0, 500));
            }
            // #endregion
            
            // Extract ID Number (various formats)
            // Priority order: specific patterns first, then generic
            // #region agent log
            console.log('[OCR Debug] Starting ID Number extraction');
            // #endregion
            
            const idNumberPatterns = [
                // Pattern 1: "LICENSE NO: D12-34-567890" or "LICENSE NO. D12-34-567890" (most specific)
                /(?:LICENSE\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z]\d{2}[\-]\d{2}[\-]\d{6,})/i,
                // Pattern 2: "ID NO: D12-34-567890" or "ID NUMBER: D12-34-567890"
                /(?:ID\s*(?:NO|NUMBER|#)\.?|IDENTIFICATION\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                // Pattern 3: "LICENSE NO: " followed by alphanumeric (catch-all for license numbers)
                /(?:LICENSE\s*(?:NO|NUMBER|#)\.?|PASSPORT\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z0-9\-]+)/i,
                // Pattern 4: Standalone patterns like "D12-34-567890" (Driver's License format: D##-##-######)
                /\b([A-Z]\d{2}[\-]\d{2}[\-]\d{6,})\b/g,
                // Pattern 5: Generic standalone ID numbers like A01-23-456789, N123456789, PP1234567
                /\b([A-Z]{1,3}[\d\-]{8,15})\b/g,
                // Pattern 6: Numeric IDs like 01-23-456789
                /\b(\d{2}[\-]?\d{2}[\-]?\d{6,10})\b/g
            ];
            
            for (let i = 0; i < idNumberPatterns.length; i++) {
                const pattern = idNumberPatterns[i];
                const isGlobalPattern = pattern.global;
                
                // #region agent log
                if (i === 0) {
                    console.log('[OCR Debug] ID Number pattern attempt', i + 1, ':', {
                        pattern: pattern.toString(),
                        isGlobal: isGlobalPattern
                    });
                }
                // #endregion
                
                let idNumber = null;
                let matchFound = false;
                
                if (isGlobalPattern) {
                    // For global patterns, use exec() to get capture groups properly
                    // Reset pattern lastIndex to ensure we start from beginning
                    pattern.lastIndex = 0;
                    let match;
                    while ((match = pattern.exec(text)) !== null) {
                        matchFound = true;
                        // match[0] is full match, match[1] is first capture group
                        if (match[1]) {
                            idNumber = match[1].trim();
                            // #region agent log
                            console.log('[OCR Debug] ID Number pattern matched (global):', {
                                patternIndex: i,
                                pattern: pattern.toString(),
                                fullMatch: match[0],
                                captureGroup: match[1],
                                matchIndex: match.index
                            });
                            // #endregion
                            break; // Use first match
                        }
                    }
                } else {
                    // For non-global patterns, use match() which returns array with capture groups
                    const matches = text.match(pattern);
                    if (matches) {
                        matchFound = true;
                        // matches[0] is full match, matches[1] is first capture group
                        if (matches[1]) {
                            idNumber = matches[1].trim();
                        } else if (matches[0]) {
                            // Fallback to full match if no capture group
                            idNumber = matches[0].trim();
                        }
                        
                        // #region agent log
                        console.log('[OCR Debug] ID Number pattern matched (non-global):', {
                            patternIndex: i,
                            pattern: pattern.toString(),
                            fullMatch: matches[0],
                            captureGroup: matches[1],
                            matchIndex: matches.index
                        });
                        // #endregion
                    }
                }
                
                if (matchFound && idNumber) {
                    // Clean up ID number (remove extra spaces, normalize dashes)
                    idNumber = idNumber.replace(/\s+/g, '').replace(/[^\w\-]/g, '').toUpperCase();
                    
                    // #region agent log
                    console.log('[OCR Debug] ID Number candidate:', {
                        idNumber,
                        length: idNumber.length,
                        isValid: idNumber.length >= 6 && idNumber.length <= 20 && /[A-Z0-9]/.test(idNumber),
                        validationDetails: {
                            minLength: idNumber.length >= 6,
                            maxLength: idNumber.length <= 20,
                            hasAlphanumeric: /[A-Z0-9]/.test(idNumber)
                        }
                    });
                    // #endregion
                    
                    // Enhanced validation: check length, format, and content
                    const isValidLength = idNumber.length >= 6 && idNumber.length <= 20;
                    const hasAlphanumeric = /[A-Z0-9]/.test(idNumber);
                    const hasReasonableFormat = /^[A-Z0-9\-]+$/.test(idNumber);
                    
                    if (isValidLength && hasAlphanumeric && hasReasonableFormat) {
                        extracted.idNumber = idNumber;
                        // #region agent log
                        console.log('[OCR Debug] ID Number extracted successfully:', {
                            idNumber: extracted.idNumber,
                            patternIndex: i,
                            pattern: pattern.toString()
                        });
                        // #endregion
                        break;
                    } else {
                        // #region agent log
                        console.log('[OCR Debug] ID Number candidate failed validation:', {
                            idNumber,
                            reasons: {
                                length: !isValidLength,
                                alphanumeric: !hasAlphanumeric,
                                format: !hasReasonableFormat
                            }
                        });
                        // #endregion
                    }
                }
            }
            
            // #region agent log
            if (!extracted.idNumber) {
                console.log('[OCR Debug] ID Number not found after trying', idNumberPatterns.length, 'patterns. Text sample:', text.substring(0, 500));
                console.log('[OCR Debug] Normalized text sample (for pattern debugging):', text.toUpperCase().replace(/\s+/g, ' ').substring(0, 500));
            }
            console.log('[OCR Debug] Final extracted data for owner_id:', {
                hasIdType: !!extracted.idType,
                hasIdNumber: !!extracted.idNumber,
                idType: extracted.idType,
                idNumber: extracted.idNumber,
                allExtractedFields: Object.keys(extracted),
                extractionSuccess: !!(extracted.idType && extracted.idNumber)
            });
            // #endregion
            } catch (ownerIdError) {
                console.error('[OCR Debug] ERROR processing owner ID document:', {
                    error: ownerIdError.message,
                    errorName: ownerIdError.name,
                    stack: ownerIdError.stack,
                    documentType: documentType,
                    textLength: text ? text.length : 0
                });
                // Return partial results if any fields were extracted before error
                // (graceful degradation)
                // extracted object may already have some fields populated
            }
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

        if (documentType === 'sales_invoice' || documentType === 'salesInvoice') {
            // Extract Vehicle Information from Sales Invoice
            // VIN/Chassis Number
            const vinPattern = /(?:VIN|CHASSIS\s*(?:NO|NUMBER)?\.?|FRAME\s*NO\.?)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
            const vinMatch = text.match(vinPattern);
            if (vinMatch) extracted.vin = vinMatch[1].trim();

            // Engine Number
            const enginePattern = /(?:ENGINE\s*(?:NO|NUMBER)?\.?|MOTOR\s*NO\.?)\s*[:.]?\s*([A-Z0-9\-]{6,20})/i;
            const engineMatch = text.match(enginePattern);
            if (engineMatch) extracted.engineNumber = engineMatch[1].trim();

            // Chassis Number (if different from VIN)
            const chassisPattern = /(?:CHASSIS\s*(?:NO|NUMBER)?\.?)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{10,17})/i;
            const chassisMatch = text.match(chassisPattern);
            if (chassisMatch && !extracted.vin) extracted.chassisNumber = chassisMatch[1].trim();

            // Make/Brand
            const makePattern = /(?:MAKE|BRAND|MANUFACTURER|CAR\s*MAKE)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)?)/i;
            const makeMatch = text.match(makePattern);
            if (makeMatch) extracted.make = makeMatch[1].trim();

            // Model
            const modelPattern = /(?:MODEL|SERIES|TYPE|CAR\s*MODEL)\s*[:.]?\s*([A-Z0-9\s\-]+?)(?:\s*(?:YEAR|ENGINE|COLOR|VIN|PRICE|AMOUNT)|$)/i;
            const modelMatch = text.match(modelPattern);
            if (modelMatch) extracted.model = modelMatch[1].trim();

            // Year
            const yearPattern = /(?:YEAR|MODEL\s*YEAR|MFG\.?\s*YEAR|MANUFACTURE\s*YEAR)\s*[:.]?\s*((?:19|20)\d{2})/i;
            const yearMatch = text.match(yearPattern);
            if (yearMatch) extracted.year = yearMatch[1].trim();

            // Color
            const colorPattern = /(?:COLOR|COLOUR|PAINT)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)?)/i;
            const colorMatch = text.match(colorPattern);
            if (colorMatch) extracted.color = colorMatch[1].trim();

            // Owner/Buyer Information from Sales Invoice
            const buyerPatterns = [
                /(?:BUYER|CUSTOMER|PURCHASER|SOLD\s*TO)\s*[:.]?\s*([A-Z\s,]+?)(?:\s*(?:ADDRESS|TIN|DATE|INVOICE)|$)/i,
                /(?:NAME\s*OF\s*BUYER|CUSTOMER\s*NAME)\s*[:.]?\s*([A-Z\s,]+?)(?:\s*(?:ADDRESS|TIN|DATE)|$)/i
            ];
            for (const pattern of buyerPatterns) {
                const buyerMatch = text.match(pattern);
                if (buyerMatch) {
                    const fullName = buyerMatch[1].trim();
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

            // Buyer Address
            const buyerAddressPatterns = [
                /(?:BUYER\s*ADDRESS|CUSTOMER\s*ADDRESS|ADDRESS\s*OF\s*BUYER)\s*[:.]?\s*(.+?)(?:\s*(?:TIN|DATE|INVOICE|TOTAL)|$)/i,
                /(?:ADDRESS)\s*[:.]?\s*([^\n]{10,200})/i
            ];
            for (const pattern of buyerAddressPatterns) {
                const addressMatch = text.match(pattern);
                if (addressMatch) {
                    extracted.address = addressMatch[1].trim();
                    break;
                }
            }

            // Buyer Phone
            const buyerPhonePattern = /(?:BUYER\s*PHONE|CUSTOMER\s*PHONE|CONTACT|MOBILE|TEL)\s*[:.]?\s*([\+\d\s\-\(\)]{10,20})/i;
            const phoneMatch = text.match(buyerPhonePattern);
            if (phoneMatch) extracted.phone = phoneMatch[1].trim();
        }

        if (documentType === 'csr' || documentType === 'certificateOfStockReport' || documentType === 'certificate_of_stock_report') {
            // Extract Vehicle Information from CSR (Certificate of Stock Report)
            // VIN/Chassis Number
            const vinPattern = /(?:VIN|CHASSIS\s*(?:NO|NUMBER)?\.?|FRAME\s*NO\.?)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
            const vinMatch = text.match(vinPattern);
            if (vinMatch) extracted.vin = vinMatch[1].trim();

            // Engine Number
            const enginePattern = /(?:ENGINE\s*(?:NO|NUMBER)?\.?|MOTOR\s*NO\.?)\s*[:.]?\s*([A-Z0-9\-]{6,20})/i;
            const engineMatch = text.match(enginePattern);
            if (engineMatch) extracted.engineNumber = engineMatch[1].trim();

            // Chassis Number
            const chassisPattern = /(?:CHASSIS\s*(?:NO|NUMBER)?\.?)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{10,17})/i;
            const chassisMatch = text.match(chassisPattern);
            if (chassisMatch) extracted.chassisNumber = chassisMatch[1].trim();

            // Make/Brand
            const makePattern = /(?:MAKE|BRAND|MANUFACTURER)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)?)/i;
            const makeMatch = text.match(makePattern);
            if (makeMatch) extracted.make = makeMatch[1].trim();

            // Model
            const modelPattern = /(?:MODEL|SERIES|TYPE)\s*[:.]?\s*([A-Z0-9\s\-]+?)(?:\s*(?:YEAR|ENGINE|COLOR|VIN|STOCK)|$)/i;
            const modelMatch = text.match(modelPattern);
            if (modelMatch) extracted.model = modelMatch[1].trim();

            // Year
            const yearPattern = /(?:YEAR|MODEL\s*YEAR|MFG\.?\s*YEAR)\s*[:.]?\s*((?:19|20)\d{2})/i;
            const yearMatch = text.match(yearPattern);
            if (yearMatch) extracted.year = yearMatch[1].trim();

            // Color
            const colorPattern = /(?:COLOR|COLOUR)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)?)/i;
            const colorMatch = text.match(colorPattern);
            if (colorMatch) extracted.color = colorMatch[1].trim();

            // CSR Number
            const csrNumberPattern = /(?:CSR\s*(?:NO|NUMBER)|CERTIFICATE\s*(?:NO|NUMBER)|STOCK\s*REPORT\s*(?:NO|NUMBER))\s*[:.]?\s*([A-Z0-9\-]+)/i;
            const csrNumberMatch = text.match(csrNumberPattern);
            if (csrNumberMatch) extracted.csrNumber = csrNumberMatch[1].trim();
        }

        if (documentType === 'hpg_clearance' || documentType === 'hpgClearance' || documentType === 'pnpHpgClearance') {
            // Extract from HPG Clearance Certificate
            // Clearance Number
            const clearanceNumberPattern = /(?:CLEARANCE\s*(?:NO|NUMBER)|CERTIFICATE\s*(?:NO|NUMBER)|MV\s*CLEARANCE\s*(?:NO|NUMBER))\s*[:.]?\s*([A-Z0-9\-]+)/i;
            const clearanceMatch = text.match(clearanceNumberPattern);
            if (clearanceMatch) extracted.clearanceNumber = clearanceMatch[1].trim();

            // Vehicle details (similar to registration cert)
            const vinPattern = /(?:VIN|CHASSIS\s*(?:NO)?\.?)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
            const vinMatch = text.match(vinPattern);
            if (vinMatch) extracted.vin = vinMatch[1].trim();

            const enginePattern = /(?:ENGINE\s*(?:NO)?\.?)\s*[:.]?\s*([A-Z0-9\-]{6,20})/i;
            const engineMatch = text.match(enginePattern);
            if (engineMatch) extracted.engineNumber = engineMatch[1].trim();

            const platePattern = /(?:PLATE\s*(?:NO)?\.?|PLATE\s*NUMBER)\s*[:.]?\s*([A-Z]{2,3}[-\s]?\d{3,4})/i;
            const plateMatch = text.match(platePattern);
            if (plateMatch) extracted.plateNumber = plateMatch[1].replace(/\s/g, '-').trim();
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

    /**
     * Extract insurance information from document
     * @param {string} filePath - Path to insurance document
     * @param {string} mimeType - MIME type of the file
     * @returns {Promise<Object>} Extracted insurance data
     */
    async extractInsuranceInfo(filePath, mimeType) {
        try {
            const text = await this.extractText(filePath, mimeType);
            const extracted = this.parseVehicleInfo(text, 'insurance_cert');
            
            // Additional insurance-specific extraction
            const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
            
            // Extract Insurance Company Name
            const companyPatterns = [
                /(?:INSURANCE\s*COMPANY|INSURER|INSURED\s*BY|COMPANY)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)+)/i,
                /([A-Z]+(?:\s+[A-Z]+)?)\s*(?:INSURANCE|INSURANCE\s*COMPANY)/i
            ];
            for (const pattern of companyPatterns) {
                const match = text.match(pattern);
                if (match) {
                    extracted.insuranceCompany = match[1].trim();
                    break;
                }
            }
            
            // Extract Policy Type
            const policyTypePattern = /(?:POLICY\s*TYPE|TYPE\s*OF\s*POLICY|COVERAGE\s*TYPE)\s*[:.]?\s*(COMPREHENSIVE|CTPL|THIRD\s*PARTY|LIABILITY)/i;
            const policyTypeMatch = text.match(policyTypePattern);
            if (policyTypeMatch) {
                extracted.policyType = policyTypeMatch[1].trim();
            }
            
            // Extract Issue Date
            const issueDatePattern = /(?:ISSUE\s*DATE|ISSUED|EFFECTIVE\s*FROM|DATE\s*ISSUED)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
            const issueDateMatch = text.match(issueDatePattern);
            if (issueDateMatch) {
                extracted.issueDate = issueDateMatch[1].trim();
            }
            
            // Extract Coverage Amount
            const coveragePattern = /(?:COVERAGE|SUM\s*INSURED|AMOUNT)\s*[:.]?\s*(?:PHP|₱|PESO)?\s*([\d,]+)/i;
            const coverageMatch = text.match(coveragePattern);
            if (coverageMatch) {
                extracted.coverage = coverageMatch[1].replace(/,/g, '');
            }
            
            return extracted;
        } catch (error) {
            console.error('Error extracting insurance info:', error);
            return {};
        }
    }

    /**
     * Extract emission test information from document
     * @param {string} filePath - Path to emission document
     * @param {string} mimeType - MIME type of the file
     * @returns {Promise<Object>} Extracted emission data
     */
    async extractEmissionInfo(filePath, mimeType) {
        try {
            const text = await this.extractText(filePath, mimeType);
            const extracted = {};
            
            if (!text || text.trim().length === 0) {
                return extracted;
            }
            
            const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
            
            // Extract Test Date
            const testDatePatterns = [
                /(?:TEST\s*DATE|DATE\s*OF\s*TEST|TESTED\s*ON)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
                /(?:TEST\s*DATE)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
            ];
            for (const pattern of testDatePatterns) {
                const match = text.match(pattern);
                if (match) {
                    extracted.testDate = match[1].trim();
                    break;
                }
            }
            
            // Extract Expiry Date
            const expiryPattern = /(?:EXPIR|VALID\s*UNTIL|EXPIRY\s*DATE|VALID\s*UNTIL)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
            const expiryMatch = text.match(expiryPattern);
            if (expiryMatch) {
                extracted.expiryDate = expiryMatch[1].trim();
            }
            
            // Extract Test Center
            const testCenterPattern = /(?:TEST\s*CENTER|TESTING\s*CENTER|CENTER|FACILITY)\s*[:.]?\s*([A-Z]+(?:\s+[A-Z]+)+)/i;
            const testCenterMatch = text.match(testCenterPattern);
            if (testCenterMatch) {
                extracted.testCenter = testCenterMatch[1].trim();
            }
            
            // Extract Test Results - CO (Carbon Monoxide)
            const coPattern = /(?:CO|CARBON\s*MONOXIDE)\s*[:.]?\s*(\d+\.?\d*)\s*%/i;
            const coMatch = text.match(coPattern);
            if (coMatch) {
                extracted.co = parseFloat(coMatch[1]);
            }
            
            // Extract Test Results - HC (Hydrocarbons)
            const hcPattern = /(?:HC|HYDROCARBONS)\s*[:.]?\s*(\d+\.?\d*)\s*(?:PPM|ppm)/i;
            const hcMatch = text.match(hcPattern);
            if (hcMatch) {
                extracted.hc = parseFloat(hcMatch[1]);
            }
            
            // Extract Test Results - Smoke Opacity
            const smokePattern = /(?:SMOKE|OPACITY|SMOKE\s*OPACITY)\s*[:.]?\s*(\d+\.?\d*)\s*%/i;
            const smokeMatch = text.match(smokePattern);
            if (smokeMatch) {
                extracted.smoke = parseFloat(smokeMatch[1]);
            }
            
            // Extract Certificate Number
            const certNumberPattern = /(?:CERTIFICATE\s*(?:NO|NUMBER)|CERT\s*(?:NO|NUMBER))\s*[:.]?\s*([A-Z0-9\-]+)/i;
            const certNumberMatch = text.match(certNumberPattern);
            if (certNumberMatch) {
                extracted.certificateNumber = certNumberMatch[1].trim();
            }
            
            // Extract Test Result Status
            const statusPattern = /(?:RESULT|STATUS)\s*[:.]?\s*(PASSED|FAILED|PASS|FAIL)/i;
            const statusMatch = text.match(statusPattern);
            if (statusMatch) {
                extracted.status = statusMatch[1].toUpperCase();
            }
            
            return extracted;
        } catch (error) {
            console.error('Error extracting emission info:', error);
            return {};
        }
    }

    /**
     * Extract HPG-related information from registration cert and owner ID
     * @param {string} registrationCertPath - Path to registration certificate
     * @param {string} ownerIdPath - Path to owner ID document
     * @param {string} registrationMimeType - MIME type of registration cert
     * @param {string} ownerIdMimeType - MIME type of owner ID
     * @returns {Promise<Object>} Extracted HPG data
     */
    async extractHPGInfo(registrationCertPath, ownerIdPath, registrationMimeType, ownerIdMimeType) {
        try {
            const extracted = {};
            
            // Extract from registration certificate
            if (registrationCertPath) {
                const regText = await this.extractText(registrationCertPath, registrationMimeType);
                const regData = this.parseVehicleInfo(regText, 'registration_cert');
                
                extracted.engineNumber = regData.engineNumber;
                extracted.chassisNumber = regData.vin || regData.chassisNumber;
                extracted.plateNumber = regData.plateNumber;
                extracted.vin = regData.vin;
                extracted.make = regData.make;
                extracted.model = regData.model;
                extracted.year = regData.year;
                extracted.color = regData.color;
            }
            
            // Extract from owner ID
            if (ownerIdPath) {
                const ownerText = await this.extractText(ownerIdPath, ownerIdMimeType);
                const ownerData = this.parseVehicleInfo(ownerText, 'owner_id');
                
                extracted.ownerFirstName = ownerData.firstName;
                extracted.ownerLastName = ownerData.lastName;
                extracted.ownerAddress = ownerData.address;
                extracted.ownerPhone = ownerData.phone;
            }
            
            return extracted;
        } catch (error) {
            console.error('Error extracting HPG info:', error);
            return {};
        }
    }
}

module.exports = new OCRService();
