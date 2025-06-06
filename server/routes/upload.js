// server/routes/upload.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');

const router = express.Router();

// --- Your existing Multer Config and Helper Functions (NO CHANGES NEEDED HERE) ---
const UPLOAD_DIR = path.join(__dirname, '..', 'assets');
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedMimeTypes = {
    'application/pdf': 'docs',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs',
    'application/msword': 'docs',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'docs',
    'application/vnd.ms-powerpoint': 'docs',
    'text/plain': 'docs',
    'text/x-python': 'code',
    'application/javascript': 'code',
    'text/javascript': 'code',
    'text/markdown': 'code',
    'text/html': 'code',
    'application/xml': 'code',
    'text/xml': 'code',
    'application/json': 'code',
    'text/csv': 'code',
    'image/jpeg': 'images',
    'image/png': 'images',
    'image/bmp': 'images',
    'image/gif': 'images',
};
const allowedExtensions = [
    '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt',
    '.py', '.js', '.md', '.html', '.xml', '.json', '.csv', '.log',
    '.jpg', '.jpeg', '.png', '.bmp', '.gif'
];
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.user || !req.user.username) {
            return cb(new Error("Authentication error: User context not found."));
        }
        const sanitizedUsername = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileMimeType = file.mimetype.toLowerCase();
        const fileTypeSubfolder = allowedMimeTypes[fileMimeType] || 'others';
        const destinationPath = path.join(UPLOAD_DIR, sanitizedUsername, fileTypeSubfolder);
        fs.mkdir(destinationPath, { recursive: true }, (err) => {
             if (err) cb(err);
             else cb(null, destinationPath);
         });
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase();
        const sanitizedBaseName = path.basename(file.originalname, fileExt)
                                      .replace(/[^a-zA-Z0-9._-]/g, '_')
                                      .substring(0, 100);
        const uniqueFilename = `${timestamp}-${sanitizedBaseName}${fileExt}`;
        cb(null, uniqueFilename);
    }
});
const fileFilter = (req, file, cb) => {
    if (!req.user) {
         const error = new multer.MulterError('UNAUTHENTICATED');
         error.message = `User not authenticated.`;
         return cb(error, false);
    }
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    const isMimeTypeKnown = !!allowedMimeTypes[mimeType];
    const isExtensionAllowed = allowedExtensions.includes(fileExt);
    if (isMimeTypeKnown && isExtensionAllowed) {
        cb(null, true);
    } else {
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
        error.message = `Invalid file type or extension.`;
        cb(error, false);
    }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });
// --- End of Unchanged Section ---


// --- MODIFIED UPLOAD ROUTE ---
router.post('/', tempAuth, (req, res) => {
    const uploader = upload.single('file');

    uploader(req, res, async function (err) {
        // This function is the callback that runs AFTER multer is done.
        
        // 1. Handle Multer-specific errors first
        if (err) {
            console.error(`!!! Error during upload middleware for user ${req.user?.username || 'Unknown'}:`, err);
            if (err instanceof multer.MulterError) {
                let message = "File upload failed.";
                if (err.code === 'LIMIT_FILE_SIZE') message = `File too large. Max: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.`;
                else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = err.message || 'Invalid file type.';
                return res.status(400).json({ message });
            }
            // Handle other errors (e.g., filesystem errors from storage)
            return res.status(500).json({ message: "Server error during file storage." });
        }

        // 2. Handle cases where multer succeeded but there's no file
        if (!req.file) {
            return res.status(400).json({ message: "No valid file received or file type rejected." });
        }
        
        // 3. If we get here, the file is on disk. Now we use a try/catch for OUR logic.
        try {
            const { path: filePath, originalname: originalName, filename: serverFilename, mimetype, size } = req.file;
            const absoluteFilePath = path.resolve(filePath);
            const userId = req.user._id;

            console.log(`<<< POST /api/upload successful for User '${req.user.username}'. File: ${serverFilename}.`);

            // Save file record to database
            const newFile = new File({
                user: userId,
                filename: serverFilename,
                originalname: originalName,
                path: absoluteFilePath,
                mimetype: mimetype,
                size: size,
            });
            await newFile.save();
            console.log(`   File record saved to DB. ID: ${newFile._id}`);

            // Respond to the user immediately
            res.status(201).json(newFile);

            // Trigger background processing
            console.log(`   Triggering background RAG processing for ${originalName}...`);
            axios.post(`${process.env.PYTHON_RAG_SERVICE_URL}/add_document`, {
                user_id: userId.toString(),
                file_path: absoluteFilePath,
                original_name: originalName
            }, { timeout: 300000 })
            .then(response => {
                console.log(`✅ Background RAG processing for '${originalName}' completed. Status: ${response.data?.status}`);
            })
            .catch(error => {
                const errorMsg = error.response?.data?.error || error.message;
                console.error(`❌ Background RAG processing for '${originalName}' FAILED: ${errorMsg}`);
            });

        } catch (dbError) {
            // This block catches errors from OUR logic (e.g., database save)
            console.error("!!! Error saving file record to database:", dbError);
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error(`!!! Failed to clean up orphaned file: ${req.file.path}`, unlinkErr);
                });
            }
            res.status(500).json({ message: "Failed to save file record to database." });
        }
    });
});

module.exports = router;