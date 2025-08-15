/**
 * PDF Generator Service
 * Generates professional PDF reports using pdfmake
 */

const pdfMake = require('pdfmake');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class PDFGenerator {
    constructor() {
        this.outputDirectory = path.join(__dirname, '..', 'public', 'generated');
        this.initializePDFMake();
        this.ensureOutputDirectory();
    }

    /**
     * Initialize PDFMake with fonts
     */
    initializePDFMake() {
        // Define fonts - using system fonts as fallback
        const fonts = {
            Roboto: {
                normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
                bold: path.join(__dirname, '../fonts/Roboto-Medium.ttf'),
                italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
                bolditalics: path.join(__dirname, '../fonts/Roboto-MediumItalic.ttf')
            }
        };

        // Check if custom fonts exist, otherwise use system defaults
        try {
            this.printer = new pdfMake(fonts);
        } catch (error) {
            console.log('[PDFGenerator] Custom fonts not found, using system defaults');
            // Use system fonts as fallback
            this.printer = new pdfMake({
                Roboto: {
                    normal: 'Helvetica',
                    bold: 'Helvetica-Bold',
                    italics: 'Helvetica-Oblique',
                    bolditalics: 'Helvetica-BoldOblique'
                }
            });
        }
    }

    /**
     * Ensure output directory exists
     */
    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.outputDirectory, { recursive: true });
        } catch (error) {
            console.error('[PDFGenerator] Failed to create output directory:', error);
        }
    }

    /**
     * Generate a comprehensive report PDF
     */
    async generateReportPdf(topic, content, sources = []) {
        try {
            const reportId = uuidv4();
            const filename = `report_${topic.replace(/[^a-zA-Z0-9]/g, '_')}_${reportId}.pdf`;
            const filepath = path.join(this.outputDirectory, filename);

            // Create document definition
            const documentDefinition = this.createReportDocumentDefinition(topic, content, sources);

            // Generate PDF
            const pdfDoc = this.printer.createPdfKitDocument(documentDefinition);
            const writeStream = require('fs').createWriteStream(filepath);
            
            pdfDoc.pipe(writeStream);
            pdfDoc.end();

            // Wait for file to be written
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            console.log(`[PDFGenerator] Report generated: ${filename}`);

            return {
                success: true,
                filename,
                filepath,
                downloadUrl: `/api/files/download-generated/${filename}`
            };

        } catch (error) {
            console.error('[PDFGenerator] Error generating report:', error);
            throw error;
        }
    }

    /**
     * Create document definition for report
     */
    createReportDocumentDefinition(topic, content, sources) {
        // Helper function to remove markdown formatting
        const cleanText = (text) => {
            if (!text) return '';
            return text
                .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
                .replace(/\*(.*?)\*/g, '$1')     // Remove italics
                .replace(/`(.*?)`/g, '$1')       // Remove code
                .replace(/#{1,6}\s/g, '')        // Remove headers
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links
        };

        // Helper function to capitalize title
        const toTitleCase = (str) => {
            return str.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        };

        // Split content into sections if it contains headers
        const sections = this.parseContentSections(content);

        const documentContent = [
            // Title page
            {
                text: toTitleCase(topic),
                style: 'title',
                alignment: 'center',
                margin: [0, 100, 0, 50]
            },
            {
                text: 'Research Report',
                style: 'subtitle',
                alignment: 'center',
                margin: [0, 0, 0, 20]
            },
            {
                text: `Generated on ${new Date().toLocaleDateString()}`,
                style: 'date',
                alignment: 'center',
                margin: [0, 0, 0, 100]
            },
            {
                text: '',
                pageBreak: 'after'
            },

            // Table of Contents
            {
                text: 'Table of Contents',
                style: 'header',
                margin: [0, 0, 0, 20]
            }
        ];

        // Add sections to TOC and content
        sections.forEach((section, index) => {
            // Add to TOC
            documentContent.push({
                text: `${index + 1}. ${section.title}`,
                style: 'tocItem',
                margin: [0, 0, 0, 5]
            });
        });

        // Page break after TOC
        documentContent.push({
            text: '',
            pageBreak: 'after'
        });

        // Add actual content sections
        sections.forEach((section, index) => {
            documentContent.push({
                text: `${index + 1}. ${section.title}`,
                style: 'sectionHeader',
                margin: [0, 20, 0, 10]
            });

            documentContent.push({
                text: cleanText(section.content),
                style: 'body',
                margin: [0, 0, 0, 15]
            });
        });

        // Add sources if available
        if (sources && sources.length > 0) {
            documentContent.push({
                text: '',
                pageBreak: 'before'
            });

            documentContent.push({
                text: 'References and Sources',
                style: 'header',
                margin: [0, 0, 0, 20]
            });

            sources.forEach((source, index) => {
                documentContent.push({
                    text: `${index + 1}. ${cleanText(source.title || 'Source')}`,
                    style: 'sourceTitle',
                    margin: [0, 0, 0, 5]
                });

                if (source.url) {
                    documentContent.push({
                        text: source.url,
                        style: 'sourceUrl',
                        margin: [20, 0, 0, 10]
                    });
                }

                if (source.snippet) {
                    documentContent.push({
                        text: cleanText(source.snippet),
                        style: 'sourceSnippet',
                        margin: [20, 0, 0, 15]
                    });
                }
            });
        }

        return {
            content: documentContent,
            styles: {
                title: {
                    fontSize: 24,
                    bold: true,
                    color: '#2c3e50'
                },
                subtitle: {
                    fontSize: 16,
                    color: '#7f8c8d'
                },
                date: {
                    fontSize: 12,
                    color: '#95a5a6'
                },
                header: {
                    fontSize: 18,
                    bold: true,
                    color: '#2c3e50',
                    margin: [0, 20, 0, 10]
                },
                sectionHeader: {
                    fontSize: 16,
                    bold: true,
                    color: '#34495e'
                },
                body: {
                    fontSize: 12,
                    lineHeight: 1.4,
                    alignment: 'justify'
                },
                tocItem: {
                    fontSize: 12,
                    color: '#2c3e50'
                },
                sourceTitle: {
                    fontSize: 11,
                    bold: true,
                    color: '#2c3e50'
                },
                sourceUrl: {
                    fontSize: 10,
                    color: '#3498db',
                    italics: true
                },
                sourceSnippet: {
                    fontSize: 10,
                    color: '#7f8c8d',
                    italics: true
                }
            },
            defaultStyle: {
                font: 'Roboto'
            },
            pageMargins: [60, 60, 60, 60],
            footer: function(currentPage, pageCount) {
                return {
                    text: `Page ${currentPage} of ${pageCount}`,
                    alignment: 'center',
                    fontSize: 10,
                    color: '#95a5a6'
                };
            }
        };
    }

    /**
     * Parse content into sections
     */
    parseContentSections(content) {
        if (!content) {
            return [{
                title: 'Executive Summary',
                content: 'No content available for this report.'
            }];
        }

        // Try to split by headers (markdown style)
        const headerPattern = /^#{1,3}\s+(.+)$/gm;
        const sections = [];
        let lastIndex = 0;
        let match;

        while ((match = headerPattern.exec(content)) !== null) {
            // Add previous section if exists
            if (lastIndex < match.index) {
                const prevContent = content.substring(lastIndex, match.index).trim();
                if (prevContent && sections.length > 0) {
                    sections[sections.length - 1].content += '\n\n' + prevContent;
                }
            }

            // Add new section
            sections.push({
                title: match[1].trim(),
                content: ''
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining content
        if (lastIndex < content.length) {
            const remainingContent = content.substring(lastIndex).trim();
            if (sections.length > 0) {
                sections[sections.length - 1].content = remainingContent;
            } else {
                sections.push({
                    title: 'Executive Summary',
                    content: remainingContent
                });
            }
        }

        // If no sections found, create default structure
        if (sections.length === 0) {
            return [
                {
                    title: 'Executive Summary',
                    content: content
                }
            ];
        }

        return sections;
    }

    /**
     * Generate simple PDF (for backward compatibility)
     */
    async generateSimplePdf(topic, content) {
        return this.generateReportPdf(topic, content, []);
    }
}

// Export both class and convenience function
const pdfGenerator = new PDFGenerator();

/**
 * Convenience function for generating report PDFs
 */
async function generateReportPdf(topic, content, sources = []) {
    return pdfGenerator.generateReportPdf(topic, content, sources);
}

module.exports = {
    PDFGenerator,
    generateReportPdf,
    pdfGenerator
};
