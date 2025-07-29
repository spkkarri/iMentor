// EmbeddingService.test.js
// Unit tests for EmbeddingService

const EmbeddingService = require('./EmbeddingService');

describe('EmbeddingService', () => {
    let service;
    beforeEach(() => {
        service = new EmbeddingService();
    });

    test('detectLanguage returns a language code', () => {
        expect(service.detectLanguage('This is an English sentence.')).toBe('eng');
        expect(service.detectLanguage('Ceci est une phrase française.')).toBe('fra');
    });

    test('chunkText splits text into sentence-based chunks', () => {
        const text = 'Sentence one. Sentence two! Sentence three? Sentence four.';
        const chunks = service.chunkText(text, 2);
        expect(chunks.length).toBe(2);
        expect(chunks[0]).toContain('Sentence one.');
        expect(chunks[0]).toContain('Sentence two!');
        expect(chunks[1]).toContain('Sentence three?');
        expect(chunks[1]).toContain('Sentence four.');
    });

    test('embedChunks returns embeddings for each chunk', async () => {
        const chunks = ['chunk1', 'chunk2'];
        const embeddings = await service.embedChunks(chunks, 'eng');
        expect(embeddings.length).toBe(2);
        expect(embeddings[0]).toHaveProperty('embedding');
        expect(Array.isArray(embeddings[0].embedding)).toBe(true);
        expect(embeddings[0].embedding.length).toBe(768);
    });

    test('cosineSimilarity returns a number between -1 and 1', () => {
        const a = [1, 0, 0];
        const b = [0, 1, 0];
        const c = [1, 0, 0];
        expect(EmbeddingService.cosineSimilarity(a, b)).toBeCloseTo(0);
        expect(EmbeddingService.cosineSimilarity(a, c)).toBeCloseTo(1);
    });
});
