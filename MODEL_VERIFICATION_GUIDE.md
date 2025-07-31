# 🔍 Model Verification & Data Processing Guide

This comprehensive guide explains how to verify models and validate data processing in your LLM training system.

## 📊 Data Processing Verification

### 1. Data Validation System

The system includes comprehensive data validation for all training formats:

#### **Validation Endpoints:**
```bash
# Validate conversational data
POST /api/training/database/validate-data
{
  "data": [{"turns": [{"input": "Hello", "output": "Hi!"}]}],
  "format": "conversational"
}

# Validate classification data
POST /api/training/database/validate-data
{
  "data": [{"text": "Example text", "label": "category"}],
  "format": "text_classification"
}
```

#### **Validation Checks:**
- ✅ **Required Fields** - Ensures all necessary fields are present
- ✅ **Data Types** - Validates field types (string, number, etc.)
- ✅ **Text Length** - Checks minimum/maximum text lengths
- ✅ **Character Encoding** - Detects encoding issues
- ✅ **Duplicate Detection** - Identifies duplicate entries
- ✅ **Quality Scoring** - Assigns quality scores to data

#### **Quality Report:**
```json
{
  "summary": {
    "totalSamples": 1000,
    "validSamples": 950,
    "successRate": 95.0,
    "totalIssues": 50
  },
  "issues": {
    "errors": ["Missing required field", "Text too short"],
    "warnings": ["Text very long", "Possible encoding issue"]
  }
}
```

### 2. Database Integration Verification

#### **Supported Database Types:**
```bash
GET /api/training/database/supported-types
# Returns: MongoDB, MySQL, PostgreSQL, SQLite, MongoDB Atlas
```

#### **Connection Testing:**
```bash
POST /api/training/database/test-connection
{
  "config": {
    "type": "sqlite",
    "filePath": ":memory:"
  }
}
```

#### **Data Extraction Validation:**
- ✅ **Schema Discovery** - Automatically detects table structure
- ✅ **Data Type Mapping** - Maps database types to training formats
- ✅ **Query Validation** - Validates SQL queries before execution
- ✅ **Sample Data Preview** - Shows data samples before extraction

## 🤖 Model Verification System

### 1. Model Status Monitoring

#### **Base Models Verification:**
```bash
GET /api/training/base-models
# Returns available foundation models with metadata
```

#### **Ollama Integration Check:**
```bash
GET /api/training/ollama/status
# Returns connection status and available models
```

#### **Custom Models Validation:**
```bash
GET /api/training/custom-models
# Returns user-uploaded models and their status
```

### 2. Training Status Monitoring

#### **Real-time Training Status:**
```bash
GET /api/training/status
# Returns: idle, training, completed, failed
```

#### **Training History:**
```bash
GET /api/training/history
# Returns past training sessions with metrics
```

### 3. Model Performance Evaluation

#### **Automatic Evaluation Metrics:**
- 📊 **Loss Tracking** - Training and validation loss
- 📈 **Perplexity** - Model confidence measure
- 🎯 **Accuracy** - Task-specific accuracy scores
- ⏱️ **Response Time** - Inference speed metrics
- 💾 **Memory Usage** - Resource consumption

#### **Subject-Specific Evaluation:**
```python
# Mathematics evaluation
def evaluate_math_correctness(prediction, expected):
    # Extracts numerical answers and compares
    # Returns: "correct", "partial", "incorrect"

# Programming evaluation  
def evaluate_code_correctness(prediction, expected):
    # Analyzes code structure and keywords
    # Returns accuracy based on programming patterns
```

## 🔧 System Health Monitoring

### 1. Health Check Endpoints

#### **API Health:**
```bash
GET /api/services/status
# Returns status of all system services
```

#### **Multi-Model Service Health:**
```bash
GET /api/multi-model/health
# Returns enhanced search and model service status
```

#### **Monitoring Metrics:**
```bash
GET /api/monitoring/metrics
# Returns comprehensive system metrics
```

### 2. Real-time Monitoring

#### **Service Status Tracking:**
- 🟢 **Vector Store** - Document embedding service
- 🟢 **Gemini AI** - Primary AI service
- 🟢 **DuckDuckGo** - Web search integration
- 🟢 **Multi-Model** - Enhanced model routing

#### **Performance Metrics:**
- 📊 **Request Rate** - API requests per minute
- ⏱️ **Response Time** - Average response latency
- 💾 **Memory Usage** - System memory consumption
- 🔄 **Model Usage** - Individual model statistics

