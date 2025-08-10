// server/services/enhancedWebSearch.js
const axios = require('axios');
const cheerio = require('cheerio');

class EnhancedWebSearchService {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.timeout = 10000;
    }

    /**
     * Perform comprehensive search including text, videos, and media
     */
    async performEnhancedSearch(query, options = {}) {
        const { includeMedia = true, maxResults = 10 } = options;
        
        console.log(`🔍 Enhanced web search for: "${query}"`);
        
        try {
            const searchPromises = [
                this.searchDuckDuckGo(query, maxResults),
                includeMedia ? this.searchYouTubeVideos(query, 3) : Promise.resolve([]),
                includeMedia ? this.searchImages(query, 3) : Promise.resolve([]),
                includeMedia ? this.searchNews(query, 3) : Promise.resolve([])
            ];

            const [webResults, videoResults, imageResults, newsResults] = await Promise.allSettled(searchPromises);

            return {
                webResults: this.extractResults(webResults),
                videoResults: this.extractResults(videoResults),
                imageResults: this.extractResults(imageResults),
                newsResults: this.extractResults(newsResults),
                totalResults: this.extractResults(webResults).length + 
                             this.extractResults(videoResults).length + 
                             this.extractResults(imageResults).length + 
                             this.extractResults(newsResults).length
            };
        } catch (error) {
            console.error('Enhanced search failed:', error);
            return this.getFallbackResults(query);
        }
    }

    /**
     * Search DuckDuckGo for web results
     */
    async searchDuckDuckGo(query, maxResults = 10) {
        try {
            // Use DuckDuckGo HTML search for better results
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: this.timeout
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((index, element) => {
                if (index >= maxResults) return false;
                
                const $element = $(element);
                const title = $element.find('.result__title a').text().trim();
                const url = $element.find('.result__title a').attr('href');
                const snippet = $element.find('.result__snippet').text().trim();
                
                if (title && url) {
                    results.push({
                        title,
                        url: url.startsWith('//') ? 'https:' + url : url,
                        snippet,
                        type: 'web',
                        relevanceScore: this.calculateRelevanceScore(title, snippet, query)
                    });
                }
            });

            return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
        } catch (error) {
            console.error('DuckDuckGo search failed:', error);
            return [];
        }
    }

    /**
     * Search for YouTube videos
     */
    async searchYouTubeVideos(query, maxResults = 3) {
        try {
            // Use YouTube search without API key (scraping approach)
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: this.timeout
            });

            // Extract video data from YouTube's initial data
            const videoRegex = /"videoId":"([^"]+)".*?"title":{"runs":\[{"text":"([^"]+)"}.*?"lengthText":{"simpleText":"([^"]+)"}/g;
            const videos = [];
            let match;

            while ((match = videoRegex.exec(response.data)) !== null && videos.length < maxResults) {
                const [, videoId, title, duration] = match;
                videos.push({
                    title: title.replace(/\\u0026/g, '&'),
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`,
                    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    duration,
                    type: 'video',
                    platform: 'youtube',
                    relevanceScore: this.calculateRelevanceScore(title, '', query)
                });
            }

            return videos.sort((a, b) => b.relevanceScore - a.relevanceScore);
        } catch (error) {
            console.error('YouTube search failed:', error);
            return [];
        }
    }

    /**
     * Search for images
     */
    async searchImages(query, maxResults = 3) {
        try {
            // Use DuckDuckGo image search
            const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
            
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: this.timeout
            });

            // Extract image URLs from the response
            const imageRegex = /"image":"([^"]+)"/g;
            const images = [];
            let match;

            while ((match = imageRegex.exec(response.data)) !== null && images.length < maxResults) {
                const imageUrl = match[1].replace(/\\u002F/g, '/');
                images.push({
                    title: `Image result for: ${query}`,
                    url: imageUrl,
                    thumbnail: imageUrl,
                    type: 'image',
                    relevanceScore: 5 // Base score for images
                });
            }

            return images;
        } catch (error) {
            console.error('Image search failed:', error);
            return [];
        }
    }

    /**
     * Search for news articles
     */
    async searchNews(query, maxResults = 3) {
        try {
            // Use DuckDuckGo news search
            const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iar=news&ia=news`;
            
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: this.timeout
            });

            const $ = cheerio.load(response.data);
            const news = [];

            $('.result--news').each((index, element) => {
                if (index >= maxResults) return false;
                
                const $element = $(element);
                const title = $element.find('.result__title a').text().trim();
                const url = $element.find('.result__title a').attr('href');
                const snippet = $element.find('.result__snippet').text().trim();
                const source = $element.find('.result__url').text().trim();
                
                if (title && url) {
                    news.push({
                        title,
                        url,
                        snippet,
                        source,
                        type: 'news',
                        relevanceScore: this.calculateRelevanceScore(title, snippet, query)
                    });
                }
            });

            return news.sort((a, b) => b.relevanceScore - a.relevanceScore);
        } catch (error) {
            console.error('News search failed:', error);
            return [];
        }
    }

    /**
     * Calculate relevance score for search results
     */
    calculateRelevanceScore(title, snippet, query) {
        let score = 0;
        const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
        const titleLower = title.toLowerCase();
        const snippetLower = snippet.toLowerCase();

        // Title matches
        queryTerms.forEach(term => {
            if (titleLower.includes(term)) score += 3;
            if (snippetLower.includes(term)) score += 1;
        });

        // Exact phrase match bonus
        if (titleLower.includes(query.toLowerCase())) score += 5;
        if (snippetLower.includes(query.toLowerCase())) score += 2;

        // Length penalty for very short snippets
        if (snippet.length < 50) score -= 1;

        return Math.max(0, score);
    }

    /**
     * Extract results from Promise.allSettled
     */
    extractResults(promiseResult) {
        return promiseResult.status === 'fulfilled' ? promiseResult.value : [];
    }

    /**
     * Fallback results when search fails
     */
    getFallbackResults(query) {
        return {
            webResults: [{
                title: `Search results for: ${query}`,
                url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                snippet: 'Search functionality is temporarily unavailable. Please try again later.',
                type: 'web',
                relevanceScore: 1
            }],
            videoResults: [],
            imageResults: [],
            newsResults: [],
            totalResults: 1
        };
    }

    /**
     * Format search results for AI processing
     */
    formatResultsForAI(searchResults) {
        const { webResults, videoResults, imageResults, newsResults } = searchResults;
        
        let formattedText = '';

        if (webResults.length > 0) {
            formattedText += '## Web Search Results:\n';
            webResults.forEach((result, index) => {
                formattedText += `${index + 1}. **${result.title}**\n`;
                formattedText += `   URL: ${result.url}\n`;
                if (result.snippet) formattedText += `   Summary: ${result.snippet}\n`;
                formattedText += '\n';
            });
        }

        if (videoResults.length > 0) {
            formattedText += '## Video Results:\n';
            videoResults.forEach((result, index) => {
                formattedText += `${index + 1}. **${result.title}**\n`;
                formattedText += `   Video URL: ${result.url}\n`;
                if (result.duration) formattedText += `   Duration: ${result.duration}\n`;
                formattedText += '\n';
            });
        }

        if (newsResults.length > 0) {
            formattedText += '## News Results:\n';
            newsResults.forEach((result, index) => {
                formattedText += `${index + 1}. **${result.title}**\n`;
                formattedText += `   Source: ${result.source}\n`;
                formattedText += `   URL: ${result.url}\n`;
                if (result.snippet) formattedText += `   Summary: ${result.snippet}\n`;
                formattedText += '\n';
            });
        }

        return formattedText;
    }
}

module.exports = EnhancedWebSearchService;
