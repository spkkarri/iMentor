const PptxGenJS = require("pptxgenjs");
const path = require('path');
const fs = require('fs');
const { GeminiAI } = require('./geminiAI'); // Import GeminiAI class properly
const GeminiService = require('./geminiService'); // Import GeminiService class

let geminiAI;
let geminiService;

async function initializeGemini() {
  geminiService = new GeminiService();
  await geminiService.initialize();
  geminiAI = new GeminiAI(geminiService);
}

async function generatePPT(topic) {
  try {
    if (!geminiAI) {
      await initializeGemini();
    }

    let pptx = new PptxGenJS();

    // Generate content for each slide using GeminiAI
    const slideTitles = [
      "Introduction",
      "Background",
      "Current Status",
      "Challenges",
      "Opportunities",
      "Conclusion"
    ];

    // Generate content for each slide title as bullet points
    const slideContents = [];
    if (!geminiAI) {
      // If geminiAI is not initialized, use fallback static bullet points
      for (const title of slideTitles) {
        slideContents.push([
          `Point 1 about ${title} related to the topic "${topic}".`,
          `Point 2 about ${title}.`,
          `Point 3 about ${title}.`,
          `Point 4 about ${title}.`,
          `Point 5 about ${title}.`
        ]);
      }
    } else {
      for (const title of slideTitles) {
        const prompt = `Provide 5 concise bullet points about "${title}" related to the topic "${topic}". Format the response as a JSON array of strings.`;
        try {
          const content = await geminiAI.generateText(prompt);
          // Parse JSON array response
          let points = [];
          try {
            // Clean content from markdown json code block if present
            let cleanedContent = content.trim();
            if (cleanedContent.startsWith('```json')) {
              cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedContent.startsWith('```')) {
              cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            points = JSON.parse(cleanedContent);
            if (!Array.isArray(points)) throw new Error('Not an array');
          } catch (err) {
            // Fallback: split by newlines if JSON parse fails
            points = content.split('\n').filter(line => line.trim().length > 0);
          }
          slideContents.push(points.slice(0, 5)); // Take first 5 points
        } catch (err) {
          console.error(`Error generating content for slide "${title}":`, err);
          slideContents.push([
            `Content not available for ${title}.`
          ]);
        }
      }
    }

    // Slide 1: Title slide
    let slide1 = pptx.addSlide();
    slide1.addText(topic, { x: 1, y: 1.5, fontSize: 36, bold: true, color: "363636" });
    slide1.addText("Generated Presentation", { x: 1, y: 2.5, fontSize: 18, color: "6f6f6f" });

    // Add generated content slides as bullet points
    for (let i = 0; i < slideTitles.length; i++) {
      let slide = pptx.addSlide();

      // Add slide title with default theme styling
      slide.addText(slideTitles[i], { x: 0.5, y: 0.5, fontSize: 32, bold: true, color: "003366" });

      // Add bullet points with larger font size
      const points = slideContents[i];
      const bulletPoints = Array.isArray(points) ? points : [points];
      const cleanedBulletPoints = bulletPoints.map(point => point.replace(/```json|```/g, '').trim());
      const filteredBulletPoints = cleanedBulletPoints.filter(point => point.length > 0);

      // Start content just below the title
      let yOffset = 1.0; // Start just below the title

      for (const bulletPoint of filteredBulletPoints) {
        slide.addText(bulletPoint, {
          x: 0.7,
          y: yOffset,
          fontSize: 22,
          color: "000000",
          w: 8.5,
          h: 0.4, // Slightly reduced height
          bullet: true,
          wrap: true,
          indentLevel: 0
        });
        yOffset += 0.8; // Increased gap between points
      }

       // Add a placeholder image on the right side if available
       const imagePath = path.join(__dirname, '../assets/placeholder-image.png');
       if (fs.existsSync(imagePath)) {
         slide.addImage({ path: imagePath, x: 7, y: 1.2, w: 2, h: 2 });
       }
    }

    // Add an image slide if placeholder image exists
    const imagePath = path.join(__dirname, '../assets/placeholder-image.png');
    if (fs.existsSync(imagePath)) {
      let slide8 = pptx.addSlide();
      slide8.addText("Related Image", { x: 0.5, y: 0.5, fontSize: 28, bold: true, color: "363636" });
      slide8.addImage({ path: imagePath, x: 0.5, y: 1.0, w: 8, h: 4.5 });
    }

    // Save the presentation to a file
    const outputDir = path.join(__dirname, '../public/generated_ppts');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const fileName = `presentation_${Date.now()}.pptx`;
    const filePath = path.join(outputDir, fileName);

    await pptx.writeFile({ fileName: filePath });

    return filePath;
  } catch (error) {
    console.error('Error generating PPT:', error);
    throw error;
  }
}

module.exports = {
  generatePPT
};
