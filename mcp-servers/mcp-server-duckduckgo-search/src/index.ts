// --- FusedChatbot/mcp-servers/mcp-server-duckduckgo-search/src/index.ts ---
// --- FINAL ENHANCED VERSION (Report Generator + Answer Engine) ---

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { marked } from 'marked';
import Groq from 'groq-sdk';
import { APIError } from 'groq-sdk/error';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// ==============================================================================
//  1. PROMPT TEMPLATE FOR PDF ANALYTICAL REPORT
//  This constant holds the detailed instructions for generating a full report.
// ==============================================================================
const ANALYST_REPORT_PROMPT = `
You are an expert-level data analyst and technical writer, tasked with generating a high-quality, professional, and data-driven analytical report on the topic of "{topic}".

**Primary Instructions:**
1.  **Analyze, Don't Just Summarize:** From the provided context, your main goal is to identify, extract, and present key data points, statistics, dates, technical specifications, and factual evidence.
2.  **Professional Table Formatting:** If you find comparative data (such as different types of a technology, feature comparisons, or pros and cons), you MUST format it into a Markdown table. **Crucially, introduce the table with a brief, descriptive sentence. Do not include the literal words "Markdown Table" in any of your report's headings or text.**
3.  **Insightful Interpretation:** You must derive specific, non-obvious insights **directly from the data you present.** Connect the dots for the reader and explain the *implications* of the data.
4.  **Cite Sources Clearly:** The source URLs are provided below. Use them to create a properly formatted "References" section at the end of the report.

---

**Mandatory Report Structure:**

- **Cover Page:** Title, Author ([Your Name]), Date ([Current Date]).
- **Table of Contents**
- **Executive Summary:** A concise, high-level overview of the most critical findings and interpretations from your analysis.
- **Introduction:** A brief background on the topic, setting the stage for the analysis.
- **Data Analysis / Findings:** The core data, statistics, and evidence extracted from the source material, including any necessary tables.
- **Key Observations & Interpretation:**
    -   **This is the most important section.** Go beyond simple summary.
    -   Analyze the connections *between* the data points you presented.
    -   Derive insights that are not immediately obvious from just reading the raw data.
- **Conclusion & Future Outlook:**
    -   Summarize the most important analytical takeaways from your report.
    -   Provide a **forward-looking statement**. Based on the trends you've analyzed, what might be the next evolution for this topic?
- **References:**
    -   Create a numbered list of the sources.
    -   List each URL that was provided to you in the "Source URLs" section below.

---

**Source URLs:**
{scrapedUrls}

**Context to Analyze:**
{input}

Begin the comprehensive and data-driven analytical report below:
`;


// ==============================================================================
//  NEW: PROMPT TEMPLATE FOR DIRECT QUESTION ANSWERING (RAG)
//  This prompt tells the AI to act as an answer engine, not a report writer.
// ==============================================================================
const DIRECT_ANSWER_PROMPT = `
You are an expert AI assistant. Your task is to provide a direct and factual answer to the user's question based *only* on the provided "Web Search Context".

**Core Instructions:**
1.  **Synthesize, Don't Just Copy:** Read all the provided search results and synthesize them into a single, cohesive, and rephrased answer.
2.  **Answer the User's Question:** Focus exclusively on answering the specific "{question}". Do not go off-topic.
3.  **Cite Everything:** After every sentence or claim, you MUST add a citation marker that corresponds to the source number, like "[1]", "[2]", etc. This is mandatory. If a single sentence uses information from multiple sources, cite them all, like "[1, 3]".
4.  **If You Can't Answer, Say So:** If the provided context does not contain the necessary information to answer the question, you must state: "I could not find a definitive answer in the provided search results." Do not make up information.
5.  **List Your References:** At the end of your answer, create a "References" section and list the full URLs for the sources you used.

---
**User's Question:** "{question}"
---
**Web Search Context:**
{context}
---

Begin your synthesized and cited answer now.
`;


// ==============================================================================
//  2. PROFESSIONAL PDF STYLING (CSS)
// ==============================================================================
const PDF_STYLES = `
    body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; }
    @page { size: A4; margin: 1in; }
    .content { padding: 0 1in; }
    .cover-page { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 100vh; padding: 1in; box-sizing: border-box; }
    h1, h2, h3 { font-weight: 600; color: #111; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 28px; margin-bottom: 16px; }
    .cover-page h1 { font-size: 28pt; border: none; margin-bottom: 20px; }
    .cover-page h2 { font-size: 14pt; border: none; font-weight: normal; color: #555; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
    th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: 600; }
    blockquote { border-left: 4px solid #ccc; padding-left: 20px; margin-left: 0; color: #555; font-style: italic; }
    .footer { width: 100%; font-size: 9pt; text-align: center; color: #777; }
`;

