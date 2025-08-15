// server/routes/files.js


const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const vectorStore = require('../services/LangchainVectorStore');
const { generatePPT } = require('../services/pptGenerator');
const GeminiService = require('../services/geminiService');
const { GeminiAI } = require('../services/geminiAI');
const DuckDuckGoService = require('../utils/duckduckgo');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const universalAI = require('../services/universalAIService');
const pdfMake = require('pdfmake');

// GET all files for a user (no changes here)
router.get('/', tempAuth, async (req, res) => {
    try {
        const files = await File.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(files);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- NEW: PATCH route to update a file's name ---
// @route   PATCH /api/files/:id
// @desc    Rename a file
// @access  Private
router.patch('/:id', tempAuth, async (req, res) => {
    const { newOriginalName } = req.body;

    if (!newOriginalName) {
        return res.status(400).json({ msg: 'New name is required.' });
    }

    try {
        let file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ msg: 'File not found' });
        }

        // Make sure user owns the file
        if (file.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Update the originalname field
        file.originalname = newOriginalName;
        await file.save();

        res.json(file); // Return the updated file object
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


router.delete('/:id', tempAuth, async (req, res) => {
    try {
        console.log(`[DELETE FILE] Attempting to delete file with ID: ${req.params.id}`);
        const file = await File.findById(req.params.id);

        if (!file) {
            console.log(`[DELETE FILE] File not found in DB for ID: ${req.params.id}`);
            return res.status(404).json({ msg: 'File not found in DB' });
        }

        console.log(`[DELETE FILE] Found file: ${file.originalname}, Path: ${file.path}, User: ${file.user}`);
        if (file.user.toString() !== req.user.id) {
            console.log(`[DELETE FILE] Unauthorized attempt to delete file ID: ${req.params.id} by user: ${req.user.id}`);
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Step 1: Delete from disk
        console.log(`[DELETE FILE] Checking if file exists on disk: ${file.path}`);
        if (fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path);
                console.log(`[DELETE FILE] Successfully deleted file from disk: ${file.path}`);
            } catch (diskErr) {
                console.error(`[DELETE FILE] Error deleting file from disk ${file.path}: ${diskErr.message}`);
                return res.status(500).json({ msg: `Could not delete file from disk: ${diskErr.message}` });
            }
        } else {
            console.log(`[DELETE FILE] File not found on disk, skipping disk deletion: ${file.path}`);
        }

        // Step 2: Delete vectors from langchainvectordb
        console.log(`[DELETE FILE] Attempting to delete vectors for file ID: ${req.params.id}`);
        try {
            const { vectorStore } = req.serviceManager.getServices();
            await vectorStore.deleteDocumentsByFileId(req.params.id);
            console.log(`[DELETE FILE] Successfully deleted vectors for file ID: ${req.params.id}`);
        } catch (vectorErr) {
            console.error(`[DELETE FILE] Error deleting vectors for file ID ${req.params.id}: ${vectorErr.message}`);
            // Decide if this error should prevent file deletion from DB. For now, we'll allow it to proceed.
            // return res.status(500).json({ msg: `Could not delete vectors: ${vectorErr.message}` });
        }

        // Step 3: Delete from MongoDB
        console.log(`[DELETE FILE] Attempting to delete file record from MongoDB for ID: ${req.params.id}`);
        try {
            await File.findByIdAndDelete(req.params.id);
            console.log(`[DELETE FILE] Successfully deleted file record from MongoDB for ID: ${req.params.id}`);
        } catch (dbErr) {
            console.error(`[DELETE FILE] Error deleting file record from MongoDB ${req.params.id}: ${dbErr.message}`);
            return res.status(500).json({ msg: `Could not delete file record from DB: ${dbErr.message}` });
        }
        
        res.json({ msg: 'File and all associated data removed' });
    } catch (err) {
        console.error(`[DELETE FILE] General server error during file deletion: ${err.message}`);
        res.status(500).send('Server Error');
    }
});

// --- NEW: POST route to get a file's overview ---
// @route   POST /api/files/overview
// @desc    Generate an overview/summary of a file
// @access  Private
router.post('/overview', tempAuth, async (req, res) => {
    const { fileId } = req.body;

    if (!fileId) {
        return res.status(400).json({ msg: 'File ID is required.' });
    }

    try {
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ msg: 'File not found' });
        }

        // Make sure user owns the file
        if (file.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Use services from the service manager
        const { documentProcessor, geminiAI } = req.serviceManager.getServices();
        const fileContent = await documentProcessor.parseFile(file.path);

        if (!fileContent || fileContent.trim().length < 100) {
             return res.status(400).json({ overview: "The file is too short to generate a meaningful overview." });
        }

        // Use GeminiAI to generate a short summary
        const summary = await geminiAI.generateSummary(fileContent, {
            type: 'short',
            style: 'formal',
            focus: 'the main purpose and key topics of the document'
        });

        res.json({ overview: summary.text });

    } catch (err) {
        console.error('Error generating file overview:', err.message);
        res.status(500).send('Server Error');
    }
});

// --- NEW: POST route to generate PPT ---
// @route   POST /api/files/generate-ppt
// @desc    Generate a PPT based on topic
// @access  Private
router.post('/generate-ppt', tempAuth, async (req, res) => {
    const { topic, selectedModel } = req.body;
    if (!topic) {
        return res.status(400).json({ msg: 'Topic is required' });
    }
    try {
        const userId = req.headers['x-user-id'] || req.user?.id;
        const modelToUse = selectedModel || 'gemini-flash';
        console.log(`[PPT] Generating PPT for topic: ${topic} using model: ${modelToUse}`);

        const pptPath = await generatePPT(topic, modelToUse, userId);
        res.download(pptPath, err => {
            if (err) {
                console.error('Error sending PPT file:', err);
                res.status(500).send('Error sending PPT file');
            }
        });
    } catch (err) {
        console.error('Error generating PPT:', err);
        res.status(500).send('Server Error');
    }
});

// --- NEW: POST route to generate report ---
router.post('/generate-report', tempAuth, async (req, res) => {
    const { topic, selectedModel } = req.body;
    const userId = req.user.id;
    try {
        const modelToUse = selectedModel || 'gemini-flash';
        console.log(`[Report] Generating report for topic: ${topic} using model: ${modelToUse}`);

        // Use DeepSearchService with universal AI
        const deepSearchService = new DeepSearchService(userId, null, new DuckDuckGoService());
        const searchResults = await deepSearchService.performSearch(topic);

        // Generate summary using selected AI model
        let summary;
        if (!searchResults || !searchResults.summary) {
            // Generate summary using universal AI
            const searchData = searchResults?.sources?.map(s => s.snippet || s.title).join('\n') || `Research data about ${topic}`;
            summary = await universalAI.generateReportSummary(topic, searchData, modelToUse, userId);
        } else {
            summary = searchResults.summary;
        }

        // 2. Generate PDF using pdfmake
        const pdfDoc = await generateReportPdf(topic, summary, searchResults?.sources || []);
        
        // 3. Send PDF as a download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${topic.replace(/\s+/g, '_')}.pdf`);
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).send('Server Error');
    }
});

