import dotenv from 'dotenv';
dotenv.config();

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
  // Mistral API (FREE – 1B tokens/month!)
  mistralApiKey: process.env.MISTRAL_API_KEY,
  
  // Passwords
  apiPasswords: getPasswords(),
  
  // Memory (simple in‑memory)
  maxMemoryResults: 5,
  
  // Server
  port: process.env.PORT || 8000,
};
