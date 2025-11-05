// TrustChain LTO - Laptop Cleanup Script
const fs = require('fs');
const path = require('path');

console.log('TrustChain LTO Cleanup');
console.log('=========================');

// Cleanup old logs (keep 7 days)
const logsPath = path.join(process.cwd(), 'logs');
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 7);

if (fs.existsSync(logsPath)) {
    const files = fs.readdirSync(logsPath);
    let cleanedCount = 0;
    
    files.forEach(file => {
        const filePath = path.join(logsPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            cleanedCount++;
        }
    });
    
    console.log(Cleaned up $cleanedCount old log files);
}

// Cleanup old backups (keep 30 days)
const backupPath = path.join(process.cwd(), 'backup');
if (fs.existsSync(backupPath)) {
    const backupCutoff = new Date();
    backupCutoff.setDate(backupCutoff.getDate() - 30);
    
    const backups = fs.readdirSync(backupPath);
    let cleanedBackups = 0;
    
    backups.forEach(backup => {
        const backupDir = path.join(backupPath, backup);
        const stats = fs.statSync(backupDir);
        
        if (stats.mtime < backupCutoff) {
            fs.rmSync(backupDir, { recursive: true, force: true });
            cleanedBackups++;
        }
    });
    
    console.log(Cleaned up $cleanedBackups old backups);
}

// Cleanup temporary files
const tempPaths = ['uploads/temp', 'logs/temp'];
tempPaths.forEach(tempPath => {
    const fullPath = path.join(process.cwd(), tempPath);
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(Cleaned up temporary directory: $tempPath);
    }
});

console.log('Cleanup completed!');
