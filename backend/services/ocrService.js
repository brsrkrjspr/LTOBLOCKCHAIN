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
            console.log('[OCR Debug] extractText called:', {filePath, mimeType});
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
            'drivers-license': /^D\d{2}-\d{2}-\d{6,}$/,
            'passport': /^[A-Z]{2}\d{7}$/,
            'national-id': /^\d{4}-\d{4}-\d{4}-\d{1,3}$/,
            'postal-id': /^[A-Z]{2,3}\d{6,9}$|^\d{8,10}$/,
            'voters-id': /^\d{4}-\d{4}-\d{4}$/,
            'sss-id': /^\d{2}-\d{7}-\d{1}$/,
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
     * Get format-specific regex patterns for ID number extraction
     * @param {string} idType - Type of ID (drivers-license, passport, etc.)
     * @returns {Array} Array of regex patterns prioritized by specificity
     */
    getIDNumberPatterns(idType) {
        const patterns = {
            'drivers-license': [
                // Pattern 1: "LICENSE NO: D12-34-567890" (most specific with context)
                /(?:LICENSE\s*(?:NO|NUMBER|#)\.?|DRIVER['\s]*S?\s*LICENSE\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*(D\d{2}-\d{2}-\d{6,})/i,
                // Pattern 2: Standalone "D12-34-567890" format
                /\b(D\d{2}-\d{2}-\d{6,})\b/g
            ],
            'passport': [
                // Pattern 1: "PASSPORT NO: AA1234567" (most specific with context)
                /(?:PASSPORT\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z]{2}\d{7})/i,
                // Pattern 2: Standalone "AA1234567" format
                /\b([A-Z]{2}\d{7})\b/g
            ],
            'national-id': [
                // Pattern 1: "NATIONAL ID: 1234-5678-9012-3" or "CRN: 1234-5678-9012-3"
                /(?:NATIONAL\s*ID|CRN|PHILID)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*(\d{4}-\d{4}-\d{4}-\d{1,3})/i,
                // Pattern 2: Standalone "1234-5678-9012-3" format
                /\b(\d{4}-\d{4}-\d{4}-\d{1,3})\b/g
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
            // Extract ALL LTO Vehicle Information fields with document-aware regex patterns
            // Handles Philippine vehicle documents with compound labels (e.g., "Chassis/VIN", "Make/Brand")
            
            try {
                // **IDENTIFIERS (High Confidence) - Philippine Document Aware**
                // VIN/Chassis: Match compound labels like "Chassis/VIN", "Chassis No", or "VIN"
                const vinPattern = /(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
                const vinMatches = text.match(vinPattern);
                if (vinMatches && vinMatches[1]) {
                    extracted.vin = vinMatches[1].trim();
                    // Also set chassis number to same value (they are the same in Philippine docs)
                    extracted.chassisNumber = vinMatches[1].trim();
                }
                
                // Engine Number: Match "Engine Number", "Engine No", or "Motor No"
                const enginePattern = /(?:Engine\s*Number|Engine\s*No\.?|Motor\s*No\.?)\s*[:.]?\s*([A-Z0-9]+)/i;
                const engineMatches = text.match(enginePattern);
                if (engineMatches && engineMatches[1]) {
                    extracted.engineNumber = engineMatches[1].trim();
                }
                
                // Plate Number: Match "Plate No." or "Plate Number", handle "To be issued"
                const platePattern = /(?:Plate\s*(?:No\.?|Number))\s*[:.]?\s*([A-Z]{3}\s?[-]?\s?\d{3,4}|To\s*be\s*issued)/i;
                const plateMatches = text.match(platePattern);
                if (plateMatches && plateMatches[1]) {
                    // Handle "To be issued" case - return empty string
                    if (plateMatches[1].toLowerCase().includes('to be issued')) {
                        extracted.plateNumber = '';
                    } else {
                        // Clean up spacing and standardize format
                        extracted.plateNumber = plateMatches[1].replace(/\s/g, '-').toUpperCase().trim();
                    }
                }

                // **DESCRIPTORS (Context-Aware) - Philippine Document Aware**
                // Make/Brand: Match compound labels like "Make/Brand" or just "Make"
                const makePattern = /(?:Make\/Brand|Make)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Model|Series)/i;
                const makeMatches = text.match(makePattern);
                if (makeMatches && makeMatches[1]) {
                    const makeValue = makeMatches[1].trim();
                    // Check if Make contains the Series (e.g., "Toyota Corolla")
                    if (makeValue.includes(' ') && !extracted.series) {
                        const parts = makeValue.split(/\s+/);
                        if (parts.length >= 2) {
                            extracted.make = parts[0].trim();
                            // Store the full value; frontend can decide how to split
                            extracted.makeComplete = makeValue;
                        } else {
                            extracted.make = makeValue;
                        }
                    } else {
                        extracted.make = makeValue;
                    }
                }
                
                // Series/Model: Match compound labels like "Model/Series", "Series / Model", or just "Model"
                const seriesPattern = /(?:Model\/Series|Series\s*\/\s*Model|Model)\s*[:.]?\s*([A-Z0-9\s-]+?)(?=\n|$|Variant|Body|Year)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches && seriesMatches[1]) {
                    extracted.series = seriesMatches[1].trim();
                }
                
                // Year Model: Match "Year Model" or "Year"
                const yearModelPattern = /(?:Year\s*Model|Year)\s*[:.]?\s*(\d{4})/i;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches && yearModelMatches[1]) {
                    extracted.yearModel = yearModelMatches[1].trim();
                }
                
                // Body Type: Match "Body Type"
                const bodyTypePattern = /(?:Body\s*Type)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Color)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches && bodyTypeMatches[1]) {
                    extracted.bodyType = bodyTypeMatches[1].trim();
                }
                
                // Color: Match "Color"
                const colorPattern = /(?:Color)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Fuel|Engine)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches && colorMatches[1]) {
                    extracted.color = colorMatches[1].trim();
                }
                
                // Fuel Type: Match "Fuel" or "Propulsion"
                const fuelTypePattern = /(?:Fuel|Propulsion)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Engine|Weight)/i;
                const fuelTypeMatches = text.match(fuelTypePattern);
                if (fuelTypeMatches && fuelTypeMatches[1]) {
                    extracted.fuelType = fuelTypeMatches[1].trim();
                }

                // **WEIGHTS (Numeric)**
                // Gross Weight
                const grossWeightPattern = /(?:Gross\s*Wt\.?|Gross\s*Weight)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
                const grossWeightMatches = text.match(grossWeightPattern);
                if (grossWeightMatches && grossWeightMatches[1]) {
                    extracted.grossWeight = grossWeightMatches[1].trim();
                }
                
                // Net Capacity / Net Weight
                const netCapacityPattern = /(?:Net\s*Cap\.?|Net\s*Capacity|Net\s*Wt\.?|Net\s*Weight)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
                const netCapacityMatches = text.match(netCapacityPattern);
                if (netCapacityMatches && netCapacityMatches[1]) {
                    extracted.netCapacity = netCapacityMatches[1].trim();
                }

                // **BACKWARDS COMPATIBILITY: Keep older field names for Step 2 form**
                if (extracted.series) extracted.model = extracted.series;
                if (extracted.yearModel) extracted.year = extracted.yearModel;
                
                // #region agent log
                console.log('[OCR Debug] Registration cert extraction successful:', {
                    documentType,
                    hasVin: !!extracted.vin,
                    hasEngine: !!extracted.engineNumber,
                    hasPlate: !!extracted.plateNumber,
                    hasMake: !!extracted.make,
                    hasSeries: !!extracted.series,
                    allExtractedKeys: Object.keys(extracted)
                });
                // #endregion

            } catch (regexError) {
                console.error('[OCR Debug] ERROR in registration cert extraction:', {
                    error: regexError.message,
                    documentType
                });
                // Continue with any partially extracted data
            }
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
                textSample: text ? text.substring(0, 500) : 'NO TEXT'
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
            const documentHeader = (text && text.length > 0) ? text.substring(0, Math.min(200, text.length)).toUpperCase() : '';
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
            try {
                for (let i = 0; i < headerPatterns.length && !foundInHeader; i++) {
                    const pattern = headerPatterns[i];
                    if (!documentHeader || typeof documentHeader !== 'string') break;
                    const match = documentHeader.match(pattern);
                    if (match && match[0]) {
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
            } catch (headerError) {
                console.error('[OCR Debug] ERROR in header ID type extraction:', {
                    error: headerError.message,
                    errorName: headerError.name
                });
                // Continue - header extraction failure is not critical
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
                
                try {
                    for (let i = 0; i < idTypePatterns.length; i++) {
                        const pattern = idTypePatterns[i];
                        if (!text || typeof text !== 'string') break;
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
                        
                        if (match && match[0]) {
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
                } catch (idTypeError) {
                    console.error('[OCR Debug] ERROR in ID type extraction:', {
                        error: idTypeError.message,
                        errorName: idTypeError.name
                    });
                    // Continue - ID type extraction failure is not critical
                }
            }
            
            // #region agent log
            if (!extracted.idType) {
                console.log('[OCR Debug] ID Type not found after trying all strategies. Text sample:', text ? text.substring(0, 500) : 'NO TEXT');
                console.log('[OCR Debug] Normalized text sample (for pattern debugging):', text ? text.toUpperCase().replace(/\s+/g, ' ').substring(0, 500) : 'NO TEXT');
            }
            // #endregion
            
            // Extract ID Number with format validation
            // #region agent log
            console.log('[OCR Debug] Starting ID Number extraction with validation');
            // #endregion
            
            if (extracted.idType) {
                const idExtraction = this.extractIDNumberWithValidation(text, extracted.idType);
                
                if (idExtraction.idNumber && idExtraction.confidence > 0.5) {
                    extracted.idNumber = idExtraction.idNumber;
                    // #region agent log
                    console.log('[OCR Debug] ID Number extracted with validation:', {
                        idNumber: extracted.idNumber,
                        confidence: idExtraction.confidence,
                        idType: extracted.idType,
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
                
                // Use generic patterns but still validate against common formats
                const genericPatterns = [
                    /(?:ID\s*(?:NO|NUMBER|#)\.?|IDENTIFICATION\s*(?:NO|NUMBER|#)\.?|LICENSE\s*(?:NO|NUMBER|#)\.?|PASSPORT\s*(?:NO|NUMBER|#)\.?)\s*[:.]?\s*([A-Z0-9\-]{8,20})/i,
                    /\b([A-Z]\d{2}-\d{2}-\d{6,})\b/g, // Driver's License format
                    /\b([A-Z]{2}\d{7})\b/g, // Passport format
                    /\b(\d{4}-\d{4}-\d{4}-\d{1,3})\b/g, // National ID format
                    /\b(\d{4}-\d{4}-\d{4})\b/g, // Voter's ID format
                    /\b(\d{2}-\d{7}-\d{1})\b/g, // SSS ID format
                    /\b(\d{3}-\d{3}-\d{3}-\d{3})\b/g // TIN format
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
                                    // Basic validation: length and format
                                    if (candidate.length >= 8 && candidate.length <= 20 && /^[A-Z0-9\-]+$/.test(candidate)) {
                                        extracted.idNumber = candidate;
                                        foundValidID = true;
                                        // #region agent log
                                        console.log('[OCR Debug] Generic ID Number extracted:', {
                                            idNumber: extracted.idNumber,
                                            patternIndex: i
                                        });
                                        // #endregion
                                    }
                                }
                            }
                        } else {
                            const matches = text.match(pattern);
                            if (matches && matches[1]) {
                                const candidate = matches[1].trim().replace(/\s+/g, '').toUpperCase();
                                if (candidate.length >= 8 && candidate.length <= 20 && /^[A-Z0-9\-]+$/.test(candidate)) {
                                    extracted.idNumber = candidate;
                                    foundValidID = true;
                                    // #region agent log
                                    console.log('[OCR Debug] Generic ID Number extracted:', {
                                        idNumber: extracted.idNumber,
                                        patternIndex: i
                                    });
                                    // #endregion
                                }
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
                extractionSuccess: !!(extracted.idType && extracted.idNumber)
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
            // Extract from Insurance Certificate
            try {
                // Extract Policy Number
                const policyPattern = /(?:POLICY\s*(?:NO|NUMBER)?\.?)\s*[:.]?\s*([A-Z0-9\-]+)/i;
                const policyMatch = text.match(policyPattern);
                if (policyMatch && policyMatch[1]) {
                    extracted.insurancePolicyNumber = policyMatch[1].trim();
                    console.debug('[Insurance] Policy Number extracted:', extracted.insurancePolicyNumber);
                }

                // Extract Expiry Date
                const expiryPattern = /(?:EXPIR|VALID\s*UNTIL|EFFECTIVE\s*TO|EXPIRY)\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
                const expiryMatch = text.match(expiryPattern);
                if (expiryMatch && expiryMatch[1]) {
                    extracted.insuranceExpiry = expiryMatch[1].trim();
                    console.debug('[Insurance] Expiry Date extracted:', extracted.insuranceExpiry);
                }

                // Extract Vehicle Info from Insurance Certificate
                // VIN/Chassis with compound label support
                const vinPattern = /(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
                const vinMatches = text.match(vinPattern);
                if (vinMatches && vinMatches[1]) {
                    extracted.vin = vinMatches[1].trim();
                    extracted.chassisNumber = vinMatches[1].trim();  // Dual assignment
                    console.debug('[Insurance] VIN extracted:', extracted.vin);
                }
                
                // Engine Number
                const enginePattern = /(?:Engine\s*Number|Engine\s*No\.?|Motor\s*No\.?)\s*[:.]?\s*([A-Z0-9]+)/i;
                const engineMatches = text.match(enginePattern);
                if (engineMatches && engineMatches[1]) {
                    extracted.engineNumber = engineMatches[1].trim();
                    console.debug('[Insurance] Engine Number extracted:', extracted.engineNumber);
                }
                
                // Plate Number: Handle "To be issued" explicitly
                const platePattern = /(?:Plate\s*(?:No\.?|Number))\s*[:.]?\s*([A-Z]{3}\s?[-]?\s?\d{3,4}|To\s*be\s*issued)/i;
                const plateMatches = text.match(platePattern);
                if (plateMatches && plateMatches[1]) {
                    if (plateMatches[1].toLowerCase().includes('to be issued')) {
                        extracted.plateNumber = '';  // Empty string for unissued plates
                        console.debug('[Insurance] Plate marked as "To be issued" - set to empty');
                    } else {
                        extracted.plateNumber = plateMatches[1].replace(/\s/g, '-').toUpperCase().trim();
                        console.debug('[Insurance] Plate Number extracted:', extracted.plateNumber);
                    }
                }

                // Make/Brand with compound label support
                const makePattern = /(?:Make\/Brand|Make)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Model|Series|Engine)/i;
                const makeMatches = text.match(makePattern);
                if (makeMatches && makeMatches[1]) {
                    const fullMake = makeMatches[1].trim();
                    extracted.makeComplete = fullMake;
                    extracted.make = fullMake.split(/\s+/)[0];  // First word as main make
                    console.debug('[Insurance] Make extracted:', extracted.make);
                }
                
                // Series/Model with compound label support
                const seriesPattern = /(?:Model\/Series|Series\s*\/\s*Model|Model)\s*[:.]?\s*([A-Z0-9\s-]+?)(?=\n|$|Variant|Body|Year)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches && seriesMatches[1]) {
                    extracted.series = seriesMatches[1].trim();
                    console.debug('[Insurance] Series/Model extracted:', extracted.series);
                }
                
                // Year Model
                const yearModelPattern = /(?:Year\s*Model|Year)\s*[:.]?\s*(\d{4})/i;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches && yearModelMatches[1]) {
                    extracted.yearModel = yearModelMatches[1].trim();
                    console.debug('[Insurance] Year Model extracted:', extracted.yearModel);
                }
                
                // Body Type
                const bodyTypePattern = /(?:Body\s*Type)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Color)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches && bodyTypeMatches[1]) {
                    extracted.bodyType = bodyTypeMatches[1].trim();
                    console.debug('[Insurance] Body Type extracted:', extracted.bodyType);
                }
                
                // Color
                const colorPattern = /(?:Color)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Fuel|Engine)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches && colorMatches[1]) {
                    extracted.color = colorMatches[1].trim();
                    console.debug('[Insurance] Color extracted:', extracted.color);
                }

                // **BACKWARDS COMPATIBILITY: Map new fields to old field names**
                if (extracted.series) extracted.model = extracted.series;
                if (extracted.yearModel) extracted.year = extracted.yearModel;
            } catch (error) {
                console.error('[Insurance] Error during extraction:', error);
            }
        }

        if (documentType === 'sales_invoice' || documentType === 'salesInvoice') {
            // Extract Vehicle Information from Sales Invoice with Philippine document awareness
            try {
                // **IDENTIFIERS (High Confidence) - Philippine Document Aware**
                // VIN/Chassis: Match compound labels
                const vinPattern = /(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
                const vinMatches = text.match(vinPattern);
                if (vinMatches && vinMatches[1]) {
                    extracted.vin = vinMatches[1].trim();
                    extracted.chassisNumber = vinMatches[1].trim();
                }
                
                // Engine Number
                const enginePattern = /(?:Engine\s*Number|Engine\s*No\.?|Motor\s*No\.?)\s*[:.]?\s*([A-Z0-9]+)/i;
                const engineMatches = text.match(enginePattern);
                if (engineMatches && engineMatches[1]) {
                    extracted.engineNumber = engineMatches[1].trim();
                }
                
                // Plate Number: Handle "To be issued"
                const platePattern = /(?:Plate\s*(?:No\.?|Number))\s*[:.]?\s*([A-Z]{3}\s?[-]?\s?\d{3,4}|To\s*be\s*issued)/i;
                const plateMatches = text.match(platePattern);
                if (plateMatches && plateMatches[1]) {
                    if (plateMatches[1].toLowerCase().includes('to be issued')) {
                        extracted.plateNumber = '';
                    } else {
                        extracted.plateNumber = plateMatches[1].replace(/\s/g, '-').toUpperCase().trim();
                    }
                }

                // **DESCRIPTORS (Context-Aware)**
                // Make/Brand: Match compound labels
                const makePattern = /(?:Make\/Brand|Make)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Model|Series)/i;
                const makeMatches = text.match(makePattern);
                if (makeMatches && makeMatches[1]) {
                    const makeValue = makeMatches[1].trim();
                    if (makeValue.includes(' ') && !extracted.series) {
                        extracted.make = makeValue.split(/\s+/)[0].trim();
                        extracted.makeComplete = makeValue;
                    } else {
                        extracted.make = makeValue;
                    }
                }
                
                // Series/Model: Match compound labels
                const seriesPattern = /(?:Model\/Series|Series\s*\/\s*Model|Model)\s*[:.]?\s*([A-Z0-9\s-]+?)(?=\n|$|Variant|Body|Year)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches && seriesMatches[1]) {
                    extracted.series = seriesMatches[1].trim();
                }
                
                // Year Model
                const yearModelPattern = /(?:Year\s*Model|Year)\s*[:.]?\s*(\d{4})/i;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches && yearModelMatches[1]) {
                    extracted.yearModel = yearModelMatches[1].trim();
                }
                
                // Body Type
                const bodyTypePattern = /(?:Body\s*Type)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Color)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches && bodyTypeMatches[1]) {
                    extracted.bodyType = bodyTypeMatches[1].trim();
                }
                
                // Color
                const colorPattern = /(?:Color)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Fuel|Engine)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches && colorMatches[1]) {
                    extracted.color = colorMatches[1].trim();
                }
                
                // Fuel Type
                const fuelTypePattern = /(?:Fuel|Propulsion)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Engine|Weight)/i;
                const fuelTypeMatches = text.match(fuelTypePattern);
                if (fuelTypeMatches && fuelTypeMatches[1]) {
                    extracted.fuelType = fuelTypeMatches[1].trim();
                }

                // **BACKWARDS COMPATIBILITY**
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
            // Extract Vehicle Information from CSR (Certificate of Stock Report - Philippine document)
            try {
                // **IDENTIFIERS (High Confidence)**
                // VIN (ISO Standard: 17 chars, excludes I, O, Q)
                // Handles compound labels: "Chassis/VIN", "Chassis No.", "VIN"
                const vinPattern = /(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
                const vinMatches = text.match(vinPattern);
                if (vinMatches && vinMatches[1]) {
                    extracted.vin = vinMatches[1].trim();
                    extracted.chassisNumber = vinMatches[1].trim();  // Dual assignment: VIN = Chassis in PH docs
                    console.debug('[CSR] VIN extracted (compound-label-aware):', extracted.vin);
                }
                
                // Engine Number
                // Handles variants: "Engine Number", "Engine No.", "Motor No."
                const enginePattern = /(?:Engine\s*Number|Engine\s*No\.?|Motor\s*No\.?)\s*[:.]?\s*([A-Z0-9]+)/i;
                const engineMatches = text.match(enginePattern);
                if (engineMatches && engineMatches[1]) {
                    extracted.engineNumber = engineMatches[1].trim();
                    console.debug('[CSR] Engine Number extracted:', extracted.engineNumber);
                }
                
                // Plate Number
                // Handles: "Plate No.", "Plate Number", "To be issued"
                const platePattern = /(?:Plate\s*(?:No\.?|Number))\s*[:.]?\s*([A-Z]{3}\s?[-]?\s?\d{3,4}|To\s*be\s*issued)/i;
                const plateMatches = text.match(platePattern);
                if (plateMatches && plateMatches[1]) {
                    if (plateMatches[1].toLowerCase().includes('to be issued')) {
                        extracted.plateNumber = '';  // Empty string for unissued plates
                        console.debug('[CSR] Plate marked as "To be issued" - set to empty');
                    } else {
                        extracted.plateNumber = plateMatches[1].replace(/\s/g, '-').toUpperCase().trim();
                        console.debug('[CSR] Plate Number extracted:', extracted.plateNumber);
                    }
                }
                
                // MV File Number
                const mvFilePattern = /\b(\d{4}-\d{7,8})\b/;
                const mvFileMatches = text.match(mvFilePattern);
                if (mvFileMatches && mvFileMatches[1]) {
                    extracted.mvFileNumber = mvFileMatches[1].trim();
                    console.debug('[CSR] MV File Number extracted:', extracted.mvFileNumber);
                }

                // **DESCRIPTORS (Context-Based)**
                // Make/Brand - handles compound label "Make/Brand"
                const makePattern = /(?:Make\/Brand|Make)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Model|Series|Engine)/i;
                const makeMatches = text.match(makePattern);
                if (makeMatches && makeMatches[1]) {
                    const fullMake = makeMatches[1].trim();
                    extracted.makeComplete = fullMake;
                    extracted.make = fullMake.split(/\s+/)[0];  // First word as main make
                    console.debug('[CSR] Make extracted:', extracted.make, '(full:', extracted.makeComplete + ')');
                }
                
                // Series/Model - handles compound labels: "Model/Series", "Series / Model", "Model"
                const seriesPattern = /(?:Model\/Series|Series\s*\/\s*Model|Model)\s*[:.]?\s*([A-Z0-9\s-]+?)(?=\n|$|Variant|Body|Year)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches && seriesMatches[1]) {
                    extracted.series = seriesMatches[1].trim();
                    console.debug('[CSR] Series/Model extracted:', extracted.series);
                }
                
                // Body Type
                const bodyTypePattern = /(?:Body\s*Type)\s*[:.]?\s*([A-Z0-9\s]+?)(?=\n|$|Year|Color)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches && bodyTypeMatches[1]) {
                    extracted.bodyType = bodyTypeMatches[1].trim();
                    console.debug('[CSR] Body Type extracted:', extracted.bodyType);
                }
                
                // Year Model
                const yearModelPattern = /(?:Year|Model\s*Year)\s*[:.]?\s*(\d{4})/i;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches && yearModelMatches[1]) {
                    extracted.yearModel = yearModelMatches[1].trim();
                    console.debug('[CSR] Year Model extracted:', extracted.yearModel);
                }
                
                // Color
                const colorPattern = /(?:Color)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Fuel)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches && colorMatches[1]) {
                    extracted.color = colorMatches[1].trim();
                    console.debug('[CSR] Color extracted:', extracted.color);
                }
                
                // Fuel Type
                const fuelTypePattern = /(?:Fuel\s*Type|Propulsion)\s*[:.]?\s*([A-Z]+)/i;
                const fuelTypeMatches = text.match(fuelTypePattern);
                if (fuelTypeMatches && fuelTypeMatches[1]) {
                    extracted.fuelType = fuelTypeMatches[1].trim();
                    console.debug('[CSR] Fuel Type extracted:', extracted.fuelType);
                }

                // **WEIGHTS (Numeric with decimal support)**
                // Gross Weight
                const grossWeightPattern = /(?:Gross\s*(?:Wt|Weight)\.?)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
                const grossWeightMatches = text.match(grossWeightPattern);
                if (grossWeightMatches && grossWeightMatches[1]) {
                    extracted.grossWeight = grossWeightMatches[1].trim();
                    console.debug('[CSR] Gross Weight extracted:', extracted.grossWeight);
                }
                
                // Net Capacity / Net Weight
                const netCapacityPattern = /(?:Net\s*(?:Cap|Capacity|Wt|Weight)\.?)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
                const netCapacityMatches = text.match(netCapacityPattern);
                if (netCapacityMatches && netCapacityMatches[1]) {
                    extracted.netCapacity = netCapacityMatches[1].trim();
                    console.debug('[CSR] Net Capacity extracted:', extracted.netCapacity);
                }

                // **BACKWARDS COMPATIBILITY: Map new fields to old field names**
                if (extracted.series) extracted.model = extracted.series;
                if (extracted.yearModel) extracted.year = extracted.yearModel;

                // CSR Number
                const csrNumberPattern = /(?:CSR\s*(?:NO|NUMBER)|CERTIFICATE\s*(?:NO|NUMBER)|STOCK\s*REPORT\s*(?:NO|NUMBER))\s*[:.]?\s*([A-Z0-9\-]+)/i;
                const csrNumberMatch = text.match(csrNumberPattern);
                if (csrNumberMatch && csrNumberMatch[1]) {
                    extracted.csrNumber = csrNumberMatch[1].trim();
                    console.debug('[CSR] CSR Number extracted:', extracted.csrNumber);
                }
            } catch (error) {
                console.error('[CSR] Error during extraction:', error);
            }
        }

        if (documentType === 'hpg_clearance' || documentType === 'hpgClearance' || documentType === 'pnpHpgClearance') {
            // Extract from HPG Clearance Certificate (Philippine PNP document)
            try {
                // Clearance Number
                const clearanceNumberPattern = /(?:CLEARANCE\s*(?:NO|NUMBER)|CERTIFICATE\s*(?:NO|NUMBER)|MV\s*CLEARANCE\s*(?:NO|NUMBER))\s*[:.]?\s*([A-Z0-9\-]+)/i;
                const clearanceMatch = text.match(clearanceNumberPattern);
                if (clearanceMatch && clearanceMatch[1]) {
                    extracted.clearanceNumber = clearanceMatch[1].trim();
                    console.debug('[HPG] Clearance Number extracted:', extracted.clearanceNumber);
                }

                // **IDENTIFIERS (High Confidence)**
                // VIN (ISO Standard: 17 chars, excludes I, O, Q)
                // Handles compound labels: "Chassis/VIN", "Chassis No.", "VIN"
                const vinPattern = /(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
                const vinMatches = text.match(vinPattern);
                if (vinMatches && vinMatches[1]) {
                    extracted.vin = vinMatches[1].trim();
                    extracted.chassisNumber = vinMatches[1].trim();  // Dual assignment: VIN = Chassis in PH docs
                    console.debug('[HPG] VIN extracted (compound-label-aware):', extracted.vin);
                }
                
                // Engine Number
                // Handles variants: "Engine Number", "Engine No.", "Motor No."
                const enginePattern = /(?:Engine\s*Number|Engine\s*No\.?|Motor\s*No\.?)\s*[:.]?\s*([A-Z0-9]+)/i;
                const engineMatches = text.match(enginePattern);
                if (engineMatches && engineMatches[1]) {
                    extracted.engineNumber = engineMatches[1].trim();
                    console.debug('[HPG] Engine Number extracted:', extracted.engineNumber);
                }
                
                // Plate Number
                // Handles: "Plate No.", "Plate Number", "To be issued"
                const platePattern = /(?:Plate\s*(?:No\.?|Number))\s*[:.]?\s*([A-Z]{3}\s?[-]?\s?\d{3,4}|To\s*be\s*issued)/i;
                const plateMatches = text.match(platePattern);
                if (plateMatches && plateMatches[1]) {
                    if (plateMatches[1].toLowerCase().includes('to be issued')) {
                        extracted.plateNumber = '';  // Empty string for unissued plates
                        console.debug('[HPG] Plate marked as "To be issued" - set to empty');
                    } else {
                        extracted.plateNumber = plateMatches[1].replace(/\s/g, '-').toUpperCase().trim();
                        console.debug('[HPG] Plate Number extracted:', extracted.plateNumber);
                    }
                }
                
                // MV File Number
                const mvFilePattern = /\b(\d{4}-\d{7,8})\b/;
                const mvFileMatches = text.match(mvFilePattern);
                if (mvFileMatches && mvFileMatches[1]) {
                    extracted.mvFileNumber = mvFileMatches[1].trim();
                    console.debug('[HPG] MV File Number extracted:', extracted.mvFileNumber);
                }

                // **DESCRIPTORS (Context-Based)**
                // Make/Brand - handles compound label "Make/Brand"
                const makePattern = /(?:Make\/Brand|Make)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Model|Series|Engine)/i;
                const makeMatches = text.match(makePattern);
                if (makeMatches && makeMatches[1]) {
                    const fullMake = makeMatches[1].trim();
                    extracted.makeComplete = fullMake;
                    extracted.make = fullMake.split(/\s+/)[0];  // First word as main make
                    console.debug('[HPG] Make extracted:', extracted.make, '(full:', extracted.makeComplete + ')');
                }
                
                // Series/Model - handles compound labels: "Model/Series", "Series / Model", "Model"
                const seriesPattern = /(?:Model\/Series|Series\s*\/\s*Model|Model)\s*[:.]?\s*([A-Z0-9\s-]+?)(?=\n|$|Variant|Body|Year)/i;
                const seriesMatches = text.match(seriesPattern);
                if (seriesMatches && seriesMatches[1]) {
                    extracted.series = seriesMatches[1].trim();
                    console.debug('[HPG] Series/Model extracted:', extracted.series);
                }
                
                // Body Type
                const bodyTypePattern = /(?:Body\s*Type)\s*[:.]?\s*([A-Z0-9\s]+?)(?=\n|$|Year|Color)/i;
                const bodyTypeMatches = text.match(bodyTypePattern);
                if (bodyTypeMatches && bodyTypeMatches[1]) {
                    extracted.bodyType = bodyTypeMatches[1].trim();
                    console.debug('[HPG] Body Type extracted:', extracted.bodyType);
                }
                
                // Year Model
                const yearModelPattern = /(?:Year|Model\s*Year)\s*[:.]?\s*(\d{4})/i;
                const yearModelMatches = text.match(yearModelPattern);
                if (yearModelMatches && yearModelMatches[1]) {
                    extracted.yearModel = yearModelMatches[1].trim();
                    console.debug('[HPG] Year Model extracted:', extracted.yearModel);
                }
                
                // Color
                const colorPattern = /(?:Color)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Fuel)/i;
                const colorMatches = text.match(colorPattern);
                if (colorMatches && colorMatches[1]) {
                    extracted.color = colorMatches[1].trim();
                    console.debug('[HPG] Color extracted:', extracted.color);
                }
                
                // Fuel Type
                const fuelTypePattern = /(?:Fuel\s*Type|Propulsion)\s*[:.]?\s*([A-Z]+)/i;
                const fuelTypeMatches = text.match(fuelTypePattern);
                if (fuelTypeMatches && fuelTypeMatches[1]) {
                    extracted.fuelType = fuelTypeMatches[1].trim();
                    console.debug('[HPG] Fuel Type extracted:', extracted.fuelType);
                }

                // **WEIGHTS (Numeric with decimal support)**
                // Gross Weight
                const grossWeightPattern = /(?:Gross\s*(?:Wt|Weight)\.?)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
                const grossWeightMatches = text.match(grossWeightPattern);
                if (grossWeightMatches && grossWeightMatches[1]) {
                    extracted.grossWeight = grossWeightMatches[1].trim();
                    console.debug('[HPG] Gross Weight extracted:', extracted.grossWeight);
                }
                
                // Net Capacity / Net Weight
                const netCapacityPattern = /(?:Net\s*(?:Cap|Capacity|Wt|Weight)\.?)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
                const netCapacityMatches = text.match(netCapacityPattern);
                if (netCapacityMatches && netCapacityMatches[1]) {
                    extracted.netCapacity = netCapacityMatches[1].trim();
                    console.debug('[HPG] Net Capacity extracted:', extracted.netCapacity);
                }

                // **BACKWARDS COMPATIBILITY: Map new fields to old field names**
                if (extracted.series) extracted.model = extracted.series;
                if (extracted.yearModel) extracted.year = extracted.yearModel;
            } catch (error) {
                console.error('[HPG] Error during extraction:', error);
            }
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
