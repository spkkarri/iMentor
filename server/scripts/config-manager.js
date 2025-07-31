#!/usr/bin/env node
/**
 * Configuration Manager CLI Tool
 * Command-line interface for managing multi-model configuration
 */

const config = require('../config/multiModelConfig');
const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.commands = {
            'show': this.showConfig.bind(this),
            'get': this.getValue.bind(this),
            'set': this.setValue.bind(this),
            'subjects': this.manageSubjects.bind(this),
            'validate': this.validateConfig.bind(this),
            'reset': this.resetConfig.bind(this),
            'export': this.exportConfig.bind(this),
            'import': this.importConfig.bind(this),
            'help': this.showHelp.bind(this)
        };
    }

    async run() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            this.showHelp();
            return;
        }

        const command = args[0];
        const commandArgs = args.slice(1);

        if (this.commands[command]) {
            try {
                await this.commands[command](commandArgs);
            } catch (error) {
                console.error(`❌ Error executing command '${command}':`, error.message);
                process.exit(1);
            }
        } else {
            console.error(`❌ Unknown command: ${command}`);
            this.showHelp();
            process.exit(1);
        }
    }

    showConfig(args) {
        const section = args[0];
        
        if (section) {
            const value = config.get(section);
            if (value !== null) {
                console.log(`📋 Configuration section: ${section}`);
                console.log(JSON.stringify(value, null, 2));
            } else {
                console.error(`❌ Configuration section '${section}' not found`);
            }
        } else {
            console.log('📋 Complete Configuration:');
            console.log(JSON.stringify(config.getAll(), null, 2));
        }
    }

    getValue(args) {
        if (args.length === 0) {
            console.error('❌ Please specify a configuration path');
            console.log('Example: node config-manager.js get system.enabled');
            return;
        }

        const path = args[0];
        const value = config.get(path);
        
        if (value !== null) {
            console.log(`📋 ${path}: ${JSON.stringify(value, null, 2)}`);
        } else {
            console.error(`❌ Configuration path '${path}' not found`);
        }
    }

    setValue(args) {
        if (args.length < 2) {
            console.error('❌ Please specify both path and value');
            console.log('Example: node config-manager.js set system.enabled true');
            return;
        }

        const path = args[0];
        let value = args[1];

        // Try to parse as JSON
        try {
            value = JSON.parse(value);
        } catch (error) {
            // Keep as string if not valid JSON
        }

        const success = config.set(path, value);
        
        if (success) {
            console.log(`✅ Set ${path} = ${JSON.stringify(value)}`);
        } else {
            console.error(`❌ Failed to set ${path}`);
        }
    }

    manageSubjects(args) {
        const action = args[0];
        
        if (!action) {
            // List all subjects
            console.log('📚 Available Subjects:');
            console.log('===================');
            
            const subjects = config.getEnabledSubjects();
            subjects.forEach(subject => {
                const status = subject.enabled ? '✅' : '❌';
                console.log(`${status} ${subject.id}: ${subject.name}`);
                console.log(`   Description: ${subject.description}`);
                console.log(`   Priority: ${subject.priority}`);
                console.log(`   Keywords: ${subject.keywords.slice(0, 5).join(', ')}...`);
                console.log('');
            });
            return;
        }

        switch (action) {
            case 'add':
                this.addSubject(args.slice(1));
                break;
            case 'remove':
                this.removeSubject(args.slice(1));
                break;
            case 'enable':
                this.toggleSubject(args[1], true);
                break;
            case 'disable':
                this.toggleSubject(args[1], false);
                break;
            case 'show':
                this.showSubject(args[1]);
                break;
            default:
                console.error(`❌ Unknown subjects action: ${action}`);
                console.log('Available actions: add, remove, enable, disable, show');
        }
    }

    addSubject(args) {
        if (args.length < 2) {
            console.error('❌ Please specify subject ID and name');
            console.log('Example: node config-manager.js subjects add physics "Physics"');
            return;
        }

        const id = args[0];
        const name = args[1];
        const description = args[2] || `${name} related questions and concepts`;

        const subjectConfig = {
            name,
            description,
            keywords: [id.toLowerCase(), name.toLowerCase()],
            patterns: [],
            priority: 1,
            modelPath: `models/${id}`,
            enabled: true
        };

        const success = config.setSubject(id, subjectConfig);
        
        if (success) {
            console.log(`✅ Added subject: ${id} (${name})`);
            console.log('💡 Don\'t forget to add keywords and train a model for this subject');
        } else {
            console.error(`❌ Failed to add subject: ${id}`);
        }
    }

    removeSubject(args) {
        if (args.length === 0) {
            console.error('❌ Please specify subject ID');
            return;
        }

        const id = args[0];
        const success = config.removeSubject(id);
        
        if (success) {
            console.log(`✅ Removed subject: ${id}`);
        } else {
            console.error(`❌ Failed to remove subject: ${id} (not found)`);
        }
    }

    toggleSubject(id, enabled) {
        if (!id) {
            console.error('❌ Please specify subject ID');
            return;
        }

        const subject = config.getSubject(id);
        if (!subject) {
            console.error(`❌ Subject '${id}' not found`);
            return;
        }

        subject.enabled = enabled;
        const success = config.setSubject(id, subject);
        
        if (success) {
            const status = enabled ? 'enabled' : 'disabled';
            console.log(`✅ Subject '${id}' ${status}`);
        } else {
            console.error(`❌ Failed to update subject: ${id}`);
        }
    }

    showSubject(id) {
        if (!id) {
            console.error('❌ Please specify subject ID');
            return;
        }

        const subject = config.getSubject(id);
        if (!subject) {
            console.error(`❌ Subject '${id}' not found`);
            return;
        }

        console.log(`📚 Subject: ${subject.name} (${subject.id})`);
        console.log('='.repeat(50));
        console.log(`Description: ${subject.description}`);
        console.log(`Enabled: ${subject.enabled ? 'Yes' : 'No'}`);
        console.log(`Priority: ${subject.priority}`);
        console.log(`Model Path: ${subject.modelPath}`);
        console.log(`Keywords (${subject.keywords.length}): ${subject.keywords.join(', ')}`);
        console.log(`Patterns: ${subject.patterns.length} defined`);
    }

    validateConfig() {
        console.log('🔍 Validating configuration...');
        
        const validation = config.validate();
        
        if (validation.valid) {
            console.log('✅ Configuration is valid');
        } else {
            console.log('❌ Configuration has errors:');
            validation.errors.forEach(error => {
                console.log(`   • ${error}`);
            });
        }

        // Additional checks
        const subjects = config.getEnabledSubjects();
        console.log(`\n📊 Summary:`);
        console.log(`   • ${subjects.length} enabled subjects`);
        console.log(`   • Python service port: ${config.get('system.pythonServicePort')}`);
        console.log(`   • Max models in memory: ${config.get('modelManagement.maxModelsInMemory')}`);
        console.log(`   • Model caching: ${config.get('modelManagement.enableModelCaching') ? 'enabled' : 'disabled'}`);
    }

    resetConfig() {
        console.log('⚠️  This will reset all configuration to defaults. Continue? (y/N)');
        
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', (key) => {
            const input = key.toString().toLowerCase();
            
            if (input === 'y') {
                const success = config.reset();
                if (success) {
                    console.log('\n✅ Configuration reset to defaults');
                } else {
                    console.log('\n❌ Failed to reset configuration');
                }
            } else {
                console.log('\n❌ Reset cancelled');
            }
            
            process.exit(0);
        });
    }

    exportConfig(args) {
        const outputFile = args[0] || 'multi-model-config-export.json';
        
        try {
            const configData = config.getAll();
            fs.writeFileSync(outputFile, JSON.stringify(configData, null, 2));
            console.log(`✅ Configuration exported to: ${outputFile}`);
        } catch (error) {
            console.error(`❌ Failed to export configuration: ${error.message}`);
        }
    }

    importConfig(args) {
        const inputFile = args[0];
        
        if (!inputFile) {
            console.error('❌ Please specify input file');
            return;
        }

        if (!fs.existsSync(inputFile)) {
            console.error(`❌ File not found: ${inputFile}`);
            return;
        }

        try {
            const importedConfig = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
            
            // Merge with current config
            const currentConfig = config.getAll();
            const mergedConfig = { ...currentConfig, ...importedConfig };
            
            // Save merged config
            fs.writeFileSync(config.configPath, JSON.stringify(mergedConfig, null, 2));
            
            console.log(`✅ Configuration imported from: ${inputFile}`);
            console.log('💡 Restart the service to apply changes');
        } catch (error) {
            console.error(`❌ Failed to import configuration: ${error.message}`);
        }
    }

    showHelp() {
        console.log(`
🔧 Multi-Model Configuration Manager

Usage: node config-manager.js <command> [arguments]

Commands:
  show [section]              Show configuration (optionally specific section)
  get <path>                  Get configuration value by path
  set <path> <value>          Set configuration value
  subjects [action] [args]    Manage subjects
  validate                    Validate current configuration
  reset                       Reset to default configuration
  export [file]               Export configuration to file
  import <file>               Import configuration from file
  help                        Show this help message

Subject Actions:
  subjects                    List all subjects
  subjects add <id> <name>    Add new subject
  subjects remove <id>        Remove subject
  subjects enable <id>        Enable subject
  subjects disable <id>       Disable subject
  subjects show <id>          Show subject details

Examples:
  node config-manager.js show system
  node config-manager.js get system.enabled
  node config-manager.js set system.pythonServicePort 8002
  node config-manager.js subjects add physics "Physics"
  node config-manager.js subjects enable mathematics
  node config-manager.js validate
  node config-manager.js export my-config.json

Configuration Paths:
  system.enabled                          Enable/disable multi-model system
  system.pythonServicePort               Python service port
  modelManagement.maxModelsInMemory      Maximum models in memory
  modelManagement.enableModelCaching    Enable model caching
  classification.confidenceThreshold    Classification confidence threshold
  routing.strategy                       Routing strategy
  subjects.<id>.enabled                  Enable/disable specific subject
`);
    }
}

// Run the CLI if this script is executed directly
if (require.main === module) {
    const manager = new ConfigManager();
    manager.run().catch(error => {
        console.error('CLI error:', error);
        process.exit(1);
    });
}

module.exports = ConfigManager;
