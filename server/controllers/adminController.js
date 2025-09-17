// server/controllers/adminController.js
// Controller for admin dashboard and user management

const UserApiKeys = require('../models/UserApiKeys');
const User = require('../models/User');
const crypto = require('crypto');

// Enhanced admin authentication middleware with security logging
const requireAdmin = (req, res, next) => {
    const user = req?.user;
    
    if (!user) {
        console.warn(`🚨 Admin access attempt without authentication from IP: ${req.ip}`);
        return res.status(401).json({ 
            message: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    
    const isAdmin = (
        user.isAdmin === true  // Only check database field, no hardcoded emails
    );
    
    if (!isAdmin) {
        console.warn(`🚨 Unauthorized admin access attempt by user: ${user.username || user.id} from IP: ${req.ip}`);
        return res.status(403).json({ 
            message: 'Admin privileges required',
            code: 'ADMIN_REQUIRED'
        });
    }
    
    // Log successful admin access
    console.log(`✅ Admin access granted to: ${user.username || user.id} from IP: ${req.ip}`);
    next();
};

// Get admin dashboard overview
const getAdminDashboard = async (req, res) => {
    try {
        const stats = await UserApiKeys.getUserStats();
        const pendingRequests = await UserApiKeys.getPendingAdminRequests();
        const approvedUsers = await UserApiKeys.getApprovedUsers();
        
        // Get recent activity
        const recentActivity = await UserApiKeys.find({})
            .sort({ lastUsed: -1 })
            .limit(10)
            .select('email lastUsed totalRequests preferredService adminAccessStatus');
        
        const dashboardData = {
            stats: stats[0] || {
                totalUsers: 0,
                usersWithGeminiKeys: 0,
                usersWithOllama: 0,
                pendingAdminRequests: 0,
                approvedAdminUsers: 0,
                totalRequests: 0
            },
            pendingRequests: pendingRequests.map(req => ({
                id: req._id,
                email: req.email,
                requestedAt: req.adminAccessRequestedAt,
                reason: req.adminAccessReason,
                hasOwnKeys: !!(req.geminiApiKey || req.ollamaUrl)
            })),
            approvedUsers: approvedUsers.map(user => ({
                id: user._id,
                email: user.email,
                approvedAt: user.adminAccessApprovedAt,
                approvedBy: user.adminAccessApprovedBy,
                totalRequests: user.totalRequests,
                lastUsed: user.lastUsed
            })),
            recentActivity: recentActivity.map(activity => ({
                email: activity.email,
                lastUsed: activity.lastUsed,
                totalRequests: activity.totalRequests,
                service: activity.preferredService,
                status: activity.adminAccessStatus
            }))
        };
        
        res.json(dashboardData);
    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({ message: 'Failed to fetch admin dashboard data' });
    }
};

// Get all users with their API key status
const getAllUsers = async (req, res) => {
    try {
        const users = await UserApiKeys.find({})
            .sort({ createdAt: -1 })
            .select('email preferredService useAdminKeys adminAccessStatus adminAccessRequestedAt adminAccessApprovedAt totalRequests lastUsed geminiKeyValid ollamaConnectionValid');
        
        const userList = users.map(user => ({
            id: user._id,
            email: user.email,
            preferredService: user.preferredService,
            useAdminKeys: user.useAdminKeys,
            adminAccessStatus: user.adminAccessStatus,
            requestedAt: user.adminAccessRequestedAt,
            approvedAt: user.adminAccessApprovedAt,
            totalRequests: user.totalRequests,
            lastUsed: user.lastUsed,
            hasValidGemini: user.geminiKeyValid === true,
            hasValidOllama: user.ollamaConnectionValid === true,
            createdAt: user.createdAt
        }));
        
        res.json(userList);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ message: 'Failed to fetch users list' });
    }
};

// Approve user's admin access request
const approveAdminAccess = async (req, res) => {
    try {
        const { userId } = req.params;
        const { note } = req.body;
        
        const userApiKeys = await UserApiKeys.findById(userId);
        if (!userApiKeys) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        userApiKeys.adminAccessStatus = 'approved';
        userApiKeys.adminAccessApprovedAt = new Date();
        userApiKeys.adminAccessApprovedBy = req.user.email;
        
        if (note) {
            userApiKeys.adminAccessReason += ` | Admin note: ${note}`;
        }
        
        await userApiKeys.save();
        
        console.log(`✅ Admin access approved for user ${userApiKeys.email} by ${req.user.email}`);
        
        res.json({ 
            message: 'Admin access approved successfully',
            user: {
                email: userApiKeys.email,
                approvedAt: userApiKeys.adminAccessApprovedAt,
                approvedBy: userApiKeys.adminAccessApprovedBy
            }
        });
    } catch (error) {
        console.error('Error approving admin access:', error);
        res.status(500).json({ message: 'Failed to approve admin access' });
    }
};

// Deny user's admin access request
const denyAdminAccess = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        const userApiKeys = await UserApiKeys.findById(userId);
        if (!userApiKeys) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        userApiKeys.adminAccessStatus = 'denied';
        userApiKeys.adminAccessApprovedBy = req.user.email;
        
        if (reason) {
            userApiKeys.adminAccessReason += ` | Denied: ${reason}`;
        }
        
        await userApiKeys.save();
        
        console.log(`❌ Admin access denied for user ${userApiKeys.email} by ${req.user.email}: ${reason}`);
        
        res.json({ 
            message: 'Admin access denied',
            user: {
                email: userApiKeys.email,
                deniedBy: userApiKeys.adminAccessApprovedBy,
                reason: reason
            }
        });
    } catch (error) {
        console.error('Error denying admin access:', error);
        res.status(500).json({ message: 'Failed to deny admin access' });
    }
};

