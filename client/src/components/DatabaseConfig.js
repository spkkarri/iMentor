import React, { useState, useEffect } from 'react';
import { 
    getSupportedDatabaseTypes, 
    testDatabaseConnection, 
    getDatabaseSchema,
    extractTrainingData,
    validateTrainingData,
    getDataFormats
} from '../services/api';
import './DatabaseConfig.css';

const DatabaseConfig = ({ onDataExtracted, selectedSubject }) => {
    const [supportedTypes, setSupportedTypes] = useState([]);
    const [dataFormats, setDataFormats] = useState([]);
    const [selectedType, setSelectedType] = useState('');
    const [config, setConfig] = useState({});
    const [connectionStatus, setConnectionStatus] = useState('');
    const [schema, setSchema] = useState(null);
    const [extractionConfig, setExtractionConfig] = useState({});
    const [selectedFormat, setSelectedFormat] = useState('conversational');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1); // 1: Config, 2: Schema, 3: Extract, 4: Validate

    useEffect(() => {
        loadSupportedTypes();
        loadDataFormats();
    }, []);

    const loadSupportedTypes = async () => {
        try {
            const response = await getSupportedDatabaseTypes();
            setSupportedTypes(response.data.types);
        } catch (error) {
            console.warn('API endpoint not available, using fallback database types');
            // Fallback supported database types
            setSupportedTypes([
                {
                    id: 'postgresql',
                    name: 'PostgreSQL',
                    icon: '🐘',
                    description: 'Advanced open-source relational database',
                    defaultPort: 5432,
                    connectionFields: ['host', 'port', 'database', 'username', 'password']
                },
                {
                    id: 'mysql',
                    name: 'MySQL',
                    icon: '🐬',
                    description: 'Popular open-source relational database',
                    defaultPort: 3306,
                    connectionFields: ['host', 'port', 'database', 'username', 'password']
                },
                {
                    id: 'mongodb',
                    name: 'MongoDB',
                    icon: '🍃',
                    description: 'Document-oriented NoSQL database',
                    defaultPort: 27017,
                    connectionFields: ['host', 'port', 'database', 'username', 'password', 'authSource']
                },
                {
                    id: 'sqlite',
                    name: 'SQLite',
                    icon: '📁',
                    description: 'Lightweight file-based database',
                    defaultPort: null,
                    connectionFields: ['filepath']
                },
                {
                    id: 'redis',
                    name: 'Redis',
                    icon: '🔴',
                    description: 'In-memory data structure store',
                    defaultPort: 6379,
                    connectionFields: ['host', 'port', 'password', 'database']
                },
                {
                    id: 'elasticsearch',
                    name: 'Elasticsearch',
                    icon: '🔍',
                    description: 'Distributed search and analytics engine',
                    defaultPort: 9200,
                    connectionFields: ['host', 'port', 'index', 'username', 'password']
                }
            ]);
        }
    };

    const loadDataFormats = async () => {
        try {
            const response = await getDataFormats();
            setDataFormats(response.data.formats);
        } catch (error) {
            console.warn('API endpoint not available, using fallback data formats');
            // Fallback data formats when API is not available
            setDataFormats([
                {
                    id: 'conversational',
                    name: 'Conversational',
                    description: 'Question-answer pairs for chat training',
                    schema: { input: 'text', output: 'text' },
                    example: { input: "What is AI?", output: "Artificial Intelligence is..." }
                },
                {
                    id: 'instruction',
                    name: 'Instruction Following',
                    description: 'Instruction-response pairs',
                    schema: { instruction: 'text', response: 'text' },
                    example: { instruction: "Explain quantum physics", response: "Quantum physics is..." }
                },
                {
                    id: 'classification',
                    name: 'Text Classification',
                    description: 'Text with category labels',
                    schema: { text: 'text', label: 'category' },
                    example: { text: "This movie is great!", label: "positive" }
                },
                {
                    id: 'completion',
                    name: 'Text Completion',
                    description: 'Incomplete text with completions',
                    schema: { prompt: 'text', completion: 'text' },
                    example: { prompt: "The capital of France is", completion: "Paris" }
                },
                {
                    id: 'summarization',
                    name: 'Text Summarization',
                    description: 'Long text with summaries',
                    schema: { document: 'text', summary: 'text' },
                    example: { document: "Long article...", summary: "Brief summary..." }
                }
            ]);
        }
    };

    const handleTypeChange = (type) => {
        setSelectedType(type);
        setConfig({});
        setConnectionStatus('');
        setSchema(null);
        setStep(1);
        
        // Set default values based on type
        const typeInfo = supportedTypes.find(t => t.type === type);
        if (typeInfo) {
            const defaultConfig = {};
            if (type === 'mysql') {
                defaultConfig.port = 3306;
            } else if (type === 'postgresql') {
                defaultConfig.port = 5432;
            } else if (type === 'mongodb') {
                defaultConfig.port = 27017;
            }
            setConfig(defaultConfig);
        }
    };

    const handleConfigChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
        setConnectionStatus('');
    };

    const testConnection = async () => {
        try {
            setLoading(true);
            setError('');
            
            const testConfig = { ...config, type: selectedType };
            const response = await testDatabaseConnection(testConfig);
            
            if (response.data.success) {
                setConnectionStatus('success');
                setStep(2);
                await loadSchema();
            } else {
                setConnectionStatus('failed');
                setError(response.data.error || 'Connection failed');
            }
        } catch (error) {
            setConnectionStatus('failed');
            setError(error.response?.data?.error || 'Connection test failed');
        } finally {
            setLoading(false);
        }
    };

    const loadSchema = async () => {
        try {
            setLoading(true);
            const testConfig = { ...config, type: selectedType };
            const response = await getDatabaseSchema(testConfig);
            
            if (response.data.success) {
                setSchema(response.data.schema);
            } else {
                setError(response.data.error || 'Failed to load schema');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to load schema');
        } finally {
            setLoading(false);
        }
    };

    const handleExtract = async () => {
        try {
            setLoading(true);
            setError('');
            
            const dbConfig = { ...config, type: selectedType };
            const response = await extractTrainingData({ dbConfig, extractionConfig });
            
            if (response.data.success) {
                setStep(4);
                await validateExtractedData(response.data.data.data);
            } else {
                setError(response.data.error || 'Data extraction failed');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Data extraction failed');
        } finally {
            setLoading(false);
        }
    };

    const validateExtractedData = async (data) => {
        try {
            setLoading(true);
            const response = await validateTrainingData(data, selectedFormat);
            
            if (response.data.success) {
                onDataExtracted({
                    data: response.data.validation.cleanedData,
                    format: selectedFormat,
                    validation: response.data.validation,
                    report: response.data.report,
                    source: 'database',
                    config: { database: config, extraction: extractionConfig }
                });
            } else {
                setError(response.data.error || 'Data validation failed');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Data validation failed');
        } finally {
            setLoading(false);
        }
    };

    const renderConfigForm = () => {
        const typeInfo = supportedTypes.find(t => t.type === selectedType);
        if (!typeInfo) return null;

        return (
            <div className="config-form">
                <h4>Database Configuration</h4>
                
                {typeInfo.fields.map(field => (
                    <div key={field} className="form-group">
                        <label>{field.charAt(0).toUpperCase() + field.slice(1)}:</label>
                        <input
                            type={field.includes('password') ? 'password' : 'text'}
                            value={config[field] || ''}
                            onChange={(e) => handleConfigChange(field, e.target.value)}
                            placeholder={`Enter ${field}`}
                        />
                    </div>
                ))}

                {typeInfo.optionalFields?.map(field => (
                    <div key={field} className="form-group">
                        <label>{field.charAt(0).toUpperCase() + field.slice(1)} (Optional):</label>
                        <input
                            type={field.includes('password') ? 'password' : 'text'}
                            value={config[field] || ''}
                            onChange={(e) => handleConfigChange(field, e.target.value)}
                            placeholder={`Enter ${field}`}
                        />
                    </div>
                ))}

                <button 
                    className="test-btn"
                    onClick={testConnection}
                    disabled={loading}
                >
                    {loading ? 'Testing...' : 'Test Connection'}
                </button>

                {connectionStatus === 'success' && (
                    <div className="status-message success">
                        ✅ Connection successful!
                    </div>
                )}

                {connectionStatus === 'failed' && (
                    <div className="status-message error">
                        ❌ Connection failed
                    </div>
                )}
            </div>
        );
    };

    const renderSchemaView = () => {
        if (!schema) return null;

        const tables = schema.tables || schema.collections || [];

        return (
            <div className="schema-view">
                <h4>Database Schema</h4>
                <div className="schema-info">
                    <p><strong>Database:</strong> {schema.database}</p>
                    <p><strong>Type:</strong> {schema.type}</p>
                    <p><strong>Tables/Collections:</strong> {tables.length}</p>
                </div>

                <div className="tables-list">
                    {tables.map(table => (
                        <div key={table.name} className="table-item">
                            <div className="table-header">
                                <span className="table-name">{table.name}</span>
                                <span className="table-count">
                                    {table.rowCount || table.estimatedCount || 0} rows
                                </span>
                            </div>
                            <div className="table-columns">
                                {(table.columns || table.fields || []).slice(0, 5).map(col => (
                                    <span key={col.name || col} className="column-tag">
                                        {col.name || col}
                                    </span>
                                ))}
                                {(table.columns || table.fields || []).length > 5 && (
                                    <span className="more-columns">
                                        +{(table.columns || table.fields || []).length - 5} more
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <button 
                    className="next-btn"
                    onClick={() => setStep(3)}
                >
                    Configure Data Extraction
                </button>
            </div>
        );
    };

    const renderExtractionConfig = () => {
        if (!schema) return null;

        const tables = schema.tables || schema.collections || [];

        return (
            <div className="extraction-config">
                <h4>Data Extraction Configuration</h4>
                
                <div className="form-group">
                    <label>Data Format:</label>
                    <select 
                        value={selectedFormat} 
                        onChange={(e) => setSelectedFormat(e.target.value)}
                    >
                        {dataFormats.map(format => (
                            <option key={format.format} value={format.format}>
                                {format.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Table/Collection:</label>
                    <select 
                        value={extractionConfig.table || extractionConfig.collection || ''}
                        onChange={(e) => setExtractionConfig(prev => ({
                            ...prev,
                            [schema.type === 'mongodb' ? 'collection' : 'table']: e.target.value
                        }))}
                    >
                        <option value="">Select table/collection</option>
                        {tables.map(table => (
                            <option key={table.name} value={table.name}>
                                {table.name} ({table.rowCount || table.estimatedCount || 0} rows)
                            </option>
                        ))}
                    </select>
                </div>

                {schema.type !== 'mongodb' && (
                    <>
                        <div className="form-group">
                            <label>Columns (comma-separated, leave empty for all):</label>
                            <input
                                type="text"
                                value={extractionConfig.columns?.join(', ') || ''}
                                onChange={(e) => setExtractionConfig(prev => ({
                                    ...prev,
                                    columns: e.target.value ? e.target.value.split(',').map(c => c.trim()) : []
                                }))}
                                placeholder="column1, column2, column3"
                            />
                        </div>

                        <div className="form-group">
                            <label>WHERE Clause (optional):</label>
                            <input
                                type="text"
                                value={extractionConfig.whereClause || ''}
                                onChange={(e) => setExtractionConfig(prev => ({
                                    ...prev,
                                    whereClause: e.target.value
                                }))}
                                placeholder="status = 'active' AND created_at > '2023-01-01'"
                            />
                        </div>
                    </>
                )}

                {schema.type === 'mongodb' && (
                    <>
                        <div className="form-group">
                            <label>Fields (comma-separated, leave empty for all):</label>
                            <input
                                type="text"
                                value={extractionConfig.fields?.join(', ') || ''}
                                onChange={(e) => setExtractionConfig(prev => ({
                                    ...prev,
                                    fields: e.target.value ? e.target.value.split(',').map(f => f.trim()) : []
                                }))}
                                placeholder="field1, field2, field3"
                            />
                        </div>

                        <div className="form-group">
                            <label>Query (JSON, optional):</label>
                            <textarea
                                value={extractionConfig.query ? JSON.stringify(extractionConfig.query, null, 2) : ''}
                                onChange={(e) => {
                                    try {
                                        const query = e.target.value ? JSON.parse(e.target.value) : {};
                                        setExtractionConfig(prev => ({ ...prev, query }));
                                    } catch (err) {
                                        // Invalid JSON, ignore
                                    }
                                }}
                                placeholder='{"status": "active", "created_at": {"$gte": "2023-01-01"}}'
                                rows={3}
                            />
                        </div>
                    </>
                )}

                <div className="form-group">
                    <label>Limit (max records to extract):</label>
                    <input
                        type="number"
                        value={extractionConfig.limit || 1000}
                        onChange={(e) => setExtractionConfig(prev => ({
                            ...prev,
                            limit: parseInt(e.target.value) || 1000
                        }))}
                        min="1"
                        max="10000"
                    />
                </div>

                <div className="format-info">
                    <h5>Expected Data Format: {dataFormats.find(f => f.format === selectedFormat)?.name}</h5>
                    <p>{dataFormats.find(f => f.format === selectedFormat)?.description}</p>
                    <div className="format-example">
                        <strong>Required fields:</strong>
                        <code>
                            {JSON.stringify(
                                dataFormats.find(f => f.format === selectedFormat)?.structure?.required || [],
                                null, 2
                            )}
                        </code>
                    </div>
                </div>

                <button 
                    className="extract-btn"
                    onClick={handleExtract}
                    disabled={loading || !extractionConfig.table && !extractionConfig.collection}
                >
                    {loading ? 'Extracting...' : 'Extract Training Data'}
                </button>
            </div>
        );
    };

    return (
        <div className="database-config">
            <div className="config-header">
                <h3>🗄️ Database Integration</h3>
                <div className="step-indicator">
                    <span className={`step ${step >= 1 ? 'active' : ''}`}>1. Connect</span>
                    <span className={`step ${step >= 2 ? 'active' : ''}`}>2. Schema</span>
                    <span className={`step ${step >= 3 ? 'active' : ''}`}>3. Extract</span>
                    <span className={`step ${step >= 4 ? 'active' : ''}`}>4. Validate</span>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    ⚠️ {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {step === 1 && (
                <div className="database-types">
                    <h4>Select Database Type</h4>
                    <div className="types-grid">
                        {supportedTypes.map(type => (
                            <div 
                                key={type.type}
                                className={`type-card ${selectedType === type.type ? 'selected' : ''}`}
                                onClick={() => handleTypeChange(type.type)}
                            >
                                <div className="type-name">{type.name}</div>
                                <div className="type-desc">{type.description}</div>
                            </div>
                        ))}
                    </div>

                    {selectedType && renderConfigForm()}
                </div>
            )}

            {step === 2 && renderSchemaView()}
            {step === 3 && renderExtractionConfig()}

            {step === 4 && (
                <div className="validation-complete">
                    <div className="success-icon">✅</div>
                    <h4>Data Extracted and Validated Successfully!</h4>
                    <p>Your training data has been extracted from the database and validated for training.</p>
                </div>
            )}
        </div>
    );
};

export default DatabaseConfig;
