// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const User = require('../models/User');
const { Worker } = require('worker_threads');

const router = express.Router();

// --- Constants & Multer Config (Unchanged) ---
const UPLOAD_DIR = path.join(__dirname, '..', 'assets');
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedMimeTypes = {
    'application/pdf': 'docs',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs',
    'application/msword': 'docs',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'docs',
    'application/vnd.ms-powerpoint': 'docs',
    'text/plain': 'docs', 'text/x-python': 'code', 'application/javascript': 'code',
    'text/javascript': 'code', 'text/markdown': 'code', 'text/html': 'code',
    'application/xml': 'code', 'text/xml': 'code', 'application/json': 'code',
    'text/csv': 'code', 'image/jpeg': 'images', 'image/png': 'images',
    'image/bmp': 'images', 'image/gif': 'images',
};
const allowedExtensions = [
    '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.py', '.js', '.md', 
    '.html', '.xml', '.json', '.csv', '.log', '.jpg', '.jpeg', '.png', '.bmp', '.gif'
];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.user || !req.user.email) {
            return cb(new Error("Authentication error: User context not found for upload destination."));
        }
        const sanitizedUsername = req.user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileMimeType = file.mimetype.toLowerCase();
        const fileTypeSubfolder = allowedMimeTypes[fileMimeType] || 'others';
        const destinationPath = path.join(UPLOAD_DIR, sanitizedUsername, fileTypeSubfolder);
        fs.mkdir(destinationPath, { recursive: true }, (err) => {
             if (err) cb(err); else cb(null, destinationPath);
         });
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase();
        const sanitizedBaseName = path.basename(file.originalname, fileExt)
                                      .replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        const uniqueFilename = `${timestamp}-${sanitizedBaseName}${fileExt}`;
        cb(null, uniqueFilename);
    }
});

const fileFilter = (req, file, cb) => {
    if (!req.user) {
         const err = new multer.MulterError('UNAUTHENTICATED');
         err.message = 'User not authenticated.';
         return cb(err, false);
    }
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    if (allowedMimeTypes[mimeType] && allowedExtensions.includes(fileExt)) {
        cb(null, true);
    } else {
        const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
        err.message = `Invalid file type. Allowed: ${allowedExtensions.join(', ')}.`;
        cb(err, false);
    }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE }});

async function triggerPythonRagProcessing(userId, filePath, originalName) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        return { success: false, message: "RAG service URL not configured." };
    }
    const addDocumentUrl = `${pythonServiceUrl}/add_document`;
    try {
        const response = await axios.post(addDocumentUrl, { user_id: userId, file_path: filePath, original_name: originalName });
        const pythonData = response.data;
        const text = pythonData?.raw_text_for_analysis || null;
        return {
            success: !!(text && text.trim()),
            status: pythonData?.status,
            message: pythonData?.message || "No message from Python.",
            text: text,
            chunksForKg: pythonData?.chunks_with_metadata || []
        };
    } catch (error) {
        return { success: false, message: `Python RAG call failed: ${error.response?.data?.error || error.message}`};
    }
}

// Route handler
router.post('/', async (req, res, next) => {
    const uploader = upload.single('file');

    uploader(req, res, async function (err) {
        if (err) {
            console.error(`Upload Route: Multer error for user '${req.user?.email || 'undefined'}': ${err.message}`);
            return res.status(err instanceof multer.MulterError ? 400 : 500).json({ message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ message: "No file received or file type rejected." });
        }

        const userId = req.user._id.toString();
        const { originalname: originalName, path: tempServerPath } = req.file;
        // Check if path exists before resolving
        if (!tempServerPath) {
            return res.status(500).json({ message: "File upload failed, temporary path not created." });
        }
        const absoluteFilePath = path.resolve(tempServerPath);

        try {
            // Fetch user preferences AT THE START of the upload process.
            const user = await User.findById(userId).select('uploadedDocuments.filename preferredLlmProvider ollamaModel');
            if (!user) {
                await fs.promises.unlink(absoluteFilePath).catch(e => console.error(`Cleanup Error: ${e.message}`));
                return res.status(404).json({ message: "User not found." });
            }

            const llmProviderForWorkers = user.preferredLlmProvider || 'gemini';
            const ollamaModelForWorkers = user.ollamaModel || process.env.OLLAMA_DEFAULT_MODEL;

            if (user.uploadedDocuments.some(doc => doc.filename === originalName)) {
                await fs.promises.unlink(absoluteFilePath).catch(e => console.error(`Cleanup Error: ${e.message}`));
                return res.status(409).json({ message: `File '${originalName}' already exists.` });
            }

            const ragResult = await triggerPythonRagProcessing(userId, absoluteFilePath, originalName);

            if (!ragResult.success) {
                await fs.promises.unlink(absoluteFilePath).catch(e => console.error(`Cleanup Error: ${e.message}`));
                return res.status(422).json({ message: ragResult.message || "Failed to extract text." });
            }

            const newDocEntry = {
                filename: originalName, text: ragResult.text,
                analysis: {}, uploadedAt: new Date(), ragStatus: ragResult.status,
                analysisStatus: "pending", kgStatus: "pending"
            };
            await User.updateOne({ _id: userId }, { $push: { uploadedDocuments: newDocEntry } });
            
            res.status(202).json({
                message: `File '${originalName}' accepted. Background processing initiated.`,
                originalname: originalName,
            });

            // Pass the preferences to the workers
            const workerData = { 
                userId, originalName, textForAnalysis: ragResult.text, 
                llmProvider: llmProviderForWorkers, ollamaModel: ollamaModelForWorkers 
            };
            const kgWorkerData = { ...workerData, chunksForKg: ragResult.chunksForKg };

            const analysisWorker = new Worker(path.resolve(__dirname, '../workers/analysisWorker.js'), { workerData });
            analysisWorker.on('error', (err) => console.error(`Analysis Worker Error [${originalName}]:`, err));

            if (ragResult.chunksForKg && ragResult.chunksForKg.length > 0) {
                const kgWorker = new Worker(path.resolve(__dirname, '../workers/kgWorker.js'), { workerData: kgWorkerData });
                kgWorker.on('error', (err) => console.error(`KG Worker Error [${originalName}]:`, err));
            } else {
                 await User.updateOne({ _id: userId, "uploadedDocuments.filename": originalName }, { $set: { "uploadedDocuments.$.kgStatus": "skipped_no_chunks" } });
            }

            await fs.promises.unlink(absoluteFilePath).catch(e => console.error(`Non-critical cleanup error: ${e.message}`));

        } catch (error) {
            console.error(`Overall Upload Error for ${originalName}:`, error);
            if (tempServerPath && fs.existsSync(tempServerPath)) {
                await fs.promises.unlink(tempServerPath).catch(e => console.error(`Final Cleanup Error: ${e.message}`));
            }
            if (!res.headersSent) {
                res.status(500).json({ message: "Server error during file processing." });
            }
        }
    });
});

module.exports = router;