## 🧪 Verification Testing

### 1. Automated Verification Script

Run the comprehensive verification script:
```bash
node verify-training-system.js
```

#### **Test Categories:**
1. **📊 Data Processing & Validation**
   - Data validation accuracy
   - Database integration
   - Format processing
   - Quality analysis

2. **🤖 Model Systems & Integration**
   - Base model availability
   - Ollama integration
   - Custom model management
   - Training status

3. **🏥 System Health & Services**
   - API responsiveness
   - Service availability
   - Training history access

### 2. Manual Verification Steps

#### **Step 1: Data Validation Test**
```javascript
// Test data validation
const testData = [
  { text: "Sample text for classification", label: "test" }
];

const response = await fetch('/api/training/database/validate-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: testData,
    format: 'text_classification'
  })
});

const result = await response.json();
console.log('Validation success:', result.validation.isValid);
console.log('Success rate:', result.report.summary.successRate);
```

#### **Step 2: Model Status Check**
```javascript
// Check model availability
const modelsResponse = await fetch('/api/training/base-models');
const models = await modelsResponse.json();
console.log('Available models:', models.models.length);

// Check Ollama status
const ollamaResponse = await fetch('/api/training/ollama/status');
const ollama = await ollamaResponse.json();
console.log('Ollama connected:', ollama.connected);
```

#### **Step 3: Training Verification**
```javascript
// Check training capabilities
const statusResponse = await fetch('/api/training/status');
const status = await statusResponse.json();
console.log('Training status:', status.status);

// Verify training history
const historyResponse = await fetch('/api/training/history');
const history = await historyResponse.json();
console.log('Training sessions:', history.history.length);
```

## 📈 Performance Monitoring

### 1. Training Metrics

#### **Real-time Training Monitoring:**
- 📊 **Loss Curves** - Training and validation loss over time
- 🎯 **Accuracy Trends** - Model performance improvement
- ⏱️ **Training Speed** - Samples processed per second
- 💾 **Resource Usage** - GPU/CPU and memory utilization

#### **Weights & Biases Integration:**
```bash
# Set up monitoring
export WANDB_API_KEY=your_key_here

# Monitor training
python scripts/train_with_monitoring.py --subject mathematics
```

### 2. Model Performance Tracking

#### **Inference Metrics:**
```javascript
// Track model usage
metricsCollector.recordModelUsage(
  modelId: "gpt2-small",
  subject: "mathematics", 
  responseTime: 150,
  success: true
);
```

#### **Performance Benchmarks:**
- ⚡ **Response Time** - < 200ms for simple queries
- 🎯 **Accuracy** - > 85% for domain-specific tasks
- 💾 **Memory** - < 2GB per loaded model
- 🔄 **Throughput** - > 10 requests/second

## 🚨 Troubleshooting

### Common Issues & Solutions

#### **1. Data Validation Failures**
```bash
# Check data format
curl -X POST http://localhost:5007/api/training/database/validate-data \
  -H "Content-Type: application/json" \
  -d '{"data": [{"text": "test", "label": "test"}], "format": "text_classification"}'

# Expected: {"success": true, "validation": {"isValid": true}}
```

#### **2. Model Loading Issues**
```bash
# Check model availability
curl http://localhost:5007/api/training/base-models

# Check Ollama connection
curl http://localhost:5007/api/training/ollama/status
```

#### **3. Training Status Problems**
```bash
# Check training service
curl http://localhost:5007/api/training/status

# Check system health
curl http://localhost:5007/api/services/status
```

## 🎯 Best Practices

### 1. Data Quality Assurance
- ✅ Always validate data before training
- ✅ Check for duplicates and inconsistencies
- ✅ Monitor data quality metrics
- ✅ Use representative test datasets

### 2. Model Verification
- ✅ Test models on validation data
- ✅ Monitor performance metrics
- ✅ Compare against baseline models
- ✅ Validate subject-specific accuracy

### 3. System Monitoring
- ✅ Regular health checks
- ✅ Monitor resource usage
- ✅ Track API response times
- ✅ Set up alerting for failures

## 📚 Next Steps

1. **Run Verification**: Execute `node verify-training-system.js`
2. **Check Results**: Review all test categories
3. **Address Issues**: Fix any failed verifications
4. **Monitor Training**: Use real-time monitoring during training
5. **Validate Models**: Test trained models thoroughly

---

**Need Help?** Check the troubleshooting section or run the verification script for detailed diagnostics.
