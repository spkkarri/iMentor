const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { tempAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const File = require('../models/File');
const documentProcessor = require('../documentProcessor');
const vectorStore = require('../vectorStore');
const storage = require('../storage');
const multer = require('multer');

const storageConfig = multer.diskStorage({
  destination: async function (req, res, cb) {
    const assetsDir = path.join(__dirname, '..', 'assets', req.headers['x-user-id']);
    const docsDir = path.join(assetsDir, 'docs');
    await fs.mkdir(docsDir, { recursive: true });
    cb(null, docsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${timestamp}${ext}`);
  }
});

const upload = multer({ storage: storageConfig });

router.post('/', tempAuth, upload.single('file'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const finalPath = req.file.path;
    const file = new File({
      user: user._id,
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: finalPath,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    await file.save();

    // Process document and add to vector store
    const chunks = await documentProcessor.processDocument(finalPath, req.file.originalname);
    await vectorStore.addDocuments(chunks.map(chunk => ({
      content: chunk.content,
      metadata: { documentId: file._id.toString(), source: req.file.originalname }
    })));

    // Also save to storage.js for compatibility with previous app
    await storage.createDocument({
      userId: user._id.toString(),
      name: req.file.originalname,
      path: finalPath,
      size: req.file.size
    });

    res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        id: file._id,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;