# Multi-Model LLM System - Complete Guide

This guide covers the complete multi-model LLM system that enhances the chatbot with specialized models for different subjects.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP Requests
┌─────────────────────▼───────────────────────────────────────┐
│                Node.js Server                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Enhanced Deep   │  │ Multi-Model     │  │ Service      │ │
│  │ Search Service  │  │ Service         │  │ Manager      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │ Python API Calls
┌─────────────────────▼───────────────────────────────────────┐
│                Python ML Backend                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Query           │  │ Model           │  │ Specialized  │ │
│  │ Classifier      │  │ Manager         │  │ Models       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Installation

Run the automated setup script:
```bash
cd server
node scripts/setup-multi-model.js
```

Or install manually:
```bash
# Install Python dependencies
cd server/ml_training
pip install -r requirements.txt

# Install Node.js dependencies (if not already done)
cd ..
npm install

# Create sample datasets
cd ml_training
python scripts/prepare_datasets.py --action create
```

### 2. Start the System

```bash
cd server
npm start
```

The system will automatically:
- Initialize the multi-model service
- Start the Python ML backend
- Enable enhanced deep search functionality

### 3. Test the System

```bash
# Test query classification
curl -X POST http://localhost:3005/api/multi-model/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "What is 2 + 2?"}'

# Test query processing
curl -X POST http://localhost:3005/api/multi-model/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "Explain photosynthesis"}'
```

## 📊 Supported Subjects

| Subject | Model Focus | Example Queries |
|---------|-------------|-----------------|
| **Mathematics** | Arithmetic, algebra, calculus, statistics | "What is 15 + 27?", "Solve x² + 5x + 6 = 0" |
| **Programming** | Coding, algorithms, debugging | "How to create a Python function?", "Explain binary search" |
| **Science** | Physics, chemistry, biology | "What is photosynthesis?", "Explain Newton's laws" |
| **History** | Historical events, dates, figures | "When did WWII end?", "Who was Napoleon?" |
| **Literature** | Books, poetry, literary analysis | "Who wrote Hamlet?", "What is a metaphor?" |

## 🔧 Configuration

### Environment Variables

Add to your `.env` file:
```env
# Multi-Model Configuration
USE_ENHANCED_SEARCH=true
ML_SERVICE_PORT=8001
MAX_MODELS_IN_MEMORY=2
MODEL_CACHE_SIZE_GB=4
PRELOAD_MODELS=mathematics,programming

# Training Configuration
WANDB_API_KEY=your_wandb_key_here
ENABLE_MODEL_TRAINING=true
```

### Service Configuration

Edit `server/ml_training/config.json`:
```json
{
  "max_models_in_memory": 2,
  "max_memory_usage_mb": 4096,
  "model_idle_timeout": 1800,
  "preload_models": ["mathematics", "programming"],
  "memory_check_interval": 60,
  "enable_model_caching": true,
  "cache_directory": "../model_cache"
}
```

## 🎯 API Reference

### Query Processing

**POST** `/api/multi-model/query`

Process a query using specialized models:

```javascript
const response = await fetch('/api/multi-model/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: "What is the derivative of x²?",
    options: {
      maxLength: 200,
      temperature: 0.7
    }
  })
});

const result = await response.json();
// {
//   "success": true,
//   "data": {
//     "response": "The derivative of x² is 2x...",
//     "model_used": "mathematics",
//     "confidence": 0.95,
//     "processing_time": 0.234
//   }
// }
```

### Query Classification

**POST** `/api/multi-model/classify`

Classify a query to determine its subject:

```javascript
const classification = await fetch('/api/multi-model/classify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: "How do you implement quicksort?"
  })
});

const result = await classification.json();
// {
//   "success": true,
//   "data": {
//     "subject": "programming",
//     "confidence": 0.87,
//     "scores": {
//       "programming": 0.87,
//       "mathematics": 0.13,
//       "science": 0.05
//     }
//   }
// }
```

### Service Status

**GET** `/api/multi-model/status`

Get comprehensive service status:

```javascript
const status = await fetch('/api/multi-model/status', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const result = await status.json();
// {
//   "success": true,
//   "data": {
//     "enhancedSearchEnabled": true,
//     "multiModelService": {
//       "running": true,
//       "models_loaded": 2,
//       "uptime_seconds": 3600
//     }
//   }
// }
```

## 🏋️ Training Custom Models

### 1. Prepare Your Dataset

Create a JSONL file with your training data:
```json
{"input": "What is machine learning?", "target": "Machine learning is a subset of AI...", "category": "ai", "difficulty": "beginner"}
{"input": "Explain neural networks", "target": "Neural networks are computing systems...", "category": "ai", "difficulty": "intermediate"}
```

### 2. Configure Training

