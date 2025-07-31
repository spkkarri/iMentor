# 🧠 LLM Training Dashboard Guide

## Overview

Your chatbot now has a dedicated **LLM Training Dashboard** that allows you to train specialized subject-specific language models without affecting the existing chat functionality.

## 🚀 How to Access

### Method 1: Navigation Button
1. Go to your chatbot at `http://localhost:3004`
2. Login to your account
3. Click the **🧠 Brain icon** in the top-right header
4. You'll be redirected to the Training Dashboard

### Method 2: Direct URL
- Navigate directly to: `http://localhost:3004/training`

## 📊 Training Dashboard Features

### 1. **Training Configuration Panel**
- **Subject Domain**: Choose from 5 specialized subjects:
  - 📚 Mathematics (Arithmetic, algebra, geometry, calculus)
  - 💻 Programming (Coding, algorithms, software development)
  - 🔬 Science (Physics, chemistry, biology)
  - 📜 History (Historical events, civilizations)
  - 📖 Literature (Books, poetry, literary analysis)

- **Model Size**: Select parameter count:
  - 1B Parameters (Fastest training, good for testing)
  - 3B Parameters (Balanced performance/speed)
  - 7B Parameters (Best quality, slower training)

- **Training Parameters**:
  - Epochs: 1-10 (number of training cycles)
  - Batch Size: 1-16 (training batch size)
  - Learning Rate: Fine-tune learning speed

- **Advanced Options**:
  - ✅ **Use Unsloth**: Memory-efficient training (recommended)
  - ✅ **Use LoRA**: Low-Rank Adaptation for faster fine-tuning

### 2. **Training Status Panel**
- Real-time training status indicator
- Live training logs with timestamps
- Progress tracking and monitoring

### 3. **Trained Models Panel**
- View all your trained models
- Download trained models as ZIP files
- Model performance metrics and creation dates

## 🛠️ Training Infrastructure

### Backend Components
Your system includes a complete PyTorch Lightning-based training infrastructure:

```
server/ml_training/
├── trainers/           # PyTorch Lightning trainers
├── models/            # Model definitions (1B-7B parameters)
├── datasets/          # Subject-specific datasets
├── configs/           # Training configurations
├── utils/             # Training utilities
├── scripts/           # Training and evaluation scripts
└── experiments/       # Experiment tracking
```

### Key Features
- **Unsloth Integration**: Memory-efficient fine-tuning
- **LoRA Support**: Low-Rank Adaptation for faster training
- **Multi-Subject Training**: Specialized models for each domain
- **Experiment Tracking**: Weights & Biases integration
- **Model Versioning**: Automatic model saving and management

## 🎯 How to Train Models

### Step 1: Configure Training
1. Select your desired subject (e.g., Mathematics)
2. Choose model size (start with 1B for testing)
3. Set training parameters:
   - Epochs: 3 (good starting point)
   - Batch Size: 4 (adjust based on GPU memory)
   - Learning Rate: 2e-4 (default works well)
4. Enable Unsloth and LoRA for efficiency

### Step 2: Start Training
1. Click **🚀 Start Training**
2. Monitor the status panel for progress
3. Watch training logs for detailed information
4. Training will show progress through different phases:
   - Loading dataset
   - Model initialization
   - Training epochs
   - Model saving

### Step 3: Monitor Progress
- Status indicator shows current training state
- Logs provide detailed training information
- Progress updates every few seconds
- Training typically takes 10-30 minutes depending on configuration

### Step 4: Use Trained Models
1. Once training completes, models appear in the "Trained Models" panel
2. Download models as ZIP files for deployment
3. Models are automatically integrated into your chatbot system
4. Subject-specific queries will use the appropriate trained model

## 🔧 Technical Details

### API Endpoints
The training system exposes these REST API endpoints:

- `GET /api/training/status` - Get current training status
- `POST /api/training/start` - Start training with configuration
- `POST /api/training/stop` - Stop current training
- `GET /api/training/progress` - Get training progress and logs
- `GET /api/training/models` - List all trained models
- `GET /api/training/download/:modelId` - Download trained model

### Training Script
The actual training is handled by:
```bash
python server/ml_training/scripts/train_subject_model.py \
  --subject mathematics \
  --model-size 1B \
  --epochs 3 \
  --batch-size 4 \
  --learning-rate 2e-4 \
  --use-unsloth \
  --use-lora
```

### Model Storage
- Trained models are saved in `server/ml_training/models/`
- Model checkpoints in `server/ml_training/checkpoints/`
- Training logs in `server/ml_training/logs/`

## 🎨 UI Features

### Design
- Beautiful gradient background with glassmorphism effects
- Responsive design that works on desktop and mobile
- Real-time status updates with animated indicators
- Professional training logs with monospace font

### Navigation
- **Back to Chat** button to return to main chatbot
- **🧠 Training** button in chat header to access dashboard
- Seamless integration without affecting existing functionality

## 🚀 Getting Started

1. **Access the Dashboard**: Click the 🧠 icon in your chatbot
2. **Start Simple**: Begin with Mathematics, 1B parameters, 3 epochs
3. **Monitor Training**: Watch the logs and status indicators
4. **Download Results**: Get your trained model when complete
5. **Scale Up**: Try larger models and different subjects

## 💡 Tips for Success

- **Start Small**: Use 1B parameters for initial testing
- **Use Unsloth**: Always enable for memory efficiency
- **Monitor Logs**: Watch for any error messages
- **Be Patient**: Training can take 10-30 minutes
- **Experiment**: Try different subjects and configurations

## 🔄 Integration with Existing System

The training dashboard is completely separate from your existing chatbot functionality:
- ✅ No impact on current chat features
- ✅ Independent routing and components
- ✅ Separate API endpoints
- ✅ Isolated training processes
- ✅ Easy navigation between chat and training

Your chatbot continues to work normally while you train new models in the background!

## 🎉 Ready to Train!

Your LLM Training Dashboard is now fully set up and ready to use. Start training your first specialized model today!

Navigate to: `http://localhost:3004/training`
