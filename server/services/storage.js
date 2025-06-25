const mongoose = require('mongoose');
const User = require('../models/User');
const File = require('../models/File');
const ChatSession = require('../models/ChatSession');

class Storage {
  async createUser(user) {
    const newUser = new User(user);
    return await newUser.save();
  }

  async getUserById(userId) {
    return await User.findById(userId).select('-password');
  }

  async createDocument(insertDocument) {
    const document = new File({
      user: insertDocument.userId,
      filename: insertDocument.name,
      originalname: insertDocument.name,
      path: insertDocument.path,
      mimetype: 'application/octet-stream',
      size: insertDocument.size || 0,
      createdAt: new Date(),
    });
    return await document.save();
  }

  async getDocument(documentId) {
    return await File.findById(documentId);
  }

  async getDocumentsByUserId(userId) {
    return await File.find({ user: userId });
  }

  async createChatSession(insertChatSession) {
    const session = new ChatSession({
      sessionId: insertChatSession.id,
      user: insertChatSession.userId,
      title: insertChatSession.title || 'New Conversation',
      messages: insertChatSession.messages || [],
      systemPrompt: insertChatSession.systemPrompt || '',
    });
    return await session.save();
  }

  async getChatSession(sessionId) {
    const session = await ChatSession.findOne({ sessionId });
    if (!session) return null;
    return {
      id: session.sessionId,
      userId: session.user.toString(),
      title: session.title,
      messages: session.messages.map(msg => ({
        id: Math.random().toString(36).substring(2), // Generate temp ID for compatibility
        role: msg.role,
        content: msg.parts[0].text,
        documentId: msg.documentId || null,
        timestamp: msg.timestamp,
      })),
      systemPrompt: session.systemPrompt,
      createdAt: session.createdAt,
    };
  }

  async updateChatSession(sessionId, chatSession) {
    await ChatSession.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          title: chatSession.title,
          messages: chatSession.messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }],
            type: 'text',
            timestamp: msg.timestamp,
          })),
          systemPrompt: chatSession.systemPrompt,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  async getChatSessionsByUserId(userId) {
    const sessions = await ChatSession.find({ user: userId });
    return sessions.map(session => ({
      id: session.sessionId,
      userId: session.user.toString(),
      title: session.title,
      messages: session.messages.map(msg => ({
        id: Math.random().toString(36).substring(2),
        role: msg.role,
        content: msg.parts[0].text,
        documentId: msg.documentId || null,
        timestamp: msg.timestamp,
      })),
      systemPrompt: session.systemPrompt,
      createdAt: session.createdAt,
    }));
  }

  async createPodcast(insertPodcast) {
    return { id: Math.random().toString(36).substring(2), ...insertPodcast };
  }

  async getPodcastsByUserId(userId) {
    return [];
  }

  async createMindMap(insertMindMap) {
    return { id: Math.random().toString(36).substring(2), ...insertMindMap };
  }

  async getMindMapsByUserId(userId) {
    return [];
  }
}

module.exports = Storage;