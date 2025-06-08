// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Using fs.promises for async file operations
const axios = require('axios');
const UserFile = require('../models/UserFile'); // Your Mongoose model for file metadata
const { tempAuth } = require('../middleware/authMiddleware'); // Your authentication middleware

// --- Configuration Constants ---
const UPLOAD_DIR_BASE = path.join(__dirname, '..', 'assets'); // Base directory for all user assets
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Allowed MIME types and their corresponding subfolders
const ALLOWED_MIME_TYPES_MAP = { // Using this name consistently
    'application/pdf': 'docs',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs', // .docx
    'application/msword': 'docs', // .doc
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'docs', // .pptx
    'application/vnd.ms-powerpoint': 'docs', // .ppt
    'text/plain': 'docs',
    'text/x-python': 'code',
    'application/javascript': 'code',
    'text/javascript': 'code', // Common for .js files
    'text/markdown': 'code',
    'text/html': 'code',
    'application/xml': 'code',
    'text/xml': 'code', // Common for .xml files
    'application/json': 'code',
    'text/csv': 'code',
    'image/jpeg': 'images',
    'image/png': 'images',
    'image/bmp': 'images',
    'image/gif': 'images',
};

// Allowed file extensions (for an extra layer of validation)
const ALLOWED_EXTENSIONS = [ // Using this name consistently
    '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt',
    '.py', '.js', '.md', '.html', '.xml', '.json', '.csv', '.log',
    '.jpg', '.jpeg', '.png', '.bmp', '.gif'
];
// --- END Configuration Constants ---

const router = express.Router();

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.user || !req.user.username) {
            console.error("[Multer Dest Error] User context or username missing after auth.");
            return cb(new Error("Authentication error: User context not found for storage path."));
        }
        const userFolderIdentifier = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileMimeType = file.mimetype.toLowerCase();
        // CORRECTED: Use ALLOWED_MIME_TYPES_MAP
        const fileTypeSubfolder = ALLOWED_MIME_TYPES_MAP[fileMimeType] || 'others';
        
        // CORRECTED: Use UPLOAD_DIR_BASE
        const destinationPath = path.join(UPLOAD_DIR_BASE, userFolderIdentifier, fileTypeSubfolder);

        fs.mkdir(destinationPath, { recursive: true }, (err) => {
             if (err) {
                 console.error(`[Multer Dest Error] Error creating destination path ${destinationPath}:`, err);
                 cb(err);
             } else {
                 cb(null, destinationPath);
             }
         });
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalFileExtension = path.extname(file.originalname).toLowerCase();
        const sanitizedBaseName = path.basename(file.originalname, originalFileExtension)
                                      .trim()
                                      .replace(/\s+/g, '_')
                                      .replace(/[^a-zA-Z0-9._-]/g, '_')
                                      .substring(0, 100);
        const uniqueServerFilename = `${timestamp}-${sanitizedBaseName}${originalFileExtension}`;
        cb(null, uniqueServerFilename);
    }
});

const fileFilter = (req, file, cb) => {
    if (!req.user) {
         const authError = new multer.MulterError('UNAUTHENTICATED');
         authError.message = `User not authenticated for file upload.`;
         return cb(authError, false);
    }
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    // CORRECTED: Use ALLOWED_MIME_TYPES_MAP and ALLOWED_EXTENSIONS
    const isMimeTypeAllowed = !!ALLOWED_MIME_TYPES_MAP[mimeType];
    const isExtensionInList = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (isMimeTypeAllowed && isExtensionInList) {
        cb(null, true);
    } else {
        const filterError = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
        filterError.message = `Invalid file type or extension. Mime: ${mimeType}, Ext: ${fileExtension}.`;
        if(!isMimeTypeAllowed) filterError.message += ` Mime type '${mimeType}' is not allowed.`;
        if(!isExtensionInList) filterError.message += ` Extension '${fileExtension}' is not allowed.`;
        req.multerFilterError = filterError;
        cb(null, false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES } // CORRECTED: Use MAX_FILE_SIZE_BYTES
});
// --- End Multer Config ---

