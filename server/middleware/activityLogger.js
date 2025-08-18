// server/middleware/activityLogger.js

const ActivityLog = require('../models/ActivityLog');
const { broadcastActivity } = require('../utils/activityEvents');

function maskSensitive(data) {
    if (!data || typeof data !== 'object') return data;
    const clone = JSON.parse(JSON.stringify(data));
    const sensitiveKeys = ['password', 'token', 'apiKey', 'geminiApiKey', 'deepseekApiKey', 'qwenApiKey'];
    const mask = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach((key) => {
            if (sensitiveKeys.includes(key)) {
                obj[key] = '***';
            } else if (typeof obj[key] === 'object') {
                mask(obj[key]);
            }
        });
    };
    mask(clone);
    return clone;
}

const activityLogger = (options = {}) => {
    const { skipPaths = ['/'], enabled = true } = options;
    return async (req, res, next) => {
        if (!enabled) return next();
        const start = Date.now();
        const originalEnd = res.end;
        res.end = function(...args) {
            try {
                const duration = Date.now() - start;
                const endpoint = req.originalUrl || req.url;
                const shouldSkip = skipPaths.some((p) => endpoint.startsWith(p));
                if (!shouldSkip) {
                    const headerUserId = req.headers['x-user-id'] || req.headers['X-User-ID'] || req.headers['user-id'] || req.headers['User-ID'];
                    const user = req.user || { id: headerUserId };
                    const activityDoc = {
                        userId: user._id || user.id || undefined,
                        username: user.username || '',
                        // Only log minimal fields for privacy
                        action: `${req.method} ${endpoint}`,
                        method: req.method,
                        endpoint,
                        statusCode: res.statusCode,
                        responseTimeMs: duration
                    };
                    try { broadcastActivity({ type: 'activity', payload: { ...activityDoc, createdAt: new Date() } }); } catch(_) {}
                    const log = new ActivityLog(activityDoc);
                    log.save().catch(() => {});
                }
            } catch (_) {}
            return originalEnd.apply(this, args);
        };
        next();
    };
};

module.exports = { activityLogger };


