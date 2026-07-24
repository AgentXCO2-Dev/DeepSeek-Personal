import axios from 'axios';
import { config } from './config.js';
import { moderateUserInput, moderateAIOutput, getSafetySystemPrompt } from './guardrails.js';

// ============================
// HELPERS
// ============================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================
// MAIN CHAT COMPLETION (WITH GUARDRAILS)
// ============================

export async function chatCompletion(messages, thinking = true, reasoningEffort = 'high') {
  // 1. Check the user's last message
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (lastUserMsg && lastUserMsg.content) {
    try {
      moderateUserInput(lastUserMsg.content);
    } catch (error) {
      if (error.code === 'SAFETY_VIOLATION') {
        return "I can't help with that request. Let's keep our conversation respectful and safe. 🙏";
      }
      throw error;
    }
  }

  // 2. Inject safety system prompt
  const safetyPrompt = getSafetySystemPrompt();
  let systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg) {
    systemMsg.content = safetyPrompt + '\n\n' + systemMsg.content;
  } else {
    messages.unshift({ role: 'system', content: safetyPrompt });
  }

  // 3. Call Cerebras
  try {
    const response = await callCerebras(messages);
    const safeResponse = moderateAIOutput(response);
    return safeResponse;
  } catch (error) {
    console.error('Cerebras API error:', error.message);
    throw error;
  }
}

// ============================
// CEREBRAS IMPLEMENTATION
// ============================

async function callCerebras(messages) {
  if (!config.cerebrasApiKey) {
    throw new Error('❌ CEREBRAS_API_KEY not configured. Please add it to your environment variables.');
  }

  // Extract system prompt (if any)
  let systemPrompt = '';
  const filteredMessages = messages.filter(msg => {
    if (msg.role === 'system') {
      systemPrompt = msg.content;
      return false;
    }
    return true;
  });

  // Format messages for Cerebras (OpenAI-compatible)
  const cerebrasMessages = [];
  if (systemPrompt) {
    cerebrasMessages.push({ role: 'system', content: systemPrompt });
  }
  filteredMessages.forEach(msg => {
    cerebrasMessages.push({ role: msg.role, content: msg.content });
  });

  const payload = {
    model: 'llama3.1-70b', // Cerebras model – fast and free!
    messages: cerebrasMessages,
    temperature: 0.7,
    max_tokens: 8192,
    top_p: 0.95,
    stream: false,
  };

  try {
    const response = await axios.post(
      'https://api.cerebras.ai/v1/chat/completions',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.cerebrasApiKey}`,
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Cerebras');
    }
    return content;
  } catch (error) {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.error?.message || error.message;

    // Handle rate limits
    if (status === 429) {
      const retryAfter = parseInt(error.response?.headers?.['retry-after'] || '5000');
      console.log(`⏳ Cerebras rate limited. Waiting ${retryAfter}ms...`);
      await sleep(retryAfter);
      // Retry once after waiting
      return await callCerebras(messages);
    }

    if (status === 401 || status === 403) {
      throw new Error('❌ Invalid Cerebras API key. Please check your CEREBRAS_API_KEY.');
    }

    if (errorMessage.toLowerCase().includes('quota')) {
      throw new Error('❌ Cerebras quota exhausted. Please check your usage at inference.cerebras.ai');
    }

    throw new Error(`Cerebras API error: ${errorMessage}`);
  }
}