// Revoke user's admin access
const revokeAdminAccess = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        const userApiKeys = await UserApiKeys.findById(userId);
        if (!userApiKeys) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        userApiKeys.adminAccessStatus = 'revoked';
        userApiKeys.adminAccessApprovedBy = req.user.email;
        
        if (reason) {
            userApiKeys.adminAccessReason += ` | Revoked: ${reason}`;
        }
        
        await userApiKeys.save();
        
        console.log(`🚫 Admin access revoked for user ${userApiKeys.email} by ${req.user.email}: ${reason}`);
        
        res.json({ 
            message: 'Admin access revoked',
            user: {
                email: userApiKeys.email,
                revokedBy: userApiKeys.adminAccessApprovedBy,
                reason: reason
            }
        });
    } catch (error) {
        console.error('Error revoking admin access:', error);
        res.status(500).json({ message: 'Failed to revoke admin access' });
    }
};

// Promote user to full admin status
const promoteUserToAdmin = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        // Find user in User collection (not just UserApiKeys)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.isAdmin) {
            return res.status(400).json({ message: 'User is already an admin' });
        }
        
        // Promote user to admin
        user.isAdmin = true;
        user.adminApprovalStatus = 'approved';
        user.adminApprovedBy = req.user.id || req.user._id;
        user.adminApprovedAt = new Date();
        
        await user.save();
        
        // Also update their API keys status
        let userApiKeys = await UserApiKeys.findOne({ userId: user._id });
        if (userApiKeys) {
            userApiKeys.adminAccessStatus = 'approved';
            userApiKeys.adminAccessApprovedAt = new Date();
            userApiKeys.adminAccessApprovedBy = req.user.email;
            if (reason) {
                userApiKeys.adminAccessReason = reason;
            }
            await userApiKeys.save();
        }
        
        console.log(`🎉 User ${user.email || user.username} promoted to admin by ${req.user.email || req.user.username}`);
        
        res.json({ 
            message: 'User promoted to admin successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                promotedAt: user.adminApprovedAt,
                promotedBy: req.user.email || req.user.username,
                reason: reason
            }
        });
    } catch (error) {
        console.error('Error promoting user to admin:', error);
        res.status(500).json({ message: 'Failed to promote user to admin' });
    }
};

// Demote admin user to regular user
const demoteAdminUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (!user.isAdmin) {
            return res.status(400).json({ message: 'User is not an admin' });
        }
        
        // Prevent self-demotion
        if (user._id.toString() === (req.user.id || req.user._id).toString()) {
            return res.status(400).json({ message: 'Cannot demote yourself' });
        }
        
        // Demote user
        user.isAdmin = false;
        user.adminApprovalStatus = 'denied';
        
        await user.save();
        
        // Update API keys status
        let userApiKeys = await UserApiKeys.findOne({ userId: user._id });
        if (userApiKeys) {
            userApiKeys.adminAccessStatus = 'revoked';
            userApiKeys.adminAccessApprovedBy = req.user.email;
            if (reason) {
                userApiKeys.adminAccessReason += ` | Demoted: ${reason}`;
            }
            await userApiKeys.save();
        }
        
        console.log(`⬇️ Admin ${user.email || user.username} demoted by ${req.user.email || req.user.username}: ${reason}`);
        
        res.json({ 
            message: 'Admin user demoted successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                demotedBy: req.user.email || req.user.username,
                reason: reason
            }
        });
    } catch (error) {
        console.error('Error demoting admin user:', error);
        res.status(500).json({ message: 'Failed to demote admin user' });
    }
};

