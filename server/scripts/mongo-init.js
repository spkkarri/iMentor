// MongoDB initialization script
db = db.getSiblingDB('chatbotGeminiDB4');

// Create the database and a user
db.createUser({
  user: 'vinay',
  pwd: 'admin',
  roles: [
    {
      role: 'readWrite',
      db: 'chatbotGeminiDB4'
    }
  ]
});

// Create collections with basic indexes
db.createCollection('users');
db.createCollection('chatsessions');
db.createCollection('chathistory');
db.createCollection('files');
db.createCollection('memories');
db.createCollection('activitylogs');
db.createCollection('userapikeys');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.chatsessions.createIndex({ "userId": 1 });
db.chathistory.createIndex({ "sessionId": 1 });
db.files.createIndex({ "userId": 1 });
db.memories.createIndex({ "userId": 1 });
db.activitylogs.createIndex({ "userId": 1, "timestamp": -1 });

print('Database initialized successfully!');
