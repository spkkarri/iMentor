const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// Define a maximum number of pages for PDFs to prevent memory overload
const MAX_PDF_PAGES = 20; 

class DocumentProcessor {
    constructor(vectorStore) {
        if (!vectorStore) {
            throw new Error("DocumentProcessor requires a VectorStore instance.");
        }
        this.chunkSize = 512;
        this.chunkOverlap = 100;
        this.vectorStore = vectorStore;
    }

    async parseFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        try {
            let text = '';
            switch (ext) {
                case '.txt':
                    // For text files, we still read them, but large files are the issue.
                    // The memory increase in package.json handles typical text files.
                    text = fs.readFileSync(filePath, 'utf-8');
                    break;
                case '.pdf':
                    console.log(`📄 Parsing PDF: ${path.basename(filePath)}`);
                    const dataBuffer = fs.readFileSync(filePath);
                    // --- FIX: Only process the first N pages of large PDFs ---
                    const options = {
                        max: MAX_PDF_PAGES
                    };
                    const data = await pdf(dataBuffer, options);
                    text = data.text;
                    console.log(`✅ Parsed first ${data.numpages} pages of PDF.`);
                    break;
                case '.docx':
                    const result = await mammoth.extractRawText({ path: filePath });
                    text = result.value;
                    break;
                default:
                    console.warn(`Unsupported file type for parsing: ${ext}. Skipping content extraction.`);
                    return '';
            }
            return text || '';
        } catch (error) {
            console.error(`Error parsing file ${filePath}:`, error.message);
            return '';
        }
    }

    chunkText(text, filename) {
        if (typeof text !== 'string' || !text.trim()) {
            return [];
        }

        const chunks = [];
        let startIndex = 0;
        let chunkIndex = 0;

        while (startIndex < text.length) {
            const endIndex = Math.min(startIndex + this.chunkSize, text.length);
            let chunkText = text.slice(startIndex, endIndex);

            if (endIndex < text.length) {
                const lastSpace = chunkText.lastIndexOf(' ');
                if (lastSpace > 0) {
                    chunkText = chunkText.substring(0, lastSpace);
                }
            }
            
            // Langchain's MemoryVectorStore expects Document objects with pageContent and metadata
            chunks.push({
                pageContent: chunkText.trim(),
                metadata: {
                    source: filename,
                    chunkId: `${filename}_chunk_${chunkIndex}`
                }
            });

            const actualEndIndex = startIndex + chunkText.length;
            startIndex = actualEndIndex - this.chunkOverlap;
            if (startIndex <= actualEndIndex - chunkText.length) {
                startIndex = actualEndIndex;
            }
            chunkIndex++;
        }
        return chunks.filter(chunk => chunk.pageContent.length > 0);
    }

    async processFile(filePath, options = {}) {
        try {
            console.log(`📄 Processing file: ${options.originalName}`);
            const text = await this.parseFile(filePath);
            
            if (!text) {
                console.warn(`⚠️ No text content extracted from file: ${options.originalName}`);
                return { success: true, chunksAdded: 0, message: 'File had no readable content.' };
            }

            const chunks = this.chunkText(text, options.originalName);

            if (chunks.length === 0) {
                return { success: true, chunksAdded: 0, message: 'File had no content to chunk.' };
            }

            chunks.forEach(chunk => {
                chunk.metadata.userId = options.userId;
                chunk.metadata.fileId = options.fileId; 
            });

            const result = await this.vectorStore.addDocuments(chunks);
            return { success: true, chunksAdded: result.count };
            
        } catch (error) {
            console.error(`❌ Error during processFile for ${options.originalName}:`, error.message);
            throw error;
        }
    }
}

module.exports = DocumentProcessor;