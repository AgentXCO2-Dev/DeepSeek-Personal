import express from 'express';
import { authenticate } from '../auth.js';
import { storeMemory, buildContext } from '../memory.js';
import { chatCompletion } from '../deepseek-client.js';
import { SYSTEM_PROMPT } from '../prompts.js';

const router = express.Router();

router.post('/api/chat', authenticate, async (req, res) => {
  const { user_id, message, thinking = true, reasoning_effort = 'high' } = req.body;

  if (!user_id || !message) {
    return res.status(400).json({ error: 'user_id and message are required' });
  }

  try {
    const context = await buildContext(user_id, message);
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    if (context) {
      messages.push({
        role: 'user',
        content: `Here's some context from our past convos:\n${context}\n\nNow respond to this:`,
      });
    }
    messages.push({ role: 'user', content: message });

    const responseText = await chatCompletion(messages, thinking, reasoning_effort);
    await storeMemory(user_id, message, responseText);

    res.json({ response: responseText, memory_used: !!context });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
