// server/utils/quotaMonitor.js
// Simple quota monitoring system for Gemini API

const fs = require('fs');
const path = require('path');

class QuotaMonitor {
    constructor() {
        this.quotaFile = path.join(__dirname, '../data/quota-usage.json');
        this.dailyLimit = 200; // Gemini 2.0 Flash free tier limit
        this.resetHour = 0; // Reset at midnight UTC
        this.usage = this.loadUsage();
    }

    /**
     * Load usage data from file
     */
    loadUsage() {
        try {
            if (fs.existsSync(this.quotaFile)) {
                const data = JSON.parse(fs.readFileSync(this.quotaFile, 'utf8'));
                
                // Check if we need to reset (new day)
                const today = new Date().toDateString();
                if (data.date !== today) {
                    console.log('New day detected, resetting quota usage');
                    return this.createNewUsageData();
                }
                
                return data;
            }
        } catch (error) {
            console.warn('Error loading quota usage data:', error.message);
        }
        
        return this.createNewUsageData();
    }

    /**
     * Create new usage data structure
     */
    createNewUsageData() {
        return {
            date: new Date().toDateString(),
            requests: 0,
            lastRequest: null,
            quotaExceeded: false,
            resetTime: this.getNextResetTime()
        };
    }

    /**
     * Get next quota reset time
     */
    getNextResetTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(this.resetHour, 0, 0, 0);
        return tomorrow.toISOString();
    }

    /**
     * Save usage data to file
     */
    saveUsage() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.quotaFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.quotaFile, JSON.stringify(this.usage, null, 2));
        } catch (error) {
            console.error('Error saving quota usage data:', error.message);
        }
    }

    /**
     * Check if we can make a request
     */
    canMakeRequest() {
        // Check if quota is exceeded
        if (this.usage.quotaExceeded) {
            return false;
        }

        // Check if we're at the limit
        if (this.usage.requests >= this.dailyLimit) {
            this.usage.quotaExceeded = true;
            this.saveUsage();
            return false;
        }

        return true;
    }

    /**
     * Record a request
     */
    recordRequest() {
        this.usage.requests++;
        this.usage.lastRequest = new Date().toISOString();
        
        // Check if we've hit the limit
        if (this.usage.requests >= this.dailyLimit) {
            this.usage.quotaExceeded = true;
            console.warn(`Daily quota limit reached: ${this.usage.requests}/${this.dailyLimit}`);
        }
        
        this.saveUsage();
        
        // Log usage every 10 requests
        if (this.usage.requests % 10 === 0) {
            console.log(`API Usage: ${this.usage.requests}/${this.dailyLimit} requests today`);
        }
    }

    /**
     * Get current usage statistics
     */
    getUsageStats() {
        const remaining = Math.max(0, this.dailyLimit - this.usage.requests);
        const percentUsed = (this.usage.requests / this.dailyLimit) * 100;
        
        return {
            requests: this.usage.requests,
            limit: this.dailyLimit,
            remaining: remaining,
            percentUsed: Math.round(percentUsed),
            quotaExceeded: this.usage.quotaExceeded,
            resetTime: this.usage.resetTime,
            lastRequest: this.usage.lastRequest
        };
    }

    /**
     * Get time until quota reset
     */
    getTimeUntilReset() {
        const resetTime = new Date(this.usage.resetTime);
        const now = new Date();
        const diff = resetTime.getTime() - now.getTime();
        
        if (diff <= 0) {
            return 'Reset available now';
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    }

    /**
     * Force reset quota (for testing or manual reset)
     */
    forceReset() {
        console.log('Manually resetting quota usage');
        this.usage = this.createNewUsageData();
        this.saveUsage();
    }

    /**
     * Get a warning message when approaching quota limit
     */
    getQuotaWarning() {
        const stats = this.getUsageStats();
        
        if (stats.quotaExceeded) {
            return `⚠️ Daily quota exceeded (${stats.requests}/${stats.limit}). Resets in ${this.getTimeUntilReset()}.`;
        }
        
        if (stats.percentUsed >= 90) {
            return `⚠️ Approaching quota limit: ${stats.requests}/${stats.limit} (${stats.percentUsed}% used)`;
        }
        
        if (stats.percentUsed >= 75) {
            return `📊 Quota usage: ${stats.requests}/${stats.limit} (${stats.percentUsed}% used)`;
        }
        
        return null;
    }
}

// Create singleton instance
const quotaMonitor = new QuotaMonitor();

module.exports = quotaMonitor;
