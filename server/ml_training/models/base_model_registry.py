"""
Base Model Registry for managing pre-trained foundation models and checkpoints.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class BaseModelInfo:
    """Information about a base model."""
    model_id: str
    name: str
    model_path: str  # HuggingFace model name or local path
    model_type: str  # "foundation", "checkpoint", "fine-tuned", "custom"
    subject: Optional[str] = None
    size: str = "1B"
    description: str = ""
    parameters: int = 0
    created_at: str = ""
    last_used: str = ""
    training_info: Optional[Dict[str, Any]] = None
    performance_metrics: Optional[Dict[str, float]] = None
    compatible_subjects: List[str] = None

    # Custom model specific fields
    uploaded_by: Optional[str] = None
    file_size: Optional[int] = None
    model_format: str = "huggingface"  # "huggingface", "onnx", "pytorch", "safetensors"
    is_verified: bool = False
    upload_source: str = "local"  # "local", "huggingface", "url"
    original_filename: Optional[str] = None
    
    def __post_init__(self):
        if self.compatible_subjects is None:
            self.compatible_subjects = []
        if not self.created_at:
            self.created_at = datetime.now().isoformat()

@dataclass
class CheckpointInfo:
    """Information about a training checkpoint."""
    checkpoint_id: str
    model_id: str
    subject: str
    epoch: int
    step: int
    loss: float
    checkpoint_path: str
    created_at: str = ""
    resumable: bool = True
    training_config: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()

class BaseModelRegistry:
    """Registry for managing base models and checkpoints."""
    
    def __init__(self, registry_path: str = None):
        if registry_path is None:
            registry_path = Path(__file__).parent.parent / "models" / "registry.json"
        
        self.registry_path = Path(registry_path)
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        
        self.models: Dict[str, BaseModelInfo] = {}
        self.checkpoints: Dict[str, CheckpointInfo] = {}
        
        self._load_registry()
        self._initialize_foundation_models()
    
    def _load_registry(self):
        """Load the model registry from disk."""
        if self.registry_path.exists():
            try:
                with open(self.registry_path, 'r') as f:
                    data = json.load(f)
                
                # Load models
                for model_data in data.get('models', []):
                    model_info = BaseModelInfo(**model_data)
                    self.models[model_info.model_id] = model_info
                
                # Load checkpoints
                for checkpoint_data in data.get('checkpoints', []):
                    checkpoint_info = CheckpointInfo(**checkpoint_data)
                    self.checkpoints[checkpoint_info.checkpoint_id] = checkpoint_info
                
                logger.info(f"Loaded {len(self.models)} models and {len(self.checkpoints)} checkpoints")
            except Exception as e:
                logger.error(f"Failed to load registry: {e}")
                self.models = {}
                self.checkpoints = {}
    
    def _save_registry(self):
        """Save the model registry to disk."""
        try:
            data = {
                'models': [asdict(model) for model in self.models.values()],
                'checkpoints': [asdict(checkpoint) for checkpoint in self.checkpoints.values()]
            }
            
            with open(self.registry_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info("Registry saved successfully")
        except Exception as e:
            logger.error(f"Failed to save registry: {e}")
    
    def _initialize_foundation_models(self):
        """Initialize the registry with popular foundation models."""
        foundation_models = [
            {
                "model_id": "gpt2-small",
                "name": "GPT-2 Small",
                "model_path": "gpt2",
                "model_type": "foundation",
                "size": "124M",
                "description": "OpenAI's GPT-2 small model - good for general text generation",
                "parameters": 124000000,
                "compatible_subjects": ["general", "literature", "history", "science"]
            },
            {
                "model_id": "gpt2-medium", 
                "name": "GPT-2 Medium",
                "model_path": "gpt2-medium",
                "model_type": "foundation",
                "size": "355M",
                "description": "OpenAI's GPT-2 medium model - better performance than small",
                "parameters": 355000000,
                "compatible_subjects": ["general", "literature", "history", "science", "programming"]
            },
            {
                "model_id": "distilgpt2",
                "name": "DistilGPT-2",
                "model_path": "distilgpt2",
                "model_type": "foundation", 
                "size": "82M",
                "description": "Distilled version of GPT-2 - faster and smaller",
                "parameters": 82000000,
                "compatible_subjects": ["general", "literature", "history"]
            },
            {
                "model_id": "dialogpt-small",
                "name": "DialoGPT Small",
                "model_path": "microsoft/DialoGPT-small",
                "model_type": "foundation",
                "size": "117M", 
                "description": "Microsoft's conversational AI model - good for dialogue",
                "parameters": 117000000,
                "compatible_subjects": ["general", "programming", "science"]
            },
            {
                "model_id": "codegen-350m",
                "name": "CodeGen 350M",
                "model_path": "Salesforce/codegen-350M-mono",
                "model_type": "foundation",
                "size": "350M",
                "description": "Salesforce's code generation model - specialized for programming",
                "parameters": 350000000,
                "compatible_subjects": ["programming", "science"]
            }
        ]
        
        # Add foundation models if they don't exist
        for model_data in foundation_models:
            model_id = model_data["model_id"]
            if model_id not in self.models:
                self.models[model_id] = BaseModelInfo(**model_data)
        
        self._save_registry()
    
    def register_model(self, model_info: BaseModelInfo) -> bool:
        """Register a new model."""
        try:
            self.models[model_info.model_id] = model_info
            self._save_registry()
            logger.info(f"Registered model: {model_info.model_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to register model: {e}")
            return False
    
    def register_checkpoint(self, checkpoint_info: CheckpointInfo) -> bool:
        """Register a new checkpoint."""
        try:
            self.checkpoints[checkpoint_info.checkpoint_id] = checkpoint_info
            self._save_registry()
            logger.info(f"Registered checkpoint: {checkpoint_info.checkpoint_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to register checkpoint: {e}")
            return False
    
    def get_model(self, model_id: str) -> Optional[BaseModelInfo]:
        """Get model information by ID."""
        return self.models.get(model_id)
    
    def get_checkpoint(self, checkpoint_id: str) -> Optional[CheckpointInfo]:
        """Get checkpoint information by ID."""
        return self.checkpoints.get(checkpoint_id)
    
    def list_models(self, model_type: str = None, subject: str = None) -> List[BaseModelInfo]:
        """List models with optional filtering."""
        models = list(self.models.values())
        
        if model_type:
            models = [m for m in models if m.model_type == model_type]
        
        if subject:
            models = [m for m in models if subject in m.compatible_subjects or m.subject == subject]
        
        return sorted(models, key=lambda x: x.created_at, reverse=True)
    
    def list_checkpoints(self, model_id: str = None, subject: str = None) -> List[CheckpointInfo]:
        """List checkpoints with optional filtering."""
        checkpoints = list(self.checkpoints.values())
        
        if model_id:
            checkpoints = [c for c in checkpoints if c.model_id == model_id]
        
        if subject:
            checkpoints = [c for c in checkpoints if c.subject == subject]
        
        return sorted(checkpoints, key=lambda x: x.created_at, reverse=True)
    
    def update_model_usage(self, model_id: str):
        """Update the last used timestamp for a model."""
        if model_id in self.models:
            self.models[model_id].last_used = datetime.now().isoformat()
            self._save_registry()
    
    def get_compatible_models(self, subject: str) -> List[BaseModelInfo]:
        """Get models compatible with a specific subject."""
        return [
            model for model in self.models.values()
            if subject in model.compatible_subjects or model.subject == subject
        ]

    def register_custom_model(self, model_info: BaseModelInfo, user_id: str) -> bool:
        """Register a custom model uploaded by a user."""
        try:
            model_info.model_type = "custom"
            model_info.uploaded_by = user_id
            model_info.is_verified = False  # Custom models need verification

            self.models[model_info.model_id] = model_info
            self._save_registry()
            logger.info(f"Registered custom model: {model_info.model_id} by user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to register custom model: {e}")
            return False

    def get_custom_models(self, user_id: str = None) -> List[BaseModelInfo]:
        """Get custom models, optionally filtered by user."""
        custom_models = [m for m in self.models.values() if m.model_type == "custom"]

        if user_id:
            custom_models = [m for m in custom_models if m.uploaded_by == user_id]

        return sorted(custom_models, key=lambda x: x.created_at, reverse=True)

    def verify_custom_model(self, model_id: str, verified: bool = True) -> bool:
        """Mark a custom model as verified or unverified."""
        if model_id in self.models and self.models[model_id].model_type == "custom":
            self.models[model_id].is_verified = verified
            self._save_registry()
            logger.info(f"Model {model_id} verification status: {verified}")
            return True
        return False

    def delete_custom_model(self, model_id: str, user_id: str) -> bool:
        """Delete a custom model (only by the user who uploaded it)."""
        if model_id in self.models:
            model = self.models[model_id]
            if model.model_type == "custom" and model.uploaded_by == user_id:
                # Remove model files if they exist
                import os
                if os.path.exists(model.model_path):
                    try:
                        import shutil
                        shutil.rmtree(model.model_path)
                        logger.info(f"Deleted model files: {model.model_path}")
                    except Exception as e:
                        logger.warning(f"Could not delete model files: {e}")

                # Remove from registry
                del self.models[model_id]
                self._save_registry()
                logger.info(f"Deleted custom model: {model_id}")
                return True
        return False

# Global registry instance
_registry = None

def get_registry() -> BaseModelRegistry:
    """Get the global model registry instance."""
    global _registry
    if _registry is None:
        _registry = BaseModelRegistry()
    return _registry
