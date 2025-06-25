const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const vectorStore = require('../vectorStore');

router.get('/', tempAuth, async (req, res) => {
  try {
    const files = await File.find({ user: req.user.id }).select('-path -__v');
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', tempAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { originalname } = req.body;

    if (!originalname) {
      return res.status(400).json({ message: 'New filename is required' });
    }

    const file = await File.findOne({ _id: id, user: req.user.id });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    file.originalname = originalname;
    await file.save();

    res.status(200).json({ message: 'File renamed successfully', file });
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', tempAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findOne({ _id: id, user: req.user.id });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    await fs.unlink(file.path);
    await File.deleteOne({ _id: id });
    await vectorStore.deleteDocuments({ documentId: id });

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;