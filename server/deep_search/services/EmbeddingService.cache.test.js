// EmbeddingService.cache.test.js
// Test embedding cache functionality

const EmbeddingService = require('./EmbeddingService');

describe('EmbeddingService embedding cache', () => {
    let service;
    beforeEach(() => {
        service = new EmbeddingService();
    });

    test('embedChunks caches embeddings for repeated chunks', async () => {
        const chunks = ['repeat me', 'repeat me'];
        const first = await service.embedChunks(chunks, 'eng');
        expect(first[0].cached).toBe(false);
        expect(first[1].cached).toBe(true);
        expect(first[0].embedding).toEqual(first[1].embedding);
    });

    test('embedChunks cache is language-specific', async () => {
        const chunk = 'hello world';
        const first = await service.embedChunks([chunk], 'eng');
        const second = await service.embedChunks([chunk], 'fra');
        expect(first[0].cached).toBe(false);
        expect(second[0].cached).toBe(false); // Different lang, not cached
        expect(first[0].embedding).not.toEqual(second[0].embedding);
    });
});
