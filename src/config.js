import dotenv from 'dotenv';
dotenv.config();

// ============================
// HELPER: Parse multiple passwords
// ============================

const getPasswords = () => {
  // 1. If multiple passwords are set (comma-separated)
  if (process.env.API_PASSWORDS) {
    return process.env.API_PASSWORDS.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
  // 2. Fallback to single password (backward compatible)
  if (process.env.API_PASSWORD) {
    return [process.env.API_PASSWORD];
  }
  // 3. No passwords set – return empty array (no one can pass paywall)
  return [];
};

// ============================
// CONFIG EXPORT
// ============================

export const config = {
  // ----- API Keys -----
  mistralApiKey: process.env.MISTRAL_API_KEY,
  
  // ----- Paywall (Shared Passwords) -----
  apiPasswords: getPasswords(),
  
  // ----- JWT Authentication -----
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // ----- Google OAuth -----
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/auth/google/callback',
  
  // ----- Database -----
  dbPath: process.env.DB_PATH || './data.sqlite',
  
  // ----- Memory -----
  maxMemoryResults: parseInt(process.env.MAX_MEMORY_RESULTS) || 5,
  
  // ----- Server -----
  port: parseInt(process.env.PORT) || 8000,
  
  // ----- Frontend URL (for OAuth redirect) -----
  frontendUrl: process.env.FRONTEND_URL || 'https://AgentXCO2-Dev.github.io/DeepSeek-Personal',
};

// ============================
// VALIDATION (optional but helpful)
// ============================

// Check if critical env vars are missing (log warning but don't crash)
if (!config.mistralApiKey) {
  console.warn('⚠️ MISTRAL_API_KEY is not set. The AI will not work.');
}

if (config.apiPasswords.length === 0) {
  console.warn('⚠️ No API_PASSWORDS set. The paywall will reject everyone.');
}

if (!config.jwtSecret || config.jwtSecret === 'dev-secret-key-change-me-in-production') {
  console.warn('⚠️ JWT_SECRET is using default value. Please set a secure secret in production.');
}

console.log('✅ Config loaded successfully');
console.log(`🔑 ${config.apiPasswords.length} password(s) configured for paywall`);
console.log(`🔐 JWT expires in ${config.jwtExpiresIn}`);
console.log(`🗄️  Database: ${config.dbPath}`);
console.log(`🧠 Max memory results: ${config.maxMemoryResults}`);