// Helper function to generate PDF using pdfmake
async function generateReportPdf(topic, summary, sources) {
    const pdfMakePrinter = new pdfMake({
        Roboto: {
            normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
            bold: path.join(__dirname, '../fonts/Roboto-Medium.ttf'),
            italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
            bolditalics: path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf')
        }
    });

    // Helper function to remove markdown bold syntax
    function removeMarkdownBold(text) {
        if (!text) return '';
        return text.replace(/\*\*(.*?)\*\*/g, '$1');
    }

    // Capitalize each word in the title
    function toTitleCase(str) {
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    const documentDefinition = {
        content: [
            { text: toTitleCase(topic), style: 'header', alignment: 'center' },
            { text: removeMarkdownBold(summary), style: 'body' },
            { text: 'Sources:', style: 'subheader' },
            ...sources.map(source => ({ text: removeMarkdownBold(`${source.title} - ${source.url}`), style: 'source' })),
        ],
        styles: {
            header: {
                fontSize: 18,
                bold: true,
                margin: [0, 0, 0, 20]
            },
            subheader: {
                fontSize: 14,
                bold: true,
                margin: [0, 10, 0, 5]
            },
            body: {
                fontSize: 12,
                margin: [0, 0, 0, 10]
            },
            source: {
                fontSize: 10,
                italics: true,
                margin: [0, 0, 0, 5]
            }
        },
        defaultStyle: {
            font: 'Roboto'
        }
    };

    const pdfDoc = pdfMakePrinter.createPdfKitDocument(documentDefinition);
    return pdfDoc;
}

console.log('Gemini API Key for DeepSearch:', process.env.GEMINI_API_KEY);

// --- NEW: Route to serve generated files ---
router.get('/download-generated/:filename', tempAuth, (req, res) => {
    const { filename } = req.params;

    // Check multiple possible directories for generated files
    const possibleDirs = [
        path.join(__dirname, '../public/generated_ppts'),
        path.join(__dirname, '../public/generated'),
        path.join(__dirname, '../generated_content')
    ];

    let filePath = null;
    let generatedDir = null;

    // Find the file in one of the directories
    for (const dir of possibleDirs) {
        const testPath = path.join(dir, filename);
        if (fs.existsSync(testPath)) {
            filePath = testPath;
            generatedDir = dir;
            break;
        }
    }

    // Security check - ensure file exists and is in the correct directory
    if (!filePath || !filePath.startsWith(generatedDir)) {
        console.log(`[FileDownload] File not found: ${filename} in directories:`, possibleDirs);
        return res.status(404).json({ message: 'File not found' });
    }

    console.log(`[FileDownload] Serving file: ${filePath}`);

    // Set appropriate headers for download
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === '.pptx') {
        contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (ext === '.pdf') {
        contentType = 'application/pdf';
    } else if (ext === '.docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === '.xlsx') {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === '.txt') {
        contentType = 'text/plain';
    }

    // Set CORS headers for download
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

    // Set download headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send file
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`[FileDownload] Error sending file ${filename}:`, err);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error downloading file' });
            }
        } else {
            console.log(`[FileDownload] Successfully sent file: ${filename}`);
        }
    });
});

