// server/services/standalonePptGenerator.js
// Standalone PPT generator that works without AI dependencies

const PptxGenJS = require("pptxgenjs");
const path = require('path');
const fs = require('fs');

/**
 * Generate a PowerPoint presentation with predefined content
 * @param {string} topic - The topic for the presentation
 * @param {string} selectedModel - The AI model (for compatibility, not used)
 * @param {string} userId - The user ID (for compatibility, not used)
 * @returns {Promise<string>} - Path to the generated PPT file
 */
async function generateStandalonePPT(topic, selectedModel = 'gemini-flash', userId = null) {
    try {
        console.log(`[StandalonePPT] Generating PPT for topic: "${topic}"`);
        
        let pptx = new PptxGenJS();
        
        // Define slide structure and content
        const slideData = generateSlideContent(topic);
        
        // Create title slide
        let titleSlide = pptx.addSlide();
        titleSlide.addText(topic, { 
            x: 0.5, 
            y: 2.0, 
            fontSize: 36, 
            bold: true, 
            color: "003366",
            align: 'center'
        });
        titleSlide.addText(`Generated on ${new Date().toLocaleDateString()}`, { 
            x: 0.5, 
            y: 3.5, 
            fontSize: 18, 
            color: "666666",
            align: 'center'
        });
        
        // Add content slides
        slideData.forEach((slide, index) => {
            let contentSlide = pptx.addSlide();
            
            // Add slide title
            contentSlide.addText(slide.title, { 
                x: 0.5, 
                y: 0.5, 
                fontSize: 32, 
                bold: true, 
                color: "003366" 
            });
            
            // Add bullet points
            const bulletPoints = slide.content.map(point => ({ text: point, options: { bullet: true } }));
            contentSlide.addText(bulletPoints, { 
                x: 0.5, 
                y: 1.5, 
                fontSize: 18, 
                color: "333333",
                lineSpacing: 32
            });
        });
        
        // Add conclusion slide
        let conclusionSlide = pptx.addSlide();
        conclusionSlide.addText("Thank You", { 
            x: 0.5, 
            y: 2.0, 
            fontSize: 36, 
            bold: true, 
            color: "003366",
            align: 'center'
        });
        conclusionSlide.addText("Questions & Discussion", { 
            x: 0.5, 
            y: 3.5, 
            fontSize: 24, 
            color: "666666",
            align: 'center'
        });
        
        // Save the presentation
        const outputDir = path.join(__dirname, '../public/generated_ppts');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const fileName = `presentation_${Date.now()}.pptx`;
        const filePath = path.join(outputDir, fileName);
        
        await pptx.writeFile({ fileName: filePath });
        
        console.log(`[StandalonePPT] PPT generated successfully: ${filePath}`);
        
        // Verify file exists and get size
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`[StandalonePPT] File size: ${(stats.size / 1024).toFixed(2)} KB`);
        }
        
        return filePath;
        
    } catch (error) {
        console.error('[StandalonePPT] Error generating PPT:', error);
        throw error;
    }
}

/**
 * Generate slide content based on topic
 * @param {string} topic - The presentation topic
 * @returns {Array} - Array of slide objects with title and content
 */
