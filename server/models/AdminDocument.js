// server/models/AdminDocument.js
const mongoose = require('mongoose');

const AdminDocumentSchema = new mongoose.Schema({
  filename: { // Server-generated unique filename (e.g., timestamp-originalname.ext)
    type: String,
    required: true,
    unique: true,
  },
  originalName: { // The original name of the file uploaded by the admin
    type: String,
    required: true,
  },
  text: { // Extracted text content from the document, ready for analysis input
    type: String,
    default: "",
  },
  analysis: {
    faq: { // Stores the full string output (including <thinking>) for FAQ generation
      type: String,
      default: "",
    },
    topics: { // Stores the full string output for Key Topics generation
      type: String,
      default: "",
    },
    mindmap: { // Stores the full string output for Mind Map generation
      type: String,
      default: "",
    },
  },
  uploadedAt: { // Timestamp of when the document record was created/file uploaded
    type: Date,
    default: Date.now,
  },
  // Optional: Add a timestamp for when analysis was last updated
  analysisUpdatedAt: {
    type: Date,
  }
});

// Index for frequently queried fields if necessary, e.g., originalName
AdminDocumentSchema.index({ originalName: 1 });

const AdminDocument = mongoose.model('AdminDocument', AdminDocumentSchema);

module.exports = AdminDocument;