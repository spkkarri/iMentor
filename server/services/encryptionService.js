// server/services/encryptionService.js

const crypto = require('crypto');
require('dotenv').config();

const algorithm = 'aes-256-cbc'; // Using a standard and secure algorithm
const key = Buffer.from(process.env.API_ENCRYPTION_KEY, 'hex'); // The key must be 32 bytes (256 bits)

// Security check: Ensure the encryption key is loaded.
if (!process.env.API_ENCRYPTION_KEY || key.length !== 32) {
  throw new Error('FATAL ERROR: API_ENCRYPTION_KEY is not defined or is not a 64-character hex string. Please check your .env file.');
}

const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
  if (text === null || typeof text === 'undefined') {
    return text;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (text === null || typeof text === 'undefined') {
    return text;
  }
  const textParts = text.split(':');
  if (textParts.length !== 2) {
      // Or handle this case as an error, depending on your logic
      console.error("Invalid encrypted text format. Expected 'iv:encryptedData'.");
      return null;
  }
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

module.exports = { encrypt, decrypt };