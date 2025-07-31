/**
 * Monitoring and Metrics API Routes
 * Provides endpoints for accessing system metrics and performance data
 */

const express = require('express');
const router = express.Router();
const { getQuotaManager } = require('../services/quotaManager');
const { auth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for monitoring endpoints
const monitoringLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    error: 'Too many monitoring requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
router.use(monitoringLimiter);

// Global metrics collector instance (will be set by the service manager)
let metricsCollector = null;

// Middleware to check if metrics collector is available
const requireMetrics = (req, res, next) => {
  if (!metricsCollector) {
    return res.status(503).json({
      success: false,
      error: 'Metrics collection not available'
    });
  }
  next();
};

/**
 * GET /api/monitoring/health
 * Basic health check endpoint
 */
router.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    platform: process.platform
  };

  res.json({
    success: true,
    data: healthData
  });
});

/**
 * GET /api/monitoring/metrics
 * Get comprehensive system metrics
 */
router.get('/metrics', auth, requireMetrics, (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

/**
 * GET /api/monitoring/summary
 * Get performance summary
 */
router.get('/summary', auth, requireMetrics, (req, res) => {
  try {
    const summary = metricsCollector.getPerformanceSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting performance summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance summary'
    });
  }
});

/**
 * GET /api/monitoring/realtime
 * Get real-time metrics
 */
router.get('/realtime', auth, requireMetrics, (req, res) => {
  try {
    const realtimeMetrics = metricsCollector.realtimeMetrics;
    
    res.json({
      success: true,
      data: {
        ...realtimeMetrics,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error getting real-time metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve real-time metrics'
    });
  }
});

/**
 * GET /api/monitoring/models
 * Get model-specific metrics
 */
router.get('/models', auth, requireMetrics, (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const modelMetrics = Array.from(metrics.models.entries()).map(([id, data]) => ({
      id,
      ...data,
      successRate: data.totalUsage > 0 ? (data.successfulUsage / data.totalUsage) * 100 : 0,
      lastUsedAgo: Date.now() - data.lastUsed
    }));

    res.json({
      success: true,
      data: modelMetrics
    });
  } catch (error) {
    console.error('Error getting model metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve model metrics'
    });
  }
});

/**
 * GET /api/monitoring/routing
 * Get routing performance metrics
 */
router.get('/routing', auth, requireMetrics, (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const routingData = {
      ...metrics.routing,
      subjectDistribution: Array.from(metrics.routing.subjectDistribution.entries()).map(([subject, count]) => ({
        subject,
        count,
        percentage: (count / metrics.routing.totalRoutes) * 100
      })),
      successRate: metrics.routing.totalRoutes > 0 ? 
        (metrics.routing.successfulRoutes / metrics.routing.totalRoutes) * 100 : 0,
      fallbackRate: metrics.routing.totalRoutes > 0 ? 
        (metrics.routing.fallbackRoutes / metrics.routing.totalRoutes) * 100 : 0
    };

    res.json({
      success: true,
      data: routingData
    });
  } catch (error) {
    console.error('Error getting routing metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve routing metrics'
    });
  }
});

/**
 * GET /api/monitoring/classification
 * Get classification accuracy metrics
 */
router.get('/classification', auth, requireMetrics, (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const classificationData = {
      ...metrics.classification,
      overallAccuracy: metrics.classification.totalClassifications > 0 ? 
        (metrics.classification.accurateClassifications / metrics.classification.totalClassifications) * 100 : 0,
      subjectAccuracy: Array.from(metrics.classification.subjectAccuracy.entries()).map(([subject, data]) => ({
        subject,
        ...data,
        accuracy: data.accuracy * 100
      }))
    };

    res.json({
      success: true,
      data: classificationData
    });
  } catch (error) {
    console.error('Error getting classification metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve classification metrics'
    });
  }
});

/**
 * GET /api/monitoring/performance/history
 * Get historical performance data
 */
