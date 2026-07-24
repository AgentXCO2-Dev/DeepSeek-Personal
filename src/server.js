import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.js';
import { initMemory } from './memory.js';
import { config } from './config.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = config.port || 8000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ===== ROUTES =====
app.use('/', chatRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello, twin! Your password‑protected AI is ready.',
    status: 'online',
    memory: 'in-memory (resets on restart)'
  });
});

// ===== START SERVER =====
async function startServer() {
  try {
    // Initialize memory (instant!)
    await initMemory();
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Twin AI running on port ${PORT}`);
      console.log(`🔐 Password protection: ${config.apiPasswords.length > 0 ? 'ON' : 'OFF (no passwords set!)'}`);
      console.log(`🧠 Memory: In-memory (${config.maxMemoryResults} results per query)`);
      console.log(`🔑 ${config.apiPasswords.length} password(s) configured`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();
