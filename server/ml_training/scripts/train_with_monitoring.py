#!/usr/bin/env python3
"""
Enhanced training script with comprehensive monitoring and Unsloth integration.
"""

import os
import sys
import argparse
import logging
import time
import json
from pathlib import Path
from datetime import datetime
import psutil
import GPUtil

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from configs.base_config import get_config, get_all_subjects
from trainers.subject_trainer import UnslothTrainer
from datasets.subject_dataset import SubjectDatasetManager
from utils.unsloth_integration import unsloth_integration
from transformers import AutoTokenizer
import torch
import pytorch_lightning as pl
from pytorch_lightning.callbacks import ModelCheckpoint, EarlyStopping, LearningRateMonitor
from pytorch_lightning.loggers import WandbLogger, TensorBoardLogger

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TrainingMonitor:
    """Monitor training progress and system resources."""
    
    def __init__(self, experiment_name: str):
        self.experiment_name = experiment_name
        self.start_time = None
        self.metrics = {
            "training_time": 0,
            "peak_memory_usage": 0,
            "peak_gpu_memory": 0,
            "total_steps": 0,
            "best_val_loss": float('inf'),
            "final_train_loss": 0,
            "convergence_step": -1
        }
        
    def start_monitoring(self):
        """Start monitoring training."""
        self.start_time = time.time()
        logger.info(f"Started monitoring for {self.experiment_name}")
        
    def update_metrics(self, step: int, train_loss: float, val_loss: float = None):
        """Update training metrics."""
        self.metrics["total_steps"] = step
        self.metrics["final_train_loss"] = train_loss
        
        if val_loss is not None and val_loss < self.metrics["best_val_loss"]:
            self.metrics["best_val_loss"] = val_loss
            self.metrics["convergence_step"] = step
        
        # Update system metrics
        self._update_system_metrics()
        
    def _update_system_metrics(self):
        """Update system resource metrics."""
        # CPU and RAM
        memory_usage = psutil.virtual_memory().used / 1024**3  # GB
        self.metrics["peak_memory_usage"] = max(
            self.metrics["peak_memory_usage"], 
            memory_usage
        )
        
        # GPU memory
        if torch.cuda.is_available():
            gpu_memory = torch.cuda.memory_allocated() / 1024**3  # GB
            self.metrics["peak_gpu_memory"] = max(
                self.metrics["peak_gpu_memory"],
                gpu_memory
            )
    
    def finish_monitoring(self):
        """Finish monitoring and calculate final metrics."""
        if self.start_time:
            self.metrics["training_time"] = time.time() - self.start_time
        
        logger.info(f"Training completed for {self.experiment_name}")
        self._log_final_metrics()
        
    def _log_final_metrics(self):
        """Log final training metrics."""
        logger.info("=== TRAINING SUMMARY ===")
        logger.info(f"Experiment: {self.experiment_name}")
        logger.info(f"Training time: {self.metrics['training_time']:.2f} seconds")
        logger.info(f"Total steps: {self.metrics['total_steps']}")
        logger.info(f"Best validation loss: {self.metrics['best_val_loss']:.4f}")
        logger.info(f"Final training loss: {self.metrics['final_train_loss']:.4f}")
        logger.info(f"Peak memory usage: {self.metrics['peak_memory_usage']:.2f} GB")
        logger.info(f"Peak GPU memory: {self.metrics['peak_gpu_memory']:.2f} GB")
        
    def save_metrics(self, output_file: str):
        """Save metrics to file."""
        with open(output_file, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        logger.info(f"Metrics saved to {output_file}")

def setup_experiment_logging(config, experiment_name: str):
    """Setup experiment logging with multiple loggers."""
    loggers = []
    
    # Weights & Biases logger
    if config.experiment_config.use_wandb:
        wandb_logger = WandbLogger(
            project=config.experiment_config.project_name,
            name=experiment_name,
            entity=config.experiment_config.wandb_entity,
            save_dir=config.experiment_config.logs_dir
        )
        loggers.append(wandb_logger)
    
    # TensorBoard logger
    tb_logger = TensorBoardLogger(
        save_dir=config.experiment_config.logs_dir,
        name=experiment_name
    )
    loggers.append(tb_logger)
    
    return loggers

def setup_callbacks(config, experiment_name: str):
    """Setup training callbacks."""
    callbacks = []
    
    # Model checkpoint
    checkpoint_callback = ModelCheckpoint(
        dirpath=f"{config.experiment_config.output_dir}/checkpoints/{experiment_name}",
        filename="{epoch:02d}-{val_loss:.4f}",
        monitor="val_loss",
        mode="min",
        save_top_k=3,
        save_last=True,
        every_n_epochs=1
    )
    callbacks.append(checkpoint_callback)
    
    # Early stopping
    early_stop_callback = EarlyStopping(
        monitor="val_loss",
        patience=config.training_config.early_stopping_patience,
        mode="min",
        min_delta=config.training_config.early_stopping_threshold,
        verbose=True
    )
    callbacks.append(early_stop_callback)
    
    # Learning rate monitor
    lr_monitor = LearningRateMonitor(
        logging_interval='step',
        log_momentum=True
    )
    callbacks.append(lr_monitor)
    
    return callbacks

def train_subject_with_monitoring(
    subject: str,
    use_sample_data: bool = False,
    experiment_suffix: str = ""
):
    """Train a subject model with comprehensive monitoring."""
    
    # Create experiment name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    experiment_name = f"{subject}_{timestamp}{experiment_suffix}"
    
    logger.info(f"Starting training experiment: {experiment_name}")
    
    # Get configuration
    config = get_config(subject)
    
    # Setup directories
    os.makedirs(config.experiment_config.output_dir, exist_ok=True)
    os.makedirs(config.experiment_config.logs_dir, exist_ok=True)
    
    # Initialize monitoring
    monitor = TrainingMonitor(experiment_name)
    monitor.start_monitoring()
    
    try:
        # Initialize tokenizer
        tokenizer = AutoTokenizer.from_pretrained(config.model_config.model_name)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # Create dataset manager
        dataset_manager = SubjectDatasetManager(
            tokenizer=tokenizer,
            data_config=config.data_config.__dict__
        )
        
        # Create datasets
        data_path = f"datasets/{subject}" if use_sample_data else config.data_config.data_dir
        
        train_dataset = dataset_manager.create_dataset(
            subject=subject,
            data_path=data_path,
            split="train"
        )
        
        val_dataset = dataset_manager.create_dataset(
            subject=subject,
            data_path=data_path,
            split="val"
        )
        
        # Create dataloaders
        train_dataloader = dataset_manager.get_dataloader(
            subject=subject,
            split="train",
            batch_size=config.training_config.batch_size,
            shuffle=True
        )
        
        val_dataloader = dataset_manager.get_dataloader(
            subject=subject,
            split="val",
            batch_size=config.training_config.batch_size,
            shuffle=False
        )
        
        logger.info(f"Dataset sizes - Train: {len(train_dataset)}, Val: {len(val_dataset)}")
        
        # Initialize model with Unsloth
        model = UnslothTrainer(config)
        
        # Setup loggers and callbacks
        loggers = setup_experiment_logging(config, experiment_name)
        callbacks = setup_callbacks(config, experiment_name)
        
        # Initialize trainer
        trainer = pl.Trainer(
            max_epochs=config.training_config.num_epochs,
            callbacks=callbacks,
            logger=loggers,
            accelerator="auto",
            devices="auto",
            precision=config.experiment_config.mixed_precision,
            gradient_clip_val=config.training_config.max_grad_norm,
            accumulate_grad_batches=config.training_config.gradient_accumulation_steps,
            val_check_interval=config.training_config.eval_steps,
            log_every_n_steps=config.training_config.logging_steps,
            enable_checkpointing=True,
            enable_progress_bar=True,
            deterministic=False,  # For better performance
            benchmark=True  # Optimize for consistent input sizes
        )
        
        # Log system information
        logger.info("=== SYSTEM INFORMATION ===")
        logger.info(f"PyTorch version: {torch.__version__}")
        logger.info(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            logger.info(f"CUDA devices: {torch.cuda.device_count()}")
            logger.info(f"Current device: {torch.cuda.current_device()}")
        logger.info(f"Unsloth available: {unsloth_integration.unsloth_available}")
        
        # Start training
        logger.info("Starting training...")
        trainer.fit(
            model=model,
            train_dataloaders=train_dataloader,
            val_dataloaders=val_dataloader
        )
        
        # Save final model
        model_save_path = f"{config.experiment_config.model_save_dir}/{experiment_name}"
        os.makedirs(model_save_path, exist_ok=True)
        
        # Save using Unsloth if available
        unsloth_integration.save_unsloth_model(
            model.model.model,
            model.model.tokenizer,
            model_save_path,
            save_method="merged_16bit"
        )
        
        logger.info(f"Model saved to: {model_save_path}")
        
        # Update final metrics
        if trainer.callback_metrics:
            final_train_loss = trainer.callback_metrics.get('train_loss', 0)
            best_val_loss = trainer.callback_metrics.get('val_loss', float('inf'))
            monitor.update_metrics(
                step=trainer.global_step,
                train_loss=float(final_train_loss),
                val_loss=float(best_val_loss)
            )
        
        # Finish monitoring
        monitor.finish_monitoring()
        
        # Save metrics
        metrics_file = f"{config.experiment_config.logs_dir}/{experiment_name}_metrics.json"
        monitor.save_metrics(metrics_file)
        
        logger.info(f"Training completed successfully for {subject}")
        return True, experiment_name
        
    except Exception as e:
        logger.error(f"Training failed for {subject}: {e}")
        monitor.finish_monitoring()
        return False, experiment_name

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Train subject-specific models with monitoring")
    
    parser.add_argument(
        "--subject",
        type=str,
        choices=get_all_subjects() + ["all"],
        default="mathematics",
        help="Subject to train (default: mathematics)"
    )
    
    parser.add_argument(
        "--use-sample-data",
        action="store_true",
        help="Use generated sample data for training"
    )
    
    parser.add_argument(
        "--experiment-suffix",
        type=str,
        default="",
        help="Suffix for experiment name"
    )
    
    args = parser.parse_args()
    
    if args.subject == "all":
        subjects = get_all_subjects()
        results = {}
        
        for subject in subjects:
            logger.info(f"\n{'='*60}")
            logger.info(f"Training {subject.upper()} model")
            logger.info(f"{'='*60}")
            
            success, experiment_name = train_subject_with_monitoring(
                subject=subject,
                use_sample_data=args.use_sample_data,
                experiment_suffix=args.experiment_suffix
            )
            
            results[subject] = {"success": success, "experiment": experiment_name}
        
        # Summary
        logger.info(f"\n{'='*60}")
        logger.info("TRAINING SUMMARY")
        logger.info(f"{'='*60}")
        
        for subject, result in results.items():
            status = "✅" if result["success"] else "❌"
            logger.info(f"{status} {subject}: {result['experiment']}")
    
    else:
        train_subject_with_monitoring(
            subject=args.subject,
            use_sample_data=args.use_sample_data,
            experiment_suffix=args.experiment_suffix
        )

if __name__ == "__main__":
    main()
