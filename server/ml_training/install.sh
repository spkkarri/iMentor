#!/bin/bash

# Installation script for ML Training Infrastructure
# This script sets up the PyTorch Lightning training environment

set -e  # Exit on any error

echo "🚀 Setting up ML Training Infrastructure..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check Python version (require 3.8+)
python_version=$(python3 -c "import sys; print('.'.join(map(str, sys.version_info[:2])))")
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.8+ is required. Current version: $python_version"
    exit 1
fi

echo "✅ Python $python_version detected"

# Create virtual environment if it doesn't exist
if [ ! -d "ml_env" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv ml_env
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source ml_env/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install PyTorch (with CUDA support if available)
echo "🔥 Installing PyTorch..."
if command -v nvidia-smi &> /dev/null; then
    echo "🎮 NVIDIA GPU detected, installing PyTorch with CUDA support..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
else
    echo "💻 No NVIDIA GPU detected, installing CPU-only PyTorch..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# Install other requirements
echo "📚 Installing other requirements..."
pip install -r requirements.txt

# Install Unsloth (if available)
echo "⚡ Attempting to install Unsloth..."
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git" || {
    echo "⚠️ Unsloth installation failed. This is optional and training can proceed without it."
}

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p datasets
mkdir -p experiments
mkdir -p models
mkdir -p logs
mkdir -p checkpoints

# Create sample datasets
echo "📊 Creating sample datasets..."
python3 scripts/train_subject_model.py --create-sample-data

# Test installation
echo "🧪 Testing installation..."
python3 -c "
import torch
import pytorch_lightning as pl
import transformers
print(f'✅ PyTorch: {torch.__version__}')
print(f'✅ PyTorch Lightning: {pl.__version__}')
print(f'✅ Transformers: {transformers.__version__}')
print(f'✅ CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'✅ CUDA devices: {torch.cuda.device_count()}')
"

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Activate the environment: source ml_env/bin/activate"
echo "2. Configure your training settings in configs/base_config.py"
echo "3. Add your training data to the datasets/ directory"
echo "4. Start training: python3 scripts/train_subject_model.py --subject mathematics"
echo ""
echo "📖 For more information, see the README.md file"