Create a subject configuration in `ml_training/configs/base_config.py`:
```python
def get_ai_config():
    return SubjectConfig(
        subject_name="ai",
        model_config=ModelConfig(
            model_name="microsoft/DialoGPT-small",
            use_lora=True,
            lora_rank=16
        ),
        training_config=TrainingConfig(
            learning_rate=5e-5,
            batch_size=8,
            num_epochs=3
        ),
        data_config=DataConfig(
            data_dir="datasets/ai",
            max_length=512
        )
    )
```

### 3. Train the Model

```bash
cd server/ml_training

# Prepare the dataset
python scripts/prepare_datasets.py --subject ai --action create

# Train the model
python scripts/train_subject_model.py --subject ai --use-sample-data

# Monitor training with enhanced monitoring
python scripts/train_with_monitoring.py --subject ai
```

### 4. Evaluate the Model

```bash
# Test the trained model
python scripts/evaluate_model.py --subject ai --model-path models/ai_model

# Benchmark performance
python scripts/benchmark_models.py --subject ai
```

## 🔍 Monitoring and Debugging

### Health Checks

```bash
# Quick health check
curl http://localhost:3005/api/multi-model/health

# Detailed status
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3005/api/multi-model/status
```

### Training Monitoring

The system integrates with Weights & Biases for comprehensive monitoring:

1. **Set up W&B account** and get API key
2. **Add to environment**: `WANDB_API_KEY=your_key_here`
3. **View training metrics** at https://wandb.ai

### Debug Classification

```bash
# Test classification accuracy
cd server/ml_inference
python scripts/test_classification.py

# Test with custom queries
python -c "
from query_classifier.embedding_classifier import HybridEmbeddingClassifier
classifier = HybridEmbeddingClassifier(['math', 'programming', 'science'])
result = classifier.classify('How do you solve quadratic equations?')
print(f'Subject: {result.predicted_subject}, Confidence: {result.confidence}')
"
```

## 🚀 Performance Optimization

### Memory Management

The system automatically manages memory through:
- **Dynamic Loading**: Models loaded on-demand
- **LRU Eviction**: Automatic unloading of unused models
- **Memory Monitoring**: Continuous memory usage tracking
- **Smart Caching**: Intelligent model caching for faster access

### Training Optimizations

- **LoRA Adapters**: Efficient fine-tuning with 0.1% of parameters
- **Unsloth Integration**: 2x faster training and inference
- **Mixed Precision**: FP16 training for memory efficiency
- **Gradient Checkpointing**: Reduced memory usage

### Inference Optimizations

- **Model Compilation**: PyTorch 2.0 compile for speed
- **Quantization**: 4-bit quantization for memory reduction
- **Batch Processing**: Efficient multi-query handling
- **Smart Routing**: Optimal model selection

## 🔧 Troubleshooting

### Common Issues

**1. Python Service Won't Start**
```bash
# Check Python dependencies
pip list | grep -E "(torch|transformers|fastapi)"

# Test Python service manually
cd server/ml_inference
python api_server.py --port 8001
```

**2. Models Not Loading**
```bash
# Check model directory
ls -la server/models/

# Check memory usage
python -c "import psutil; print(f'Memory: {psutil.virtual_memory().percent}%')"

# Check GPU memory (if available)
nvidia-smi
```

**3. Classification Not Working**
```bash
# Test classification directly
cd server/ml_inference
python -c "
from query_classifier.base_classifier import KeywordClassifier
classifier = KeywordClassifier(['math', 'programming'])
result = classifier.classify('What is 2+2?')
print(result.predicted_subject)
"
```

**4. Low Performance**
- Reduce `max_models_in_memory` in config
- Enable model caching
- Use smaller models for testing
- Check system resources

### Logs and Debugging

```bash
# View Node.js logs
npm start 2>&1 | tee server.log

# View Python service logs
cd server/ml_inference
python api_server.py 2>&1 | tee ml_service.log

# Check service status
curl http://localhost:3005/api/multi-model/health
```

## 🤝 Contributing

### Adding New Subjects

1. **Define keywords** in `enhancedDeepSearchService.js`
2. **Create training data** in JSONL format
3. **Add configuration** in `ml_training/configs/base_config.py`
4. **Train the model** using training scripts
5. **Test classification** and integration

### Improving Models

1. **Collect better training data**
2. **Experiment with hyperparameters**
3. **Try different model architectures**
4. **Implement advanced techniques** (QLoRA, AdaLoRA)

## 📈 Roadmap

- [ ] **Multi-language support** for international users
- [ ] **Real-time learning** from user feedback
- [ ] **Advanced model architectures** (LLaMA, Mistral)
- [ ] **Distributed training** for larger models
- [ ] **A/B testing framework** for model comparison
- [ ] **Vector database integration** for enhanced retrieval
- [ ] **Edge deployment** for offline usage

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

---

**Need Help?** Check the troubleshooting section above or create an issue on GitHub.
