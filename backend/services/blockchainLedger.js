// TrustChain - Blockchain Ledger Storage Service
// Stores all blockchain transactions locally for localhost development

const fs = require('fs');
const path = require('path');

class BlockchainLedger {
    constructor() {
        this.ledgerPath = path.join(process.cwd(), 'blockchain-ledger');
        this.transactionsFile = path.join(this.ledgerPath, 'transactions.json');
        this.blocksFile = path.join(this.ledgerPath, 'blocks.json');
        this.initializeLedger();
    }

    initializeLedger() {
        // Create ledger directory if it doesn't exist
        if (!fs.existsSync(this.ledgerPath)) {
            fs.mkdirSync(this.ledgerPath, { recursive: true });
            console.log('📁 Created blockchain ledger directory');
        }

        // Initialize files if they don't exist
        if (!fs.existsSync(this.transactionsFile)) {
            fs.writeFileSync(this.transactionsFile, JSON.stringify([], null, 2));
            console.log('📄 Created transactions ledger file');
        }

        if (!fs.existsSync(this.blocksFile)) {
            const genesisBlock = {
                blockNumber: 0,
                blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                timestamp: new Date().toISOString(),
                transactions: [],
                nonce: 0,
                merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000'
            };
            fs.writeFileSync(this.blocksFile, JSON.stringify([genesisBlock], null, 2));
            console.log('📄 Created blocks ledger file with genesis block');
        }
    }

    // Add a new transaction to the ledger
    addTransaction(transactionData) {
        try {
            const transaction = {
                id: transactionData.transactionId || 'tx_' + Date.now(),
                type: transactionData.type || 'VEHICLE_REGISTRATION',
                vin: transactionData.vin,
                plateNumber: transactionData.plateNumber,
                owner: transactionData.owner,
                timestamp: new Date().toISOString(),
                blockNumber: this.getNextBlockNumber(),
                status: 'CONFIRMED',
                gasUsed: Math.floor(Math.random() * 50000) + 21000,
                gasPrice: '20000000000', // 20 Gwei
                hash: this.generateTransactionHash(transactionData),
                from: '0x' + Math.random().toString(16).substring(2, 42),
                to: '0x' + Math.random().toString(16).substring(2, 42),
                value: '0',
                input: JSON.stringify(transactionData),
                receipt: {
                    status: '0x1',
                    cumulativeGasUsed: Math.floor(Math.random() * 50000) + 21000,
                    logs: [],
                    contractAddress: null,
                    gasUsed: Math.floor(Math.random() * 50000) + 21000
                }
            };

            // Read existing transactions
            const transactions = this.getAllTransactions();
            transactions.push(transaction);

            // Write back to file
            fs.writeFileSync(this.transactionsFile, JSON.stringify(transactions, null, 2));

            // Add to block
            this.addTransactionToBlock(transaction);

            console.log(`📝 Transaction ${transaction.id} added to ledger`);
            return transaction;

        } catch (error) {
            console.error('❌ Failed to add transaction to ledger:', error);
            throw error;
        }
    }

    // Get all transactions
    getAllTransactions() {
        try {
            const data = fs.readFileSync(this.transactionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Failed to read transactions:', error);
            return [];
        }
    }

    // Get transactions by VIN
    getTransactionsByVin(vin) {
        const transactions = this.getAllTransactions();
        return transactions.filter(tx => tx.vin === vin);
    }

    // Get transactions by owner
    getTransactionsByOwner(ownerEmail) {
        const transactions = this.getAllTransactions();
        return transactions.filter(tx => tx.owner && tx.owner.email === ownerEmail);
    }

    // Get transaction by ID
    getTransactionById(transactionId) {
        const transactions = this.getAllTransactions();
        return transactions.find(tx => tx.id === transactionId);
    }

    // Get all blocks
    getAllBlocks() {
        try {
            const data = fs.readFileSync(this.blocksFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Failed to read blocks:', error);
            return [];
        }
    }

    // Get block by number
    getBlockByNumber(blockNumber) {
        const blocks = this.getAllBlocks();
        return blocks.find(block => block.blockNumber === blockNumber);
    }

    // Get latest block
    getLatestBlock() {
        const blocks = this.getAllBlocks();
        return blocks[blocks.length - 1];
    }

    // Add transaction to block
    addTransactionToBlock(transaction) {
        try {
            const blocks = this.getAllBlocks();
            const latestBlock = blocks[blocks.length - 1];

            // If block has too many transactions, create new block
            if (latestBlock.transactions.length >= 10) {
                const newBlock = {
                    blockNumber: latestBlock.blockNumber + 1,
                    blockHash: this.generateBlockHash(latestBlock, [transaction]),
                    previousHash: latestBlock.blockHash,
                    timestamp: new Date().toISOString(),
                    transactions: [transaction],
                    nonce: Math.floor(Math.random() * 1000000),
                    merkleRoot: this.generateMerkleRoot([transaction])
                };
                blocks.push(newBlock);
            } else {
                // Add to existing block
                latestBlock.transactions.push(transaction);
                latestBlock.blockHash = this.generateBlockHash(latestBlock, latestBlock.transactions);
                latestBlock.merkleRoot = this.generateMerkleRoot(latestBlock.transactions);
            }

            fs.writeFileSync(this.blocksFile, JSON.stringify(blocks, null, 2));
            console.log(`📦 Transaction added to block ${latestBlock.blockNumber}`);

        } catch (error) {
            console.error('❌ Failed to add transaction to block:', error);
            throw error;
        }
    }

    // Generate transaction hash
    generateTransactionHash(transactionData) {
        const crypto = require('crypto');
        const data = JSON.stringify(transactionData) + Date.now();
        return '0x' + crypto.createHash('sha256').update(data).digest('hex');
    }

    // Generate block hash
    generateBlockHash(block, transactions) {
        const crypto = require('crypto');
        const data = JSON.stringify({
            blockNumber: block.blockNumber,
            previousHash: block.previousHash,
            timestamp: block.timestamp,
            transactions: transactions,
            nonce: block.nonce
        });
        return '0x' + crypto.createHash('sha256').update(data).digest('hex');
    }

    // Generate Merkle root
    generateMerkleRoot(transactions) {
        const crypto = require('crypto');
        const hashes = transactions.map(tx => tx.hash);
        return '0x' + crypto.createHash('sha256').update(hashes.join('')).digest('hex');
    }

    // Get next block number
    getNextBlockNumber() {
        const blocks = this.getAllBlocks();
        return blocks.length;
    }

    // Get ledger statistics
    getLedgerStats() {
        const transactions = this.getAllTransactions();
        const blocks = this.getAllBlocks();
        
        return {
            totalTransactions: transactions.length,
            totalBlocks: blocks.length,
            latestBlockNumber: blocks.length - 1,
            ledgerSize: this.getLedgerSize(),
            lastUpdated: new Date().toISOString()
        };
    }

    // Get ledger size in bytes
    getLedgerSize() {
        try {
            const transactionsSize = fs.statSync(this.transactionsFile).size;
            const blocksSize = fs.statSync(this.blocksFile).size;
            return transactionsSize + blocksSize;
        } catch (error) {
            return 0;
        }
    }

    // Search transactions
    searchTransactions(query) {
        const transactions = this.getAllTransactions();
        return transactions.filter(tx => 
            tx.vin.toLowerCase().includes(query.toLowerCase()) ||
            tx.plateNumber.toLowerCase().includes(query.toLowerCase()) ||
            (tx.owner && tx.owner.email.toLowerCase().includes(query.toLowerCase()))
        );
    }
}

module.exports = new BlockchainLedger();
