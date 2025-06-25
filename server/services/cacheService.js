// server/deep_search/services/cacheService.js
// Universal caching service supporting in-memory, file-based, and Redis caching

const fs = require('fs').promises;
const path = require('path');
const NodeCache = require('node-cache');

class CacheService {
  constructor() {
    this.cacheType = process.env.CACHE_TYPE || 'memory'; // 'memory', 'file', 'redis'
    this.cacheDir = path.join(__dirname, '..', 'cache');
    
    // Initialize based on cache type
    this.initializeCache();
  }

  async initializeCache() {
    switch (this.cacheType) {
      case 'memory':
        this.memoryCache = new NodeCache({
          stdTTL: 3600, // 1 hour default TTL
          checkperiod: 600, // Check for expired keys every 10 minutes
          useClones: false
        });
        console.log('📦 Using in-memory cache');
        break;
        
      case 'file':
        try {
          await fs.mkdir(this.cacheDir, { recursive: true });
          console.log('📁 Using file-based cache');
        } catch (error) {
          console.error('Failed to create cache directory:', error);
          // Fallback to memory cache
          this.cacheType = 'memory';
          this.memoryCache = new NodeCache({ stdTTL: 3600 });
        }
        break;
        
      case 'redis':
        try {
          const redis = require('redis');
          this.redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
          });
          
          this.redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
            // Fallback to memory cache
            this.cacheType = 'memory';
            this.memoryCache = new NodeCache({ stdTTL: 3600 });
          });
          
          await this.redisClient.connect();
          console.log('🔴 Using Redis cache');
        } catch (error) {
          console.error('Failed to connect to Redis:', error);
          // Fallback to memory cache
          this.cacheType = 'memory';
          this.memoryCache = new NodeCache({ stdTTL: 3600 });
        }
        break;
        
      default:
        this.cacheType = 'memory';
        this.memoryCache = new NodeCache({ stdTTL: 3600 });
        console.log('📦 Using default in-memory cache');
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      switch (this.cacheType) {
        case 'memory':
          return this.memoryCache.get(key) || null;
          
        case 'file':
          return await this.getFromFile(key);
          
        case 'redis':
          if (!this.redisClient?.isOpen) return null;
          const value = await this.redisClient.get(key);
          return value ? JSON.parse(value) : null;
          
        default:
          return null;
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = 3600) {
    try {
      switch (this.cacheType) {
        case 'memory':
          return this.memoryCache.set(key, value, ttl);
          
        case 'file':
          return await this.setToFile(key, value, ttl);
          
        case 'redis':
          if (!this.redisClient?.isOpen) return false;
          await this.redisClient.setEx(key, ttl, JSON.stringify(value));
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key) {
    try {
      switch (this.cacheType) {
        case 'memory':
          return this.memoryCache.del(key);
          
        case 'file':
          return await this.deleteFromFile(key);
          
        case 'redis':
          if (!this.redisClient?.isOpen) return false;
          await this.redisClient.del(key);
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      switch (this.cacheType) {
        case 'memory':
          this.memoryCache.flushAll();
          return true;
          
        case 'file':
          const files = await fs.readdir(this.cacheDir);
          await Promise.all(
            files.map(file => fs.unlink(path.join(this.cacheDir, file)))
          );
          return true;
          
        case 'redis':
          if (!this.redisClient?.isOpen) return false;
          await this.redisClient.flushAll();
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Cache clear error:', error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      switch (this.cacheType) {
        case 'memory':
          const stats = this.memoryCache.getStats();
          return {
            type: 'memory',
            keys: stats.keys,
            hits: stats.hits,
            misses: stats.misses,
            hitRate: stats.hits / (stats.hits + stats.misses) || 0
          };
          
        case 'file':
          const files = await fs.readdir(this.cacheDir);
          return {
            type: 'file',
            keys: files.length,
            directory: this.cacheDir
          };
          
        case 'redis':
          if (!this.redisClient?.isOpen) {
            return { type: 'redis', status: 'disconnected' };
          }
          const info = await this.redisClient.info('stats');
          return {
            type: 'redis',
            status: 'connected',
            info: info
          };
          
        default:
          return { type: 'unknown' };
      }
    } catch (error) {
      console.error('Cache stats error:', error.message);
      return { type: this.cacheType, error: error.message };
    }
  }

  // File-based cache methods
  async getFromFile(key) {
    try {
      const filePath = path.join(this.cacheDir, `${this.sanitizeKey(key)}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check if expired
      if (parsed.expiry && Date.now() > parsed.expiry) {
        await fs.unlink(filePath).catch(() => {}); // Ignore errors
        return null;
      }
      
      return parsed.value;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`File cache read error for key ${key}:`, error.message);
      }
      return null;
    }
  }

  async setToFile(key, value, ttl) {
    try {
      const filePath = path.join(this.cacheDir, `${this.sanitizeKey(key)}.json`);
      const data = {
        value,
        expiry: ttl > 0 ? Date.now() + (ttl * 1000) : null,
        created: Date.now()
      };
      
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
      return true;
    } catch (error) {
      console.error(`File cache write error for key ${key}:`, error.message);
      return false;
    }
  }

  async deleteFromFile(key) {
    try {
      const filePath = path.join(this.cacheDir, `${this.sanitizeKey(key)}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`File cache delete error for key ${key}:`, error.message);
      }
      return false;
    }
  }

  /**
   * Sanitize cache key for file system
   */
  sanitizeKey(key) {
    return key.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  /**
   * Close cache connections
   */
  async close() {
    try {
      if (this.cacheType === 'redis' && this.redisClient?.isOpen) {
        await this.redisClient.quit();
      }
    } catch (error) {
      console.error('Error closing cache:', error.message);
    }
  }
}

module.exports = CacheService;
