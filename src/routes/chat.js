import express from 'express';
import { authenticate } from '../middleware/auth.js'; // ✅ CORRECT IMPORT
import { storeMemory, buildContext } from '../memory.js';
import { chatCompletion } from '../deepseek-client.js';
import { SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT } from '../prompts.js';
import { moderateText, getSafetySystemPrompt } from '../guardrails.js';
import { getCustomPrompt, setCustomPrompt } from '../db.js';

const router = express.Router();

// All chat endpoints require authentication
router.use(authenticate);

// Get user's custom prompt
router.get('/prompt', async (req, res) => {
  const prompt = await getCustomPrompt(req.user.id);
  res.json({ prompt: prompt || '' });
});

// Set user's custom prompt (with moderation)
router.post('/prompt', async (req, res) => {
  const { prompt } = req.body;
  if (prompt && prompt.trim()) {
    const { flagged, score } = moderateText(prompt);
    if (flagged) {
      return res.status(400).json({ error: `Prompt flagged as unsafe (score: ${score})` });
    }
  }
  await setCustomPrompt(req.user.id, prompt?.trim() || null);
  res.json({ success: true });
});

// Chat endpoint
router.post('/chat', async (req, res) => {
  const { message, history = [], thinking = true, reasoning_effort = 'high' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  try {
    const userId = req.user.id.toString();

    // Get custom prompt from user settings
    const customPrompt = await getCustomPrompt(req.user.id);

    // Retrieve long‑term memory context
    const context = await buildContext(userId, message);

    // Build the messages array
    const messages = [];

    // Safety + custom prompt
    const safetyPrompt = getSafetySystemPrompt();
    let finalSystemPrompt = safetyPrompt;
    if (customPrompt) {
      finalSystemPrompt += `\n\n--- Additional Personality / Instructions from User ---\n${customPrompt}`;
    }
    messages.push({ role: 'system', content: finalSystemPrompt });

    if (context) {
      messages.push({
        role: 'user',
        content: `(Context from past conversations:)\n${context}`
      });
    }

    messages.push(...history);
    messages.push({ role: 'user', content: message });

    // Call LLM
    const responseText = await chatCompletion(messages, thinking, reasoning_effort);

    // Store memory
    await storeMemory(userId, message, responseText);

    res.json({ response: responseText, memory_used: !!context });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
