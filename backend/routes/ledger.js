// TrustChain - Blockchain Ledger Routes
const express = require('express');
const router = express.Router();
const blockchainLedger = require('../services/blockchainLedger');

// Get all transactions
router.get('/transactions', (req, res) => {
    try {
        const transactions = blockchainLedger.getAllTransactions();
        res.json({
            success: true,
            transactions: transactions,
            total: transactions.length
        });
    } catch (error) {
        console.error('Failed to get transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve transactions'
        });
    }
});

// Get transactions by VIN
router.get('/transactions/vin/:vin', (req, res) => {
    try {
        const { vin } = req.params;
        const transactions = blockchainLedger.getTransactionsByVin(vin);
        res.json({
            success: true,
            vin: vin,
            transactions: transactions,
            total: transactions.length
        });
    } catch (error) {
        console.error('Failed to get transactions by VIN:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve transactions'
        });
    }
});

// Get transactions by owner
router.get('/transactions/owner/:ownerEmail', (req, res) => {
    try {
        const { ownerEmail } = req.params;
        const transactions = blockchainLedger.getTransactionsByOwner(ownerEmail);
        res.json({
            success: true,
            ownerEmail: ownerEmail,
            transactions: transactions,
            total: transactions.length
        });
    } catch (error) {
        console.error('Failed to get transactions by owner:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve transactions'
        });
    }
});

// Get transaction by ID
router.get('/transactions/id/:transactionId', (req, res) => {
    try {
        const { transactionId } = req.params;
        const transaction = blockchainLedger.getTransactionById(transactionId);
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }
        
        res.json({
            success: true,
            transaction: transaction
        });
    } catch (error) {
        console.error('Failed to get transaction by ID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve transaction'
        });
    }
});

// Get all blocks
router.get('/blocks', (req, res) => {
    try {
        const blocks = blockchainLedger.getAllBlocks();
        res.json({
            success: true,
            blocks: blocks,
            total: blocks.length
        });
    } catch (error) {
        console.error('Failed to get blocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve blocks'
        });
    }
});

// Get block by number
router.get('/blocks/:blockNumber', (req, res) => {
    try {
        const { blockNumber } = req.params;
        const block = blockchainLedger.getBlockByNumber(parseInt(blockNumber));
        
        if (!block) {
            return res.status(404).json({
                success: false,
                error: 'Block not found'
            });
        }
        
        res.json({
            success: true,
            block: block
        });
    } catch (error) {
        console.error('Failed to get block:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve block'
        });
    }
});

// Get latest block
router.get('/blocks/latest', (req, res) => {
    try {
        const latestBlock = blockchainLedger.getLatestBlock();
        res.json({
            success: true,
            block: latestBlock
        });
    } catch (error) {
        console.error('Failed to get latest block:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve latest block'
        });
    }
});

// Get ledger statistics
router.get('/stats', (req, res) => {
    try {
        const stats = blockchainLedger.getLedgerStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Failed to get ledger stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve ledger statistics'
        });
    }
});

// Search transactions
router.get('/search', (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        
        const results = blockchainLedger.searchTransactions(q);
        res.json({
            success: true,
            query: q,
            results: results,
            total: results.length
        });
    } catch (error) {
        console.error('Failed to search transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search transactions'
        });
    }
});

module.exports = router;
