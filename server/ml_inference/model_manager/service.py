"""
Comprehensive model management service integrating all components.
"""

import os
import json
import logging
import time
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import threading

from .pytorch_manager import PyTorchModelManager
from .model_cache import ModelCache
from .base_manager import ModelConfig, ModelState
from ..routing.query_router import QueryRouter
from ..query_classifier.embedding_classifier import HybridEmbeddingClassifier

logger = logging.getLogger(__name__)

class ModelManagementService:
    """
    Comprehensive service for managing specialized LLM models.
    """
    
    def __init__(
        self,
        config_file: Optional[str] = None,
        models_dir: str = "models",
        cache_dir: str = "model_cache"
    ):
        # Load configuration
        self.config = self._load_config(config_file)
        self.models_dir = Path(models_dir)
        self.cache_dir = Path(cache_dir)
        
        # Create directories
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize components
        self.model_manager = PyTorchModelManager(self.config)
        self.model_cache = ModelCache(
            cache_dir=str(self.cache_dir),
            max_cache_size_gb=self.config.max_memory_usage_mb / 1024,
            enable_compression=True
        )
        
        # Query routing
        self.subjects = ["mathematics", "programming", "science", "history", "literature"]
        self.classifier = HybridEmbeddingClassifier(self.subjects)
        self.router = QueryRouter(
            subjects=self.subjects,
            classifier=self.classifier,
            fallback_model="general"
        )
        
        # Service state
        self.is_running = False
        self.startup_time = None
        
        # Model registry
        self.model_registry = {}
        
        # Load existing models
        self._discover_models()
        
        logger.info("ModelManagementService initialized")
    
    def _load_config(self, config_file: Optional[str]) -> ModelConfig:
        """Load configuration from file or use defaults."""
        default_config = ModelConfig(
            max_models_in_memory=3,
            max_memory_usage_mb=8192,
            model_idle_timeout=1800,
            preload_models=["mathematics", "programming"],
            memory_check_interval=60,
            enable_model_caching=True,
            cache_directory="model_cache"
        )
        
        if config_file and os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    config_data = json.load(f)
                
                # Update default config with loaded values
                for key, value in config_data.items():
                    if hasattr(default_config, key):
                        setattr(default_config, key, value)
                
                logger.info(f"Loaded configuration from {config_file}")
                
            except Exception as e:
                logger.error(f"Failed to load config from {config_file}: {e}")
        
        return default_config
    
    def _discover_models(self):
        """Discover available models in the models directory."""
        logger.info("Discovering available models...")
        
        for subject_dir in self.models_dir.iterdir():
            if subject_dir.is_dir():
                subject = subject_dir.name
                
                # Look for model files
                model_files = list(subject_dir.glob("*.bin")) + list(subject_dir.glob("*.safetensors"))
                config_files = list(subject_dir.glob("config.json"))
                
                if model_files or config_files:
                    model_id = f"{subject}_model"
                    model_path = str(subject_dir)
                    
                    # Register the model
                    success = self.model_manager.register_model(
                        model_id=model_id,
                        subject=subject,
                        model_path=model_path,
                        model_type="pytorch",
                        priority=2 if subject in self.config.preload_models else 1
                    )
                    
                    if success:
                        self.model_registry[subject] = {
                            "model_id": model_id,
                            "path": model_path,
                            "discovered": True
                        }
                        logger.info(f"Discovered model for {subject}: {model_path}")
        
        logger.info(f"Discovered {len(self.model_registry)} models")
    
    def start_service(self):
        """Start the model management service."""
        if self.is_running:
            logger.warning("Service is already running")
            return
        
        logger.info("Starting ModelManagementService...")
        self.startup_time = time.time()
        
        # Start memory monitoring
        self.model_manager.start_memory_monitoring()
        
        # Preload specified models
        self._preload_models()
        
        # Update router with model status
        self._update_router_status()
        
        self.is_running = True
        logger.info("ModelManagementService started successfully")
    
    def stop_service(self):
        """Stop the model management service."""
        if not self.is_running:
            return
        
        logger.info("Stopping ModelManagementService...")
        
        # Stop memory monitoring
        self.model_manager.stop_memory_monitoring()
        
        # Cleanup resources
        self.model_manager.cleanup()
        
        self.is_running = False
        logger.info("ModelManagementService stopped")
    
    def _preload_models(self):
        """Preload specified models for faster response times."""
        if not self.config.preload_models:
            return
        
        logger.info(f"Preloading models: {self.config.preload_models}")
        
        for subject in self.config.preload_models:
            if subject in self.model_registry:
                model_id = self.model_registry[subject]["model_id"]
                success, _ = self.model_manager.load_model(model_id)
                
                if success:
                    logger.info(f"Preloaded model for {subject}")
                else:
                    logger.warning(f"Failed to preload model for {subject}")
    
    def _update_router_status(self):
        """Update router with current model availability."""
        for subject, info in self.model_registry.items():
            model_id = info["model_id"]
            model_info = self.model_manager.models.get(model_id)
            
            if model_info:
                is_loaded = model_info.state == ModelState.LOADED
                is_available = model_info.state in [ModelState.LOADED, ModelState.UNLOADED]
                
                self.router.update_model_status(
                    subject=subject,
                    is_loaded=is_loaded,
                    is_available=is_available
                )
    
    def process_query(self, query: str, user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process a user query using the appropriate specialized model."""
        if not self.is_running:
            return {"error": "Service not running"}
        
        start_time = time.time()
        
        try:
            # Route the query
            routing_decision = self.router.route_query(query, user_context)
            
            # Get the primary model
            primary_subject = routing_decision.primary_model
            
            # Handle fallback to general model
            if primary_subject == "general":
                return {
                    "response": "I'll help you with that using my general knowledge.",
                    "model_used": "general",
                    "confidence": routing_decision.confidence,
                    "reasoning": routing_decision.reasoning,
                    "processing_time": time.time() - start_time
                }
            
            # Get the specialized model
            if primary_subject not in self.model_registry:
                logger.warning(f"No model available for {primary_subject}")
                return {
                    "error": f"No model available for {primary_subject}",
                    "fallback_used": True
                }
            
            model_id = self.model_registry[primary_subject]["model_id"]
            
            # Generate response
            response = self.model_manager.generate_text(
                model_id=model_id,
                input_text=query,
                max_length=150,
                temperature=0.7
            )
            
            if response is None:
                # Try fallback models
                for fallback_subject in routing_decision.fallback_models:
                    if fallback_subject in self.model_registry:
                        fallback_model_id = self.model_registry[fallback_subject]["model_id"]
                        response = self.model_manager.generate_text(
                            model_id=fallback_model_id,
                            input_text=query,
                            max_length=150,
                            temperature=0.7
                        )
                        
                        if response is not None:
                            primary_subject = fallback_subject
                            break
            
            # Update router statistics
            processing_time = time.time() - start_time
            self.router.update_model_status(
                subject=primary_subject,
                response_time=processing_time,
                error_occurred=(response is None)
            )
            
            return {
                "response": response or "I'm sorry, I couldn't generate a response.",
                "model_used": primary_subject,
                "confidence": routing_decision.confidence,
                "reasoning": routing_decision.reasoning,
                "processing_time": processing_time,
                "fallback_used": response is None
            }
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return {
                "error": str(e),
                "processing_time": time.time() - start_time
            }
    
    def add_model(
        self,
        subject: str,
        model_path: str,
        model_type: str = "pytorch",
        priority: int = 1
    ) -> bool:
        """Add a new model to the service."""
        model_id = f"{subject}_model"
        
        # Register with model manager
        success = self.model_manager.register_model(
            model_id=model_id,
            subject=subject,
            model_path=model_path,
            model_type=model_type,
            priority=priority
        )
        
        if success:
            # Update registry
            self.model_registry[subject] = {
                "model_id": model_id,
                "path": model_path,
                "discovered": False
            }
            
            # Update router
            self.router.update_model_status(
                subject=subject,
                is_loaded=False,
                is_available=True
            )
            
            logger.info(f"Added model for {subject}: {model_path}")
            return True
        
        return False
    
    def remove_model(self, subject: str) -> bool:
        """Remove a model from the service."""
        if subject not in self.model_registry:
            return False
        
        model_id = self.model_registry[subject]["model_id"]
        
        # Unload if loaded
        self.model_manager.unload_model(model_id, force=True)
        
        # Remove from registry
        del self.model_registry[subject]
        
        # Update router
        self.router.update_model_status(
            subject=subject,
            is_loaded=False,
            is_available=False
        )
        
        logger.info(f"Removed model for {subject}")
        return True
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get comprehensive service status."""
        status = {
            "service_running": self.is_running,
            "startup_time": self.startup_time,
            "uptime_seconds": time.time() - self.startup_time if self.startup_time else 0,
            "registered_models": len(self.model_registry),
            "model_manager_status": self.model_manager.get_status(),
            "cache_stats": self.model_cache.get_cache_stats(),
            "routing_stats": self.router.get_routing_statistics(),
            "available_subjects": list(self.model_registry.keys())
        }
        
        return status
    
    def benchmark_models(self) -> Dict[str, Any]:
        """Benchmark all loaded models."""
        results = {}
        
        for subject, info in self.model_registry.items():
            model_id = info["model_id"]
            
            # Check if model is loaded
            model_info = self.model_manager.models.get(model_id)
            if model_info and model_info.state == ModelState.LOADED:
                benchmark_result = self.model_manager.benchmark_model(model_id)
                results[subject] = benchmark_result
            else:
                results[subject] = {"status": "not_loaded"}
        
        return results
    
    def save_configuration(self, config_file: str):
        """Save current configuration to file."""
        config_data = {
            "max_models_in_memory": self.config.max_models_in_memory,
            "max_memory_usage_mb": self.config.max_memory_usage_mb,
            "model_idle_timeout": self.config.model_idle_timeout,
            "preload_models": self.config.preload_models,
            "memory_check_interval": self.config.memory_check_interval,
            "enable_model_caching": self.config.enable_model_caching,
            "cache_directory": self.config.cache_directory
        }
        
        with open(config_file, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        logger.info(f"Configuration saved to {config_file}")

# Global service instance
_service_instance = None

def get_model_service() -> ModelManagementService:
    """Get the global model service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = ModelManagementService()
    return _service_instance

def initialize_service(config_file: Optional[str] = None) -> ModelManagementService:
    """Initialize the global model service."""
    global _service_instance
    _service_instance = ModelManagementService(config_file=config_file)
    return _service_instance
