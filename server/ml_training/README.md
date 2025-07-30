# ML Training Infrastructure

This directory contains the PyTorch Lightning-based training infrastructure for specialized subject-specific LLM models.

## Directory Structure

```
ml_training/
├── trainers/           # PyTorch Lightning trainers
├── models/            # Model definitions and architectures
├── datasets/          # Dataset management and preprocessing
├── configs/           # Training configurations
├── utils/             # Training utilities and helpers
├── scripts/           # Training and evaluation scripts
└── experiments/       # Experiment tracking and results
```

## Key Components

### Trainers
- **SubjectSpecificTrainer**: Main PyTorch Lightning trainer for domain-specific models
- **UnslothTrainer**: Optimized trainer using Unsloth for memory efficiency
- **MultiTaskTrainer**: Trainer for multi-domain models

### Models
- **LightweightLLM**: Base architecture for 1B-7B parameter models
- **SubjectAdapterModel**: Domain-specific adapter layers
- **LoRAModel**: Low-Rank Adaptation implementations

### Datasets
- **SubjectDatasetManager**: Handles domain-specific dataset loading
- **DataPreprocessor**: Text preprocessing and tokenization
- **DataAugmentation**: Data augmentation techniques

### Configuration
- **TrainingConfig**: Training hyperparameters and settings
- **ModelConfig**: Model architecture configurations
- **DataConfig**: Dataset and preprocessing configurations

## Usage

1. **Setup Environment**: Install dependencies and configure paths
2. **Prepare Data**: Process and format domain-specific datasets
3. **Configure Training**: Set up training parameters and model configs
4. **Train Models**: Run training scripts for each subject domain
5. **Evaluate**: Test model performance and accuracy
6. **Deploy**: Export trained models for inference

## Integration with Unsloth

Unsloth is integrated for:
- Memory-efficient fine-tuning
- Faster training with optimized kernels
- Reduced GPU memory usage
- Support for larger models on limited hardware

## Experiment Tracking

Uses Weights & Biases (wandb) for:
- Training metrics logging
- Hyperparameter tracking
- Model versioning
- Experiment comparison
