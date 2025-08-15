# Podcast Generation Documentation

## Overview

The TutorAI application now supports robust podcast generation that works with both **Gemini** and **Ollama** models, with intelligent fallback mechanisms to ensure reliability.

## Features

✅ **Multi-Model Support**: Works with Gemini, Ollama, and fallback generation  
✅ **Automatic Model Detection**: Intelligently switches between AI services  
✅ **Fallback Mechanism**: Generates podcasts even when AI services are unavailable  
✅ **Audio Generation**: Converts text to speech using Google TTS  
✅ **Error Handling**: Robust error handling with graceful degradation  

## How It Works

### 1. Model Selection
The system automatically detects the selected model and routes to the appropriate AI service:

- **Gemini Models**: `gemini-flash`, `gemini-pro`, etc.
- **Ollama Models**: `ollama-llama3.2`, `llama-model`, etc.
- **Fallback**: When AI services are unavailable

### 2. Podcast Script Generation

#### Gemini Generation
- Uses Google's Gemini API for high-quality script generation
- Requires `GEMINI_API_KEY` environment variable
- Generates natural, conversational podcast scripts

#### Ollama Generation  
- Uses local Ollama models for privacy-focused generation
- Requires user-specific Ollama configuration
- Supports various Llama model variants

#### Fallback Generation
- Activates when AI services are unavailable
- Creates structured podcast scripts from document content
- Extracts key topics and creates engaging summaries

### 3. Audio Generation
- Converts generated scripts to MP3 audio files
- Uses Google Text-to-Speech (node-gtts)
- Optimizes text for better speech synthesis
- Stores audio files in `/public/audio/` directory

## API Endpoints

### Generate Podcast from File
```http
POST /api/podcast/generate/:fileId
Content-Type: application/json

{
  "selectedModel": "gemini-flash",  // or "ollama-llama3.2"
  "userId": "user_id_here"
}
```

### Test Podcast Generation
```http
POST /api/podcast/test
Content-Type: application/json

{
  "selectedModel": "gemini-flash",
  "userId": "user_id_here"
}
```

## Response Format

```json
{
  "success": true,
  "message": "Podcast MP3 generated successfully!",
  "title": "Podcast: Document Name",
  "script": "Hey there, welcome back! Today we're discussing...",
  "audioUrl": "/audio/podcast_123456789.mp3",
  "fileSize": "0.86MB",
  "duration_estimate": "2 minutes",
  "key_points": ["Generated using gemini-flash"],
  "model": "gemini-flash",
  "instructions": "Click the audio player below to listen to your podcast!"
}
```

## Configuration

### Environment Variables
```env
# Required for Gemini models
GEMINI_API_KEY=your_gemini_api_key_here

# Server configuration
PORT=4007
NODE_ENV=development
```

### Model Configuration
- **Gemini**: Automatically configured when API key is available
- **Ollama**: Requires user-specific setup in the database
- **Fallback**: Always available, no configuration needed

## Error Handling

The system includes comprehensive error handling:

1. **API Key Missing**: Falls back to alternative generation
2. **Model Unavailable**: Switches to fallback generation  
3. **Network Issues**: Provides graceful error messages
4. **Audio Generation Fails**: Returns script-only response

## File Structure

```
server/
├── routes/podcast.js              # API endpoints
├── services/
│   ├── simplePodcastGenerator.js  # Main podcast generation logic
│   ├── textToSpeech.js           # Audio generation service
│   ├── geminiAI.js               # Gemini AI integration
│   └── userSpecificAI.js         # Ollama integration
└── public/
    └── audio/                     # Generated audio files
```

## Usage Examples

### Frontend Integration
```javascript
// Generate podcast from uploaded file
const response = await fetch('/api/podcast/generate/FILE_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    selectedModel: 'gemini-flash',
    userId: currentUserId
  })
});

const podcast = await response.json();
if (podcast.success) {
  // Play audio
  const audio = new Audio(podcast.audioUrl);
  audio.play();
}
```

### Model Switching
```javascript
// Switch between models dynamically
const models = ['gemini-flash', 'ollama-llama3.2', 'gemini-pro'];
const selectedModel = models[userChoice];

const podcast = await generatePodcast(fileId, selectedModel, userId);
```

## Performance

- **Script Generation**: 2-5 seconds (depending on model)
- **Audio Generation**: 3-8 seconds (depending on script length)
- **File Size**: ~0.8-1.2 MB per 2-3 minute podcast
- **Supported Formats**: MP3 audio output

## Troubleshooting

### Common Issues

1. **"GEMINI_API_KEY not found"**
   - Add your Gemini API key to the `.env` file
   - System will use fallback generation automatically

2. **"Ollama service not available"**
   - Ensure Ollama is configured for the user
   - System will use fallback generation automatically

3. **Audio generation fails**
   - Check network connectivity for Google TTS
   - System returns script-only response as fallback

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

## Future Enhancements

- [ ] Multiple voice support for conversations
- [ ] Custom voice selection
- [ ] Podcast chapter markers
- [ ] Background music integration
- [ ] Batch podcast generation
- [ ] Podcast RSS feed generation

## Support

The podcast generation system is designed to be robust and reliable. If you encounter issues:

1. Check the server logs for detailed error messages
2. Verify your API keys and model configurations
3. Test with the `/api/podcast/test` endpoint
4. The system will always provide some form of podcast output, even in fallback mode
