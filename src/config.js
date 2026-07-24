import dotenv from 'dotenv';
dotenv.config();

/**
 * Reads the password list from environment variables.
 * Supports both old single-password (API_PASSWORD) and new multi-password (API_PASSWORDS) formats.
 * Returns an array of valid passwords – or an empty array if none are set.
 */
const getPasswords = () => {
  // 1. If multiple passwords are set (comma-separated) – use those
  if (process.env.API_PASSWORDS) {
    const passwords = process.env.API_PASSWORDS.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    if (passwords.length > 0) return passwords;
  }
  // 2. Fallback to single password (backward compatible)
  if (process.env.API_PASSWORD) {
    return [process.env.API_PASSWORD];
  }
  // 3. NO ULTIMATE FALLBACK – if nothing is set, return empty array
  return [];
};

export const config = {
  // Groq API key (FREE – from console.groq.com)
  groqApiKey: process.env.GROQ_API_KEY,
  
  // Array of valid passwords – all read from environment, never hardcoded
  // If this array is empty, authentication will reject all requests.
  apiPasswords: getPasswords(),
  
  // ChromaDB persistence directory
  chromaPersistDir: process.env.CHROMA_PERSIST_DIR || './chroma_db',
  
  // How many past memories to retrieve
  maxMemoryResults: 5,
  
  // Server port (Render injects this automatically)
  port: process.env.PORT || 8000,
};
