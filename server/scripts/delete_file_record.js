const mongoose = require('mongoose');
const File = require('../models/File');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';

async function deleteFileRecord(originalname) {
    await mongoose.connect(MONGO_URI);
    const result = await File.deleteMany({ originalname });
    console.log(`Deleted ${result.deletedCount} record(s) for originalname: ${originalname}`);
    await mongoose.disconnect();
}

deleteFileRecord('AndroidNotesForProfessionals.pdf');
