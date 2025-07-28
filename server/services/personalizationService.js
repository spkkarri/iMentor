// server/services/personalizationService.js

const User = require('../models/User');
const Memory = require('../models/Memory');

class PersonalizationService {
    /**
     * Generates a short-term summary of the current conversation to maintain context.
     * @param {Array} messages - The array of messages in the current chat.
     * @param {object} geminiAI - The initialized GeminiAI service instance.
     * @returns {Promise<string>} A concise summary of the conversation.
     */
    async generateConversationSummary(messages, geminiAI) {
        if (!messages || messages.length < 4) return '';

        const conversationText = messages.map(m => `${m.role}: ${m.parts.map(p => p.text).join(' ')}`).join('\n');
        const prompt = `
        Concisely summarize the following conversation between a user and an AI tutor.
        Focus on the main topics discussed and any key questions the user has asked.
        This summary will be used as short-term memory for the AI in the next turn.

        Conversation:
        ---
        ${conversationText}
        ---

        Provide ONLY the summary.
        `;

        try {
            const summary = await geminiAI.generateText(prompt);
            console.log(`[Personalization] Generated short-term summary: ${summary}`);
            return summary;
        } catch (error) {
            console.error(`[Personalization] Failed to generate conversation summary:`, error.message);
            return '';
        }
    }

    /**
     * Updates the user's long-term profile based on their recent conversation.
     * @param {string} userId - The ID of the user.
     * @param {Array} lastConversationMessages - The messages from the most recent interaction.
     * @param {object} geminiAI - The initialized GeminiAI service instance.
     */
    async updateUserProfile(userId, lastConversationMessages, geminiAI) {
        if (!userId || !lastConversationMessages || lastConversationMessages.length === 0) return;

        try {
            const user = await User.findById(userId);
            if (!user) return;

            const existingProfile = user.personalizationProfile || 'No existing profile.';
            const conversationText = lastConversationMessages
                .map(m => `${m.role}: ${m.parts.map(p => p.text).join(' ')}`)
                .join('\n');

            const prompt = `
            A user's existing personalization profile is provided below, along with the transcript of their most recent conversation with an AI tutor.
            Refine and update the profile based on the new conversation. The profile should be a concise, one-paragraph summary (2-3 sentences max) of the user's interests, knowledge level, and preferred interaction style.

            Existing Profile:
            ---
            ${existingProfile}
            ---

            Most Recent Conversation:
            ---
            ${conversationText}
            ---

            Provide ONLY the new, updated summary paragraph.
            `;

            const updatedProfile = await geminiAI.generateText(prompt);
            user.personalizationProfile = updatedProfile.trim();
            await user.save();
            console.log(`[Personalization] Updated long-term profile for user ${userId}: ${user.personalizationProfile}`);
        } catch (error) {
            console.error(`[Personalization] Failed to update user profile for ${userId}:`, error.message);
        }
    }

    /**
     * Autonomously manages the user's long-term memory.
     * Analyzes a conversation, compares it against existing memories, and decides
     * whether to add, update, or delete facts.
     * @param {string} userId - The ID of the user.
     * @param {Array} conversationMessages - The messages from the current session.
     * @param {object} geminiAI - The initialized GeminiAI service instance.
     * @returns {Promise<Object>} An object detailing the changes made, e.g., { added: [], updated: [], deleted: [] }
     */
    async extractAndUpdateMemories(userId, conversationMessages, geminiAI) {
        // FIX: Condition changed to run on every message, even the first one.
        if (!userId || !conversationMessages || conversationMessages.length === 0) {
            return { added: [], updated: [], deleted: [] };
        }

        try {
            const existingMemories = await Memory.find({ user: userId }).lean();
            const conversationText = conversationMessages.map(m => `${m.role}: ${m.parts.map(p => p.text).join(' ')}`).join('\n');

            const prompt = `
            You are an AI memory management system. Your task is to maintain a concise list of key facts about a user based on your conversation with them.
            Analyze the "Current Conversation" and compare it with the "Existing Memories".
            Decide if any memories should be added, updated, or deleted.

            RULES:
            1.  **Add:** Extract new, significant, and lasting facts about the user (e.g., "User is a professional software engineer", "User's main project is about IoT devices"). Do NOT add trivial facts (e.g., "User said hello").
            2.  **Update:** If the conversation provides new information that corrects or evolves an existing memory, provide the original content and the new, updated content. (e.g., Original: "User is learning Python", New: "User is now proficient in Python").
            3.  **Delete:** If a memory is clearly stated as no longer true or is outdated and irrelevant, mark it for deletion.
            4.  **Accuracy:** Be very precise. Do not infer beyond what is stated.

            Existing Memories:
            ---
            ${existingMemories.length > 0 ? JSON.stringify(existingMemories.map(m => ({ id: m._id.toString(), content: m.content })), null, 2) : "[]"}
            ---

            Current Conversation:
            ---
            ${conversationText}
            ---

            Respond with ONLY a valid JSON object in the following format. Do not add any other text.
            {
              "add": ["New fact to remember about the user."],
              "update": [{ "id": "memory_id_to_update", "newContent": "The updated fact." }],
              "delete": [{ "id": "memory_id_to_delete", "reason": "Brief reason for deletion." }]
            }
            If no changes are needed, return an object with empty arrays.
            `;

            const responseText = await geminiAI.generateText(prompt);
            let changes = { added: [], updated: [], deleted: [] };
            let memoryActions = { add: [], update: [], delete: [] };

            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                memoryActions = JSON.parse(jsonMatch[0]);
            }

            // Process deletions
            if (memoryActions.delete && memoryActions.delete.length > 0) {
                const idsToDelete = memoryActions.delete.map(d => d.id);
                await Memory.deleteMany({ _id: { $in: idsToDelete }, user: userId });
                changes.deleted = memoryActions.delete;
            }

            // Process updates
            if (memoryActions.update && memoryActions.update.length > 0) {
                for (const u of memoryActions.update) {
                    await Memory.updateOne({ _id: u.id, user: userId }, { $set: { content: u.newContent } });
                }
                changes.updated = memoryActions.update;
            }

            // Process additions
            if (memoryActions.add && memoryActions.add.length > 0) {
                for (const content of memoryActions.add) {
                    // Use upsert to add new memories and prevent exact duplicates
                    await Memory.updateOne({ user: userId, content: content }, { $set: { user: userId, content: content } }, { upsert: true });
                }
                changes.added = memoryActions.add;
            }
            
            if (changes.added.length > 0 || changes.updated.length > 0 || changes.deleted.length > 0) {
                console.log(`[Personalization] Autonomous memory update for user ${userId}:`, changes);
            }

            return changes;

        } catch (error) {
            console.error(`[Personalization] Failed to autonomously update memories for user ${userId}:`, error.message);
            return { added: [], updated: [], deleted: [] };
        }
    }
}

module.exports = new PersonalizationService();