// --- Function to Trigger Python RAG Service Processing ---
async function triggerPythonRagProcessing(userId, serverFilePath, originalFilenameForDB) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        console.error("[RAG Trigger Error] PYTHON_RAG_SERVICE_URL environment variable is not set.");
        return { success: false, message: "RAG service URL is not configured on the server." };
    }
    const addDocumentEndpoint = `${pythonServiceUrl}/add_document`;
    console.log(`[RAG Trigger] Calling ${addDocumentEndpoint} for User: ${userId}, File: ${originalFilenameForDB}, Path: ${serverFilePath}`);
    try {
        const response = await axios.post(addDocumentEndpoint, { 
            user_id: userId, 
            file_path: serverFilePath,
            original_name: originalFilenameForDB
        }, { timeout: 300000 });
        console.log("[RAG Trigger] Response from Python RAG service:", response.data);
        return { 
            success: true, 
            status: response.data?.status || 'unknown_status_from_rag', 
            message: response.data?.message || 'RAG processing initiated successfully.' 
        };
    } catch (error) {
        console.error(`[RAG Trigger Error] Failed to call RAG service at ${addDocumentEndpoint}:`, 
            error.isAxiosError ? { 
                message: error.message, url: error.config?.url, method: error.config?.method, responseData: error.response?.data 
            } : error
        );
        return { success: false, message: `Error triggering RAG processing: ${error.message}` };
    }
}
// --- End RAG Trigger Function ---

