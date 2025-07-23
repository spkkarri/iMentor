// server/routes/upload.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const User = require('../models/User');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/', tempAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { documentProcessor } = req.serviceManager.getServices();
    if (!documentProcessor) {
        console.error("Upload Route: DocumentProcessor not available from serviceManager.");
        return res.status(500).json({ message: 'Server configuration error: DocumentProcessor is not available.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const newFile = new File({
            user: req.user.id,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        });
        
        const extension = path.extname(req.file.originalname);
        const finalFilename = `${newFile._id}${extension}`;
        const userUploadsDir = path.join(__dirname, '..', 'assets', user.username, 'docs');
        const finalPath = path.join(userUploadsDir, finalFilename);

        fs.mkdirSync(userUploadsDir, { recursive: true });
        fs.writeFileSync(finalPath, req.file.buffer);

        newFile.filename = finalFilename;
        newFile.path = finalPath;
        await newFile.save();

        console.log(`✅ File upload successful for User '${user.username}'.`);
        
        documentProcessor.processFile(finalPath, {
            userId: req.user.id.toString(),
            fileId: newFile._id.toString(),
            originalName: req.file.originalname,
            fileType: path.extname(req.file.originalname).substring(1)
        }).then(result => {
            console.log(`✅ RAG processing started for '${req.file.originalname}'.`);
        }).catch(ragError => {
            console.error(`❌ RAG processing failed for '${req.file.originalname}':`, ragError.message);
        });

        res.status(201).json(newFile);

    } catch (error) {
        console.error('Error during file upload process:', error);
        res.status(500).json({ message: 'Server error during file upload.' });
    }
});

module.exports = router;