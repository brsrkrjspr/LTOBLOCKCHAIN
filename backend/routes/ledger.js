// TrustChain - Blockchain Ledger Routes
// Reads directly from Hyperledger Fabric (NO local file fallbacks)
const express = require('express');
const router = express.Router();
const fabricService = require('../services/optimizedFabricService');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Get all transactions from Fabric (admin only)
router.get('/transactions', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const transactions = await fabricService.getAllTransactions();
        res.json({
            success: true,
            transactions: transactions,
            total: transactions.length,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to get transactions from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve transactions from Fabric: ${error.message}`
        });
    }
});

// Get real Fabric transactions only (64-char hex IDs) - for blockchain viewer
router.get('/transactions/fabric', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const allTransactions = await fabricService.getAllTransactions();
        
        // Filter to only real Fabric transactions (64-char hex IDs)
        const fabricTransactions = allTransactions.filter(tx => {
            const txId = tx.id || tx.transactionId;
            return txId && /^[a-f0-9]{64}$/i.test(txId);
        });
        
        res.json({
            success: true,
            transactions: fabricTransactions,
            total: fabricTransactions.length,
            source: 'Hyperledger Fabric',
            type: 'blockchain_transactions'
        });
    } catch (error) {
        console.error('Failed to get Fabric transactions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get synthetic history records only (non-64-char hex IDs) - for activity log
router.get('/transactions/history', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const allTransactions = await fabricService.getAllTransactions();
        
        // Filter to synthetic transactions (non-64-char hex IDs)
        const historyRecords = allTransactions.filter(tx => {
            const txId = tx.id || tx.transactionId;
            return !txId || !/^[a-f0-9]{64}$/i.test(txId);
        });
        
        res.json({
            success: true,
            records: historyRecords,
            total: historyRecords.length,
            source: 'PostgreSQL vehicle_history',
            type: 'history_records'
        });
    } catch (error) {
        console.error('Failed to get history records:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get transactions by VIN from Fabric (authenticated users)
router.get('/transactions/vin/:vin', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;
        const allTransactions = await fabricService.getAllTransactions();
        const transactions = allTransactions.filter(tx => tx.vin === vin);
        res.json({
            success: true,
            vin: vin,
            transactions: transactions,
            total: transactions.length,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to get transactions by VIN from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve transactions from Fabric: ${error.message}`
        });
    }
});

// Get transactions by owner from Fabric (authenticated users)
router.get('/transactions/owner/:ownerEmail', authenticateToken, async (req, res) => {
    try {
        const { ownerEmail } = req.params;
        const allTransactions = await fabricService.getAllTransactions();
        const transactions = allTransactions.filter(tx => 
            tx.owner && (tx.owner.email === ownerEmail || tx.owner.email?.toLowerCase() === ownerEmail.toLowerCase())
        );
        res.json({
            success: true,
            ownerEmail: ownerEmail,
            transactions: transactions,
            total: transactions.length,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to get transactions by owner from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve transactions from Fabric: ${error.message}`
        });
    }
});

// Get transaction by ID from Fabric (authenticated users)
router.get('/transactions/id/:transactionId', authenticateToken, async (req, res) => {
    try {
        const { transactionId } = req.params;
        const allTransactions = await fabricService.getAllTransactions();
        const transaction = allTransactions.find(tx => 
            tx.id === transactionId || tx.transactionId === transactionId
        );
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found on Fabric ledger'
            });
        }
        
        res.json({
            success: true,
            transaction: transaction,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to get transaction by ID from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve transaction from Fabric: ${error.message}`
        });
    }
});

// Get all blocks from Fabric (admin only)
router.get('/blocks', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const blocks = await fabricService.getAllBlocks();
        res.json({
            success: true,
            blocks: blocks,
            total: blocks.length,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to get blocks from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve blocks from Fabric: ${error.message}`
        });
    }
});

// Get block by number from Fabric (admin only)
router.get('/blocks/:blockNumber', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { blockNumber } = req.params;
        const allBlocks = await fabricService.getAllBlocks();
        const block = allBlocks.find(b => b.blockNumber === parseInt(blockNumber));
        
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found on Fabric ledger'
            });
        }
        
        res.json({
            success: true,
            block: block,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to get block from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve block from Fabric: ${error.message}`
        });
    }
});