router.get('/performance/history', auth, requireMetrics, (req, res) => {
  try {
    const { timeframe = '1h', metric = 'responseTime' } = req.query;
    const metrics = metricsCollector.getMetrics();
    
    // Calculate time range
    const now = Date.now();
    const timeframes = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    
    const timeRange = timeframes[timeframe] || timeframes['1h'];
    const cutoffTime = now - timeRange;
    
    let historyData = [];
    
    switch (metric) {
      case 'responseTime':
        historyData = metrics.performance.responseTimeHistory
          .filter(entry => entry.timestamp > cutoffTime)
          .map(entry => ({
            timestamp: entry.timestamp,
            value: entry.responseTime,
            success: entry.success
          }));
        break;
        
      case 'memory':
        historyData = metrics.performance.memoryUsageHistory
          .filter(entry => entry.timestamp > cutoffTime)
          .map(entry => ({
            timestamp: entry.timestamp,
            value: entry.heapUsed / 1024 / 1024, // Convert to MB
            total: entry.heapTotal / 1024 / 1024
          }));
        break;
        
      case 'cpu':
        historyData = metrics.performance.cpuUsageHistory
          .filter(entry => entry.timestamp > cutoffTime)
          .map(entry => ({
            timestamp: entry.timestamp,
            user: entry.user,
            system: entry.system
          }));
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid metric type. Use: responseTime, memory, or cpu'
        });
    }

    res.json({
      success: true,
      data: {
        metric,
        timeframe,
        history: historyData,
        count: historyData.length
      }
    });
  } catch (error) {
    console.error('Error getting performance history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance history'
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get system alerts and warnings
 */
router.get('/alerts', auth, requireMetrics, (req, res) => {
  try {
    const summary = metricsCollector.getPerformanceSummary();
    const alerts = [];

    // Check for various alert conditions
    
    // High error rate
    if (summary.requests.successRate < 95 && summary.requests.total > 10) {
      alerts.push({
        level: 'warning',
        type: 'high_error_rate',
        message: `Error rate is ${(100 - summary.requests.successRate).toFixed(1)}%`,
        value: 100 - summary.requests.successRate,
        threshold: 5
      });
    }

    // High memory usage
    if (summary.system.memoryUsage > 1000) { // 1GB
      alerts.push({
        level: summary.system.memoryUsage > 2000 ? 'critical' : 'warning',
        type: 'high_memory_usage',
        message: `Memory usage is ${summary.system.memoryUsage.toFixed(0)}MB`,
        value: summary.system.memoryUsage,
        threshold: 1000
      });
    }

    // Slow response times
    if (summary.requests.averageResponseTime > 5000) { // 5 seconds
      alerts.push({
        level: summary.requests.averageResponseTime > 10000 ? 'critical' : 'warning',
        type: 'slow_response_time',
        message: `Average response time is ${(summary.requests.averageResponseTime / 1000).toFixed(1)}s`,
        value: summary.requests.averageResponseTime,
        threshold: 5000
      });
    }

    // High fallback rate
    if (summary.routing.fallback > summary.routing.total * 0.3 && summary.routing.total > 10) {
      alerts.push({
        level: 'warning',
        type: 'high_fallback_rate',
        message: `${((summary.routing.fallback / summary.routing.total) * 100).toFixed(1)}% of requests using fallback`,
        value: (summary.routing.fallback / summary.routing.total) * 100,
        threshold: 30
      });
    }

    // Low classification accuracy
    if (summary.classification.accuracy < 80 && summary.classification.total > 10) {
      alerts.push({
        level: 'warning',
        type: 'low_classification_accuracy',
        message: `Classification accuracy is ${summary.classification.accuracy.toFixed(1)}%`,
        value: summary.classification.accuracy,
        threshold: 80
      });
    }

    res.json({
      success: true,
      data: {
        alerts,
        alertCount: alerts.length,
        criticalCount: alerts.filter(a => a.level === 'critical').length,
        warningCount: alerts.filter(a => a.level === 'warning').length,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    });
  }
});

/**
 * POST /api/monitoring/reset
 * Reset metrics (admin only)
 */
router.post('/reset', auth, requireMetrics, (req, res) => {
  try {
    // Check if user has admin privileges (you may want to implement proper role checking)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
    }

    metricsCollector.reset();
    
    res.json({
      success: true,
      message: 'Metrics reset successfully'
    });
  } catch (error) {
    console.error('Error resetting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics'
    });
  }
});

/**
 * GET /api/monitoring/export
 * Export metrics data
 */
router.get('/export', auth, requireMetrics, (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const metrics = metricsCollector.getMetrics();
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="metrics-${Date.now()}.json"`);
      res.json(metrics);
    } else if (format === 'csv') {
      // Simple CSV export for summary data
      const summary = metricsCollector.getPerformanceSummary();
      const csv = [
        'Metric,Value',
        `Total Requests,${summary.requests.total}`,
        `Successful Requests,${summary.requests.successful}`,
        `Failed Requests,${summary.requests.failed}`,
        `Success Rate,${summary.requests.successRate.toFixed(2)}%`,
        `Average Response Time,${summary.requests.averageResponseTime.toFixed(2)}ms`,
        `Memory Usage,${summary.system.memoryUsage.toFixed(2)}MB`,
        `CPU Usage,${summary.system.cpuUsage.toFixed(2)}`,
        `Uptime,${summary.uptime.formatted}`
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="metrics-summary-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Use: json or csv'
      });
    }
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics'
    });
  }
});

/**
 * GET /api/monitoring/quota
 * Get Gemini API quota status
 */
router.get('/quota', (req, res) => {
  try {
    const quotaManager = getQuotaManager();
    const quotaStatus = quotaManager.getQuotaStatus();

    res.json({
      success: true,
      data: {
        ...quotaStatus,
        recommendations: getQuotaRecommendations(quotaStatus)
      }
    });
  } catch (error) {
    console.error('Error getting quota status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quota status'
    });
  }
});

/**
 * POST /api/monitoring/quota/reset
 * Reset quota tracking (admin only)
 */
router.post('/quota/reset', auth, (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
    }

    const quotaManager = getQuotaManager();
    quotaManager.requestCount = 0;
    quotaManager.metrics.totalRequests = 0;
    quotaManager.metrics.successfulRequests = 0;
    quotaManager.metrics.failedRequests = 0;
    quotaManager.saveQuotaData();

    res.json({
      success: true,
      message: 'Quota tracking reset successfully'
    });
  } catch (error) {
    console.error('Error resetting quota:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset quota tracking'
    });
  }
});

/**
 * Helper function to provide quota recommendations
 */
function getQuotaRecommendations(quotaStatus) {
  const recommendations = [];

  if (quotaStatus.status === 'critical') {
    recommendations.push({
      type: 'urgent',
      message: 'Quota critically low. Consider upgrading to paid tier or reducing request frequency.',
      action: 'upgrade_plan'
    });
  } else if (quotaStatus.status === 'warning') {
    recommendations.push({
      type: 'warning',
      message: 'Quota usage is high. Monitor usage and consider optimizing requests.',
      action: 'optimize_usage'
    });
  }

  if (quotaStatus.metrics.failedRequests > quotaStatus.metrics.successfulRequests * 0.1) {
    recommendations.push({
      type: 'optimization',
      message: 'High failure rate detected. Check request patterns and implement better error handling.',
      action: 'improve_error_handling'
    });
  }

  if (quotaStatus.usagePercent > 50) {
    const hoursLeft = quotaStatus.hoursUntilReset;
    const currentRate = quotaStatus.used / (24 - hoursLeft);
    const projectedUsage = currentRate * 24;

    if (projectedUsage > quotaStatus.limit) {
      recommendations.push({
        type: 'projection',
        message: `At current rate, you'll exceed quota. Projected usage: ${Math.round(projectedUsage)} requests.`,
        action: 'reduce_usage'
      });
    }
  }

  return recommendations;
}

// Set metrics collector instance
router.setMetricsCollector = (collector) => {
  metricsCollector = collector;
};

module.exports = router;
