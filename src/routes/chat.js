import express from 'express';
import { authenticate } from '../auth.js';
import { storeMemory, buildContext } from '../memory.js';
import { chatCompletion } from '../deepseek-client.js';
import { SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT } from '../prompts.js';
import { moderateText } from '../guardrails.js';

const router = express.Router();

router.post('/api/chat', authenticate, async (req, res) => {
  const { user_id, message, history = [], system_prompt = null, thinking = true, reasoning_effort = 'high' } = req.body;

  if (!user_id || !message) {
    return res.status(400).json({ error: 'user_id and message are required' });
  }

  try {
    // --- MODERATE THE CUSTOM SYSTEM PROMPT (if provided) ---
    let customPrompt = null;
    if (system_prompt && system_prompt.trim()) {
      const { flagged, score } = moderateText(system_prompt);
      if (flagged) {
        return res.status(400).json({
          error: `⚠️ Your custom prompt was flagged as unsafe (score: ${score}). Please revise it.`
        });
      }
      customPrompt = system_prompt.trim();
    }

    // 1. Retrieve long‑term memory context
    const context = await buildContext(user_id, message);

    // 2. Build the messages array
    const messages = [];

    // --- System Prompt: merge safety + custom (if any) ---
    // Import safety prompt from guardrails (we need to import it)
    // We'll import getSafetySystemPrompt dynamically or include it here.
    // For simplicity, we'll import it from guardrails.
    const { getSafetySystemPrompt } = await import('../guardrails.js');
    const safetyPrompt = getSafetySystemPrompt();

    let finalSystemPrompt = safetyPrompt;
    if (customPrompt) {
      // Append custom prompt after safety instructions
      finalSystemPrompt += `\n\n--- Additional Personality / Instructions from User ---\n${customPrompt}`;
    }

    messages.push({ role: 'system', content: finalSystemPrompt });

    // Memory context
    if (context) {
      messages.push({
        role: 'user',
        content: `(Context from past conversations:)\n${context}`
      });
    }

    // Chat history
    messages.push(...history);

    // New user message
    messages.push({ role: 'user', content: message });

    // 3. Call the LLM
    const responseText = await chatCompletion(messages, thinking, reasoning_effort);

    // 4. Store memory
    await storeMemory(user_id, message, responseText);

    res.json({ response: responseText, memory_used: !!context });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
