#!/usr/bin/env python3
"""
Training script for subject-specific LLM models.
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from configs.base_config import get_config, get_all_subjects
from trainers.subject_trainer import TrainingManager
from datasets.subject_dataset import SubjectDatasetManager, save_sample_data
from models.lightweight_llm import create_model_for_subject
from transformers import AutoTokenizer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_directories(config):
    """Setup necessary directories for training."""
    directories = [
        config.experiment_config.output_dir,
        config.experiment_config.model_save_dir,
        config.experiment_config.logs_dir,
        f"{config.experiment_config.output_dir}/checkpoints/{config.subject_name}",
        f"datasets/{config.subject_name}"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        logger.info(f"Created directory: {directory}")

def prepare_sample_data(subject: str, force_recreate: bool = False):
    """Prepare sample training data if it doesn't exist."""
    data_dir = f"datasets/{subject}"
    train_file = os.path.join(data_dir, "train.jsonl")
    
    if not os.path.exists(train_file) or force_recreate:
        logger.info(f"Creating sample data for {subject}")
        save_sample_data(subject, data_dir, num_samples=1000)
    else:
        logger.info(f"Sample data already exists for {subject}")

def train_subject_model(subject: str, use_sample_data: bool = False):
    """Train a model for a specific subject."""
    logger.info(f"Starting training for subject: {subject}")
    
    # Get configuration
    config = get_config(subject)
    
    # Setup directories
    setup_directories(config)
    
    # Prepare data if using sample data
    if use_sample_data:
        prepare_sample_data(subject)
    
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
    
    try:
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
        
        logger.info(f"Train dataset size: {len(train_dataset)}")
        logger.info(f"Validation dataset size: {len(val_dataset)}")
        
    except Exception as e:
        logger.error(f"Failed to create datasets: {e}")
        return False
    
    # Initialize training manager
    training_manager = TrainingManager(config)
    
    try:
        # Train the model
        trained_model = training_manager.train(train_dataloader, val_dataloader)
        
        # Save the model
        model_save_path = f"{config.experiment_config.model_save_dir}/{subject}_model"
        training_manager.save_model(model_save_path)
        
        logger.info(f"Training completed successfully for {subject}")
        logger.info(f"Model saved to: {model_save_path}")
        
        return True
        
    except Exception as e:
        logger.error(f"Training failed for {subject}: {e}")
        return False

def train_all_subjects(use_sample_data: bool = False):
    """Train models for all available subjects."""
    subjects = get_all_subjects()
    results = {}
    
    logger.info(f"Training models for {len(subjects)} subjects: {subjects}")
    
    for subject in subjects:
        logger.info(f"\n{'='*50}")
        logger.info(f"Training {subject.upper()} model")
        logger.info(f"{'='*50}")
        
        success = train_subject_model(subject, use_sample_data)
        results[subject] = success
        
        if success:
            logger.info(f"✅ {subject} model training completed")
        else:
            logger.error(f"❌ {subject} model training failed")
    
    # Summary
    logger.info(f"\n{'='*50}")
    logger.info("TRAINING SUMMARY")
    logger.info(f"{'='*50}")
    
    successful = [s for s, success in results.items() if success]
    failed = [s for s, success in results.items() if not success]
    
    logger.info(f"Successful: {len(successful)}/{len(subjects)}")
    if successful:
        logger.info(f"✅ {', '.join(successful)}")
    
    if failed:
        logger.info(f"❌ Failed: {', '.join(failed)}")
    
    return results

def evaluate_model(subject: str, model_path: str):
    """Evaluate a trained model."""
    logger.info(f"Evaluating {subject} model from {model_path}")
    
    # Get configuration
    config = get_config(subject)
    
    # Initialize tokenizer
    tokenizer = AutoTokenizer.from_pretrained(config.model_config.model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load model
    try:
        model = create_model_for_subject(
            subject=subject,
            model_name=config.model_config.model_name,
            use_unsloth=config.training_config.use_unsloth
        )
        model.load_pretrained(model_path)
        logger.info(f"Model loaded successfully from {model_path}")
        
        # TODO: Add evaluation logic here
        # This could include:
        # - Running on test dataset
        # - Generating sample responses
        # - Computing metrics (BLEU, ROUGE, perplexity)
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return False
    
    return True

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Train subject-specific LLM models")
    
    parser.add_argument(
        "--subject",
        type=str,
        choices=get_all_subjects() + ["all"],
        default="all",
        help="Subject to train (default: all)"
    )
    
    parser.add_argument(
        "--use-sample-data",
        action="store_true",
        help="Use generated sample data for training"
    )
    
    parser.add_argument(
        "--evaluate",
        type=str,
        help="Path to model for evaluation"
    )
    
    parser.add_argument(
        "--create-sample-data",
        action="store_true",
        help="Only create sample data without training"
    )
    
    args = parser.parse_args()
    
    # Create sample data only
    if args.create_sample_data:
        subjects = get_all_subjects() if args.subject == "all" else [args.subject]
        for subject in subjects:
            prepare_sample_data(subject, force_recreate=True)
        return
    
    # Evaluation mode
    if args.evaluate:
        if args.subject == "all":
            logger.error("Cannot evaluate all subjects. Please specify a single subject.")
            return
        evaluate_model(args.subject, args.evaluate)
        return
    
    # Training mode
    if args.subject == "all":
        train_all_subjects(args.use_sample_data)
    else:
        train_subject_model(args.subject, args.use_sample_data)

if __name__ == "__main__":
    main()
