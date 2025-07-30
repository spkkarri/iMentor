"""
Advanced Training Manager with support for:
- Loading pre-trained base models
- Resuming interrupted training
- Retraining existing models
- Transfer learning between subjects
"""

import os
import torch
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel, LoraConfig, get_peft_model

from ..models.base_model_registry import get_registry, BaseModelInfo, CheckpointInfo
from ..configs.base_config import SubjectConfig, ModelConfig, TrainingConfig
from .subject_trainer import UnslothTrainer

logger = logging.getLogger(__name__)

class AdvancedTrainingManager:
    """
    Advanced training manager with support for base models, checkpoints, and transfer learning.
    """
    
    def __init__(self, config: SubjectConfig):
        self.config = config
        self.registry = get_registry()
        self.model = None
        self.tokenizer = None
        self.trainer = None
        
    def prepare_training(self) -> bool:
        """
        Prepare training based on the training mode:
        - fine_tune: Start from a foundation model
        - resume: Continue from a checkpoint
        - transfer: Transfer from another subject model
        - retrain: Retrain an existing model
        """
        try:
            training_mode = self.config.model_config.training_mode
            logger.info(f"Preparing training in {training_mode} mode")
            
            if training_mode == "fine_tune":
                return self._prepare_fine_tuning()
            elif training_mode == "resume":
                return self._prepare_resume_training()
            elif training_mode == "transfer":
                return self._prepare_transfer_learning()
            elif training_mode == "retrain":
                return self._prepare_retraining()
            else:
                logger.error(f"Unknown training mode: {training_mode}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to prepare training: {e}")
            return False
    
    def _prepare_fine_tuning(self) -> bool:
        """Prepare fine-tuning from a foundation model."""
        base_model_id = self.config.model_config.base_model_id
        if not base_model_id:
            base_model_id = "dialogpt-small"  # Default
        
        base_model = self.registry.get_model(base_model_id)
        if not base_model:
            logger.error(f"Base model not found: {base_model_id}")
            return False
        
        logger.info(f"Loading base model: {base_model.name}")
        
        # Load tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(base_model.model_path)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Load base model
        model = AutoModelForCausalLM.from_pretrained(
            base_model.model_path,
            torch_dtype=torch.float16 if self.config.training_config.fp16 else torch.float32,
            device_map="auto"
        )
        
        # Apply LoRA if configured
        if self.config.model_config.use_lora:
            lora_config = LoraConfig(
                r=self.config.model_config.lora_rank,
                lora_alpha=self.config.model_config.lora_alpha,
                target_modules=self.config.model_config.target_modules,
                lora_dropout=self.config.model_config.lora_dropout,
                bias="none",
                task_type="CAUSAL_LM"
            )
            model = get_peft_model(model, lora_config)
        
        self.model = model
        self.registry.update_model_usage(base_model_id)
        
        logger.info(f"Successfully loaded base model: {base_model.name}")
        return True
    
    def _prepare_resume_training(self) -> bool:
        """Prepare to resume training from a checkpoint."""
        checkpoint_path = self.config.model_config.checkpoint_path
        if not checkpoint_path:
            logger.error("No checkpoint path provided for resume training")
            return False
        
        if not os.path.exists(checkpoint_path):
            logger.error(f"Checkpoint not found: {checkpoint_path}")
            return False
        
        logger.info(f"Resuming training from checkpoint: {checkpoint_path}")
        
        # Load model and tokenizer from checkpoint
        self.tokenizer = AutoTokenizer.from_pretrained(checkpoint_path)
        self.model = AutoModelForCausalLM.from_pretrained(checkpoint_path)
        
        # If it's a LoRA model, load the adapters
        if self.config.model_config.use_lora:
            try:
                self.model = PeftModel.from_pretrained(self.model, checkpoint_path)
            except Exception as e:
                logger.warning(f"Could not load LoRA adapters: {e}")
        
        logger.info("Successfully loaded checkpoint for resuming")
        return True
    
    def _prepare_transfer_learning(self) -> bool:
        """Prepare transfer learning from another subject model."""
        transfer_subject = self.config.model_config.transfer_from_subject
        if not transfer_subject:
            logger.error("No transfer subject specified")
            return False
        
        # Find the best model for the source subject
        source_models = self.registry.list_models(subject=transfer_subject)
        if not source_models:
            logger.error(f"No models found for transfer subject: {transfer_subject}")
            return False
        
        # Use the most recent model
        source_model = source_models[0]
        logger.info(f"Transfer learning from {transfer_subject} model: {source_model.model_id}")
        
        # Load the source model
        model_path = source_model.model_path
        if not os.path.exists(model_path):
            # Try to find in checkpoints directory
            checkpoints_dir = Path(__file__).parent.parent / "checkpoints"
            model_path = checkpoints_dir / f"{source_model.model_id}"
        
        if not os.path.exists(model_path):
            logger.error(f"Source model path not found: {model_path}")
            return False
        
        # Load tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForCausalLM.from_pretrained(model_path)
        
        # Apply transfer learning configurations
        if self.config.training_config.freeze_base_layers:
            self._freeze_base_layers()
        
        # Adjust learning rate for transfer learning
        self.config.training_config.learning_rate = self.config.training_config.transfer_learning_rate
        
        logger.info(f"Successfully prepared transfer learning from {transfer_subject}")
        return True
    
    def _prepare_retraining(self) -> bool:
        """Prepare to retrain an existing model."""
        # Similar to transfer learning but on the same subject
        existing_models = self.registry.list_models(subject=self.config.subject_name)
        if not existing_models:
            logger.warning(f"No existing models found for {self.config.subject_name}, falling back to fine-tuning")
            return self._prepare_fine_tuning()
        
        # Use the most recent model
        existing_model = existing_models[0]
        logger.info(f"Retraining existing model: {existing_model.model_id}")
        
        # Load the existing model
        model_path = existing_model.model_path
        if not os.path.exists(model_path):
            checkpoints_dir = Path(__file__).parent.parent / "checkpoints"
            model_path = checkpoints_dir / f"{existing_model.model_id}"
        
        if not os.path.exists(model_path):
            logger.warning(f"Existing model not found: {model_path}, falling back to fine-tuning")
            return self._prepare_fine_tuning()
        
        # Load tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForCausalLM.from_pretrained(model_path)
        
        logger.info(f"Successfully prepared retraining of {existing_model.model_id}")
        return True
    
    def _freeze_base_layers(self):
        """Freeze base model layers for transfer learning."""
        if self.model is None:
            return
        
        # Freeze all parameters first
        for param in self.model.parameters():
            param.requires_grad = False
        
        # Unfreeze the last few layers and LoRA adapters
        if hasattr(self.model, 'transformer'):
            # For GPT-style models
            num_layers = len(self.model.transformer.h)
            layers_to_unfreeze = max(1, num_layers // 4)  # Unfreeze last 25% of layers
            
            for i in range(num_layers - layers_to_unfreeze, num_layers):
                for param in self.model.transformer.h[i].parameters():
                    param.requires_grad = True
        
        # Always unfreeze LoRA adapters if present
        for name, param in self.model.named_parameters():
            if 'lora' in name.lower():
                param.requires_grad = True
        
        logger.info("Froze base layers for transfer learning")
    
    def create_trainer(self) -> Optional[UnslothTrainer]:
        """Create the trainer with the prepared model."""
        if self.model is None or self.tokenizer is None:
            logger.error("Model or tokenizer not prepared")
            return None
        
        try:
            # Create a lightweight LLM wrapper
            from ..models.lightweight_llm import LightweightLLM
            
            llm = LightweightLLM(
                model_name=self.config.model_config.model_name,
                use_lora=self.config.model_config.use_lora
            )
            
            # Replace with our prepared model and tokenizer
            llm.model = self.model
            llm.tokenizer = self.tokenizer
            
            # Create trainer
            self.trainer = UnslothTrainer(self.config, llm)
            
            logger.info("Successfully created advanced trainer")
            return self.trainer
            
        except Exception as e:
            logger.error(f"Failed to create trainer: {e}")
            return None
    
    def save_checkpoint(self, epoch: int, step: int, loss: float) -> str:
        """Save a training checkpoint."""
        if self.model is None:
            return ""
        
        try:
            checkpoints_dir = Path(__file__).parent.parent / "checkpoints"
            checkpoints_dir.mkdir(exist_ok=True)
            
            checkpoint_id = f"{self.config.subject_name}_{epoch}_{step}_{int(loss*1000)}"
            checkpoint_path = checkpoints_dir / checkpoint_id
            
            # Save model and tokenizer
            self.model.save_pretrained(checkpoint_path)
            self.tokenizer.save_pretrained(checkpoint_path)
            
            # Register checkpoint
            checkpoint_info = CheckpointInfo(
                checkpoint_id=checkpoint_id,
                model_id=self.config.model_config.base_model_id or "unknown",
                subject=self.config.subject_name,
                epoch=epoch,
                step=step,
                loss=loss,
                checkpoint_path=str(checkpoint_path),
                training_config=self.config.training_config.__dict__
            )
            
            self.registry.register_checkpoint(checkpoint_info)
            
            logger.info(f"Saved checkpoint: {checkpoint_id}")
            return checkpoint_id
            
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
            return ""
    
    def get_training_info(self) -> Dict[str, Any]:
        """Get information about the current training setup."""
        info = {
            "training_mode": self.config.model_config.training_mode,
            "subject": self.config.subject_name,
            "base_model": self.config.model_config.base_model_id,
            "model_loaded": self.model is not None,
            "tokenizer_loaded": self.tokenizer is not None
        }
        
        if self.config.model_config.training_mode == "transfer":
            info["transfer_from"] = self.config.model_config.transfer_from_subject
        
        if self.config.model_config.training_mode == "resume":
            info["checkpoint_path"] = self.config.model_config.checkpoint_path
        
        return info
