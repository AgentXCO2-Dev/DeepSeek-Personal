import dotenv from 'dotenv';
dotenv.config();

export const config = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  apiPassword: process.env.API_PASSWORD || 'DeepSeekAgentPersonal',
  chromaPersistDir: process.env.CHROMA_PERSIST_DIR || './chroma_db',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekModel: 'deepseek-v4-pro',
  maxMemoryResults: 5,
  port: process.env.PORT || 8000,
};
