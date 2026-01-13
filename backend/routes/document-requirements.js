// TrustChain LTO - Document Requirements Routes
// Handles configurable document requirements for vehicle registration

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Get document requirements for a registration type
router.get('/:registrationType', async (req, res) => {
    try {
        const { registrationType } = req.params;
        const { vehicleCategory } = req.query;
        
        const requirements = await db.getDocumentRequirements(
            registrationType, 
            vehicleCategory || 'ALL'
        );
        
        res.json({
            success: true,
            requirements: requirements
        });
    } catch (error) {
        console.error('Error getting document requirements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get document requirements: ' + error.message
        });
    }
});

// Get all document requirements (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { registrationType, vehicleCategory } = req.query;
        
        let requirements;
        if (registrationType) {
            requirements = await db.getDocumentRequirements(
                registrationType,
                vehicleCategory || 'ALL'
            );
        } else {
            // Get all requirements
            const dbModule = require('../database/db');
            const result = await dbModule.query(
                `SELECT * FROM registration_document_requirements 
                 WHERE is_active = true
                 ORDER BY registration_type, display_order ASC`
            );
            requirements = result.rows;
        }
        
        res.json({
            success: true,
            requirements: requirements
        });
    } catch (error) {
        console.error('Error getting all document requirements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get document requirements: ' + error.message
        });
    }
});

// Get single document requirement by ID (admin only)
router.get('/id/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const requirement = await db.getDocumentRequirementById(id);
        
        if (!requirement) {
            return res.status(404).json({
                success: false,
                error: 'Document requirement not found'
            });
        }
        
        res.json({
            success: true,
            requirement: requirement
        });
    } catch (error) {
        console.error('Error getting document requirement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get document requirement: ' + error.message
        });
    }
});

// Create new document requirement (admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const {
            registrationType,
            vehicleCategory,
            documentType,
            isRequired,
            displayName,
            description,
            acceptedFormats,
            maxFileSizeMb,
            displayOrder,
            isActive
        } = req.body;
        
        // Validate required fields
        if (!registrationType || !documentType || !displayName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: registrationType, documentType, displayName'
            });
        }
        
        const requirement = await db.createDocumentRequirement({
            registrationType,
            vehicleCategory: vehicleCategory || 'ALL',
            documentType,
            isRequired: isRequired !== undefined ? isRequired : true,
            displayName,
            description,
            acceptedFormats: acceptedFormats || 'pdf,jpg,jpeg,png',
            maxFileSizeMb: maxFileSizeMb || 10,
            displayOrder: displayOrder || 0,
            isActive: isActive !== undefined ? isActive : true
        });
        
        res.json({
            success: true,
            message: 'Document requirement created successfully',
            requirement: requirement
        });
    } catch (error) {
        console.error('Error creating document requirement:', error);
        
        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Document requirement already exists for this registration type and vehicle category'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to create document requirement: ' + error.message
        });
    }
});

// Update document requirement (admin only)
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            isRequired,
            displayName,
            description,
            acceptedFormats,
            maxFileSizeMb,
            displayOrder,
            isActive
        } = req.body;
        
        const requirement = await db.updateDocumentRequirement(id, {
            isRequired,
            displayName,
            description,
            acceptedFormats,
            maxFileSizeMb,
            displayOrder,
            isActive
        });
        
        if (!requirement) {
            return res.status(404).json({
                success: false,
                error: 'Document requirement not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Document requirement updated successfully',
            requirement: requirement
        });
    } catch (error) {
        console.error('Error updating document requirement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update document requirement: ' + error.message
        });
    }
});

// Delete document requirement (admin only - soft delete)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const requirement = await db.deleteDocumentRequirement(id);
        
        if (!requirement) {
            return res.status(404).json({
                success: false,
                error: 'Document requirement not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Document requirement deleted successfully',
            requirement: requirement
        });
    } catch (error) {
        console.error('Error deleting document requirement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete document requirement: ' + error.message
        });
    }
});

module.exports = router;
