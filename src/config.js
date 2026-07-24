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
  // Cerebras API (FREE – get from inference.cerebras.ai)
  cerebrasApiKey: process.env.CEREBRAS_API_KEY,
  
  // Passwords
  apiPasswords: getPasswords(),
  
  // Memory (simple in‑memory)
  maxMemoryResults: 5,
  
  // Server
  port: process.env.PORT || 8000,
};
