import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Groq API (FREE – get from console.groq.com)
  groqApiKey: process.env.GROQ_API_KEY,
  
  // Password protection
  apiPassword: process.env.API_PASSWORD || 'DeepSeekAgentPersonal',
  
  // Memory settings (ChromaDB)
  chromaPersistDir: process.env.CHROMA_PERSIST_DIR || './chroma_db',
  maxMemoryResults: 5,
  
  // Server
  port: process.env.PORT || 8000,
};
