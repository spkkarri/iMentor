"""
Advanced model caching system for faster loading and memory optimization.
"""

import os
import json
import pickle
import hashlib
import time
import logging
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
from dataclasses import dataclass, asdict
import threading
import sqlite3

logger = logging.getLogger(__name__)

@dataclass
class CacheEntry:
    """Represents a cached model entry."""
    model_id: str
    cache_key: str
    file_path: str
    size_mb: float
    created_time: float
    last_accessed: float
    access_count: int
    model_hash: str
    metadata: Dict[str, Any]

class ModelCache:
    """
    Advanced caching system for models with LRU eviction and persistence.
    """
    
    def __init__(
        self,
        cache_dir: str = "model_cache",
        max_cache_size_gb: float = 10.0,
        max_entries: int = 50,
        enable_compression: bool = True,
        db_path: Optional[str] = None
    ):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.max_cache_size_bytes = max_cache_size_gb * 1024**3
        self.max_entries = max_entries
        self.enable_compression = enable_compression
        
        # Database for metadata
        self.db_path = db_path or str(self.cache_dir / "cache.db")
        self.lock = threading.RLock()
        
        # In-memory cache index
        self.cache_index: Dict[str, CacheEntry] = {}
        
        # Initialize database and load existing cache
        self._init_database()
        self._load_cache_index()
        
        logger.info(f"ModelCache initialized: {cache_dir}, max_size: {max_cache_size_gb}GB")
    
    def _init_database(self):
        """Initialize SQLite database for cache metadata."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_entries (
                    model_id TEXT PRIMARY KEY,
                    cache_key TEXT UNIQUE,
                    file_path TEXT,
                    size_mb REAL,
                    created_time REAL,
                    last_accessed REAL,
                    access_count INTEGER,
                    model_hash TEXT,
                    metadata TEXT
                )
            """)
            conn.commit()
    
    def _load_cache_index(self):
        """Load cache index from database."""
        with self.lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute("SELECT * FROM cache_entries")
                    
                    for row in cursor.fetchall():
                        model_id, cache_key, file_path, size_mb, created_time, last_accessed, access_count, model_hash, metadata_json = row
                        
                        # Check if cached file still exists
                        if os.path.exists(file_path):
                            metadata = json.loads(metadata_json) if metadata_json else {}
                            
                            entry = CacheEntry(
                                model_id=model_id,
                                cache_key=cache_key,
                                file_path=file_path,
                                size_mb=size_mb,
                                created_time=created_time,
                                last_accessed=last_accessed,
                                access_count=access_count,
                                model_hash=model_hash,
                                metadata=metadata
                            )
                            
                            self.cache_index[model_id] = entry
                        else:
                            # Remove stale entry
                            conn.execute("DELETE FROM cache_entries WHERE model_id = ?", (model_id,))
                
                logger.info(f"Loaded {len(self.cache_index)} cache entries")
                
            except Exception as e:
                logger.error(f"Failed to load cache index: {e}")
                self.cache_index = {}
    
    def _generate_cache_key(self, model_id: str, model_path: str, metadata: Dict[str, Any]) -> str:
        """Generate a unique cache key for a model."""
        # Include model path, modification time, and metadata in hash
        try:
            mtime = os.path.getmtime(model_path)
            key_data = f"{model_id}:{model_path}:{mtime}:{json.dumps(metadata, sort_keys=True)}"
            return hashlib.sha256(key_data.encode()).hexdigest()[:16]
        except Exception:
            # Fallback to simple hash
            return hashlib.sha256(f"{model_id}:{model_path}".encode()).hexdigest()[:16]
    
    def _calculate_model_hash(self, model_path: str) -> str:
        """Calculate hash of model files for integrity checking."""
        try:
            hasher = hashlib.sha256()
            
            # Hash main model files
            model_files = []
            if os.path.isdir(model_path):
                for file_name in ["pytorch_model.bin", "model.safetensors", "config.json"]:
                    file_path = os.path.join(model_path, file_name)
                    if os.path.exists(file_path):
                        model_files.append(file_path)
            else:
                model_files = [model_path]
            
            for file_path in model_files:
                with open(file_path, 'rb') as f:
                    # Read in chunks to handle large files
                    for chunk in iter(lambda: f.read(8192), b""):
                        hasher.update(chunk)
            
            return hasher.hexdigest()[:16]
            
        except Exception as e:
            logger.warning(f"Failed to calculate model hash: {e}")
            return "unknown"
    
    def cache_model(
        self,
        model_id: str,
        model_data: Any,
        model_path: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Cache a model to disk."""
        with self.lock:
            try:
                metadata = metadata or {}
                cache_key = self._generate_cache_key(model_id, model_path, metadata)
                
                # Check if already cached with same key
                if model_id in self.cache_index:
                    existing_entry = self.cache_index[model_id]
                    if existing_entry.cache_key == cache_key:
                        # Update access time
                        existing_entry.last_accessed = time.time()
                        existing_entry.access_count += 1
                        self._update_database_entry(existing_entry)
                        return True
                
                # Prepare cache file path
                cache_file = self.cache_dir / f"{model_id}_{cache_key}.cache"
                
                # Serialize model data
                start_time = time.time()
                
                if self.enable_compression:
                    import gzip
                    with gzip.open(cache_file, 'wb') as f:
                        pickle.dump(model_data, f, protocol=pickle.HIGHEST_PROTOCOL)
                else:
                    with open(cache_file, 'wb') as f:
                        pickle.dump(model_data, f, protocol=pickle.HIGHEST_PROTOCOL)
                
                cache_time = time.time() - start_time
                file_size_mb = os.path.getsize(cache_file) / (1024 * 1024)
                
                # Calculate model hash
                model_hash = self._calculate_model_hash(model_path)
                
                # Create cache entry
                entry = CacheEntry(
                    model_id=model_id,
                    cache_key=cache_key,
                    file_path=str(cache_file),
                    size_mb=file_size_mb,
                    created_time=time.time(),
                    last_accessed=time.time(),
                    access_count=1,
                    model_hash=model_hash,
                    metadata=metadata
                )
                
                # Check cache size limits
                if not self._ensure_cache_space(file_size_mb):
                    os.remove(cache_file)
                    logger.warning(f"Cannot cache {model_id}: insufficient space")
                    return False
                
                # Update index and database
                self.cache_index[model_id] = entry
                self._save_database_entry(entry)
                
                logger.info(f"Cached model {model_id}: {file_size_mb:.1f}MB in {cache_time:.2f}s")
                return True
                
            except Exception as e:
                logger.error(f"Failed to cache model {model_id}: {e}")
                return False
    
    def load_cached_model(self, model_id: str, model_path: str, metadata: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        """Load a model from cache."""
        with self.lock:
            if model_id not in self.cache_index:
                return None
            
            entry = self.cache_index[model_id]
            
            # Verify cache key matches current model
            metadata = metadata or {}
            expected_key = self._generate_cache_key(model_id, model_path, metadata)
            
            if entry.cache_key != expected_key:
                logger.debug(f"Cache key mismatch for {model_id}, invalidating cache")
                self.invalidate_cache(model_id)
                return None
            
            # Verify file exists
            if not os.path.exists(entry.file_path):
                logger.warning(f"Cache file missing for {model_id}")
                self.invalidate_cache(model_id)
                return None
            
            try:
                # Load model data
                start_time = time.time()
                
                if self.enable_compression:
                    import gzip
                    with gzip.open(entry.file_path, 'rb') as f:
                        model_data = pickle.load(f)
                else:
                    with open(entry.file_path, 'rb') as f:
                        model_data = pickle.load(f)
                
                load_time = time.time() - start_time
                
                # Update access statistics
                entry.last_accessed = time.time()
                entry.access_count += 1
                self._update_database_entry(entry)
                
                logger.info(f"Loaded cached model {model_id} in {load_time:.2f}s")
                return model_data
                
            except Exception as e:
                logger.error(f"Failed to load cached model {model_id}: {e}")
                self.invalidate_cache(model_id)
                return None
    
    def invalidate_cache(self, model_id: str) -> bool:
        """Remove a model from cache."""
        with self.lock:
            if model_id not in self.cache_index:
                return False
            
            entry = self.cache_index[model_id]
            
            try:
                # Remove file
                if os.path.exists(entry.file_path):
                    os.remove(entry.file_path)
                
                # Remove from index and database
                del self.cache_index[model_id]
                
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("DELETE FROM cache_entries WHERE model_id = ?", (model_id,))
                    conn.commit()
                
                logger.info(f"Invalidated cache for {model_id}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to invalidate cache for {model_id}: {e}")
                return False
    
    def _ensure_cache_space(self, required_mb: float) -> bool:
        """Ensure there's enough space in cache for a new entry."""
        current_size = self.get_cache_size()
        required_bytes = required_mb * 1024 * 1024
        
        # Check if we need to free space
        if current_size + required_bytes > self.max_cache_size_bytes or len(self.cache_index) >= self.max_entries:
            return self._evict_cache_entries(required_bytes)
        
        return True
    
    def _evict_cache_entries(self, required_bytes: float) -> bool:
        """Evict cache entries using LRU policy."""
        # Sort entries by last accessed time (LRU first)
        sorted_entries = sorted(
            self.cache_index.values(),
            key=lambda x: x.last_accessed
        )
        
        freed_bytes = 0
        evicted_count = 0
        
        for entry in sorted_entries:
            if freed_bytes >= required_bytes and len(self.cache_index) - evicted_count < self.max_entries:
                break
            
            # Evict this entry
            if self.invalidate_cache(entry.model_id):
                freed_bytes += entry.size_mb * 1024 * 1024
                evicted_count += 1
        
        logger.info(f"Evicted {evicted_count} cache entries, freed {freed_bytes / (1024*1024):.1f}MB")
        return freed_bytes >= required_bytes
    
    def get_cache_size(self) -> float:
        """Get total cache size in bytes."""
        return sum(entry.size_mb * 1024 * 1024 for entry in self.cache_index.values())
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        with self.lock:
            total_size_mb = sum(entry.size_mb for entry in self.cache_index.values())
            total_accesses = sum(entry.access_count for entry in self.cache_index.values())
            
            if self.cache_index:
                avg_size_mb = total_size_mb / len(self.cache_index)
                avg_accesses = total_accesses / len(self.cache_index)
                oldest_entry = min(self.cache_index.values(), key=lambda x: x.created_time)
                newest_entry = max(self.cache_index.values(), key=lambda x: x.created_time)
            else:
                avg_size_mb = avg_accesses = 0
                oldest_entry = newest_entry = None
            
            return {
                "total_entries": len(self.cache_index),
                "total_size_mb": total_size_mb,
                "total_size_gb": total_size_mb / 1024,
                "max_size_gb": self.max_cache_size_bytes / (1024**3),
                "utilization_percent": (total_size_mb * 1024 * 1024 / self.max_cache_size_bytes) * 100,
                "average_entry_size_mb": avg_size_mb,
                "total_accesses": total_accesses,
                "average_accesses_per_entry": avg_accesses,
                "oldest_entry_age_hours": (time.time() - oldest_entry.created_time) / 3600 if oldest_entry else 0,
                "newest_entry_age_hours": (time.time() - newest_entry.created_time) / 3600 if newest_entry else 0
            }
    
    def _save_database_entry(self, entry: CacheEntry):
        """Save cache entry to database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO cache_entries 
                    (model_id, cache_key, file_path, size_mb, created_time, last_accessed, access_count, model_hash, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    entry.model_id,
                    entry.cache_key,
                    entry.file_path,
                    entry.size_mb,
                    entry.created_time,
                    entry.last_accessed,
                    entry.access_count,
                    entry.model_hash,
                    json.dumps(entry.metadata)
                ))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to save database entry: {e}")
    
    def _update_database_entry(self, entry: CacheEntry):
        """Update cache entry in database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE cache_entries 
                    SET last_accessed = ?, access_count = ?
                    WHERE model_id = ?
                """, (entry.last_accessed, entry.access_count, entry.model_id))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to update database entry: {e}")
    
    def cleanup_stale_entries(self, max_age_hours: float = 168):  # 1 week default
        """Remove cache entries older than specified age."""
        cutoff_time = time.time() - (max_age_hours * 3600)
        stale_entries = [
            entry.model_id for entry in self.cache_index.values()
            if entry.last_accessed < cutoff_time
        ]
        
        for model_id in stale_entries:
            self.invalidate_cache(model_id)
        
        logger.info(f"Cleaned up {len(stale_entries)} stale cache entries")
    
    def clear_cache(self):
        """Clear all cache entries."""
        with self.lock:
            for model_id in list(self.cache_index.keys()):
                self.invalidate_cache(model_id)
            
            logger.info("Cleared all cache entries")
