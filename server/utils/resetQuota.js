/**
 * Quota Reset Utility
 * Resets quota tracking for new API keys
 */

const fs = require('fs').promises;
const path = require('path');

async function resetQuota() {
    console.log('🔄 Resetting Gemini API quota tracking...');
    
    try {
        // Reset quota data file
        const quotaFile = path.join(__dirname, '../data/quota.json');
        const resetData = {
            requestCount: 0,
            lastRequestTime: 0,
            resetTime: getNextResetTime(),
            metrics: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                quotaExceeded: 0,
                lastReset: Date.now()
            },
            lastSaved: Date.now()
        };
        
        // Ensure data directory exists
        const dataDir = path.dirname(quotaFile);
        await fs.mkdir(dataDir, { recursive: true });
        
        await fs.writeFile(quotaFile, JSON.stringify(resetData, null, 2));
        console.log('✅ Quota data reset successfully');
        
        // Reset quota usage file if it exists
        const quotaUsageFile = path.join(__dirname, '../data/quota-usage.json');
        try {
            await fs.writeFile(quotaUsageFile, JSON.stringify({
                dailyUsage: 0,
                lastReset: Date.now(),
                apiKey: 'new_key_' + Date.now()
            }, null, 2));
            console.log('✅ Quota usage file reset');
        } catch (error) {
            console.log('ℹ️ No quota usage file to reset');
        }
        
        console.log('🎉 Quota reset complete! You can now use the new API key.');
        console.log('📊 New quota status:');
        console.log(`   - Requests used: 0/45`);
        console.log(`   - Reset time: ${new Date(resetData.resetTime).toISOString()}`);
        
    } catch (error) {
        console.error('❌ Failed to reset quota:', error);
    }
}

function getNextResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
}

// Run if called directly
if (require.main === module) {
    resetQuota();
}

module.exports = { resetQuota };
