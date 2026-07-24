import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import chatRoutes from './routes/chat.js';
import authRoutes from './auth.js';
import { initMemory } from './memory.js';
import { config } from './config.js';
import { getDb } from './db.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = config.port || 8000;

// ============================
// MIDDLEWARE
// ============================

// CORS – allow all origins for testing (restrict in production)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON parser
app.use(express.json({ limit: '10mb' }));

// Passport (for Google OAuth)
app.use(passport.initialize());

// ============================
// LOGGING MIDDLEWARE (shows every request)
// ============================

app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// ============================
// ROUTES
// ============================

// Auth routes (login, register, paywall, Google)
app.use('/auth', authRoutes);

// API routes (chat, prompt – protected by JWT)
app.use('/api', chatRoutes);

// ============================
// TEST ENDPOINT (always logs)
// ============================

app.get('/test', (req, res) => {
  console.log('✅✅✅ TEST ENDPOINT HIT! Server is alive! ✅✅✅');
  res.json({
    message: 'Server is alive!',
    time: new Date().toISOString(),
    passwords: config.apiPasswords,
    passwordCount: config.apiPasswords.length,
    env: {
      hasMistralKey: !!config.mistralApiKey,
      hasJwtSecret: !!config.jwtSecret,
      hasGoogleClientId: !!config.googleClientId,
    }
  });
});

// ============================
// HEALTH CHECK
// ============================

app.get('/', (req, res) => {
  res.json({
    message: 'DeepSeek Memory API',
    status: 'online',
    auth: 'JWT + Google OAuth + Paywall',
    memory: 'in-memory (per user)',
    passwords: config.apiPasswords.length,
  });
});

// ============================
// START SERVER
// ============================

async function startServer() {
  try {
    console.log('🚀 Starting server...');
    
    // Initialize database
    console.log('📦 Initializing database...');
    await getDb();
    console.log('✅ Database ready');
    
    // Initialize memory
    console.log('🧠 Initializing memory...');
    await initMemory();
    console.log('✅ Memory ready');
    
    // Log configuration (without exposing secrets)
    console.log('🔑 Passwords configured:', config.apiPasswords.length);
    console.log('🔐 JWT: ' + (config.jwtSecret ? '✅ Set' : '❌ MISSING!'));
    console.log('🤖 Mistral: ' + (config.mistralApiKey ? '✅ Set' : '❌ MISSING!'));
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Test endpoint: https://deepseek-personal.onrender.com/test`);
      console.log(`🔑 ${config.apiPasswords.length} password(s) configured for paywall`);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Start the server
startServer();

// ============================
// ERROR HANDLING
// ============================

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled rejection:', err);
});
