// server/services/personalizationService.test.js

const personalizationService = require('./personalizationService');
const { ChatSession } = require('../models/ChatSession');
const serviceManager = require('./serviceManager');

// Mock the dependencies
jest.mock('../models/ChatSession');
jest.mock('./serviceManager', () => ({
    getServices: jest.fn(),
}));

describe('PersonalizationService', () => {
    let mockGeminiAI;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Setup the mock for the GeminiAI service
        mockGeminiAI = {
            generateText: jest.fn(),
            geminiService: {
                isEnabled: jest.fn().mockReturnValue(true),
            },
        };
        
        serviceManager.getServices.mockReturnValue({ geminiAI: mockGeminiAI });
    });

    it('should generate a user profile based on chat history', async () => {
        // Arrange: Setup mock data and implementations
        const fakeUserId = 'user123';
        const fakeChatHistory = [
            {
                messages: [
                    { role: 'user', parts: [{ text: 'What is Python?' }] },
                    { role: 'assistant', parts: [{ text: 'Python is a language...' }] },
                    { role: 'user', parts: [{ text: 'Show me a for loop.' }] },
                ],
            },
            {
                messages: [
                    { role: 'user', parts: [{ text: 'How do lists work?' }] },
                    { role: 'assistant', parts: [{ text: 'Lists are like arrays...' }] },
                    { role: 'user', parts: [{ text: 'Tell me about dictionaries.' }] },
                    { role: 'user', parts: [{ text: 'What about variables?' }] },
                ],
            },
        ];
        
        const expectedProfile = 'This user is a beginner in Python, asking fundamental questions.';
        
        // Mock the database call
        ChatSession.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(fakeChatHistory),
        });

        // Mock the AI call
        mockGeminiAI.generateText.mockResolvedValue(expectedProfile);

        // Act: Call the function to be tested
        const profile = await personalizationService.generateUserProfile(fakeUserId);

        // Assert: Verify the behavior and results
        expect(ChatSession.find).toHaveBeenCalledWith({ user: fakeUserId });
        expect(mockGeminiAI.generateText).toHaveBeenCalledTimes(1);

        // Check that the prompt sent to the AI contains the user's messages
        const promptSentToAI = mockGeminiAI.generateText.mock.calls[0][0];
        expect(promptSentToAI).toContain('What is Python?');
        expect(promptSentToAI).toContain('Show me a for loop.');
        expect(promptSentToAI).toContain('How do lists work?');
        
        // Ensure assistant messages are NOT included in the prompt
        expect(promptSentToAI).not.toContain('Python is a language...');

        // Check the final output
        expect(profile).toBe(expectedProfile);
    });

    it('should return an empty string if there is no chat history', async () => {
        // Arrange: Mock the database to return an empty array
        ChatSession.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([]),
        });

        // Act
        const profile = await personalizationService.generateUserProfile('user-no-history');

        // Assert
        expect(profile).toBe('');
        expect(mockGeminiAI.generateText).not.toHaveBeenCalled();
    });

    it('should return an empty string if the AI service is disabled', async () => {
        // Arrange: Mock the AI service as disabled
        mockGeminiAI.geminiService.isEnabled.mockReturnValue(false);

        // Act
        const profile = await personalizationService.generateUserProfile('any-user');

        // Assert
        expect(profile).toBe('');
        expect(ChatSession.find).not.toHaveBeenCalled();
        expect(mockGeminiAI.generateText).not.toHaveBeenCalled();
    });
});