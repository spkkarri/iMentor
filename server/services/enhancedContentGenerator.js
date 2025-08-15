/**
 * Enhanced Content Generator for Reports, Presentations, and Podcasts
 * Generates comprehensive content through chat input with AI enhancement
 */

const path = require('path');
const fs = require('fs').promises;
const PptxGenJS = require("pptxgenjs");
const { generateReportPdf } = require('./pdfGenerator');
const { v4: uuidv4 } = require('uuid');

class EnhancedContentGenerator {
    constructor() {
        this.outputDirectory = path.join(__dirname, '..', 'generated_content');
        this.templates = new Map();
        this.contentCache = new Map();
        
        this.initializeGenerator();
    }

    /**
     * Initialize content generator
     */
    async initializeGenerator() {
        try {
            // Ensure output directory exists
            await fs.mkdir(this.outputDirectory, { recursive: true });
            
            // Initialize templates
            this.initializeTemplates();
            
            console.log('[ContentGenerator] Enhanced content generator initialized');
            
        } catch (error) {
            console.error('[ContentGenerator] Failed to initialize:', error);
        }
    }

    /**
     * Initialize content templates
     */
    initializeTemplates() {
        // Report templates
        this.templates.set('research_report', {
            sections: ['Executive Summary', 'Introduction', 'Methodology', 'Findings', 'Analysis', 'Conclusions', 'Recommendations'],
            style: 'academic',
            length: 'comprehensive'
        });
        
        this.templates.set('business_report', {
            sections: ['Executive Summary', 'Market Analysis', 'Competitive Landscape', 'Financial Overview', 'Strategic Recommendations'],
            style: 'professional',
            length: 'concise'
        });
        
        this.templates.set('technical_report', {
            sections: ['Abstract', 'Technical Overview', 'Implementation Details', 'Performance Analysis', 'Future Considerations'],
            style: 'technical',
            length: 'detailed'
        });
        
        // Presentation templates
        this.templates.set('business_presentation', {
            slides: ['Title', 'Agenda', 'Problem Statement', 'Solution Overview', 'Benefits', 'Implementation', 'Next Steps'],
            style: 'corporate',
            duration: '15-20 minutes'
        });
        
        this.templates.set('educational_presentation', {
            slides: ['Introduction', 'Learning Objectives', 'Key Concepts', 'Examples', 'Practice', 'Summary', 'Q&A'],
            style: 'educational',
            duration: '30-45 minutes'
        });
        
        // Podcast templates
        this.templates.set('interview_podcast', {
            segments: ['Introduction', 'Guest Introduction', 'Main Discussion', 'Key Insights', 'Rapid Fire Questions', 'Closing'],
            style: 'conversational',
            duration: '30-60 minutes'
        });
        
        this.templates.set('educational_podcast', {
            segments: ['Hook', 'Topic Introduction', 'Main Content', 'Examples', 'Key Takeaways', 'Call to Action'],
            style: 'informative',
            duration: '15-30 minutes'
        });
    }