function generateSlideContent(topic) {
    const topicLower = topic.toLowerCase();
    
    // Technology topics
    if (topicLower.includes('ai') || topicLower.includes('artificial intelligence')) {
        return [
            {
                title: "Introduction to Artificial Intelligence",
                content: [
                    "Definition and scope of AI",
                    "Brief history and evolution",
                    "Current applications in daily life",
                    "Importance in modern technology"
                ]
            },
            {
                title: "Types of AI",
                content: [
                    "Narrow AI (Weak AI)",
                    "General AI (Strong AI)",
                    "Superintelligence",
                    "Machine Learning vs Deep Learning"
                ]
            },
            {
                title: "Applications",
                content: [
                    "Healthcare and medical diagnosis",
                    "Autonomous vehicles",
                    "Natural language processing",
                    "Computer vision and image recognition",
                    "Recommendation systems"
                ]
            },
            {
                title: "Challenges and Considerations",
                content: [
                    "Ethical implications",
                    "Job displacement concerns",
                    "Data privacy and security",
                    "Bias in AI algorithms",
                    "Regulatory frameworks"
                ]
            },
            {
                title: "Future Outlook",
                content: [
                    "Emerging trends and technologies",
                    "Potential breakthroughs",
                    "Impact on various industries",
                    "Preparing for an AI-driven future"
                ]
            }
        ];
    }
    
    // Machine Learning topics
    if (topicLower.includes('machine learning') || topicLower.includes('ml')) {
        return [
            {
                title: "Introduction to Machine Learning",
                content: [
                    "What is Machine Learning?",
                    "Difference from traditional programming",
                    "Key concepts and terminology",
                    "Real-world applications"
                ]
            },
            {
                title: "Types of Machine Learning",
                content: [
                    "Supervised Learning",
                    "Unsupervised Learning",
                    "Reinforcement Learning",
                    "Semi-supervised Learning"
                ]
            },
            {
                title: "Popular Algorithms",
                content: [
                    "Linear Regression",
                    "Decision Trees",
                    "Neural Networks",
                    "Support Vector Machines",
                    "Random Forest"
                ]
            },
            {
                title: "Implementation Process",
                content: [
                    "Data collection and preprocessing",
                    "Feature selection and engineering",
                    "Model training and validation",
                    "Performance evaluation",
                    "Deployment and monitoring"
                ]
            },
            {
                title: "Tools and Technologies",
                content: [
                    "Python and R programming",
                    "TensorFlow and PyTorch",
                    "Scikit-learn library",
                    "Cloud ML platforms",
                    "Data visualization tools"
                ]
            }
        ];
    }
    
    // Generic topic structure
    return [
        {
            title: "Introduction",
            content: [
                `Overview of ${topic}`,
                "Key objectives and goals",
                "Scope and importance",
                "Current relevance"
            ]
        },
        {
            title: "Background",
            content: [
                "Historical context",
                "Evolution and development",
                "Key milestones",
                "Current state"
            ]
        },
        {
            title: "Key Components",
            content: [
                "Main elements and features",
                "Core principles",
                "Important characteristics",
                "Critical factors"
            ]
        },
        {
            title: "Benefits and Advantages",
            content: [
                "Primary benefits",
                "Competitive advantages",
                "Positive outcomes",
                "Value proposition"
            ]
        },
        {
            title: "Challenges and Solutions",
            content: [
                "Common challenges",
                "Potential obstacles",
                "Proposed solutions",
                "Best practices"
            ]
        },
        {
            title: "Future Prospects",
            content: [
                "Emerging trends",
                "Future opportunities",
                "Expected developments",
                "Long-term outlook"
            ]
        }
    ];
}

/**
 * Generate PPT with enhanced error handling
 * @param {string} topic - The topic for the presentation
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} - Result object with success status and file info
 */
async function generateStandalonePPTWithResult(topic, options = {}) {
    try {
        const pptPath = await generateStandalonePPT(topic, options.selectedModel, options.userId);
        const fileName = path.basename(pptPath);
        
        return {
            success: true,
            filePath: pptPath,
            fileName: fileName,
            downloadUrl: `/api/files/download-generated/${fileName}`,
            message: `PowerPoint presentation "${topic}" generated successfully!`,
            type: 'standalone'
        };
        
    } catch (error) {
        console.error('[StandalonePPT] Generation failed:', error);
        
        return {
            success: false,
            error: error.message,
            message: `Failed to generate PowerPoint presentation: ${error.message}`,
            type: 'standalone'
        };
    }
}

module.exports = {
    generateStandalonePPT,
    generateStandalonePPTWithResult,
    generateSlideContent
};
