// server/utils/crypto.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// Ensure this key is in your .env file and is 32 bytes (256 bits) long.
// You can generate one with: require('crypto').randomBytes(32).toString('hex')
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_SECRET, 'hex');
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return null; // Return null if decryption fails
  }
}

module.exports = { encrypt, decrypt };