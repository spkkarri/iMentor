"""
PyTorch Lightning trainer for subject-specific LLM fine-tuning with Unsloth integration.
"""

import torch
import pytorch_lightning as pl
from pytorch_lightning.callbacks import ModelCheckpoint, EarlyStopping, LearningRateMonitor
from pytorch_lightning.loggers import WandbLogger, TensorBoardLogger
from torch.utils.data import DataLoader
from transformers import get_linear_schedule_with_warmup, get_cosine_schedule_with_warmup
from torch.optim import AdamW
from typing import Dict, Any, Optional, List
import logging
import wandb
import os
import time
from pathlib import Path

from ..models.lightweight_llm import LightweightLLM, create_model_for_subject
from ..datasets.subject_dataset import SubjectDataset
from ..configs.base_config import SubjectConfig

logger = logging.getLogger(__name__)

class UnslothTrainer(pl.LightningModule):
    """
    Enhanced PyTorch Lightning trainer with Unsloth optimizations.
    """

    def __init__(
        self,
        config: SubjectConfig,
        model: Optional[LightweightLLM] = None
    ):
        super().__init__()

        self.config = config
        self.save_hyperparameters(ignore=['model'])

        # Initialize model with Unsloth optimizations
        if model is None:
            self.model = self._create_optimized_model()
        else:
            self.model = model

        # Training state
        self.train_losses = []
        self.val_losses = []
        self.best_val_loss = float('inf')
        self.training_start_time = None

        # Metrics tracking
        self.step_times = []
        self.memory_usage = []

        # Log model info
        logger.info(f"Initialized Unsloth trainer for {config.subject_name}")
        logger.info(self.model.get_trainable_parameters())

        # Setup Unsloth optimizations
        self._setup_unsloth_optimizations()

    def _create_optimized_model(self) -> LightweightLLM:
        """Create model with Unsloth optimizations."""
        try:
            # Try to use Unsloth if available
            if self.config.training_config.use_unsloth:
                model = self._create_unsloth_model()
            else:
                model = self._create_standard_model()

            return model

        except Exception as e:
            logger.warning(f"Failed to create Unsloth model, falling back to standard: {e}")
            return self._create_standard_model()

    def _create_unsloth_model(self) -> LightweightLLM:
        """Create model using Unsloth optimizations."""
        try:
            # This would use the actual Unsloth library
            # For now, we'll create a standard model with optimizations
            from ..models.lightweight_llm import UnslothOptimizedModel

            model = UnslothOptimizedModel(
                model_name=self.config.model_config.model_name,
                max_seq_length=self.config.training_config.unsloth_max_seq_length,
                use_lora=self.config.model_config.use_lora,
                lora_config={
                    "r": self.config.model_config.lora_rank,
                    "lora_alpha": self.config.model_config.lora_alpha,
                    "lora_dropout": self.config.model_config.lora_dropout,
                    "target_modules": self.config.model_config.target_modules
                },
                load_in_4bit=self.config.training_config.unsloth_load_in_4bit
            )

            logger.info("Created Unsloth-optimized model")
            return model

        except ImportError:
            logger.warning("Unsloth not available, using standard model")
            return self._create_standard_model()

    def _create_standard_model(self) -> LightweightLLM:
        """Create standard model without Unsloth."""
        return create_model_for_subject(
            subject=self.config.subject_name,
            model_name=self.config.model_config.model_name,
            use_unsloth=False,
            use_lora=self.config.model_config.use_lora,
            lora_config={
                "r": self.config.model_config.lora_rank,
                "lora_alpha": self.config.model_config.lora_alpha,
                "lora_dropout": self.config.model_config.lora_dropout,
                "target_modules": self.config.model_config.target_modules
            },
            load_in_4bit=self.config.training_config.unsloth_load_in_4bit
        )

    def _setup_unsloth_optimizations(self):
        """Setup Unsloth-specific optimizations."""
        if self.config.training_config.use_unsloth:
            # Enable gradient checkpointing for memory efficiency
            if hasattr(self.model.base_model, 'gradient_checkpointing_enable'):
                self.model.base_model.gradient_checkpointing_enable()

            # Set model to training mode with optimizations
            self.model.train()

            logger.info("Unsloth optimizations enabled")
    
    def forward(self, input_ids, attention_mask=None, labels=None):
        """Forward pass."""
        return self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels
        )
    
    def training_step(self, batch, batch_idx):
        """Training step."""
        outputs = self(
            input_ids=batch['input_ids'],
            attention_mask=batch['attention_mask'],
            labels=batch['labels']
        )
        
        loss = outputs.loss
        
        # Log metrics
        self.log('train_loss', loss, on_step=True, on_epoch=True, prog_bar=True)
        self.log('learning_rate', self.trainer.optimizers[0].param_groups[0]['lr'], on_step=True)
        
        # Store for epoch-level logging
        self.train_losses.append(loss.detach())
        
        return loss
    
    def validation_step(self, batch, batch_idx):
        """Validation step."""
        outputs = self(
            input_ids=batch['input_ids'],
            attention_mask=batch['attention_mask'],
            labels=batch['labels']
        )
        
        loss = outputs.loss
        
        # Calculate perplexity
        perplexity = torch.exp(loss)
        
        # Log metrics
        self.log('val_loss', loss, on_step=False, on_epoch=True, prog_bar=True)
        self.log('val_perplexity', perplexity, on_step=False, on_epoch=True)
        
        # Store for epoch-level logging
        self.val_losses.append(loss.detach())
        
        return {'val_loss': loss, 'val_perplexity': perplexity}
    
    def on_train_epoch_end(self):
        """Called at the end of training epoch."""
        if self.train_losses:
            avg_train_loss = torch.stack(self.train_losses).mean()
            self.log('epoch_train_loss', avg_train_loss)
            self.train_losses.clear()
    
    def on_validation_epoch_end(self):
        """Called at the end of validation epoch."""
        if self.val_losses:
            avg_val_loss = torch.stack(self.val_losses).mean()
            self.log('epoch_val_loss', avg_val_loss)
            self.val_losses.clear()
    
    def configure_optimizers(self):
        """Configure optimizers and schedulers."""
        # Get optimizer
        if self.config.training_config.optimizer.lower() == "adamw":
            optimizer = AdamW(
                self.parameters(),
                lr=self.config.training_config.learning_rate,
                weight_decay=self.config.training_config.weight_decay
            )
        else:
            raise ValueError(f"Unsupported optimizer: {self.config.training_config.optimizer}")
        
        # Get scheduler
        if self.config.training_config.scheduler.lower() == "cosine":
            # Estimate total steps
            total_steps = self.trainer.estimated_stepping_batches
            warmup_steps = min(self.config.training_config.warmup_steps, total_steps // 10)
            
            scheduler = get_linear_schedule_with_warmup(
                optimizer,
                num_warmup_steps=warmup_steps,
                num_training_steps=total_steps
            )
            
            return {
                "optimizer": optimizer,
                "lr_scheduler": {
                    "scheduler": scheduler,
                    "interval": "step",
                    "frequency": 1
                }
            }
        
        return optimizer
    
    def generate_sample(self, prompt: str, max_length: int = 100) -> str:
        """Generate a sample response for evaluation."""
        self.model.eval()
        
        # Tokenize input
        inputs = self.model.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=self.config.model_config.max_length
        ).to(self.device)
        
        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                input_ids=inputs['input_ids'],
                attention_mask=inputs['attention_mask'],
                max_length=max_length,
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.model.tokenizer.eos_token_id
            )
        
        # Decode
        generated_text = self.model.tokenizer.decode(
            outputs[0], 
            skip_special_tokens=True
        )
        
        # Remove input prompt from output
        if generated_text.startswith(prompt):
            generated_text = generated_text[len(prompt):].strip()
        
        return generated_text

