"""
Base configuration for ML training infrastructure.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from pathlib import Path

@dataclass
class ModelConfig:
    """Configuration for model architecture."""
    model_name: str = "microsoft/DialoGPT-small"  # Base model for fine-tuning
    model_size: str = "1B"  # Model size: 1B, 3B, 7B
    max_length: int = 512
    vocab_size: int = 50257
    hidden_size: int = 768
    num_attention_heads: int = 12
    num_hidden_layers: int = 12
    dropout: float = 0.1
    use_lora: bool = True
    lora_rank: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.1
    target_modules: List[str] = field(default_factory=lambda: ["q_proj", "v_proj"])

    # Advanced training options
    base_model_id: Optional[str] = None  # ID of base model to start from
    checkpoint_path: Optional[str] = None  # Path to checkpoint to resume from
    transfer_from_subject: Optional[str] = None  # Subject to transfer from
    training_mode: str = "fine_tune"  # "fine_tune", "resume", "transfer", "retrain"

@dataclass
class TrainingConfig:
    """Configuration for training parameters."""
    # Training hyperparameters
    learning_rate: float = 5e-5
    batch_size: int = 8
    gradient_accumulation_steps: int = 4
    num_epochs: int = 3
    warmup_steps: int = 500
    weight_decay: float = 0.01
    max_grad_norm: float = 1.0

    # Optimization
    optimizer: str = "adamw"
    scheduler: str = "cosine"
    fp16: bool = True
    gradient_checkpointing: bool = True

    # Unsloth specific
    use_unsloth: bool = True
    unsloth_max_seq_length: int = 2048
    unsloth_dtype: str = "float16"
    unsloth_load_in_4bit: bool = True

    # Advanced training options
    resume_from_checkpoint: bool = False
    checkpoint_path: Optional[str] = None
    save_checkpoint_every: int = 500  # Save checkpoint every N steps
    max_checkpoints_to_keep: int = 3
    transfer_learning_rate: float = 1e-5  # Lower LR for transfer learning
    freeze_base_layers: bool = False  # Freeze base model layers for transfer
    progressive_unfreezing: bool = False  # Gradually unfreeze layers
    
    # Validation
    eval_steps: int = 500
    save_steps: int = 1000
    logging_steps: int = 100
    eval_strategy: str = "steps"
    save_strategy: str = "steps"
    
    # Early stopping
    early_stopping_patience: int = 3
    early_stopping_threshold: float = 0.001

@dataclass
class DataConfig:
    """Configuration for dataset and preprocessing."""
    # Dataset paths
    data_dir: str = "datasets"
    train_file: str = "train.jsonl"
    val_file: str = "val.jsonl"
    test_file: str = "test.jsonl"
    
    # Preprocessing
    max_input_length: int = 512
    max_target_length: int = 512
    truncation: bool = True
    padding: str = "max_length"
    
    # Data augmentation
    use_augmentation: bool = False
    augmentation_prob: float = 0.1
    
    # Subject-specific
    subject_domain: str = "general"
    domain_keywords: List[str] = field(default_factory=list)

@dataclass
class ExperimentConfig:
    """Configuration for experiment tracking."""
    # Experiment details
    experiment_name: str = "subject_specific_training"
    run_name: Optional[str] = None
    project_name: str = "chatbot_specialized_models"
    
    # Logging
    use_wandb: bool = True
    wandb_entity: Optional[str] = None
    log_model: bool = True
    
    # Output directories
    output_dir: str = "experiments"
    model_save_dir: str = "models"
    logs_dir: str = "logs"
    
    # Hardware
    device: str = "auto"  # auto, cpu, cuda
    num_gpus: int = 1
    mixed_precision: str = "fp16"

@dataclass
class SubjectConfig:
    """Configuration for subject-specific training."""
    subject_name: str
    keywords: List[str]
    dataset_path: str
    model_config: ModelConfig
    training_config: TrainingConfig
    data_config: DataConfig
    
    def __post_init__(self):
        """Update configurations based on subject."""
        self.data_config.subject_domain = self.subject_name
        self.data_config.domain_keywords = self.keywords

# Subject-specific configurations
SUBJECT_CONFIGS = {
    "mathematics": SubjectConfig(
        subject_name="mathematics",
        keywords=["math", "equation", "formula", "calculate", "solve", "algebra", 
                 "geometry", "calculus", "statistics", "probability", "theorem"],
        dataset_path="datasets/mathematics",
        model_config=ModelConfig(model_size="3B"),
        training_config=TrainingConfig(learning_rate=3e-5, num_epochs=5),
        data_config=DataConfig(subject_domain="mathematics")
    ),
    
    "science": SubjectConfig(
        subject_name="science",
        keywords=["physics", "chemistry", "biology", "experiment", "hypothesis",
                 "theory", "molecule", "atom", "cell", "energy", "force"],
        dataset_path="datasets/science",
        model_config=ModelConfig(model_size="3B"),
        training_config=TrainingConfig(learning_rate=3e-5, num_epochs=4),
        data_config=DataConfig(subject_domain="science")
    ),
    
    "programming": SubjectConfig(
        subject_name="programming",
        keywords=["code", "programming", "function", "variable", "algorithm",
                 "debug", "syntax", "python", "javascript", "java", "c++"],
        dataset_path="datasets/programming",
        model_config=ModelConfig(model_size="3B"),
        training_config=TrainingConfig(learning_rate=2e-5, num_epochs=4),
        data_config=DataConfig(subject_domain="programming")
    ),
    
    "history": SubjectConfig(
        subject_name="history",
        keywords=["history", "historical", "ancient", "medieval", "war",
                 "civilization", "empire", "revolution", "century", "era"],
        dataset_path="datasets/history",
        model_config=ModelConfig(model_size="1B"),
        training_config=TrainingConfig(learning_rate=4e-5, num_epochs=3),
        data_config=DataConfig(subject_domain="history")
    ),
    
    "literature": SubjectConfig(
        subject_name="literature",
        keywords=["literature", "poetry", "novel", "author", "character",
                 "plot", "theme", "metaphor", "symbolism", "genre"],
        dataset_path="datasets/literature",
        model_config=ModelConfig(model_size="1B"),
        training_config=TrainingConfig(learning_rate=4e-5, num_epochs=3),
        data_config=DataConfig(subject_domain="literature")
    )
}

def get_config(subject: str) -> SubjectConfig:
    """Get configuration for a specific subject."""
    if subject not in SUBJECT_CONFIGS:
        raise ValueError(f"Unknown subject: {subject}. Available: {list(SUBJECT_CONFIGS.keys())}")
    return SUBJECT_CONFIGS[subject]

def get_all_subjects() -> List[str]:
    """Get list of all available subjects."""
    return list(SUBJECT_CONFIGS.keys())