// Get latest block from Fabric (admin only)
router.get('/blocks/latest', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const allBlocks = await fabricService.getAllBlocks();
        const latestBlock = allBlocks.length > 0 ? allBlocks[allBlocks.length - 1] : null;
        
        if (!latestBlock) {
            return res.status(404).json({
                success: false,
                error: 'No blocks found on Fabric ledger'
            });
        }
        
        res.json({
            success: true,
            block: latestBlock,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to get latest block from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve latest block from Fabric: ${error.message}`
        });
    }
});

// Get ledger statistics from Fabric (admin only)
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const [transactions, blocks, chainInfo] = await Promise.all([
            fabricService.getAllTransactions(),
            fabricService.getAllBlocks(),
            fabricService.getChainInfo().catch(() => null)
        ]);

        const stats = {
            totalTransactions: transactions.length,
            totalBlocks: blocks.length,
            latestBlockNumber: blocks.length > 0 ? Math.max(...blocks.map(b => b.blockNumber || 0)) : 0,
            height: chainInfo?.height ?? (blocks.length > 0 ? Math.max(...blocks.map(b => b.blockNumber || 0)) + 1 : 0),
            currentBlockHash: chainInfo?.currentBlockHash || null,
            previousBlockHash: chainInfo?.previousBlockHash || null,
            ledgerSizeBytes: chainInfo?.ledgerSizeBytes || null,
            source: 'Hyperledger Fabric',
            lastUpdated: new Date().toISOString()
        };
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Failed to get ledger stats from Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to retrieve ledger statistics from Fabric: ${error.message}`
        });
    }
});

// Search transactions in Fabric (authenticated users)
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        
        const allTransactions = await fabricService.getAllTransactions();
        const queryLower = q.toLowerCase();
        const results = allTransactions.filter(tx => 
            (tx.vin && tx.vin.toLowerCase().includes(queryLower)) ||
            (tx.plateNumber && tx.plateNumber.toLowerCase().includes(queryLower)) ||
            (tx.owner && tx.owner.email && tx.owner.email.toLowerCase().includes(queryLower)) ||
            (tx.transactionId && tx.transactionId.toLowerCase().includes(queryLower))
        );
        
        res.json({
            success: true,
            query: q,
            results: results,
            total: results.length,
            source: 'Hyperledger Fabric'
        });
    } catch (error) {
        console.error('Failed to search transactions in Fabric:', error);
        res.status(500).json({
            success: false,
            error: `Failed to search transactions in Fabric: ${error.message}`
        });
    }
});

// Chain-level proof (height, current/previous block hashes)
router.get('/proof/chain', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const chainInfo = await fabricService.getChainInfo();
        res.json({ success: true, chain: chainInfo });
    } catch (error) {
        console.error('Failed to get chain proof from Fabric:', error);
        res.status(500).json({ success: false, error: `Failed to retrieve chain proof: ${error.message}` });
    }
});

// Block-level proof
router.get('/proof/block/:blockNumber', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { blockNumber } = req.params;
        
        // Validate block number format (non-negative integer)
        const blockNum = parseInt(blockNumber, 10);
        if (isNaN(blockNum) || blockNum < 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid block number. Expected non-negative integer.' 
            });
        }
        
        const block = await fabricService.getBlockHeader(blockNumber);
        res.json({ success: true, block });
    } catch (error) {
        console.error('Failed to get block proof from Fabric:', error);
        
        // Check if it's a "not found" error
        const isNotFound = error.message && (
            error.message.includes('not found') ||
            error.message.includes('does not exist') ||
            error.message.includes('NOT_FOUND')
        );
        
        const statusCode = isNotFound ? 404 : 500;
        res.status(statusCode).json({ 
            success: false, 
            error: `Failed to retrieve block proof: ${error.message}` 
        });
    }
});

// Transaction-level proof with endorsements and block placement
router.get('/proof/tx/:txId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { txId } = req.params;
        
        // Validate transaction ID format (64-character hex)
        if (!txId || !/^[a-f0-9]{64}$/i.test(txId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid Fabric transaction ID format. Expected 64-character hexadecimal string.' 
            });
        }
        
        const proof = await fabricService.getTransactionProof(txId);
        res.json({ success: true, proof });
    } catch (error) {
        console.error('Failed to get transaction proof from Fabric:', error);
        console.error('Error stack:', error.stack);
        
        // Check if it's a "not found" error
        const errorMsg = error.message || String(error);
        const isNotFound = errorMsg && (
            errorMsg.toLowerCase().includes('not found') ||
            errorMsg.toLowerCase().includes('does not exist') ||
            errorMsg.toLowerCase().includes('not_found') ||
            errorMsg.toLowerCase().includes('not found in any block')
        );
        
        // Check if it's a validation error (400)
        const isValidationError = errorMsg && (
            errorMsg.toLowerCase().includes('invalid') ||
            errorMsg.toLowerCase().includes('format') ||
            errorMsg.toLowerCase().includes('required')
        );
        
        let statusCode = 500;
        if (isNotFound) {
            statusCode = 404;
        } else if (isValidationError) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({ 
            success: false, 
            error: `Failed to retrieve transaction proof: ${errorMsg}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
