import express from 'express';
import { authenticate } from '../auth.js';
import { storeMemory, buildContext } from '../memory.js';
import { chatCompletion } from '../deepseek-client.js';
import { SYSTEM_PROMPT } from '../prompts.js';

const router = express.Router();

router.post('/api/chat', authenticate, async (req, res) => {
  const { user_id, message, history = [], thinking = true, reasoning_effort = 'high' } = req.body;

  if (!user_id || !message) {
    return res.status(400).json({ error: 'user_id and message are required' });
  }

  try {
    // 1. Retrieve long‑term memory context (from past sessions)
    const context = await buildContext(user_id, message);

    // 2. Build the messages array for the LLM
    const messages = [];

    // Add system prompt (with safety)
    messages.push({ role: 'system', content: SYSTEM_PROMPT });

    // If we have long‑term memory context, inject it as a user message
    if (context) {
      messages.push({
        role: 'user',
        content: `(Here is some context from our past conversations that might be relevant:)\n${context}`
      });
    }

    // Add the conversation history from the current session (sent from frontend)
    // history already contains the user and assistant messages from this chat
    messages.push(...history);

    // Add the new user message (the current one)
    messages.push({ role: 'user', content: message });

    // 3. Call the LLM (Mistral / Groq / etc.)
    const responseText = await chatCompletion(messages, thinking, reasoning_effort);

    // 4. Store this interaction in long‑term memory (for future sessions)
    await storeMemory(user_id, message, responseText);

    // 5. Send response back to frontend
    res.json({ response: responseText, memory_used: !!context });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
