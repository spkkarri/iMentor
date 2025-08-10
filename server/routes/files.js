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
    const { topic } = req.body;
    if (!topic) {
        return res.status(400).json({ msg: 'Topic is required' });
    }
    try {
        const pptPath = await generatePPT(topic);
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
    const { topic } = req.body;
    const userId = req.user.id;
    try {
        // Initialize Gemini service and AI
        const geminiService = new GeminiService();
        await geminiService.initialize();
        const geminiAI = new GeminiAI(geminiService);

        // Use the same GeminiAI for DeepSearchService
        const deepSearchService = new DeepSearchService(userId, geminiAI, new DuckDuckGoService());
        const searchResults = await deepSearchService.performSearch(topic);

        if (!searchResults || !searchResults.summary) {
            const fallbackSummary = "No summary available due to Gemini quota limits.";
            const pdfDoc = await generateReportPdf(topic, fallbackSummary, searchResults?.sources || []);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${topic.replace(/\s+/g, '_')}.pdf`);
            pdfDoc.pipe(res);
            pdfDoc.end();
            return;
        }

        // 2. Generate PDF using pdfmake
        const pdfDoc = await generateReportPdf(topic, searchResults.summary, searchResults.sources); // Pass summary and sources
        
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
    const generatedDir = path.join(__dirname, '../public/generated_ppts');
    const filePath = path.join(generatedDir, filename);

    // Security check - ensure file exists and is in the correct directory
    if (!fs.existsSync(filePath) || !filePath.startsWith(generatedDir)) {
        return res.status(404).json({ message: 'File not found' });
    }

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
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
});

module.exports = router;