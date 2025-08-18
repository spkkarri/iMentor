// server/controllers/activityLogController.js

const ActivityLog = require('../models/ActivityLog');

const getActivityLogs = async (req, res) => {
    try {
        const { userId, method, endpoint, status, page = 1, limit = 50, search } = req.query;

        const filter = {};
        if (userId) filter.userId = userId;
        if (method) filter.method = method.toUpperCase();
        if (endpoint) filter.endpoint = { $regex: endpoint, $options: 'i' };
        if (status) filter.statusCode = Number(status);
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { action: { $regex: search, $options: 'i' } },
                { endpoint: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const projection = { username: 1, userId: 1, action: 1, method: 1, endpoint: 1, statusCode: 1, createdAt: 1 };
        const [items, total] = await Promise.all([
            ActivityLog.find(filter, projection)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            ActivityLog.countDocuments(filter)
        ]);

        res.json({ items, total, page: Number(page), pageSize: Number(limit) });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
};

const getActivitySummary = async (req, res) => {
    try {
        const days = Number(req.query.days || 7);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [byDay, byEndpoint, byUser, totals] = await Promise.all([
            ActivityLog.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            ActivityLog.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$endpoint', count: { $sum: 1 }, avgResponseMs: { $avg: '$responseTimeMs' } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            ActivityLog.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: { userId: '$userId', username: '$username', email: '$email' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            ActivityLog.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: null, total: { $sum: 1 }, avgResponseMs: { $avg: '$responseTimeMs' } } }
            ])
        ]);

        res.json({
            since,
            totals: totals[0] || { total: 0, avgResponseMs: 0 },
            byDay,
            byEndpoint,
            byUser
        });
    } catch (error) {
        console.error('Error fetching activity summary:', error);
        res.status(500).json({ message: 'Failed to fetch activity summary' });
    }
};

module.exports = { getActivityLogs, getActivitySummary };


