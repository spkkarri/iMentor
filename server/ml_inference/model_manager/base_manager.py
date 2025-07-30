"""
Base model management system for dynamic loading and unloading of specialized models.
"""

import os
import time
import threading
import logging
from typing import Dict, List, Optional, Any, Tuple
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
import psutil
import torch
from pathlib import Path

logger = logging.getLogger(__name__)

class ModelState(Enum):
    """States of a model in the management system."""
    UNLOADED = "unloaded"
    LOADING = "loading"
    LOADED = "loaded"
    UNLOADING = "unloading"
    ERROR = "error"

@dataclass
class ModelInfo:
    """Information about a managed model."""
    model_id: str
    subject: str
    model_path: str
    model_type: str
    state: ModelState
    load_time: float
    last_used: float
    usage_count: int
    memory_usage: float  # MB
    priority: int
    max_idle_time: float  # seconds
    error_message: Optional[str] = None

@dataclass
class ModelConfig:
    """Configuration for model management."""
    max_models_in_memory: int = 3
    max_memory_usage_mb: float = 8192  # 8GB
    model_idle_timeout: float = 1800  # 30 minutes
    preload_models: List[str] = None
    memory_check_interval: float = 60  # seconds
    enable_model_caching: bool = True
    cache_directory: str = "model_cache"

