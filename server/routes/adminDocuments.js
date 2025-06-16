// server/routes/adminDocuments.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const AdminDocument = require('../models/AdminDocument');
const { fixedAdminAuthMiddleware } = require('../middleware/fixedAdminAuthMiddleware');
const axios = require('axios');

const router = express.Router();

// --- Constants, Multer Config, Helpers (EXISTING CODE - no changes here for this step) ---
const ADMIN_UPLOAD_DIR_BASE = path.join(__dirname, '..', 'assets', '_admin_uploads_');
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedAdminMimeTypes = {
    'application/pdf': 'docs',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs',
    'text/plain': 'docs',
    'text/markdown': 'docs',
};
const allowedAdminExtensions = ['.pdf', '.docx', '.txt', '.md'];

const adminStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fileMimeType = file.mimetype.toLowerCase();
        const fileTypeSubfolder = allowedAdminMimeTypes[fileMimeType] || 'others';
        const destinationPath = path.join(ADMIN_UPLOAD_DIR_BASE, fileTypeSubfolder);
        fs.mkdir(destinationPath, { recursive: true }, (err) => {
            if (err) return cb(err);
            cb(null, destinationPath);
        });
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase();
        const sanitizedBaseName = path.basename(file.originalname, fileExt)
            .replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        cb(null, `${timestamp}-${sanitizedBaseName}${fileExt}`);
    }
});
const adminFileFilter = (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    if (allowedAdminMimeTypes[mimeType] && allowedAdminExtensions.includes(fileExt)) {
        cb(null, true);
    } else {
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE_TYPE_ADMIN');
        error.message = `Invalid file type. Allowed: ${allowedAdminExtensions.join(', ')}`;
        cb(error, false);
    }
};
const adminUpload = multer({ storage: adminStorage, fileFilter: adminFileFilter, limits: { fileSize: MAX_FILE_SIZE }});
async function triggerPythonTextExtractionForAdmin(filePath, originalName) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) return { success: false, message: "Python service URL not configured.", text: null };
    const addDocumentUrl = `${pythonServiceUrl}/add_document`;
    try {
        const response = await axios.post(addDocumentUrl, {
            user_id: "fixed_admin_text_extraction_user",
            file_path: filePath, original_name: originalName
        }, { timeout: 300000 });
        const text = response.data?.raw_text_for_analysis || null;
        if (text) return { success: true, message: "Text extracted.", text: text };
        return { success: false, message: response.data?.message || "Python extracted no text.", text: null };
    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || "Unknown error calling Python RAG.";
        return { success: false, message: `Python RAG call failed: ${errorMsg}`, text: null };
    }
}
// --- End Existing Code ---


// @route   POST /api/admin/documents/upload (EXISTING - NO CHANGES FOR THIS STEP)
router.post('/upload', fixedAdminAuthMiddleware, adminUpload.single('file'), async (req, res) => {
    // ... (existing upload logic remains the same)
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded or file type rejected.' });
    }
    const { filename: serverFilename, originalname: originalName, path: tempServerPath } = req.file;
    let adminDocRecord;
    try {
        const existingDoc = await AdminDocument.findOne({ originalName: originalName });
        if (existingDoc) {
            await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Error deleting duplicate temp file ${tempServerPath}:`, e));
            return res.status(409).json({ message: `Document with original name '${originalName}' already exists for admin.` });
        }
        const textExtractionResult = await triggerPythonTextExtractionForAdmin(tempServerPath, originalName);
        if (!textExtractionResult.success || !textExtractionResult.text || textExtractionResult.text.trim() === "") {
            await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Error deleting temp file ${tempServerPath} after failed text extraction:`, e));
            return res.status(422).json({
                message: textExtractionResult.message || "Failed to extract usable text from the document.",
                filename: serverFilename, originalname: originalName
            });
        }
        adminDocRecord = new AdminDocument({
            filename: serverFilename, originalName: originalName, text: textExtractionResult.text,
            analysis: { faq: "", topics: "", mindmap: "" }, analysisUpdatedAt: null,
        });
        await adminDocRecord.save();
        await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Non-critical error deleting temp file ${tempServerPath} after DB save:`, e));
        res.status(202).json({
            message: `Admin document '${originalName}' uploaded. Text extracted. Analysis initiated.`,
            filename: serverFilename, originalname: originalName,
        });
        const { Worker } = require('worker_threads');
        const adminAnalysisWorkerPath = path.resolve(__dirname, '..', 'workers', 'adminAnalysisWorker.js');
        if (fs.existsSync(adminAnalysisWorkerPath)) {
            const worker = new Worker(adminAnalysisWorkerPath, {
                workerData: {
                    adminDocumentId: adminDocRecord._id.toString(),
                    originalName: originalName, textForAnalysis: textExtractionResult.text
                }
            });
            worker.on('message', (msg) => console.log(`Admin Analysis Worker [Doc: ${msg.originalName || originalName}]: ${msg.message || JSON.stringify(msg)}`));
            worker.on('error', (err) => console.error(`Admin Analysis Worker Error [Doc: ${originalName}]:`, err));
            worker.on('exit', (code) => console.log(`Admin Analysis Worker [Doc: ${originalName}] exited (code ${code}).`));
        } else {
            console.error(`Admin Upload: adminAnalysisWorker.js not found at ${adminAnalysisWorkerPath}.`);
        }
    } catch (error) {
        console.error(`Admin Upload: Overall error for '${originalName || (req.file && req.file.originalname)}':`, error);
        if (tempServerPath) await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Error cleaning up temp file ${tempServerPath} after overall error:`, e));
        if (!res.headersSent) {
            if (error.code === 11000) res.status(409).json({ message: 'Document processing conflict.' });
            else res.status(500).json({ message: 'Server error during admin document upload.' });
        }
    }
});