// Get user details for admin
const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const userApiKeys = await UserApiKeys.findById(userId).select('+geminiApiKey');
        if (!userApiKeys) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userDetails = {
            id: userApiKeys._id,
            email: userApiKeys.email,
            preferredService: userApiKeys.preferredService,
            
            // API Key status (not the actual keys for security)
            hasGeminiKey: !!userApiKeys.geminiApiKey,
            geminiKeyValid: userApiKeys.geminiKeyValid,
            geminiKeyPreview: userApiKeys.geminiApiKey ? 
                `${userApiKeys.geminiApiKey.substring(0, 8)}...${userApiKeys.geminiApiKey.slice(-4)}` : null,
            
            // Ollama config
            ollamaUrl: userApiKeys.ollamaUrl,
            ollamaModel: userApiKeys.ollamaModel,
            ollamaConnectionValid: userApiKeys.ollamaConnectionValid,
            
            // Admin access
            useAdminKeys: userApiKeys.useAdminKeys,
            adminAccessStatus: userApiKeys.adminAccessStatus,
            adminAccessRequestedAt: userApiKeys.adminAccessRequestedAt,
            adminAccessApprovedAt: userApiKeys.adminAccessApprovedAt,
            adminAccessApprovedBy: userApiKeys.adminAccessApprovedBy,
            adminAccessReason: userApiKeys.adminAccessReason,
            
            // Usage stats
            totalRequests: userApiKeys.totalRequests,
            lastUsed: userApiKeys.lastUsed,
            lastValidationAt: userApiKeys.lastValidationAt,
            
            // Metadata
            createdAt: userApiKeys.createdAt,
            updatedAt: userApiKeys.updatedAt
        };
        
        res.json(userDetails);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Failed to fetch user details' });
    }
};

// Update user configuration (admin only)
const updateUserConfig = async (req, res) => {
    try {
        const { userId } = req.params;
        const { preferredService, adminAccessStatus, note } = req.body;
        
        const userApiKeys = await UserApiKeys.findById(userId);
        if (!userApiKeys) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (preferredService !== undefined) {
            userApiKeys.preferredService = preferredService;
        }
        
        if (adminAccessStatus !== undefined) {
            userApiKeys.adminAccessStatus = adminAccessStatus;
            userApiKeys.adminAccessApprovedBy = req.user.email;
            
            if (adminAccessStatus === 'approved') {
                userApiKeys.adminAccessApprovedAt = new Date();
            }
        }
        
        if (note) {
            userApiKeys.adminAccessReason += ` | Admin update: ${note}`;
        }
        
        await userApiKeys.save();
        
        console.log(`🔧 User config updated for ${userApiKeys.email} by admin ${req.user.email}`);
        
        res.json({ 
            message: 'User configuration updated successfully',
            user: {
                email: userApiKeys.email,
                preferredService: userApiKeys.preferredService,
                adminAccessStatus: userApiKeys.adminAccessStatus
            }
        });
    } catch (error) {
        console.error('Error updating user config:', error);
        res.status(500).json({ message: 'Failed to update user configuration' });
    }
};

// Get system statistics
const getSystemStats = async (req, res) => {
    try {
        const stats = await UserApiKeys.getUserStats();
        
        // Get usage over time (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const usageOverTime = await UserApiKeys.aggregate([
            {
                $match: {
                    lastUsed: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$lastUsed"
                        }
                    },
                    activeUsers: { $sum: 1 },
                    totalRequests: { $sum: "$totalRequests" }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);
        
        res.json({
            overview: stats[0] || {},
            usageOverTime: usageOverTime,
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({ message: 'Failed to fetch system statistics' });
    }
};

// Delete a user entirely (admin only)
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByIdAndDelete(userId);
        const ua = await UserApiKeys.findOneAndDelete({ userId });
        if (!user && !ua) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user' });
    }
};

module.exports = {
    requireAdmin,
    getAdminDashboard,
    getAllUsers,
    approveAdminAccess,
    denyAdminAccess,
    revokeAdminAccess,
    promoteUserToAdmin,
    demoteAdminUser,
    getUserDetails,
    updateUserConfig,
    getSystemStats,
    deleteUser
};
