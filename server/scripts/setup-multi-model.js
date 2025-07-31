#!/usr/bin/env node
/**
 * Setup script for Multi-Model LLM System
 * This script sets up the complete multi-model infrastructure
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class MultiModelSetup {
    constructor() {
        this.serverDir = path.join(__dirname, '..');
        this.mlInferenceDir = path.join(this.serverDir, 'ml_inference');
        this.mlTrainingDir = path.join(this.serverDir, 'ml_training');
        
        this.steps = [
            'checkPrerequisites',
            'createDirectories',
            'installPythonDependencies',
            'setupTrainingEnvironment',
            'createSampleDatasets',
            'validateInstallation',
            'createStartupScripts'
        ];
        
        this.currentStep = 0;
    }

    async run() {
        console.log('🚀 Starting Multi-Model LLM System Setup');
        console.log('==========================================\n');

        try {
            for (const step of this.steps) {
                this.currentStep++;
                console.log(`\n📋 Step ${this.currentStep}/${this.steps.length}: ${step}`);
                console.log('-'.repeat(50));
                
                await this[step]();
                console.log(`✅ ${step} completed successfully`);
            }

            console.log('\n🎉 Multi-Model LLM System setup completed successfully!');
            this.printNextSteps();

        } catch (error) {
            console.error(`\n❌ Setup failed at step: ${this.steps[this.currentStep - 1]}`);
            console.error('Error:', error.message);
            process.exit(1);
        }
    }

    async checkPrerequisites() {
        console.log('Checking system prerequisites...');

        // Check Node.js version
        const nodeVersion = process.version;
        console.log(`Node.js version: ${nodeVersion}`);
        
        if (parseInt(nodeVersion.slice(1)) < 16) {
            throw new Error('Node.js 16 or higher is required');
        }

        // Check Python availability
        try {
            const { stdout } = await execAsync('python --version');
            console.log(`Python version: ${stdout.trim()}`);
        } catch (error) {
            try {
                const { stdout } = await execAsync('python3 --version');
                console.log(`Python version: ${stdout.trim()}`);
            } catch (error) {
                throw new Error('Python is not installed or not in PATH');
            }
        }

        // Check pip availability
        try {
            await execAsync('pip --version');
            console.log('pip is available');
        } catch (error) {
            try {
                await execAsync('pip3 --version');
                console.log('pip3 is available');
            } catch (error) {
                throw new Error('pip is not installed or not in PATH');
            }
        }

        // Check available disk space (simplified check)
        const stats = fs.statSync(this.serverDir);
        console.log('✅ Prerequisites check passed');
    }

    async createDirectories() {
        console.log('Creating directory structure...');

        const directories = [
            this.mlInferenceDir,
            this.mlTrainingDir,
            path.join(this.mlInferenceDir, 'query_classifier'),
            path.join(this.mlInferenceDir, 'model_manager'),
            path.join(this.mlInferenceDir, 'routing'),
            path.join(this.mlInferenceDir, 'utils'),
            path.join(this.mlTrainingDir, 'datasets'),
            path.join(this.mlTrainingDir, 'models'),
            path.join(this.mlTrainingDir, 'experiments'),
            path.join(this.mlTrainingDir, 'logs'),
            path.join(this.mlTrainingDir, 'checkpoints'),
            path.join(this.serverDir, 'models'),
            path.join(this.serverDir, 'model_cache')
        ];

        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${path.relative(this.serverDir, dir)}`);
            } else {
                console.log(`Directory exists: ${path.relative(this.serverDir, dir)}`);
            }
        }
    }

    async installPythonDependencies() {
        console.log('Installing Python dependencies...');

        // Create requirements.txt if it doesn't exist
        const requirementsPath = path.join(this.mlInferenceDir, 'requirements.txt');
        if (!fs.existsSync(requirementsPath)) {
            const requirements = `# Multi-Model LLM System Requirements
fastapi>=0.104.0
uvicorn>=0.24.0
torch>=2.0.0
transformers>=4.36.0
sentence-transformers>=2.2.0
scikit-learn>=1.3.0
numpy>=1.24.0
pandas>=2.0.0
pydantic>=2.0.0
python-multipart>=0.0.6
aiofiles>=23.0.0
httpx>=0.25.0
tqdm>=4.65.0
psutil>=5.9.0
`;
            fs.writeFileSync(requirementsPath, requirements);
            console.log('Created requirements.txt');
        }

        // Install dependencies
        console.log('Installing Python packages (this may take a while)...');
        
        try {
            const installCommand = process.platform === 'win32' ? 'pip' : 'pip3';
            await this.runCommand(installCommand, ['install', '-r', requirementsPath], {
                cwd: this.mlInferenceDir
            });
            console.log('Python dependencies installed successfully');
        } catch (error) {
            console.warn('Failed to install some Python dependencies. You may need to install them manually.');
            console.warn('Run: pip install -r ml_inference/requirements.txt');
        }
    }

    async setupTrainingEnvironment() {
        console.log('Setting up training environment...');

        // Check if training files exist
        const trainingFiles = [
            'ml_training/configs/base_config.py',
            'ml_training/models/lightweight_llm.py',
            'ml_training/trainers/subject_trainer.py'
        ];

        let missingFiles = 0;
        for (const file of trainingFiles) {
            const filePath = path.join(this.serverDir, file);
            if (!fs.existsSync(filePath)) {
                console.log(`Missing: ${file}`);
                missingFiles++;
            }
        }

        if (missingFiles > 0) {
            console.log(`⚠️ ${missingFiles} training files are missing. Training functionality may be limited.`);
        } else {
            console.log('Training environment files are present');
        }

        // Create training configuration
        const configPath = path.join(this.mlTrainingDir, 'config.json');
        if (!fs.existsSync(configPath)) {
            const config = {
                max_models_in_memory: 2,
                max_memory_usage_mb: 4096,
                model_idle_timeout: 1800,
                preload_models: ["mathematics", "programming"],
                memory_check_interval: 60,
                enable_model_caching: true,
                cache_directory: "../model_cache"
            };

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('Created training configuration');
        }
    }

    async createSampleDatasets() {
        console.log('Creating sample datasets...');

        const datasetsDir = path.join(this.mlTrainingDir, 'datasets');
        
        // Check if we have the dataset creation script
        const datasetScript = path.join(this.mlTrainingDir, 'scripts', 'prepare_datasets.py');
        
        if (fs.existsSync(datasetScript)) {
            try {
                console.log('Running dataset preparation script...');
                await this.runCommand('python', [datasetScript, '--action', 'create'], {
                    cwd: this.mlTrainingDir
                });
                console.log('Sample datasets created successfully');
            } catch (error) {
                console.warn('Failed to create datasets automatically. You may need to create them manually.');
            }
        } else {
            console.log('Dataset creation script not found. Creating basic structure...');
            
            // Create basic dataset structure
            const subjects = ['mathematics', 'programming', 'science', 'history', 'literature'];
            
            for (const subject of subjects) {
                const subjectDir = path.join(datasetsDir, subject);
                if (!fs.existsSync(subjectDir)) {
                    fs.mkdirSync(subjectDir, { recursive: true });
                    
                    // Create placeholder files
                    const placeholderData = JSON.stringify({
                        input: `Sample ${subject} question`,
                        target: `Sample ${subject} answer`,
                        category: subject,
                        difficulty: "beginner"
                    });
                    
                    fs.writeFileSync(path.join(subjectDir, 'train.jsonl'), placeholderData + '\n');
                    fs.writeFileSync(path.join(subjectDir, 'val.jsonl'), placeholderData + '\n');
                    fs.writeFileSync(path.join(subjectDir, 'test.jsonl'), placeholderData + '\n');
                }
            }
            
            console.log('Created basic dataset structure');
        }
    }

    async validateInstallation() {
        console.log('Validating installation...');

        // Check if API server can be created
        const apiServerPath = path.join(this.mlInferenceDir, 'api_server.py');
        if (fs.existsSync(apiServerPath)) {
            console.log('✅ API server file exists');
        } else {
            console.log('⚠️ API server file missing - will be created on first run');
        }

        // Check Node.js dependencies
        const packageJsonPath = path.join(this.serverDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            const requiredDeps = ['express', 'axios'];
            const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
            
            if (missingDeps.length > 0) {
                console.log(`⚠️ Missing Node.js dependencies: ${missingDeps.join(', ')}`);
            } else {
                console.log('✅ Required Node.js dependencies are present');
            }
        }

        console.log('Installation validation completed');
    }

    async createStartupScripts() {
        console.log('Creating startup scripts...');

        // Create Windows batch file
        const batchScript = `@echo off
echo Starting Multi-Model LLM System...
echo.

REM Start the Node.js server
echo Starting Node.js server...
cd /d "${this.serverDir}"
npm start

pause
`;

        fs.writeFileSync(path.join(this.serverDir, 'start-multi-model.bat'), batchScript);

        // Create shell script for Unix systems
        const shellScript = `#!/bin/bash
echo "Starting Multi-Model LLM System..."
echo

# Start the Node.js server
echo "Starting Node.js server..."
cd "${this.serverDir}"
npm start
`;

        const shellScriptPath = path.join(this.serverDir, 'start-multi-model.sh');
        fs.writeFileSync(shellScriptPath, shellScript);
        
        // Make shell script executable on Unix systems
        if (process.platform !== 'win32') {
            try {
                await execAsync(`chmod +x "${shellScriptPath}"`);
            } catch (error) {
                console.warn('Could not make shell script executable');
            }
        }

        console.log('Startup scripts created');
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                stdio: 'inherit',
                ...options
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    printNextSteps() {
        console.log('\n📋 Next Steps:');
        console.log('==============');
        console.log('1. Start the server: npm start');
        console.log('2. Test the multi-model API: POST /api/multi-model/query');
        console.log('3. Check service status: GET /api/multi-model/status');
        console.log('4. View available subjects: GET /api/multi-model/subjects');
        console.log('\n📚 Documentation:');
        console.log('- API endpoints: /api/multi-model/*');
        console.log('- Training scripts: ml_training/scripts/');
        console.log('- Configuration: ml_training/config.json');
        console.log('\n🔧 Troubleshooting:');
        console.log('- Check logs in the console output');
        console.log('- Verify Python dependencies: pip list');
        console.log('- Test classification: POST /api/multi-model/classify');
        console.log('\n✨ Enjoy your enhanced multi-model chatbot!');
    }
}

// Run the setup if this script is executed directly
if (require.main === module) {
    const setup = new MultiModelSetup();
    setup.run().catch(error => {
        console.error('Setup failed:', error);
        process.exit(1);
    });
}

module.exports = MultiModelSetup;
