// TrustChain LTO - Redis Configuration
// Provides token blacklist functionality with graceful fallback to in-memory storage

let redisClient = null;
let inMemoryBlacklist = new Map();
let cleanupInterval = null;

/**
 * Initialize Redis connection with graceful fallback to in-memory Map
 */
async function initRedis() {
    // Check if Redis URL is configured
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
        console.log('⚠️  Redis not configured - using in-memory blacklist');
        startInMemoryCleanup();
        return { connected: false, mode: 'memory' };
    }

    try {
        const redis = require('redis');
        
        const redisConfig = {
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379')
            }
        };

        // Add password if configured
        if (process.env.REDIS_PASSWORD) {
            redisConfig.password = process.env.REDIS_PASSWORD;
        }

        // Use URL if provided (overrides host/port)
        if (process.env.REDIS_URL) {
            redisClient = redis.createClient({
                url: process.env.REDIS_URL,
                password: process.env.REDIS_PASSWORD
            });
        } else {
            redisClient = redis.createClient(redisConfig);
        }

        // Handle connection errors
        redisClient.on('error', (err) => {
            console.error('❌ Redis connection error:', err.message);
            console.log('⚠️  Falling back to in-memory blacklist');
            redisClient = null;
            startInMemoryCleanup();
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected successfully');
            if (cleanupInterval) {
                clearInterval(cleanupInterval);
                cleanupInterval = null;
            }
        });

        await redisClient.connect();
        
        return { connected: true, mode: 'redis' };
    } catch (error) {
        console.error('❌ Redis initialization failed:', error.message);
        console.log('⚠️  Falling back to in-memory blacklist');
        redisClient = null;
        startInMemoryCleanup();
        return { connected: false, mode: 'memory' };
    }
}

/**
 * Start periodic cleanup for in-memory blacklist (every 5 minutes)
 */
function startInMemoryCleanup() {
    if (cleanupInterval) {
        return; // Already started
    }

    cleanupInterval = setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [token, expiry] of inMemoryBlacklist.entries()) {
            if (expiry < now) {
                inMemoryBlacklist.delete(token);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired tokens from in-memory blacklist`);
        }
    }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Add token to blacklist
 */
async function addToBlacklist(token, expirySeconds) {
    const expiryTime = Date.now() + (expirySeconds * 1000);
    
    if (redisClient && redisClient.isOpen) {
        try {
            // Store in Redis with expiry
            await redisClient.setEx(`blacklist:${token}`, expirySeconds, '1');
            return true;
        } catch (error) {
            console.error('Redis blacklist error:', error.message);
            // Fallback to in-memory
            inMemoryBlacklist.set(token, expiryTime);
            return true;
        }
    } else {
        // Use in-memory blacklist
        inMemoryBlacklist.set(token, expiryTime);
        return true;
    }
}

/**
 * Check if token is blacklisted
 */
async function isBlacklisted(token) {
    if (redisClient && redisClient.isOpen) {
        try {
            const result = await redisClient.get(`blacklist:${token}`);
            return result === '1';
        } catch (error) {
            console.error('Redis blacklist check error:', error.message);
            // Fallback to in-memory
            const expiry = inMemoryBlacklist.get(token);
            if (!expiry) return false;
            if (expiry < Date.now()) {
                inMemoryBlacklist.delete(token);
                return false;
            }
            return true;
        }
    } else {
        // Check in-memory blacklist
        const expiry = inMemoryBlacklist.get(token);
        if (!expiry) return false;
        if (expiry < Date.now()) {
            inMemoryBlacklist.delete(token);
            return false;
        }
        return true;
    }
}

/**
 * Close Redis connection
 */
async function closeRedis() {
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.quit();
            console.log('✅ Redis connection closed');
        } catch (error) {
            console.error('Error closing Redis:', error.message);
        }
    }
    
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

module.exports = {
    initRedis,
    addToBlacklist,
    isBlacklisted,
    closeRedis
};

