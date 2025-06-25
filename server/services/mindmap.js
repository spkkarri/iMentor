const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const aiService = require('../aiService');
const mindMapGenerator = require('../mindMapGenerator');
const fs = require('fs').promises;

router.post('/', tempAuth, async (req, res) => {
  try {
    const { file_id } = req.body;
    if (!file_id) {
      return res.status(400).json({ message: 'File ID is required' });
    }

    const file = await File.findOne({ _id: file_id, user: req.user.id });
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    const content = await fs.readFile(file.path, 'utf8');
    const mindMapData = await aiService.generateMindMapData(content, file.originalname);
    const formattedData = mindMapGenerator.formatForReactFlow(mindMapData);

    res.status(200).json({
      message: 'Mind map generated successfully',
      mindmap: formattedData
    });
  } catch (error) {
    console.error('Mind map generation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;