// --- Main File Upload Route ---
router.post('/', tempAuth, (req, res) => {
    const uploaderMiddleware = upload.single('file');

    uploaderMiddleware(req, res, async function (multerErr) {
        if (!req.user || !req.user._id || !req.user.username) {
             console.error("[Upload Route Error] req.user or its required fields (_id, username) missing after tempAuth.");
             return res.status(401).json({ message: "Authentication error or incomplete user data. Please log in again." });
        }
        const userIdString = req.user._id.toString();
        const userFolderIdentifier = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');

        if (multerErr) {
            console.error(`[Upload Route Error] Multer error during upload for user '${userFolderIdentifier}':`, multerErr);
            let errorMessage = "File upload processing failed due to a server constraint.";
            if (multerErr instanceof multer.MulterError) {
                if (multerErr.code === 'LIMIT_FILE_SIZE') {
                    // CORRECTED: Use MAX_FILE_SIZE_BYTES
                    errorMessage = `File too large. Maximum allowed size is ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB.`;
                } else if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
                    errorMessage = multerErr.message || 'Invalid file type or extension submitted.';
                } else if (multerErr.code === 'UNAUTHENTICATED') {
                    errorMessage = multerErr.message || 'Authentication required for file upload.';
                }
            }
            return res.status(400).json({ message: errorMessage });
        }

        if (!req.file) {
            console.warn(`[Upload Route Warning] User '${userFolderIdentifier}' upload request completed, but no file was processed (likely filtered out by fileFilter).`);
            return res.status(400).json({ message: req.multerFilterError?.message || "No valid file received or the submitted file type was rejected." });
        }

        const { 
            path: temporaryServerPath,
            originalname: clientOriginalNameWithSpaces,
            filename: serverFilenameOnDisk,
            mimetype: fileMimeType,
            size: fileSize 
        } = req.file;

        const absoluteServerFilePath = path.resolve(temporaryServerPath);
        const originalFileExtension = path.extname(clientOriginalNameWithSpaces).toLowerCase();

        const originalFilenameForDB = path.basename(clientOriginalNameWithSpaces, originalFileExtension)
                                         .trim()
                                         .replace(/\s+/g, '_') 
                                         .replace(/[^a-zA-Z0-9._-]/g, '_')
                                         .substring(0, 150) + originalFileExtension;

        // CORRECTED: Use ALLOWED_MIME_TYPES_MAP
        const fileTypeSubfolderForPath = ALLOWED_MIME_TYPES_MAP[fileMimeType.toLowerCase()] || 'others';

        console.log(`[Upload Route] Processing: Client Original='${clientOriginalNameWithSpaces}', DB Original='${originalFilenameForDB}', Server Filename='${serverFilenameOnDisk}', User='${userFolderIdentifier}'`);
        console.log(`   Server File Path: ${absoluteServerFilePath}`);

        try {
            console.log(`[DB Operation] Searching for existing metadata: UserID='${userIdString}', DB OriginalFilename='${originalFilenameForDB}'`);
            let fileMetadataDoc = await UserFile.findOne({ userId: userIdString, originalFilename: originalFilenameForDB });

            const updateData = {
                serverFilename: serverFilenameOnDisk,
                serverFilePath: absoluteServerFilePath,
                fileTypeSubfolder: fileTypeSubfolderForPath,
                userAssetSubFolder: userFolderIdentifier,
                size: fileSize,
                mimetype: fileMimeType,
                uploadedAt: new Date(),
            };

            if (fileMetadataDoc) {
                console.log(`[DB Operation] Updating existing metadata for '${originalFilenameForDB}' (User: ${userIdString})`);
                if (fileMetadataDoc.serverFilePath && fileMetadataDoc.serverFilePath !== absoluteServerFilePath && fs.existsSync(fileMetadataDoc.serverFilePath)) {
                     console.log(`[File System] Attempting to delete old physical file: ${fileMetadataDoc.serverFilePath}`);
                    try {
                        await fs.promises.unlink(fileMetadataDoc.serverFilePath);
                        console.log(`[File System] Old physical file ${fileMetadataDoc.serverFilePath} deleted successfully.`);
                    } catch (unlinkError) {
                        console.error(`[File System Error] Could not delete old physical file ${fileMetadataDoc.serverFilePath}:`, unlinkError);
                    }
                }
                Object.assign(fileMetadataDoc, updateData);
            } else {
                console.log(`[DB Operation] Creating new metadata for '${originalFilenameForDB}' (User: ${userIdString})`);
                fileMetadataDoc = new UserFile({
                    userId: userIdString,
                    originalFilename: originalFilenameForDB,
                    ...updateData
                });
            }

            await fileMetadataDoc.save();
            console.log(`[DB Operation Success] Metadata saved/updated for UserID='${userIdString}', DB OriginalFilename='${originalFilenameForDB}', Server Filename='${serverFilenameOnDisk}'`);
        
        } catch (dbError) {
            console.error(`[DB Operation Error] Failed to save/update metadata for '${originalFilenameForDB}' (Server Filename: '${serverFilenameOnDisk}'):`, dbError);
            try {
                await fs.promises.unlink(absoluteServerFilePath);
                console.log(`[File System Cleanup] Physical file ${absoluteServerFilePath} deleted due to DB metadata operation failure.`);
            } catch (unlinkCleanupError) {
                console.error(`[File System Error] Could not delete physical file ${absoluteServerFilePath} after DB failure:`, unlinkCleanupError);
            }
            return res.status(500).json({ message: "File was uploaded, but an error occurred while saving its details. The file has been removed. Please try again or contact support." });
        }

        triggerPythonRagProcessing(userIdString, absoluteServerFilePath, originalFilenameForDB)
            .then(ragResult => {
                console.log(`[RAG Post-Processing] Result for '${originalFilenameForDB}' (User: ${userIdString}): Status='${ragResult.status}', Message='${ragResult.message}'`);
            })
            .catch(ragInitiationError => {
                 console.error(`[RAG Trigger Error] Failed to initiate RAG processing for '${originalFilenameForDB}':`, ragInitiationError);
            });

        res.status(200).json({
            message: "File uploaded successfully! It is now being processed in the background.",
            serverFilename: serverFilenameOnDisk,
            originalFilename: originalFilenameForDB,
            clientOriginalName: clientOriginalNameWithSpaces
        });
    });
});

module.exports = router;