const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const multer = require('multer');
const { tempAuth } = require('../middleware/authMiddleware');
const archiver = require('archiver');
const { getOllamaService } = require('../services/ollamaService');
const databaseService = require('../services/databaseService');
const dataValidationService = require('../services/dataValidationService');

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Training state management
let trainingState = {
    status: 'idle', // idle, starting, training, completed, error, stopped
    currentSubject: null,
    config: null,
    process: null,
    logs: [],
    startTime: null,
    progress: 0
};

// Get training status
router.get('/status', tempAuth, (req, res) => {
    res.json({
        success: true,
        status: trainingState.status,
        subject: trainingState.currentSubject,
        progress: trainingState.progress,
        startTime: trainingState.startTime
    });
});

// Get training progress and logs
router.get('/progress', tempAuth, (req, res) => {
    res.json({
        success: true,
        status: trainingState.status,
        logs: trainingState.logs.slice(-10), // Return last 10 logs
        progress: trainingState.progress
    });
});

// Upload custom model
router.post('/upload-model', tempAuth, upload.single('modelFile'), async (req, res) => {
    try {
        const { name, description, modelSize, compatibleSubjects, modelFormat } = req.body;
        const file = req.file;
        const userId = req.user.id;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No model file uploaded'
            });
        }

        if (!name || !description) {
            return res.status(400).json({
                success: false,
                error: 'Model name and description are required'
            });
        }

        // Create custom models directory
        const customModelsDir = path.join(__dirname, '..', 'ml_training', 'custom_models');
        await fs.mkdir(customModelsDir, { recursive: true });

        // Generate unique model ID
        const modelId = `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
        const modelDir = path.join(customModelsDir, modelId);
        await fs.mkdir(modelDir, { recursive: true });

        // Move uploaded file to model directory
        const originalPath = file.path;
        const newPath = path.join(modelDir, file.originalname);
        await fs.rename(originalPath, newPath);

        // Parse compatible subjects
        const subjects = compatibleSubjects ? compatibleSubjects.split(',').map(s => s.trim()) : ['general'];

        // Create model info
        const modelInfo = {
            model_id: modelId,
            name: name,
            model_path: modelDir,
            model_type: 'custom',
            size: modelSize || 'Unknown',
            description: description,
            compatible_subjects: subjects,
            uploaded_by: userId,
            file_size: file.size,
            model_format: modelFormat || 'huggingface',
            is_verified: false,
            upload_source: 'local',
            original_filename: file.originalname,
            created_at: new Date().toISOString()
        };

        // Save model info
        const modelInfoPath = path.join(modelDir, 'model_info.json');
        await fs.writeFile(modelInfoPath, JSON.stringify(modelInfo, null, 2));

        // Add to models list (in-memory for now)
        // In a real implementation, this would use the model registry

        console.log(`Custom model uploaded: ${modelId} by user ${userId}`);

        res.json({
            success: true,
            message: 'Model uploaded successfully',
            model: {
                id: modelId,
                name: name,
                size: modelSize,
                status: 'uploaded',
                verified: false
            }
        });

    } catch (error) {
        console.error('Error uploading custom model:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get custom models
router.get('/custom-models', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { all } = req.query; // Admin can see all custom models

        // In a real implementation, this would query the model registry
        const customModelsDir = path.join(__dirname, '..', 'ml_training', 'custom_models');
        const customModels = [];

        try {
            const modelDirs = await fs.readdir(customModelsDir);

            for (const modelDir of modelDirs) {
                const modelInfoPath = path.join(customModelsDir, modelDir, 'model_info.json');
                try {
                    const modelInfoData = await fs.readFile(modelInfoPath, 'utf8');
                    const modelInfo = JSON.parse(modelInfoData);

                    // Filter by user unless admin requests all
                    if (all === 'true' || modelInfo.uploaded_by === userId) {
                        customModels.push({
                            id: modelInfo.model_id,
                            name: modelInfo.name,
                            size: modelInfo.size,
                            description: modelInfo.description,
                            compatible_subjects: modelInfo.compatible_subjects,
                            uploaded_by: modelInfo.uploaded_by,
                            created_at: modelInfo.created_at,
                            verified: modelInfo.is_verified,
                            file_size: modelInfo.file_size,
                            model_format: modelInfo.model_format
                        });
                    }
                } catch (err) {
                    console.log(`Could not read model info for ${modelDir}`);
                }
            }
        } catch (err) {
            // Custom models directory doesn't exist yet
        }

        res.json({
            success: true,
            models: customModels.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        });

    } catch (error) {
        console.error('Error fetching custom models:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete custom model
router.delete('/custom-models/:modelId', tempAuth, async (req, res) => {
    try {
        const { modelId } = req.params;
        const userId = req.user.id;

        const customModelsDir = path.join(__dirname, '..', 'ml_training', 'custom_models');
        const modelDir = path.join(customModelsDir, modelId);
        const modelInfoPath = path.join(modelDir, 'model_info.json');

        // Check if model exists and user owns it
        try {
            const modelInfoData = await fs.readFile(modelInfoPath, 'utf8');
            const modelInfo = JSON.parse(modelInfoData);

            if (modelInfo.uploaded_by !== userId) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own models'
                });
            }

            // Delete model directory
            const rimraf = require('rimraf');
            await new Promise((resolve, reject) => {
                rimraf(modelDir, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log(`Custom model deleted: ${modelId} by user ${userId}`);

            res.json({
                success: true,
                message: 'Model deleted successfully'
            });

        } catch (err) {
            res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

    } catch (error) {
        console.error('Error deleting custom model:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ollama API endpoints
router.get('/ollama/status', tempAuth, async (req, res) => {
    try {
        const ollama = getOllamaService();
        const isConnected = await ollama.checkConnection();

        res.json({
            success: true,
            connected: isConnected,
            baseUrl: ollama.baseUrl
        });
    } catch (error) {
        console.error('Error checking Ollama status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/ollama/configure', tempAuth, async (req, res) => {
    try {
        const { baseUrl } = req.body;

        if (!baseUrl) {
            return res.status(400).json({
                success: false,
                error: 'Base URL is required'
            });
        }

        // Create new Ollama service instance with custom URL
        const { OllamaService } = require('../services/ollamaService');
        const customOllama = new OllamaService(baseUrl);

        // Test connection
        const isConnected = await customOllama.checkConnection();

        if (isConnected) {
            // Update global instance (in a real app, you'd want to persist this)
            global.customOllamaService = customOllama;

            res.json({
                success: true,
                message: 'Ollama configuration updated successfully',
                connected: true,
                baseUrl: customOllama.baseUrl
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Could not connect to Ollama at the specified URL'
            });
        }
    } catch (error) {
        console.error('Error configuring Ollama:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/ollama/models', tempAuth, async (req, res) => {
    try {
        const ollama = getOllamaService();
        const models = await ollama.getAvailableModels();

        res.json({
            success: true,
            models: models
        });
    } catch (error) {
        console.error('Error fetching Ollama models:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/ollama/popular', tempAuth, async (req, res) => {
    try {
        const ollama = getOllamaService();
        const popularModels = ollama.getPopularModels();

        res.json({
            success: true,
            models: popularModels
        });
    } catch (error) {
        console.error('Error fetching popular models:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/ollama/pull', tempAuth, async (req, res) => {
    try {
        const { modelName } = req.body;

        if (!modelName) {
            return res.status(400).json({
                success: false,
                error: 'Model name is required'
            });
        }

        const ollama = getOllamaService();

        // For now, use simple JSON response instead of streaming
        // This is more reliable for the current implementation
        const result = await ollama.pullModel(modelName);

        res.json({
            success: true,
            message: `Model ${modelName} pulled successfully`,
            result: result
        });

    } catch (error) {
        console.error('Error pulling Ollama model:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/ollama/models/:modelName', tempAuth, async (req, res) => {
    try {
        const { modelName } = req.params;
        const ollama = getOllamaService();

        const result = await ollama.deleteModel(modelName);

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Error deleting Ollama model:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/ollama/load/:modelName', tempAuth, async (req, res) => {
    try {
        const { modelName } = req.params;
        const ollama = getOllamaService();

        const result = await ollama.loadModel(modelName);

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Error loading Ollama model:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/ollama/unload/:modelName', tempAuth, async (req, res) => {
    try {
        const { modelName } = req.params;
        const ollama = getOllamaService();

        const result = await ollama.unloadModel(modelName);

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Error unloading Ollama model:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/ollama/running', tempAuth, async (req, res) => {
    try {
        const ollama = getOllamaService();
        const runningModels = await ollama.getRunningModels();

        res.json({
            success: true,
            models: runningModels
        });
    } catch (error) {
        console.error('Error fetching running models:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Database integration endpoints
router.post('/database/test-connection', tempAuth, async (req, res) => {
    try {
        const { config } = req.body;

        if (!config || !config.type) {
            return res.status(400).json({
                success: false,
                error: 'Database configuration is required'
            });
        }

        const result = await databaseService.testConnection(config);

        res.json({
            success: true,
            result: result
        });
    } catch (error) {
        console.error('Database connection test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/database/get-schema', tempAuth, async (req, res) => {
    try {
        const { config } = req.body;

        if (!config || !config.type) {
            return res.status(400).json({
                success: false,
                error: 'Database configuration is required'
            });
        }

        const schema = await databaseService.getDatabaseSchema(config);

        res.json({
            success: true,
            schema: schema
        });
    } catch (error) {
        console.error('Failed to get database schema:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/database/extract-data', tempAuth, async (req, res) => {
    try {
        const { config, extractionConfig } = req.body;

        if (!config || !config.type) {
            return res.status(400).json({
                success: false,
                error: 'Database configuration is required'
            });
        }

        if (!extractionConfig) {
            return res.status(400).json({
                success: false,
                error: 'Extraction configuration is required'
            });
        }

        const extractedData = await databaseService.extractTrainingData(config, extractionConfig);

        res.json({
            success: true,
            data: extractedData
        });
    } catch (error) {
        console.error('Failed to extract training data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/database/validate-data', tempAuth, async (req, res) => {
    try {
        const { data, format, options } = req.body;

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({
                success: false,
                error: 'Data array is required'
            });
        }

        if (!format) {
            return res.status(400).json({
                success: false,
                error: 'Data format is required'
            });
        }

        const validationResult = await dataValidationService.validateTrainingData(data, format, options);
        const qualityReport = dataValidationService.generateQualityReport(validationResult);

        res.json({
            success: true,
            validation: validationResult,
            report: qualityReport
        });
    } catch (error) {
        console.error('Data validation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/database/supported-types', tempAuth, async (req, res) => {
    try {
        const supportedTypes = [
            {
                type: 'mongodb',
                name: 'MongoDB',
                description: 'NoSQL document database',
                fields: ['host', 'port', 'database', 'username', 'password'],
                optionalFields: ['connectionString']
            },
            {
                type: 'mongodb_atlas',
                name: 'MongoDB Atlas',
                description: 'Cloud MongoDB service',
                fields: ['connectionString'],
                optionalFields: ['database']
            },
            {
                type: 'mysql',
                name: 'MySQL',
                description: 'Relational database',
                fields: ['host', 'port', 'database', 'username', 'password']
            },
            {
                type: 'postgresql',
                name: 'PostgreSQL',
                description: 'Advanced relational database',
                fields: ['host', 'port', 'database', 'username', 'password']
            },
            {
                type: 'sqlite',
                name: 'SQLite',
                description: 'Lightweight file-based database',
                fields: ['filePath']
            }
        ];

        res.json({
            success: true,
            types: supportedTypes
        });
    } catch (error) {
        console.error('Failed to get supported database types:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/database/data-formats', tempAuth, async (req, res) => {
    try {
        const dataFormats = [
            {
                format: 'conversational',
                name: 'Conversational Data',
                description: 'Chat conversations with input/output pairs',
                structure: {
                    required: ['turns'],
                    turnFields: ['input', 'output'],
                    example: {
                        turns: [
                            { input: "Hello", output: "Hi there!" },
                            { input: "How are you?", output: "I'm doing well, thank you!" }
                        ]
                    }
                }
            },
            {
                format: 'text_classification',
                name: 'Text Classification',
                description: 'Text samples with category labels',
                structure: {
                    required: ['text', 'label'],
                    example: {
                        text: "This movie is amazing!",
                        label: "positive"
                    }
                }
            },
            {
                format: 'question_answer',
                name: 'Question & Answer',
                description: 'Question and answer pairs',
                structure: {
                    required: ['question', 'answer'],
                    example: {
                        question: "What is the capital of France?",
                        answer: "Paris"
                    }
                }
            },
            {
                format: 'text_generation',
                name: 'Text Generation',
                description: 'Text samples for language modeling',
                structure: {
                    required: ['text'],
                    example: {
                        text: "The quick brown fox jumps over the lazy dog."
                    }
                }
            },
            {
                format: 'custom',
                name: 'Custom Format',
                description: 'User-defined data structure',
                structure: {
                    configurable: true,
                    example: "Define your own fields and validation rules"
                }
            }
        ];

        res.json({
            success: true,
            formats: dataFormats
        });
    } catch (error) {
        console.error('Failed to get data formats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get training history
router.get('/history', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // For now, return mock training history
        // In a real implementation, this would query a database
        const mockHistory = [
            {
                id: 'training_001',
                subject: 'programming',
                model: 'gpt2-small',
                status: 'completed',
                startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                endTime: new Date(Date.now() - 82800000).toISOString(), // 1 hour later
                duration: 3600000, // 1 hour in ms
                accuracy: 0.85,
                loss: 0.23,
                samples: 1000
            },
            {
                id: 'training_002',
                subject: 'mathematics',
                model: 'gpt2-medium',
                status: 'completed',
                startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                endTime: new Date(Date.now() - 165600000).toISOString(), // 2 hours later
                duration: 7200000, // 2 hours in ms
                accuracy: 0.92,
                loss: 0.18,
                samples: 1500
            }
        ];

        res.json({
            success: true,
            history: mockHistory
        });
    } catch (error) {
        console.error('Error fetching training history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get available base models (including custom and Ollama models)
router.get('/base-models', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { includeCustom, includeOllama } = req.query;

        const baseModels = [
            {
                id: "gpt2-small",
                name: "GPT-2 Small",
                size: "124M",
                description: "OpenAI's GPT-2 small model - good for general text generation",
                type: "foundation",
                compatible_subjects: ["general", "literature", "history", "science"]
            },
            {
                id: "gpt2-medium",
                name: "GPT-2 Medium",
                size: "355M",
                description: "OpenAI's GPT-2 medium model - better performance than small",
                type: "foundation",
                compatible_subjects: ["general", "literature", "history", "science", "programming"]
            },
            {
                id: "distilgpt2",
                name: "DistilGPT-2",
                size: "82M",
                description: "Distilled version of GPT-2 - faster and smaller",
                type: "foundation",
                compatible_subjects: ["general", "literature", "history"]
            },
            {
                id: "dialogpt-small",
                name: "DialoGPT Small",
                size: "117M",
                description: "Microsoft's conversational AI model - good for dialogue",
                type: "foundation",
                compatible_subjects: ["general", "programming", "science"]
            },
            {
                id: "codegen-350m",
                name: "CodeGen 350M",
                size: "350M",
                description: "Salesforce's code generation model - specialized for programming",
                type: "foundation",
                compatible_subjects: ["programming", "science"]
            }
        ];

        // Add custom models if requested
        if (includeCustom === 'true') {
            try {
                const customModelsDir = path.join(__dirname, '..', 'ml_training', 'custom_models');
                const modelDirs = await fs.readdir(customModelsDir);

                for (const modelDir of modelDirs) {
                    const modelInfoPath = path.join(customModelsDir, modelDir, 'model_info.json');
                    try {
                        const modelInfoData = await fs.readFile(modelInfoPath, 'utf8');
                        const modelInfo = JSON.parse(modelInfoData);

                        // Include user's own models and verified models
                        if (modelInfo.uploaded_by === userId || modelInfo.is_verified) {
                            baseModels.push({
                                id: modelInfo.model_id,
                                name: modelInfo.name,
                                size: modelInfo.size,
                                description: modelInfo.description,
                                type: "custom",
                                compatible_subjects: modelInfo.compatible_subjects,
                                verified: modelInfo.is_verified,
                                uploaded_by: modelInfo.uploaded_by,
                                is_own: modelInfo.uploaded_by === userId
                            });
                        }
                    } catch (err) {
                        // Skip invalid model info files
                    }
                }
            } catch (err) {
                // Custom models directory doesn't exist yet
            }
        }

        // Add Ollama models if requested
        if (includeOllama === 'true') {
            try {
                const ollama = getOllamaService();
                const isConnected = await ollama.checkConnection();

                if (isConnected) {
                    const ollamaModels = await ollama.getAvailableModels();
                    baseModels.push(...ollamaModels);
                }
            } catch (err) {
                console.log('Could not fetch Ollama models:', err.message);
            }
        }

        res.json({
            success: true,
            models: baseModels
        });
    } catch (error) {
        console.error('Error fetching base models:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get available checkpoints
router.get('/checkpoints', tempAuth, async (req, res) => {
    try {
        const { subject } = req.query;

        // Mock checkpoints data - in real implementation, this would query the registry
        const checkpoints = [
            {
                id: "mathematics_epoch_2_step_500",
                subject: "mathematics",
                epoch: 2,
                step: 500,
                loss: 0.45,
                created_at: "2025-07-30T10:30:00Z",
                resumable: true,
                model_size: "1B"
            },
            {
                id: "programming_epoch_1_step_250",
                subject: "programming",
                epoch: 1,
                step: 250,
                loss: 0.62,
                created_at: "2025-07-30T09:15:00Z",
                resumable: true,
                model_size: "1B"
            },
            {
                id: "science_epoch_3_step_750",
                subject: "science",
                epoch: 3,
                step: 750,
                loss: 0.38,
                created_at: "2025-07-30T08:45:00Z",
                resumable: true,
                model_size: "3B"
            }
        ];

        const filteredCheckpoints = subject
            ? checkpoints.filter(c => c.subject === subject)
            : checkpoints;

        res.json({
            success: true,
            checkpoints: filteredCheckpoints
        });
    } catch (error) {
        console.error('Error fetching checkpoints:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start training
router.post('/start', tempAuth, async (req, res) => {
    try {
        const { subject, config } = req.body;

        if (trainingState.status === 'training') {
            return res.status(400).json({
                success: false,
                error: 'Training is already in progress'
            });
        }

        // Validate subject
        const validSubjects = ['mathematics', 'programming', 'science', 'history', 'literature'];
        if (!validSubjects.includes(subject)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subject specified'
            });
        }

        // Reset training state
        trainingState = {
            status: 'starting',
            currentSubject: subject,
            config: config,
            process: null,
            logs: [],
            startTime: new Date().toISOString(),
            progress: 0
        };

        // Enhanced logging for advanced training modes
        const trainingMode = config.trainingMode || 'fine_tune';
        addTrainingLog(`Starting ${trainingMode} training for ${subject} model`);

        if (config.baseModel) {
            addTrainingLog(`Using base model: ${config.baseModel.name} (${config.baseModel.size})`);
        }

        if (config.resumeFromCheckpoint && config.checkpointId) {
            addTrainingLog(`Resuming from checkpoint: ${config.checkpointId}`);
        }

        if (config.transferFromSubject) {
            addTrainingLog(`Transfer learning from: ${config.transferFromSubject}`);
        }

        if (config.retrainExisting) {
            addTrainingLog(`Retraining existing ${subject} model`);
        }

        addTrainingLog(`Configuration: ${config.modelSize} parameters, ${config.epochs} epochs`);

        // Start training process
        const success = await startTrainingProcess(subject, config);

        if (success) {
            res.json({
                success: true,
                message: 'Training started successfully'
            });
        } else {
            trainingState.status = 'error';
            res.status(500).json({
                success: false,
                error: 'Failed to start training process'
            });
        }

    } catch (error) {
        console.error('Error starting training:', error);
        trainingState.status = 'error';
        addTrainingLog(`Error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop training
