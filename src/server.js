import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.js';
import { initMemory } from './memory.js';
import { config } from './config.js';

dotenv.config();

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json());

app.use('/', chatRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Hello, twin! Your password‑protected AI is ready.' });
});

initMemory().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Twin AI running on port ${PORT}`);
  });
});
