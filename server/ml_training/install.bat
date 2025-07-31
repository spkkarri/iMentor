@echo off
REM Installation script for ML Training Infrastructure (Windows)
REM This script sets up the PyTorch Lightning training environment

echo 🚀 Setting up ML Training Infrastructure...

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is required but not installed.
    pause
    exit /b 1
)

echo ✅ Python detected

REM Create virtual environment if it doesn't exist
if not exist "ml_env" (
    echo 📦 Creating virtual environment...
    python -m venv ml_env
)

REM Activate virtual environment
echo 🔄 Activating virtual environment...
call ml_env\Scripts\activate.bat

REM Upgrade pip
echo ⬆️ Upgrading pip...
python -m pip install --upgrade pip

REM Check for NVIDIA GPU
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo 💻 No NVIDIA GPU detected, installing CPU-only PyTorch...
    pip install torch torchvision torchaudio
) else (
    echo 🎮 NVIDIA GPU detected, installing PyTorch with CUDA support...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
)

REM Install other requirements
echo 📚 Installing other requirements...
pip install -r requirements.txt

REM Install Unsloth (if available)
echo ⚡ Attempting to install Unsloth...
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
if errorlevel 1 (
    echo ⚠️ Unsloth installation failed. This is optional and training can proceed without it.
)

REM Create necessary directories
echo 📁 Creating directories...
if not exist "datasets" mkdir datasets
if not exist "experiments" mkdir experiments
if not exist "models" mkdir models
if not exist "logs" mkdir logs
if not exist "checkpoints" mkdir checkpoints

REM Create sample datasets
echo 📊 Creating sample datasets...
python scripts\train_subject_model.py --create-sample-data

REM Test installation
echo 🧪 Testing installation...
python -c "import torch; import pytorch_lightning as pl; import transformers; print(f'✅ PyTorch: {torch.__version__}'); print(f'✅ PyTorch Lightning: {pl.__version__}'); print(f'✅ Transformers: {transformers.__version__}'); print(f'✅ CUDA available: {torch.cuda.is_available()}'); print(f'✅ CUDA devices: {torch.cuda.device_count()}' if torch.cuda.is_available() else '')"

echo.
echo 🎉 Installation completed successfully!
echo.
echo 📋 Next steps:
echo 1. Activate the environment: ml_env\Scripts\activate.bat
echo 2. Configure your training settings in configs\base_config.py
echo 3. Add your training data to the datasets\ directory
echo 4. Start training: python scripts\train_subject_model.py --subject mathematics
echo.
echo 📖 For more information, see the README.md file

pause
