/**
 * Database Service for Training Data Management
 * Handles connections to various databases and data extraction for training
 */

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { MongoClient } = require('mongodb');

class DatabaseService {
    constructor() {
        this.connections = new Map();
        this.supportedDatabases = [
            'mongodb',
            'mysql',
            'postgresql',
            'sqlite',
            'mongodb_atlas'
        ];
    }

    /**
     * Test database connection
     */
    async testConnection(config) {
        try {
            const { type, host, port, database, username, password, connectionString } = config;
            
            switch (type) {
                case 'mongodb':
                case 'mongodb_atlas':
                    return await this.testMongoConnection(config);
                case 'mysql':
                    return await this.testMySQLConnection(config);
                case 'postgresql':
                    return await this.testPostgreSQLConnection(config);
                case 'sqlite':
                    return await this.testSQLiteConnection(config);
                default:
                    throw new Error(`Unsupported database type: ${type}`);
            }
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async testMongoConnection(config) {
        const { connectionString, host, port, database, username, password } = config;
        
        let uri;
        if (connectionString) {
            uri = connectionString;
        } else {
            const auth = username && password ? `${username}:${password}@` : '';
            uri = `mongodb://${auth}${host}:${port || 27017}/${database}`;
        }

        const client = new MongoClient(uri);
        await client.connect();
        await client.db().admin().ping();
        await client.close();
        
        return { success: true, message: 'MongoDB connection successful' };
    }

    async testMySQLConnection(config) {
        const { host, port, database, username, password } = config;
        
        const connection = await mysql.createConnection({
            host: host,
            port: port || 3306,
            user: username,
            password: password,
            database: database
        });

        await connection.execute('SELECT 1');
        await connection.end();
        
        return { success: true, message: 'MySQL connection successful' };
    }

    async testPostgreSQLConnection(config) {
        const { host, port, database, username, password } = config;
        
        const pool = new Pool({
            host: host,
            port: port || 5432,
            database: database,
            user: username,
            password: password,
        });

        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        
        return { success: true, message: 'PostgreSQL connection successful' };
    }

    async testSQLiteConnection(config) {
        const { filePath } = config;
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(filePath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    db.close();
                    resolve({ success: true, message: 'SQLite connection successful' });
                }
            });
        });
    }

    /**
     * Get database schema/structure
     */
    async getDatabaseSchema(config) {
        try {
            switch (config.type) {
                case 'mongodb':
                case 'mongodb_atlas':
                    return await this.getMongoSchema(config);
                case 'mysql':
                    return await this.getMySQLSchema(config);
                case 'postgresql':
                    return await this.getPostgreSQLSchema(config);
                case 'sqlite':
                    return await this.getSQLiteSchema(config);
                default:
                    throw new Error(`Unsupported database type: ${config.type}`);
            }
        } catch (error) {
            throw new Error(`Failed to get database schema: ${error.message}`);
        }
    }

    async getMongoSchema(config) {
        const { connectionString, host, port, database, username, password } = config;
        
        let uri;
        if (connectionString) {
            uri = connectionString;
        } else {
            const auth = username && password ? `${username}:${password}@` : '';
            uri = `mongodb://${auth}${host}:${port || 27017}/${database}`;
        }

        const client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db(database);
        const collections = await db.listCollections().toArray();
        
        const schema = {
            type: 'mongodb',
            database: database,
            collections: []
        };

        for (const collection of collections) {
            const collectionName = collection.name;
            const sampleDoc = await db.collection(collectionName).findOne();
            
            schema.collections.push({
                name: collectionName,
                fields: sampleDoc ? Object.keys(sampleDoc) : [],
                sampleDocument: sampleDoc,
                estimatedCount: await db.collection(collectionName).estimatedDocumentCount()
            });
        }

        await client.close();
        return schema;
    }

    async getMySQLSchema(config) {
        const { host, port, database, username, password } = config;
        
        const connection = await mysql.createConnection({
            host: host,
            port: port || 3306,
            user: username,
            password: password,
            database: database
        });

        const [tables] = await connection.execute(
            'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
            [database]
        );

        const schema = {
            type: 'mysql',
            database: database,
            tables: []
        };

        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            const [columns] = await connection.execute(
                'SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
                [database, tableName]
            );

            const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
            
            schema.tables.push({
                name: tableName,
                columns: columns.map(col => ({
                    name: col.COLUMN_NAME,
                    type: col.DATA_TYPE,
                    nullable: col.IS_NULLABLE === 'YES'
                })),
                rowCount: countResult[0].count
            });
        }

        await connection.end();
        return schema;
    }

    async getPostgreSQLSchema(config) {
        const { host, port, database, username, password } = config;
        
        const pool = new Pool({
            host: host,
            port: port || 5432,
            database: database,
            user: username,
            password: password,
        });

        const client = await pool.connect();
        
        const tablesResult = await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        );

        const schema = {
            type: 'postgresql',
            database: database,
            tables: []
        };

        for (const table of tablesResult.rows) {
            const tableName = table.table_name;
            const columnsResult = await client.query(
                'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1',
                [tableName]
            );

            const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            
            schema.tables.push({
                name: tableName,
                columns: columnsResult.rows.map(col => ({
                    name: col.column_name,
                    type: col.data_type,
                    nullable: col.is_nullable === 'YES'
                })),
                rowCount: parseInt(countResult.rows[0].count)
            });
        }

        client.release();
        await pool.end();
        return schema;
    }

    async getSQLiteSchema(config) {
        const { filePath } = config;
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(filePath);
            
            db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
                if (err) {
                    reject(err);
                    return;
                }

                const schema = {
                    type: 'sqlite',
                    database: filePath,
                    tables: []
                };

                let completed = 0;
                const totalTables = tables.length;

                if (totalTables === 0) {
                    db.close();
                    resolve(schema);
                    return;
                }

                tables.forEach(table => {
                    const tableName = table.name;
                    
                    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, countResult) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            schema.tables.push({
                                name: tableName,
                                columns: columns.map(col => ({
                                    name: col.name,
                                    type: col.type,
                                    nullable: col.notnull === 0
                                })),
                                rowCount: countResult.count
                            });

                            completed++;
                            if (completed === totalTables) {
                                db.close();
                                resolve(schema);
                            }
                        });
                    });
                });
            });
        });
    }

    /**
     * Extract training data from database
     */
    async extractTrainingData(config, extractionConfig) {
        try {
            switch (config.type) {
                case 'mongodb':
                case 'mongodb_atlas':
                    return await this.extractMongoData(config, extractionConfig);
                case 'mysql':
                    return await this.extractMySQLData(config, extractionConfig);
                case 'postgresql':
                    return await this.extractPostgreSQLData(config, extractionConfig);
                case 'sqlite':
                    return await this.extractSQLiteData(config, extractionConfig);
                default:
                    throw new Error(`Unsupported database type: ${config.type}`);
            }
        } catch (error) {
            throw new Error(`Failed to extract training data: ${error.message}`);
        }
    }

    async extractMongoData(config, extractionConfig) {
        const { collection, fields, query, limit } = extractionConfig;
        const { connectionString, host, port, database, username, password } = config;
        
        let uri;
        if (connectionString) {
            uri = connectionString;
        } else {
            const auth = username && password ? `${username}:${password}@` : '';
            uri = `mongodb://${auth}${host}:${port || 27017}/${database}`;
        }

        const client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db(database);
        const projection = fields && fields.length > 0 ? 
            fields.reduce((acc, field) => ({ ...acc, [field]: 1 }), {}) : {};
        
        const cursor = db.collection(collection)
            .find(query || {}, { projection })
            .limit(limit || 1000);
        
        const documents = await cursor.toArray();
        await client.close();
        
        return {
            data: documents,
            count: documents.length,
            format: 'mongodb_documents'
        };
    }

    async extractMySQLData(config, extractionConfig) {
        const { table, columns, whereClause, limit } = extractionConfig;
        const { host, port, database, username, password } = config;
        
        const connection = await mysql.createConnection({
            host: host,
            port: port || 3306,
            user: username,
            password: password,
            database: database
        });

        const columnList = columns && columns.length > 0 ? columns.join(', ') : '*';
        const whereSQL = whereClause ? ` WHERE ${whereClause}` : '';
        const limitSQL = limit ? ` LIMIT ${limit}` : ' LIMIT 1000';
        
        const query = `SELECT ${columnList} FROM ${table}${whereSQL}${limitSQL}`;
        const [rows] = await connection.execute(query);
        
        await connection.end();
        
        return {
            data: rows,
            count: rows.length,
            format: 'sql_rows'
        };
    }

    async extractPostgreSQLData(config, extractionConfig) {
        const { table, columns, whereClause, limit } = extractionConfig;
        const { host, port, database, username, password } = config;
        
        const pool = new Pool({
            host: host,
            port: port || 5432,
            database: database,
            user: username,
            password: password,
        });

        const client = await pool.connect();
        
        const columnList = columns && columns.length > 0 ? columns.join(', ') : '*';
        const whereSQL = whereClause ? ` WHERE ${whereClause}` : '';
        const limitSQL = limit ? ` LIMIT ${limit}` : ' LIMIT 1000';
        
        const query = `SELECT ${columnList} FROM ${table}${whereSQL}${limitSQL}`;
        const result = await client.query(query);
        
        client.release();
        await pool.end();
        
        return {
            data: result.rows,
            count: result.rows.length,
            format: 'sql_rows'
        };
    }

    async extractSQLiteData(config, extractionConfig) {
        const { table, columns, whereClause, limit } = extractionConfig;
        const { filePath } = config;
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(filePath);
            
            const columnList = columns && columns.length > 0 ? columns.join(', ') : '*';
            const whereSQL = whereClause ? ` WHERE ${whereClause}` : '';
            const limitSQL = limit ? ` LIMIT ${limit}` : ' LIMIT 1000';
            
            const query = `SELECT ${columnList} FROM ${table}${whereSQL}${limitSQL}`;
            
            db.all(query, [], (err, rows) => {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        data: rows,
                        count: rows.length,
                        format: 'sql_rows'
                    });
                }
            });
        });
    }
}

module.exports = new DatabaseService();
