const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const aiService = require('../aiService');
const podcastGenerator = require('../podcastGenerator');
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
    // Check for minimum content length (e.g., 500 characters)
    if (!content || content.trim().length < 500) {
      return res.status(400).json({ message: 'The document does not have enough content to generate a podcast.' });
    }
    const script = await aiService.generatePodcastScript(content);
    const audioPath = await podcastGenerator.generateAudio(script, file_id);

    res.status(200).json({
      message: 'Podcast generated successfully',
      podcast: {
        audioUrl: `/podcasts/${path.basename(audioPath)}`,
        script
      }
    });
  } catch (error) {
    console.error('Podcast generation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;