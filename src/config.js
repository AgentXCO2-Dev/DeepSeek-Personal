import dotenv from 'dotenv';
dotenv.config();

/**
 * Collect Groq API keys from environment variables.
 * Looks for: GROQ_API_KEY, GROQ_API_KEY1, GROQ_API_KEY2, GROQ_API_KEY3
 * Only includes keys that are set (non-empty).
 */
const getGroqKeys = () => {
  const keys = [];
  const envKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY1,
    process.env.GROQ_API_KEY2,
    process.env.GROQ_API_KEY3
  ];
  
  for (const key of envKeys) {
    if (key && key.trim().length > 0) {
      keys.push(key.trim());
    }
  }
  return keys;
};

/**
 * Parse multiple passwords (comma-separated)
 */
const getPasswords = () => {
  if (process.env.API_PASSWORDS) {
    return process.env.API_PASSWORDS.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
  if (process.env.API_PASSWORD) {
    return [process.env.API_PASSWORD];
  }
  return [];
};

export const config = {
  // Groq – up to 4 keys
  groqApiKeys: getGroqKeys(),
  
  // Passwords
  apiPasswords: getPasswords(),
  
  // Memory (simple in‑memory)
  maxMemoryResults: 5,
  
  // Server
  port: process.env.PORT || 8000,
};