    /**
     * Generate content based on chat input
     */
    async generateFromChatInput(input, contentType, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log(`[ContentGenerator] Generating ${contentType} from input: "${input.substring(0, 100)}..."`);
            
            // Parse input and determine content requirements
            const contentPlan = await this.planContent(input, contentType, options);
            
            // Generate content based on type
            let result;
            switch (contentType.toLowerCase()) {
                case 'report':
                    result = await this.generateReport(contentPlan, options);
                    break;
                case 'presentation':
                    result = await this.generatePresentation(contentPlan, options);
                    break;
                case 'podcast':
                    result = await this.generatePodcast(contentPlan, options);
                    break;
                default:
                    throw new Error(`Unsupported content type: ${contentType}`);
            }
            
            const duration = Date.now() - startTime;
            console.log(`[ContentGenerator] Generated ${contentType} in ${duration}ms`);
            
            return {
                success: true,
                contentType,
                result,
                duration,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    inputLength: input.length,
                    contentPlan
                }
            };
            
        } catch (error) {
            console.error(`[ContentGenerator] Failed to generate ${contentType}:`, error);
            
            return {
                success: false,
                error: error.message,
                contentType,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Plan content structure based on input
     */
    async planContent(input, contentType, options = {}) {
        // Analyze input to determine topic, scope, and requirements
        const analysis = this.analyzeInput(input);
        
        // Select appropriate template
        const template = this.selectTemplate(contentType, analysis, options);
        
        // Create content plan
        const plan = {
            topic: analysis.topic,
            scope: analysis.scope,
            audience: options.audience || analysis.audience || 'general',
            template: template,
            sections: template.sections || template.slides || template.segments,
            style: template.style,
            estimatedLength: this.estimateContentLength(template, analysis),
            keyPoints: analysis.keyPoints,
            requirements: analysis.requirements
        };
        
        return plan;
    }

    /**
     * Analyze input to extract content requirements
     */
    analyzeInput(input) {
        const inputLower = input.toLowerCase();
        
        // Extract topic
        let topic = 'General Topic';
        const topicPatterns = [
            /(?:about|on|regarding|concerning)\s+([^.!?]+)/i,
            /(?:create|generate|make).*(?:report|presentation|podcast).*(?:about|on)\s+([^.!?]+)/i
        ];
        
        for (const pattern of topicPatterns) {
            const match = input.match(pattern);
            if (match) {
                topic = match[1].trim();
                break;
            }
        }
        
        // Determine scope
        let scope = 'overview';
        if (inputLower.includes('comprehensive') || inputLower.includes('detailed')) {
            scope = 'comprehensive';
        } else if (inputLower.includes('brief') || inputLower.includes('summary')) {
            scope = 'brief';
        }
        
        // Determine audience
        let audience = 'general';
        if (inputLower.includes('technical') || inputLower.includes('developer')) {
            audience = 'technical';
        } else if (inputLower.includes('business') || inputLower.includes('executive')) {
            audience = 'business';
        } else if (inputLower.includes('student') || inputLower.includes('educational')) {
            audience = 'educational';
        }
        
        // Extract key points
        const keyPoints = this.extractKeyPoints(input);
        
        // Extract requirements
        const requirements = this.extractRequirements(input);
        
        return {
            topic,
            scope,
            audience,
            keyPoints,
            requirements
        };
    }

    /**
     * Extract key points from input
     */
    extractKeyPoints(input) {
        const points = [];
        
        // Look for bullet points or numbered lists
        const bulletPattern = /[•\-\*]\s*([^•\-\*\n]+)/g;
        const numberedPattern = /\d+\.\s*([^\d\n]+)/g;
        
        let match;
        while ((match = bulletPattern.exec(input)) !== null) {
            points.push(match[1].trim());
        }
        
        while ((match = numberedPattern.exec(input)) !== null) {
            points.push(match[1].trim());
        }
        
        // If no explicit points, extract sentences as potential points
        if (points.length === 0) {
            const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 10);
            points.push(...sentences.slice(0, 5).map(s => s.trim()));
        }
        
        return points;
    }

    /**
     * Extract specific requirements from input
     */
    extractRequirements(input) {
        const requirements = {};
        
        // Length requirements
        if (input.includes('short') || input.includes('brief')) {
            requirements.length = 'short';
        } else if (input.includes('long') || input.includes('comprehensive')) {
            requirements.length = 'long';
        }
        
        // Format requirements
        if (input.includes('PDF')) {
            requirements.format = 'pdf';
        } else if (input.includes('PowerPoint') || input.includes('PPT')) {
            requirements.format = 'pptx';
        }
        
        // Style requirements
        if (input.includes('formal')) {
            requirements.style = 'formal';
        } else if (input.includes('casual') || input.includes('informal')) {
            requirements.style = 'casual';
        }
        
        return requirements;
    }

    /**
     * Select appropriate template
     */
    selectTemplate(contentType, analysis, options) {
        const templateKey = options.template || this.getDefaultTemplate(contentType, analysis);
        const template = this.templates.get(templateKey);

        // If template not found, create a default one
        if (!template) {
            return {
                sections: ['Executive Summary', 'Introduction', 'Main Content', 'Analysis', 'Conclusion'],
                style: 'professional',
                length: 'comprehensive'
            };
        }

        return template;
    }

    /**
     * Get default template based on content type and analysis
     */
    getDefaultTemplate(contentType, analysis) {
        switch (contentType.toLowerCase()) {
            case 'report':
                if (analysis.audience === 'business') return 'business_report';
                if (analysis.audience === 'technical') return 'technical_report';
                return 'research_report';
                
            case 'presentation':
                if (analysis.audience === 'business') return 'business_presentation';
                return 'educational_presentation';
                
            case 'podcast':
                if (analysis.scope === 'interview') return 'interview_podcast';
                return 'educational_podcast';
                
            default:
                return `${contentType}_default`;
        }
    }

    /**
     * Estimate content length
     */
    estimateContentLength(template, analysis) {
        const baseLength = template.sections?.length || template.slides?.length || template.segments?.length || 5;
        
        let multiplier = 1;
        if (analysis.scope === 'comprehensive') multiplier = 1.5;
        if (analysis.scope === 'brief') multiplier = 0.7;
        
        return Math.round(baseLength * multiplier);
    }

    /**
     * Generate report
     */
    async generateReport(contentPlan, options = {}) {
        const reportId = uuidv4();
        const filename = `report_${reportId}.pdf`;
        const filepath = path.join(this.outputDirectory, filename);
        
        // Generate content for each section
        const sections = [];
        for (const sectionTitle of contentPlan.sections) {
            const sectionContent = await this.generateSectionContent(
                sectionTitle,
                contentPlan.topic,
                contentPlan.keyPoints,
                options
            );
            sections.push({ title: sectionTitle, content: sectionContent });
        }
        
        // Create PDF
        await this.createPDFReport(sections, contentPlan, filepath);
        
        return {
            type: 'report',
            format: 'pdf',
            filename,
            filepath,
            sections: sections.length,
            downloadUrl: `/api/files/download/${filename}`
        };
    }

    /**
     * Generate presentation
     */
    async generatePresentation(contentPlan, options = {}) {
        const presentationId = uuidv4();
        const filename = `presentation_${presentationId}.pptx`;
        const filepath = path.join(this.outputDirectory, filename);
        
        // Generate content for each slide
        const slides = [];
        for (const slideTitle of contentPlan.sections) {
            const slideContent = await this.generateSlideContent(
                slideTitle,
                contentPlan.topic,
                contentPlan.keyPoints,
                options
            );
            slides.push({ title: slideTitle, content: slideContent });
        }
        
        // Create PowerPoint
        await this.createPowerPointPresentation(slides, contentPlan, filepath);
        
        return {
            type: 'presentation',
            format: 'pptx',
            filename,
            filepath,
            slides: slides.length,
            downloadUrl: `/api/files/download/${filename}`
        };
    }

    /**
     * Generate podcast script
     */
    async generatePodcast(contentPlan, options = {}) {
        const podcastId = uuidv4();
        const filename = `podcast_script_${podcastId}.txt`;
        const filepath = path.join(this.outputDirectory, filename);
        
        // Generate content for each segment
        const segments = [];
        for (const segmentTitle of contentPlan.sections) {
            const segmentContent = await this.generatePodcastSegment(
                segmentTitle,
                contentPlan.topic,
                contentPlan.keyPoints,
                options
            );
            segments.push({ title: segmentTitle, content: segmentContent });
        }
        
        // Create podcast script
        await this.createPodcastScript(segments, contentPlan, filepath);
        
        return {
            type: 'podcast',
            format: 'script',
            filename,
            filepath,
            segments: segments.length,
            estimatedDuration: contentPlan.template.duration,
            downloadUrl: `/api/files/download/${filename}`
        };
    }

    /**
     * Generate section content using AI
     */
    async generateSectionContent(sectionTitle, topic, keyPoints, options) {
        // This would integrate with the AI service to generate content
        // For now, return placeholder content
        
        const prompt = `Generate a comprehensive section for "${sectionTitle}" about "${topic}". 
        Key points to include: ${keyPoints.join(', ')}
        
        Make it informative, well-structured, and appropriate for a ${options.audience || 'general'} audience.`;
        
        // Placeholder content - would be replaced with actual AI generation
        return `## ${sectionTitle}

This section covers important aspects of ${topic}. The content includes detailed analysis and insights based on current research and best practices.

Key points:
${keyPoints.map(point => `• ${point}`).join('\n')}

[Generated content would be much more comprehensive and detailed based on AI analysis]`;
    }

    /**
     * Generate slide content
     */
    async generateSlideContent(slideTitle, topic, keyPoints, options) {
        // Generate bullet points for slide
        const relevantPoints = keyPoints.slice(0, 5); // Limit to 5 points per slide
        
        return {
            title: slideTitle,
            bullets: relevantPoints.length > 0 ? relevantPoints : [
                `Key aspect of ${topic}`,
                `Important consideration`,
                `Practical application`,
                `Future implications`
            ]
        };
    }

    /**
     * Generate podcast segment
     */
    async generatePodcastSegment(segmentTitle, topic, keyPoints, options) {
        // Generate conversational script for podcast
        return `[${segmentTitle}]

Host: Welcome to this segment where we'll be discussing ${topic}. 

[Conversational content about the topic, incorporating key points: ${keyPoints.join(', ')}]

This segment would include natural dialogue, examples, and engaging discussion points.

[Generated content would be much more detailed and conversational]`;
    }

    /**
     * Create PDF report using the working PDF generator
     */
    async createPDFReport(sections, contentPlan, filepath) {
        try {
            // Combine sections into content
            const content = sections.map(section =>
                `# ${section.title}\n\n${section.content}`
            ).join('\n\n');

            // Use the working PDF generator
            const result = await generateReportPdf(contentPlan.topic, content, []);

            // Move the generated file to the expected location if needed
            const fs = require('fs');
            if (result.filepath !== filepath) {
                fs.copyFileSync(result.filepath, filepath);
            }

            return result;

        } catch (error) {
            console.error('[EnhancedContentGenerator] PDF creation failed:', error);
            throw error;
        }
    }

    /**
     * Create PowerPoint presentation
     */
    async createPowerPointPresentation(slides, contentPlan, filepath) {
        const pptx = new PptxGenJS();
        
        // Title slide
        const titleSlide = pptx.addSlide();
        titleSlide.addText(contentPlan.topic, { 
            x: 1, y: 2, w: 8, h: 2, fontSize: 32, bold: true, align: 'center' 
        });
        titleSlide.addText(`Generated on ${new Date().toLocaleDateString()}`, { 
            x: 1, y: 4, w: 8, h: 1, fontSize: 16, align: 'center' 
        });
        
        // Content slides
        slides.forEach(slideData => {
            const slide = pptx.addSlide();
            slide.addText(slideData.title, { 
                x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 24, bold: true 
            });
            
            if (slideData.content.bullets) {
                slide.addText(slideData.content.bullets.map(bullet => `• ${bullet}`).join('\n'), { 
                    x: 0.5, y: 1.5, w: 9, h: 5, fontSize: 16 
                });
            }
        });
        
        await pptx.writeFile(filepath);
    }

    /**
     * Create podcast script
     */
    async createPodcastScript(segments, contentPlan, filepath) {
        const script = [
            `PODCAST SCRIPT: ${contentPlan.topic}`,
            `Generated on: ${new Date().toLocaleDateString()}`,
            `Estimated Duration: ${contentPlan.template.duration}`,
            `Style: ${contentPlan.template.style}`,
            '',
            '=' * 50,
            ''
        ];
        
        segments.forEach((segment, index) => {
            script.push(`SEGMENT ${index + 1}: ${segment.title}`);
            script.push('-' * 30);
            script.push(segment.content);
            script.push('');
        });
        
        await fs.writeFile(filepath, script.join('\n'));
    }
}

module.exports = EnhancedContentGenerator;