// @route   POST /api/files/generate-faq
// @desc    Generate FAQs from document content
// @access  Private
router.post('/generate-faq', tempAuth, async (req, res) => {
    try {
        const { fileId, fileName } = req.body;
        const userId = req.user._id || req.user.id;

        console.log(`[FAQ Generator] Request details:`, {
            fileId,
            fileName,
            userId,
            userObject: req.user
        });

        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: 'File ID is required'
            });
        }

        console.log(`[FAQ Generator] Generating FAQs for file: ${fileName} (${fileId})`);
        console.log(`[FAQ Generator] Looking for file with userId: ${userId}`);

        // Get file content - try both with and without userId filter for debugging
        let file = await File.findOne({ _id: fileId, userId });
        if (!file) {
            console.log(`[FAQ Generator] File not found with userId filter, trying without userId...`);
            file = await File.findOne({ _id: fileId });
            if (file) {
                console.log(`[FAQ Generator] File found without userId filter. File userId: ${file.userId}, Request userId: ${userId}`);
            }
        }

        if (!file) {
            console.log(`[FAQ Generator] File not found at all with ID: ${fileId}`);
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Extract text content from file
        let documentContent = '';
        if (file.extractedText) {
            documentContent = file.extractedText;
        } else if (file.content) {
            documentContent = file.content;
        } else {
            return res.status(400).json({
                success: false,
                message: 'No text content available for FAQ generation'
            });
        }

        // Generate FAQs using AI
        const faqs = await generateFAQsFromContent(documentContent, fileName);

        res.json({
            success: true,
            message: 'FAQs generated successfully',
            faqs: faqs,
            fileName: fileName,
            fileId: fileId
        });

    } catch (error) {
        console.error('[FAQ Generator] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate FAQs',
            error: error.message
        });
    }
});

/**
 * Generate FAQs from document content using AI
 */
