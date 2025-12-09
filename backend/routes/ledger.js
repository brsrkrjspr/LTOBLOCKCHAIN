// TrustChain - Blockchain Ledger Routes
// Reads directly from Hyperledger Fabric (NO local file fallbacks)
const express = require('express');
const router = express.Router();
const fabricService = require('../services/optimizedFabricService');

// Get all transactions from Fabric
router.get('/transactions', async (req, res) => {
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

// Get transactions by VIN from Fabric
router.get('/transactions/vin/:vin', async (req, res) => {
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

// Get transactions by owner from Fabric
router.get('/transactions/owner/:ownerEmail', async (req, res) => {
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

// Get transaction by ID from Fabric
router.get('/transactions/id/:transactionId', async (req, res) => {
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

// Get all blocks from Fabric
router.get('/blocks', async (req, res) => {
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

// Get block by number from Fabric
router.get('/blocks/:blockNumber', async (req, res) => {
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

// Get latest block from Fabric
router.get('/blocks/latest', async (req, res) => {
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

// Get ledger statistics from Fabric
router.get('/stats', async (req, res) => {
    try {
        const transactions = await fabricService.getAllTransactions();
        const blocks = await fabricService.getAllBlocks();
        
        const stats = {
            totalTransactions: transactions.length,
            totalBlocks: blocks.length,
            latestBlockNumber: blocks.length > 0 ? Math.max(...blocks.map(b => b.blockNumber || 0)) : 0,
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

// Search transactions in Fabric
router.get('/search', async (req, res) => {
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

module.exports = router;