class TrainingManager:
    """
    Manager class for handling the complete training pipeline.
    """
    
    def __init__(self, config: SubjectConfig):
        self.config = config
        self.trainer = None
        self.model = None
        
    def setup_trainer(self, train_dataloader, val_dataloader):
        """Setup PyTorch Lightning trainer."""
        # Initialize model
        self.model = SubjectSpecificTrainer(self.config)
        
        # Setup callbacks
        callbacks = []
        
        # Model checkpoint
        checkpoint_callback = ModelCheckpoint(
            dirpath=f"{self.config.experiment_config.output_dir}/checkpoints/{self.config.subject_name}",
            filename="{epoch}-{val_loss:.2f}",
            monitor="val_loss",
            mode="min",
            save_top_k=3,
            save_last=True
        )
        callbacks.append(checkpoint_callback)
        
        # Early stopping
        early_stop_callback = EarlyStopping(
            monitor="val_loss",
            patience=self.config.training_config.early_stopping_patience,
            mode="min",
            min_delta=self.config.training_config.early_stopping_threshold
        )
        callbacks.append(early_stop_callback)
        
        # Learning rate monitor
        lr_monitor = LearningRateMonitor(logging_interval='step')
        callbacks.append(lr_monitor)
        
        # Setup logger
        logger = None
        if self.config.experiment_config.use_wandb:
            logger = WandbLogger(
                project=self.config.experiment_config.project_name,
                name=f"{self.config.subject_name}_{self.config.experiment_config.run_name or 'run'}",
                entity=self.config.experiment_config.wandb_entity
            )
        
        # Initialize trainer
        self.trainer = pl.Trainer(
            max_epochs=self.config.training_config.num_epochs,
            callbacks=callbacks,
            logger=logger,
            accelerator="auto",
            devices="auto",
            precision=self.config.experiment_config.mixed_precision,
            gradient_clip_val=self.config.training_config.max_grad_norm,
            accumulate_grad_batches=self.config.training_config.gradient_accumulation_steps,
            val_check_interval=self.config.training_config.eval_steps,
            log_every_n_steps=self.config.training_config.logging_steps,
            enable_checkpointing=True,
            enable_progress_bar=True
        )
        
        return self.trainer
    
    def train(self, train_dataloader, val_dataloader):
        """Run the training process."""
        if self.trainer is None:
            self.setup_trainer(train_dataloader, val_dataloader)
        
        logger.info(f"Starting training for {self.config.subject_name}")
        
        # Start training
        self.trainer.fit(
            model=self.model,
            train_dataloaders=train_dataloader,
            val_dataloaders=val_dataloader
        )
        
        logger.info(f"Training completed for {self.config.subject_name}")
        
        return self.model
    
    def save_model(self, save_path: str):
        """Save the trained model."""
        if self.model is not None:
            self.model.model.save_pretrained(save_path)
            logger.info(f"Model saved to {save_path}")
        else:
            logger.error("No model to save. Train the model first.")
    
    def evaluate(self, test_dataloader):
        """Evaluate the trained model."""
        if self.trainer is None or self.model is None:
            logger.error("No trained model available for evaluation.")
            return None
        
        results = self.trainer.test(
            model=self.model,
            dataloaders=test_dataloader
        )
        
        return results
