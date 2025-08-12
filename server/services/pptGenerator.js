const PptxGenJS = require("pptxgenjs");
const path = require('path');
const fs = require('fs');
const universalAI = require('./universalAIService');

async function generatePPT(topic, selectedModel = 'gemini-flash', userId = null) {
  try {
    let pptx = new PptxGenJS();

    // Generate content for each slide using selected AI model
    const slideTitles = [
      "Introduction",
      "Background",
      "Current Status",
      "Challenges",
      "Opportunities",
      "Conclusion"
    ];

    console.log(`[PPT] Generating content using ${selectedModel} for user ${userId}`);

    // Generate AI content for each slide
    const slideContents = [];

    for (let i = 0; i < slideTitles.length; i++) {
      try {
        const content = await universalAI.generatePPTContent(topic, slideTitles[i], selectedModel, userId);

        // Parse the AI response to extract bullet points
        const lines = content.split('\n').filter(line => line.trim());
        const bulletPoints = lines
          .filter(line => line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))
          .map(line => line.replace(/^[•\-*]\s*/, '').trim())
          .filter(point => point.length > 0);

        // If no bullet points found, create some from the content
        if (bulletPoints.length === 0) {
          const sentences = content.split('.').filter(s => s.trim().length > 10);
          slideContents.push(sentences.slice(0, 5).map(s => s.trim()));
        } else {
          slideContents.push(bulletPoints.slice(0, 5));
        }

        console.log(`[PPT] Generated content for slide ${i + 1}: ${slideTitles[i]}`);
      } catch (error) {
        console.warn(`[PPT] Failed to generate content for slide ${i + 1}, using fallback:`, error.message);
        // Fallback content
        slideContents.push([
          `Key aspects of ${topic}`,
          `Important considerations`,
          `Relevant information`,
          `Strategic insights`,
          `Action items`
        ]);
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