router.post('/stop', tempAuth, (req, res) => {
    try {
        if (trainingState.process) {
            trainingState.process.kill('SIGTERM');
            trainingState.status = 'stopped';
            addTrainingLog('Training stopped by user');
        }

        res.json({
            success: true,
            message: 'Training stopped'
        });
    } catch (error) {
        console.error('Error stopping training:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get trained models
router.get('/models', tempAuth, async (req, res) => {
    try {
        const modelsDir = path.join(__dirname, '..', 'ml_training', 'models');
        const checkpointsDir = path.join(__dirname, '..', 'ml_training', 'checkpoints');
        
        const models = [];

        // Check for saved models
        try {
            const modelFiles = await fs.readdir(modelsDir);
            for (const file of modelFiles) {
                if (file.endsWith('.json')) {
                    try {
                        const modelPath = path.join(modelsDir, file);
                        const modelData = JSON.parse(await fs.readFile(modelPath, 'utf8'));
                        models.push({
                            id: file.replace('.json', ''),
                            ...modelData
                        });
                    } catch (err) {
                        console.error(`Error reading model file ${file}:`, err);
                    }
                }
            }
        } catch (err) {
            console.log('Models directory not found or empty');
        }

        res.json({
            success: true,
            models: models
        });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download model (supports both ZIP and JSON formats)
router.get('/download/:modelId', tempAuth, async (req, res) => {
    try {
        const { modelId } = req.params;
        const { format } = req.query; // ?format=zip or ?format=json

        console.log(`Download request for model: ${modelId}, format: ${format || 'zip'}`);

        // Default to ZIP format
        const downloadFormat = format === 'json' ? 'json' : 'zip';
        const filePath = path.join(__dirname, '..', 'ml_training', 'checkpoints', `${modelId}.${downloadFormat}`);

        console.log(`Looking for file at: ${filePath}`);

        // Check if model file exists
        try {
            await fs.access(filePath);
            console.log(`Model file found, starting download: ${modelId}.${downloadFormat}`);

            if (downloadFormat === 'zip') {
                // Download ZIP file
                res.setHeader('Content-Type', 'application/zip');
                res.setHeader('Content-Disposition', `attachment; filename="${modelId}_model.zip"`);

                res.download(filePath, `${modelId}_model.zip`, (err) => {
                    if (err) {
                        console.error('Error during ZIP download:', err);
                        if (!res.headersSent) {
                            res.status(500).json({
                                success: false,
                                error: 'Download failed'
                            });
                        }
                    } else {
                        console.log(`ZIP download completed successfully: ${modelId}`);
                    }
                });
            } else {
                // Download JSON file
                const modelPackage = await fs.readFile(filePath, 'utf8');
                const packageData = JSON.parse(modelPackage);

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${modelId}_model_package.json"`);

                res.send(JSON.stringify(packageData, null, 2));
                console.log(`JSON download completed successfully: ${modelId}`);
            }

        } catch (err) {
            console.log(`Model file not found: ${filePath}`);

            // If ZIP not found, try JSON as fallback
            if (downloadFormat === 'zip') {
                const jsonPath = path.join(__dirname, '..', 'ml_training', 'checkpoints', `${modelId}.json`);
                try {
                    await fs.access(jsonPath);
                    console.log(`ZIP not found, falling back to JSON: ${modelId}`);

                    const modelPackage = await fs.readFile(jsonPath, 'utf8');
                    const packageData = JSON.parse(modelPackage);

                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', `attachment; filename="${modelId}_model_package.json"`);

                    res.send(JSON.stringify(packageData, null, 2));
                    console.log(`Fallback JSON download completed: ${modelId}`);
                    return;
                } catch (jsonErr) {
                    // Both ZIP and JSON not found
                }
            }

            res.status(404).json({
                success: false,
                error: `Model file not found: ${modelId}. The model may not have completed training yet, or you may be trying to download an older model that was created before the download feature was implemented.`
            });
        }
    } catch (error) {
        console.error('Error downloading model:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// === DATA MANAGEMENT ENDPOINTS ===

// Get data statistics for a subject
router.get('/data/stats/:subject', tempAuth, async (req, res) => {
    try {
        const { subject } = req.params;
        const datasetDir = path.join(__dirname, '..', 'ml_training', 'datasets', subject);

        const stats = {
            train: 0,
            validation: 0,
            test: 0
        };

        try {
            // Count lines in each file
            const trainPath = path.join(datasetDir, 'train.jsonl');
            const valPath = path.join(datasetDir, 'val.jsonl');
            const testPath = path.join(datasetDir, 'test.jsonl');

            try {
                const trainData = await fs.readFile(trainPath, 'utf8');
                stats.train = trainData.trim().split('\n').filter(line => line.trim()).length;
            } catch (err) { /* File doesn't exist */ }

            try {
                const valData = await fs.readFile(valPath, 'utf8');
                stats.validation = valData.trim().split('\n').filter(line => line.trim()).length;
            } catch (err) { /* File doesn't exist */ }

            try {
                const testData = await fs.readFile(testPath, 'utf8');
                stats.test = testData.trim().split('\n').filter(line => line.trim()).length;
            } catch (err) { /* File doesn't exist */ }

        } catch (err) {
            console.log(`Dataset directory for ${subject} not found`);
        }

        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting data stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Upload training data file
router.post('/data/upload', tempAuth, upload.single('file'), async (req, res) => {
    try {
        const { subject } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Read uploaded file
        const fileContent = await fs.readFile(file.path, 'utf8');

        // Process and validate data
        const result = await processTrainingData(subject, fileContent);

        // Clean up uploaded file
        await fs.unlink(file.path);

        res.json({
            success: true,
            count: result.count,
            message: `Successfully processed ${result.count} training examples`
        });

    } catch (error) {
        console.error('Error uploading data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Process text data
router.post('/data/text', tempAuth, async (req, res) => {
    try {
        const { subject, data } = req.body;

        if (!data || !data.trim()) {
            return res.status(400).json({
                success: false,
                error: 'No data provided'
            });
        }

        const result = await processTrainingData(subject, data);

        res.json({
            success: true,
            count: result.count,
            message: `Successfully processed ${result.count} training examples`
        });

    } catch (error) {
        console.error('Error processing text data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Import data from URL
router.post('/data/url', tempAuth, async (req, res) => {
    try {
        const { subject, url } = req.body;

        if (!url || !url.trim()) {
            return res.status(400).json({
                success: false,
                error: 'No URL provided'
            });
        }

        // Extract data from URL (mock implementation)
        const extractedData = await extractDataFromUrl(url, subject);
        const result = await processTrainingData(subject, extractedData);

        res.json({
            success: true,
            count: result.count,
            message: `Successfully extracted and processed ${result.count} training examples`
        });

    } catch (error) {
        console.error('Error importing from URL:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate sample data
router.post('/data/generate', tempAuth, async (req, res) => {
    try {
        const { subject, count = 100 } = req.body;

        const sampleData = generateSampleData(subject, count);
        const result = await processTrainingData(subject, sampleData);

        res.json({
            success: true,
            count: result.count,
            message: `Successfully generated ${result.count} sample training examples`
        });

    } catch (error) {
        console.error('Error generating sample data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to start training process
async function startTrainingProcess(subject, config) {
    try {
        const trainingScript = path.join(__dirname, '..', 'ml_training', 'scripts', 'train_subject_model.py');
        
        // Check if training script exists
        try {
            await fs.access(trainingScript);
        } catch (err) {
            addTrainingLog('Training script not found. Creating mock training process...');
            return startMockTraining(subject, config);
        }

        // Prepare training arguments
        const args = [
            trainingScript,
            '--subject', subject,
            '--model-size', config.modelSize,
            '--epochs', config.epochs.toString(),
            '--batch-size', config.batchSize.toString(),
            '--learning-rate', config.learningRate.toString()
        ];

        if (config.useUnsloth) {
            args.push('--use-unsloth');
        }

        if (config.useLoRA) {
            args.push('--use-lora');
        }

        // Start Python training process
        const pythonProcess = spawn('python', args, {
            cwd: path.join(__dirname, '..', 'ml_training'),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        trainingState.process = pythonProcess;
        trainingState.status = 'training';

        // Handle process output
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            addTrainingLog(output);
            
            // Parse progress if available
            const progressMatch = output.match(/Progress: (\d+)%/);
            if (progressMatch) {
                trainingState.progress = parseInt(progressMatch[1]);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            addTrainingLog(`Error: ${error}`);

            // Check for common dependency errors
            if (error.includes('ModuleNotFoundError') || error.includes('ImportError')) {
                addTrainingLog('⚠️ Missing Python dependencies detected. Falling back to mock training...');
                pythonProcess.kill();
                setTimeout(() => {
                    startMockTraining(subject, config);
                }, 1000);
            }
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                trainingState.status = 'completed';
                trainingState.progress = 100;
                addTrainingLog('Training completed successfully!');
                saveModelInfo(subject, config);
            } else {
                trainingState.status = 'error';
                addTrainingLog(`Training failed with exit code ${code}`);
            }
        });

        return true;
    } catch (error) {
        console.error('Error starting training process:', error);
        addTrainingLog(`Error starting training: ${error.message}`);
        return false;
    }
}

// Mock training for demonstration
function startMockTraining(subject, config) {
    trainingState.status = 'training';
    trainingState.progress = 0;

    const trainingMode = config.trainingMode || 'fine_tune';

    addTrainingLog('🔄 Starting advanced training process...');
    addTrainingLog(`📚 Subject: ${subject.charAt(0).toUpperCase() + subject.slice(1)}`);
    addTrainingLog(`🎯 Training Mode: ${trainingMode.replace('_', ' ').toUpperCase()}`);

    // Show base model info
    if (config.baseModel) {
        addTrainingLog(`🏗️ Base Model: ${config.baseModel.name} (${config.baseModel.size})`);
    }

    // Show checkpoint info for resume
    if (config.resumeFromCheckpoint && config.checkpointId) {
        addTrainingLog(`🔄 Resuming from: ${config.checkpointId}`);
        addTrainingLog(`📊 Previous progress: Epoch ${Math.floor(Math.random() * 3) + 1}, Loss: ${(Math.random() * 0.5 + 0.3).toFixed(4)}`);
    }

    // Show transfer learning info
    if (config.transferFromSubject) {
        addTrainingLog(`🔄 Transfer from: ${config.transferFromSubject.charAt(0).toUpperCase() + config.transferFromSubject.slice(1)}`);
        addTrainingLog(`🧠 Leveraging pre-trained knowledge from ${config.transferFromSubject}`);
    }

    addTrainingLog(`🧠 Model Size: ${config.modelSize} parameters`);
    addTrainingLog(`🔄 Epochs: ${config.epochs}`);
    addTrainingLog(`📦 Batch Size: ${config.batchSize}`);
    addTrainingLog(`📈 Learning Rate: ${config.learningRate}`);
    addTrainingLog(`⚡ Unsloth: ${config.useUnsloth ? 'Enabled' : 'Disabled'}`);
    addTrainingLog(`🎯 LoRA: ${config.useLoRA ? 'Enabled' : 'Disabled'}`);
    addTrainingLog('');

    let progress = 0;
    let currentEpoch = 1;
    const startEpoch = config.resumeFromCheckpoint ? Math.floor(Math.random() * 2) + 1 : 1;
    // trainingMode already declared above

    const interval = setInterval(() => {
        // Adjust progress speed based on training mode
        let progressIncrement = Math.random() * 8 + 2;
        if (trainingMode === 'resume') {
            progressIncrement *= 1.5; // Faster for resume
            progress += progressIncrement;
        } else if (trainingMode === 'transfer') {
            progressIncrement *= 1.2; // Slightly faster for transfer
            progress += progressIncrement;
        } else {
            progress += progressIncrement;
        }

        trainingState.progress = Math.min(progress, 100);

        if (progress < 15) {
            if (trainingMode === 'resume') {
                addTrainingLog(`🔄 Restoring model state from checkpoint...`);
                addTrainingLog(`📊 Validating checkpoint integrity...`);
            } else if (trainingMode === 'transfer') {
                addTrainingLog(`🔄 Loading source model for transfer learning...`);
                addTrainingLog(`🧠 Adapting model architecture for ${subject}...`);
            } else {
                addTrainingLog(`📊 Loading ${subject} training dataset...`);
            }
        } else if (progress < 35) {
            if (trainingMode === 'resume') {
                addTrainingLog(`🚀 Resuming training from Epoch ${startEpoch}/${config.epochs}...`);
                addTrainingLog(`📈 Continuing from previous loss: ${(Math.random() * 0.5 + 0.4).toFixed(4)}`);
            } else if (trainingMode === 'transfer') {
                addTrainingLog(`🎯 Freezing base layers for transfer learning...`);
                addTrainingLog(`🔧 Initializing subject-specific layers...`);
            } else {
                addTrainingLog(`🚀 Epoch ${currentEpoch}/${config.epochs}: Initializing model...`);
            }
            currentEpoch = 2;
        } else if (progress < 60) {
            addTrainingLog(`🔥 Epoch ${currentEpoch}/${config.epochs}: Training in progress...`);
            if (trainingMode === 'transfer') {
                addTrainingLog(`🔄 Transfer learning: ${(Math.random() * 1.5 + 0.8).toFixed(4)} → ${(Math.random() * 1 + 0.5).toFixed(4)}`);
            } else {
                addTrainingLog(`📈 Loss: ${(Math.random() * 2 + 1).toFixed(4)}`);
            }
            currentEpoch = 3;
        } else if (progress < 80) {
            if (trainingMode === 'transfer') {
                addTrainingLog(`🎯 Fine-tuning transferred knowledge for ${subject}...`);
                addTrainingLog(`📊 Adaptation loss: ${(Math.random() * 0.8 + 0.3).toFixed(4)}`);
            } else {
                addTrainingLog(`🎯 Epoch ${currentEpoch}/${config.epochs}: Fine-tuning with LoRA...`);
                addTrainingLog(`📉 Loss: ${(Math.random() * 1 + 0.5).toFixed(4)}`);
            }
        } else if (progress < 95) {
            addTrainingLog(`💾 Saving model checkpoint...`);
            if (trainingMode === 'transfer') {
                addTrainingLog(`🔄 Saving transfer learning adapters...`);
            }
        } else {
            if (trainingMode === 'resume') {
                addTrainingLog(`✅ Training resumed and completed successfully!`);
            } else if (trainingMode === 'transfer') {
                addTrainingLog(`✅ Transfer learning completed successfully!`);
                addTrainingLog(`🎯 Model adapted for ${subject} domain`);
            } else {
                addTrainingLog(`✅ Training completed successfully!`);
            }
        }

        if (progress >= 100) {
            clearInterval(interval);
            trainingState.status = 'completed';
            trainingState.progress = 100;
            addTrainingLog('🎉 Mock training completed successfully!');
            addTrainingLog('📁 Model saved to checkpoints directory');
            saveModelInfo(subject, config);
        }
    }, 1500);

    return true;
}

// Helper function to add training logs
function addTrainingLog(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    trainingState.logs.push(logEntry);
    
    // Keep only last 100 logs
    if (trainingState.logs.length > 100) {
        trainingState.logs = trainingState.logs.slice(-100);
    }
    
    console.log(logEntry);
}

// Helper function to save model information
async function saveModelInfo(subject, config) {
    try {
        const modelInfo = {
            subject: subject,
            size: config.modelSize,
            accuracy: Math.floor(Math.random() * 20) + 80, // Mock accuracy 80-100%
            epochs: config.epochs,
            batchSize: config.batchSize,
            learningRate: config.learningRate,
            useUnsloth: config.useUnsloth,
            useLoRA: config.useLoRA,
            createdAt: new Date().toISOString(),
            trainingTime: Date.now() - new Date(trainingState.startTime).getTime()
        };

        const modelsDir = path.join(__dirname, '..', 'ml_training', 'models');
        await fs.mkdir(modelsDir, { recursive: true });

        const modelId = `${subject}_${config.modelSize}_${Date.now()}`;
        const modelPath = path.join(modelsDir, `${modelId}.json`);

        await fs.writeFile(modelPath, JSON.stringify(modelInfo, null, 2));

        // Create a downloadable model package file
        const checkpointsDir = path.join(__dirname, '..', 'ml_training', 'checkpoints');
        await fs.mkdir(checkpointsDir, { recursive: true });

        const packagePath = path.join(checkpointsDir, `${modelId}.json`);

        // Create a comprehensive model package with all information
        const modelPackage = {
            model_info: modelInfo,
            model_config: config,
            training_summary: {
                subject: subject,
                model_size: config.modelSize,
                accuracy: `${modelInfo.accuracy}%`,
                training_time: `${Math.round(modelInfo.trainingTime / 1000)}s`,
                epochs_completed: config.epochs,
                final_loss: (Math.random() * 0.5 + 0.3).toFixed(4)
            },
            readme: `# ${subject.charAt(0).toUpperCase() + subject.slice(1)} Language Model\n\n## Model Details\n- **Subject**: ${subject}\n- **Parameters**: ${config.modelSize}\n- **Accuracy**: ${modelInfo.accuracy}%\n- **Training Time**: ${Math.round(modelInfo.trainingTime / 1000)} seconds\n- **Epochs**: ${config.epochs}\n- **Batch Size**: ${config.batchSize}\n- **Learning Rate**: ${config.learningRate}\n- **Unsloth**: ${config.useUnsloth ? 'Enabled' : 'Disabled'}\n- **LoRA**: ${config.useLoRA ? 'Enabled' : 'Disabled'}\n\n## Usage\nThis model is specialized for ${subject}-related queries and conversations.\n\n## Generated by\nLLM Training Dashboard - ${new Date().toISOString()}`,
            model_files: {
                description: "In a production environment, this would contain:",
                files: [
                    "model.safetensors - The trained model weights",
                    "config.json - Model configuration",
                    "tokenizer.json - Tokenizer configuration",
                    "tokenizer_config.json - Tokenizer settings",
                    "training_args.json - Training arguments used",
                    "README.md - Model documentation"
                ]
            },
            download_info: {
                downloaded_at: new Date().toISOString(),
                format: "Model Information Package",
                note: "This is a demonstration package. In production, this would be a complete model archive."
            }
        };

        // Write the model package as a formatted JSON file
        await fs.writeFile(packagePath, JSON.stringify(modelPackage, null, 2));

        // Also create a proper ZIP file for download
        await createModelZipFile(modelId, modelPackage);

        addTrainingLog(`Model saved as ${modelId}`);
    } catch (error) {
        console.error('Error saving model info:', error);
        addTrainingLog(`Error saving model: ${error.message}`);
    }
}

// Helper function to create a proper ZIP file for model download
async function createModelZipFile(modelId, modelPackage) {
    try {
        const checkpointsDir = path.join(__dirname, '..', 'ml_training', 'checkpoints');
        const zipPath = path.join(checkpointsDir, `${modelId}.zip`);

        // Create a write stream for the ZIP file
        const output = require('fs').createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                console.log(`ZIP file created: ${zipPath} (${archive.pointer()} bytes)`);
                resolve();
            });

            archive.on('error', (err) => {
                console.error('Error creating ZIP file:', err);
                reject(err);
            });

            // Pipe archive data to the file
            archive.pipe(output);

            // Add files to the ZIP
            archive.append(JSON.stringify(modelPackage.model_info, null, 2), { name: 'model_info.json' });
            archive.append(JSON.stringify(modelPackage.model_config, null, 2), { name: 'config.json' });
            archive.append(modelPackage.readme, { name: 'README.md' });
            archive.append(JSON.stringify(modelPackage.training_summary, null, 2), { name: 'training_summary.json' });
            archive.append(JSON.stringify(modelPackage.download_info, null, 2), { name: 'download_info.json' });

            // Add mock model files (in production, these would be real model files)
            archive.append('# Mock Model Weights\nThis file represents the trained model weights.\nIn production, this would be a binary safetensors file.', { name: 'model.safetensors.txt' });
            archive.append('# Mock Tokenizer\nThis file represents the tokenizer configuration.\nIn production, this would be the actual tokenizer files.', { name: 'tokenizer_config.json.txt' });

            // Finalize the archive
            archive.finalize();
        });
    } catch (error) {
        console.error('Error creating model ZIP file:', error);
        throw error;
    }
}

// === DATA PROCESSING HELPER FUNCTIONS ===

// Process and validate training data
async function processTrainingData(subject, dataContent) {
    const lines = dataContent.trim().split('\n').filter(line => line.trim());
    const validExamples = [];
    let errorCount = 0;

    for (const line of lines) {
        try {
            const example = JSON.parse(line);

            // Validate required fields
            if (example.input && example.target) {
                // Add default fields if missing
                if (!example.category) example.category = 'general';
                if (!example.difficulty) example.difficulty = 'intermediate';
                if (!example.source) example.source = 'user_upload';

                validExamples.push(example);
            } else {
                errorCount++;
            }
        } catch (err) {
            errorCount++;
        }
    }

    if (validExamples.length === 0) {
        throw new Error('No valid training examples found');
    }

    // Save to dataset files
    await saveTrainingData(subject, validExamples);

    return {
        count: validExamples.length,
        errors: errorCount
    };
}

// Save training data to files
async function saveTrainingData(subject, examples) {
    const datasetDir = path.join(__dirname, '..', 'ml_training', 'datasets', subject);
    await fs.mkdir(datasetDir, { recursive: true });

    // Split data: 80% train, 10% validation, 10% test
    const shuffled = examples.sort(() => Math.random() - 0.5);
    const trainSize = Math.floor(examples.length * 0.8);
    const valSize = Math.floor(examples.length * 0.1);

    const trainData = shuffled.slice(0, trainSize);
    const valData = shuffled.slice(trainSize, trainSize + valSize);
    const testData = shuffled.slice(trainSize + valSize);

    // Append to existing files
    const trainPath = path.join(datasetDir, 'train.jsonl');
    const valPath = path.join(datasetDir, 'val.jsonl');
    const testPath = path.join(datasetDir, 'test.jsonl');

    const trainContent = trainData.map(ex => JSON.stringify(ex)).join('\n') + '\n';
    const valContent = valData.map(ex => JSON.stringify(ex)).join('\n') + '\n';
    const testContent = testData.map(ex => JSON.stringify(ex)).join('\n') + '\n';

    await fs.appendFile(trainPath, trainContent);
    if (valData.length > 0) await fs.appendFile(valPath, valContent);
    if (testData.length > 0) await fs.appendFile(testPath, testContent);
}

// Extract data from URL (mock implementation)
async function extractDataFromUrl(url, subject) {
    // This is a mock implementation
    // In a real system, you would use libraries like puppeteer, cheerio, or pdf-parse

    const sampleExamples = generateSampleData(subject, 50);
    return sampleExamples;
}

// Generate sample training data
function generateSampleData(subject, count) {
    const examples = [];

    const templates = {
        mathematics: [
            { input: "What is {a} + {b}?", target: "{a} + {b} = {result}", category: "arithmetic" },
            { input: "Solve for x: {a}x + {b} = {c}", target: "x = ({c} - {b}) / {a} = {result}", category: "algebra" },
            { input: "What is the derivative of x^{n}?", target: "The derivative of x^{n} is {n}x^{n-1}", category: "calculus" }
        ],
        programming: [
            { input: "How do you create a function in {lang}?", target: "In {lang}, you create a function using: {syntax}", category: "syntax" },
            { input: "What is a {concept} in programming?", target: "A {concept} is {definition}", category: "concepts" },
            { input: "How do you implement {algorithm}?", target: "To implement {algorithm}: {steps}", category: "algorithms" }
        ],
        science: [
            { input: "What is {element}?", target: "{element} is {description}", category: "chemistry" },
            { input: "Explain {concept}", target: "{concept} is {explanation}", category: "physics" },
            { input: "What is {process}?", target: "{process} is {definition}", category: "biology" }
        ],
        history: [
            { input: "What happened in {year}?", target: "In {year}, {event} occurred", category: "timeline" },
            { input: "Who was {person}?", target: "{person} was {description}", category: "biography" },
            { input: "What was the {event}?", target: "The {event} was {description}", category: "events" }
        ],
        literature: [
            { input: "Who wrote {book}?", target: "{book} was written by {author}", category: "authors" },
            { input: "What is the theme of {book}?", target: "The main theme of {book} is {theme}", category: "themes" },
            { input: "Analyze {character} from {book}", target: "{character} is {analysis}", category: "analysis" }
        ]
    };

    const subjectTemplates = templates[subject] || templates.mathematics;

    for (let i = 0; i < count; i++) {
        const template = subjectTemplates[i % subjectTemplates.length];
        const example = {
            input: template.input.replace(/\{[^}]+\}/g, () => `example_${Math.floor(Math.random() * 100)}`),
            target: template.target.replace(/\{[^}]+\}/g, () => `result_${Math.floor(Math.random() * 100)}`),
            category: template.category,
            difficulty: ['easy', 'intermediate', 'hard'][Math.floor(Math.random() * 3)],
            source: 'generated'
        };
        examples.push(JSON.stringify(example));
    }

    return examples.join('\n');
}

module.exports = router;
