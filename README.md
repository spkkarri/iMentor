# Agentic AI Research Assistant for Engineering Education

## Project Update

### Project Overview
The Agentic AI Research Assistant is an innovative platform designed to revolutionize the way engineering students engage with academic content. This update introduces advanced multimedia and visualization features that streamline research and learning processes: from converting documents into podcasts, extracting interactive mindmaps, to enriching the user experience with a modernized landing page UI/UX.

---

### Key Features

1. **Podcast Generation with Text-to-Speech (TTS) and FFmpeg Integration**  
   This feature transforms text from academic documents into high-quality audio podcasts, enabling students to consume content effortlessly during commutes or multitasking.

   - **Text-to-Speech (TTS):** Converts textual content into clear, natural-sounding speech using advanced TTS engines, making information more accessible.  
   - **FFmpeg:** Handles multimedia processing including audio encoding and format conversion to produce polished podcast audio files.  
   - **Pydub:** Acts as the audio manipulation tool, bridging TTS output and FFmpeg processing for tasks like trimming, merging, and enhancing audio clips.

   **Installation Dependencies for Podcast Feature**  
   - FFmpeg: Must be installed and added to system PATH.  
   - Python Libraries: Install pydub and gtts via pip:  
     ```bash
     pip install pydub gtts
     ```

2. **Speech-to-Text (STT) and Text-to-Speech (TTS) Module**  
   These core multimedia modules enable interactive document processing and audio generation:

   - **Speech-to-Text (STT):** Converts spoken language from audio inputs into text, facilitating voice-based interactions and transcriptions of lectures or discussions.  
   - **Text-to-Speech (TTS):** Beyond podcast generation, TTS is used in interactive feedback systems and real-time reading assistance, providing users with audio versions of text content instantly.

   This bidirectional audio-text conversion enriches accessibility and user engagement, bridging the gap between reading and listening.

3. **Mindmap Extraction from Uploaded Documents**  
   The system analyzes document structure and content to generate dynamic mindmaps. These visual representations highlight relationships between key concepts, helping students to quickly understand complex subjects and organize knowledge intuitively.

   - Uses NLP techniques to identify hierarchical topics and subtopics.  
   - Automatically creates clear, interactive mindmaps tailored to the document’s content.

4. **Enhanced Landing Page UI/UX Design**  
   A visually appealing and intuitive landing page provides seamless navigation and interaction.

   - Responsive and modern design for all devices.  
   - User-centric workflow with smooth animations and quick access to core features.

---

### GitHub Repository  
Access the complete and updated codebase here:  
[https://github.com/AswanthAllu/intern_project.git](https://github.com/AswanthAllu/intern_project.git)

---

### Team Contributions

| Team Member        | GitHub ID    | Major Contributions                                                  |
|--------------------|--------------|----------------------------------------------------------------------|
| Jaya Aswanth Allu  | AswanthAllu  | Spearheaded podcast generation using TTS and FFmpeg; led landing page UI/UX redesign for enhanced user experience. |
| Solomon Matthews    | 7nos         | Integrated intelligent mindmap extraction for document visualization and knowledge mapping. |
| K. Sai Madava      | saimadava    | Developed and optimized Speech-to-Text and Text-to-Speech modules, enabling interactive audio-text conversions. |
| V. Hemasri Durga   | hemasridurga | Designed and implemented the mindmap generation engine, focusing on clarity and user-friendly visual structures. |

---

