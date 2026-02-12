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
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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
            console.log('[OCR Debug] extractText called:', { filePath, mimeType });
            // #endregion

            // Validate mimeType
            if (!mimeType) {
                console.warn('[OCR Debug] WARNING: mimeType is undefined or null. Attempting to infer from file extension.');
                // Try to infer from file extension as fallback
                const ext = filePath.split('.').pop()?.toLowerCase();
                if (ext === 'pdf') {
                    mimeType = 'application/pdf';
                } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) {
                    mimeType = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
                } else {
                    console.error('[OCR Debug] ERROR: Cannot determine mimeType. Returning empty text.');
                    return '';
                }
            }

            let extractedText = '';
            try {
                if (mimeType === 'application/pdf') {
                    extractedText = await this.extractFromPDF(filePath);
                } else if (mimeType.startsWith('image/')) {
                    extractedText = await this.extractFromImage(filePath);
                } else {
                    console.warn('[OCR Debug] WARNING: Unsupported file type:', mimeType);
                    return ''; // Return empty instead of throwing
                }
            } catch (extractionError) {
                console.error('[OCR Debug] ERROR during text extraction:', {
                    error: extractionError.message,
                    errorName: extractionError.name,
                    mimeType,
                    filePath
                });
                return ''; // Return empty string instead of throwing
            }

            // #region agent log
            console.log('[OCR Debug] Text extraction result:', {
                mimeType,
                textLength: extractedText ? extractedText.length : 0,
                textPreview: extractedText ? extractedText.substring(0, 500) : 'NO TEXT',
                hasText: !!extractedText && extractedText.length > 0
            });
            // #endregion

            return extractedText || ''; // Ensure we always return a string
        } catch (error) {
            console.error('[OCR Debug] Unexpected error in extractText:', {
                error: error.message,
                errorName: error.name,
                stack: error.stack
            });
            return ''; // Return empty string instead of throwing to prevent route crashes
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
     * Extract text from PDF by converting to images and using Tesseract OCR
     * Fallback for image-only PDFs where pdf-parse returns no text
     * Supports up to 5 pages per PDF (configurable via OCR_MAX_PAGES)
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<string>} Extracted text from all pages
     */
    async extractFromPDFAsImage(filePath) {
        const maxPages = parseInt(process.env.OCR_MAX_PAGES) || 5;
        const tempDir = process.env.OCR_TEMP_DIR || path.join(__dirname, '../temp-ocr');
        const timeout = parseInt(process.env.OCR_TIMEOUT) || 30000;

        // Ensure temp directory exists
        try {
            await fs.mkdir(tempDir, { recursive: true });
        } catch (mkdirError) {
            console.error('[OCR Debug] Failed to create temp directory:', mkdirError.message);
            return ''; // Graceful degradation
        }

        const baseName = path.basename(filePath, path.extname(filePath));
        const outputPattern = path.join(tempDir, `${baseName}-%d.png`);
        const outputBase = path.join(tempDir, baseName);

        let imageFiles = [];
        let extractedText = '';

        try {
            // Convert PDF to images using pdftoppm
            // -png: output PNG format
            // -f 1: start from page 1
            // -l N: limit to N pages (maxPages)
            const command = `pdftoppm -png -f 1 -l ${maxPages} "${filePath}" "${outputBase}"`;

            console.log('[OCR Debug] Converting PDF to images:', {
                command: command,
                outputPattern: outputPattern,
                maxPages: maxPages
            });

            // Execute with timeout
            const { stdout, stderr } = await Promise.race([
                execAsync(command, { maxBuffer: 10 * 1024 * 1024 }), // 10MB buffer
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('PDF conversion timeout')), timeout)
                )
            ]);

            if (stderr && !stderr.includes('Writing')) {
                console.warn('[OCR Debug] pdftoppm stderr:', stderr);
            }

            // Find generated image files
            const files = await fs.readdir(tempDir);
            imageFiles = files
                .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
                .sort((a, b) => {
                    // Sort by page number (e.g., doc-1.png, doc-2.png)
                    const numA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
                    const numB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
                    return numA - numB;
                })
                .map(f => path.join(tempDir, f));

            console.log('[OCR Debug] Generated images from PDF:', {
                count: imageFiles.length,
                files: imageFiles.map(f => path.basename(f))
            });

            if (imageFiles.length === 0) {
                console.warn('[OCR Debug] No images generated from PDF');
                return '';
            }

            // Process each image with OCR
            for (const imagePath of imageFiles) {
                try {
                    console.log('[OCR Debug] Running Tesseract OCR on:', path.basename(imagePath));
                    const pageText = await this.extractFromImage(imagePath);
                    if (pageText && pageText.trim().length > 0) {
                        extractedText += pageText + '\n\n';
                    }
                } catch (imageError) {
                    console.error('[OCR Debug] Error processing image:', {
                        image: path.basename(imagePath),
                        error: imageError.message
                    });
                    // Continue with other pages
                }
            }

            console.log('[OCR Debug] Tesseract OCR result:', {
                textLength: extractedText.length,
                hasText: extractedText.trim().length > 0,
                pagesProcessed: imageFiles.length
            });

        } catch (error) {
            console.error('[OCR Debug] PDF to image conversion error:', {
                error: error.message,
                errorName: error.name,
                filePath: path.basename(filePath)
            });

            // Check if pdftoppm is installed
            if (error.message.includes('pdftoppm') || error.code === 'ENOENT') {
                console.error('[OCR Debug] ERROR: pdftoppm command not found. Install with: sudo apt-get install poppler-utils');
            }

            return ''; // Graceful degradation
        } finally {
            // Cleanup temp images
            const shouldCleanup = process.env.OCR_CLEANUP_ON_SUCCESS !== 'false' &&
                process.env.OCR_CLEANUP_ON_ERROR !== 'false';

            if (shouldCleanup) {
                for (const imageFile of imageFiles) {
                    try {
                        await fs.unlink(imageFile);
                    } catch (cleanupError) {
                        console.warn('[OCR Debug] Failed to cleanup temp image:', cleanupError.message);
                    }
                }
            }
        }

        return extractedText.trim();
    }

    /**
     * Extract text from image file using Tesseract OCR
     * @param {string} filePath - Path to image file
     * @returns {Promise<string>} Extracted text
     */
    async extractFromImage(filePath) {
        try {
            if (!Tesseract) {
                console.warn('[OCR Debug] WARNING: Tesseract.js package not installed. Image OCR unavailable.');
                return ''; // Return empty instead of throwing
            }

            // Preprocess image for better OCR results
            let processedImagePath = filePath;
            try {
                processedImagePath = await this.preprocessImage(filePath);
            } catch (preprocessError) {
                console.warn('[OCR Debug] Image preprocessing failed, using original:', preprocessError.message);
                processedImagePath = filePath; // Fallback to original
            }

            let text = '';
            try {
                const result = await Tesseract.recognize(
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
                text = result?.data?.text || '';
            } catch (ocrError) {
                console.error('[OCR Debug] Tesseract OCR error:', {
                    error: ocrError.message,
                    errorName: ocrError.name,
                    filePath
                });
                return ''; // Return empty instead of throwing
            }

            // Clean up processed image if different from original
            if (processedImagePath && processedImagePath !== filePath) {
                try {
                    await fs.unlink(processedImagePath);
                } catch (cleanupError) {
                    console.warn('[OCR Debug] Failed to cleanup processed image:', cleanupError.message);
                }
            }

            return text || '';
        } catch (error) {
            console.error('[OCR Debug] Unexpected error in extractFromImage:', {
                error: error.message,
                errorName: error.name,
                stack: error.stack
            });
            return ''; // Return empty string instead of throwing to prevent route crashes
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
     * Validate ID number format based on ID type
     * @param {string} idNumber - ID number to validate
     * @param {string} idType - Type of ID (drivers-license, passport, etc.)
     * @returns {Object} Validation result with confidence score
     */
    validateIDFormat(idNumber, idType) {
        if (!idNumber || !idType) {
            return { valid: false, confidence: 0, reason: 'Missing idNumber or idType' };
        }

        const cleaned = idNumber.replace(/\s+/g, '').toUpperCase();

        // Format-specific validation patterns
        const formatPatterns = {
            'drivers-license': /^[A-Z]\d{2}-\d{2}-\d{6,}$/,
            'passport': /^[A-Z]{2}\d{7}$/,
            'national-id': /^\d{4}-\d{4}-\d{4}-\d{4}$/,
            'postal-id': /^[A-Z]{2,3}\d{6,9}$|^\d{8,10}$/,
            'voters-id': /^\d{4}-\d{4}-\d{4}$/,
            'sss-id': /^\d{2}-\d{7}-\d{1}$/,
            'philhealth-id': /^\d{2}-\d{7}-\d{2}$/,
            'tin': /^\d{3}-\d{3}-\d{3}-\d{3}$/
        };

        const pattern = formatPatterns[idType];
        if (!pattern) {
            return { valid: false, confidence: 0, reason: `Unknown ID type: ${idType}` };
        }

        const isValid = pattern.test(cleaned);
        return {
            valid: isValid,
            confidence: isValid ? 1.0 : 0.0,
            reason: isValid ? 'Valid format' : `Invalid ${idType} format`
        };
    }

    /**
     * PATTERN-FIRST: Identify ID type(s) from format alone (no keywords required)
     * Tests an ID number string against ALL format patterns and returns matching types
     * @param {string} idNumber - Raw ID number to test (e.g., "1234-5678-9101-1213")
     * @returns {Object} { matchingTypes: Array, primaryType: String|null, confidence: Number, ambiguous: Boolean }
     *   matchingTypes: Array of {type, confidence} for all patterns that match
     *   primaryType: Single best match (highest confidence), or null if no matches
     *   confidence: Confidence of primaryType match (0-1.0)
     *   ambiguous: True if multiple types matched (collision case)
     */
    identifyIDTypeFromFormat(idNumber) {
        if (!idNumber || typeof idNumber !== 'string') {
            return {
                matchingTypes: [],
                primaryType: null,
                confidence: 0,
                ambiguous: false,
                reason: 'Invalid input'
            };
        }

        const cleaned = idNumber.replace(/\s+/g, '').toUpperCase();
        const matchingTypes = [];

        // ALL format validation patterns - tested in this order
        const allPatterns = {
            'national-id': {
                pattern: /^\d{4}-\d{4}-\d{4}-\d{4}$/,
                specificity: 95,
                reason: '4-4-4-4 format is unique to National ID'
            },
            'philhealth-id': {
                pattern: /^\d{2}-\d{7}-\d{2}$/,
                specificity: 90,
                reason: '2-7-2 format matches PhilHealth (11 total digits)'
            },
            'sss-id': {
                pattern: /^\d{2}-\d{7}-\d{1}$/,
                specificity: 90,
                reason: '2-7-1 format matches SSS ID (10 total digits)'
            },
            'drivers-license': {
                pattern: /^[A-Z]\d{2}-\d{2}-\d{6,}$/,
                specificity: 85,
                reason: '[A-Z]2-2-6+ format unique to Driver License'
            },
            'tin': {
                pattern: /^\d{3}-\d{3}-\d{3}-\d{3}$/,
                specificity: 80,
                reason: '3-3-3-3 format (12 digits) matches TIN'
            },
            'voters-id': {
                pattern: /^\d{4}-\d{4}-\d{4}$/,
                specificity: 70,
                reason: '4-4-4 format (12 digits) matches Voters ID'
            },
            'postal-id': {
                pattern: /^[A-Z]{2,3}\d{6,9}$|^\d{8,10}$/,
                specificity: 60,
                reason: 'Letters+digits or numeric-only format'
            },
            'passport': {
                pattern: /^[A-Z]{2}\d{7}$/,
                specificity: 75,
                reason: '2 letters + 7 digits format'
            }
        };

        // Test against all patterns
        for (const [idType, { pattern, specificity, reason }] of Object.entries(allPatterns)) {
            if (pattern.test(cleaned)) {
                matchingTypes.push({
                    type: idType,
                    confidence: 1.0,
                    specificity: specificity,
                    reason: reason
                });

                // #region agent log
                console.log('[OCR Debug] Pattern match found for ID type:', {
                    idNumber: cleaned,
                    idType: idType,
                    specificity: specificity,
                    reason: reason
                });
                // #endregion
            }
        }

        // Sort by specificity (highest first)
        matchingTypes.sort((a, b) => b.specificity - a.specificity);

        const result = {
            matchingTypes: matchingTypes,
            primaryType: matchingTypes.length > 0 ? matchingTypes[0].type : null,
            confidence: matchingTypes.length > 0 ? matchingTypes[0].confidence : 0,
            ambiguous: matchingTypes.length > 1,
            cleanedNumber: cleaned
        };

        // #region agent log
        if (matchingTypes.length > 1) {
            console.warn('[OCR Debug] AMBIGUOUS ID FORMAT - Multiple types matched:', {
                idNumber: cleaned,
                matchingTypes: matchingTypes.map(m => ({ type: m.type, specificity: m.specificity })),
                warning: 'Format alone cannot disambiguate. Use keyword proximity or user confirmation.'
            });
        } else if (matchingTypes.length === 0) {
            console.warn('[OCR Debug] NO FORMAT MATCH - ID number does not match any known format:', {
                idNumber: cleaned,
                length: cleaned.length,
                suggestion: 'Fall back to keyword detection or manual verification'
            });
        } else {
            console.log('[OCR Debug] UNAMBIGUOUS FORMAT MATCH:', {
                idNumber: cleaned,
                primaryType: result.primaryType,
                confidence: result.confidence
            });
        }
        // #endregion

        return result;
    }

    /**
     * Get format-specific regex patterns for ID number extraction
     * @param {string} idType - Type of ID (drivers-license, passport, etc.)
     * @returns {Array} Array of regex patterns prioritized by specificity
     */
    getIDNumberPatterns(idType) {
        const patterns = {
            'drivers-license': [
                // Pattern 1: "LICENSE NO: D12-34-567890" or "N03-12-123456" (most specific with context)
                /(?:LICENSE\s*(?:NO|NUMBER|#)\.?|DRIVER['\s]*S?\s*LICENSE\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z]\d{2}-\d{2}-\d{6,})/i,
                // Pattern 2: Standalone "D12-34-567890" or "N03-12-123456" format
                /\b([A-Z]\d{2}-\d{2}-\d{6,})\b/g
            ],
            'passport': [
                // Pattern 1: "PASSPORT NO: AA1234567" (most specific with context)
                /(?:PASSPORT\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z]{2}\d{7})/i,
                // Pattern 2: Standalone "AA1234567" format
                /\b([A-Z]{2}\d{7})\b/g
            ],
            'national-id': [
                // Pattern 1: "NATIONAL ID: 1234-5678-9101-1213" or "CRN: 1234-5678-9101-1213" (16 digits, 4-4-4-4 format)
                /(?:NATIONAL\s*ID|CRN|PHILID)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*(\d{4}-\d{4}-\d{4}-\d{4})/i,
                // Pattern 2: Standalone "1234-5678-9101-1213" format
                /\b(\d{4}-\d{4}-\d{4}-\d{4})\b/g
            ],
            'postal-id': [
                // Pattern 1: "POSTAL ID: AB123456" or "POSTAL ID NO: AB123456"
                /(?:POSTAL\s*ID)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z]{2,3}\d{6,9}|\d{8,10})/i,
                // Pattern 2: Standalone format
                /\b([A-Z]{2,3}\d{6,9}|\d{8,10})\b/g
            ],
            'voters-id': [
                // Pattern 1: "VOTER['\s]*S?\s*ID: 1234-5678-9012"
                /(?:VOTER['\s]*S?\s*ID)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*(\d{4}-\d{4}-\d{4})/i,
                // Pattern 2: Standalone "1234-5678-9012" format
                /\b(\d{4}-\d{4}-\d{4})\b/g
            ],
            'sss-id': [
                // Pattern 1: "SSS ID: 12-3456789-0" or "SSS NO: 12-3456789-0"
                /(?:SSS)\s*(?:ID|NO|NUMBER|#)\.?\s*[:.]?\s*(\d{2}-\d{7}-\d{1})/i,
                // Pattern 2: Standalone "12-3456789-0" format
                /\b(\d{2}-\d{7}-\d{1})\b/g
            ],
            'philhealth-id': [
                // Pattern 1: "PHILHEALTH ID: 12-345678901-2" or "PIN: 12-345678901-2"
                /(?:PHILHEALTH|PHIC|PIN)\s*(?:ID|NO|NUMBER|#)\.?\s*[:.]?\s*(\d{2}-\d{7}-\d{2})/i,
                // Pattern 2: Standalone "12-345678901-2" format
                /\b(\d{2}-\d{7}-\d{2})\b/g
            ],
            'tin': [
                // Pattern 1: "TIN: 123-456-789-000" or "TAX ID: 123-456-789-000"
                /(?:TIN|TAX\s*(?:ID|IDENTIFICATION\s*NUMBER))\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*(\d{3}-\d{3}-\d{3}-\d{3})/i,
                // Pattern 2: Standalone "123-456-789-000" format
                /\b(\d{3}-\d{3}-\d{3}-\d{3})\b/g
            ]
        };

        // Return format-specific patterns if available, otherwise return generic patterns
        if (patterns[idType]) {
            return patterns[idType];
        }

        // Generic fallback patterns (less specific)
        return [
            /(?:ID\s*(?:NO|NUMBER|#)\.?|IDENTIFICATION\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
            /\b([A-Z0-9\-]{8,20})\b/g
        ];
    }

    /**
     * Extract ID number with format validation and confidence scoring
     * @param {string} text - Extracted text from document
     * @param {string} idType - Type of ID (drivers-license, passport, etc.)
     * @returns {Object} Extraction result with ID number, confidence, and candidates
     */
    extractIDNumberWithValidation(text, idType) {
        if (!text || typeof text !== 'string') {
            return { idNumber: null, confidence: 0, candidates: [] };
        }

        const patterns = this.getIDNumberPatterns(idType);
        const candidates = [];
        const seen = new Set(); // Track seen ID numbers to avoid duplicates

        // Find all potential matches
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const isGlobalPattern = pattern.global;

            try {
                if (isGlobalPattern) {
                    // For global patterns, use exec() to get all matches
                    pattern.lastIndex = 0;
                    let match;
                    while ((match = pattern.exec(text)) !== null) {
                        if (match[1]) {
                            const candidate = match[1].trim().replace(/\s+/g, '').toUpperCase();
                            if (!seen.has(candidate)) {
                                seen.add(candidate);

                                // Validate format
                                const validation = this.validateIDFormat(candidate, idType);

                                // Calculate confidence
                                let confidence = validation.confidence; // 0.0 or 1.0 from format validation

                                // Bonus for proximity to ID type keywords (0-0.3)
                                const keywordBonus = this.calculateKeywordProximity(text, match.index, idType);
                                confidence += keywordBonus;

                                // Bonus for pattern specificity (0-0.2)
                                // First pattern (with context) gets higher score
                                const specificityBonus = i === 0 ? 0.2 : 0.1;
                                confidence += specificityBonus;

                                // Cap confidence at 1.0
                                confidence = Math.min(confidence, 1.0);

                                candidates.push({
                                    idNumber: candidate,
                                    confidence: confidence,
                                    patternIndex: i,
                                    matchIndex: match.index,
                                    validation: validation
                                });
                            }
                        }
                    }
                } else {
                    // For non-global patterns, use match()
                    const matches = text.match(pattern);
                    if (matches && matches[1]) {
                        const candidate = matches[1].trim().replace(/\s+/g, '').toUpperCase();
                        if (!seen.has(candidate)) {
                            seen.add(candidate);

                            // Validate format
                            const validation = this.validateIDFormat(candidate, idType);

                            // Calculate confidence
                            let confidence = validation.confidence;

                            // Bonus for proximity to ID type keywords
                            const matchIndex = matches.index || 0;
                            const keywordBonus = this.calculateKeywordProximity(text, matchIndex, idType);
                            confidence += keywordBonus;

                            // Bonus for pattern specificity
                            const specificityBonus = i === 0 ? 0.2 : 0.1;
                            confidence += specificityBonus;

                            confidence = Math.min(confidence, 1.0);

                            candidates.push({
                                idNumber: candidate,
                                confidence: confidence,
                                patternIndex: i,
                                matchIndex: matchIndex,
                                validation: validation
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('[OCR Debug] Error in pattern matching:', {
                    error: error.message,
                    patternIndex: i,
                    idType: idType
                });
                continue;
            }
        }

        // Sort candidates by confidence (highest first)
        candidates.sort((a, b) => b.confidence - a.confidence);

        // Return best candidate if confidence > 0.5
        const bestCandidate = candidates.length > 0 && candidates[0].confidence > 0.5
            ? candidates[0]
            : null;

        return {
            idNumber: bestCandidate ? bestCandidate.idNumber : null,
            confidence: bestCandidate ? bestCandidate.confidence : 0,
            candidates: candidates.slice(0, 5) // Top 5 for debugging
        };
    }

    /**
     * Calculate confidence bonus based on proximity to ID type keywords
     * @param {string} text - Full text
     * @param {number} matchIndex - Index where ID number was found
     * @param {string} idType - Type of ID
     * @returns {number} Bonus score (0-0.3)
     */
    calculateKeywordProximity(text, matchIndex, idType) {
        const keywordMap = {
            'drivers-license': ['LICENSE', 'DRIVER', 'DL'],
            'passport': ['PASSPORT', 'PASSPORT NO', 'PASSPORT NUMBER'],
            'national-id': ['NATIONAL ID', 'CRN', 'PHILID', 'PHILIPPINE ID'],
            'postal-id': ['POSTAL ID', 'POSTAL'],
            'voters-id': ['VOTER', 'VOTERS ID'],
            'sss-id': ['SSS', 'SSS ID', 'SSS NUMBER'],
            'tin': ['TIN', 'TAX ID', 'TAX IDENTIFICATION']
        };

        const keywords = keywordMap[idType] || [];
        if (keywords.length === 0) return 0;

        // Check 100 characters before and after the match
        const searchStart = Math.max(0, matchIndex - 100);
        const searchEnd = Math.min(text.length, matchIndex + 100);
        const context = text.substring(searchStart, searchEnd).toUpperCase();

        // Check if any keyword appears in context
        for (const keyword of keywords) {
            if (context.includes(keyword)) {
                // Calculate distance from keyword to match
                const keywordIndex = context.indexOf(keyword);
                const distance = Math.abs(keywordIndex - (matchIndex - searchStart));

                // Closer keywords get higher bonus (max 0.3)
                // Within 20 chars = 0.3, within 50 chars = 0.2, within 100 chars = 0.1
                if (distance <= 20) return 0.3;
                if (distance <= 50) return 0.2;
                if (distance <= 100) return 0.1;
            }
        }

        return 0;
    }

    /**
     * Parse vehicle information from extracted text
     * @param {string} text - Extracted text from document
     * @param {string} documentType - Type of document (registration_cert, owner_id, etc.)
     * @returns {Object} Extracted data
     */
    parseVehicleInfo(text, documentType) {
        // CRITICAL: Wrap entire function in try/catch to prevent ANY crash
        try {
            const extracted = {};

            // #region agent log
            console.log('[OCR Debug] parseVehicleInfo called:', {
                documentType,
                hasText: !!text,
                textType: typeof text,
                textLength: text ? text.length : 0,
                textPreview: text ? text.substring(0, 300) : 'NO TEXT'
            });
            // #endregion

            // Validate input parameters
            if (!documentType) {
                console.warn('[OCR Debug] WARNING: documentType is undefined or null. Using default: registration_cert');
                documentType = 'registration_cert';
            }

            // Validate text parameter
            if (!text) {
                console.warn('[OCR Debug] WARNING: text parameter is null/undefined. Returning empty object.');
                return extracted;
            }

            if (typeof text !== 'string') {
                console.error('[OCR Debug] ERROR: text parameter is not a string. Type:', typeof text, 'Value:', text);
                return extracted;
            }

            if (text.trim().length === 0) {
                // #region agent log
                console.log('[OCR Debug] WARNING: No text extracted from document! Returning empty object.');
                // #endregion
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
                // Extract ALL LTO Vehicle Information fields with advanced regex patterns

                // **IDENTIFIERS (High Confidence)**
                // VIN (ISO Standard: 17 chars, excludes I, O, Q)
                const vinPattern = /\b(?![IOQ])[A-HJ-NPR-Z0-9]{17}\b/;
                const vinMatches = text.match(vinPattern);
                if (vinMatches) extracted.vin = vinMatches[0].trim();

                // Plate Number - Strict line-bound patterns (require digits)
                // Pattern 1: Table format with label (single-line, plate-shaped)
                let platePattern = /(?:Plate|Registration|License)\s*(?:Number|No\.?)*\s*\|\s*([A-Z]{3}\s?-?\s?\d{3,4})/i;
                let plateMatches = text.match(platePattern);

                // Pattern 2: Colon/equals format with label (single-line, plate-shaped)
                if (!plateMatches) {
                    platePattern = /(?:Plate|Registration|License)\s*(?:Number|No\.?)*\s*[:=]\s*([A-Z]{3}\s?-?\s?\d{3,4})/i;
                    plateMatches = text.match(platePattern);
                }

                // Pattern 3: Philippine formats standalone (fallback)
                if (!plateMatches) {
                    platePattern = /\b([A-Z]{2,3}\s?-?\s?\d{3,4}|[A-Z]\s?-?\s?\d{3}\s?-?\s?[A-Z]{2}|\d{4}\s?-?\s?[A-Z]{2,3})\b/i;
                    plateMatches = text.match(platePattern);
                }

                if (plateMatches) {
                    let plateValue = plateMatches[1].replace(/\s/g, '').toUpperCase().trim();
                    // Normalize to ABC-1234 format (3 letters, hyphen, 4 numbers)
                    if (plateValue.length === 7 && /^[A-Z]{3}\d{4}$/.test(plateValue)) {
                        plateValue = plateValue.substring(0, 3) + '-' + plateValue.substring(3);
                    } else if (plateValue.length === 6 && /^[A-Z]{3}\d{3}$/.test(plateValue)) {
                        plateValue = plateValue.substring(0, 3) + '-' + plateValue.substring(3);
                    } else if (plateValue.includes('-')) {
                        // Already has hyphen, just normalize
                        plateValue = plateValue.replace(/-/g, '');
                        if (plateValue.length >= 6 && /^[A-Z]{3}/.test(plateValue)) {
                            plateValue = plateValue.substring(0, 3) + '-' + plateValue.substring(3);
                        }
                    }
                    extracted.plateNumber = plateValue;
                }

                // Engine Number (single-line, must include digits)
                const enginePattern = /(?:Engine|Motor)\s*(?:No\.?|Number)?[\s:.]*([A-Z0-9\-]*\d[A-Z0-9\-]*)/i;
                const engineMatches = text.match(enginePattern);
                if (engineMatches) extracted.engineNumber = engineMatches[1].trim();

                // MV File Number (format: XXXX-XXXXXXX or XXXX-XXXXXXXX)
                const mvFilePattern = /\b(\d{4}-\d{7,8})\b/;
                const mvFileMatches = text.match(mvFilePattern);
                if (mvFileMatches) extracted.mvFileNumber = mvFileMatches[1].trim();

                // **DESCRIPTORS (Context-Based)**
                // Make (Brand)
                const makePattern = /(?:Make|Brand)[\s:.]*([A-Z]+)/i;
                const makeMatches = text.match(makePattern);
                if (makeMatches) extracted.make = makeMatches[1].trim();

                // Series (Model line) - FIXED: Use [^\n]+ to stop at newline (prevents leakage)
                const seriesPattern = /(?:Series|Model)[\s:.]*([^\n]+?)(?=\n|Body)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches) extracted.series = seriesMatches[1].trim();

                // Body Type - FIXED: Use [^\n]+ to capture only current line
                const bodyTypePattern = /(?:Body\s*Type)[\s:.]*([^\n]+?)(?=\n|Color|Engine)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches) extracted.bodyType = bodyTypeMatches[1].trim();

                // Year Model
                const yearModelPattern = /(?:Year|Model)[\s:.]*(\d{4})/;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches) extracted.yearModel = yearModelMatches[1].trim();

                // Color - FIXED: Use [^\n]+ to capture only single line
                const colorPattern = /(?:Color)[\s:.]*([^\n]+?)(?=\n|Fuel|Engine)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches) extracted.color = colorMatches[1].trim();

                // Fuel Type - Improved: Exclude "Type" label and normalize value
                const fuelTypePattern = /(?:Fuel|Propulsion)\s*(?:Type)?\s*[:.\s]*([^\n]+?)(?=\n|Engine|$)/i;
                const fuelTypeMatches = text.match(fuelTypePattern);
                if (fuelTypeMatches) {
                    let fuelValue = fuelTypeMatches[1].trim();
                    // Remove common prefixes that might be captured: "Type", "Fuel", "Kind"
                    fuelValue = fuelValue.replace(/^(Type|Fuel|Kind)[\s:\/]*/i, '').trim();
                    // Remove trailing colons/slashes
                    fuelValue = fuelValue.replace(/^[:.\s\/]+|[:.\s\/]+$/g, '').trim();
                    extracted.fuelType = fuelValue;
                }

                // **WEIGHTS (Numeric)**
                // Gross Weight
                const grossWeightPattern = /(?:Gross\s*Wt\.?)[\s:.]*(\d+)/i;
                const grossWeightMatches = text.match(grossWeightPattern);
                if (grossWeightMatches) extracted.grossWeight = grossWeightMatches[1].trim();

                // Net Capacity / Net Weight
                const netCapacityPattern = /(?:Net\s*Cap\.?|Net\s*Wt\.?)[\s:.]*(\d+)/i;
                const netCapacityMatches = text.match(netCapacityPattern);
                if (netCapacityMatches) extracted.netCapacity = netCapacityMatches[1].trim();

                // **BACKWARDS COMPATIBILITY: Keep older field names for Step 2 form**
                // Map new fields to old field names where applicable
                if (extracted.series) extracted.model = extracted.series;
                if (extracted.yearModel) extracted.year = extracted.yearModel;

                // Chassis Number (alternative to VIN)
                const chassisPattern = /(?:Chassis|Frame)\s*No\.?[\s:.]*([A-HJ-NPR-Z0-9]{10,17})/i;
                const chassisMatches = text.match(chassisPattern);
                if (chassisMatches) extracted.chassisNumber = chassisMatches[0].trim();
            }

            // Process owner ID documents with error handling
            if (documentType === 'owner_id' || documentType === 'ownerId' ||
                documentType === 'ownerValidId' ||
                documentType === 'seller_id' || documentType === 'buyer_id') {
                // #region agent log
                console.log('[OCR Debug] Processing owner ID document type:', {
                    documentType,
                    textLength: text ? text.length : 0,
                    textType: typeof text,
                    textSample: text ? text.substring(0, 500) : 'NO TEXT',
                    note: 'IMPORTANT: Personal info (name, address, phone) extracted here should NOT be used in Owner Information section. Only ID type and number should be used. Personal info must come from user account.'
                });
                // #endregion

                // CRITICAL: Ensure text is a string before processing
                if (!text || typeof text !== 'string') {
                    console.error('[OCR Debug] ERROR: text is not a valid string:', {
                        textType: typeof text,
                        textValue: text,
                        documentType
                    });
                    // Return early with empty extracted data (graceful degradation)
                    return extracted;
                }

                try {

                    // Extract Name (various formats)
                    const namePatterns = [
                        /(?:NAME|FULL\s*NAME|COMPLETE\s*NAME)\s*[:.]?\s*([A-Z\s,]+?)(?:\s*(?:ADDRESS|DATE|BIRTH|ID)|$)/i,
                        /^([A-Z]+(?:\s+[A-Z]+)+)/m // First line if all caps
                    ];

                    try {
                        for (const pattern of namePatterns) {
                            if (!text || typeof text !== 'string') break;
                            const nameMatch = text.match(pattern);
                            if (nameMatch && nameMatch[1]) {
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
                    } catch (nameError) {
                        console.error('[OCR Debug] ERROR extracting name:', {
                            error: nameError.message,
                            errorName: nameError.name
                        });
                        // Continue - name extraction failure is not critical
                    }

                    // Extract Address
                    const addressPatterns = [
                        /(?:ADDRESS|RESIDENCE|HOME\s*ADDRESS)\s*[:.]?\s*(.+?)(?:\s*(?:DATE|BIRTH|ID|PHONE|CONTACT)|$)/i,
                        /(?:ADDRESS|RESIDENCE)\s*[:.]?\s*([^\n]{10,200})/i
                    ];

                    try {
                        for (const pattern of addressPatterns) {
                            if (!text || typeof text !== 'string') break;
                            const addressMatch = text.match(pattern);
                            if (addressMatch && addressMatch[1]) {
                                extracted.address = addressMatch[1].trim();
                                break;
                            }
                        }
                    } catch (addressError) {
                        console.error('[OCR Debug] ERROR extracting address:', {
                            error: addressError.message,
                            errorName: addressError.name
                        });
                        // Continue - address extraction failure is not critical
                    }

                    // Extract Phone Number
                    try {
                        if (text && typeof text === 'string') {
                            const phonePattern = /(?:PHONE|CONTACT|MOBILE|TEL)\s*[:.]?\s*([\+\d\s\-\(\)]{10,20})/i;
                            const phoneMatch = text.match(phonePattern);
                            if (phoneMatch && phoneMatch[1]) {
                                extracted.phone = phoneMatch[1].trim();
                            }
                        }
                    } catch (phoneError) {
                        console.error('[OCR Debug] ERROR extracting phone:', {
                            error: phoneError.message,
                            errorName: phoneError.name
                        });
                        // Continue - phone extraction failure is not critical
                    }

                    // #region agent log
                    console.log('[OCR Debug] Starting ID Type/Number extraction for owner_id document:', {
                        documentType: documentType,
                        textLength: text ? text.length : 0,
                        textPreview: text ? text.substring(0, 300) : 'NO TEXT',
                        normalizedTextPreview: text ? text.toUpperCase().replace(/\s+/g, ' ').substring(0, 300) : 'NO TEXT'
                    });
                    // #endregion

                    // Extract ID Type using PATTERN-FIRST detection ordered by uniqueness/specificity
                    // This prevents false positives by checking most specific patterns first
                    const idNumberPatterns = [
                        // 1. National ID: 4-4-4-4 format (16 digits) - MOST SPECIFIC
                        { pattern: /^(\d{4})\s*[-]?\s*(\d{4})\s*[-]?\s*(\d{4})\s*[-]?\s*(\d{4})$/, type: 'national-id', description: 'National ID (4-4-4-4)' },
                        // 2. PhilHealth: 2-7-2 format (11 digits) - HIGHLY SPECIFIC
                        { pattern: /(\d{2})\s*[-]?\s*(\d{7})\s*[-]?\s*(\d{2})/, type: 'philhealth-id', description: 'PhilHealth ID (2-7-2)' },
                        // 3. SSS: 2-7-1 format (10 digits) - HIGHLY SPECIFIC
                        { pattern: /(\d{2})\s*[-]?\s*(\d{7})\s*[-]?\s*(\d{1})/, type: 'sss-id', description: 'SSS ID (2-7-1)' },
                        // 4. Driver's License: [A-Z]2-2-6+ format - SPECIFIC (letter prefix required)
                        { pattern: /([A-Z])\s*[-]?\s*(\d{2})\s*[-]?\s*(\d{2})\s*[-]?\s*(\d{6,})/, type: 'drivers-license', description: "Driver's License ([A-Z]2-2-6+)" },
                        // 5. TIN: 3-3-3-3 format (12 digits) - SPECIFIC
                        { pattern: /(\d{3})\s*[-]?\s*(\d{3})\s*[-]?\s*(\d{3})\s*[-]?\s*(\d{3})/, type: 'tin', description: 'TIN (3-3-3-3)' },
                        // 6. Voter's ID: 4-4-4 format (12 digits) - MEDIUM SPECIFICITY
                        { pattern: /(\d{4})\s*[-]?\s*(\d{4})\s*[-]?\s*(\d{4})/, type: 'voters-id', description: "Voter's ID (4-4-4)" },
                        // 7. Postal ID: Postal code format - LOW SPECIFICITY, checked before generic Passport
                        { pattern: /\b([A-Z]{1,2}\d{6})\b/, type: 'postal-id', description: 'Postal ID' },
                        // 8. Passport: 2 letters + 7 digits - MOST GENERIC (check last)
                        { pattern: /^([A-Z]{2})(\d{7})$/, type: 'passport', description: 'Passport (AA1234567)' }
                    ];

                    // PATTERN-FIRST ID TYPE DETECTION: Extract potential ID numbers and use format to identify type
                    const extractedNumbers = [];
                    if (text && typeof text === 'string') {
                        // Extract all potential ID numbers from text (loose patterns to catch everything)
                        const numberPatterns = [
                            /(\d{4})[-\s](\d{4})[-\s](\d{4})[-\s](\d{4})/g,  // 4-4-4-4 (National ID, Voters ID)
                            /(\d{2})[-\s](\d{7})[-\s](\d{2})/g,                 // 2-7-2 (PhilHealth)
                            /(\d{2})[-\s](\d{7})[-\s](\d{1})/g,                 // 2-7-1 (SSS ID)
                            /([A-Z])[-\s](\d{2})[-\s](\d{2})[-\s](\d{6,})/g,   // [A-Z]2-2-6+ (Driver's License)
                            /(\d{3})[-\s](\d{3})[-\s](\d{3})[-\s](\d{3})/g,     // 3-3-3-3 (TIN)
                            /([A-Z]{1,2}\d{6})/g,                               // Postal
                            /([A-Z]{2})(\d{7})/g                                // Passport
                        ];

                        for (const pattern of numberPatterns) {
                            let match;
                            while ((match = pattern.exec(text)) !== null) {
                                if (match[0] && !extractedNumbers.includes(match[0])) {
                                    extractedNumbers.push(match[0]);
                                }
                            }
                        }
                    }

                    // PATTERN-FIRST: Use the new identifyIDTypeFromFormat() function to determine type
                    // This function tests against all format patterns and returns matching types with confidence
                    let formatDetectionResult = null;
                    if (extractedNumbers.length > 0) {
                        // Try to identify type from the first extracted number
                        formatDetectionResult = this.identifyIDTypeFromFormat(extractedNumbers[0]);

                        if (formatDetectionResult.primaryType) {
                            extracted.idType = formatDetectionResult.primaryType;
                            extracted.idTypeConfidence = formatDetectionResult.confidence;
                            extracted.idTypeDetectionMethod = 'format';
                            extracted.idTypeAmbiguous = formatDetectionResult.ambiguous;

                            // #region agent log
                            console.log('[OCR Debug] ID Type detected by FORMAT matching (pattern-first approach):', {
                                idNumber: formatDetectionResult.cleanedNumber,
                                primaryType: extracted.idType,
                                confidence: formatDetectionResult.confidence,
                                ambiguous: formatDetectionResult.ambiguous,
                                allMatches: formatDetectionResult.matchingTypes.map(m => m.type)
                            });
                            // #endregion

                            // If ambiguous (multiple types matched), use keyword proximity to disambiguate
                            if (formatDetectionResult.ambiguous) {
                                console.warn('[OCR Debug] AMBIGUOUS: Multiple ID types matched the number format. Using keyword proximity to disambiguate:', {
                                    matchedTypes: formatDetectionResult.matchingTypes.map(m => m.type),
                                    selectedType: extracted.idType,
                                    note: 'May need manual verification'
                                });
                            }
                        } else {
                            // No format match found - will fall back to keyword detection later
                            console.log('[OCR Debug] Pattern-first detection failed. No ID format matched the extracted numbers:', {
                                extractedNumbers: extractedNumbers,
                                note: 'Will attempt keyword-based detection as fallback'
                            });
                        }
                    }

                    // FALLBACK: If pattern-first didn't work, try keyword-based detection
                    if (!extracted.idType) {
                        console.log('[OCR Debug] Pattern-first detection did not identify ID type. Attempting keyword-based detection fallback...');

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

                        // Strategy: Scan document header first (most reliable)
                        const documentHeader = text ? text.substring(0, Math.min(300, text.length)).toUpperCase() : '';
                        const headerKeywords = ['DRIVER', 'LICENSE', 'PASSPORT', 'NATIONAL', 'POSTAL', 'VOTER', 'SSS'];

                        for (const keyword of headerKeywords) {
                            if (documentHeader.includes(keyword)) {
                                for (const [key, value] of Object.entries(idTypeMap)) {
                                    if (keyword.includes(key) || key.includes(keyword.substring(0, 3))) {
                                        extracted.idType = value;
                                        extracted.idTypeConfidence = 0.6;
                                        extracted.idTypeDetectionMethod = 'keyword-fallback';

                                        console.log('[OCR Debug] ID Type detected by KEYWORD fallback:', {
                                            keyword: keyword,
                                            idType: extracted.idType,
                                            confidence: 0.6
                                        });
                                        break;
                                    }
                                }
                                if (extracted.idType) break;
                            }
                        }

                        if (!extracted.idType) {
                            console.warn('[OCR Debug] ID Type could NOT be determined. Both pattern-first and keyword fallback failed.');
                        }
                    }

                    // Extract ID Number with format validation
                    // #region agent log
                    console.log('[OCR Debug] Starting ID Number extraction with validation');
                    // #endregion

                    if (extracted.idType) {
                        const idExtraction = this.extractIDNumberWithValidation(text, extracted.idType);

                        if (idExtraction.idNumber && idExtraction.confidence > 0.5) {
                            extracted.idNumber = idExtraction.idNumber;
                            extracted.idNumberConfidence = idExtraction.confidence;
                            // Preserve or set the detection method if not already set
                            if (!extracted.idTypeDetectionMethod) {
                                extracted.idTypeDetectionMethod = 'format';
                            }

                            // #region agent log
                            console.log('[OCR Debug] ID Number extracted with validation:', {
                                idNumber: extracted.idNumber,
                                confidence: idExtraction.confidence,
                                idType: extracted.idType,
                                detectionMethod: extracted.idTypeDetectionMethod,
                                typeConfidence: extracted.idTypeConfidence,
                                topCandidates: idExtraction.candidates.slice(0, 3)
                            });
                            // #endregion
                        } else {
                            // #region agent log
                            console.warn('[OCR Debug] No valid ID number found:', {
                                idType: extracted.idType,
                                candidates: idExtraction.candidates,
                                reason: 'No candidate met confidence threshold (0.5)',
                                topCandidate: idExtraction.candidates.length > 0 ? idExtraction.candidates[0] : null
                            });
                            // #endregion
                        }
                    } else {
                        // If ID type not detected, try generic extraction but with stricter validation
                        // #region agent log
                        console.warn('[OCR Debug] ID Type not detected, attempting generic ID number extraction');
                        // #endregion

                        // Blacklist of common non-ID words that should never be extracted as ID numbers
                        const idNumberBlacklist = [
                            'EXPIRATION', 'EXPIRY', 'EXPIRES', 'VALID', 'VALIDITY', 'VALID UNTIL',
                            'ISSUE', 'ISSUED', 'ISSUE DATE', 'DATE OF ISSUE',
                            'BIRTH', 'BIRTHDATE', 'DATE OF BIRTH', 'BIRTH DATE',
                            'ADDRESS', 'RESIDENCE', 'RESIDENTIAL',
                            'NAME', 'FULL NAME', 'GIVEN NAME', 'SURNAME', 'LAST NAME', 'FIRST NAME',
                            'SEX', 'GENDER', 'MALE', 'FEMALE',
                            'NATIONALITY', 'CITIZENSHIP',
                            'SIGNATURE', 'SIGN',
                            'PHOTO', 'PICTURE', 'IMAGE',
                            'REPUBLIC', 'PHILIPPINES', 'PHILIPPINE',
                            'LICENSE', 'DRIVER', 'PASSPORT', 'IDENTIFICATION',
                            'NUMBER', 'NO', 'NUM', 'ID', 'ID NO', 'ID NUMBER',
                            'CLASS', 'RESTRICTIONS', 'CONDITIONS',
                            'ENDORSEMENT', 'ENDORSEMENTS'
                        ];

                        /**
                         * Check if a candidate string is blacklisted (common non-ID words)
                         * @param {string} candidate - Candidate ID number to check
                         * @returns {boolean} True if blacklisted
                         */
                        const isBlacklisted = (candidate) => {
                            const upperCandidate = candidate.toUpperCase();
                            return idNumberBlacklist.some(blacklisted => (
                                upperCandidate === blacklisted || upperCandidate.includes(blacklisted)
                            ));
                        };

                        /**
                         * Validate if a candidate is a valid ID format
                         * @param {string} candidate - Candidate ID number to validate
                         * @returns {boolean} True if valid ID format
                         */
                        const isValidIDFormat = (candidate) => {
                            // Must contain at least 2 digits (ID numbers always have digits)
                            const digitCount = (candidate.match(/\d/g) || []).length;
                            if (digitCount < 2) return false;

                            // Must not be all letters
                            if (/^[A-Z]+$/.test(candidate)) return false;

                            // Must not be a date format (MM-DD-YYYY, DD-MM-YYYY, etc.)
                            if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(candidate)) return false;

                            // Must have reasonable digit ratio (at least 20% digits for long alphanumeric IDs)
                            const digitRatio = digitCount / candidate.length;
                            if (digitRatio < 0.2 && candidate.length > 10) return false;

                            return true;
                        };

                        // Reordered patterns: specific formats first, then context-based, then most generic
                        // This prioritizes strong matches before falling back to more permissive patterns.
                        const genericPatterns = [
                            // Specific format patterns (highest priority)
                            /\b([A-Z]\d{2}-\d{2}-\d{6,})\b/g,         // Driver's License format: D12-34-567890
                            /\b([A-Z]{2}\d{7})\b/g,                   // Passport format: AA1234567
                            /\b(\d{4}-\d{4}-\d{4}-\d{4})\b/g,         // National ID format: 1234-5678-9101-1213
                            /\b(\d{2}-\d{7}-\d{1})\b/g,               // SSS ID format: 12-3456789-0
                            /\b(\d{2}-\d{7}-\d{2})\b/g,               // PhilHealth ID format: 12-3456789-12 (varies; still useful)
                            /\b(\d{3}-\d{3}-\d{3}-\d{3})\b/g,         // TIN format: 123-456-789-000
                            /\b(\d{4}-\d{4}-\d{4})\b/g,               // Voter's ID format: 1234-5678-9012

                            // Generic patterns with context (lower priority, still validated)
                            /(?:LICENSE\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                            /(?:PASSPORT\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                            /(?:NATIONAL\s*ID|CRN|PHILID)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                            /(?:SSS)\s*(?:ID|NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                            /(?:PHILHEALTH|PHIC|PIN)\s*(?:ID|NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                            /(?:TIN|TAX\s*(?:ID|IDENTIFICATION\s*NUMBER))\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                            /(?:VOTER['\s]*S?\s*ID)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                            /(?:POSTAL\s*ID)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,

                            // Most generic pattern (lowest priority, requires strictest validation)
                            /(?:ID\s*(?:NO|NUMBER|#)\.?|IDENTIFICATION\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z0-9\-]{8,20})/i
                        ];

                        let foundValidID = false;
                        for (let i = 0; i < genericPatterns.length && !foundValidID; i++) {
                            const pattern = genericPatterns[i];
                            const isGlobalPattern = pattern.global;

                            try {
                                if (isGlobalPattern) {
                                    pattern.lastIndex = 0;
                                    let match;
                                    while ((match = pattern.exec(text)) !== null && !foundValidID) {
                                        if (match[1]) {
                                            const candidate = match[1].trim().replace(/\s+/g, '').toUpperCase();

                                            // Stricter validation
                                            // 1) Check blacklist
                                            if (isBlacklisted(candidate)) {
                                                // #region agent log
                                                console.log('[OCR Debug] Candidate rejected (blacklisted):', {
                                                    candidate: candidate,
                                                    patternIndex: i,
                                                    reason: 'Matches blacklist'
                                                });
                                                // #endregion
                                                continue;
                                            }

                                            // 2) Basic format checks
                                            if (candidate.length < 8 || candidate.length > 20) continue;
                                            if (!/^[A-Z0-9\-]+$/.test(candidate)) continue;

                                            // 3) For context/generic patterns (after the specific-format block), apply stricter validation
                                            if (i >= 7 && !isValidIDFormat(candidate)) {
                                                // #region agent log
                                                console.log('[OCR Debug] Candidate rejected (invalid format):', {
                                                    candidate: candidate,
                                                    patternIndex: i,
                                                    reason: 'Failed format validation'
                                                });
                                                // #endregion
                                                continue;
                                            }

                                            // Candidate passed all checks
                                            extracted.idNumber = candidate;
                                            foundValidID = true;
                                            // #region agent log
                                            console.log('[OCR Debug] Generic ID Number extracted:', {
                                                idNumber: extracted.idNumber,
                                                patternIndex: i,
                                                patternType: i < 7 ? 'specific-format' : 'generic-with-context',
                                                validation: 'passed'
                                            });
                                            // #endregion
                                        }
                                    }
                                } else {
                                    const matches = text.match(pattern);
                                    if (matches && matches[1]) {
                                        const candidate = matches[1].trim().replace(/\s+/g, '').toUpperCase();

                                        // Stricter validation
                                        // 1) Check blacklist
                                        if (isBlacklisted(candidate)) {
                                            // #region agent log
                                            console.log('[OCR Debug] Candidate rejected (blacklisted):', {
                                                candidate: candidate,
                                                patternIndex: i,
                                                reason: 'Matches blacklist'
                                            });
                                            // #endregion
                                            continue;
                                        }

                                        // 2) Basic format checks
                                        if (candidate.length < 8 || candidate.length > 20) continue;
                                        if (!/^[A-Z0-9\-]+$/.test(candidate)) continue;

                                        // 3) For context/generic patterns (after the specific-format block), apply stricter validation
                                        if (i >= 7 && !isValidIDFormat(candidate)) {
                                            // #region agent log
                                            console.log('[OCR Debug] Candidate rejected (invalid format):', {
                                                candidate: candidate,
                                                patternIndex: i,
                                                reason: 'Failed format validation'
                                            });
                                            // #endregion
                                            continue;
                                        }

                                        // Candidate passed all checks
                                        extracted.idNumber = candidate;
                                        foundValidID = true;
                                        // #region agent log
                                        console.log('[OCR Debug] Generic ID Number extracted:', {
                                            idNumber: extracted.idNumber,
                                            patternIndex: i,
                                            patternType: i < 7 ? 'specific-format' : 'generic-with-context',
                                            validation: 'passed'
                                        });
                                        // #endregion
                                    }
                                }
                            } catch (error) {
                                console.error('[OCR Debug] Error in generic pattern matching:', error.message);
                                continue;
                            }
                        }

                        if (!foundValidID) {
                            // #region agent log
                            console.warn('[OCR Debug] No valid ID number found with generic patterns');
                            // #endregion
                        }
                    }

                    // #region agent log
                    if (!extracted.idNumber) {
                        console.log('[OCR Debug] ID Number not found. Text sample:', text ? text.substring(0, 500) : 'NO TEXT');
                        console.log('[OCR Debug] Normalized text sample (for pattern debugging):', text ? text.toUpperCase().replace(/\s+/g, ' ').substring(0, 500) : 'NO TEXT');
                    }
                    console.log('[OCR Debug] Final extracted data for owner_id:', {
                        hasIdType: !!extracted.idType,
                        hasIdNumber: !!extracted.idNumber,
                        idType: extracted.idType,
                        idNumber: extracted.idNumber,
                        allExtractedFields: Object.keys(extracted),
                        extractionSuccess: !!(extracted.idType && extracted.idNumber),
                        note: 'CRITICAL: Personal info (firstName, lastName, address, phone) should NOT be used in Owner Information section. Only idType and idNumber should be used. Personal info must come from user account profile.'
                    });
                    // #endregion
                } catch (ownerIdError) {
                    console.error('[OCR Debug] ERROR processing owner ID document:', {
                        error: ownerIdError.message,
                        errorName: ownerIdError.name,
                        stack: ownerIdError.stack,
                        documentType: documentType,
                        textLength: text ? text.length : 0,
                        textType: typeof text,
                        hasText: !!text
                    });
                    // Return partial results if any fields were extracted before error
                    // (graceful degradation)
                    // extracted object may already have some fields populated
                    // DO NOT throw - let the function return extracted object (even if empty)
                }
            }

            if (documentType === 'insurance_cert' || documentType === 'insuranceCert') {
                // Extract Policy / Certificate Number
                let policyNumber = null;

                // 1) Template-aware: look for \"Policy / Certificate No.\" label in normalized text
                try {
                    const labelPattern = /POLICY\s*\/\s*CERTIFICATE\s*NO\.?\s*[:.]?\s*([A-Z0-9\-]+)/;
                    const labelMatch = normalizedText.match(labelPattern);
                    if (labelMatch && labelMatch[1]) {
                        policyNumber = labelMatch[1].trim();
                    }
                } catch (patternError) {
                    console.warn('[OCR Debug] Error in insurance labelPattern match:', patternError);
                }

                // 2) Fallback: generic \"POLICY NO\" style patterns on raw text
                if (!policyNumber) {
                    const policyPattern = /(?:POLICY\s*(?:NO|NUMBER)?\.?)\s*[:.]?\s*([A-Z0-9\-]+)/i;
                    const policyMatch = text.match(policyPattern);
                    if (policyMatch && policyMatch[1]) {
                        policyNumber = policyMatch[1].trim();
                    }
                }

                if (policyNumber) {
                    extracted.insurancePolicyNumber = policyNumber;
                }

                // Extract Expiry Date
                // Support both numeric and month-name formats, e.g.:
                // - 19/01/2026, 19-01-2026
                // - 19-Jan-2026
                // - 19 Jan 2026
                const expiryPatterns = [
                    /(?:EXPIR|VALID\s*UNTIL|EFFECTIVE\s*TO|EXPIRY(?:\s*DATE)?)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
                    /(?:EXPIR|VALID\s*UNTIL|EFFECTIVE\s*TO|EXPIRY(?:\s*DATE)?)\s*[:.]?\s*(\d{1,2}\s*[\-\/]?\s*[A-Za-z]{3,9}\s*[\-\/]?\s*\d{4})/i,
                    // Sometimes rendered like: "Effective Date: 19-Jan-2026    Expiry Date: 19-Jan-2027"
                    /EXPIRY\s*DATE\s*[:.]?\s*(\d{1,2}\s*[\-\/]?\s*[A-Za-z]{3,9}\s*[\-\/]?\s*\d{4})/i
                ];
                for (const expiryPattern of expiryPatterns) {
                    const expiryMatch = text.match(expiryPattern);
                    if (expiryMatch && expiryMatch[1]) {
                        extracted.insuranceExpiry = expiryMatch[1].trim();
                        break;
                    }
                }
            }

            if (documentType === 'sales_invoice' || documentType === 'salesInvoice') {
                // Extract Vehicle Information from Sales Invoice
                // Wrap ALL sales invoice extraction in try/catch for fail-soft behavior
                try {
                    // **IDENTIFIERS (High Confidence)**
                    // VIN (ISO Standard: 17 chars, excludes I, O, Q)
                    const vinPattern = /\b(?![IOQ])[A-HJ-NPR-Z0-9]{17}\b/;
                    const vinMatches = text.match(vinPattern);
                    if (vinMatches) extracted.vin = vinMatches[0].trim();

                    // Engine Number
                    const enginePattern = /(?:Engine|Motor)\s*No\.?[\s:.]*([A-Z0-9\-]+)/i;
                    const engineMatches = text.match(enginePattern);
                    if (engineMatches) extracted.engineNumber = engineMatches[1].trim();

                    // Chassis Number
                    const chassisPattern = /(?:Chassis|Frame)\s*No\.?[\s:.]*([A-HJ-NPR-Z0-9]{10,17})/i;
                    const chassisMatches = text.match(chassisPattern);
                    if (chassisMatches) extracted.chassisNumber = chassisMatches[1].trim();

                    // Plate Number
                    const platePattern = /\b([A-Z]{3}\s?\d{3,4}|[A-Z]\s?\d{3}\s?[A-Z]{2})\b/i;
                    const plateMatches = text.match(platePattern);
                    if (plateMatches) extracted.plateNumber = plateMatches[1].replace(/\s/g, '-').toUpperCase().trim();

                    // MV File Number
                    const mvFilePattern = /\b(\d{4}-\d{7,8})\b/;
                    const mvFileMatches = text.match(mvFilePattern);
                    if (mvFileMatches) extracted.mvFileNumber = mvFileMatches[1].trim();

                    // **DESCRIPTORS (Context-Based)**
                    // Make/Brand
                    const makePattern = /(?:Make|Brand)[\s:.]*([A-Z]+)/i;
                    const makeMatches = text.match(makePattern);
                    if (makeMatches) extracted.make = makeMatches[1].trim();

                    // Series (Model line) - Skip slash and alternative field names
                    const seriesPattern = /(?:Model\s*\/\s*Series|Series\s*\/\s*Model|Model|Series)[\s:./]*([^\n]+?)(?=\n|Body|Variant)/i;
                    const seriesMatches = text.match(seriesPattern);
                    if (seriesMatches) {
                        let seriesValue = seriesMatches[1].trim();
                        // Remove leading slash or alternative names if captured
                        seriesValue = seriesValue.replace(/^[\s/]*(?:Series|Model)[\s:/]*/, '').trim();
                        extracted.series = seriesValue;
                    }

                    // Body Type
                    const bodyTypePattern = /(?:Body\s*Type)[\s:.]*([^\n]+?)(?=\n|Color|Engine)/i;
                    const bodyTypeMatches = text.match(bodyTypePattern);
                    if (bodyTypeMatches) extracted.bodyType = bodyTypeMatches[1].trim();

                    // Year Model
                    const yearModelPattern = /(?:Year|Model)[\s:.]*(\d{4})/;
                    const yearModelMatches = text.match(yearModelPattern);
                    if (yearModelMatches) extracted.yearModel = yearModelMatches[1].trim();

                    // Color
                    const colorPattern = /(?:Color)[\s:.]*([^\n]+?)(?=\n|Fuel|Engine)/i;
                    const colorMatches = text.match(colorPattern);
                    if (colorMatches) extracted.color = colorMatches[1].trim();

                    // Fuel Type - Improved: Exclude "Type" label and normalize value
                    const fuelTypePattern = /(?:Fuel|Propulsion)\s*(?:Type)?\s*[:.\s]*([^\n]+?)(?=\n|Engine|$)/i;
                    const fuelTypeMatches = text.match(fuelTypePattern);
                    if (fuelTypeMatches) {
                        let fuelValue = fuelTypeMatches[1].trim();
                        // Remove common prefixes that might be captured: "Type", "Fuel", "Kind"
                        fuelValue = fuelValue.replace(/^(Type|Fuel|Kind)[\s:\/]*/i, '').trim();
                        // Remove trailing colons/slashes
                        fuelValue = fuelValue.replace(/^[:.\s\/]+|[:.\s\/]+$/g, '').trim();
                        extracted.fuelType = fuelValue;
                    }

                    // **WEIGHTS (Numeric)**
                    // Gross Weight
                    const grossWeightPattern = /(?:Gross\s*Wt\.?)[\s:.]*(\d+)/i;
                    const grossWeightMatches = text.match(grossWeightPattern);
                    if (grossWeightMatches) extracted.grossWeight = grossWeightMatches[1].trim();

                    // Net Capacity / Net Weight
                    const netCapacityPattern = /(?:Net\s*Cap\.?|Net\s*Wt\.?)[\s:.]*(\d+)/i;
                    const netCapacityMatches = text.match(netCapacityPattern);
                    if (netCapacityMatches) extracted.netCapacity = netCapacityMatches[1].trim();

                    // **BACKWARDS COMPATIBILITY: Map new fields to old field names**
                    if (extracted.series) extracted.model = extracted.series;
                    if (extracted.yearModel) extracted.year = extracted.yearModel;

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
                } catch (salesError) {
                    console.error('[OCR Debug] ERROR processing sales invoice document:', {
                        error: salesError.message,
                        errorName: salesError.name,
                        stack: salesError.stack,
                        documentType,
                        textLength: text ? text.length : 0
                    });
                    // Fail-soft: keep any fields that were already safely extracted before the error
                }
            }

            if (documentType === 'csr' || documentType === 'certificateOfStockReport' || documentType === 'certificate_of_stock_report') {
                // Extract Vehicle Information from CSR (Certificate of Stock Report)

                // **IDENTIFIERS (High Confidence)**
                // Chassis / VIN - Single field that contains both values (they're the same)
                // Try multiple patterns to handle all typography variations
                let chassisVinValue = null;

                // [ADD START]
                // Pattern 0: Table format with pipe "/Chassis / VIN | CH9876543210"
                let pattern = /\/Chassis\s*(?:\/\s*VIN)?\s*\|\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                let matches = text.match(pattern);
                if (!chassisVinValue && matches) {
                    chassisVinValue = matches[1].trim();
                }

                // Pattern 0b: Colon format "Chassis: CH9876543210" or "VIN: CH9876543210"
                if (!chassisVinValue) {
                    pattern = /(?:Chassis|VIN)\s*[:]\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (!chassisVinValue && matches) {
                        chassisVinValue = matches[1].trim();
                    }
                }

                // Pattern 0c: Generic format "Chassis CH9876543210" or "VIN CH9876543210"
                if (!chassisVinValue) {
                    pattern = /(?:Chassis|VIN)[\s:.]*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (!chassisVinValue && matches) {
                        chassisVinValue = matches[1].trim();
                    }
                }
                // [ADD END]

                // Pattern 1: Table format "Chassis / VIN | CH9876543210" (exact spacing)
                if (!chassisVinValue) {
                    pattern = /Chassis\s*\/\s*VIN\s*\|\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) {
                        chassisVinValue = matches[1].trim();
                    }
                }

                // Pattern 2: Table format "Chassis/VIN | value" (no space around slash)
                if (!chassisVinValue) {
                    pattern = /Chassis\s*\/\s*VIN\s*[|:]\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 3: Text format "Chassis / VIN CH9876543210" (no required delimiter)
                if (!chassisVinValue) {
                    pattern = /Chassis\s*\/\s*VIN\s+([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 4: Text format without slash "Chassis Number value" or "VIN value"
                if (!chassisVinValue) {
                    pattern = /(?:Chassis|VIN)\s*(?:Number)?\s+([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 5: "Chassis No. value" or "Chassis No value" (no required delimiter)
                if (!chassisVinValue) {
                    pattern = /Chassis\s*No\.?\s+([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 6: Just "Chassis | value" (table format, no VIN mention)
                if (!chassisVinValue) {
                    pattern = /Chassis\s*\|\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 7: Just "Chassis: value" (text format, no VIN mention)
                if (!chassisVinValue) {
                    pattern = /Chassis\s*[:]\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 8: Just "VIN | value" (table format)
                if (!chassisVinValue) {
                    pattern = /VIN\s*\|\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 9: Just "VIN: value" (text format)
                if (!chassisVinValue) {
                    pattern = /VIN\s*[:]\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 10: Reversed "VIN / Chassis" format
                if (!chassisVinValue) {
                    pattern = /VIN\s*\/\s*Chassis\s*[|:]\s*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // Pattern 11: ISO VIN standard (17 chars, no I, O, Q) - standalone
                if (!chassisVinValue) {
                    pattern = /\b(?![IOQ])[A-HJ-NPR-Z0-9]{17}\b/;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[0].trim();
                }

                // Pattern 12: Flexible alphanumeric 10-17 chars (most permissive)
                if (!chassisVinValue) {
                    pattern = /(?:Chassis|VIN|Frame)\s*(?:\/\s*(?:Chassis|VIN))?\s*[|:]\s*([A-Z0-9\-]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }

                // [FIX START] Pattern 13: CSV/Newlines format (handles "Chassis/VIN" \n "CH...")
                // Matches: Chassis/VIN -> optional quotes/newlines/commas -> VIN
                if (!chassisVinValue) {
                    pattern = /Chassis\s*\/\s*VIN[^A-Z0-9]*([A-HJ-NPR-Z0-9]{10,17})/i;
                    matches = text.match(pattern);
                    if (matches) chassisVinValue = matches[1].trim();
                }
                // [FIX END]

                // Map to both fields since they contain the same value
                if (chassisVinValue) {
                    extracted.chassisNumber = chassisVinValue;
                    extracted.vin = chassisVinValue;  // Same value in both fields
                }

                // Engine Number - Handle all variations (must include digits)
                let enginePattern = /Engine\s*Number\s*\|\s*([A-Z0-9\-]*\d[A-Z0-9\-]*)/i;  // Table format with pipe
                let engineMatches = text.match(enginePattern);
                if (!engineMatches) {
                    enginePattern = /Engine\s*Number\s*[:]\s*([A-Z0-9\-]*\d[A-Z0-9\-]*)/i;  // Colon format
                    engineMatches = text.match(enginePattern);
                }
                if (!engineMatches) {
                    enginePattern = /Engine\s*No\.\s*[:]\s*([A-Z0-9\-]*\d[A-Z0-9\-]*)/i;  // "Engine No." with colon
                    engineMatches = text.match(enginePattern);
                }
                if (!engineMatches) {
                    enginePattern = /(?:Engine|Motor)\s*(?:No\.?|Number)?\s*[:.\s]*([A-Z0-9\-]*\d[A-Z0-9\-]*)/i;  // Generic text format
                    engineMatches = text.match(enginePattern);
                }
                if (engineMatches) extracted.engineNumber = engineMatches[1].trim();


                // MV File Number
                const mvFilePattern = /\b(\d{4}-\d{7,8})\b/;
                const mvFileMatches = text.match(mvFilePattern);
                if (mvFileMatches) extracted.mvFileNumber = mvFileMatches[1].trim();

                // **DESCRIPTORS (Context-Based)**
                // Make/Brand - Handle table and text formats
                let makePattern = /Make\s*(?:\/\s*Brand)?\s*\|\s*([A-Za-z]+)/i;  // Table format
                let makeMatches = text.match(makePattern);
                if (!makeMatches) {
                    makePattern = /(?:Make|Brand)\s*[:]\s*([A-Za-z]+)/i;  // Colon format
                    makeMatches = text.match(makePattern);
                }
                if (!makeMatches) {
                    makePattern = /(?:Make|Brand)[\s:.]*([A-Z]+)/i;  // Generic format
                    makeMatches = text.match(makePattern);
                }
                if (makeMatches) extracted.make = makeMatches[1].trim();

                // Series (Model line) - Skip slash and alternative field names
                const seriesPattern = /(?:Model\s*\/\s*Series|Series\s*\/\s*Model|Model|Series)[\s:./]*([^\n]+?)(?=\n|Body|Variant)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches) {
                    let seriesValue = seriesMatches[1].trim();
                    // Remove leading slash or alternative names if captured
                    seriesValue = seriesValue.replace(/^[\s/]*(?:Series|Model)[\s:/]*/, '').trim();
                    extracted.series = seriesValue;
                }

                // Body Type
                const bodyTypePattern = /(?:Body\s*Type)[\s:.]*([^\n]+?)(?=\n|Color|Engine)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches) extracted.bodyType = bodyTypeMatches[1].trim();

                // Year Model
                const yearModelPattern = /(?:Year|Model)[\s:.]*(\d{4})/;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches) extracted.yearModel = yearModelMatches[1].trim();

                // Color
                const colorPattern = /(?:Color)[\s:.]*([^\n]+?)(?=\n|Fuel|Engine)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches) extracted.color = colorMatches[1].trim();

                // Fuel Type - Handle table format with pipe delimiters and colon format
                const fuelTypePattern = /Fuel\s+Type\s*\|\s*(\w+)|(?:Fuel|Propulsion)\s*(?:Type)?\s*[:.\s]*([A-Za-z]+)/i;
                const fuelTypeMatches = text.match(fuelTypePattern);
                if (fuelTypeMatches) {
                    let fuelValue = fuelTypeMatches[1] || fuelTypeMatches[2]; // Use whichever group matched
                    fuelValue = fuelValue.trim();
                    // Remove common prefixes: "Type", "Fuel", "Kind"
                    fuelValue = fuelValue.replace(/^(Type|Fuel|Kind)[\s:\/]*/i, '').trim();
                    // Remove trailing colons/slashes
                    fuelValue = fuelValue.replace(/^[:.\s\/]+|[:.\s\/]+$/g, '').trim();
                    extracted.fuelType = fuelValue;
                }
                // Gross Vehicle Weight (allow CSR if present)
                const grossWeightPattern = /(?:Gross\s*(?:Vehicle\s*)?(?:Weight|Wt\.?))\s*[:.\s]*([0-9]{2,6})/i;
                const grossWeightMatches = text.match(grossWeightPattern);
                if (grossWeightMatches) extracted.grossWeight = grossWeightMatches[1].trim();

                // Net Weight (allow CSR if present)
                const netWeightPattern = /(?:Net\s*(?:Weight|Wt\.?|Capacity))\s*[:.\s]*([0-9]{2,6})/i;
                const netWeightMatches = text.match(netWeightPattern);
                if (netWeightMatches) extracted.netCapacity = netWeightMatches[1].trim();

                if (extracted.series) extracted.model = extracted.series;
                if (extracted.yearModel) extracted.year = extracted.yearModel;

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

                // **IDENTIFIERS (High Confidence)**
                // VIN (ISO Standard: 17 chars, excludes I, O, Q)
                const vinPattern = /\b(?![IOQ])[A-HJ-NPR-Z0-9]{17}\b/;
                const vinMatches = text.match(vinPattern);
                if (vinMatches) extracted.vin = vinMatches[0].trim();

                // Plate Number - Line-bound extraction (plate-shaped, requires digits)
                // Pattern 1: Table format with label (flexible whitespace around pipe)
                let platePattern = /(?:Plate|Registration|License)\s*(?:Number|No\.?)?\s*[|\s]*([A-Z]{3}\s?-?\s?\d{3,4})/i;
                let plateMatches = text.match(platePattern);

                // Pattern 2: Colon format with label
                if (!plateMatches) {
                    platePattern = /(?:Plate|Registration|License)\s*(?:Number|No\.?)?\s*[:=]\s*([A-Z]{3}\s?-?\s?\d{3,4})/i;
                    plateMatches = text.match(platePattern);
                }

                // Pattern 3: Philippine formats standalone (exclude certificate/clearance numbers)
                if (!plateMatches) {
                    const lines = text.split('\n');
                    for (const line of lines) {
                        // Skip lines containing certificate/clearance context
                        if (!/Certificate|HPG|Clearance/i.test(line)) {
                            const match = line.match(/\b([A-Z]{2,3}\s?-?\s?\d{3,4}|[A-Z]\s?-?\s?\d{3}\s?-?\s?[A-Z]{2}|\d{4}\s?-?\s?[A-Z]{2,3})\b/i);
                            if (match) {
                                plateMatches = match;
                                break;
                            }
                        }
                    }
                }

                if (plateMatches) {
                    let plateValue = plateMatches[1].replace(/\s/g, '').toUpperCase().trim();
                    // Normalize to ABC-1234 format when possible
                    if (plateValue.length === 7 && /^[A-Z]{3}\d{4}$/.test(plateValue)) {
                        plateValue = plateValue.substring(0, 3) + '-' + plateValue.substring(3);
                    } else if (plateValue.length === 6 && /^[A-Z]{3}\d{3}$/.test(plateValue)) {
                        plateValue = plateValue.substring(0, 3) + '-' + plateValue.substring(3);
                    } else if (plateValue.includes('-')) {
                        // Already has hyphen, normalize spacing and placement
                        plateValue = plateValue.replace(/-/g, '');
                        if (plateValue.length >= 6 && /^[A-Z]{3}/.test(plateValue)) {
                            plateValue = plateValue.substring(0, 3) + '-' + plateValue.substring(3);
                        }
                    }
                    extracted.plateNumber = plateValue;
                    // #region agent log
                    console.log('[OCR] Plate number extracted (HPG normalized):', extracted.plateNumber);
                    // #endregion
                }

                // Engine Number
                // Use strict patterns (must contain at least one digit) so labels like
                // "Vehicle Type" are not captured when OCR line order is noisy.
                let engineNumber = null;
                const enginePatterns = [
                    /(?:Engine|Motor)\s*(?:Number|No\.?)?\s*\|\s*([A-Z0-9-]*\d[A-Z0-9-]*)/i,
                    /(?:Engine|Motor)\s*(?:Number|No\.?)?\s*[:=]\s*([A-Z0-9-]*\d[A-Z0-9-]*)/i,
                    /(?:Engine|Motor)\s*(?:Number|No\.?)?\s*\n+\s*([A-Z0-9-]*\d[A-Z0-9-]*)/i,
                    /(?:Engine|Motor)\s*(?:Number|No\.?)?[\s:.-]*([A-Z0-9-]*\d[A-Z0-9-]*)/i
                ];

                for (const pattern of enginePatterns) {
                    const match = text.match(pattern);
                    if (!match || !match[1]) continue;

                    const candidate = match[1].trim();
                    if (candidate.length >= 5 && /\d/.test(candidate) && /[A-Z]/i.test(candidate) && !/^(vehicle|type|number|no)$/i.test(candidate)) {
                        engineNumber = candidate;
                        break;
                    }
                }

                // Line-by-line fallback for table layouts where value appears on next line.
                if (!engineNumber) {
                    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                    for (let i = 0; i < lines.length; i++) {
                        if (!/(?:Engine|Motor)\s*(?:Number|No\.?)?/i.test(lines[i])) continue;

                        const inlineMatch = lines[i].match(/(?:Engine|Motor)\s*(?:Number|No\.?)?\s*[|:=-]?\s*([A-Z0-9-]*\d[A-Z0-9-]*)/i);
                        if (inlineMatch && inlineMatch[1]) {
                            const candidate = inlineMatch[1].trim();
                            if (/\d/.test(candidate) && /[A-Z]/i.test(candidate)) {
                                engineNumber = candidate;
                                break;
                            }
                        }

                        for (let lookahead = 1; lookahead <= 3 && i + lookahead < lines.length; lookahead++) {
                            const nextLineMatch = lines[i + lookahead].match(/\b([A-Z0-9-]*\d[A-Z0-9-]*)\b/i);
                            if (nextLineMatch && nextLineMatch[1]) {
                                const candidate = nextLineMatch[1].trim();
                                if (candidate.length >= 5 && /\d/.test(candidate) && /[A-Z]/i.test(candidate)) {
                                    engineNumber = candidate;
                                    break;
                                }
                            }
                        }
                        if (engineNumber) break;
                    }
                }

                if (engineNumber) extracted.engineNumber = engineNumber;

                // Chassis Number
                const chassisPattern = /(?:Chassis|Frame)\s*No\.?[\s:.]*([A-HJ-NPR-Z0-9]{10,17})/i;
                const chassisMatches = text.match(chassisPattern);
                if (chassisMatches) extracted.chassisNumber = chassisMatches[1].trim();


                // MV File Number
                const mvFilePattern = /\b(\d{4}-\d{7,8})\b/;
                const mvFileMatches = text.match(mvFilePattern);
                if (mvFileMatches) extracted.mvFileNumber = mvFileMatches[1].trim();

                // **DESCRIPTORS (Context-Based)**
                // Make/Brand
                const makePattern = /(?:Make|Brand)[\s:.]*([A-Z]+)/i;
                const makeMatches = text.match(makePattern);
                if (makeMatches) extracted.make = makeMatches[1].trim();

                // Series (Model line)
                const seriesPattern = /(?:Series|Model)[\s:.]*([^\n]+?)(?=\n|Body)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches) extracted.series = seriesMatches[1].trim();

                // Body Type
                const bodyTypePattern = /(?:Body\s*Type)[\s:.]*([^\n]+?)(?=\n|Color|Engine)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches) extracted.bodyType = bodyTypeMatches[1].trim();

                // Year Model
                const yearModelPattern = /(?:Year|Model)[\s:.]*(\d{4})/;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches) extracted.yearModel = yearModelMatches[1].trim();

                // Color
                const colorPattern = /(?:Color)[\s:.]*([^\n]+?)(?=\n|Fuel|Engine)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches) extracted.color = colorMatches[1].trim();

                // Fuel Type - Improved: Exclude "Type" label and normalize value
                const fuelTypePattern = /(?:Fuel|Propulsion)\s*(?:Type)?\s*[:.\s]*([^\n]+?)(?=\n|Engine|$)/i;
                const fuelTypeMatches = text.match(fuelTypePattern);
                if (fuelTypeMatches) {
                    let fuelValue = fuelTypeMatches[1].trim();
                    // Remove common prefixes that might be captured: "Type", "Fuel", "Kind"
                    fuelValue = fuelValue.replace(/^(Type|Fuel|Kind)[\s:\/]*/i, '').trim();
                    // Remove trailing colons/slashes
                    fuelValue = fuelValue.replace(/^[:.\s\/]+|[:.\s\/]+$/g, '').trim();
                    extracted.fuelType = fuelValue;
                }

                // **WEIGHTS (Numeric)**
                // Gross Weight
                const grossWeightPattern = /(?:Gross\s*Wt\.?)[\s:.]*(\d+)/i;
                const grossWeightMatches = text.match(grossWeightPattern);
                if (grossWeightMatches) extracted.grossWeight = grossWeightMatches[1].trim();

                // Net Capacity / Net Weight
                const netCapacityPattern = /(?:Net\s*Cap\.?|Net\s*Wt\.?)[\s:.]*(\d+)/i;
                const netCapacityMatches = text.match(netCapacityPattern);
                if (netCapacityMatches) extracted.netCapacity = netCapacityMatches[1].trim();

                // **BACKWARDS COMPATIBILITY: Map new fields to old field names**
                if (extracted.series) extracted.model = extracted.series;
                if (extracted.yearModel) extracted.year = extracted.yearModel;
            }

            return extracted;
        } catch (topLevelError) {
            // CRITICAL: Catch ANY error that escaped all other try/catch blocks
            console.error('[OCR Debug] CRITICAL ERROR in parseVehicleInfo (top-level catch):', {
                error: topLevelError.message,
                errorName: topLevelError.name,
                stack: topLevelError.stack,
                documentType: documentType,
                textType: typeof text,
                textLength: text ? text.length : 0
            });
            // Always return empty object instead of throwing - prevents route crashes
            return {};
        }
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