// ==============================================================================
//  3. HELPER FUNCTIONS
// ==============================================================================
function cleanText(text: string): string {
    let cleaned = text.replace(/\[.*?\]/g, '');
    cleaned = cleaned.replace(/\s\s+/g, ' ');
    return cleaned.trim();
}

function smartTrim(text: string, limit: number = 4000): string {
    if (text.length <= limit) return text;
    const trimmed = text.substring(0, limit);
    const lastPeriod = trimmed.lastIndexOf('.');
    if (lastPeriod > limit - 200 && lastPeriod !== -1) {
        return trimmed.substring(0, lastPeriod + 1);
    }
    return trimmed;
}

async function scrapeUrl(url: string): Promise<string | null> {
    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    for (let i = 0; i < 2; i++) {
        try {
            const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 15000 });
            const $ = cheerio.load(response.data);
            $('script, style, nav, footer, header, .ad, .advertisement, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();
            const rawText = $('body').text();
            return smartTrim(cleanText(rawText));
        } catch (error) {
            console.error(`[Scrape Fail] Attempt ${i + 1} for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
            if (i < 1) await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return null;
}

async function performSearch(query: string, count: number = 5) {
    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
        const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 10000 });
        const $ = cheerio.load(response.data);
        const results: { title: string; url: string; snippet: string }[] = [];
        $('.result').each((i, el) => {
            if (results.length >= count) return false;
            const title = $(el).find('.result__a').text().trim();
            let href = $(el).find('.result__a').attr('href');
            const snippet = $(el).find('.result__snippet').text().trim();
            if (title && href) {
                if (href.startsWith('//')) href = 'https:' + href;
                results.push({ title, url: href, snippet });
            }
        });
        return results;
    } catch (error) {
        console.error(`[Search Fail] DuckDuckGo search for "${query}" failed:`, error instanceof Error ? error.message : 'Unknown error');
        return [];
    }
}

// ==============================================================================
//  4. CACHING MECHANISM
// ==============================================================================
const topicCache = new Map<string, { pdfBuffer: Buffer, timestamp: number } | { markdown: string, timestamp: number }>();
const CACHE_TTL_MINUTES = 60;

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of topicCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MINUTES * 60 * 1000) {
            topicCache.delete(key);
            console.log(`[Cache] Expired entry for: ${key}`);
        }
    }
}, 10 * 60 * 1000);

// ==============================================================================
//  NEW: ADVANCED WEB SEARCH & ANSWER ENDPOINT (/answer)
//  This endpoint orchestrates the Search -> Scrape -> Rephrase -> Answer flow.
// ==============================================================================
app.post('/answer', async (req, res) => {
    console.log('[Request Start] Received /answer request.');
    const { question, api_keys } = req.body;

    if (!question || !api_keys || !api_keys.groq) {
        return res.status(400).json({ error: 'A "question" and a Groq API key are required.' });
    }

    try {
        // Step 1: Search the web to find the most relevant pages.
        console.log(`[Answer Engine] Searching for: "${question}"`);
        const searchResults = await performSearch(question, 5); // Use top 5 results for comprehensive context
        if (searchResults.length === 0) {
            throw new Error("Web search returned no results for that question.");
        }

        // Step 2: Scrape content from those pages ("Retrieve Max Data").
        console.log(`[Answer Engine] Scraping ${searchResults.length} sources.`);
        const sourceData: { url: string; content: string }[] = [];
        const scrapePromises = searchResults.map(async (result, index) => {
            const content = await scrapeUrl(result.url);
            if (content) {
                sourceData.push({ 
                    url: result.url, 
                    content: `[Source ${index + 1}: ${result.url}]\n${content}` 
                });
            }
        });
        await Promise.all(scrapePromises);

        if (sourceData.length === 0) {
            throw new Error("Could not gather any usable content from the top web sources.");
        }

        // Step 3: Combine all scraped data into a single context for the AI.
        const contextText = sourceData.map(d => d.content).join('\n\n---\n\n');
        const sourceUrls = sourceData.map(d => d.url);
        
        console.log(`[Answer Engine] Sending context (size: ${contextText.length}) to AI for synthesis.`);

        // Step 4: Send the context and question to the AI to be rephrased and answered.
        const groq = new Groq({ apiKey: api_keys.groq });
        const finalPrompt = DIRECT_ANSWER_PROMPT
            .replace('{question}', question)
            .replace('{context}', contextText);

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: finalPrompt }],
            model: 'llama3-8b-8192',
        });

        const answer = chatCompletion.choices[0]?.message?.content;
        if (!answer) {
            throw new Error('The AI service returned an empty answer.');
        }
        
        console.log('[Answer Engine] Successfully generated synthesized answer.');

        // Step 5: Return a structured JSON object to the user/UI.
        return res.json({
            answer: answer,
            sources: sourceUrls,
            usedWebSearch: true // A flag to tell the UI that this data came from the web.
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        const statusCode = error instanceof APIError ? (error.status || 500) : 500;
        console.error(`\n--- [FATAL] ANSWER ENGINE FAILED: ${errorMessage} ---\n`, error);
        return res.status(statusCode).json({ error: errorMessage, usedWebSearch: true });
    }
});


// ==============================================================================
//  ORIGINAL: PDF REPORT GENERATION ENDPOINT (/generate-report)
// ==============================================================================
app.post('/generate-report', async (req, res) => {
    console.log('[Request Start] Received /generate-report request.');
    const { topic, api_keys, preview, username } = req.body;

    if (!topic || !api_keys || !api_keys.groq) {
        return res.status(400).json({ error: 'Topic and Groq API key are required.' });
    }

    const sanitizedTopic = topic.trim().replace(/[^\w\s\-]/g, '');
    const cacheKey = `${sanitizedTopic}-${preview ? 'preview' : 'pdf'}`;

    if (topicCache.has(cacheKey)) {
        const cachedData = topicCache.get(cacheKey)!;
        if ((Date.now() - cachedData.timestamp < CACHE_TTL_MINUTES * 60 * 1000)) {
            console.log(`[Cache Hit] Serving cached ${preview ? 'markdown' : 'PDF'} for topic: "${sanitizedTopic}"`);
            if ('markdown' in cachedData) {
                return res.json({ markdown: cachedData.markdown });
            } else {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTopic.replace(/\s/g, '_')}_report.pdf"`);
                return res.send(cachedData.pdfBuffer);
            }
        }
    }
    
    console.log(`[Cache Miss] Generating new report for topic: "${sanitizedTopic}".`);

    try {
        const searchResults = await performSearch(sanitizedTopic, 5);
        if (searchResults.length === 0) throw new Error("Web search returned no results.");

        const sourceUrls = searchResults.map(r => r.url);
        const scrapedContents = await Promise.all(searchResults.map(r => scrapeUrl(r.url)));
        const contextText = scrapedContents.filter(Boolean).join('\n\n---\n\n');
        if (!contextText.trim()) throw new Error("Could not gather content from web sources.");

        const groq = new Groq({ apiKey: api_keys.groq });
        const finalPrompt = ANALYST_REPORT_PROMPT.replace('{topic}', sanitizedTopic).replace('{scrapedUrls}', sourceUrls.join('\n')).replace('{input}', contextText);
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: finalPrompt }],
            model: 'llama3-8b-8192',
        });
        const reportMarkdown = chatCompletion.choices[0]?.message?.content;
        if (!reportMarkdown) throw new Error('The AI service returned an empty response.');

        if (preview) {
            topicCache.set(cacheKey, { markdown: reportMarkdown, timestamp: Date.now() });
            return res.json({ markdown: reportMarkdown });
        }

        let htmlContent = await marked.parse(reportMarkdown) as string;
        const authorName = username || "AI Assistant";
        const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        htmlContent = htmlContent.replace(/\[Your Name\]/g, authorName).replace(/\[Current Date\]/g, currentDate);
        const finalHtmlForPdf = `<html><head><title>${sanitizedTopic} Report</title><style>${PDF_STYLES}</style></head><body><div class="content">${htmlContent}</div></body></html>`;

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(finalHtmlForPdf, { waitUntil: 'networkidle0' });

        const puppeteerOutput = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `<div style="font-size: 9pt; width: 100%; text-align: center; color: #777;">Report on ${sanitizedTopic}</div>`,
            footerTemplate: `<div class="footer"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
            margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
        });

        const pdfBuffer = Buffer.from(puppeteerOutput);
        await browser.close();
        if (pdfBuffer.length < 100) throw new Error(`PDF generation resulted in an empty file.`);

        console.log(`[Success] Sending valid PDF (Size: ${pdfBuffer.length} bytes) to client.`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTopic.replace(/\s/g, '_')}_report.pdf"`);
        res.send(pdfBuffer);

        topicCache.set(cacheKey, { pdfBuffer: pdfBuffer, timestamp: Date.now() });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        const statusCode = error instanceof APIError ? (error.status || 500) : 500;
        console.error(`\n--- [FATAL] PROCESS FAILED: ${errorMessage} ---\n`, error);
        return res.status(statusCode).json({ error: errorMessage });
    }
});

// ==============================================================================
//  6. START THE SERVER
// ==============================================================================
app.listen(PORT, () => {
    console.log(`Dual-function MCP Server (Reports & Answers) running on port ${PORT}`);
});