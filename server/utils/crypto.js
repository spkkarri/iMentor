// server/utils/crypto.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// ENCRYPTION_KEY will be loaded from process.env by the main server and workers
// It MUST be a 32-byte (256-bit) key, represented as a 64-character hex string in .env
// Example for .env: ENCRYPTION_SECRET=your_64_character_hex_string_here
const ENCRYPTION_KEY_BUFFER = Buffer.from(process.env.ENCRYPTION_SECRET, 'hex');
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
  if (!text) return null; // Handle null or empty string input
  if (!process.env.ENCRYPTION_SECRET || ENCRYPTION_KEY_BUFFER.length !== 32) {
    console.error("FATAL: ENCRYPTION_SECRET is not set correctly (must be 64 hex chars / 32 bytes). Cannot encrypt.");
    throw new Error("Encryption service is not properly configured.");
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null; // Handle null or empty string input
  if (!process.env.ENCRYPTION_SECRET || ENCRYPTION_KEY_BUFFER.length !== 32) {
    console.error("FATAL: ENCRYPTION_SECRET is not set correctly (must be 64 hex chars / 32 bytes). Cannot decrypt.");
    throw new Error("Decryption service is not properly configured.");
  }
  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) { // Basic validation for the expected format
        console.error("Decryption failed: Invalid encrypted text format. Expected 'iv:encryptedText'. Received:", text);
        return null;
    }
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    console.log(`Decrypted key : ${decrypted.toString()}`);
    
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption failed for text:", text, "Error:", error.message, error.stack);
    return null; 
  }
}

module.exports = { encrypt, decrypt };