class BaseModelManager(ABC):
    """
    Abstract base class for model management systems.
    """
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.models: Dict[str, ModelInfo] = {}
        self.loaded_models: Dict[str, Any] = {}  # model_id -> actual model object
        self.lock = threading.RLock()
        
        # Memory monitoring
        self.memory_monitor_thread = None
        self.stop_monitoring = threading.Event()
        
        # Statistics
        self.stats = {
            "total_loads": 0,
            "total_unloads": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "memory_evictions": 0,
            "load_errors": 0
        }
        
        # Initialize cache directory
        if self.config.enable_model_caching:
            os.makedirs(self.config.cache_directory, exist_ok=True)
        
        logger.info(f"ModelManager initialized with config: {config}")
    
    @abstractmethod
    def _load_model(self, model_info: ModelInfo) -> Any:
        """Load a model from disk. To be implemented by subclasses."""
        pass
    
    @abstractmethod
    def _unload_model(self, model_id: str, model: Any) -> bool:
        """Unload a model from memory. To be implemented by subclasses."""
        pass
    
    @abstractmethod
    def _get_model_memory_usage(self, model: Any) -> float:
        """Get memory usage of a model in MB."""
        pass
    
    def register_model(
        self,
        model_id: str,
        subject: str,
        model_path: str,
        model_type: str = "pytorch",
        priority: int = 1,
        max_idle_time: Optional[float] = None
    ) -> bool:
        """Register a model for management."""
        with self.lock:
            if model_id in self.models:
                logger.warning(f"Model {model_id} already registered")
                return False
            
            if not os.path.exists(model_path):
                logger.error(f"Model path does not exist: {model_path}")
                return False
            
            model_info = ModelInfo(
                model_id=model_id,
                subject=subject,
                model_path=model_path,
                model_type=model_type,
                state=ModelState.UNLOADED,
                load_time=0.0,
                last_used=0.0,
                usage_count=0,
                memory_usage=0.0,
                priority=priority,
                max_idle_time=max_idle_time or self.config.model_idle_timeout
            )
            
            self.models[model_id] = model_info
            logger.info(f"Registered model: {model_id} ({subject})")
            
            return True
    
    def load_model(self, model_id: str, force: bool = False) -> Tuple[bool, Optional[Any]]:
        """Load a model into memory."""
        with self.lock:
            if model_id not in self.models:
                logger.error(f"Model {model_id} not registered")
                return False, None
            
            model_info = self.models[model_id]
            
            # Check if already loaded
            if model_info.state == ModelState.LOADED and not force:
                model = self.loaded_models.get(model_id)
                if model is not None:
                    model_info.last_used = time.time()
                    model_info.usage_count += 1
                    self.stats["cache_hits"] += 1
                    logger.debug(f"Model {model_id} already loaded (cache hit)")
                    return True, model
            
            # Check if currently loading
            if model_info.state == ModelState.LOADING:
                logger.info(f"Model {model_id} is currently loading")
                return False, None
            
            # Check memory constraints
            if not self._can_load_model():
                if not self._make_memory_available():
                    logger.warning(f"Cannot load {model_id}: insufficient memory")
                    return False, None
            
            # Start loading
            model_info.state = ModelState.LOADING
            start_time = time.time()
            
            try:
                logger.info(f"Loading model: {model_id}")
                model = self._load_model(model_info)
                
                if model is None:
                    raise Exception("Model loading returned None")
                
                # Update model info
                load_time = time.time() - start_time
                model_info.load_time = load_time
                model_info.last_used = time.time()
                model_info.usage_count += 1
                model_info.state = ModelState.LOADED
                model_info.memory_usage = self._get_model_memory_usage(model)
                model_info.error_message = None
                
                # Store loaded model
                self.loaded_models[model_id] = model
                
                # Update statistics
                self.stats["total_loads"] += 1
                self.stats["cache_misses"] += 1
                
                logger.info(f"Model {model_id} loaded successfully in {load_time:.2f}s "
                           f"(memory: {model_info.memory_usage:.1f}MB)")
                
                return True, model
                
            except Exception as e:
                model_info.state = ModelState.ERROR
                model_info.error_message = str(e)
                self.stats["load_errors"] += 1
                
                logger.error(f"Failed to load model {model_id}: {e}")
                return False, None
    
    def unload_model(self, model_id: str, force: bool = False) -> bool:
        """Unload a model from memory."""
        with self.lock:
            if model_id not in self.models:
                logger.error(f"Model {model_id} not registered")
                return False
            
            model_info = self.models[model_id]
            
            if model_info.state != ModelState.LOADED:
                logger.debug(f"Model {model_id} not loaded")
                return True
            
            model = self.loaded_models.get(model_id)
            if model is None:
                logger.warning(f"Model {model_id} marked as loaded but not found in memory")
                model_info.state = ModelState.UNLOADED
                return True
            
            # Check if model is being used (unless forced)
            if not force and self._is_model_in_use(model_id):
                logger.debug(f"Model {model_id} is in use, cannot unload")
                return False
            
            try:
                model_info.state = ModelState.UNLOADING
                logger.info(f"Unloading model: {model_id}")
                
                success = self._unload_model(model_id, model)
                
                if success:
                    # Remove from loaded models
                    del self.loaded_models[model_id]
                    
                    # Update model info
                    model_info.state = ModelState.UNLOADED
                    model_info.memory_usage = 0.0
                    
                    # Update statistics
                    self.stats["total_unloads"] += 1
                    
                    logger.info(f"Model {model_id} unloaded successfully")
                    return True
                else:
                    model_info.state = ModelState.LOADED  # Revert state
                    logger.error(f"Failed to unload model {model_id}")
                    return False
                    
            except Exception as e:
                model_info.state = ModelState.ERROR
                model_info.error_message = str(e)
                logger.error(f"Error unloading model {model_id}: {e}")
                return False
    
    def get_model(self, model_id: str, auto_load: bool = True) -> Optional[Any]:
        """Get a model, optionally loading it if not in memory."""
        with self.lock:
            if model_id not in self.models:
                logger.error(f"Model {model_id} not registered")
                return None
            
            model_info = self.models[model_id]
            
            # If loaded, return it
            if model_info.state == ModelState.LOADED:
                model = self.loaded_models.get(model_id)
                if model is not None:
                    model_info.last_used = time.time()
                    model_info.usage_count += 1
                    return model
            
            # Auto-load if requested
            if auto_load:
                success, model = self.load_model(model_id)
                return model if success else None
            
            return None
    
    def _can_load_model(self) -> bool:
        """Check if we can load another model based on constraints."""
        # Check number of loaded models
        loaded_count = sum(1 for info in self.models.values() if info.state == ModelState.LOADED)
        if loaded_count >= self.config.max_models_in_memory:
            return False
        
        # Check memory usage
        current_memory = self._get_total_memory_usage()
        if current_memory >= self.config.max_memory_usage_mb:
            return False
        
        return True
    
    def _make_memory_available(self) -> bool:
        """Try to make memory available by unloading models."""
        # Get candidates for unloading (least recently used, lowest priority)
        candidates = []
        
        for model_id, model_info in self.models.items():
            if model_info.state == ModelState.LOADED and not self._is_model_in_use(model_id):
                candidates.append((model_id, model_info))
        
        # Sort by priority (ascending) and last used time (ascending)
        candidates.sort(key=lambda x: (x[1].priority, x[1].last_used))
        
        # Try to unload models until we have space
        for model_id, model_info in candidates:
            if self._can_load_model():
                return True
            
            if self.unload_model(model_id, force=True):
                self.stats["memory_evictions"] += 1
                logger.info(f"Evicted model {model_id} to free memory")
        
        return self._can_load_model()
    
    def _get_total_memory_usage(self) -> float:
        """Get total memory usage of all loaded models in MB."""
        return sum(
            info.memory_usage for info in self.models.values()
            if info.state == ModelState.LOADED
        )
    
    def _is_model_in_use(self, model_id: str) -> bool:
        """Check if a model is currently being used."""
        # This is a simple implementation - in practice, you might want
        # to track active inference requests
        model_info = self.models.get(model_id)
        if model_info is None:
            return False
        
        # Consider a model "in use" if it was used very recently
        time_since_use = time.time() - model_info.last_used
        return time_since_use < 30  # 30 seconds
    
    def start_memory_monitoring(self):
        """Start the memory monitoring thread."""
        if self.memory_monitor_thread is not None:
            return
        
        self.stop_monitoring.clear()
        self.memory_monitor_thread = threading.Thread(
            target=self._memory_monitor_loop,
            daemon=True
        )
        self.memory_monitor_thread.start()
        logger.info("Memory monitoring started")
    
    def stop_memory_monitoring(self):
        """Stop the memory monitoring thread."""
        if self.memory_monitor_thread is None:
            return
        
        self.stop_monitoring.set()
        self.memory_monitor_thread.join(timeout=5)
        self.memory_monitor_thread = None
        logger.info("Memory monitoring stopped")
    
    def _memory_monitor_loop(self):
        """Memory monitoring loop that runs in a separate thread."""
        while not self.stop_monitoring.wait(self.config.memory_check_interval):
            try:
                self._cleanup_idle_models()
                self._check_memory_pressure()
            except Exception as e:
                logger.error(f"Error in memory monitoring: {e}")
    
    def _cleanup_idle_models(self):
        """Unload models that have been idle for too long."""
        current_time = time.time()
        
        with self.lock:
            for model_id, model_info in list(self.models.items()):
                if model_info.state == ModelState.LOADED:
                    idle_time = current_time - model_info.last_used
                    
                    if idle_time > model_info.max_idle_time:
                        logger.info(f"Unloading idle model {model_id} (idle for {idle_time:.1f}s)")
                        self.unload_model(model_id, force=True)
    
    def _check_memory_pressure(self):
        """Check system memory pressure and unload models if needed."""
        # Check system memory
        memory = psutil.virtual_memory()
        if memory.percent > 85:  # High memory usage
            logger.warning(f"High system memory usage: {memory.percent:.1f}%")
            self._make_memory_available()
        
        # Check GPU memory if available
        if torch.cuda.is_available():
            try:
                gpu_memory = torch.cuda.memory_allocated() / 1024**3  # GB
                gpu_total = torch.cuda.get_device_properties(0).total_memory / 1024**3
                gpu_percent = (gpu_memory / gpu_total) * 100
                
                if gpu_percent > 80:  # High GPU memory usage
                    logger.warning(f"High GPU memory usage: {gpu_percent:.1f}%")
                    self._make_memory_available()
            except Exception as e:
                logger.debug(f"Could not check GPU memory: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive status of the model manager."""
        with self.lock:
            loaded_models = [
                {
                    "model_id": model_id,
                    "subject": info.subject,
                    "memory_usage": info.memory_usage,
                    "last_used": info.last_used,
                    "usage_count": info.usage_count,
                    "load_time": info.load_time
                }
                for model_id, info in self.models.items()
                if info.state == ModelState.LOADED
            ]
            
            return {
                "total_models": len(self.models),
                "loaded_models": len(loaded_models),
                "total_memory_usage": self._get_total_memory_usage(),
                "max_memory_limit": self.config.max_memory_usage_mb,
                "max_models_limit": self.config.max_models_in_memory,
                "statistics": self.stats.copy(),
                "loaded_model_details": loaded_models,
                "system_memory_percent": psutil.virtual_memory().percent
            }
    
    def cleanup(self):
        """Cleanup resources and unload all models."""
        logger.info("Cleaning up model manager")
        
        # Stop monitoring
        self.stop_memory_monitoring()
        
        # Unload all models
        with self.lock:
            for model_id in list(self.loaded_models.keys()):
                self.unload_model(model_id, force=True)
        
        logger.info("Model manager cleanup completed")