async function generateFAQsFromContent(content, fileName) {
    try {
        // Initialize AI service (prefer Gemini, fallback to others)
        const GeminiAI = require('../services/geminiAI');
        const GeminiService = require('../services/geminiService');

        let aiService = null;

        try {
            const geminiService = new GeminiService();
            await geminiService.initialize();
            if (geminiService.genAI && geminiService.model) {
                aiService = new GeminiAI(geminiService);
            }
        } catch (error) {
            console.log('[FAQ Generator] Gemini not available, using fallback');
        }

        const prompt = `Generate comprehensive FAQs from the following document content. Create 8-12 frequently asked questions that cover the main topics, key concepts, and important details from the document.

DOCUMENT: ${fileName}
CONTENT:
${content.substring(0, 4000)}...

INSTRUCTIONS:
- Generate 8-12 relevant questions that users would commonly ask about this content
- Provide clear, concise answers based on the document content
- Cover different aspects: main topics, key concepts, practical applications, benefits, challenges, etc.
- Make questions natural and conversational
- Ensure answers are informative but not too lengthy
- Focus on the most important and useful information

FORMAT: Return as JSON array with this structure:
[
  {
    "question": "What is the main topic of this document?",
    "answer": "Clear, informative answer based on the content..."
  }
]

Generate FAQs now:`;

        let faqs = [];

        if (aiService) {
            try {
                const response = await aiService.generateText(prompt);

                // Try to parse JSON response
                const jsonMatch = response.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    faqs = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback: parse structured text response
                    faqs = parseStructuredFAQResponse(response);
                }
            } catch (error) {
                console.log('[FAQ Generator] AI generation failed, using fallback');
                faqs = generateFallbackFAQs(content, fileName);
            }
        } else {
            // Fallback FAQ generation
            faqs = generateFallbackFAQs(content, fileName);
        }

        // Validate and clean FAQs
        faqs = faqs.filter(faq => faq.question && faq.answer)
                   .slice(0, 12) // Limit to 12 FAQs
                   .map(faq => ({
                       question: faq.question.trim(),
                       answer: faq.answer.trim()
                   }));

        return faqs;

    } catch (error) {
        console.error('[FAQ Generator] Error generating FAQs:', error);
        return generateFallbackFAQs(content, fileName);
    }
}

/**
 * Parse structured FAQ response when JSON parsing fails
 */
function parseStructuredFAQResponse(response) {
    const faqs = [];
    const lines = response.split('\n');
    let currentFAQ = null;

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Look for question patterns
        if (trimmedLine.match(/^(Q\d*:?|\d+\.|\*)\s*(.+\?)/i)) {
            if (currentFAQ && currentFAQ.question && currentFAQ.answer) {
                faqs.push(currentFAQ);
            }
            currentFAQ = {
                question: trimmedLine.replace(/^(Q\d*:?|\d+\.|\*)\s*/i, '').trim(),
                answer: ''
            };
        }
        // Look for answer patterns
        else if (currentFAQ && trimmedLine.match(/^(A\d*:?|\-|\*)/i)) {
            currentFAQ.answer = trimmedLine.replace(/^(A\d*:?|\-|\*)\s*/i, '').trim();
        }
        // Continue answer on next lines
        else if (currentFAQ && currentFAQ.answer && trimmedLine && !trimmedLine.match(/^(Q\d*|A\d*|\d+\.)/i)) {
            currentFAQ.answer += ' ' + trimmedLine;
        }
    }

    // Add the last FAQ
    if (currentFAQ && currentFAQ.question && currentFAQ.answer) {
        faqs.push(currentFAQ);
    }

    return faqs;
}

/**
 * Generate fallback FAQs when AI is not available
 */
function generateFallbackFAQs(content, fileName) {
    const words = content.split(' ');
    const summary = words.slice(0, 100).join(' ');

    return [
        {
            question: `What is the main topic of ${fileName}?`,
            answer: `This document discusses ${summary}...`
        },
        {
            question: "What are the key points covered in this document?",
            answer: "The document covers several important topics and concepts that are explained in detail throughout the content."
        },
        {
            question: "Who is the target audience for this document?",
            answer: "This document appears to be designed for readers interested in the subject matter and related topics."
        },
        {
            question: "What can I learn from this document?",
            answer: "You can gain insights into the main concepts, understand key principles, and learn about practical applications of the topics discussed."
        },
        {
            question: "How is the information in this document organized?",
            answer: "The document is structured to present information in a logical flow, building from basic concepts to more detailed explanations."
        }
    ];
}

module.exports = router;