// @route   GET /api/admin/documents (EXISTING - NO CHANGES FOR THIS STEP)
router.get('/', fixedAdminAuthMiddleware, async (req, res) => {
    // ... (existing list logic remains the same)
    try {
        const adminDocs = await AdminDocument.find().sort({ uploadedAt: -1 })
            .select('originalName filename uploadedAt analysisUpdatedAt analysis.faq analysis.topics analysis.mindmap');
        const documentsList = adminDocs.map(doc => ({
            originalName: doc.originalName, serverFilename: doc.filename, uploadedAt: doc.uploadedAt,
            analysisUpdatedAt: doc.analysisUpdatedAt,
            hasFaq: !!(doc.analysis && doc.analysis.faq && doc.analysis.faq.trim() !== ""),
            hasTopics: !!(doc.analysis && doc.analysis.topics && doc.analysis.topics.trim() !== ""),
            hasMindmap: !!(doc.analysis && doc.analysis.mindmap && doc.analysis.mindmap.trim() !== ""),
        }));
        res.json({ documents: documentsList });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching admin documents.' });
    }
});

// @route   DELETE /api/admin/documents/:serverFilename (EXISTING - NO CHANGES FOR THIS STEP)
router.delete('/:serverFilename', fixedAdminAuthMiddleware, async (req, res) => {
    // ... (existing delete logic remains the same)
    const { serverFilename } = req.params;
    if (!serverFilename) return res.status(400).json({ message: 'Server filename parameter is required.' });
    try {
        const docToDelete = await AdminDocument.findOneAndDelete({ filename: serverFilename });
        if (!docToDelete) return res.status(404).json({ message: `Admin document '${serverFilename}' not found.` });
        res.status(200).json({ message: `Admin document '${docToDelete.originalName}' record deleted.` });
    } catch (error) {
        res.status(500).json({ message: 'Server error during admin document deletion.' });
    }
});

// @route   GET /api/admin/documents/:serverFilename/analysis (EXISTING - NO CHANGES FOR THIS STEP)
router.get('/:serverFilename/analysis', fixedAdminAuthMiddleware, async (req, res) => {
    // ... (existing analysis fetch by serverFilename logic remains the same)
    const { serverFilename } = req.params;
    if (!serverFilename) return res.status(400).json({ message: 'Server filename parameter is required.' });
    try {
        const adminDoc = await AdminDocument.findOne({ filename: serverFilename }).select('originalName analysis analysisUpdatedAt');
        if (!adminDoc) return res.status(404).json({ message: `Admin document '${serverFilename}' not found.` });
        if (!adminDoc.analysis || (!adminDoc.analysis.faq && !adminDoc.analysis.topics && !adminDoc.analysis.mindmap)) {
            return res.status(200).json({
                originalName: adminDoc.originalName, message: 'Analysis not generated or empty.',
                analysis: { faq: "", topics: "", mindmap: "" }, analysisUpdatedAt: adminDoc.analysisUpdatedAt
            });
        }
        res.status(200).json({
            originalName: adminDoc.originalName, analysis: adminDoc.analysis,
            analysisUpdatedAt: adminDoc.analysisUpdatedAt
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error retrieving admin document analysis.' });
    }
});

// --- NEW ROUTE FOR STEP 2 ---
// @route   GET /api/admin/documents/by-original-name/:originalName/analysis
// @desc    Get analysis data for a specific admin document by its originalName
// @access  Admin Only (via fixedAdminAuthMiddleware)
router.get('/by-original-name/:originalName/analysis', fixedAdminAuthMiddleware, async (req, res) => {
    const { originalName } = req.params;
    if (!originalName) {
        return res.status(400).json({ message: 'Original name parameter is required.' });
    }

    try {
        const decodedOriginalName = decodeURIComponent(originalName);
        const adminDoc = await AdminDocument.findOne({ originalName: decodedOriginalName })
            .select('originalName filename analysis analysisUpdatedAt'); // Select necessary fields

        if (!adminDoc) {
            return res.status(404).json({ message: `Admin document with original name '${decodedOriginalName}' not found.` });
        }

        // Check if the analysis object or its specific fields are empty/null
        if (!adminDoc.analysis ||
            (!adminDoc.analysis.faq?.trim() && // Check if specific fields are empty strings after trim
             !adminDoc.analysis.topics?.trim() &&
             !adminDoc.analysis.mindmap?.trim())) {
            return res.status(200).json({
                originalName: adminDoc.originalName,
                serverFilename: adminDoc.filename,
                message: 'Analysis has not been generated or is empty for this document.',
                analysis: { // Return a default empty structure
                    faq: adminDoc.analysis?.faq || "",
                    topics: adminDoc.analysis?.topics || "",
                    mindmap: adminDoc.analysis?.mindmap || ""
                },
                analysisUpdatedAt: adminDoc.analysisUpdatedAt
            });
        }

        res.status(200).json({
            originalName: adminDoc.originalName,
            serverFilename: adminDoc.filename, // Include serverFilename for context if frontend needs it
            analysis: adminDoc.analysis,       // This contains { faq, topics, mindmap } strings
            analysisUpdatedAt: adminDoc.analysisUpdatedAt
        });
    } catch (error) {
        console.error(`Error fetching analysis for admin document by original name '${originalName}':`, error);
        res.status(500).json({ message: 'Server error while retrieving admin document analysis by original name.' });
    }
});


module.exports = router;