const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { PptxGenJs } = require('nodejs-pptx');

class DocumentProcessor {
  constructor(vectorStore) {
    if (!vectorStore) {
      throw new Error("DocumentProcessor requires a VectorStore instance.");
    }
    this.chunkSize = 512;
    this.chunkOverlap = 100;
    this.vectorStore = vectorStore; // The new ChromaVectorStore instance
  }

  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.txt':
          return await this.parseTxt(filePath);
        case '.pdf':
          return await this.parsePdf(filePath);
        case '.docx':
          return await this.parseDocx(filePath);
        case '.pptx':
          return await this.parsePptx(filePath);
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      throw error;
    }
  }

  async parseTxt(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  async parsePdf(filePath) {
    try {
      console.log(`🔍 Attempting to parse PDF: ${path.basename(filePath)}`);
    const dataBuffer = fs.readFileSync(filePath);
      console.log(`📊 PDF file size: ${dataBuffer.length} bytes`);
      
    const data = await pdf(dataBuffer);
      console.log(`📄 PDF parsed successfully. Text length: ${data.text ? data.text.length : 0} characters`);
      
      if (!data.text || data.text.trim().length === 0) {
        console.warn(`⚠️ PDF contains no extractable text: ${path.basename(filePath)}`);
        // Return a fallback message instead of empty string
        return `PDF file: ${path.basename(filePath)}. This appears to be an image-based PDF or contains no extractable text.`;
      }
      
    return data.text;
    } catch (error) {
      console.error(`❌ PDF parsing error for ${path.basename(filePath)}:`, error.message);
      // Return a fallback message instead of throwing
      return `PDF file: ${path.basename(filePath)}. Error extracting text: ${error.message}`;
    }
  }

  async parseDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  async parsePptx(filePath) {
    // This is a placeholder and may not extract all text accurately, especially from complex slides.
    // A more robust solution might involve a dedicated library if one exists and is needed.
    const pres = new PptxGenJs();
    try {
        await pres.load(filePath);
        const textContent = [];
        for (const slide of pres.slides) {
            if (slide.objects) {
                for (const object of Object.values(slide.objects)) {
                    if (object.text) {
                        textContent.push(object.text.text);
                    }
                }
            }
        }
        return textContent.join('\n\n');
    } catch (error) {
        console.error('Error parsing PPTX with PptxGenJs:', error);
        // Fallback to the simpler string extraction as a last resort
        const buffer = fs.readFileSync(filePath);
        return buffer.toString('utf8').replace(/[^\x20-\x7E]/g, ' ').trim();
    }
  }

  chunkText(text, filename) {
    if (!text?.trim()) {
      return [];
    }

    const chunks = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + this.chunkSize, text.length);
      let chunkText = text.slice(startIndex, endIndex);

      if (endIndex < text.length && chunkText[chunkText.length - 1] !== ' ') {
        const lastSpaceIndex = chunkText.lastIndexOf(' ');
        if (lastSpaceIndex > 0) {
          chunkText = chunkText.slice(0, lastSpaceIndex);
        }
      }

      chunks.push({
        content: chunkText.trim(),
        chunkIndex,
        startIndex,
        metadata: {
          source: filename,
          chunkId: `${filename}_chunk_${chunkIndex}`
        }
      });

      const actualEndIndex = startIndex + chunkText.length;
      startIndex = Math.max(actualEndIndex - this.chunkOverlap, actualEndIndex);
      chunkIndex++;
    }

    return chunks.filter(chunk => chunk.content.length > 0);
  }

  async processDocument(filePath, filename) {
    const content = await this.parseFile(filePath);
    return this.chunkText(content, filename);
  }

  /**
   * Process a file and add it to the vector store
   * @param {string} filePath - Path to the file
   * @param {Object} options - Processing options
   * @param {string} options.userId - User ID
   * @param {string} options.originalName - Original filename
   * @param {string} options.fileType - File type (pdf, txt, docx, etc.)
   * @param {string} options.fileId - The ID of the file from the database
   * @returns {Promise<Object>} Processing result
   */
  async processFile(filePath, options = {}) {
    try {
      console.log(`📄 Processing file: ${options.originalName}`);
      const text = await this.parseFile(filePath);
      
      if (!text || text.trim().length === 0) {
        throw new Error('No text content extracted from file');
      }

      const chunks = this.chunkText(text, options.originalName);

      if (chunks.length === 0) {
        return { success: true, message: 'File had no content to chunk.' };
      }

      // Add required metadata for ChromaDB filtering
      chunks.forEach(chunk => {
        chunk.metadata.userId = options.userId;
        chunk.metadata.fileId = options.fileId; 
      });

      // The vector store now handles embedding and storage
      const result = await this.vectorStore.addDocuments(chunks);

      console.log(`✅ File processed and added to vector store: ${options.originalName}`);
      return { success: true, chunksAdded: result.count };
      
    } catch (error) {
      console.error(`❌ Error processing file ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Get vector store statistics
   */
  async getStatistics() {
    return this.vectorStore.getStatistics();
  }

  /**
   * Search documents for a user
   */
  async searchDocuments(query, options) {
    // Handle both direct filters and wrapped filters
    const filters = options.filters || options;
    return await this.vectorStore.searchDocuments(query, { filters });
  }
}

module.exports = DocumentProcessor;